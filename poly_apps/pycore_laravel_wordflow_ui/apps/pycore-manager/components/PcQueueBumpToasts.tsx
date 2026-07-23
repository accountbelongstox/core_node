/**
 * PcQueueBumpToasts — cross-lane priority bump notifications (translation, sentence, …).
 * Events come from the shared Queue Center snapshot and therefore obey the
 * page's single auto-refresh switch.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Zap, X } from 'lucide-react';
import type { QueueBumpEvent } from '../../../core/api-libs/pycore/pycoreTypes';
import { useQueueCenterHub } from '../hooks/useQueueCenterHub';

const DISMISS_MS = 12000;

export const PcQueueBumpToasts: React.FC = () => {
  const hub = useQueueCenterHub();
  const [toasts, setToasts] = useState<QueueBumpEvent[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const pushEvents = useCallback((events: QueueBumpEvent[]) => {
    if (!mounted.current || !events.length) return;
    const fresh: QueueBumpEvent[] = [];
    for (const ev of events) {
      const key = `${ev.at ?? 0}:${ev.lane}:${ev.item_id}:${ev.new_priority}`;
      if (seenRef.current.has(key)) continue;
      seenRef.current.add(key);
      fresh.push(ev);
    }
    if (!fresh.length) return;
    setToasts((prev) => [...fresh.slice(0, 5), ...prev].slice(0, 8));
    window.setTimeout(() => {
      if (!mounted.current) return;
      setToasts((prev) => prev.filter((t) => !fresh.includes(t)));
    }, DISMISS_MS);
  }, []);

  useEffect(() => {
    pushEvents(hub.sentenceQueue?.bumps?.events ?? []);
  }, [hub.timestamp, hub.sentenceQueue, pushEvents]);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
      {toasts.map((ev) => (
        <div key={`${ev.at}-${ev.lane}-${ev.item_id}`}
          className="pointer-events-auto pc-glass px-3 py-2 rounded-xl shadow-lg border border-amber-400/30 bg-amber-500/10 flex items-start gap-2 animate-in slide-in-from-right">
          <Zap className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 text-xs">
            <p className="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide text-[10px]">{ev.lane}</p>
            <p className="text-slate-700 dark:text-slate-200 truncate" title={ev.label}>{ev.label}</p>
            <p className="text-[10px] font-mono text-slate-400">priority {ev.old_priority} → {ev.new_priority}</p>
          </div>
          <button type="button" onClick={() => setToasts((p) => p.filter((x) => x !== ev))}
            className="p-0.5 text-slate-400 hover:text-slate-600 shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default PcQueueBumpToasts;
