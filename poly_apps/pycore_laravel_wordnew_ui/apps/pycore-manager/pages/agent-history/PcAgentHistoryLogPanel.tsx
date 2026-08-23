import React, { useState } from 'react';
import { Radio, ChevronDown, ChevronRight } from 'lucide-react';
import { useAgentHistoryRuntime } from '@/apps/pycore-manager/api';

/** Live pipeline log panel backed by the shared Agent History runtime store.
 *
 * Every event row is clickable: the full message is always rendered (never
 * truncated), and the click expands the event's complete payload - for
 * failures that means the error object and its FULL traceback, exactly as
 * recorded server-side. Nothing is clipped or summarized away.
 */
const PcAgentHistoryLogPanel: React.FC<{ tk: (k: string) => string; className?: string }> = ({ tk, className = '' }) => {
  const {
    operationSnapshot: data,
    operationLoading: loading,
    operationError: loadError,
  } = useAgentHistoryRuntime();
  const [openSeqs, setOpenSeqs] = useState<Set<string>>(new Set());
  const stale = Boolean(loadError && data);

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

  const payloadDetail = (payload: any): string | null => {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.error) {
      const e = payload.error;
      const lines: string[] = [];
      if (typeof e === 'string') {
        lines.push(e);
      } else {
        if (e.message) lines.push(String(e.message));
        if (e.code) lines.push(`code: ${e.code}`);
        if (e.retriable !== undefined) lines.push(`retriable: ${String(e.retriable)}`);
        if (e.retry_after_s) lines.push(`retry_after_s: ${e.retry_after_s}`);
        if (e.traceback) lines.push('', String(e.traceback));
      }
      const text = lines.join('\n').trim();
      return text || null;
    }
    const keys = Object.keys(payload).filter((k) => payload[k] !== null && payload[k] !== undefined);
    if (keys.length === 0) return null;
    try {
      return JSON.stringify(payload, null, 2);
    } catch {
      return null;
    }
  };

  const toggleOpen = (key: string) => {
    setOpenSeqs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <section className={`rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.02] p-4 space-y-3 ${className}`}>
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
      </div>
      {/* Last error - always rendered in FULL, never truncated */}
      {errText && (
        <div className="text-[11px] font-mono text-rose-500 whitespace-pre-wrap break-all">
          {tk('lastError')}: {errText}
        </div>
      )}

      {/* Event log (newest first). Row click toggles the full payload
          detail; error rows carry their complete traceback there. */}
      <ul className="space-y-1 max-h-[280px] overflow-y-auto pr-1 font-mono text-[11px]">
        {events.length === 0 ? (
          <li className="text-slate-400">{tk('logEmpty')}</li>
        ) : events.map((ev, i) => {
          const ts = new Date(ev.created_at).toTimeString().slice(0, 8);
          const key = `${ev.seq ?? i}-${ts}`;
          const level = String(ev.level || 'info');
          const detail = payloadDetail(ev.payload);
          const expanded = openSeqs.has(key);
          const isError = level === 'error';
          return (
            <li
              key={key}
              className={`rounded-md ${detail ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-white/5' : ''} px-1 -mx-1`}
              onClick={() => detail && toggleOpen(key)}
            >
              <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${levelDot[level] || levelDot.info}`} />
                <span className="text-slate-400 shrink-0">{ts}</span>
                {detail && (
                  expanded
                    ? <ChevronDown className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                    : <ChevronRight className="w-3 h-3 mt-0.5 shrink-0 text-slate-400" />
                )}
                <span className={`break-all ${isError ? 'text-rose-500 dark:text-rose-400' : ''}`}>
                  {String(ev.message || '')}
                </span>
              </div>
              {expanded && detail && (
                <pre className={`mt-1 ml-[3.4rem] mr-1 rounded-md border px-2 py-1.5 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto ${
                  isError
                    ? 'border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-300'
                    : 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500'
                }`}>
                  {detail}
                </pre>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PcAgentHistoryLogPanel;
