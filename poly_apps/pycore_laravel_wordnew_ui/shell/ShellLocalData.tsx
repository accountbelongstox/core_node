/**
 * The "Local data & cache" card: what this device stores for every app (localStorage, the device database,
 * Cache Storage), the browser quota, and a confirmed per-group clear for groups an app marked clearable.
 */
import React, { useCallback, useState } from 'react';
import { Database, Lock, RefreshCw, Trash2 } from 'lucide-react';
import { useTranslation } from '../core/i18n/UiI18n';
import { formatBytes } from '../core/utils/formatBytes';
import '../core/integrations/laravel/LaravelStorageKeys';
import '../core/integrations/pycore/PycoreStorageKeys';
import '../core/auth/AuthStorageKeys';
import '../apps/pycore-manager/persistence/PycoreManagerStorageKeys';
import '../apps/wordnew/persistence/WordNewStorageKeys';
import '../apps/laravel-manager/persistence/LaravelManagerStorageKeys';
import '../apps/vortex/VortexStorageKeys';
import '../shared/AiChatKit/aiChatHistory';
import './ShellStorageKeys';
import { useLocalDataUsage } from '../shared/persistence/useLocalDataUsage';
import type { LocalDataGroupUsage } from '../shared/persistence/LocalDataUsage';

const KEY_PREFIX = 'common.local_data.';
const PERCENT_SCALE = 100;
const MIN_BAR_PERCENT = 1;

type Notice = { ok: boolean; text: string };

export const ShellLocalData: React.FC = () => {
  const { t } = useTranslation();
  const { report, loading, clearingId, refresh, clearGroup } = useLocalDataUsage();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [cleared, setCleared] = useState(false);

  const trans = useCallback((key: string, replacements?: Record<string, string | number>) => t(`${KEY_PREFIX}${key}`, replacements), [t]);

  const confirmClear = async (group: LocalDataGroupUsage): Promise<void> => {
    const name = t(group.labelKey);
    setConfirmId(null);
    const ok = await clearGroup(group.id);
    if (ok) setCleared(true);
    setNotice({ ok, text: trans(ok ? 'cleared' : 'clearFailed', { name }) });
  };

  const quotaPercent = report?.quota ? Math.min(PERCENT_SCALE, (report.quota.usage / report.quota.quota) * PERCENT_SCALE) : 0;

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 dark:border-slate-800/80 dark:bg-slate-900/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Database className="h-4 w-4 shrink-0 text-emerald-500" />
            {trans('title')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{trans('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          title={trans('refresh')}
          aria-label={trans('refresh')}
          className="shrink-0 rounded-xl p-2 text-emerald-500 transition hover:bg-emerald-500/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {report && (
        <div className="space-y-1.5 rounded-xl bg-slate-500/5 p-3 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="font-semibold text-slate-800 dark:text-slate-100">{trans('total')}</span>
            <span>{trans('summary', { size: formatBytes(report.totalBytes), n: report.totalEntries })}</span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span>{trans('engine')}</span>
            <span className="font-medium">{trans(`backend.${report.backend}`)}</span>
          </div>
          {report.quota ? (
            <>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-500/15">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{ width: `${Math.max(MIN_BAR_PERCENT, quotaPercent)}%` }}
                />
              </div>
              <div>
                {trans('quota', {
                  used: formatBytes(report.quota.usage),
                  quota: formatBytes(report.quota.quota),
                  percent: quotaPercent.toFixed(1),
                })}
              </div>
            </>
          ) : (
            <div>{trans('quotaUnknown')}</div>
          )}
          {report.persisted !== null && <div>{trans(report.persisted ? 'persistent' : 'notPersistent')}</div>}
        </div>
      )}

      {notice && (
        <div className={`text-xs ${notice.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {notice.text}
        </div>
      )}
      {cleared && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{trans('reloadHint')}</span>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg border border-slate-300 px-2 py-1 font-medium hover:bg-slate-500/10 dark:border-slate-700"
          >
            {trans('reload')}
          </button>
        </div>
      )}

      {!report && loading && <div className="text-xs text-slate-500">{trans('measuring')}</div>}
      {report && report.groups.length === 0 && <div className="text-xs text-slate-500">{trans('empty')}</div>}

      <ul className="space-y-2">
        {report?.groups.map((group) => {
          const name = t(group.labelKey);
          const busy = clearingId === group.id;
          return (
            <li key={group.id} className="rounded-xl border border-slate-200/70 p-3 dark:border-slate-800/70">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1 basis-48">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{name}</span>
                    <span className="rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      {trans(`apps.${group.appId}`)}
                    </span>
                  </div>
                  {group.descriptionKey && (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{t(group.descriptionKey)}</p>
                  )}
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {trans('entries', { n: group.entries })} · {formatBytes(group.bytes)} · {group.stores.map((store) => trans(`stores.${store}`)).join(', ')}
                  </p>
                </div>
                <div className="shrink-0">
                  {!group.clearable ? (
                    <span title={trans('protectedHint')} className="inline-flex items-center gap-1 text-xs text-slate-400">
                      <Lock className="h-3.5 w-3.5" />
                      {trans('protected')}
                    </span>
                  ) : confirmId === group.id ? (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className="text-xs text-rose-600 dark:text-rose-400">{trans('confirmPrompt', { name })}</span>
                      <button
                        type="button"
                        onClick={() => void confirmClear(group)}
                        className="rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-600"
                      >
                        {trans('confirm')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(null)}
                        className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium hover:bg-slate-500/10 dark:border-slate-700"
                      >
                        {trans('cancel')}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy || clearingId !== null}
                      onClick={() => setConfirmId(group.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-500/10 disabled:opacity-40 dark:border-slate-700 dark:text-rose-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {trans(busy ? 'clearing' : 'clear')}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default ShellLocalData;
