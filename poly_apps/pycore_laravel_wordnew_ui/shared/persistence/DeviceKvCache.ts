/**
 * Durable key-value cache on the device database shared by every app: SQLite in the Capacitor app, IndexedDB
 * on the web and in the desktop (Electron) app. Failures read as a miss: the cache never blocks its caller.
 */
import { capDb } from '@/apps/wordnew/platform/capabilities/CapDatabase';

export async function deviceKvGet<T>(key: string): Promise<T | null> {
  try {
    await capDb.open();
    return await capDb.kvGet<T>(key, null);
  } catch {
    return null;
  }
}

export async function deviceKvSet<T>(key: string, value: T | null): Promise<void> {
  try {
    await capDb.open();
    if (value === null) await capDb.kvDelete(key);
    else await capDb.kvSet(key, value);
  } catch {
    // A cache write that fails only costs the next cold start.
  }
}
