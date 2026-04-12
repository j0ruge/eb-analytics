import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = '@eb-insights/device-id';

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;

  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored) {
    cached = stored;
    return stored;
  }

  const generated = uuidv4();
  await AsyncStorage.setItem(STORAGE_KEY, generated);
  cached = generated;
  return generated;
}

// Exposed only for tests — lets a suite reset the in-memory cache between cases.
export function __resetDeviceIdCache() {
  cached = null;
}
