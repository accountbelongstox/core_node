/**
 * TTS Queue tab - queue stats (by status / by type) + a paginated items table
 * filterable by status and type. Proxied through pycore.
 *
 * Params mirror BooksAPI.getTtsQueueItems (status/type/start/limit).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import { VL, VocabBanner, VocabLoading, humanInt, vp, toArray } from './vocabShared';

const STATUSES = ['pending', 'processing', 'completed', 'failed', 'leased'] as const;
const TYPES = ['word', 'sentence', 'article'] as const;
const PAGE_SIZE = 50;

const L = {
  stats: 'Queue stats',
  byStatus: 'By status',
  byType: 'By type',
  total: 'Total',
  concurrent: 'Concurrent',
  items: 'Items',
  status: 'Status',
  type: 'Type',
  all: 'all',
  text: 'Text',
};

export default function VocabTtsQueueTab() {
  const [stats, setStats] = useState<{ by_status?: Record<string, number>; by_type?: Record<string, number>; total?: number; current_concurrent?: number } | null>(null);
  const [status, setStatus] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [start, setStart] = useState(0);
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingItems, setLoadingItems] = useState(true);
  const [offline, setOffline] = useState(false);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const r = await pycoreApi.getVocabTtsQueueStats();
      setStats(vp<any>(r));
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    try {
      const params: Record<string, unknown> = { start, limit: PAGE_SIZE };
      if (status) params.status = status;
      if (type) params.type = type;
      const r = await pycoreApi.getVocabTtsQueueItems(params);
      const p = vp<any>(r);
      setItems(toArray(p));
      setTotal(Number(p?.total || 0));
      setOffline(false);
    } catch {
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [status, type, start]);

  useEffect(() => { void loadStats(); }, [loadStats]);
  useEffect(() => { void loadItems(); }, [loadItems]);
  useEffect(() => { setStart(0); }, [status, type]);

  if (loadingStats && !stats) return <VocabLoading />;
  if (offline && !stats) return <VocabBanner kind="offline" message={VL.offline} />;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatBox label={L.total} value={humanInt(stats?.total)} />
        <StatBox label={L.concurrent} value={humanInt(stats?.current_concurrent)} />
        <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
          <div className="text-xs text-slate-400 mb-1">{L.byStatus}</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {STATUSES.map((s) => (
              <span key={s} className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-200">
                {s}: <b>{humanInt(stats?.by_status?.[s])}</b>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
        <div className="text-xs text-slate-400 mb-1">{L.byType}</div>
        <div className="flex flex-wrap gap-2 text-xs">
          {TYPES.map((t) => (
            <span key={t} className="px-2 py-0.5 rounded bg-slate-700/50 text-slate-200">
              {t}: <b>{humanInt(stats?.by_type?.[t])}</b>
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{L.status}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400">
            <option value="">{L.all}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">{L.type}</span>
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="px-2 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-100 focus:outline-none focus:border-sky-400">
            <option value="">{L.all}</option>
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
      </div>

      {/* Items table */}
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        {loadingItems ? (
          <div className="py-6"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-slate-500">{VL.empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">{L.type}</th>
                <th className="px-3 py-2 text-left">{L.status}</th>
                <th className="px-3 py-2 text-left">{L.text}</th>
                <th className="px-3 py-2 text-left">lang</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={(it.md5 as string) || (it.id as string) || i} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-300">{String(it.type ?? '-')}</td>
                  <td className="px-3 py-2 text-slate-300">{String(it.status ?? '-')}</td>
                  <td className="px-3 py-2 text-slate-100"><div className="truncate max-w-md">{String(it.text ?? it.word ?? it.content ?? '-')}</div></td>
                  <td className="px-3 py-2 text-slate-400">{String(it.language ?? '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between text-sm text-slate-400">
        <span>{humanInt(total)} {VL.total}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setStart(Math.max(0, start - PAGE_SIZE))} disabled={start === 0}
            className="px-3 py-1 rounded border border-slate-600 disabled:opacity-40 hover:bg-slate-700/50">{VL.prev}</button>
          <button onClick={() => setStart(start + PAGE_SIZE)} disabled={start + PAGE_SIZE >= total}
            className="px-3 py-1 rounded border border-slate-600 disabled:opacity-40 hover:bg-slate-700/50">{VL.next}</button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-2xl font-semibold text-slate-100">{value}</div>
    </div>
  );
}
