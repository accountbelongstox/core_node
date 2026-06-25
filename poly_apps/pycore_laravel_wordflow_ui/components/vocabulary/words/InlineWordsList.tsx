import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, CircleAlert } from 'lucide-react';
import { api } from '../../../core/api';
import { LoadingBlock, EmptyState, AlertBox } from '../../common';
import type { PaginatedListColumn } from '../PaginatedListModal';

/**
 * InlineWordsList — a compact, paginated dictionary-word browser embedded in
 * the "Words" tab (the same data the drill-down modal shows, but inline). Each
 * row expands to the full <renderWordDetail> panel (example sentences + the
 * Re-translate / Add-audio one-click actions). Reuses the shared column set
 * and `api.books.getDictionaryWords` fetcher.
 *
 * Presentational leaf list: it owns its OWN local fetch state (start/items/
 * total/loading/error/expandedIdx/validity) and its load()/effects — that is
 * fine, it is not container state. It receives the shared column set
 * (dictionaryColumns result), the renderWordDetail factory, and the
 * setWordsValiditySource setter (driven by the validity-source filter pills)
 * from the container as props.
 */
export interface InlineWordsListProps {
  language: string;
  filter: string;
  validitySource?: string;
  q: string;
  reloadKey: string | number;
  columns: PaginatedListColumn[];
  renderWordDetail: (r: any) => React.ReactNode;
  setWordsValiditySource: React.Dispatch<React.SetStateAction<string>>;
}

const InlineWordsList: React.FC<InlineWordsListProps> = ({
  language,
  filter,
  validitySource,
  q,
  reloadKey,
  columns,
  renderWordDetail,
  setWordsValiditySource,
}) => {
  const [start, setStart] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  // Validity breakdown strip (only when filter=invalid): total + by-source.
  const [validity, setValidity] = useState<{ invalid: number; bySource: Record<string, number> } | null>(null);
  const limit = 50;

  const load = async (nextStart: number) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.books.getDictionaryWords({
        language,
        filter: filter as any,
        validity_source: validitySource || undefined,
        q: q || undefined,
        start: nextStart,
        limit,
      });
      if (!r.success || !r.data) throw new Error(r.error || 'Failed to load words');
      setItems(Array.isArray(r.data.items) ? r.data.items : []);
      setTotal(Number(r.data.total) || 0);
      setStart(nextStart);
      setExpandedIdx(null);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || 'Failed to load words');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, filter, q, reloadKey]);

  // Load the validity breakdown alongside the invalid listing so the user can
  // see how many words each cause (region-redirect / bing-assist) invalidated.
  useEffect(() => {
    if (filter !== 'invalid') {
      setValidity(null);
      return;
    }
    let alive = true;
    api.books
      .getValiditySummary({ language })
      .then((r) => {
        if (alive && r.success && r.data) {
          setValidity({ invalid: r.data.invalid, bySource: r.data.invalid_by_source || {} });
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, filter, reloadKey]);

  const from = total === 0 ? 0 : start + 1;
  const to = start + items.length;
  const hasPrev = start > 0;
  const hasNext = start + limit < total;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {filter === 'invalid' && validity && (
        <div className="flex flex-wrap items-center gap-2 mb-2 text-[11px]">
          <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <CircleAlert className="w-3.5 h-3.5 text-rose-500" />
            Invalid total:
            <b className="text-slate-700 dark:text-slate-200">{validity.invalid.toLocaleString()}</b>
          </span>
          {Object.entries(validity.bySource).map(([src, n]) => (
            <button
              key={src}
              type="button"
              onClick={() => setWordsValiditySource((cur) => (cur === src ? '' : src))}
              title={`Filter by ${src}`}
              className={`px-2 py-0.5 rounded-full border transition-colors ${
                validitySource === src
                  ? 'bg-rose-600 text-white border-rose-600'
                  : 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/50'
              }`}
            >
              {src}: {n.toLocaleString()}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg">
        {loading ? (
          <LoadingBlock label="Loading..." className="py-12" />
        ) : error ? (
          <AlertBox variant="error" className="m-3">{error}</AlertBox>
        ) : items.length === 0 ? (
          <EmptyState message="No words found." className="py-12" />
        ) : (
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-2 py-2 font-semibold text-slate-600 dark:text-slate-300 w-8" />
                <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 w-14">#</th>
                {columns.map((col) => (
                  <th key={col.key} className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">{col.header}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((row, idx) => {
                const abs = start + idx + 1;
                const isExpanded = expandedIdx === idx;
                const toggle = () => setExpandedIdx((cur) => (cur === idx ? null : idx));
                return (
                  <React.Fragment key={idx}>
                    <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer" onClick={toggle}>
                      <td className="px-2 py-2 text-slate-400">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggle(); }}
                          className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          aria-label={isExpanded ? 'Collapse detail' : 'Expand detail'}
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400 font-mono">{abs}</td>
                      {columns.map((col) => (
                        <td key={col.key} className={`px-3 py-2 text-slate-700 dark:text-slate-300 ${col.className || ''}`}>
                          {col.render ? col.render(row, abs) : String(row[col.key] ?? '')}
                        </td>
                      ))}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                        <td colSpan={columns.length + 2} className="px-4 py-3">
                          {renderWordDetail({ ...row, language })}
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
      <div className="flex items-center justify-between gap-3 text-xs pt-2">
        <span className="text-slate-500 dark:text-slate-400">
          Showing {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrev || loading}
            onClick={() => load(Math.max(0, start - limit))}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={!hasNext || loading}
            onClick={() => load(start + limit)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default InlineWordsList;
