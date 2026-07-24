/**
 * usePersistedRef — a Vue ref mirrored to chrome.storage.local.
 *
 * The popup window is destroyed by Chrome whenever it loses focus, so any plain
 * `ref` (active tab, sub-tab, last view, …) resets to its default on the next
 * open. This composable persists the value: it restores the stored value on
 * creation and writes every change back, so reopening the popup lands exactly
 * where the user left off (e.g. the Extensions › Bing Dictionary view).
 *
 * Keys are namespaced under "ui:" so UI navigation state never collides with the
 * extension's other storage keys (selectedModel, extensionConfigs, …). Restore is
 * async (storage.local has no sync API); for v-show driven tabs the at-most-one
 * frame before the stored value lands is imperceptible.
 *
 * Cross-view sync: a storage.onChanged listener keeps multiple open surfaces
 * (popup + options page) in agreement without extra wiring.
 *
 * Usage (drop-in for `ref`):
 *   const activeTab = usePersistedRef('activeTab', 'server');
 */
import { ref, watch, onScopeDispose, type Ref } from 'vue';
import { UI_STORAGE_PREFIX } from '@/utils/storage-keys';

export function usePersistedRef<T>(key: string, defaultValue: T): Ref<T> {
  const storageKey = UI_STORAGE_PREFIX + key;
  const state = ref(defaultValue) as Ref<T>;
  // Guards: don't persist the default before the stored value has loaded (that
  // would clobber it); don't echo a value we just received from storage back out.
  let loaded = false;
  let applyingExternal = false;
  let revision = 0;
  let locallyChangedBeforeLoad = false;

  // Restore the stored value (if any) on creation.
  void (async () => {
    const loadRevision = revision;
    try {
      const got = await chrome.storage.local.get([storageKey]);
      if (revision === loadRevision && got && got[storageKey] !== undefined) {
        applyingExternal = true;
        state.value = got[storageKey] as T;
        applyingExternal = false;
      }
    } catch (error) {
      console.debug('[usePersistedRef] load failed:', key, error);
    } finally {
      loaded = true;
      if (locallyChangedBeforeLoad) {
        chrome.storage.local
          .set({ [storageKey]: state.value })
          .catch((error) => console.debug('[usePersistedRef] save failed:', key, error));
      }
    }
  })();

  // Persist every local change.
  watch(
    state,
    (value) => {
      if (applyingExternal) return;
      revision++;
      if (!loaded) {
        locallyChangedBeforeLoad = true;
        return;
      }
      chrome.storage.local
        .set({ [storageKey]: value })
        .catch((error) => console.debug('[usePersistedRef] save failed:', key, error));
    },
    { deep: true, flush: 'sync' },
  );

  // Keep other open surfaces (e.g. the options page) in sync.
  const onChanged = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ) => {
    if (area !== 'local' || !(storageKey in changes)) return;
    const next = changes[storageKey].newValue;
    if (next === undefined || JSON.stringify(next) === JSON.stringify(state.value)) return;
    revision++;
    applyingExternal = true;
    state.value = next as T;
    applyingExternal = false;
  };
  chrome.storage.onChanged.addListener(onChanged);
  // Remove the listener when the owning component/scope is torn down (matters on
  // the long-lived options page; the popup is destroyed wholesale on close).
  onScopeDispose(() => chrome.storage.onChanged.removeListener(onChanged));

  return state;
}
