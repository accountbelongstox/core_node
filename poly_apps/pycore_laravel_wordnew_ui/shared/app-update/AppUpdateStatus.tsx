import React from 'react';
import { AlertTriangle, BadgeCheck, Download, Loader2, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { ActionButton } from '@/shared/ui/ActionButton';
import { formatBytes } from '../../core/utils/formatBytes';
import type { AppUpdater, AppUpdateSnapshot } from './AppUpdater';

export type AppUpdateTrans = (key: string, replacements?: Record<string, string | number>) => string;

const PERCENT = 100;

interface AppUpdateStatusProps {
  updater: AppUpdater;
  update: AppUpdateSnapshot;
  trans: AppUpdateTrans;
  /** `banner`: compact, with "Later"; `page`: the settings / download card with a manual check button. */
  variant: 'banner' | 'page';
}

function errorText(update: AppUpdateSnapshot, trans: AppUpdateTrans): string {
  return update.errorCode === 'unreachable' ? trans('update.error.unreachable') : trans('update.error.generic', { code: update.errorCode });
}

/** The one view of an updater state: banner on every page, card on the settings / download page. */
export const AppUpdateStatus: React.FC<AppUpdateStatusProps> = ({ updater, update, trans, variant }) => {
  const { status, candidate, installed } = update;
  const latest = candidate?.entry.version ?? '';
  const current = installed?.versionName ?? '';
  const percent = update.total > 0 ? Math.min(PERCENT, Math.floor((update.bytes / update.total) * PERCENT)) : 0;
  const page = variant === 'page';
  const showCandidate = !!candidate && (status === 'available' || status === 'checking' || status === 'error');

  let icon = <Download className="h-5 w-5 shrink-0 text-amber-500" />;
  let text = '';
  let actions: React.ReactNode = null;

  if (status === 'downloading') {
    icon = <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-500" />;
    text = trans('update.downloading', { latest, percent, size: formatBytes(update.total) });
    actions = <ActionButton variant="secondary" size="sm" onClick={() => updater.cancelDownload()}>{trans('update.cancel')}</ActionButton>;
  } else if (status === 'needsPermission') {
    icon = <ShieldCheck className="h-5 w-5 shrink-0 text-amber-500" />;
    text = trans('update.needsPermission');
    actions = <ActionButton size="sm" onClick={() => void updater.allowInstall()}>{trans('update.allow')}</ActionButton>;
  } else if (status === 'installing') {
    icon = <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-500" />;
    text = trans('update.installing');
    actions = <ActionButton variant="secondary" size="sm" onClick={() => void updater.startUpdate()}>{trans('update.retry')}</ActionButton>;
  } else if (showCandidate) {
    const failed = status === 'error';
    icon = failed ? <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" /> : icon;
    text = failed ? errorText(update, trans) : trans('update.available', { latest, current });
    actions = (
      <>
        <ActionButton size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => void updater.startUpdate()}>
          {trans(failed ? 'update.retry' : 'update.action')}
        </ActionButton>
        {!page && (
          <ActionButton variant="secondary" size="sm" onClick={() => updater.later()}>{trans('update.later')}</ActionButton>
        )}
      </>
    );
  } else if (page) {
    const failed = status === 'error';
    icon = failed ? <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500" /> : <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-500" />;
    text = status === 'checking' || status === 'idle' ? trans('update.checking') : failed ? errorText(update, trans) : trans('update.upToDate', { current });
  } else {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {icon}
        <p className="min-w-0 flex-1 text-[12px] font-bold leading-relaxed text-indigo-950 dark:text-white">{text}</p>
        <div className="flex items-center gap-2">
          {actions}
          {page && status !== 'downloading' && status !== 'installing' && status !== 'needsPermission' && (
            <ActionButton
              variant="secondary"
              size="sm"
              loading={status === 'checking'}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
              onClick={() => void updater.check(true)}
            >
              {trans('update.check')}
            </ActionButton>
          )}
          {!page && status === 'available' && (
            <button type="button" aria-label={trans('update.later')} onClick={() => updater.later()} className="rounded-full p-1 text-zinc-400 hover:text-zinc-200">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {status === 'downloading' && (
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/60 dark:bg-white/10">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 transition-all" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
};
