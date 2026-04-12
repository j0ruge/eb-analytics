import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = '@eb-insights/device-id';

let pendingPromise: Promise<string> | null = null;

export async function getDeviceId(): Promise<string> {
  if (pendingPromise) return pendingPromise;

  pendingPromise = (async () => {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) return stored;

    const generated = uuidv4();
    await AsyncStorage.setItem(STORAGE_KEY, generated);
    return generated;
  })().catch((err) => {
    pendingPromise = null;
    throw err;
  });

  const result = await pendingPromise;
  return result;
}

export function __resetDeviceIdCache() {
  pendingPromise = null;
}
