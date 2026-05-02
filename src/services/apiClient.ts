import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_JWT_KEY = 'eb.auth.jwt';
const ASYNC_JWT_KEY = '@eb-insights/auth-jwt';

const apiUrlConfig = Constants.expoConfig?.extra?.apiUrl;
const BASE_URL: string =
  (typeof apiUrlConfig === 'string' ? apiUrlConfig : '') ||
  (__DEV__ ? 'http://localhost:3000' : '');

if (!BASE_URL && !__DEV__) {
  console.error('[apiClient] EXPO_PUBLIC_API_URL não configurado em app.config.js');
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

// NOTE: on web, JWT lives in AsyncStorage → localStorage, which is readable by
// any JS on the page (XSS exposure). The web target is dev-only today; if a
// public web build is ever shipped, move to an httpOnly-cookie strategy.
export async function getStoredJwt(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(ASYNC_JWT_KEY);
  }
  const { getItemAsync } = await import('expo-secure-store');
  return getItemAsync(AUTH_JWT_KEY);
}

export async function saveJwt(jwt: string): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(ASYNC_JWT_KEY, jwt);
    return;
  }
  const { setItemAsync } = await import('expo-secure-store');
  await setItemAsync(AUTH_JWT_KEY, jwt);
}

export async function clearJwt(): Promise<void> {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(ASYNC_JWT_KEY);
    return;
  }
  const { deleteItemAsync } = await import('expo-secure-store');
  await deleteItemAsync(AUTH_JWT_KEY);
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<ApiResponse<T>> {
  if (!BASE_URL) {
    return { data: null, error: 'API não configurada', status: 0 };
  }

  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {};

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const jwt = await getStoredJwt();
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const { status } = response;

    if (status === 204) {
      return { data: null, error: null, status };
    }

    if (status >= 200 && status < 300) {
      const data = (await response.json()) as T;
      return { data, error: null, status };
    }

    // EC-001: clear JWT on 401 before any early return
    if (status === 401) {
      await clearJwt();
    }

    // Expected HTTP errors — parse server message if available
    try {
      const errorBody = await response.json();
      const message = errorBody.message || errorBody.error;
      if (message && typeof message === 'string') {
        return { data: null, error: message, status };
      }
    } catch {
      // Could not parse error body
    }

    if (status === 401) {
      return { data: null, error: 'Sessão expirada', status };
    }
    if (status === 403) {
      return { data: null, error: 'Acesso restrito', status };
    }
    if (status === 409) {
      return { data: null, error: 'Este email já está cadastrado', status };
    }

    return { data: null, error: 'Erro no servidor, tente novamente', status };
  } catch {
    return { data: null, error: 'Sem conexão', status: 0 };
  }
}

// ---------------------------------------------------------------------------
// Spec 008 — timeout-aware request helper for sync endpoints.
// AbortController cancels the underlying fetch so a hung socket does not
// keep the radio on past the 30-second cap (FR-024b, SC-004).
// ---------------------------------------------------------------------------

export interface ApiResponseWithHeaders<T> extends ApiResponse<T> {
  // Exposes selected response headers for callers that need them (e.g. syncService
  // reads Retry-After on 429 per FR-024a). Always lowercased keys.
  headers: Record<string, string>;
}

async function requestWithTimeout<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body: unknown | undefined,
  timeoutMs: number,
): Promise<ApiResponseWithHeaders<T>> {
  const empty: Record<string, string> = {};

  if (!BASE_URL) {
    return { data: null, error: 'API não configurada', status: 0, headers: empty };
  }

  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const jwt = await getStoredJwt();
  if (jwt) {
    headers['Authorization'] = `Bearer ${jwt}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key.toLowerCase()] = value;
    });

    const { status } = response;

    if (status === 204) {
      return { data: null, error: null, status, headers: responseHeaders };
    }

    if (status >= 200 && status < 300) {
      const data = (await response.json()) as T;
      return { data, error: null, status, headers: responseHeaders };
    }

    if (status === 401) {
      await clearJwt();
    }

    let errorMessage: string | null = null;
    try {
      const errorBody = await response.json();
      const raw = errorBody.message || errorBody.error;
      if (raw && typeof raw === 'string') errorMessage = raw;
    } catch {
      // body not JSON
    }

    if (!errorMessage) {
      if (status === 401) errorMessage = 'Sessão expirada';
      else if (status === 403) errorMessage = 'Acesso restrito';
      else if (status === 413) errorMessage = 'Lote muito grande';
      else if (status === 429) errorMessage = 'Muitas requisições, tente novamente';
      else errorMessage = 'Erro no servidor, tente novamente';
    }

    return { data: null, error: errorMessage, status, headers: responseHeaders };
  } catch (err) {
    // AbortError (timeout) and network failures both land here. Distinct
    // messages let callers (and users) see whether the request was cut off
    // by our 30s cap or by a connectivity failure.
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      data: null,
      error: aborted ? 'Tempo limite atingido' : 'Sem conexão',
      status: 0,
      headers: empty,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  get<T>(path: string): Promise<ApiResponse<T>> {
    return request<T>('GET', path);
  },

  post<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>('POST', path, body);
  },

  patch<T>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>('PATCH', path, body);
  },

  // Spec 008 — timeout-aware variants used by syncService / catalogSyncService.
  getWithTimeout<T>(path: string, timeoutMs: number): Promise<ApiResponseWithHeaders<T>> {
    return requestWithTimeout<T>('GET', path, undefined, timeoutMs);
  },

  postWithTimeout<T>(
    path: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<ApiResponseWithHeaders<T>> {
    return requestWithTimeout<T>('POST', path, body, timeoutMs);
  },

  patchWithTimeout<T>(
    path: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<ApiResponseWithHeaders<T>> {
    return requestWithTimeout<T>('PATCH', path, body, timeoutMs);
  },
};

// Timeout used by catalog write-back calls (createProfessor/updateSeries/etc.).
// Matches sync path FR-024b cap so a hung socket does not keep the radio on
// past the 30-second mark.
export const CATALOG_WRITE_TIMEOUT_MS = 30_000;
