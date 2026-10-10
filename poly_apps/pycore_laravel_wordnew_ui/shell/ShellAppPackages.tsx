/**
 * The app package card of the shell: in the Android app the update check of this build; on the web the
 * downloads of the entry app (pycore-manager) from this server, the Laravel endpoints and the mesh hosts.
 */
import React, { useCallback } from 'react';
import { Smartphone } from 'lucide-react';
import { useTranslation } from '../core/i18n/UiI18n';
import { AppDownloadCard } from '@/shared/app-update/AppDownloadCard';
import { AppUpdateBanner } from '@/shared/app-update/AppUpdateBanner';
import { appUpdateSupported } from '@/shared/app-update/CapAppUpdate';
import { AppUpdateStatus } from '@/shared/app-update/AppUpdateStatus';
import type { AppUpdater } from '@/shared/app-update/AppUpdater';
import { useAppUpdate } from '@/shared/app-update/useAppUpdate';
import { isNativeAppShell } from '../core/network/NativeShell';
import { SHELL_DOWNLOAD_APP, shellAppUpdater, shellDownloadOrigins } from './ShellAppUpdate';

const KEY_PREFIX = 'common.app_packages.';

function useShellPackagesTrans(): (key: string, replacements?: Record<string, string | number>) => string {
  const { t } = useTranslation();
  return useCallback((key, replacements) => t(`${KEY_PREFIX}${key}`, replacements), [t]);
}

const UpdateCard: React.FC<{ updater: AppUpdater }> = ({ updater }) => {
  const trans = useShellPackagesTrans();
  const update = useAppUpdate(updater);
  return <AppUpdateStatus updater={updater} update={update} trans={trans} variant="page" />;
};

export const ShellAppPackages: React.FC = () => {
  const trans = useShellPackagesTrans();
  const updatable = !!shellAppUpdater && appUpdateSupported();
  if (isNativeAppShell() && !updatable) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800/80 dark:bg-slate-900/50">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
        <Smartphone className="h-4 w-4 text-indigo-500" />
        {trans(updatable ? 'update.title' : 'download.title')}
      </h2>
      {updatable && shellAppUpdater
        ? <UpdateCard updater={shellAppUpdater} />
        : <AppDownloadCard app={SHELL_DOWNLOAD_APP} origins={shellDownloadOrigins} trans={trans} />}
    </section>
  );
};

export const ShellAppUpdateBanner: React.FC = () => {
  const trans = useShellPackagesTrans();
  return shellAppUpdater ? <AppUpdateBanner updater={shellAppUpdater} trans={trans} /> : null;
};

export default ShellAppPackages;
