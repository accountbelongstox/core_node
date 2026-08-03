/**
 * useWfNewPracticePager — the practice-pack paged word loader, porting the legacy
 * dict-client's per_words window + "both buffers drained -> next page" auto-advance
 * to the wordnew stack.
 *
 * Given a group id it fetches ONE page at a time through
 * wfNewApi.getGroupWordsPage(gid, page, wmPerPage, true) — which reads the Default
 * Vocabulary Group's words from group_word_progress (the words getVocabulary /
 * query_gwords misses, the "blank arena" bug). Each page is ordered
 * least-recently-read via wfNewStudyProgress (best-effort enriched once per gid
 * from the backend progress blob), so the auto-play recites new/overdue words
 * first. When the recite loop wraps past the end of the current page the pager
 * advances to the next page (prefetched at the half-page mark) and swaps its
 * words in, so playback flows continuously across the whole group.
 *
 * FALLBACK: a legacy group whose words live in gwords (not the progress map)
 * comes back with total === 0 — the pager then falls back to
 * wfNewApi.getVocabulary(gid) so those packs still load (single page, no paging).
 *
 * The hook owns loading only; the caller owns the recite controller and wires the
 * controller's onActive to notifyActive (prefetch + advance) and reads `words`.
 *
 * READING CYCLE (daily plan, design: daily reading loop): dailyGoal is only the
 * plan shown in the stats bar — the queue is NOT capped by it. With
 * `unreadOnly` the pager walks ALL unread words page by page; the learner
 * simply keeps reading past the daily goal. When the whole group has been read
 * once, the BACKEND resets the group to unread in a fresh shuffled order
 * (review order untouched — see AppQyV1GroupWordProgressModel::
 * resetReadCycleWhenAllRead) and paging continues into the new cycle.
 *
 * LOCAL CACHE + AUDIO PRELOAD (see cache/WfNewAudioCache.ts header): every
 * fetched page's words (translations included) are cached locally, so an
 * offline reload falls back to the cache; and every shown page PRELOADS its
 * audio plus the hidden NEXT page's audio into the device cache (up to 20 GB
 * on the Capacitor APP build) — "next page" displays instantly and playback
 * never waits on a download.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { wfNewApi } from '../api';
import type { Word } from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { wordNewProgressCenter } from '../services';
import { wfNewStudyProgress } from '../components/study/WfNewStudyProgress';
import { getCachedWords, putCachedWords } from '../runtime-store/WfNewContentCache';
import { collectAudioUrls, preloadAudio } from '../runtime-store/WfNewAudioCache';

export interface WfNewPracticePager {
  /** The current page's words, ordered least-recently-read. */
  words: Word[];
  /** 1-based current page. */
  page: number;
  /** Total pages (ceil(total / perPage); 1 for a legacy single-page group). */
  totalPages: number;
  /** Grand total words across all pages. */
  total: number;
  /** A page fetch is in flight. */
  loading: boolean;
  /** True when the group fell back to the legacy single-page getVocabulary path. */
  legacy: boolean;
  /** More pages remain after the current one. */
  hasMore: boolean;
  /** Called from the recite controller's onActive: prefetches at the half-page
   *  mark and advances to the next page when the loop wraps past the end. */
  notifyActive: (index: number) => void;
  /** Manually load the next page window from word 0; no-op on the last page or a
   *  legacy single-page group. The caller resets the recite index. */
  nextPage: () => void;
  /** Manually load the previous page window from word 0; no-op on page 1 or a
   *  legacy group. */
  prevPage: () => void;
  /** Manually jump to a specific 1-based page (clamped to 1..totalPages), loading
   *  its window from word 0; no-op on a legacy group. */
  goToPage: (p: number) => void;
}

const clampPerPage = (): number => {
  const raw = Number(wfNewSettings.get('wmPerPage'));
  const n = Number.isFinite(raw) ? Math.round(raw) : 100;
  return Math.min(100, Math.max(1, n));
};

const pagesFor = (total: number, perPage: number): number =>
  Math.max(1, Math.ceil((total > 0 ? total : 0) / Math.max(1, perPage)));

/**
 * @param gid    the group to page through (null/empty clears the pager)
 * @param active whether the practice surface is live (paused → no loading)
 */
export function useWfNewPracticePager(
  gid: string | null | undefined,
  active: boolean,
  opts?: { unreadOnly?: boolean; limit?: number },
): WfNewPracticePager {
  const [words, setWords] = useState<Word[]>([]);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [legacy, setLegacy] = useState<boolean>(false);

  // Live mirrors so the notifyActive callback (driven by the async recite loop)
  // always reads current values without re-subscribing.
  const gidRef = useRef<string>('');
  const wordsRef = useRef<Word[]>([]);
  const pageRef = useRef<number>(1);
  const totalRef = useRef<number>(0);
  const legacyRef = useRef<boolean>(false);
  const prevIndexRef = useRef<number>(0);
  const advancingRef = useRef<boolean>(false);
  // Monotonic request id — a response for a superseded gid/page is dropped.
  const reqIdRef = useRef<number>(0);
  // page -> ordered words prefetched ahead of the advance (empty array = in flight).
  const prefetchRef = useRef<Map<number, Word[]>>(new Map());
  // gids already enriched from the backend progress blob (once per gid).
  const enrichedRef = useRef<Set<string>>(new Set());
  // Live mirror of opts (unreadOnly/limit) so fetchPageWords reads the current
  // values without re-subscribing. Set on every render (cheap).
  const optsRef = useRef(opts);
  optsRef.current = opts;

  /** Fetch one raw page (words + total), with the legacy getVocabulary fallback. */
  const fetchPageWords = useCallback(
    async (p: number): Promise<{ words: Word[]; total: number; legacy: boolean }> => {
      const g = gidRef.current;
      if (!g) return { words: [], total: 0, legacy: false };
      const per = clampPerPage();
      try {
        const res = await wfNewApi.getGroupWordsPage(g, p, per, true, {
          unread_only: optsRef.current?.unreadOnly,
          limit: optsRef.current?.limit,
        });
        // A legacy group (words in gwords, not the progress map) reports 0 total.
        if ((res?.total ?? 0) === 0 && p === 1) {
          const legacyWords = await wfNewApi.getVocabulary(g).catch(() => [] as Word[]);
          return { words: legacyWords, total: legacyWords.length, legacy: true };
        }
        return { words: Array.isArray(res?.words) ? res.words : [], total: res?.total ?? 0, legacy: false };
      } catch {
        // Network/endpoint error on the first page → try the legacy path so a
        // reachable group still loads; deeper pages just report empty.
        if (p === 1) {
          const legacyWords = await wfNewApi.getVocabulary(g).catch(() => [] as Word[]);
          return { words: legacyWords, total: legacyWords.length, legacy: true };
        }
        return { words: [], total: totalRef.current, legacy: legacyRef.current };
      }
    },
    [],
  );

  /** Load page 1 for the current gid (best-effort progress enrichment first). */
  const loadFirst = useCallback(async () => {
    const g = gidRef.current;
    if (!g) return;
    const reqId = ++reqIdRef.current;
    setLoading(true);
    // Enrich local study progress from the backend blob ONCE per gid so the
    // least-recently-read ordering is meaningful for a logged-in user. Runs in
    // parallel with the first page fetch — both must land before we order.
    const enrich = (async () => {
      if (!wfNewApi.isAuthenticated() || enrichedRef.current.has(g)) return;
      enrichedRef.current.add(g);
      try {
        wfNewStudyProgress.ingestBlob(g, await wordNewProgressCenter.getBlob(g));
      } catch {
        /* offline / unauthenticated — local progress still orders the page */
      }
    })();
    const [, fetched] = await Promise.all([enrich, fetchPageWords(1)]);
    let raw = fetched;
    if (raw.words.length === 0) {
      // Offline / empty response — fall back to the locally cached words
      // (translations included) so the shelf still renders and plays.
      try {
        const cached = await getCachedWords(g);
        if (cached && cached.length) {
          raw = { words: cached, total: cached.length, legacy: true };
        }
      } catch {
        /* the words cache is best-effort */
      }
    }
    if (reqId !== reqIdRef.current) return; // superseded
    const ordered = wfNewStudyProgress.orderByLeastRecent(g, raw.words);
    wordsRef.current = ordered;
    pageRef.current = 1;
    totalRef.current = raw.total;
    legacyRef.current = raw.legacy;
    prevIndexRef.current = 0;
    prefetchRef.current.clear();
    setWords(ordered);
    setPage(1);
    setTotal(raw.total);
    setLegacy(raw.legacy);
    setLoading(false);
    // Cache this page's words (translations included) locally and PRELOAD its
    // audio into the device cache — playback must never wait on a download.
    void putCachedWords(g, ordered);
    preloadAudio(collectAudioUrls(ordered));
  }, [fetchPageWords]);

  // Reset + (re)load whenever the group or active flag changes.
  useEffect(() => {
    const g = gid || '';
    gidRef.current = g;
    prevIndexRef.current = 0;
    advancingRef.current = false;
    if (g && active) {
      void loadFirst();
    } else {
      reqIdRef.current++; // drop any in-flight response
      wordsRef.current = [];
      pageRef.current = 1;
      totalRef.current = 0;
      legacyRef.current = false;
      prefetchRef.current.clear();
      setWords([]);
      setPage(1);
      setTotal(0);
      setLegacy(false);
      setLoading(false);
    }
  }, [gid, active, loadFirst]);

  /** Prefetch the next page into the buffer (no UI change) — half-page trigger. */
  const prefetchNext = useCallback(async () => {
    const g = gidRef.current;
    if (!g || legacyRef.current) return;
    const next = pageRef.current + 1;
    if (next > pagesFor(totalRef.current, clampPerPage())) return;
    if (prefetchRef.current.has(next)) return; // already buffered / in flight
    prefetchRef.current.set(next, []); // reserve
    const raw = await fetchPageWords(next);
    if (gidRef.current !== g) return; // gid changed — drop
    const ordered = wfNewStudyProgress.orderByLeastRecent(g, raw.words);
    prefetchRef.current.set(next, ordered);
    // The next page is HIDDEN but its audio is already downloading — pressing
    // "next page" swaps in instantly and every clip plays from the cache.
    preloadAudio(collectAudioUrls(ordered));
  }, [fetchPageWords]);

  /** Swap in the next page (consuming the prefetch buffer when present). */
  const advance = useCallback(async () => {
    const g = gidRef.current;
    if (!g || legacyRef.current || advancingRef.current) return;
    const next = pageRef.current + 1;
    if (next > pagesFor(totalRef.current, clampPerPage())) return; // last page → keep looping
    advancingRef.current = true;
    try {
      let ordered: Word[] | undefined = prefetchRef.current.get(next);
      if (!ordered || ordered.length === 0) {
        const raw = await fetchPageWords(next);
        if (gidRef.current !== g) return;
        ordered = wfNewStudyProgress.orderByLeastRecent(g, raw.words);
      }
      if (!ordered || !ordered.length) return; // nothing to advance to
      wordsRef.current = ordered;
      pageRef.current = next;
      prevIndexRef.current = 0;
      prefetchRef.current.clear();
      setWords(ordered);
      setPage(next);
      // Covers the no-prefetch path (prefetch hits are already preloaded and
      // dedup makes this a no-op).
      preloadAudio(collectAudioUrls(ordered));
    } finally {
      advancingRef.current = false;
    }
  }, [fetchPageWords]);

  /** Manual page jump — load an arbitrary page window from word 0 (the caller
   *  resets the recite index). Mirrors advance(): consumes the prefetch buffer
   *  when it holds the target, clamps to 1..totalPages, no-ops on a legacy group
   *  and guards concurrent swaps via advancingRef. */
  const goToPage = useCallback(
    (p: number) => {
      void (async () => {
        const g = gidRef.current;
        if (!g || legacyRef.current || advancingRef.current) return;
        const maxPage = pagesFor(totalRef.current, clampPerPage());
        const target = Math.min(maxPage, Math.max(1, Math.round(p)));
        if (target === pageRef.current) return; // already there
        advancingRef.current = true;
        try {
          let ordered: Word[] | undefined = prefetchRef.current.get(target);
          if (!ordered || ordered.length === 0) {
            const raw = await fetchPageWords(target);
            if (gidRef.current !== g) return; // gid changed — drop
            ordered = wfNewStudyProgress.orderByLeastRecent(g, raw.words);
          }
          if (!ordered || !ordered.length) return; // nothing to swap to
          wordsRef.current = ordered;
          pageRef.current = target;
          prevIndexRef.current = 0;
          prefetchRef.current.clear();
          setWords(ordered);
          setPage(target);
          // Same no-prefetch cover as advance(); deduped when preloaded.
          preloadAudio(collectAudioUrls(ordered));
        } finally {
          advancingRef.current = false;
        }
      })();
    },
    [fetchPageWords],
  );

  const nextPage = useCallback(() => goToPage(pageRef.current + 1), [goToPage]);
  const prevPage = useCallback(() => goToPage(pageRef.current - 1), [goToPage]);

  // Driven by the recite controller's onActive. Prefetches at the half-page mark
  // and advances when the loop WRAPS past the end (last index -> 0), mirroring the
  // legacy playAudio buffer-drain hand-off. Advancing on the wrap (not on the last
  // index) keeps the swap on a clean word-0 boundary regardless of a short final
  // page.
  const notifyActive = useCallback(
    (index: number) => {
      const len = wordsRef.current.length;
      if (len === 0) {
        prevIndexRef.current = index;
        return;
      }
      const hasMore = !legacyRef.current && pageRef.current < pagesFor(totalRef.current, clampPerPage());
      if (hasMore && index >= Math.floor(len / 2)) void prefetchNext();
      const wrapped = prevIndexRef.current >= len - 1 && index === 0;
      prevIndexRef.current = index;
      if (hasMore && wrapped) void advance();
    },
    [prefetchNext, advance],
  );

  return {
    words,
    page,
    totalPages: pagesFor(total, clampPerPage()),
    total,
    loading,
    legacy,
    hasMore: !legacy && page < pagesFor(total, clampPerPage()),
    notifyActive,
    nextPage,
    prevPage,
    goToPage,
  };
}
