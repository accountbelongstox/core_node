/**
 * One reusable list of orchestration sources (books, prompts, ...): search,
 * pages, selection. Each source kind is an adapter that loads pages from the
 * API side; the list itself knows nothing about books or prompts.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import { WfNewLoadingDots } from '../WfNewLoadingDots';
import { WfNewPager } from '../WfNewPager';

export interface OrchSourceListItem<T> {
  id: string;
  title: string;
  subtitle?: string;
  /** Short facts (counts, language, date) shown as mono chips. */
  meta: string[];
  imageUrl?: string;
  value: T;
}

export interface OrchSourceListPage<T> {
  items: OrchSourceListItem<T>[];
  /** Total count when the API reports it; null when only `hasMore` is known. */
  total: number | null;
  hasMore: boolean;
}

export interface OrchSourceAdapter<T> {
  /** Page 1-based; `query` is applied by the API or, when it cannot, by the adapter. */
  load(page: number, query: string): Promise<OrchSourceListPage<T>>;
  pageSize: number;
  emptyKey: string;
}

interface Props<T> {
  adapter: OrchSourceAdapter<T>;
  selectedId: string | null;
  onSelect: (item: OrchSourceListItem<T>) => void;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
}

const SEARCH_DELAY_MS = 300;

export function WfNewOrchSourceList<T>({ adapter, selectedId, onSelect, theme, trans }: Props<T>): React.ReactElement {
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<OrchSourceListPage<T> | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedQuery(query.trim());
      setPage(1);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const request = ++requestRef.current;
    setLoading(true);
    setFailed(false);
    adapter.load(page, appliedQuery)
      .then((next) => { if (request === requestRef.current) setResult(next); })
      .catch(() => { if (request === requestRef.current) { setResult(null); setFailed(true); } })
      .finally(() => { if (request === requestRef.current) setLoading(false); });
  }, [adapter, page, appliedQuery]);

  const totalPages = result?.total != null
    ? Math.max(1, Math.ceil(result.total / adapter.pageSize))
    : page + (result?.hasMore ? 1 : 0);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        <Search className="h-3.5 w-3.5 text-zinc-500" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={trans('orchCompose.source.search')}
          aria-label={trans('orchCompose.source.search')}
          className="min-w-0 flex-1 bg-transparent text-xs text-zinc-200 outline-none"
        />
        {loading && <WfNewLoadingDots className="text-indigo-300" label={trans('content.loading')} />}
      </label>
      {!loading && (result?.items.length ?? 0) === 0 ? (
        <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-[11px] font-mono text-zinc-500">
          {trans(failed ? 'orchCompose.source.loadFailed' : adapter.emptyKey)}
        </p>
      ) : (
        <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1" role="listbox" aria-label={trans('orchCompose.source.pick')}>
          {(result?.items ?? []).map((item) => {
            const selected = item.id === selectedId;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => onSelect(item)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors ${
                    selected ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-white/5 hover:bg-white/5'
                  }`}
                >
                  {item.imageUrl
                    ? <img src={item.imageUrl} alt="" className="h-10 w-8 shrink-0 rounded object-cover" loading="lazy" />
                    : <span className="h-10 w-8 shrink-0 rounded bg-white/5" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-zinc-100">{item.title}</span>
                    {item.subtitle && <span className="line-clamp-2 block text-[11px] text-zinc-400">{item.subtitle}</span>}
                    {item.meta.length > 0 && (
                      <span className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] font-mono text-zinc-500">
                        {item.meta.map((entry) => <span key={entry}>{entry}</span>)}
                      </span>
                    )}
                  </span>
                  {selected && <Check className="h-4 w-4 shrink-0 text-indigo-300" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <WfNewPager
        page={page}
        totalPages={totalPages}
        atLastPage={result ? !result.hasMore && page >= totalPages : true}
        loading={loading}
        onGoTo={(next) => setPage(Math.max(1, Math.min(next, totalPages)))}
        trans={trans}
      />
    </div>
  );
}
