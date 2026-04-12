import { useCallback, useEffect, useRef, useState } from 'react';
import { ChartCardStatus, DashboardResult } from '../types/dashboard';

interface ChartCardState<T> {
  status: ChartCardStatus;
  data: T[];
  excludedCount: number;
  errorMessage: string | null;
  reload: () => void;
}

/**
 * Per-card state machine for the Statistics Dashboard (009, FR-016).
 *
 * Each chart card calls this hook with its own loader so that loading/error
 * states are isolated: one failing query shows a retry button inside its own
 * card without hiding the other charts. The dashboard screen invokes all
 * hooks on mount so the loaders run in parallel (Promise.allSettled semantics
 * emerge naturally from independent effects).
 */
export function useChartCardState<T>(
  loader: () => Promise<DashboardResult<T>>,
): ChartCardState<T> {
  const [status, setStatus] = useState<ChartCardStatus>('loading');
  const [data, setData] = useState<T[]>([]);
  const [excludedCount, setExcludedCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    setStatus('loading');
    setErrorMessage(null);
    try {
      const result = await loaderRef.current();
      setData(result.data);
      setExcludedCount(result.excludedCount);
      setStatus('success');
    } catch (err) {
      console.error('[useChartCardState] loader rejected:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'Erro ao carregar este gráfico',
      );
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return { status, data, excludedCount, errorMessage, reload: run };
}
