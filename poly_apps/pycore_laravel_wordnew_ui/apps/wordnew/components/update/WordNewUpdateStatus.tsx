import React from 'react';
import { AppUpdateStatus, type AppUpdateTrans } from '@/shared/app-update/AppUpdateStatus';
import { wordNewAppUpdater, type WordNewUpdateSnapshot } from '../../services/update/WordNewAppUpdater';

interface WordNewUpdateStatusProps {
  update: WordNewUpdateSnapshot;
  trans: AppUpdateTrans;
  /** `banner`: compact, with "Later"; `page`: the download page card with a manual check button. */
  variant: 'banner' | 'page';
}

export const WordNewUpdateStatus: React.FC<WordNewUpdateStatusProps> = (props) => (
  <AppUpdateStatus updater={wordNewAppUpdater} {...props} />
);
