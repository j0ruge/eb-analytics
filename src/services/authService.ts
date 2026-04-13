import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, saveJwt, clearJwt, getStoredJwt } from './apiClient';
import { User, LoginDTO, RegisterDTO, AuthSession } from '../types/auth';

const USER_STORAGE_KEY = '@eb-insights/auth-user';

let pendingSessionPromise: Promise<AuthSession | null> | null = null;

interface AuthResponse {
  jwt: string;
  user: User;
}

export const authService = {
  async register(dto: RegisterDTO): Promise<{ user: User | null; error: string | null }> {
    const { data, error } = await apiClient.post<AuthResponse>('/auth/register', dto);
    if (error || !data) {
      return { user: null, error: error || 'Erro no servidor, tente novamente' };
    }

    await saveJwt(data.jwt);
    await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
    pendingSessionPromise = null;

    return { user: data.user, error: null };
  },

  async login(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    const dto: LoginDTO = { email, password };
    const { data, error, status } = await apiClient.post<AuthResponse>('/auth/login', dto);

    if (error || !data) {
      if (status === 401) {
        return { user: null, error: 'Email ou senha inválidos' };
      }
      return { user: null, error: error || 'Erro no servidor, tente novamente' };
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
      const jwt = await getStoredJwt();
      if (!jwt) return null;

      const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!userJson) return null;

      const user = JSON.parse(userJson) as User;
      if (!user || !user.id || !user.email) return null;

      return { jwt, user };
    })()
      .catch((err) => {
        console.error('getSession failed:', err);
        return null;
      })
      .finally(() => {
        pendingSessionPromise = null;
      });

    return pendingSessionPromise;
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      const userJson = await AsyncStorage.getItem(USER_STORAGE_KEY);
      if (!userJson) return null;
      return JSON.parse(userJson) as User;
    } catch (err) {
      console.error('getCurrentUser: failed to parse stored user', err);
      return null;
    }
  },

  /** Reset internal cache — for testing only */
  __resetCache(): void {
    pendingSessionPromise = null;
  },
};
