/**
 * WordNew's in-app APK update: the shared AppUpdater (shared/app-update) with WordNew's update origins, its
 * lifecycle resume hook and the work-node roster that names the mesh hosts.
 */
import { AppUpdater, pickUpdateCandidate, type AppUpdateCandidate, type AppUpdateSnapshot, type AppUpdateStatus } from '@/shared/app-update/AppUpdater';
import { capApp } from '../../platform/capabilities';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';
import { WORDNEW_DOWNLOAD_APP } from '../download/WordNewDownloads';
import { wordNewPycoreNodes } from '../WordNewPycoreNodes';
import { updateSourceGroups } from './WordNewUpdateSources';

export type WordNewUpdateStatus = AppUpdateStatus;
export type WordNewUpdateCandidate = AppUpdateCandidate;
export type WordNewUpdateSnapshot = AppUpdateSnapshot;
export { pickUpdateCandidate };

export const wordNewAppUpdater = new AppUpdater({
  app: WORDNEW_DOWNLOAD_APP,
  sourceGroups: updateSourceGroups,
  dismissedKey: StorageKeys.WORDNEW_APP_UPDATE_DISMISSED_CODE,
  checkedAtKey: StorageKeys.WORDNEW_APP_UPDATE_CHECKED_AT,
  onResume: (listener) => { capApp.onResume(listener); },
  beforeCheck: () => wordNewPycoreNodes.start(),
});
