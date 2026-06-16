/**
 * Task Center — OVERVIEW tab: "Cover Generation & AI" management card.
 *
 * The management surface for the `appqyv1_cover_generation` timer task
 * (the Scheduler tab row itself needs no extra controls): cover-queue
 * per-status chips (leased = covers handed to a third-party assist worker),
 * the Laravel AI (gemini) configuration + live probe, the pycore image
 * backend (reachability + per-provider chips) and a collapsed recent-failure
 * list, plus the failed→retry reset action behind a shared ConfirmModal.
 *
 * Loads once on mount + manual refresh only (NO polling) — the snapshot is
 * config/diagnostic-shaped (it probes AI keys server-side), not cheap
 * high-churn queue rows like the rest of the Task Center.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Language } from '../../../types';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import { api } from '../../../core/api';
import type { CoverStatusData, CoverQueueStats } from '../../../core/api/modules/AppQyV1';
import { useToast, ConfirmModal } from '../../admin';
import { logInfo, logError } from '../../../core/logstore/logStore';
import {
  Image as ImageIcon,
  Bot,
  Server,
  RefreshCw,
  RotateCcw,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { formatDateTime } from './shared';

/** Cover-queue statuses rendered as count chips (order matters). */
const QUEUE_CHIP_ORDER: Array<Exclude<keyof CoverQueueStats, 'total'>> = [
  'pending',
  'retry',
  'processing',
  'ready',
  'failed',
  'leased',
];

/** pending=blue, retry=orange, processing=amber, ready=green, failed=red;
 *  leased = info color, highlighted with a border (third-party assist lease). */
const QUEUE_CHIP_CLASS: Record<(typeof QUEUE_CHIP_ORDER)[number], string> = {
  pending: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  retry: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  processing: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
  ready: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  failed: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  leased:
    'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-700',
};

const PILL = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium';
const PILL_OK = 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
const PILL_BAD = 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
const PILL_MUTED = 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400';

const MAX_FAILURES = 5;

interface CoverStatusCardProps {
  lang: Language;
}

const CoverStatusCard: React.FC<CoverStatusCardProps> = ({ lang }) => {
  const tc = TRANSLATIONS[lang].taskCenter.covers;
  const toast = useToast();

  const [status, setStatus] = useState<CoverStatusData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failuresOpen, setFailuresOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.appQyV1.getCoverStatus();
      if (response.success && response.data) {
        setStatus(response.data);
        setError(null);
      } else {
        setError(response.error || tc.load_failed);
        logError('covers', `Cover status load failed: ${response.error || 'unknown error'}`);
      }
    } catch (err: any) {
      setError(err?.message || tc.load_failed);
      logError('covers', `Cover status load failed: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-load once on tab mount; afterwards manual refresh only (no polling).
  useEffect(() => {
    load();
  }, [load]);

  const doRetry = async () => {
    setRetrying(true);
    try {
      const response = await api.appQyV1.retryCovers();
      if (response.success && response.data) {
        const reset = response.data.reset ?? 0;
        toast.success(tc.retry_success.replace('{count}', String(reset)));
        logInfo('covers', `Retry requested: ${reset} failed cover(s) reset to retry`);
        setConfirmOpen(false);
        await load();
      } else {
        toast.error(response.error || tc.retry_error);
        logError('covers', `Cover retry failed: ${response.error || 'unknown error'}`);
      }
    } catch (err: any) {
      toast.error(err?.message || tc.retry_error);
      logError('covers', `Cover retry failed: ${err?.message || err}`);
    } finally {
      setRetrying(false);
    }
  };

  const failures = status?.recent_failures ?? [];
  const failedCount = status?.queue.failed ?? 0;

  return (
    <div className={`${commonClasses.card} overflow-hidden`}>
      {/* ===== Card header: title + timer-task config chips + actions ===== */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <ImageIcon className="w-4 h-4 text-pink-500" />
        <span className="font-bold text-sm">{tc.title}</span>
        {status && (
          <span className={`${PILL} ${status.task.enabled ? PILL_OK : PILL_MUTED}`}>
            {status.task.enabled ? tc.task.enabled : tc.task.disabled}
            <span className="font-mono">
              · {tc.task.batch} {status.task.batch_size} · {tc.task.retry_delay}{' '}
              {status.task.retry_delay_minutes}m
            </span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setConfirmOpen(true)}
            disabled={loading || retrying || failedCount === 0}
            className={`${commonClasses.buttonPrimary} text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {tc.retry_failed}
            {failedCount > 0 && <span className="font-mono font-bold">({failedCount})</span>}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className={`${commonClasses.buttonSecondary} text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50`}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            {tc.refresh}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="text-xs text-slate-500 dark:text-slate-400">{tc.subtitle}</div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={load} className="underline">
              {tc.refresh}
            </button>
          </div>
        )}

        {!status && !error && (
          <div className="flex items-center justify-center py-6 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        {status && (
          <>
            {/* ===== Queue chips ===== */}
            <div className="flex flex-wrap items-center gap-1.5">
              {QUEUE_CHIP_ORDER.map((key) => (
                <span
                  key={key}
                  className={`${PILL} ${QUEUE_CHIP_CLASS[key]}`}
                  title={key === 'leased' ? tc.leased_hint : undefined}
                >
                  {tc.queue[key]}
                  <span className="font-mono font-bold">{status.queue[key] ?? 0}</span>
                </span>
              ))}
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
                {tc.queue_total} <span className="font-mono font-bold">{status.queue.total}</span>
              </span>
            </div>

            {/* ===== Laravel AI row ===== */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-20 shrink-0 flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                <Bot className="w-3.5 h-3.5 text-purple-500" />
                {tc.laravel_ai}
              </span>
              <span className={`${PILL} ${status.laravel_ai.configured ? PILL_OK : PILL_BAD}`}>
                {status.laravel_ai.provider} ·{' '}
                {status.laravel_ai.configured ? tc.configured : tc.not_configured}
              </span>
              {status.laravel_ai.key_masked && (
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  {status.laravel_ai.key_masked}
                </span>
              )}
              {status.laravel_ai.probe ? (
                status.laravel_ai.probe.available ? (
                  <span className={`${PILL} ${PILL_OK}`}>
                    {tc.probe_available}
                    {status.laravel_ai.probe.latency_ms != null && (
                      <span className="font-mono">{status.laravel_ai.probe.latency_ms}ms</span>
                    )}
                  </span>
                ) : (
                  <span
                    className={`${PILL} ${PILL_BAD} max-w-[260px]`}
                    title={status.laravel_ai.probe.error || undefined}
                  >
                    {tc.probe_failed}
                    {status.laravel_ai.probe.error && (
                      <span className="truncate">: {status.laravel_ai.probe.error}</span>
                    )}
                  </span>
                )
              ) : (
                <span className={`${PILL} ${PILL_MUTED}`}>{tc.not_probed}</span>
              )}
            </div>

            {/* ===== pycore row ===== */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-20 shrink-0 flex items-center gap-1.5 font-medium text-slate-500 dark:text-slate-400">
                <Server className="w-3.5 h-3.5 text-blue-500" />
                {tc.pycore}
              </span>
              <span className={`${PILL} ${status.pycore.reachable ? PILL_OK : PILL_BAD}`}>
                {status.pycore.reachable ? tc.reachable : tc.unreachable}
              </span>
              {status.pycore.base_url && (
                <span className="font-mono text-slate-500 dark:text-slate-400">
                  {status.pycore.base_url}
                </span>
              )}
              <span className={`${PILL} ${status.pycore.image_capable ? PILL_OK : PILL_MUTED}`}>
                <ImageIcon className="w-3 h-3" />
                {status.pycore.image_capable ? tc.image_capable : tc.not_image_capable}
              </span>
              {status.pycore.providers && status.pycore.providers.length > 0
                ? status.pycore.providers.map((provider) => (
                    <span
                      key={provider.name}
                      className={`${PILL} ${PILL_MUTED}`}
                      title={`${provider.name}: ${provider.configured ? tc.configured : tc.not_configured}${provider.image ? ` · ${tc.provider_image_mark}` : ''}`}
                    >
                      {/* dot: green=available, amber=configured-but-unavailable, gray=unconfigured */}
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full ${
                          provider.available
                            ? 'bg-green-500'
                            : provider.configured
                              ? 'bg-amber-500'
                              : 'bg-slate-400'
                        }`}
                      />
                      {provider.name}
                      {provider.image && <ImageIcon className="w-3 h-3 text-pink-500" />}
                    </span>
                  ))
                : status.pycore.reachable && (
                    <span className="text-slate-400 dark:text-slate-500">{tc.no_providers}</span>
                  )}
              {status.pycore.error && (
                <span
                  className="text-red-600 dark:text-red-400 truncate max-w-[300px]"
                  title={status.pycore.error}
                >
                  {status.pycore.error}
                </span>
              )}
            </div>

            {/* ===== Recent failures (collapsed by default) ===== */}
            <div>
              <button
                onClick={() => setFailuresOpen((open) => !open)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 transition"
              >
                {failuresOpen ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
                {tc.recent_failures}
                <span
                  className={`${PILL} ${failures.length > 0 ? PILL_BAD : PILL_MUTED} font-mono`}
                >
                  {failures.length}
                </span>
              </button>
              {failuresOpen && (
                <div className="mt-2 space-y-1.5 pl-5">
                  {failures.length === 0 ? (
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {tc.no_failures}
                    </div>
                  ) : (
                    failures.slice(0, MAX_FAILURES).map((failure, index) => (
                      <div
                        key={`${failure.library_id}-${index}`}
                        className="flex items-start gap-2 text-xs"
                      >
                        <span className="font-medium shrink-0">
                          {failure.name}{' '}
                          <span className="text-slate-400 font-mono">#{failure.library_id}</span>
                        </span>
                        <span
                          className="text-red-600 dark:text-red-400 truncate flex-1"
                          title={failure.error}
                        >
                          {failure.error}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500 shrink-0">
                          {formatDateTime(failure.at)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== Retry-failed confirm (shared admin ConfirmModal) ===== */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doRetry}
        title={tc.confirm_title}
        message={tc.confirm_message.replace('{count}', String(failedCount))}
        confirmText={tc.confirm}
        cancelText={tc.cancel}
        variant="warning"
        loading={retrying}
      />
    </div>
  );
};

export default CoverStatusCard;
