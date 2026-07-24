/**
 * WfNewHomeContent — the home "content hub" dashboard: a responsive KPI strip
 * (one stat tile per category) over per-category sections.
 *
 * Layout per category:
 *   - word  → horizontal scroll-snap rail (compact preview).
 *   - book / subtitle / library → a RESPONSIVE AUTO-FILL MASONRY grid (no swipe):
 *     cards flow into as many columns as fit and wrap into rows; the home caps the
 *     preview at 2 ROWS (WFNEW_HOME_ROWS), auto-loads more as you scroll, and shows
 *     a "Load more" + page indicator at the bottom. "Load more" is cache-first: it
 *     first reveals already-loaded rows (local) and only fetches the next page once
 *     they run out (onNeedMore). A "More →" link by each title opens the full list
 *     page (all items, paginated) — wired by WfNewApp via onMore(kind).
 *   - 'document' (我的文档) is NOT shown in this hub (API method left intact).
 *
 * Pure presentation: data + navigation come from props; WfNewApp owns the fetch.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Layers, BookOpen, Clapperboard, Library, ArrowRight, ChevronDown } from 'lucide-react';
import { ElementTheme } from '../WfNewTypes';
import type { WfNewContentGroup, WfNewContentKind, WfNewHomeContent as WfNewHomeContentData } from '../api';
import { WfNewContentGroupCard, WFNEW_KIND_STYLES } from './WfNewContentGroupCard';
import { WfNewContentGrid, WFNEW_GRID_COLS_CLASS } from './WfNewContentGrid';
import { WfNewLoadingDots } from './WfNewLoadingDots';
import { useWfNewGridCols, WFNEW_HOME_ROWS } from '../api';
import { pycoreApi } from '../../../core/api-libs/pycore';

interface WfNewHomeContentProps {
  content: WfNewHomeContentData;
  loading: boolean;
  theme: ElementTheme;
  trans: (key: string, replacements?: Record<string, string | number>) => string;
  /** Open a group (routing decided by WfNewApp per kind). */
  onOpen: (group: WfNewContentGroup) => void;
  /** Open the full list page for a category (all items, paginated). */
  onMore: (kind: WfNewContentKind) => void;
  /**
   * Fragment "load more" for a grid kind: invoked by HomeGridSection ONLY once
   * the already-loaded/cached rows are exhausted (revealing cached rows is local,
   * no network). The parent fetches the next API page, MERGES it into the cache
   * (skipping ids already present) and appends to `content[key]` — which flows
   * back as more `groups`. Resolves to `true` when more may remain, `false` at
   * the end. Optional: when absent, the section just reveals what it already has.
   */
  onNeedMore?: (kind: WfNewContentKind) => Promise<boolean>;
  /** Add a vocabulary library to the default study group (library kind only). */
  onAddToStudy?: (group: WfNewContentGroup) => void;
  /**
   * The pinned Default Vocabulary Group (built by WfNewHomeTab from the live
   * word groups). Rendered ONCE as the FIRST card of the WORD GROUPS rail —
   * with the live stats cover (see WfNewContentGroupCard's isDefaultWordGroup)
   * — ahead of any word groups the user added; deduped by id when the backend
   * list already contains it.
   */
  defaultWordGroup?: WfNewContentGroup;
}

const SECTIONS: Array<{
  kind: WfNewContentKind;
  key: keyof WfNewHomeContentData;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { kind: 'word', key: 'words', Icon: Layers },
  { kind: 'book', key: 'books', Icon: BookOpen },
  { kind: 'subtitle', key: 'subtitles', Icon: Clapperboard },
  { kind: 'library', key: 'libraries', Icon: Library },
  // 'document' (我的文档) intentionally NOT shown in the hub. The API method
  // getDocumentGroups + the `documents` field on WfNewHomeContent stay intact.
];

/** Categories rendered as the responsive masonry grid (rest stay scroll rails). */
const GRID_KINDS = new Set<WfNewContentKind>(['book', 'subtitle', 'library']);

const sectionId = (kind: WfNewContentKind) => `wfnew-sec-${kind}`;

/**
 * One masonry grid section with a 2-row cap (WFNEW_HOME_ROWS), scroll auto-load +
 * Load more. "Load more" is cache-first: it FIRST reveals more already-loaded rows
 * (local, no network), and only fetches the next API page (via onNeedMore) once the
 * loaded list is exhausted. Items beyond the visible window stay loaded/cached, so
 * shrinking the width (fewer cols → fewer visible) keeps everything in memory and a
 * later "Load more" reveals them without re-fetching.
 */
const HomeGridSection: React.FC<{
  kind: WfNewContentKind;
  groups: WfNewContentGroup[];
  theme: ElementTheme;
  trans: WfNewHomeContentProps['trans'];
  onOpen: WfNewHomeContentProps['onOpen'];
  onNeedMore?: WfNewHomeContentProps['onNeedMore'];
  onAddToStudy?: WfNewHomeContentProps['onAddToStudy'];
}> = ({ kind, groups, theme, trans, onOpen, onNeedMore, onAddToStudy }) => {
  // ONE shared, resize-aware column count (api/WfNewGrid) — same value for every
  // page and the data layer, so "rows" are identical at a given width everywhere.
  const cols = useWfNewGridCols();
  const [visibleRows, setVisibleRows] = useState(WFNEW_HOME_ROWS);
  const [fetching, setFetching] = useState(false);
  // Set once the server reports it has no further pages — stops fetch attempts
  // (we still reveal any remaining locally-loaded rows).
  const [serverExhausted, setServerExhausted] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // A stable identity for the `groups` prop: a background full-refresh
  // (loadHomeContent) REPLACES the array with a fresh first page, which must
  // reset the load-more state — otherwise `serverExhausted` stays true from the
  // previous list and load-more goes dormant until the component remounts.
  // Keyed on length + first/last id so a pure append (load-more) does NOT reset,
  // but a replaced/refreshed list does.
  const groupsKey = `${groups.length}|${groups[0]?.id ?? ''}|${groups[groups.length - 1]?.id ?? ''}`;
  const prevKeyRef = useRef(groupsKey);
  useEffect(() => {
    // Only reset on a genuine REPLACE, not a load-more append. A load-more grows
    // the length and changes only the LAST id (the first id stays); detect a
    // replace as "the first id changed OR the list shrank".
    if (prevKeyRef.current !== groupsKey) {
      const prevFirstId = prevKeyRef.current.split('|')[1] ?? '';
      const prevLen = Number(prevKeyRef.current.split('|')[0] ?? 0);
      const firstChanged = (groups[0]?.id ?? '') !== prevFirstId;
      const shrank = groups.length < prevLen;
      if (firstChanged || shrank) {
        setServerExhausted(false);
        setVisibleRows(WFNEW_HOME_ROWS);
      }
      prevKeyRef.current = groupsKey;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupsKey]);

  const colCount = Math.max(cols, 1);
  const visibleCount = colCount * visibleRows;
  const shown = useMemo(() => groups.slice(0, visibleCount), [groups, visibleCount]);
  // More to REVEAL from the already-loaded list (pure local reveal — no network).
  const hasLocalMore = groups.length > shown.length;
  // More to FETCH from the server: loaded list fully revealed but server not done.
  const canFetchMore = !hasLocalMore && !serverExhausted && !!onNeedMore;
  const hasMore = hasLocalMore || canFetchMore;
  const totalRows = Math.ceil(groups.length / colCount);
  const shownRows = Math.min(visibleRows, totalRows);

  // Reveal the next chunk: bump visible rows; if that outruns the loaded list and a
  // fragment fetcher exists, pull the next API page (which appends to `groups`).
  const revealMore = async (rows: number) => {
    setVisibleRows((r) => r + rows);
    if (hasLocalMore || !onNeedMore || serverExhausted || fetching) return;
    setFetching(true);
    try {
      const more = await onNeedMore(kind);
      if (!more) setServerExhausted(true);
    } finally {
      setFetching(false);
    }
  };

  // Auto-load on scroll: reveal more rows when the sentinel enters the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void revealMore(2);
    }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, hasLocalMore, serverExhausted, fetching]);

  return (
    <>
      <WfNewContentGrid groups={shown} theme={theme} trans={trans} onOpen={onOpen} onAddToStudy={onAddToStudy} />
      {/* Auto-load sentinel + manual Load more + page indicator. */}
      {hasMore && (
        <div ref={sentinelRef} className="flex flex-col items-center gap-2 pt-1">
          <button
            type="button"
            disabled={fetching}
            onClick={() => void revealMore(WFNEW_HOME_ROWS)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-bold border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 transition disabled:opacity-50"
          >
            <ChevronDown className="w-3.5 h-3.5" /> {trans('content.loadMore')}
          </button>
          <span className="text-[10px] font-mono text-zinc-500">
            {trans('content.rowsOf', { shown: shownRows, total: totalRows })}
          </span>
        </div>
      )}
    </>
  );
};

export const WfNewHomeContent: React.FC<WfNewHomeContentProps> = ({
  content,
  loading,
  theme,
  trans,
  onOpen,
  onMore,
  onNeedMore,
  onAddToStudy,
  defaultWordGroup,
}) => {
  const imagePriorityRef = useRef(new Set<string>());

  useEffect(() => {
    const coverIds: number[] = [];
    const posterItems: Array<{ media_type: 'book' | 'subtitle'; id: number }> = [];
    for (const group of content.libraries) {
      const id = Number(group.id);
      const key = `library:${id}`;
      if (!group.imageUrl && id > 0 && !imagePriorityRef.current.has(key)) {
        imagePriorityRef.current.add(key);
        coverIds.push(id);
      }
    }
    for (const group of [...content.books, ...content.subtitles]) {
      const id = Number(group.id);
      const mediaType = group.kind === 'subtitle' ? 'subtitle' : 'book';
      const key = `${mediaType}:${id}`;
      if (!group.imageUrl && id > 0 && !imagePriorityRef.current.has(key)) {
        imagePriorityRef.current.add(key);
        posterItems.push({ media_type: mediaType, id });
      }
    }
    if (coverIds.length > 0) void pycoreApi.prioritizeCovers(coverIds).catch(() => undefined);
    if (posterItems.length > 0) void pycoreApi.prioritizePosters(posterItems).catch(() => undefined);
  }, [content.books, content.libraries, content.subtitles]);

  const scrollToSection = (kind: WfNewContentKind) => {
    if (typeof document === 'undefined') return;
    document.getElementById(sectionId(kind))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-5 pt-4">
      {/* Hub header */}
      <div className="px-1">
        <h3 className="text-sm font-black font-mono uppercase tracking-widest text-zinc-400">
          {trans('home.hubTitle')}
        </h3>
        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{trans('home.hubDesc')}</p>
      </div>

      {/* KPI strip — responsive: 2-col (phone) → 3 → 5 (desktop) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
        {SECTIONS.map(({ kind, key, Icon }) => {
          const style = WFNEW_KIND_STYLES[kind];
          const count = content[key].length;
          return (
            <button
              key={kind}
              onClick={() => scrollToSection(kind)}
              className={`text-left p-3 sm:p-3.5 rounded-2xl transition-all active:scale-[0.98] hover:-translate-y-0.5 ${theme.cardClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`p-1.5 rounded-lg ${style.chip}`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                {loading ? (
                  <WfNewLoadingDots className={style.accent} />
                ) : (
                  <span className={`text-lg sm:text-xl font-black font-mono leading-none ${style.accent}`}>{count}</span>
                )}
              </div>
              <p className="mt-2 text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
                {trans(`content.section.${kind}`)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Content sections, one per category */}
      {SECTIONS.map(({ kind, key, Icon }) => {
        const groups = content[key];
        // WORD GROUPS only: the pinned Default Vocabulary Group leads the rail
        // (deduped by id when the backend list already carries it); the card
        // with the matching id renders the live stats cover.
        const railGroups = kind === 'word' && defaultWordGroup
          ? [defaultWordGroup, ...groups.filter((g) => g.id !== defaultWordGroup.id)]
          : groups;
        const style = WFNEW_KIND_STYLES[kind];
        const isGrid = GRID_KINDS.has(kind);
        return (
          <section key={kind} id={sectionId(kind)} className="space-y-3 scroll-mt-4">
            {/* Section header: icon + label + count + (grid kinds) a More → link */}
            <div className="flex items-center gap-2 px-1">
              <span className={`p-1.5 rounded-lg border ${style.chip}`}>
                <Icon className="w-3.5 h-3.5" />
              </span>
              <h4 className="text-xs font-black font-mono uppercase tracking-wider text-slate-200 dark:text-slate-300">
                {trans(`content.section.${kind}`)}
              </h4>
              {!loading && (
                <span className="text-[10px] font-mono text-zinc-500">({railGroups.length})</span>
              )}
              {isGrid && !loading && groups.length > 0 && (
                <button
                  type="button"
                  onClick={() => onMore(kind)}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-400 hover:text-indigo-300 transition"
                >
                  {trans('content.more')} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Body */}
            {loading ? (
              <div className="space-y-3">
                {isGrid ? (
                  <div className={`grid ${WFNEW_GRID_COLS_CLASS} gap-3 sm:gap-4`}>
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className={`h-52 rounded-3xl animate-pulse ${theme.cardClass} opacity-50`} />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-3 sm:gap-4 overflow-hidden px-1">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className={`w-56 sm:w-60 h-52 shrink-0 rounded-3xl animate-pulse ${theme.cardClass} opacity-50`} />
                    ))}
                  </div>
                )}
                {/* "Loading…" cue centered BELOW the whole card area (not by the title). */}
                <div className="flex justify-center pt-1.5">
                  <WfNewLoadingDots label={trans('content.loading')} className={style.accent} size="md" />
                </div>
              </div>
            ) : railGroups.length === 0 ? (
              <div className="mx-1 p-4 rounded-2xl border border-dashed border-white/10 bg-white/2 text-center">
                <p className="text-[11px] font-mono text-zinc-500">{trans('content.empty')}</p>
              </div>
            ) : isGrid ? (
              <HomeGridSection kind={kind} groups={groups} theme={theme} trans={trans} onOpen={onOpen} onNeedMore={onNeedMore} onAddToStudy={kind === 'library' ? onAddToStudy : undefined} />
            ) : (
              <div className="flex gap-3 sm:gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory px-1 pb-2 -mx-1">
                {railGroups.map((g) => {
                  // WORD GROUPS layout: the pinned Default Vocabulary Group card
                  // fills the whole container; every following group card takes
                  // half the width (two per row as you scroll).
                  const isDefaultCard = kind === 'word' && g.id === defaultWordGroup?.id;
                  const widthClass =
                    kind === 'word' ? (isDefaultCard ? 'w-full shrink-0' : 'w-1/2 shrink-0') : '';
                  return (
                    <div key={`${g.kind}-${g.id}`} className={`snap-start ${widthClass}`}>
                      <WfNewContentGroupCard
                        group={g}
                        theme={theme}
                        trans={trans}
                        onClick={() => onOpen(g)}
                        fullWidth={kind === 'word'}
                        isDefaultWordGroup={isDefaultCard}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
