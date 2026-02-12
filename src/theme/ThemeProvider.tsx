import React, { createContext, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, useColorScheme, View } from 'react-native';
import { Theme, lightTheme, darkTheme } from './index';
import { useThemePreference, ThemePreference } from '../hooks/useThemePreference';

export interface ThemeContextValue {
  theme: Theme;
  colorScheme: 'light' | 'dark';
  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: lightTheme,
  colorScheme: 'light',
  themePreference: 'system',
  setThemePreference: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const deviceScheme = useColorScheme();
  const { preference, setPreference, isLoading } = useThemePreference();

  const resolvedScheme = useMemo(() => {
    if (preference === 'system') {
      return deviceScheme === 'dark' ? 'dark' : 'light';
    }
    return preference;
  }, [preference, deviceScheme]);

  const theme = resolvedScheme === 'dark' ? darkTheme : lightTheme;

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      colorScheme: resolvedScheme,
      themePreference: preference,
      setThemePreference: setPreference,
    }),
    [theme, resolvedScheme, preference, setPreference]
  );

  if (isLoading) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
