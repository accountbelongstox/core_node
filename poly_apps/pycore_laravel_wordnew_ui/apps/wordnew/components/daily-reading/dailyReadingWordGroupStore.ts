/** Daily-reading word-group selection store — the SINGLE owner of the
 * player's target word group. Local persistence goes through StorageManager
 * (which also emits the change event the player rebuilds its sequence on);
 * account roaming rides the app_settings preferences blob (deep-merged
 * server-side, so other client keys are never touched). */
import { wfNewApi } from '../../api';
import { StorageManager } from '../../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';

const APP_SETTINGS_KEY = 'dailyReadingWordGroup';

/** Selected word group for the daily-reading player (manual switch persists;
 * null means the backend Default Vocabulary Group). */
export function selectedDailyReadingWordGroupId(): string | null {
  try {
    return StorageManager.get<string | null>(StorageKeys.WORDNEW_DAILY_READING_WORD_GROUP, null);
  } catch {
    return null;
  }
}

/** Best-effort roam push of one selection into the account preferences. */
export function roamDailyReadingWordGroup(id: string): void {
  if (!wfNewApi.isAuthenticated()) return;
  void wfNewApi.updatePreferences({
    app_settings: { [APP_SETTINGS_KEY]: { id, updatedAt: new Date().toISOString() } },
  }).catch((error: unknown) => {
    console.warn('[WordNewDailyReading] Word-group roam push skipped:', error);
  });
}

/** Persist a selection locally (emits the storage-changed event the player
 * listens to) and roam it to the account. */
export function selectDailyReadingWordGroup(id: string): void {
  StorageManager.set(StorageKeys.WORDNEW_DAILY_READING_WORD_GROUP, id);
  roamDailyReadingWordGroup(id);
}

/** Restore the roamed selection. Returns the applied remote id; null when the
 * remote is absent (the local selection is then pushed up once) or on error. */
export async function pullDailyReadingWordGroup(): Promise<string | null> {
  if (!wfNewApi.isAuthenticated()) return null;
  try {
    const preferences = await wfNewApi.getPreferences();
    const remote = preferences?.app_settings?.[APP_SETTINGS_KEY];
    const remoteId = typeof remote?.id === 'string' ? remote.id : null;
    const localId = selectedDailyReadingWordGroupId();
    if (remoteId && remoteId !== localId) {
      StorageManager.set(StorageKeys.WORDNEW_DAILY_READING_WORD_GROUP, remoteId);
      return remoteId;
    }
    if (!remoteId && localId) roamDailyReadingWordGroup(localId);
    return null;
  } catch (error) {
    console.warn('[WordNewDailyReading] Word-group roam pull skipped:', error);
    return null;
  }
}
