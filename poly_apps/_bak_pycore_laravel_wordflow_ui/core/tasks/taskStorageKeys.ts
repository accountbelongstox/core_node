/**
 * Task persistence storage keys.
 *
 * Long-running task sessions persist a tiny re-attach record to localStorage so
 * a full page reload can reconnect to the in-flight BACKEND work. Keys live in a
 * dedicated `task_{end}_{feature}` namespace, layered on top of StorageKeys'
 * `nexus_` prefix convention (so every shell-owned key is `nexus_…`).
 *
 *   nexus_task_pycore_video-extract
 *   nexus_task_pycore_task-queue
 *
 * The public hook key is the dotted form `{end}.{feature}` (e.g.
 * `pycore.video-extract`) — `taskStorageKey()` maps it to the namespaced
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
 * Map a public hook key (`{end}.{feature}`) to its namespaced localStorage key
 * (`nexus_task_{end}_{feature}`). Dots in the hook key become underscores so the
 * stored key stays in the flat `task_{end}_{feature}` namespace.
 *
 * Cast to StorageKey: StorageManager is typed against the static StorageKeys
 * union, but the task layer owns a dynamic, prefix-disciplined sub-namespace.
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
