import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@eb-insights/include-professor-default';
const DEFAULT_VALUE = false;

/**
 * Plain async getter so non-React code (e.g. lessonService.createLesson) can read
 * the preference without pulling in React context.
 */
export async function getIncludesProfessorDefault(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    if (value === 'true') return true;
    if (value === 'false') return false;
    return DEFAULT_VALUE;
  } catch {
    return DEFAULT_VALUE;
  }
}

export function useIncludesProfessorDefault() {
  const [value, setValueState] = useState<boolean>(DEFAULT_VALUE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'true') setValueState(true);
        else if (stored === 'false') setValueState(false);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const setValue = useCallback((next: boolean) => {
    setValueState(next);
    AsyncStorage.setItem(STORAGE_KEY, next ? 'true' : 'false').catch(() => {});
  }, []);

  return { value, setValue, isLoading };
}
