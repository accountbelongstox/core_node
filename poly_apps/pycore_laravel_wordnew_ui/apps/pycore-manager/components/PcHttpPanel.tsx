/**
 * PcHttpPanel - the HTTP tab of the global PcDebugDock: one table for both
 * request directions (pycore = FE -> pycore, laravel = pycore -> Laravel relayed
 * by PcLiveContext), direction filter + free text, click a row for params,
 * error and full URL; newest first. Relay mode adds the fabric statistics view.
 */
import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Trash2 } from 'lucide-react';
import {
  getHttpDebugEntries, subscribeHttpDebug, clearHttpDebug, isPycoreRelayMode,
  type HttpDirection,
} from '@/apps/pycore-manager/api';
import { PcFabricStats } from './PcFabricStats';

function statusColor(status: number): string {
  if (!status) return '#f87171';        // transport error / HTTP rejection
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

export const PcHttpPanel: React.FC = () => {
  const { t } = useTranslation('pc');
  const entries = useSyncExternalStore(subscribeHttpDebug, getHttpDebugEntries);
  const [showFabric, setShowFabric] = useState(false);
  const relayMode = isPycoreRelayMode();
  const [dir, setDir] = useState<DirFilter>('all');
  const [q, setQ] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = entries;
    if (dir !== 'all') list = list.filter((r) => r.direction === dir);
    if (needle) {
      list = list.filter((r) =>
        `${r.path} ${r.method} ${r.route || ''} ${r.paramsSummary} ${r.status} ${r.transport || ''} ${r.httpVersion || ''} ${r.error || ''}`.toLowerCase().includes(needle),
      );
    }
    return [...list].reverse();
  }, [entries, dir, q]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {relayMode && (
        <div className="shrink-0 flex items-center gap-1.5 px-2 py-1 border-b border-[var(--pc-glass-border)]">
          {([false, true] as const).map((fabric) => (
            <button
              key={String(fabric)}
              type="button"
              onClick={() => setShowFabric(fabric)}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ring-1 ring-inset transition-colors ${
                showFabric === fabric
                  ? 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 ring-indigo-500/30'
                  : 'text-slate-500 dark:text-slate-400 ring-slate-500/15 hover:bg-slate-500/10'
              }`}
            >
              {fabric ? t('httpDebug.tabFabric') : t('httpDebug.tabRequests')}
            </button>
          ))}
        </div>
      )}
      {relayMode && showFabric ? (
        <div className="flex-1 min-h-0 overflow-auto bg-slate-950/95">
          <PcFabricStats />
        </div>
      ) : (<>
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
            {d === 'all' ? t('httpDebug.filterAll') : d}
          </button>
        ))}
        <div className="relative flex-1 min-w-0">
          <Search className="w-3 h-3 text-slate-400 absolute left-1.5 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('httpDebug.filterPlaceholder')}
            className="w-full pl-5 pr-1 py-0.5 text-[11px] font-mono rounded-md bg-slate-500/10 text-slate-700 dark:text-slate-200 outline-none placeholder:text-slate-400"
          />
        </div>
        <button
          type="button"
          onClick={() => { clearHttpDebug(); setExpanded(null); }}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-slate-500/10 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" /> {t('floatingLog.clear')}
        </button>
      </div>

      {/* rows */}
      <div className="flex-1 min-h-0 overflow-auto bg-slate-950/95">
        {rows.length === 0 ? (
          <div className="p-3 text-[11px] text-slate-600">{t('httpDebug.empty')}</div>
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
                      <td className="px-1.5 py-1 max-w-0 w-full">
                        <div className="truncate text-slate-200" title={r.fullUrl || r.path}>
                          {r.path}
                        </div>
                        {typeof r.progress === 'number' && (
                          <div className="mt-1 h-1 rounded-full bg-slate-700 overflow-hidden">
                            <div
                              className="h-full bg-cyan-400 transition-[width]"
                              style={{ width: `${Math.max(0, Math.min(100, r.progress))}%` }}
                            />
                          </div>
                        )}
                        {r.route && r.route !== r.path && (
                          <div className="text-[9px] text-slate-500 truncate">{r.route}</div>
                        )}
                      </td>
                      <td className="px-1.5 py-1 whitespace-nowrap text-right" style={{ color: statusColor(r.status) }}>
                        {typeof r.progress === 'number' ? `${r.progress.toFixed(1)}%` : (r.status || 'ERR')}
                      </td>
                      <td className="px-1.5 py-1 whitespace-nowrap text-right text-cyan-400">
                        {r.httpVersion || r.transport || '—'}
                      </td>
                      <td className={`px-1.5 py-1 whitespace-nowrap text-right ${r.ms > 1000 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {Math.round(r.ms)}ms
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap text-slate-500">{fmtTime(r.ts)}</td>
                    </tr>
                    {isExp && (
                      <tr className="border-b border-white/5 bg-white/5">
                        <td colSpan={7} className="px-2 py-1.5">
                          {r.error && (
                            <div className="text-rose-400 break-all mb-1">err: {r.error}</div>
                          )}
                          <div className="text-slate-400 break-all">
                            {r.paramsSummary || <span className="text-slate-600">{t('httpDebug.noParams')}</span>}
                          </div>
                          {r.fullUrl && r.fullUrl !== r.path && (
                            <div className="text-slate-500 break-all mt-1">{r.fullUrl}</div>
                          )}
                          {(r.transport || r.httpVersion) && (
                            <div className="text-cyan-500 break-all mt-1">
                              {[r.transport, r.httpVersion].filter(Boolean).join(' / ')}
                            </div>
                          )}
                          {typeof r.transferredBytes === 'number' && typeof r.totalBytes === 'number' && (
                            <div className="text-cyan-400 break-all mt-1">
                              {r.transferredBytes}/{r.totalBytes} B
                              {r.phase ? ` · ${r.phase}` : ''}
                            </div>
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
      </>)}
    </div>
  );
};

export default PcHttpPanel;
