/**
 * usePersistedRef — a Vue ref mirrored to chrome.storage.local.
 *
 * The popup window is destroyed by Chrome whenever it loses focus, so any plain
 * `ref` (active tab, sub-tab, last view, …) resets to its default on the next
 * open. This composable persists the value: it restores the stored value on
 * creation and writes every change back, so reopening the popup lands exactly
 * where the user left off (e.g. the Extensions › Bing Dictionary view).
 *
 * SHARED UNDERLYING STATE (8.10): every call with the same key returns the ONE
 * module-level ref — two components never hold duplicate copies that could
 * drift apart between async storage round-trips. One storage read, one write
 * watcher, and one shared onChanged listener per page for the whole registry.
 *
 * Cross-view sync: a storage.onChanged listener keeps multiple open surfaces
 * (popup + options page) in agreement without extra wiring.
 *
 * Usage (drop-in for `ref`):
 *   const activeTab = usePersistedRef('activeTab', 'server');
 */
import { ref, watch, type Ref } from 'vue';
import { UI_STORAGE_PREFIX } from '@/utils/storage-keys';

/** One live ref per UI storage key, shared by every caller on this page. */
const registry = new Map<string, Ref<unknown>>();
/** Keys whose initial storage load has completed (any consumer). */
const loadedKeys = new Set<string>();
/** Keys with a local change that arrived before the first load resolved. */
const dirtyBeforeLoad = new Set<string>();
/** Monotonic per-key revision so a stale load never clobbers a newer value. */
const revisions = new Map<string, number>();
/** Keys currently applying a storage-originated value (no write echo). */
const applyingExternal = new Set<string>();

function bumpRevision(storageKey: string): void {
  revisions.set(storageKey, (revisions.get(storageKey) ?? 0) + 1);
}

/** Single storage.onChanged listener for the whole registry (per page). */
let globalListenerAttached = false;
function attachGlobalListener(): void {
  if (globalListenerAttached) return;
  globalListenerAttached = true;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const storageKey of Object.keys(changes)) {
      const state = registry.get(storageKey);
      if (!state) continue;
      const next = changes[storageKey].newValue;
      if (next === undefined || JSON.stringify(next) === JSON.stringify(state.value)) continue;
      bumpRevision(storageKey);
      applyingExternal.add(storageKey);
      state.value = next;
      applyingExternal.delete(storageKey);
    }
  });
}

export function usePersistedRef<T>(key: string, defaultValue: T): Ref<T> {
  const storageKey = UI_STORAGE_PREFIX + key;
  const existing = registry.get(storageKey);
  if (existing) return existing as Ref<T>;

  const state = ref(defaultValue) as Ref<unknown>;
  registry.set(storageKey, state);
  attachGlobalListener();

  // Restore the stored value (if any) on first creation.
  void (async () => {
    const loadRevision = revisions.get(storageKey) ?? 0;
    try {
      const got = await chrome.storage.local.get([storageKey]);
      if ((revisions.get(storageKey) ?? 0) === loadRevision && got && got[storageKey] !== undefined) {
        applyingExternal.add(storageKey);
        state.value = got[storageKey];
        applyingExternal.delete(storageKey);
      }
    } catch (error) {
      console.debug('[usePersistedRef] load failed:', key, error);
    } finally {
      loadedKeys.add(storageKey);
      if (dirtyBeforeLoad.has(storageKey)) {
        dirtyBeforeLoad.delete(storageKey);
        chrome.storage.local
          .set({ [storageKey]: state.value })
          .catch((error) => console.debug('[usePersistedRef] save failed:', key, error));
      }
    }
  })();

  // Persist every local change (one watcher for the shared ref).
  watch(
    state,
    (value) => {
      if (applyingExternal.has(storageKey)) return;
      bumpRevision(storageKey);
      if (!loadedKeys.has(storageKey)) {
        dirtyBeforeLoad.add(storageKey);
        return;
      }
      chrome.storage.local
        .set({ [storageKey]: value })
        .catch((error) => console.debug('[usePersistedRef] save failed:', key, error));
    },
    { deep: true, flush: 'sync' },
  );

  return state as Ref<T>;
}
