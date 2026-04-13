import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, saveJwt, clearJwt } from './apiClient';
import { User, LoginDTO, RegisterDTO, AuthSession } from '../types/auth';

const USER_STORAGE_KEY = '@eb-insights/auth-user';

let pendingSessionPromise: Promise<AuthSession | null> | null = null;

interface AuthResponse {
  jwt: string;
  user: User;
}

export const authService = {
  async register(dto: RegisterDTO): Promise<{ user: User; error: string | null }> {
    const { data, error } = await apiClient.post<AuthResponse>('/auth/register', dto);
    if (error || !data) {
      return { user: null as unknown as User, error: error || 'Erro no servidor, tente novamente' };
    }

    await saveJwt(data.jwt);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    pendingSessionPromise = null;

    return { user: data.user, error: null };
  },

  async login(email: string, password: string): Promise<{ user: User; error: string | null }> {
    const dto: LoginDTO = { email, password };
    const { data, error, status } = await apiClient.post<AuthResponse>('/auth/login', dto);

    if (error || !data) {
      if (status === 401) {
        return { user: null as unknown as User, error: 'Email ou senha inválidos' };
      }
      return { user: null as unknown as User, error: error || 'Erro no servidor, tente novamente' };
    }

    await saveJwt(data.jwt);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    pendingSessionPromise = null;

    return { user: data.user, error: null };
  },

  async logout(): Promise<void> {
    await clearJwt();
    await AsyncStorage.removeItem(USER_STORAGE_KEY);
    pendingSessionPromise = null;
  },

  async getSession(): Promise<AuthSession | null> {
    if (pendingSessionPromise) return pendingSessionPromise;

    pendingSessionPromise = (async (): Promise<AuthSession | null> => {
      try {
        const { getStoredJwt } = await import('./apiClient').then(m => ({
          getStoredJwt: async () => {
            // Read JWT through apiClient's storage abstraction
            const { Platform } = await import('react-native');
            if (Platform.OS === 'web') {
              return AsyncStorage.getItem('@eb-insights/auth-jwt');
            }
            const { getItemAsync } = await import('expo-secure-store');
            return getItemAsync('eb:auth:jwt');
          },
        }));

        const jwt = await getStoredJwt();
        if (!jwt) return null;

        const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
        if (!userJson) return null;

        const user = JSON.parse(userJson) as User;
        return { jwt, user };
      } catch {
        return null;
      }
    })().catch(() => {
      pendingSessionPromise = null;
      return null;
    });

    return pendingSessionPromise;
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!userJson) return null;
      return JSON.parse(userJson) as User;
    } catch {
      return null;
    }
  },

  /** Reset internal cache — for testing only */
  __resetCache(): void {
    pendingSessionPromise = null;
  },
};
