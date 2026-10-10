/**
 * Durable key-value store on the device database shared by every app: SQLite in the Capacitor app, IndexedDB
 * on the web and in the desktop (Electron) app, localStorage when neither opens. Failures read as a miss: the
 * store never blocks its caller.
 */
import { capDb } from '@/apps/wordnew/platform/capabilities/CapDatabase';
import { StorageManager } from '../../core/persistence/StorageManager';

export const DEVICE_KV_FALLBACK_PREFIX = 'devicekv:';

export type DeviceKvBackend = 'sqlite' | 'indexeddb' | 'localStorage';

export interface DeviceKvEntry {
  key: string;
  bytes: number;
}

async function openDatabase(): Promise<boolean> {
  try {
    await capDb.open();
    return true;
  } catch {
    return false;
  }
}

export async function deviceKvBackend(): Promise<DeviceKvBackend> {
  return (await openDatabase()) ? capDb.backendKind ?? 'localStorage' : 'localStorage';
}

export async function deviceKvGet<T>(key: string): Promise<T | null> {
  try {
    if (await openDatabase()) {
      const stored = await capDb.kvGet<T>(key, null);
      if (stored !== null) return stored;
    }
  } catch {
    // Falls through to the localStorage copy.
  }
  return StorageManager.get<T | null>(`${DEVICE_KV_FALLBACK_PREFIX}${key}`, null);
}

export async function deviceKvSet<T>(key: string, value: T | null): Promise<void> {
  if (value === null) return deviceKvDelete(key);
  try {
    if (await openDatabase()) {
      await capDb.kvSet(key, value);
      StorageManager.remove(`${DEVICE_KV_FALLBACK_PREFIX}${key}`);
      return;
    }
  } catch {
    // Falls through to the localStorage copy.
  }
  StorageManager.set(`${DEVICE_KV_FALLBACK_PREFIX}${key}`, value);
}

export async function deviceKvDelete(key: string): Promise<void> {
  try {
    if (await openDatabase()) await capDb.kvDelete(key);
  } catch {
    // A cache write that fails only costs the next cold start.
  }
  StorageManager.remove(`${DEVICE_KV_FALLBACK_PREFIX}${key}`);
}

/** Every key of the device store with its approximate size, across the database and the localStorage copy. */
export async function deviceKvEntries(): Promise<DeviceKvEntry[]> {
  const entries = new Map<string, number>();
  try {
    if (await openDatabase()) {
      for (const entry of await capDb.kvEntries()) entries.set(entry.key, entry.bytes);
    }
  } catch {
    // The localStorage copy below still reports.
  }
  for (const storageKey of StorageManager.keysWithPrefix(DEVICE_KV_FALLBACK_PREFIX)) {
    const key = storageKey.slice(DEVICE_KV_FALLBACK_PREFIX.length);
    const raw = StorageManager.getRaw(storageKey) ?? '';
    entries.set(key, (entries.get(key) ?? 0) + key.length + raw.length);
  }
  return [...entries].map(([key, bytes]) => ({ key, bytes }));
}
