/**
 * PcFloatingLog — a GLOBAL floating, collapsible live-log docked to the bottom
 * of the viewport. Mounted ONCE in PcLayout so it overlays every pycore page.
 *
 * Collapsed: a slim glass bar (WS status dot + "Logs" + line count + chevron).
 * Expanded:  grows UP to occupy a portion of the viewport (~38vh, max ~60vh),
 *            showing a terminal-style log list (monospace, dark bg, colour per
 *            level), auto-scrolling to bottom, with a Clear button and a WS
 *            connected/disconnected indicator.
 *
 * Open/closed state persists in localStorage (`pc_log_open`). Consumes the
 * shared usePcLive() buffer — it does NOT open its own WS subscription.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Terminal, Wifi, WifiOff, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { usePcLive, type PcLogLine } from './PcLiveContext';

const STORAGE_KEY = 'pc_log_open';

function readOpen(): boolean {
  if (typeof window === 'undefined') return false;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === '1';
}

function lineColor(l: PcLogLine): string {
  if (l.color) return l.color;
  const lvl = l.level.toLowerCase();
  if (lvl === 'error' || lvl === 'critical') return '#f87171';
  if (lvl === 'warn' || lvl === 'warning') return '#fbbf24';
  if (lvl === 'success') return '#4ade80';
  if (lvl === 'debug') return '#818cf8';
  return '#d4d4d8';
}

export const PcFloatingLog: React.FC = () => {
  const { logs, wsConnected, clearLogs } = usePcLive();
  const [open, setOpen] = useState<boolean>(readOpen);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    }
  }, [open]);

  // Auto-scroll to bottom whenever new lines arrive while expanded.
  useLayoutEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [logs, open]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] pointer-events-none flex justify-center px-3 pb-3">
      <div
        className="pointer-events-auto w-full max-w-5xl flex flex-col overflow-hidden rounded-2xl pc-glass shadow-2xl shadow-black/20 dark:shadow-black/50 transition-[height] duration-300 ease-out"
        style={{ height: open ? 'clamp(220px, 38vh, 60vh)' : '44px' }}
      >
        {/* header / collapsed bar */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 h-11 flex items-center gap-3 px-4 text-left select-none border-b border-[var(--pc-glass-border)] hover:bg-slate-500/5 transition-colors"
        >
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {wsConnected && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                wsConnected ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'
              }`}
            />
          </span>
          <Terminal className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Logs</span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-slate-500/10 text-slate-500 dark:text-slate-400">
            {logs.length}
          </span>
          <span className={`text-[11px] font-medium inline-flex items-center gap-1 ${wsConnected ? 'text-emerald-500' : 'text-slate-400'}`}>
            {wsConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{wsConnected ? 'Connected' : 'Disconnected'}</span>
          </span>
          <span className="ml-auto inline-flex items-center gap-2">
            {open && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); clearLogs(); }}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); clearLogs(); } }}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-500/10 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </span>
            )}
            {open ? (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            )}
          </span>
        </button>

        {/* terminal body */}
        {open && (
          <div className="flex-1 min-h-0 m-2 mt-2 rounded-xl bg-slate-950 border border-white/5 overflow-auto p-3 text-[11px] font-mono leading-relaxed">
            {logs.length === 0 ? (
              <div className="text-slate-600">No log output yet.</div>
            ) : (
              logs.map((l, i) => (
                <div
                  key={`${l.ts}-${i}`}
                  className="whitespace-pre-wrap break-all"
                  style={{ color: lineColor(l) }}
                >
                  {l.message}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>
    </div>
  );
};

export default PcFloatingLog;
