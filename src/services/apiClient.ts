import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_JWT_KEY = 'eb:auth:jwt';
const ASYNC_JWT_KEY = '@eb-insights/auth-jwt';

const BASE_URL: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ||
  (__DEV__ ? 'http://localhost:3000' : '');

if (!BASE_URL && !__DEV__) {
  console.error('[apiClient] EXPO_PUBLIC_API_URL não configurado em app.config.js');
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

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
      body: body ? JSON.stringify(body) : undefined,
    });

    const { status } = response;

    if (status === 204) {
      return { data: null, error: null, status };
    }

    if (status >= 200 && status < 300) {
      const data = (await response.json()) as T;
      return { data, error: null, status };
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
};
