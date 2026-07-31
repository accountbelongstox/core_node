/**
 * Task persistence storage keys.
 *
 * Long-running task sessions persist a tiny re-attach record to localStorage so
 * a full page reload can reconnect to the in-flight BACKEND work. Keys live in a
 * dedicated `task_{owner}_{feature}` namespace.
 *
 * The public hook key is the dotted form `{owner}.{feature}`. taskStorageKey
 * maps it to the namespaced
 * localStorage key. There is also a single index key holding the list of
 * currently-registered hook keys, so the provider can enumerate sessions to
 * re-attach on a fresh page load without scanning all of localStorage.
 */
import type { StorageKey } from '../persistence/StorageKeys';

const PREFIX = 'nexus_' as const;
const TASK_NS = `${PREFIX}task_` as const;

/** The index of registered task hook-keys (dotted form), persisted as JSON. */
export const TASK_INDEX_KEY = `${TASK_NS}_index` as StorageKey;

/**
 * Map a public hook key to its namespaced localStorage key. Dots become
 * underscores so the stored key stays in a flat task namespace.
 */
export function taskStorageKey(hookKey: string): StorageKey {
  const slug = hookKey.replace(/\./g, '_');
  return `${TASK_NS}${slug}` as StorageKey;
}

/** Shape persisted per session: the hook key + whatever the feature needs to re-attach. */
export interface PersistedTask<S = unknown> {
  key: string;
  saved: S;
}
