import { useSyncExternalStore } from 'react';
import { wordNewAppUpdater, type WordNewUpdateSnapshot } from './WordNewAppUpdater';

export function useWordNewAppUpdate(): WordNewUpdateSnapshot {
  return useSyncExternalStore(wordNewAppUpdater.subscribe, wordNewAppUpdater.getSnapshot, wordNewAppUpdater.getSnapshot);
}
