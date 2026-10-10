import { capDb } from '@/apps/wordnew/platform/capabilities/CapDatabase';
import { StorageManager } from '../../core/persistence/StorageManager';
import {
  getLocalDataGroup,
  getLocalDataGroups,
  ownerOfKey,
} from '../../core/persistence/LocalDataRegistry';
import type { LocalDataGroup, LocalDataSourceKind } from '../../core/persistence/LocalDataRegistry';
import {
  DEVICE_KV_FALLBACK_PREFIX,
  deviceKvBackend,
  deviceKvDelete,
  deviceKvEntries,
} from './DeviceKvCache';
import type { DeviceKvBackend } from './DeviceKvCache';

export const LOCAL_DATA_OTHER_GROUP_ID = 'shared.other';
export const LOCAL_DATA_OTHER_LABEL_KEY = 'common.local_data.groups.other';

export interface LocalDataGroupUsage {
  id: string;
  appId: string;
  labelKey: string;
  descriptionKey?: string;
  clearable: boolean;
  entries: number;
  bytes: number;
  stores: LocalDataSourceKind[];
}

export interface LocalDataQuota {
  usage: number;
  quota: number;
}

export interface LocalDataReport {
  backend: DeviceKvBackend;
  groups: LocalDataGroupUsage[];
  totalEntries: number;
  totalBytes: number;
  quota: LocalDataQuota | null;
  persisted: boolean | null;
  measuredAt: number;
}

interface Tally {
  entries: number;
  bytes: number;
  stores: Set<LocalDataSourceKind>;
}

function localStorageKeys(): string[] {
  return StorageManager.keysWithPrefix('').filter((key) => !key.startsWith(DEVICE_KV_FALLBACK_PREFIX));
}

function hasCacheStorage(): boolean {
  return typeof caches !== 'undefined';
}

async function resolveCollectionNames(group: LocalDataGroup): Promise<string[]> {
  const names = new Set<string>();
  for (const source of group.sources) {
    if (source.kind !== 'collections') continue;
    source.names?.forEach((name) => names.add(name));
    try {
      (await source.resolve?.())?.forEach((name) => names.add(name));
    } catch {
      // An unresolved scope index only hides its collections from the report.
    }
  }
  return [...names];
}

async function cacheStorageSize(cacheName: string): Promise<{ entries: number; bytes: number }> {
  const cache = await caches.open(cacheName);
  const requests = await cache.keys();
  let bytes = 0;
  for (const request of requests) {
    try {
      const response = await cache.match(request);
      const declared = Number(response?.headers.get('content-length'));
      bytes += Number.isFinite(declared) && declared > 0 ? declared : (await response?.clone().blob())?.size ?? 0;
    } catch {
      // An unreadable entry counts as zero bytes.
    }
  }
  return { entries: requests.length, bytes };
}

async function readQuota(): Promise<{ quota: LocalDataQuota | null; persisted: boolean | null }> {
  if (typeof navigator === 'undefined' || !navigator.storage) return { quota: null, persisted: null };
  let quota: LocalDataQuota | null = null;
  let persisted: boolean | null = null;
  try {
    const estimate = await navigator.storage.estimate();
    if (estimate.quota) quota = { usage: estimate.usage ?? 0, quota: estimate.quota };
  } catch {
    // The estimate is optional.
  }
  try {
    persisted = (await navigator.storage.persisted?.()) ?? null;
  } catch {
    // The persistence flag is optional.
  }
  return { quota, persisted };
}

export async function measureLocalData(): Promise<LocalDataReport> {
  const tallies = new Map<string, Tally>();
  const add = (groupId: string, store: LocalDataSourceKind, entries: number, bytes: number): void => {
    const tally = tallies.get(groupId) ?? { entries: 0, bytes: 0, stores: new Set<LocalDataSourceKind>() };
    tally.entries += entries;
    tally.bytes += bytes;
    tally.stores.add(store);
    tallies.set(groupId, tally);
  };

  for (const key of localStorageKeys()) {
    const owner = ownerOfKey('localStorage', key);
    add(owner?.id ?? LOCAL_DATA_OTHER_GROUP_ID, 'localStorage', 1, key.length + (StorageManager.getRaw(key)?.length ?? 0));
  }

  for (const entry of await deviceKvEntries()) {
    const owner = ownerOfKey('deviceKv', entry.key);
    add(owner?.id ?? LOCAL_DATA_OTHER_GROUP_ID, 'deviceKv', 1, entry.bytes);
  }

  const groups = getLocalDataGroups();
  const collectionNames = await Promise.all(groups.map(resolveCollectionNames));
  try {
    await capDb.open();
    for (const [index, group] of groups.entries()) {
      for (const name of collectionNames[index]) {
        try {
          const stats = await capDb.collection(name).stats();
          if (stats.count > 0) add(group.id, 'collections', stats.count, stats.bytes);
        } catch {
          // A collection that cannot be read is not reported.
        }
      }
    }
  } catch {
    // Without a database there are no collections to report.
  }

  if (hasCacheStorage()) {
    try {
      for (const cacheName of await caches.keys()) {
        const size = await cacheStorageSize(cacheName);
        add(ownerOfKey('cacheStorage', cacheName)?.id ?? LOCAL_DATA_OTHER_GROUP_ID, 'cacheStorage', size.entries, size.bytes);
      }
    } catch {
      // Cache Storage can be blocked.
    }
  }

  const usages: LocalDataGroupUsage[] = [];
  for (const [id, tally] of tallies) {
    const group = getLocalDataGroup(id);
    usages.push({
      id,
      appId: group?.appId ?? 'shared',
      labelKey: group?.labelKey ?? LOCAL_DATA_OTHER_LABEL_KEY,
      descriptionKey: group?.descriptionKey,
      clearable: group?.clearable ?? false,
      entries: tally.entries,
      bytes: tally.bytes,
      stores: [...tally.stores],
    });
  }
  usages.sort((left, right) => right.bytes - left.bytes);

  const { quota, persisted } = await readQuota();
  return {
    backend: await deviceKvBackend(),
    groups: usages,
    totalEntries: usages.reduce((sum, usage) => sum + usage.entries, 0),
    totalBytes: usages.reduce((sum, usage) => sum + usage.bytes, 0),
    quota,
    persisted,
    measuredAt: Date.now(),
  };
}

/** Wipes one registered group; groups marked non-clearable (auth, session, endpoint selection) are refused. */
export async function clearLocalDataGroup(id: string): Promise<boolean> {
  const group = getLocalDataGroup(id);
  if (!group || !group.clearable) return false;
  if (group.clear) {
    await group.clear();
    return true;
  }

  for (const key of localStorageKeys()) {
    if (ownerOfKey('localStorage', key)?.id === id) StorageManager.remove(key);
  }

  for (const entry of await deviceKvEntries()) {
    if (ownerOfKey('deviceKv', entry.key)?.id === id) await deviceKvDelete(entry.key);
  }

  const names = await resolveCollectionNames(group);
  if (names.length) {
    try {
      await capDb.open();
      for (const name of names) await capDb.collection(name).clear().catch(() => undefined);
    } catch {
      // No database, nothing to clear.
    }
  }

  if (hasCacheStorage()) {
    for (const cacheName of await caches.keys()) {
      if (ownerOfKey('cacheStorage', cacheName)?.id === id) await caches.delete(cacheName);
    }
  }
  return true;
}
