/**
 * useWfNewSettings — React binding for the WfNewSettingsStore.
 *
 * Subscribes via `useSyncExternalStore` (the project's store pattern), so any
 * component re-renders exactly when a setting changes — across components, in
 * the SAME tab, with no manual `window 'storage'` listeners or polling.
 */
import { useSyncExternalStore } from 'react';
import { wfNewSettings } from './WfNewSettingsStore';
import type { WfNewSettings } from './WfNewSettingsStore';

export function useWfNewSettings(): WfNewSettings {
  return useSyncExternalStore(
    wfNewSettings.subscribe,
    wfNewSettings.getSnapshot,
    wfNewSettings.getSnapshot,
  );
}
