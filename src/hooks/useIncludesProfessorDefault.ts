import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@eb-insights/include-professor-default';
const DEFAULT_VALUE = false;

// In-memory cache so the sync getter returns the latest value immediately,
// even if AsyncStorage hasn't flushed yet (avoids race with setValue).
let _cachedValue: boolean | null = null;

/**
 * Plain async getter so non-React code (e.g. lessonService.createLesson) can read
 * the preference without pulling in React context.
 */
export async function getIncludesProfessorDefault(): Promise<boolean> {
  if (_cachedValue !== null) return _cachedValue;
  try {
    const value = await AsyncStorage.getItem(STORAGE_KEY);
    if (value === 'true') { _cachedValue = true; return true; }
    if (value === 'false') { _cachedValue = false; return false; }
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
    _cachedValue = next;
    AsyncStorage.setItem(STORAGE_KEY, next ? 'true' : 'false').catch(() => {});
  }, []);

  return { value, setValue, isLoading };
}
