import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ListChecks, RefreshCw, X } from 'lucide-react';
import Portal from '../shared/Portal';
import { OVERLAY_CONTAINER, OVERLAY_Z, OVERLAY_BACKDROP } from '../../styles/overlay';

/**
 * PaginatedListModal — a generic, Portal-based drill-down list used by BOTH the
 * Books "Add source" stat tiles AND the Vocabulary page stat numbers.
 *
 * The caller supplies a `fetchPage(start, limit)` function that returns one page
 * of rows plus the grand total, and a `renderItem`/`columns` description for how
 * to render a row. The modal owns paging (Prev/Next + "showing X–Y of N") and
 * re-fetches whenever it is (re)opened or the page changes. It deliberately
 * knows nothing about the endpoint — every list (dictionary words, TTS queue
 * items, language breakdown, book words/sentences/languages) plugs in via the
 * same `fetchPage` contract.
 *
 * Overlay conventions: shared <Portal/> + OVERLAY_CONTAINER/_BACKDROP/_Z.modal
 * (never a raw `fixed inset-0 z-50`).
 */

export interface PaginatedListFetchResult<T = any> {
  items: T[];
  total: number;
  /** Optional one-line summary shown under the title (e.g. totals). */
  summary?: string;
}

export type PaginatedListFetcher<T = any> = (
  start: number,
  limit: number
) => Promise<PaginatedListFetchResult<T>>;

export interface PaginatedListColumn<T = any> {
  key: string;
  header: string;
  /** Cell renderer; falls back to String(row[key]). */
  render?: (row: T, absoluteIndex: number) => React.ReactNode;
  /** Tailwind class for the cell (alignment/width/colour). */
  className?: string;
}

interface PaginatedListModalProps<T = any> {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional fixed subtitle (the fetch `summary` is appended when present). */
  subtitle?: string;
  /** One page of rows + grand total. */
  fetchPage: PaginatedListFetcher<T>;
  /** Table columns. When omitted, `renderRow` is used for free-form rows. */
  columns?: PaginatedListColumn<T>[];
  /** Free-form single-row renderer (used when `columns` is not given). */
  renderRow?: (row: T, absoluteIndex: number) => React.ReactNode;
  /**
   * Optional per-row detail panel. When supplied (and `columns` are used), each
   * row gets a chevron toggle that expands a full-width detail panel beneath it.
   * Back-compatible: omit it and rows behave exactly as before.
   */
  renderDetail?: (row: T, absoluteIndex: number) => React.ReactNode;
  /** Optional wider modal (e.g. for rich detail panels). Defaults to max-w-2xl. */
  wide?: boolean;
  limit?: number;
  /** Re-fetch trigger key — change it to force a reload (e.g. filter changes). */
  reloadKey?: string | number;
}

function PaginatedListModal<T = any>({
  open,
  onClose,
  title,
  subtitle,
  fetchPage,
  columns,
  renderRow,
  renderDetail,
  wide = false,
  limit = 100,
  reloadKey,
}: PaginatedListModalProps<T>): React.ReactElement | null {
  const [start, setStart] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Index (within the current page) of the row whose detail panel is expanded. */
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const load = useCallback(
    async (nextStart: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPage(nextStart, limit);
        setItems(Array.isArray(res.items) ? res.items : []);
        setTotal(Number(res.total) || 0);
        setSummary(res.summary);
        setStart(nextStart);
        setExpandedIdx(null);
      } catch (e: any) {
        setItems([]);
        setError(e?.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [fetchPage, limit]
  );

  // (Re)load from the first page whenever the modal opens or the reloadKey moves.
  useEffect(() => {
    if (open) void load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, reloadKey]);

  if (!open) return null;

  const from = total === 0 ? 0 : start + 1;
  const to = start + items.length;
  const hasPrev = start > 0;
  const hasNext = start + limit < total;
  const fullSubtitle = [subtitle, summary].filter(Boolean).join(' · ');

  return (
    <Portal>
      <div className={`${OVERLAY_CONTAINER} ${OVERLAY_Z.modal} ${OVERLAY_BACKDROP}`} onClick={onClose}>
        <div
          className={`relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl ${wide ? 'max-w-4xl' : 'max-w-2xl'} w-full max-h-[85vh] flex flex-col border border-slate-200/80 dark:border-slate-700/80`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span className="truncate">{title}</span>
              </h3>
              {fullSubtitle && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{fullSubtitle}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex-shrink-0 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-slate-500 dark:text-slate-400">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-red-500 text-sm px-4 text-center">
                {error}
              </div>
            ) : items.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
                No items.
              </div>
            ) : columns && columns.length > 0 ? (
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                  <tr>
                    {renderDetail && (
                      <th className="px-2 py-2 font-semibold text-slate-600 dark:text-slate-300 w-8" />
                    )}
                    <th className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 w-14">#</th>
                    {columns.map((col) => (
                      <th key={col.key} className="px-3 py-2 font-semibold text-slate-600 dark:text-slate-300">
                        {col.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {items.map((row, idx) => {
                    const abs = start + idx + 1;
                    const isExpanded = renderDetail != null && expandedIdx === idx;
                    const toggle = () =>
                      setExpandedIdx((cur) => (cur === idx ? null : idx));
                    return (
                      <React.Fragment key={idx}>
                        <tr
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 ${renderDetail ? 'cursor-pointer' : ''}`}
                          onClick={renderDetail ? toggle : undefined}
                        >
                          {renderDetail && (
                            <td className="px-2 py-2 text-slate-400">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggle();
                                }}
                                className="rounded p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                aria-label={isExpanded ? 'Collapse detail' : 'Expand detail'}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </td>
                          )}
                          <td className="px-3 py-2 text-slate-500 dark:text-slate-400 font-mono">{abs}</td>
                          {columns.map((col) => (
                            <td
                              key={col.key}
                              className={`px-3 py-2 text-slate-700 dark:text-slate-300 ${col.className || ''}`}
                            >
                              {col.render ? col.render(row, abs) : String((row as any)[col.key] ?? '')}
                            </td>
                          ))}
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/70 dark:bg-slate-800/40">
                            <td colSpan={columns.length + 2} className="px-4 py-3">
                              {renderDetail!(row, abs)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((row, idx) => (
                  <li key={idx} className="px-4 py-2 text-xs text-slate-700 dark:text-slate-300">
                    {renderRow ? renderRow(row, start + idx + 1) : JSON.stringify(row)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Pagination footer */}
          <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs">
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
      </div>
    </Portal>
  );
}

export default PaginatedListModal;
