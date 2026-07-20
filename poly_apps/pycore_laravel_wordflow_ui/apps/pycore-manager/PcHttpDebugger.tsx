/**
 * PcHttpDebugger - a GLOBAL floating HTTP/RPC request debugger for the
 * pycore-manager end. Mounted ONCE in PcLayout (overlays every page, incl.
 * /pycore-manager/queue-center).
 *
 * Shows BOTH request directions in one table:
 *   - pycore  : FE -> pycore (instrumented in PycoreWs.callRpc + PycoreApi
 *               PycoreMasterClient.request).
 *   - laravel : pycore -> Laravel (relayed from the backend 'laravel_http' WS
 *               event by PcLiveContext).
 *
 * Each row: direction badge, method, full path, status, duration, time. Click a
 * row to expand its params summary + error + full URL. Filter by direction +
 * free-text; clear. Newest first. Open/closed state persists in localStorage.
 */
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Bug, Trash2, ChevronUp, ChevronDown, Search } from 'lucide-react';
import {
  getHttpDebugEntries, subscribeHttpDebug, clearHttpDebug,
  type HttpDebugRecord, type HttpDirection,
} from '../../core/api-libs/pycore/pycoreHttpLog';

const STORAGE_KEY = 'pc_http_debug_open';

function readOpen(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(STORAGE_KEY) === '1';
}

function statusColor(status: number): string {
  if (!status) return '#f87171';        // transport error / RPC rejection
  if (status >= 500) return '#f87171';  // red
  if (status >= 400) return '#fbbf24';  // amber
  if (status >= 200 && status < 300) return '#4ade80'; // green
  return '#818cf8';                     // info
}

function dirBadge(d: HttpDirection): { label: string; cls: string } {
  if (d === 'laravel') {
    return { label: 'laravel', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 ring-1 ring-inset ring-amber-500/20' };
  }
  return { label: 'pycore', cls: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 ring-1 ring-inset ring-indigo-500/20' };
}

function fmtTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

type DirFilter = 'all' | HttpDirection;
const DIR_FILTERS: DirFilter[] = ['all', 'pycore', 'laravel'];

export const PcHttpDebugger: React.FC = () => {
  const entries = useSyncExternalStore(subscribeHttpDebug, getHttpDebugEntries);
  const [open, setOpen] = useState<boolean>(readOpen);
  const [dir, setDir] = useState<DirFilter>('all');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, open ? '1' : '0');
    }
  }, [open]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = entries;
    if (dir !== 'all') list = list.filter((r) => r.direction === dir);
    if (needle) {
      list = list.filter((r) =>
        `${r.path} ${r.method} ${r.route || ''} ${r.paramsSummary} ${r.status} ${r.error || ''}`.toLowerCase().includes(needle),
      );
    }
    return [...list].reverse(); // newest first
  }, [entries, dir, q]);

  const counts = useMemo(() => {
    let pycore = 0;
    let laravel = 0;
    for (const r of entries) {
      if (r.direction === 'pycore') pycore += 1;
      else laravel += 1;
    }
    return { pycore, laravel };
  }, [entries]);

  return (
    <div className="fixed left-3 bottom-[60px] z-[70] pointer-events-none flex flex-col items-start">
      <div
        className="pointer-events-auto flex flex-col overflow-hidden rounded-2xl pc-glass shadow-2xl shadow-black/20 dark:shadow-black/50"
        style={{
          width: open ? 'clamp(320px, 42vw, 600px)' : undefined,
          height: open ? 'clamp(280px, 55vh, 75vh)' : 40,
        }}
      >
        {/* header / collapsed pill */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 h-10 flex items-center gap-2 px-3 text-left select-none border-b border-[var(--pc-glass-border)] hover:bg-slate-500/5 transition-colors"
        >
          <Bug className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">HTTP</span>
          <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-slate-500/10 text-slate-500 dark:text-slate-400">
            {entries.length}
          </span>
          {!open && (
            <span className="text-[10px] font-mono inline-flex items-center gap-1.5">
              <span className="text-indigo-500">P:{counts.pycore}</span>
              <span className="text-amber-500">L:{counts.laravel}</span>
            </span>
          )}
          <span className="ml-auto">
            {open ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
          </span>
        </button>

        {open && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* filter bar */}
            <div className="shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b border-[var(--pc-glass-border)]">
              {DIR_FILTERS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDir(d)}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ring-1 ring-inset transition-colors ${
                    dir === d
                      ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 ring-indigo-500/30'
                      : 'text-slate-500 dark:text-slate-400 ring-slate-500/15 hover:bg-slate-500/10'
                  }`}
                >
                  {d === 'all' ? 'All' : d}
                </button>
              ))}
              <div className="relative flex-1 min-w-0">
                <Search className="w-3 h-3 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="filter path/params…"
                  className="w-full pl-5 pr-1 py-0.5 text-[11px] font-mono rounded-md bg-slate-500/10 text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400"
                />
              </div>
              <button
                type="button"
                onClick={() => { clearHttpDebug(); setExpanded(null); }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-slate-500/10 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Clear
              </button>
            </div>

            {/* rows */}
            <div className="flex-1 min-h-0 overflow-auto bg-slate-950/95">
              {rows.length === 0 ? (
                <div className="p-3 text-[11px] text-slate-600">No requests yet.</div>
              ) : (
                <table className="w-full text-[11px] font-mono border-collapse">
                  <tbody>
                    {rows.map((r) => {
                      const b = dirBadge(r.direction);
                      const isExp = expanded === r.id;
                      return (
                        <React.Fragment key={r.id}>
                          <tr
                            onClick={() => setExpanded(isExp ? null : r.id)}
                            className="cursor-pointer border-b border-white/5 hover:bg-white/5 align-top"
                          >
                            <td className="px-2 py-1 whitespace-nowrap">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${b.cls}`}>
                                {b.label}
                              </span>
                            </td>
                            <td className="px-1.5 py-1 whitespace-nowrap" style={{ color: statusColor(r.status) }}>
                              {r.method}
                            </td>
                            <td className="px-1.5 py-1 max-w-0">
                              <div className="truncate text-slate-200" title={r.fullUrl || r.path}>
                                {r.path}
                              </div>
                              {r.route && r.route !== r.path && (
                                <div className="text-[9px] text-slate-500 truncate">{r.route}</div>
                              )}
                            </td>
                            <td className="px-1.5 py-1 whitespace-nowrap text-right" style={{ color: statusColor(r.status) }}>
                              {r.status || 'ERR'}
                            </td>
                            <td className={`px-1.5 py-1 whitespace-nowrap text-right ${r.ms > 1000 ? 'text-amber-400' : 'text-slate-400'}`}>
                              {Math.round(r.ms)}ms
                            </td>
                            <td className="px-2 py-1 whitespace-nowrap text-slate-500">{fmtTime(r.ts)}</td>
                          </tr>
                          {isExp && (
                            <tr className="border-b border-white/5 bg-white/5">
                              <td colSpan={6} className="px-2 py-1.5">
                                {r.error && (
                                  <div className="text-rose-400 break-all mb-1">err: {r.error}</div>
                                )}
                                <div className="text-slate-400 break-all">
                                  {r.paramsSummary || <span className="text-slate-600">(no params)</span>}
                                </div>
                                {r.fullUrl && r.fullUrl !== r.path && (
                                  <div className="text-slate-500 break-all mt-1">{r.fullUrl}</div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PcHttpDebugger;
