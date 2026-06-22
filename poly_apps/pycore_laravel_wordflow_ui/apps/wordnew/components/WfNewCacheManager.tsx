/**
 * WfNewCacheManager — the dedicated "Clear cache" surface. Opened from Settings
 * (the "Clear cache" button). Lists every wordnew DATA cache item with its count
 * and lets the user clear ONE item, SEVERAL (checkbox + Clear selected), or ALL —
 * without touching login or settings.
 *
 * It is the single funnel for clearing: Settings no longer clears directly; it
 * opens this manager. All item ↔ clear-fn mapping lives in WfNewCacheRegistry.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Database, Trash2, RefreshCw, Loader2, X, CheckSquare, Square } from 'lucide-react';
import {
  listWfNewCacheItems, clearWfNewCacheItems, WFNEW_CACHE_ITEM_IDS,
  type WfNewCacheItemId, type WfNewCacheOverview,
} from '../cache/WfNewCacheRegistry';

interface Props {
  open: boolean;
  onClose: () => void;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

// i18n label per item (the count rows reuse the existing cache.* keys).
const ITEM_LABEL: Record<WfNewCacheItemId, string> = {
  books: 'cache.books',
  subtitles: 'cache.subtitles',
  libraries: 'cache.libraries',
  wordGroups: 'cache.wordGroupsGroups',
  words: 'cache.totalWords',
  wordflowTtl: 'cache.wordflowTtl',
};

export const WfNewCacheManager: React.FC<Props> = ({ open, onClose, trans }) => {
  const [overview, setOverview] = useState<WfNewCacheOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<WfNewCacheItemId>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOverview(await listWfNewCacheItems());
    } catch {
      /* offline / no db — leave as-is */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setNotice(null);
      void load();
    }
  }, [open, load]);

  if (!open) return null;

  const allIds = WFNEW_CACHE_ITEM_IDS;
  const allSelected = selected.size === allIds.length;

  const toggle = (id: WfNewCacheItemId) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));

  const clear = async (ids: WfNewCacheItemId[]) => {
    if (!ids.length || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await clearWfNewCacheItems(ids);
      await load();
      setSelected(new Set());
      setNotice(r.errors.length ? trans('cache.clearedSome') : trans('cache.cleared'));
    } catch {
      setNotice(trans('cache.clearedSome'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
        {/* header */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" /> {trans('cache.manager')}
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={() => void load()} disabled={loading || busy} title={trans('cache.refresh')} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 disabled:opacity-40 cursor-pointer">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={onClose} aria-label={trans('api.close')} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <p className="text-[11px] text-zinc-400 leading-relaxed">{trans('cache.desc')}</p>
        <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <span>{trans('cache.backend')}: <span className="text-zinc-300">{overview?.backend ?? '—'}</span></span>
          <button onClick={toggleAll} className="flex items-center gap-1.5 hover:text-zinc-200 cursor-pointer">
            {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5" />} {trans('cache.selectAll')}
          </button>
        </div>

        {/* items */}
        <div className="space-y-1.5">
          {allIds.map((id) => {
            const item = overview?.items.find((i) => i.id === id);
            const on = selected.has(id);
            return (
              <div
                key={id}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${
                  on ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-white/5 bg-white/[0.02]'
                }`}
              >
                <button onClick={() => toggle(id)} className="shrink-0 cursor-pointer" aria-label={trans('cache.selectAll')}>
                  {on ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-zinc-500" />}
                </button>
                <span className="flex-1 text-xs text-zinc-200">{trans(ITEM_LABEL[id])}</span>
                <span className="text-[11px] font-mono text-zinc-400 tabular-nums">
                  {item ? (item.count == null ? '—' : item.count) : '—'}
                </span>
                <button
                  onClick={() => void clear([id])}
                  disabled={busy}
                  title={trans('cache.clearItem')}
                  aria-label={trans('cache.clearItem')}
                  className="shrink-0 p-1 rounded text-zinc-500 hover:text-rose-400 disabled:opacity-40 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {notice && <div className="text-[11px] text-emerald-400">{notice}</div>}

        {/* footer actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => void clear([...selected])}
            disabled={busy || selected.size === 0}
            className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-white/5 border border-white/10 text-zinc-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {trans('cache.clearSelected')}{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
          <button
            onClick={() => void clear([...allIds])}
            disabled={busy}
            className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {trans('cache.clearAll')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WfNewCacheManager;
