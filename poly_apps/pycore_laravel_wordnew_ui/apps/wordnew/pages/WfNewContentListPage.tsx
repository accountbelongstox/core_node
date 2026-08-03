/**
 * WfNewContentListPage — the full "list" page for one home category (books /
 * subtitles / libraries). Opened from the "More →" link on the home hub.
 *
 * It OWNS its paging: instead of slicing the in-memory home fragment (which only
 * holds what the hub happened to load, silently truncating large categories), it
 * fetches each page straight from the backend via the paginated fetcher passed by
 * WfNewApp (getBookGroups / getSubtitleGroups / getLibraryGroups). The numbered
 * pager is driven by whether the last fetch returned a FULL page (a full page ⇒
 * there may be a next page). The home fragment is used only as an instant first
 * paint for page 1 before the network confirms it. Same responsive masonry look.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import type { WfNewContentGroup, WfNewContentKind } from '../api';
import { wfNewPageSize, WFNEW_LIST_ROWS } from '../api';
import { WFNEW_KIND_STYLES } from '../components/WfNewContentGroupCard';
import { WfNewContentGrid } from '../components/WfNewContentGrid';
import { WfNewLoadingDots } from '../components/WfNewLoadingDots';
import { dedupGroups } from '../runtime-store/WfNewContentCache';

interface WfNewContentListPageProps {
  kind: WfNewContentKind;
  /** Home-hub fragment for this kind — used only as an instant page-1 seed. */
  groups: WfNewContentGroup[];
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  onOpen: (g: WfNewContentGroup) => void;
  /**
   * Paginated network fetcher for this category (1-based page). Owns the real
   * data so the page is never truncated to the hub fragment. NEVER throws.
   */
  fetchPage: (page: number, perPage: number) => Promise<WfNewContentGroup[]>;
}

export const WfNewContentListPage: React.FC<WfNewContentListPageProps> = ({
  kind,
  groups,
  theme,
  trans,
  onOpen,
  fetchPage,
}) => {
  const style = WFNEW_KIND_STYLES[kind];
  // Page size = columns × 20 rows, LOCKED on first render (a ref) so the numbered
  // pager keeps a STABLE page size across fetches even if the window is resized
  // mid-session (resizing changes the grid layout but never the paging math, so
  // page N always means the same backend slice).
  const perPageRef = useRef<number>(wfNewPageSize(WFNEW_LIST_ROWS));
  const perPage = perPageRef.current;

  // 1-based page index. `items` holds the CURRENT page's groups (network-owned).
  const [page, setPage] = useState(1);
  // Dedup the page-1 seed (the hub fragment may carry backend duplicates) so the
  // list never paints a row twice before the network confirms the page.
  const [items, setItems] = useState<WfNewContentGroup[]>(dedupGroups(groups).slice(0, perPage));
  const [loading, setLoading] = useState(false);
  // The highest page we've confirmed exists (last fetch returned a full page ⇒
  // there's at least one more). Drives the numbered pager's upper bound.
  const [maxKnownPage, setMaxKnownPage] = useState(1);
  // Once a fetch returns a PARTIAL/empty page we know the true last page.
  const [lastPage, setLastPage] = useState<number | null>(null);

  // Guard against out-of-order responses (a slow page-1 landing after page-2).
  const reqIdRef = useRef(0);

  const loadPage = useCallback(async (p: number) => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    try {
      const fetched = await fetchPage(p, perPage);
      if (reqId !== reqIdRef.current) return; // a newer request superseded this one
      // Dedup what we RENDER (defense-in-depth: backend may return dup libraries),
      // but drive the "full page ⇒ maybe more" pager off the RAW fetched length —
      // that reflects the backend's actual page slice, independent of local dups.
      setItems(dedupGroups(fetched));
      if (fetched.length >= perPage) {
        // A full page → there may be more; raise the known ceiling.
        setMaxKnownPage((m) => Math.max(m, p + 1));
      } else {
        // Partial/empty page → this is the last page.
        setLastPage(p);
        setMaxKnownPage((m) => Math.max(m, p));
      }
    } catch {
      if (reqId === reqIdRef.current) setItems([]);
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [fetchPage, perPage]);

  // Fetch the current page from the network whenever it changes (or on mount).
  // Page 1 already has the hub fragment painted as a seed, so this just confirms
  // + completes it; other pages load fresh.
  useEffect(() => {
    void loadPage(page);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page, loadPage]);

  const totalPages = lastPage ?? maxKnownPage;

  const goTo = (p: number) => {
    const clamped = Math.max(1, lastPage ? Math.min(p, lastPage) : p);
    setPage(clamped);
  };

  // A small windowed range of page numbers around the current page (1-based).
  const pageWindow = useMemo(() => {
    const span = 2;
    const start = Math.max(1, Math.min(page - span, totalPages - (span * 2)));
    const end = Math.min(totalPages, start + span * 2);
    const out: number[] = [];
    for (let i = Math.max(1, start); i <= end; i += 1) out.push(i);
    return out;
  }, [page, totalPages]);

  const atLastPage = lastPage != null && page >= lastPage;

  return (
    <div className="space-y-5">
      {/* Page title lives in the global nav; only a load indicator remains here. */}
      {loading && (
        <div className="px-1">
          <WfNewLoadingDots className={style.accent} />
        </div>
      )}

      {/* Full masonry grid for the current page */}
      {items.length === 0 && !loading ? (
        <div className="mx-1 p-6 rounded-2xl border border-dashed border-white/10 bg-white/2 text-center">
          <p className="text-[12px] font-mono text-zinc-500">{trans('content.empty')}</p>
        </div>
      ) : (
        <WfNewContentGrid groups={items} theme={theme} trans={trans} onOpen={onOpen} />
      )}

      {/* Pagination — prev / windowed page numbers / next + indicator */}
      {(totalPages > 1 || page > 1) && (
        <div className="flex flex-col items-center gap-2 pt-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goTo(page - 1)}
              disabled={page <= 1 || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
            >
              <ChevronLeft className="w-3.5 h-3.5" /> {trans('content.prev')}
            </button>
            {pageWindow.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => goTo(p)}
                disabled={loading}
                className={`min-w-[2rem] px-2 py-1.5 rounded-lg text-[11px] font-mono font-bold border transition disabled:opacity-50 ${
                  p === page
                    ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300'
                }`}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => goTo(page + 1)}
              disabled={atLastPage || loading}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-40"
            >
              {trans('content.next')} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {trans('content.pageOf', { page, total: totalPages })}
          </span>
        </div>
      )}
    </div>
  );
};
