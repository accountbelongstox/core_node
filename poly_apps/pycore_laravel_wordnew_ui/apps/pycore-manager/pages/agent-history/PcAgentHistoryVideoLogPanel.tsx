import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Film } from 'lucide-react';
import { useAgentHistoryVideoRuntime } from '@/apps/pycore-manager/api';

const PcAgentHistoryVideoLogPanel: React.FC<{ tk: (key: string) => string; className?: string }> = ({ tk, className = '' }) => {
  const { jobs, loading, error } = useAgentHistoryVideoRuntime();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (jobId: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };
  return (
    <section className={`rounded-2xl border border-sky-500/20 bg-sky-500/[0.03] p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <Film className="h-3.5 w-3.5 text-sky-500" />
          {tk('videoLogTitle')}
        </h2>
        {loading && <span className="text-[11px] text-slate-400">…</span>}
        {error && !loading && <span className="max-w-[50%] truncate text-[11px] text-amber-500" title={error}>{error}</span>}
      </div>
      <ul className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
        {jobs.length === 0 ? (
          <li className="text-[11px] text-slate-400">{tk('videoLogEmpty')}</li>
        ) : jobs.map((job) => {
          const open = expanded.has(job.id);
          const progress = Math.max(0, Math.min(1, Number(job.progress || 0)));
          const events = Array.isArray(job.events) ? [...job.events].reverse() : [];
          return (
            <li key={job.id} className="rounded-xl border border-sky-500/15 bg-white/60 p-3 dark:bg-white/[0.02]">
              <button type="button" onClick={() => toggle(job.id)} className="w-full text-left">
                <div className="flex items-start gap-2">
                  {open ? <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{job.title_en || job.title_cn || job.record_id}</span>
                      <span className="shrink-0 text-[10px] font-mono text-sky-600 dark:text-sky-300">{Math.round(progress * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                      <div className="h-full rounded-full bg-sky-500 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] font-mono text-slate-500">
                      <span>{tk('videoStatus')}: {job.status}</span>
                      <span>{job.username}</span>
                      <span>{tk('videoBatchName')}: {job.batch_name}</span>
                    </div>
                  </div>
                </div>
              </button>
              {job.error && <div className="mt-2 whitespace-pre-wrap break-all text-[10px] text-rose-500">{job.error}</div>}
              {open && (
                <ul className="mt-2 space-y-1 border-t border-sky-500/10 pt-2 font-mono text-[10px]">
                  {events.map((event) => (
                    <li key={`${job.id}-${event.sequence}`} className="rounded-md bg-slate-100 px-2 py-1 dark:bg-white/5">
                      <div className="flex gap-2 text-slate-500">
                        <span>{String(event.created_at || '').slice(11, 19)}</span>
                        <span className={event.status === 'failed' ? 'text-rose-500' : 'text-sky-600 dark:text-sky-300'}>{event.status}</span>
                        <span>{Math.round(Number(event.progress || 0) * 100)}%</span>
                      </div>
                      {event.traceback && <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap break-all text-rose-500">{event.traceback}</pre>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default PcAgentHistoryVideoLogPanel;
