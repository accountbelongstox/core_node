import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import { requestPycoreHttp, connectPycoreHttp } from '@/apps/pycore-manager/api';
import { pycoreEventBus } from '@/apps/pycore-manager/api';
import { PYCORE_EVENT_TOPICS } from '@/apps/pycore-manager/api';
import { PYCORE_HTTP_ROUTES } from '@/apps/pycore-manager/api';

const PIPELINE_SCOPES = new Set(['agent_history', 'agent_history_pipeline']);

/** Live pipeline log panel; hydrates from ui/operation/snapshot and follows operation.changed. */
const PcAgentHistoryLogPanel: React.FC<{ tk: (k: string) => string }> = ({ tk }) => {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await requestPycoreHttp(PYCORE_HTTP_ROUTES.operationSnapshot, {
        scope: 'agent_history',
        include_items: false,
      });
      if (!mounted.current) return;
      if (res?.success && res.data) {
        setData(res.data as Record<string, any>);
        setLoadError(null);
        setStale(false);
      } else {
        setLoadError(res?.error || 'Failed to load agent history logs.');
        setStale(true);
      }
    } catch (e) {
      if (!mounted.current) return;
      // Keep prior data; mark stale instead of wiping the panel.
      setLoadError(e instanceof Error ? e.message : 'Failed to load agent history logs.');
      setStale(true);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    connectPycoreHttp();
    void load();
    const off = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.operationChanged, (payload: any) => {
      const scope = String(payload?.operation_scope || '');
      if (scope && !PIPELINE_SCOPES.has(scope)) return;
      void load();
    });
    return () => {
      mounted.current = false;
      off();
    };
  }, [load]);

  const events: any[] = Array.isArray((data as any)?.recent_events) ? (data as any).recent_events : [];
  const progress = (data as any)?.operation || {};

  const phaseColor: Record<string, string> = {
    running: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    completed: 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300',
    cancel_requested: 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300',
    failed: 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-300',
    idle: 'border-slate-300 dark:border-white/10 text-slate-500',
  };
  const levelDot: Record<string, string> = {
    info: 'bg-slate-400',
    success: 'bg-emerald-500',
    warn: 'bg-amber-500',
    error: 'bg-rose-500',
  };

  const errRaw = progress.error;
  const errText = errRaw
    ? (typeof errRaw === 'string' ? errRaw : JSON.stringify(errRaw))
    : '';

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-indigo-500" />
          {tk('logTitle')}
          {stale && (
            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-600 dark:text-amber-300">
              {tk('dataStale')}
            </span>
          )}
        </h2>
        {loading && <span className="text-[11px] text-slate-400">…</span>}
        {loadError && !loading && (
          <span className="text-[11px] text-amber-500 max-w-[50%] truncate" title={loadError}>
            {loadError}
          </span>
        )}
      </div>

      {/* Progress row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500">
        <span className={`px-2 py-0.5 rounded border ${phaseColor[String(progress.status || 'idle')] || phaseColor.idle}`}>
          {tk('phase')}: {String(progress.status || 'idle')}
        </span>
        <span>{tk('pending')}: {Number(progress.totals?.queued ?? 0)}</span>
        <span>{tk('published')}: {Number(progress.totals?.succeeded ?? 0)}</span>
        {progress.timestamps?.updated_at && <span>{tk('lastRun')}: {String(progress.timestamps.updated_at).slice(11, 19)}</span>}
        {errText && (
          <span className="text-rose-500">
            {tk('lastError')}: {errText}
          </span>
        )}
      </div>

      {/* Event log (newest first) */}
      <ul className="space-y-1 max-h-[280px] overflow-y-auto pr-1 font-mono text-[11px]">
        {events.length === 0 ? (
          <li className="text-slate-400">{tk('logEmpty')}</li>
        ) : events.map((ev, i) => {
          const ts = new Date(ev.created_at).toTimeString().slice(0, 8);
          return (
            <li key={`${ev.seq ?? i}-${ts}`} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
              <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${levelDot[String(ev.level || 'info')] || levelDot.info}`} />
              <span className="text-slate-400 shrink-0">{ts}</span>
              <span className="break-all">{String(ev.message || '')}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PcAgentHistoryLogPanel;
