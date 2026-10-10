import { useSyncExternalStore } from 'react';
import type { AppUpdater, AppUpdateSnapshot } from './AppUpdater';

export function useAppUpdate(updater: AppUpdater): AppUpdateSnapshot {
  return useSyncExternalStore(updater.subscribe, updater.getSnapshot, updater.getSnapshot);
}
