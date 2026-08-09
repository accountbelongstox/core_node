import React, { useEffect } from 'react';
import { Bot, Boxes, Chrome, Server } from 'lucide-react';
import { useWordNewQueueRuntime, wordNewQueueRuntime } from '../services/WordNewQueueRuntime';

export interface WordNewQueueStatusBarProps {
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const RECEIPT_REFRESH_MS = 2000;
const PRESENCE_REFRESH_MS = 10000;

export const WordNewQueueStatusBar: React.FC<WordNewQueueStatusBarProps> = ({ trans }) => {
  const snapshot = useWordNewQueueRuntime();
  const pycoreWorkers = snapshot.workers.filter((worker) => worker.kind === 'pycore');
  const chromeWorkers = snapshot.workers.filter((worker) => worker.kind === 'chrome');

  useEffect(() => {
    void wordNewQueueRuntime.refreshPresence();
    void wordNewQueueRuntime.refreshReceipts();
    const presenceTimer = window.setInterval(() => {
      void wordNewQueueRuntime.refreshPresence();
    }, PRESENCE_REFRESH_MS);
    const receiptTimer = window.setInterval(() => {
      void wordNewQueueRuntime.refreshReceipts();
    }, RECEIPT_REFRESH_MS);
    return () => {
      window.clearInterval(presenceTimer);
      window.clearInterval(receiptTimer);
    };
  }, []);

  const workerChip = (worker: typeof snapshot.workers[number], icon: React.ReactNode) => (
    <span
      key={worker.id}
      title={`${worker.name}${worker.hostname ? ` · ${worker.hostname}` : ''}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        worker.online
          ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
          : 'border-slate-500/20 bg-slate-500/10 text-slate-400'
      }`}
    >
      {icon}
      <span className={`h-1.5 w-1.5 rounded-full ${worker.online ? 'bg-emerald-400' : 'bg-slate-500'}`} />
      <span>{worker.name}</span>
      {worker.claimed ? <span className="opacity-70">{worker.claimed}</span> : null}
    </span>
  );

  return (
    <div className="relative z-30 border-b border-white/5 bg-slate-950/25 px-4 py-2 backdrop-blur-md sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
          snapshot.laravelOnline
            ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
            : 'border-rose-400/25 bg-rose-500/10 text-rose-300'
        }`}>
          <Server className="h-3.5 w-3.5" />
          <span className={`h-1.5 w-1.5 rounded-full ${snapshot.laravelOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          {trans('queue.laravel')}
        </span>
        {pycoreWorkers.length > 0
          ? pycoreWorkers.map((worker) => workerChip(worker, <Bot className="h-3.5 w-3.5" />))
          : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
              <Bot className="h-3.5 w-3.5" />
              {trans('queue.pycore')} · {trans('queue.offline')}
            </span>
          )}
        {chromeWorkers.length > 0
          ? chromeWorkers.map((worker) => workerChip(worker, <Chrome className="h-3.5 w-3.5" />))
          : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-500/20 bg-slate-500/10 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
              <Chrome className="h-3.5 w-3.5" />
              {trans('queue.mcpChrome')} · {trans('queue.offline')}
            </span>
          )}
        {snapshot.receipts.size > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
            <Boxes className="h-3.5 w-3.5" />
            {trans('queue.tracked', { count: snapshot.receipts.size })}
          </span>
        ) : null}
      </div>
    </div>
  );
};

export default WordNewQueueStatusBar;
