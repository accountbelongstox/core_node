import { wfNewApi } from '../../api';
import type { WordGroup } from '../../api/types/core';
import { StorageManager } from '../../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';

const APP_SETTINGS_KEY = 'dailyReadingWordGroup';

interface StoredSelection {
  id: string | null;
  updatedAt: string | null;
}

export interface DailyReadingWordGroupSnapshot extends StoredSelection {
  groups: WordGroup[];
  loading: boolean;
  syncing: boolean;
  error: string | null;
}

type StoreListener = () => void;

const listeners = new Set<StoreListener>();
let loadPromise: Promise<WordGroup[]> | null = null;
let syncVersion = 0;

function readStoredSelection(): StoredSelection {
  let stored: unknown = null;

  try {
    stored = StorageManager.get<unknown>(StorageKeys.WORDNEW_DAILY_READING_WORD_GROUP, null);
  } catch {
    return { id: null, updatedAt: null };
  }
  if (typeof stored === 'string') {
    return { id: stored.trim() || null, updatedAt: null };
  }
  if (!stored || typeof stored !== 'object') {
    return { id: null, updatedAt: null };
  }
  const record = stored as Record<string, unknown>;
  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id : null,
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
  };
}

const initialSelection = readStoredSelection();
let snapshot: DailyReadingWordGroupSnapshot = Object.freeze({
  ...initialSelection,
  groups: [],
  loading: false,
  syncing: false,
  error: null,
});

function emit(patch: Partial<DailyReadingWordGroupSnapshot>): void {
  snapshot = Object.freeze({ ...snapshot, ...patch });
  listeners.forEach((listener) => listener());
}

function persistSelection(selection: StoredSelection): void {
  StorageManager.set(StorageKeys.WORDNEW_DAILY_READING_WORD_GROUP, selection);
}

function timestamp(value: string | null): number {
  const parsed = value ? Date.parse(value) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function subscribeDailyReadingWordGroups(listener: StoreListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function dailyReadingWordGroupSnapshot(): DailyReadingWordGroupSnapshot {
  return snapshot;
}

export function selectedDailyReadingWordGroupId(): string | null {
  return snapshot.id;
}

export function loadDailyReadingWordGroups(force = false): Promise<WordGroup[]> {
  if (loadPromise) return loadPromise;
  if (!force && snapshot.groups.length > 0) return Promise.resolve(snapshot.groups);
  emit({ loading: true, error: null });
  loadPromise = wfNewApi.getWordGroups()
    .then((groups) => {
      const normalized = Array.isArray(groups) ? groups : [];
      emit({ groups: normalized, loading: false, error: null });
      return normalized;
    })
    .catch((error: unknown) => {
      emit({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    })
    .finally(() => {
      loadPromise = null;
    });
  return loadPromise;
}

export function roamDailyReadingWordGroup(
  id: string,
  updatedAt = snapshot.updatedAt ?? new Date().toISOString(),
): Promise<void> {
  const requestVersion = ++syncVersion;

  if (!wfNewApi.isAuthenticated()) return Promise.resolve();
  emit({ syncing: true, error: null });
  return wfNewApi.updatePreferences({
    app_settings: { [APP_SETTINGS_KEY]: { id, updatedAt } },
  }).then(() => {
    if (requestVersion === syncVersion) emit({ syncing: false, error: null });
  }).catch((error: unknown) => {
    if (requestVersion === syncVersion) {
      emit({
        syncing: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    console.warn('[WordNewDailyReading] Word-group roam push skipped:', error);
  });
}

export function selectDailyReadingWordGroup(id: string): void {
  const selection = { id, updatedAt: new Date().toISOString() };

  emit({ ...selection, error: null });
  persistSelection(selection);
  void roamDailyReadingWordGroup(id, selection.updatedAt);
}

export async function pullDailyReadingWordGroup(): Promise<string | null> {
  let preferences: Awaited<ReturnType<typeof wfNewApi.getPreferences>>;
  let remote: unknown = null;
  let remoteSelection: StoredSelection = { id: null, updatedAt: null };
  let localSelection = readStoredSelection();

  if (!wfNewApi.isAuthenticated()) return snapshot.id;
  try {
    preferences = await wfNewApi.getPreferences();
    remote = preferences?.app_settings?.[APP_SETTINGS_KEY];
    if (remote && typeof remote === 'object') {
      const record = remote as Record<string, unknown>;
      remoteSelection = {
        id: typeof record.id === 'string' && record.id.trim() ? record.id : null,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : null,
      };
    }
    localSelection = readStoredSelection();
    if (
      remoteSelection.id
      && (!localSelection.id || timestamp(remoteSelection.updatedAt) > timestamp(localSelection.updatedAt))
    ) {
      emit({ ...remoteSelection, syncing: false, error: null });
      persistSelection(remoteSelection);
      return remoteSelection.id;
    }
    if (localSelection.id) {
      if (snapshot.id !== localSelection.id || snapshot.updatedAt !== localSelection.updatedAt) {
        emit({ ...localSelection, error: null });
      }
      if (
        remoteSelection.id !== localSelection.id
        || timestamp(remoteSelection.updatedAt) < timestamp(localSelection.updatedAt)
      ) {
        await roamDailyReadingWordGroup(localSelection.id, localSelection.updatedAt ?? undefined);
      }
      return localSelection.id;
    }
    return remoteSelection.id;
  } catch (error) {
    emit({ error: error instanceof Error ? error.message : String(error), syncing: false });
    console.warn('[WordNewDailyReading] Word-group roam pull skipped:', error);
    return snapshot.id;
  }
}
