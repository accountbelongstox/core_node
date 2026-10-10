import React from 'react';
import { AppUpdateBanner } from '@/shared/app-update/AppUpdateBanner';
import type { AppUpdateTrans } from '@/shared/app-update/AppUpdateStatus';
import { wordNewAppUpdater } from '../../services/update/WordNewAppUpdater';

/** Non-blocking update notice (Android app only): shown while a newer build is offered or being installed. */
export const WordNewUpdateBanner: React.FC<{ trans: AppUpdateTrans }> = ({ trans }) => (
  <AppUpdateBanner updater={wordNewAppUpdater} trans={trans} />
);

export default WordNewUpdateBanner;
