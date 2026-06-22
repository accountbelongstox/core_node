import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Terminal, ChevronDown, Trash2, CircleAlert } from 'lucide-react';
import Portal from './Portal';
import {
  LogEntry,
  MAX_LOG_ENTRIES,
  clearLogs,
  getLogEntries,
  subscribeLogs
} from '../../core/logstore/logStore';

/**
 * GlobalLogPanel — FLOATING operation-log dock anchored to the bottom of the
 * viewport (portaled to <body>, so it overlays every view of the
 * laravel-manager end without occupying layout space).
 *
 * Collapsed (default): a small bottom-right pill with the entry count, error
 * badge and the latest message. Expanded: a console panel that auto-follows
 * the tail unless the user scrolled up. The store keeps only the last
 * MAX_LOG_ENTRIES entries.
 *
 * z-index: above app chrome (header z-40 / sidebar z-50 / offline banner
 * z-[100]) but BELOW every Portal overlay (OVERLAY_Z starts at z-[1000]),
 * so modals and logins always cover the dock.
 */

const LEVEL_TEXT: Record<LogEntry['level'], string> = {
  info: 'text-slate-500 dark:text-slate-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400'
};

const fmtTime = (ts: number): string => {
  const d = new Date(ts);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const GlobalLogPanel: React.FC = () => {
  const entries = useSyncExternalStore(subscribeLogs, getLogEntries);
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  /** True while the user has scrolled away from the tail (pause auto-follow). */
  const pinnedToTail = useRef(true);

  const latest = entries.length ? entries[entries.length - 1] : null;
  const errorCount = entries.reduce((n, e) => (e.level === 'error' ? n + 1 : n), 0);

  // Auto-follow the tail when new entries arrive (only while open and pinned).
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el && pinnedToTail.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries, open]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedToTail.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
  };

  return (
    <Portal lockScroll={false}>
      <div className="fixed bottom-3 right-3 z-[150] flex flex-col items-end pointer-events-none">
        {open && (
          <div className="pointer-events-auto mb-2 w-[min(760px,calc(100vw-2rem))] rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              <Terminal className="w-3.5 h-3.5 text-indigo-500" />
              <span className="font-medium text-slate-700 dark:text-slate-200">Operation logs</span>
              <span className="text-slate-400">last {MAX_LOG_ENTRIES} kept · newest at the bottom</span>
              <span className="flex-1" />
              <button
                type="button"
                onClick={clearLogs}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Clear logs"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Collapse"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            <div
              ref={scrollRef}
              onScroll={onScroll}
              className="h-64 overflow-auto px-3 py-2 font-mono text-xs leading-5"
            >
              {entries.length === 0 ? (
                <p className="text-slate-400 py-2">No log entries yet — operations will appear here.</p>
              ) : (
                entries.map((e) => (
                  <div key={e.id} className="flex gap-2 whitespace-nowrap">
                    <span className="text-slate-400 flex-shrink-0">{fmtTime(e.ts)}</span>
                    <span className="text-slate-400 flex-shrink-0 w-24 truncate">[{e.source}]</span>
                    <span className={`${LEVEL_TEXT[e.level]}`}>{e.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Collapsed pill — always visible, floats above the content. */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Collapse logs' : 'Expand logs'}
          className="pointer-events-auto flex items-center gap-2 max-w-[min(560px,calc(100vw-2rem))] px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-lg text-xs text-slate-500 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
        >
          <Terminal className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
          <span className="font-medium text-slate-700 dark:text-slate-200 flex-shrink-0">Logs</span>
          <span className="px-1.5 py-px rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex-shrink-0">
            {entries.length}
          </span>
          {errorCount > 0 && (
            <span className="flex items-center gap-0.5 px-1.5 py-px rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 flex-shrink-0">
              <CircleAlert className="w-3 h-3" />
              {errorCount}
            </span>
          )}
          {!open && latest && (
            <span className={`truncate font-mono ${LEVEL_TEXT[latest.level]}`}>{latest.message}</span>
          )}
        </button>
      </div>
    </Portal>
  );
};

export default GlobalLogPanel;
