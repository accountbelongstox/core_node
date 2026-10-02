/* Wf word-group center - the ONE owner of the user's word-group list. The shell, the daily-reading
 * picker and the orchestration forms read this store; no surface fetches the list itself. Loads are
 * single-flight, a failed load keeps the last list, and the list resets on logout / auth expiry. */

import { useSyncExternalStore } from 'react';
import { ChangeSignal } from '../../../core/events/ChangeSignal';
import { wfNewApi } from '../api';
import type { WordGroup } from '../api';

const EMPTY_GROUPS: WordGroup[] = [];

class WordNewWordGroupCenterClass {
  private groups: WordGroup[] = EMPTY_GROUPS;
  private loaded = false;
  private inflight: Promise<WordGroup[]> | null = null;
  private readonly changes = new ChangeSignal();

  constructor() {
    wfNewApi.onAuthExpired(() => this.reset());
  }

  readonly subscribe = this.changes.subscribe;

  get = (): WordGroup[] => this.groups;

  /** Fetch the list (shared by concurrent callers); a loaded list is reused unless `force`. */
  load(force = false): Promise<WordGroup[]> {
    if (this.inflight) return this.inflight;
    if (this.loaded && !force) return Promise.resolve(this.groups);
    this.inflight = wfNewApi.getWordGroups()
      .then((groups) => {
        this.loaded = true;
        this.set(Array.isArray(groups) ? groups : EMPTY_GROUPS);
        return this.groups;
      })
      .finally(() => { this.inflight = null; });
    return this.inflight;
  }

  reset(): void {
    this.loaded = false;
    this.set(EMPTY_GROUPS);
  }

  private set(next: WordGroup[]): void {
    if (next === this.groups) return;
    this.groups = next;
    this.changes.emit();
  }
}

export const wordNewWordGroups = new WordNewWordGroupCenterClass();

export function useWordNewWordGroups(): WordGroup[] {
  return useSyncExternalStore(wordNewWordGroups.subscribe, wordNewWordGroups.get, () => EMPTY_GROUPS);
}
