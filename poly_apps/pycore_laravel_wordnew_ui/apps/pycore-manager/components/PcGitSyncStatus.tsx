/**
 * Top-bar status of pycore's automatic gitsync on the machine selected in the terminal node tabs:
 * run count, a merge-conflict alert (with the AI prompt to copy), pause until restart, sync interval,
 * reminder interval, run now, the latest runs.
 */
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Check, ChevronDown, Copy, GitMerge, Loader2, Pause, Play, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pycoreNodeClient } from '@/apps/pycore-manager/api';
import type { GitSyncHistoryPage, GitSyncState, PycoreGitSyncApi } from '@/apps/pycore-manager/api';
import {
  readPcUiSessionTerminalNodeUrl,
  subscribePcUiSessionTerminalNodeUrl,
} from '../persistence/PcUiSessionStore';
import { copyTextToSystemClipboard } from '../../../core/browser/SystemClipboard';
import { formatTimestamp } from '../../../core/utils/formatters';
import { useIsMobile } from '../hooks/useIsMobile';

const POLL_INTERVAL_MS = 15_000;
const MS_PER_SECOND = 1000;
const HISTORY_LIMIT = 10;
const BADGE_MAX_COUNT = 99;

/** The gitsync API of the machine selected in the terminal node tabs (null URL = this machine). */
function useSelectedGitSyncNode(): { key: string; api: PycoreGitSyncApi } {
  const nodeUrl = useSyncExternalStore(subscribePcUiSessionTerminalNodeUrl, readPcUiSessionTerminalNodeUrl);
  return { key: nodeUrl ?? 'primary', api: pycoreNodeClient(nodeUrl).gitSync };
}

/** The latest runs, loaded only while expanded; reloads when a new run is counted. */
const PcGitSyncHistory: React.FC<{ api: PycoreGitSyncApi; runCount: number }> = ({ api, runCount }) => {
  const { t } = useTranslation('pc');
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState<GitSyncHistoryPage | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!expanded) return undefined;
    let alive = true;
    setLoading(true);
    api.getGitSyncHistory(0, HISTORY_LIMIT)
      .then((result) => { if (alive && result?.success) setPage(result); })
      .catch(() => undefined)
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [api, expanded, runCount]);

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        className="inline-flex items-center gap-1 font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} />
        {t(expanded ? 'gitsyncWatch.historyHide' : 'gitsyncWatch.historyShow')}
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      </button>
      {expanded && page && (
        page.runs.length === 0
          ? <p className="text-slate-400">{t('gitsyncWatch.historyEmpty')}</p>
          : (
            <>
              <ul className="divide-y divide-slate-500/10 rounded-lg border border-slate-500/15">
                {page.runs.slice(0, HISTORY_LIMIT).map((run) => (
                  <li key={run.started_at} className="flex items-center gap-2 px-2 py-1 font-mono text-[10px]">
                    <span className="min-w-0 flex-1 truncate text-slate-500">{formatTimestamp(run.started_at * MS_PER_SECOND)}</span>
                    <span className="text-slate-400">{t(`gitsyncWatch.trigger.${run.trigger}`)}</span>
                    <span className="text-slate-400">{t('gitsyncWatch.historyDuration', { seconds: run.duration_seconds })}</span>
                    <span className={run.result === 'conflict' || (run.exit_code ?? 0) !== 0 ? 'text-rose-500' : 'text-emerald-500'}>
                      {run.result === 'ok' && run.exit_code !== null && run.exit_code !== 0
                        ? t('gitsyncWatch.historyExitCode', { code: run.exit_code })
                        : t(`gitsyncWatch.result.${run.result}`)}
                    </span>
                  </li>
                ))}
              </ul>
              {page.total > page.recorded && (
                <p className="text-[10px] text-slate-400">{t('gitsyncWatch.historyKept', { count: page.recorded })}</p>
              )}
            </>
          )
      )}
    </div>
  );
};

export const PcGitSyncStatus: React.FC = () => {
  const node = useSelectedGitSyncNode();
  return <PcGitSyncNodeStatus key={node.key} api={node.api} />;
};

const PcGitSyncNodeStatus: React.FC<{ api: PycoreGitSyncApi }> = ({ api }) => {
  const { t } = useTranslation('pc');
  const isMobile = useIsMobile();
  const [state, setState] = useState<GitSyncState | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [intervalText, setIntervalText] = useState('');
  const [reminderText, setReminderText] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    try {
      const result = await api.getGitSyncState();
      if (result?.success) setState(result);
    } catch {
      // An older pycore without the route keeps the indicator hidden.
    }
  }, [api]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!open || !state) return;
    setIntervalText(String(state.interval_minutes));
    setReminderText(String(state.reminder_seconds));
    // Fill the inputs when the popover opens only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const control = async (change: Parameters<PycoreGitSyncApi['controlGitSync']>[0]) => {
    setBusy(true);
    try {
      const result = await api.controlGitSync(change);
      if (result?.success) setState(result);
    } finally {
      setBusy(false);
    }
  };

  const copyPrompt = async () => {
    if (state && await copyTextToSystemClipboard(state.ai_prompt)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!state) return null;

  const conflict = state.conflict;
  const runCount = state.run_count ?? 0;
  const buttonLabel = `${t(conflict ? 'gitsyncWatch.conflictTitle' : 'gitsyncWatch.title')} · ${t('gitsyncWatch.runCountShort', { count: runCount })}`;
  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title={buttonLabel}
        aria-label={buttonLabel}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
          conflict
            ? 'animate-pulse border-rose-500/50 bg-rose-500/15 text-rose-500'
            : state.paused
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-500'
              : 'border-slate-200/60 bg-slate-100/40 text-emerald-500 hover:bg-slate-200/50 dark:border-white/5 dark:bg-white/[0.02]'
        }`}
      >
        {state.running ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />}
        {runCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[1.1rem] rounded-full bg-indigo-600 px-1 text-center text-[9px] font-bold leading-[1.1rem] text-white">
            {runCount > BADGE_MAX_COUNT ? `${BADGE_MAX_COUNT}+` : runCount}
          </span>
        )}
      </button>
      {open && (
        <div className={`${isMobile ? 'fixed inset-x-2 top-14' : 'absolute right-0 top-full mt-2 w-80'} z-50 max-h-[80vh] space-y-2.5 overflow-y-auto rounded-xl border border-slate-200/80 bg-white p-3 text-[11px] shadow-xl dark:border-white/10 dark:bg-slate-900`}>
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-bold text-slate-600 dark:text-slate-300">{t('gitsyncWatch.title')}</p>
            <span className="whitespace-nowrap font-mono text-[10px] text-indigo-500">{t('gitsyncWatch.runCount', { count: runCount })}</span>
          </div>
          {conflict && (
            <div className="space-y-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
              <p className="font-semibold">{t('gitsyncWatch.conflictTitle')}</p>
              <p>{t('gitsyncWatch.conflictHint', { path: state.conflict_doc })}</p>
              {state.conflict_files.length > 0 && (
                <ul className="max-h-24 overflow-y-auto font-mono text-[10px]">
                  {state.conflict_files.map((file) => <li key={file} className="truncate">{file}</li>)}
                </ul>
              )}
              <button
                type="button"
                onClick={() => void copyPrompt()}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-rose-600 px-2 py-1.5 font-bold text-white hover:bg-rose-500"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {t('gitsyncWatch.copyPrompt')}
              </button>
            </div>
          )}
          <p className="text-slate-500">
            {state.paused ? t('gitsyncWatch.paused') : t('gitsyncWatch.active', { minutes: state.interval_minutes })}
            {state.last_run_at
              ? ` · ${t('gitsyncWatch.lastRun', { time: formatTimestamp(state.last_run_at * MS_PER_SECOND) })}`
              : ''}
          </p>
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5">
            <label htmlFor="gitsync-interval" className="text-slate-500">{t('gitsyncWatch.interval')}</label>
            <input
              id="gitsync-interval"
              type="number"
              min={1}
              value={intervalText}
              onChange={(event) => setIntervalText(event.target.value)}
              onBlur={() => void control({ interval_minutes: Number(intervalText) })}
              className="w-20 rounded-lg border border-slate-500/25 bg-white/60 px-2 py-1 text-right dark:bg-slate-950/40"
            />
            <label htmlFor="gitsync-reminder" className="text-slate-500">{t('gitsyncWatch.reminder')}</label>
            <input
              id="gitsync-reminder"
              type="number"
              min={5}
              value={reminderText}
              onChange={(event) => setReminderText(event.target.value)}
              onBlur={() => void control({ reminder_seconds: Number(reminderText) })}
              className="w-20 rounded-lg border border-slate-500/25 bg-white/60 px-2 py-1 text-right dark:bg-slate-950/40"
            />
          </div>
          <div className="flex gap-1.5 [&_button]:whitespace-nowrap">
            <button
              type="button"
              onClick={() => void control({ paused: !state.paused })}
              disabled={busy}
              title={t('gitsyncWatch.pauseHint')}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-slate-500/10 px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-500/20 disabled:opacity-50 dark:text-slate-300"
            >
              {state.paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
              {t(state.paused ? 'gitsyncWatch.resume' : 'gitsyncWatch.pause')}
            </button>
            <button
              type="button"
              onClick={() => void control({ run_now: true })}
              disabled={busy || state.running || conflict}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-500/10 px-2 py-1.5 font-semibold text-indigo-500 hover:bg-indigo-500/20 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {t('gitsyncWatch.runNow')}
            </button>
          </div>
          <PcGitSyncHistory api={api} runCount={runCount} />
        </div>
      )}
    </div>
  );
};

/** Full-width alert under the top bar while a gitsync merge conflict is unresolved. */
export const PcGitSyncConflictBanner: React.FC = () => {
  const node = useSelectedGitSyncNode();
  return <PcGitSyncNodeConflictBanner key={node.key} api={node.api} />;
};

const PcGitSyncNodeConflictBanner: React.FC<{ api: PycoreGitSyncApi }> = ({ api }) => {
  const { t } = useTranslation('pc');
  const [state, setState] = useState<GitSyncState | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = () => {
      api.getGitSyncState()
        .then((result) => { if (alive && result?.success) setState(result); })
        .catch(() => undefined);
    };
    poll();
    const timer = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [api]);

  if (!state?.conflict) return null;
  return (
    <div role="alert" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11px] text-rose-600 sm:px-6 dark:text-rose-400">
      <GitMerge className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 flex-1">{t('gitsyncWatch.banner', { count: state.conflict_files.length })}</span>
      <button
        type="button"
        onClick={() => {
          void copyTextToSystemClipboard(state.ai_prompt).then((ok) => {
            if (!ok) return;
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          });
        }}
        className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-rose-600 px-2 py-1 font-bold text-white hover:bg-rose-500"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {t('gitsyncWatch.copyPrompt')}
      </button>
    </div>
  );
};
