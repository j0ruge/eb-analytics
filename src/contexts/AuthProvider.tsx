import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { User, Role } from '../types/auth';
import { authService } from '../services/authService';
import { RegisterDTO } from '../types/auth';

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isCoordinator: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  register: (dto: RegisterDTO) => Promise<{ user: User | null; error: string | null; isFirstUser: boolean }>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  isCoordinator: false,
  isLoading: true,
  login: async () => ({ error: null }),
  register: async () => ({ user: null, error: null, isFirstUser: false }),
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    authService
      .getSession()
      .then((session) => {
        if (session) {
          setUser(session.user);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (!result.error && result.user) {
      setUser(result.user);
    }
    return { error: result.error };
  }, []);

  const register = useCallback(async (dto: RegisterDTO) => {
    const result = await authService.register(dto);
    if (!result.error && result.user) {
      setUser(result.user);
      const isFirstUser = result.user.role === Role.COORDINATOR;
      return { user: result.user, error: null, isFirstUser };
    }
    return { user: null, error: result.error, isFirstUser: false };
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isCoordinator: user?.role === Role.COORDINATOR,
      isLoading,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
