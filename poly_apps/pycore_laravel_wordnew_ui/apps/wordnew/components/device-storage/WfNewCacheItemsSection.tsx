/**
 * Cache page: every data cache of wordnew (registry items) with its count, cleared one item at a time, several at
 * once, or all. Clearing never touches the login token or the settings.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { CheckSquare, Database, Loader2, RefreshCw, Square, Trash2 } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import {
  WFNEW_CACHE_ITEM_IDS,
  clearWfNewCacheItems,
  listWfNewCacheItems,
  type WfNewCacheItemId,
  type WfNewCacheOverview,
} from '../../runtime-store/WfNewCacheRegistry';

interface Props {
  activeTheme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onCleared?: () => void;
}

const ITEM_LABEL: Record<WfNewCacheItemId, string> = {
  books: 'cache.books',
  subtitles: 'cache.subtitles',
  libraries: 'cache.libraries',
  wordGroups: 'cache.wordGroupsGroups',
  words: 'cache.totalWords',
  serverResources: 'cache.serverResources',
  audio: 'cache.audio',
  orchInputs: 'cachePage.orchInputs',
  orchProgress: 'cachePage.orchProgress',
  orchClips: 'cachePage.orchClips',
};

export const WfNewCacheItemsSection: React.FC<Props> = ({ activeTheme, trans, onCleared }) => {
  const [overview, setOverview] = useState<WfNewCacheOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [selected, setSelected] = useState<Set<WfNewCacheItemId>>(new Set());
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setOverview(await listWfNewCacheItems().catch(() => null));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const allSelected = selected.size === WFNEW_CACHE_ITEM_IDS.length;
  const toggle = (id: WfNewCacheItemId): void => setSelected((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const clear = async (ids: WfNewCacheItemId[]): Promise<void> => {
    if (ids.length === 0 || clearing) return;
    setClearing(true);
    setMessage(null);
    const result = await clearWfNewCacheItems(ids);
    await load();
    setSelected(new Set());
    setMessage(trans(result.errors.length ? 'cache.clearedSome' : 'cache.cleared'));
    setClearing(false);
    onCleared?.();
  };

  return (
    <section className={`p-6 rounded-3xl ${activeTheme.cardClass} shadow-sm space-y-4`}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-extrabold flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
          <Database className="w-4 h-4 text-indigo-500" /> {trans('cache.manager')}
        </h3>
        <button
          type="button"
          onClick={() => { void load(); }}
          disabled={loading || clearing}
          title={trans('cache.refresh')}
          aria-label={trans('cache.refresh')}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">{trans('cache.desc')}</p>
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <span>
          {trans('cache.backend')}: <span className="text-zinc-700 dark:text-zinc-300">{overview?.backend ?? '—'}</span>
        </span>
        <button
          type="button"
          onClick={() => setSelected(allSelected ? new Set() : new Set(WFNEW_CACHE_ITEM_IDS))}
          className="flex items-center gap-1.5 hover:text-zinc-300"
        >
          {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-indigo-400" /> : <Square className="w-3.5 h-3.5" />} {trans('cache.selectAll')}
        </button>
      </div>
      <ul className="space-y-1.5">
        {WFNEW_CACHE_ITEM_IDS.map((id) => {
          const item = overview?.items.find((entry) => entry.id === id);
          const checked = selected.has(id);
          return (
            <li
              key={id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${checked ? 'border-indigo-500/40 bg-indigo-500/10' : 'border-slate-200 dark:border-white/5'}`}
            >
              <button type="button" onClick={() => toggle(id)} className="shrink-0" aria-pressed={checked} aria-label={trans(ITEM_LABEL[id])}>
                {checked ? <CheckSquare className="w-4 h-4 text-indigo-400" /> : <Square className="w-4 h-4 text-zinc-500" />}
              </button>
              <span className="flex-1 text-xs text-zinc-700 dark:text-zinc-200">{trans(ITEM_LABEL[id])}</span>
              <span className="text-[11px] font-mono text-zinc-500 tabular-nums">{item?.count ?? '—'}</span>
              <button
                type="button"
                onClick={() => { void clear([id]); }}
                disabled={clearing}
                title={trans('cache.clearItem')}
                aria-label={trans('cache.clearItem')}
                className="shrink-0 p-1 rounded text-zinc-500 hover:text-rose-400 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
      {message && <p className="text-[11px] text-emerald-500" role="status">{message}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => { void clear([...selected]); }}
          disabled={clearing || selected.size === 0}
          className="flex-1 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-white/10 text-zinc-600 dark:text-zinc-200 hover:bg-slate-500/5 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {trans('cache.clearSelected')}
          {selected.size > 0 ? ` (${selected.size})` : ''}
        </button>
        <button
          type="button"
          onClick={() => { void clear([...WFNEW_CACHE_ITEM_IDS]); }}
          disabled={clearing}
          className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-rose-500/15 border border-rose-500/30 text-rose-500 hover:bg-rose-500/25 disabled:opacity-40 flex items-center justify-center gap-1.5"
        >
          {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          {trans('cache.clearAll')}
        </button>
      </div>
    </section>
  );
};
