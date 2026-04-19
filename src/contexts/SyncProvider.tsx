import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Alert, type AppStateStatus } from 'react-native';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useAuth } from '../hooks/useAuth';
import { syncService } from '../services/syncService';
import { catalogSyncService } from '../services/catalogSyncService';
import type {
  CatalogPullTrigger,
  CatalogPullResult,
  SyncQueueSnapshot,
  CatalogSyncSnapshot,
} from '../types/sync';

const FOREGROUND_TICK_MS = 30 * 1000; // FR-020 third trigger
const CATALOG_REFRESH_MS = 60 * 60 * 1000; // FR-040 foreground 1-hour guard

export interface SyncContextValue extends SyncQueueSnapshot, CatalogSyncSnapshot {}

export const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [pending, setPending] = useState(0);
  const [sending, setSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isPulling, setIsPulling] = useState(false);

  // Track prior auth state so we can fire the post-login pull exactly once per
  // false → true transition (FR-040 first trigger).
  const wasAuthenticatedRef = useRef(false);
  const runningRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const refreshPending = useCallback(async () => {
    const id = userIdRef.current;
    if (!id) {
      setPending(0);
      return;
    }
    try {
      const count = await syncService.countPending(id);
      setPending(count);
    } catch (err) {
      console.error('[SyncProvider] countPending failed:', err);
    }
  }, []);

  const runSyncLoop = useCallback(async () => {
    if (runningRef.current) return;
    if (!userIdRef.current) return;
    runningRef.current = true;
    setSending(true);
    try {
      const result = await syncService.runOnce();
      if (result.sessionExpired) {
        Alert.alert('Sessão expirada', 'Entre novamente para sincronizar.');
      }
      if (result.lastError) {
        setLastError(result.lastError);
      } else if (result.accepted > 0) {
        setLastError(null);
      }
    } catch (err) {
      console.error('[SyncProvider] runOnce threw unexpectedly:', err);
      setLastError('Erro inesperado na sincronização');
    } finally {
      runningRef.current = false;
      setSending(false);
      await refreshPending();
    }
  }, [refreshPending]);

  const retryNow = useCallback(
    async (ids?: string[]) => {
      await syncService.retryNow(ids);
      await refreshPending();
      await runSyncLoop();
    },
    [refreshPending, runSyncLoop],
  );

  const pullCatalog = useCallback(
    async (trigger: CatalogPullTrigger): Promise<CatalogPullResult> => {
      setIsPulling(true);
      try {
        const result = await catalogSyncService.pullNow(trigger);
        if (result.ok && result.server_now) {
          setLastSyncAt(result.server_now);
        }
        return result;
      } finally {
        setIsPulling(false);
      }
    },
    [],
  );

  // -------- mount: hydrate last catalog cursor --------
  useEffect(() => {
    catalogSyncService
      .getLastSyncAt()
      .then((v) => setLastSyncAt(v))
      .catch((err) => console.error('[SyncProvider] getLastSyncAt failed:', err));
  }, []);

  // -------- refresh pending whenever user changes --------
  useEffect(() => {
    if (authLoading) return;
    refreshPending().catch((err) =>
      console.error('[SyncProvider] initial refreshPending failed:', err),
    );
  }, [authLoading, user?.id, refreshPending]);

  // -------- auth transitions: login → pull catalog + run sync --------
  useEffect(() => {
    if (authLoading) return;
    const was = wasAuthenticatedRef.current;
    wasAuthenticatedRef.current = isAuthenticated;

    if (!was && isAuthenticated) {
      // Fresh login. Sequence catalog pull and sync drain — expo-sqlite cannot
      // serialize concurrent withTransactionAsync calls on web (surfaces as
      // "cannot start a transaction within a transaction"). Run them one after
      // the other instead of in parallel.
      (async () => {
        try {
          await pullCatalog('auto');
        } catch (err) {
          console.error('[SyncProvider] post-login catalog pull failed:', err);
        }
        try {
          await runSyncLoop();
        } catch (err) {
          console.error('[SyncProvider] post-login sync failed:', err);
        }
      })();
    }
  }, [authLoading, isAuthenticated, pullCatalog, runSyncLoop]);

  // -------- AppState + NetInfo + timer triggers --------
  useEffect(() => {
    if (authLoading || !isAuthenticated) return;

    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      // Sequence catalog pull → sync drain to avoid parallel withTransactionAsync
      // on expo-sqlite (web cannot serialize nested transactions).
      (async () => {
        try {
          const last = await catalogSyncService.getLastSyncAt();
          if (!last || Date.now() - Date.parse(last) > CATALOG_REFRESH_MS) {
            await pullCatalog('auto');
          }
        } catch (err) {
          console.error('[SyncProvider] AppState-triggered catalog pull failed:', err);
        }
        try {
          await runSyncLoop();
        } catch (err) {
          console.error('[SyncProvider] AppState-triggered sync failed:', err);
        }
      })();
    });

    const netSub = NetInfo.addEventListener((state: NetInfoState) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        runSyncLoop().catch((err) =>
          console.error('[SyncProvider] NetInfo-triggered sync failed:', err),
        );
      }
    });

    const interval = setInterval(() => {
      runSyncLoop().catch((err) =>
        console.error('[SyncProvider] timer-triggered sync failed:', err),
      );
    }, FOREGROUND_TICK_MS);

    return () => {
      appStateSub.remove();
      netSub();
      clearInterval(interval);
    };
  }, [authLoading, isAuthenticated, runSyncLoop, pullCatalog]);

  // Public surface exposes `pullNow` that also tracks isPulling.
  const pullNow = useCallback(
    (trigger: CatalogPullTrigger) => pullCatalog(trigger),
    [pullCatalog],
  );

  const value = useMemo<SyncContextValue>(
    () => ({
      pending,
      sending,
      lastError,
      retryNow,
      lastSyncAt,
      isPulling,
      pullNow,
    }),
    [pending, sending, lastError, retryNow, lastSyncAt, isPulling, pullNow],
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

// Also expose a way for the sync service (e.g. post-enqueue) to ask the
// provider to re-check — implemented by screens through the retryNow hook
// or by re-renders. No imperative hook needed for US1.
