/**
 * PcLaravelLogsPage — mirrored Laravel application logs from pycore's
 * LaravelLogMirrorService (ui.laravel.logs_snapshot / logs_refresh).
 *
 * Initial open hydrates via snapshot; laravel.logs.snapshot.updated / legacy
 * laravel.logs.changed trigger a lightweight re-pull. Shows stale/error inline.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollText, RefreshCw, AlertTriangle } from 'lucide-react';
import { callRpc, connectPycoreWs } from '../../../core/api-libs/pycore/PycoreWs';
import { pycoreEventBus } from '../../../core/api-libs/pycore/PycoreEventBus';

type LogEntry = {
  trace_id?: string;
  level?: string;
  message?: string;
  context?: unknown;
  created_at?: string;
  timestamp?: string;
  [key: string]: unknown;
};

type SnapshotData = {
  source_id?: string;
  entries?: LogEntry[];
  stale?: boolean;
  revision?: number;
  timestamps?: Record<string, number>;
  error?: { error?: string; type?: string; body?: string } | null;
  source_updated_at?: string;
};

const LEVEL_CLS: Record<string, string> = {
  debug: 'text-slate-400',
  info: 'text-sky-600 dark:text-sky-300',
  notice: 'text-sky-600 dark:text-sky-300',
  warning: 'text-amber-600 dark:text-amber-300',
  warn: 'text-amber-600 dark:text-amber-300',
  error: 'text-rose-600 dark:text-rose-300',
  critical: 'text-rose-700 dark:text-rose-200',
  alert: 'text-rose-700 dark:text-rose-200',
  emergency: 'text-rose-700 dark:text-rose-200',
};

function formatContext(ctx: unknown): string {
  if (ctx == null) return '';
  if (typeof ctx === 'string') return ctx;
  try {
    return JSON.stringify(ctx);
  } catch {
    return String(ctx);
  }
}

const PcLaravelLogsPage: React.FC = () => {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSnapshot = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await callRpc('ui.laravel.logs_snapshot', {});
      if (!mounted.current) return;
      if (res?.success && res.data) {
        setData(res.data as SnapshotData);
        setError(null);
      } else {
        setError(res?.error || 'Failed to load Laravel logs');
      }
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Failed to load Laravel logs');
      }
    } finally {
      if (mounted.current && !silent) setLoading(false);
    }
  }, []);

  const requestRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await callRpc('ui.laravel.logs_refresh', {});
      // Backend polls async; re-pull shortly so the UI catches new entries.
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        void loadSnapshot(true);
        setRefreshing(false);
      }, 800);
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : 'Refresh failed');
        setRefreshing(false);
      }
    }
  }, [loadSnapshot]);

  useEffect(() => {
    mounted.current = true;
    connectPycoreWs();
    void loadSnapshot(false);
    const onLogsChanged = () => {
      void loadSnapshot(true);
    };
    const offLegacy = pycoreEventBus.subscribe('laravel.logs.changed', onLogsChanged);
    const offDurable = pycoreEventBus.subscribe('laravel.logs.snapshot.updated', onLogsChanged);
    return () => {
      mounted.current = false;
      offLegacy();
      offDurable();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [loadSnapshot]);

  const entries = Array.isArray(data?.entries) ? data!.entries! : [];
  const stale = !!data?.stale;
  const snapError = data?.error?.error || null;

  return (
    <div className="h-full flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-indigo-500" />
            Laravel Logs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Mirrored application logs from the active Laravel endpoint.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void requestRefresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-500">
        {data?.source_id && <span className="truncate max-w-[40%]">{data.source_id}</span>}
        <span>rev {Number(data?.revision ?? 0)}</span>
        <span>{entries.length} entries</span>
        {stale && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-600 dark:text-amber-300">
            <AlertTriangle className="w-3 h-3" />
            stale
          </span>
        )}
        {(error || snapError) && (
          <span className="text-rose-500 truncate max-w-[40%]" title={error || snapError || ''}>
            {error || snapError}
          </span>
        )}
      </div>

      <section className="flex-1 min-h-0 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] overflow-hidden">
        {loading && entries.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-slate-500 py-8 text-center">No log entries yet. Click Refresh to poll Laravel.</div>
        ) : (
          <ul className="h-full overflow-y-auto divide-y divide-slate-200/60 dark:divide-white/5 font-mono text-[11px]">
            {[...entries].reverse().map((ev, i) => {
              const level = String(ev.level || 'info').toLowerCase();
              const ts = String(ev.created_at || ev.timestamp || '');
              const ctx = formatContext(ev.context);
              return (
                <li key={`${ev.trace_id || i}-${ts}-${i}`} className="px-4 py-2 space-y-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {ts && <span className="text-slate-400 shrink-0">{ts}</span>}
                    <span className={`uppercase font-semibold ${LEVEL_CLS[level] || LEVEL_CLS.info}`}>{level}</span>
                    {ev.trace_id && (
                      <span className="text-slate-400 truncate" title={String(ev.trace_id)}>
                        trace:{String(ev.trace_id)}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-700 dark:text-slate-200 break-all whitespace-pre-wrap">
                    {String(ev.message || '')}
                  </div>
                  {ctx && (
                    <div className="text-slate-400 break-all whitespace-pre-wrap opacity-80">{ctx}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default PcLaravelLogsPage;
