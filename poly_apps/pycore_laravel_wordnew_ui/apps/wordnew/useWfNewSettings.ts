/**
 * useWfNewSettings — React binding for the WfNewSettingsStore.
 *
 * Subscribes via `useSyncExternalStore` (the project's store pattern), so any
 * component re-renders exactly when a setting changes — across components, in
 * the SAME tab, with no manual `window 'storage'` listeners or polling.
 * `useWfNewSetting(key)` binds ONE field as [value, setter]: the store stays the
 * single source of truth, pages keep no local copies.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { resolveLearningTargets, wfNewSettings } from './WfNewSettingsStore';
import type { WfNewSettings } from './WfNewSettingsStore';

export function useWfNewSettings(): WfNewSettings {
  return useSyncExternalStore(
    wfNewSettings.subscribe,
    wfNewSettings.getSnapshot,
    wfNewSettings.getSnapshot,
  );
}

export function useWfNewSetting<K extends keyof WfNewSettings>(key: K): [WfNewSettings[K], (value: WfNewSettings[K]) => void] {
  const value = useSyncExternalStore(
    wfNewSettings.subscribe,
    () => wfNewSettings.get(key),
    () => wfNewSettings.get(key),
  );
  const setValue = useCallback((next: WfNewSettings[K]) => wfNewSettings.setField(key, next), [key]);
  return [value, setValue];
}

export function useWfNewLearningTargets(): string[] {
  const { settingTargetLangs, settingTargetLang } = useWfNewSettings();
  return useMemo(
    () => resolveLearningTargets({ settingTargetLangs, settingTargetLang }),
    [settingTargetLangs, settingTargetLang],
  );
}
