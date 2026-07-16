/**
 * Learning Tasks tab - the assist overview (worker queue categories + roster),
 * the real in-flight learning/processing work. The laravel-manager Learning
 * Tasks panel is presentational/mock, so this surfaces the assist overview
 * instead (categories with pending/processing/leased counts + drill-down rows).
 * Proxied through pycore.
 *
 * Params mirror BooksAPI.getAssistCategoryItems (category/status/start/limit).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { VocabAssistCategory } from '../../../core/api-libs/pycore';
import { VL, VocabBanner, VocabLoading, humanInt, pickArray } from './vocabShared';

const L = {
  categories: 'Queue categories',
  workers: 'Workers',
  pending: 'pending',
  processing: 'processing',
  leased: 'leased',
  total: 'total',
  handler: 'handler',
  empty: 'No categories reported.',
  back: 'Back',
  items: 'Items',
  generatedAt: 'Updated',
};

export default function VocabLearningTasksPanel() {
  const [cats, setCats] = useState<VocabAssistCategory[]>([]);
  const [workers, setWorkers] = useState<Record<string, unknown>[]>([]);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<VocabAssistCategory | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await pycoreApi.getVocabAssistOverview();
      setCats(r?.categories || []);
      setWorkers((r?.workers || []) as Record<string, unknown>[]);
      setGeneratedAt(r?.generated_at || '');
      setOffline(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : VL.error;
      if (/offline|unavailable|Failed to fetch|timed out/i.test(msg)) setOffline(true);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && cats.length === 0) return <VocabLoading />;
  if (offline && cats.length === 0) return <VocabBanner kind="offline" message={VL.offline} />;

  return (
    <div className="space-y-4">
      {error && <VocabBanner kind="warn" message={error} />}
      {generatedAt && <p className="text-xs text-slate-500">{L.generatedAt}: {generatedAt}</p>}

      {activeCat ? (
        <CategoryItems cat={activeCat} onBack={() => setActiveCat(null)} />
      ) : (
        <>
          {/* Categories */}
          <div className="rounded-lg border border-slate-700 overflow-hidden">
            <div className="px-3 py-2 bg-slate-800/60 text-sm font-medium text-slate-200">{L.categories}</div>
            {cats.length === 0 ? (
              <p className="px-3 py-6 text-center text-slate-500">{L.empty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/40 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">{L.handler}</th>
                      <th className="px-3 py-2 text-right">{L.pending}</th>
                      <th className="px-3 py-2 text-right">{L.processing}</th>
                      <th className="px-3 py-2 text-right">{L.leased}</th>
                      <th className="px-3 py-2 text-right">{L.total}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map((c, i) => (
                      <tr key={c.key || i} className="border-t border-slate-800 hover:bg-slate-800/30 cursor-pointer"
                        onClick={() => setActiveCat(c)}>
                        <td className="px-3 py-2 text-slate-100">{c.label || c.key}</td>
                        <td className="px-3 py-2 text-slate-400">{c.handler || '-'}</td>
                        <td className="px-3 py-2 text-right text-amber-300">{humanInt(c.pending)}</td>
                        <td className="px-3 py-2 text-right text-sky-300">{humanInt(c.processing)}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{humanInt(c.leased)}</td>
                        <td className="px-3 py-2 text-right text-slate-300">{humanInt(c.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Workers */}
          {workers.length > 0 && (
            <div className="rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-800/60 text-sm font-medium text-slate-200">{L.workers}</div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/40 text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left">Worker</th>
                      <th className="px-3 py-2 text-left">Kind</th>
                      <th className="px-3 py-2 text-center">Online</th>
                      <th className="px-3 py-2 text-right">Claimed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workers.map((w, i) => (
                      <tr key={String(w.id ?? i)} className="border-t border-slate-800">
                        <td className="px-3 py-2 text-slate-100">{String(w.name ?? w.id ?? '-')}</td>
                        <td className="px-3 py-2 text-slate-400">{String(w.kind ?? '-')}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`text-xs px-1.5 py-0.5 rounded ${w.online ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                            {w.online ? 'online' : 'offline'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-slate-300">{humanInt(w.claimed as number)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CategoryItems({ cat, onBack }: { cat: VocabAssistCategory; onBack: () => void }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState(0);
  const limit = 50;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    pycoreApi.getVocabAssistOverviewItems({ category: cat.key || '', start, limit })
      .then((r) => { if (!cancelled) setItems(pickArray(r)); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cat.key, start]);

  return (
    <div className="space-y-3">
      <button onClick={onBack}
        className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-slate-300 hover:bg-slate-700/50">
        <ChevronLeft className="w-4 h-4" /> {L.back}
      </button>
      <h3 className="text-base font-semibold text-slate-100">{cat.label || cat.key} · {L.items}</h3>
      <div className="overflow-x-auto rounded-lg border border-slate-700">
        {loading ? <VocabLoading /> : items.length === 0 ? (
          <p className="py-6 text-center text-slate-500">{VL.empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-400">
              <tr>
                {Object.keys(items[0]).slice(0, 5).map((k) => (
                  <th key={k} className="px-3 py-2 text-left">{k}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i} className="border-t border-slate-800">
                  {Object.keys(items[0]).slice(0, 5).map((k) => (
                    <td key={k} className="px-3 py-2 text-slate-200"><div className="truncate max-w-xs">{String(it[k] ?? '-')}</div></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 text-sm">
        <button onClick={() => setStart(Math.max(0, start - limit))} disabled={start === 0}
          className="px-3 py-1 rounded border border-slate-600 disabled:opacity-40 hover:bg-slate-700/50">{VL.prev}</button>
        <button onClick={() => setStart(start + limit)} disabled={items.length < limit}
          className="px-3 py-1 rounded border border-slate-600 disabled:opacity-40 hover:bg-slate-700/50">{VL.next}</button>
      </div>
    </div>
  );
}
