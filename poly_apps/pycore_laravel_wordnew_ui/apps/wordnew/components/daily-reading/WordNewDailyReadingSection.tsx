/** Daily Reading article list and routed player page. Lists the latest reading
 * articles (title_en + title_cn + date); clicking a row expands the reading
 * text inline (article_en with reference_cn). A Play button (header = play
 * all, per row = start from that article) opens the article route; the book
 * button opens the read-along reader. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Headphones,
  Home,
  ListMusic,
  Loader2,
  Newspaper,
  RefreshCw,
} from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import {
  applyDailyReadingAudioReady,
  fetchDailyReadings,
  requestDailyReadingAudio,
  type DailyReadingRow,
} from './dailyReadingApi';
import { useDailyReadingPlayer } from './useDailyReadingPlayer';
import { WordNewDailyReadingPlayerOverlay } from './WordNewDailyReadingPlayerOverlay';
import { LARAVEL_REALTIME_EVENTS, laravelRealtime } from '../../../../core/integrations/laravel';
import { wfNewApi, type WfNewDailyReadingSelectionMode } from '../../api';
import { requestAuthLogin } from '../../../../core/auth/AuthRequestCenter';

interface Props {
  theme: ElementTheme;
  trans: (k: string, r?: Record<string, string | number>) => string;
  onOpenBook: (sourceKey: string, title: string) => void;
  routeMode?: boolean;
  /** Navigate back to the wordnew home tab from the routed player page. */
  onGoHome?: () => void;
  /** Open the dedicated player page when this section is used as a home preview. */
  onOpenPage?: (articleId: string) => void;
  onPlaybackStateChange?: (state: { open: boolean; playing: boolean }) => void;
}

const POLL_MS = 12_000;
const PAGE_SIZE = 100;
const SELECTION_MODE_OPTIONS: Array<{
  value: WfNewDailyReadingSelectionMode;
  labelKey: string;
}> = [
  {
    value: 'latest',
    labelKey: 'home.dailyReading.startLatest',
  },
  {
    value: 'resume',
    labelKey: 'home.dailyReading.startResume',
  },
  {
    value: 'random',
    labelKey: 'home.dailyReading.startRandom',
  },
];

/** Article id carried by a #/daily-reading/<articleId> deep link. */
function readDailyHashId(): string | null {
  if (typeof window === 'undefined') return null;
  const match = window.location.hash.match(/^#\/daily-reading\/([^?]+)$/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export const WordNewDailyReadingSection: React.FC<Props> = ({
  theme,
  trans,
  onOpenBook,
  routeMode = false,
  onGoHome,
  onOpenPage,
  onPlaybackStateChange,
}) => {
  const [rows, setRows] = useState<DailyReadingRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [statistics, setStatistics] = useState({
    total: 0,
    rawTotal: 0,
    historicalDuplicates: 0,
    multiSentence: 0,
    legacyAudio: 0,
    rebuilt: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<WfNewDailyReadingSelectionMode>('latest');
  const [savedArticleId, setSavedArticleId] = useState<string | null>(null);
  const [queueingId, setQueueingId] = useState<string | null>(null);
  const mounted = useRef(true);
  const deepLinkHandled = useRef(false);
  const player = useDailyReadingPlayer();

  useEffect(() => {
    onPlaybackStateChange?.({ open: player.open, playing: player.playing });
  }, [onPlaybackStateChange, player.open, player.playing]);

  useEffect(() => () => {
    onPlaybackStateChange?.({ open: false, playing: false });
  }, [onPlaybackStateChange]);

  /** Start the player and reflect the playing article in the URL hash. */
  const startPlayer = useCallback((startId?: string) => {
    const playableRows = rows.filter((row) => row.audio_ready === true && !!row.audio_url);
    let articleId = startId;
    if (!articleId && selectionMode === 'resume') {
      articleId = playableRows.find((row) => row.id === savedArticleId)?.id;
    }
    if (!articleId && selectionMode === 'random' && playableRows.length > 0) {
      articleId = playableRows[Math.floor(Math.random() * playableRows.length)]?.id;
    }
    articleId ??= playableRows[0]?.id;
    if (!articleId) return;
    setSavedArticleId(articleId);
    if (wfNewApi.isAuthenticated()) {
      void wfNewApi.saveDailyReadingProgress(articleId, selectionMode).then((progress) => {
        if (progress && mounted.current) setSavedArticleId(progress.articleId);
      });
    }
    if (onOpenPage) {
      onOpenPage(articleId);
      return;
    }
    player.start(rows, articleId);
    if (routeMode && typeof window !== 'undefined') {
      window.history.replaceState(null, '', `#/daily-reading/${encodeURIComponent(articleId)}`);
    }
  }, [onOpenPage, player, routeMode, rows, savedArticleId, selectionMode]);

  // Player closed -> return to the Daily Reading list route.
  useEffect(() => {
    if (player.open || !routeMode || typeof window === 'undefined') return;
    if (/^#\/daily-reading\//.test(window.location.hash)) {
      window.history.replaceState(null, '', '#/daily-reading');
    }
  }, [player.open, routeMode]);

  // Deep link: #/daily-reading/<articleId> auto-starts once rows arrive.
  useEffect(() => {
    if (deepLinkHandled.current || rows.length === 0) return;
    const id = readDailyHashId();
    if (!id) return;
    const target = rows.find((row) => row.id === id);
    if (!target) return;
    deepLinkHandled.current = true;
    if (target.audio_ready) {
      player.start(rows, target.id);
    } else {
      setExpandedId(target.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player, rows]);

  const changeSelectionMode = useCallback((next: WfNewDailyReadingSelectionMode) => {
    setSelectionMode(next);
    if (wfNewApi.isAuthenticated()) {
      void wfNewApi.saveDailyReadingProgress(savedArticleId, next).then((progress) => {
        if (progress && mounted.current) setSavedArticleId(progress.articleId);
      });
    }
  }, [savedArticleId]);

  const load = useCallback(async (silent = false) => {
    const firstPageSize = routeMode ? PAGE_SIZE : 20;
    if (!silent) setLoading(true);
    try {
      const page = await fetchDailyReadings(firstPageSize, 0);
      if (mounted.current) {
        setRows((current) => {
          if (!silent) return page.items;
          const freshIds = new Set(page.items.map((item) => item.id));
          const merged = [
            ...page.items,
            ...current.filter((item) => !freshIds.has(item.id)),
          ];
          return merged.slice(0, Math.max(page.items.length, page.total));
        });
        setTotalRows(page.total);
        setStatistics(page.statistics);
        setError(null);
      }
      if (!silent && routeMode) {
        let offset = page.items.length;
        while (mounted.current && offset < page.total) {
          const nextPage = await fetchDailyReadings(PAGE_SIZE, offset);
          if (nextPage.items.length === 0) break;
          setRows((current) => {
            const currentIds = new Set(current.map((item) => item.id));
            return [...current, ...nextPage.items.filter((item) => !currentIds.has(item.id))];
          });
          setTotalRows(nextPage.total);
          setStatistics(nextPage.statistics);
          offset += nextPage.items.length;
        }
      }
    } catch (loadError) {
      if (mounted.current) {
        setError(loadError instanceof Error ? loadError.message : trans('home.dailyReading.loadFailed'));
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [routeMode, trans]);

  const loadMore = useCallback(async () => {
    if (loadingMore || rows.length >= totalRows) return;
    setLoadingMore(true);
    try {
      const page = await fetchDailyReadings(PAGE_SIZE, rows.length);
      if (mounted.current) {
        setRows((current) => {
          const currentIds = new Set(current.map((item) => item.id));
          return [...current, ...page.items.filter((item) => !currentIds.has(item.id))];
        });
        setTotalRows(page.total);
        setStatistics(page.statistics);
      }
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }, [loadingMore, rows.length, totalRows]);

  const queueAudio = useCallback(async (row: DailyReadingRow) => {
    if (!row.audio_url || row.audio_ready) return;
    if (!wfNewApi.isAuthenticated()) {
      requestAuthLogin({ source: 'wordnew-daily-reading', reason: 'audio-request' });
      return;
    }
    setQueueingId(row.id);
    try {
      await requestDailyReadingAudio(row);
      await load(true);
    } finally {
      if (mounted.current) setQueueingId(null);
    }
  }, [load]);

  useEffect(() => {
    mounted.current = true;
    load(false);
    if (wfNewApi.isAuthenticated()) {
      void wfNewApi.getDailyReadingProgress().then((progress) => {
        if (!progress || !mounted.current) return;
        setSavedArticleId(progress.articleId);
        setSelectionMode(progress.selectionMode);
      });
    }
    const id = setInterval(() => load(true), POLL_MS);
    const onArticlePublished = () => load(true);
    const unsubscribePublished = laravelRealtime.subscribe(
      LARAVEL_REALTIME_EVENTS.articlePublished,
      onArticlePublished,
    );
    const unsubscribeAudio = laravelRealtime.subscribe(
      LARAVEL_REALTIME_EVENTS.articleAudioReady,
      (payload) => {
        setRows((current) => current.map((row) => applyDailyReadingAudioReady(row, payload)));
      },
    );
    laravelRealtime.start();
    return () => {
      mounted.current = false;
      clearInterval(id);
      unsubscribePublished();
      unsubscribeAudio();
      laravelRealtime.stop();
    };
  }, [load]);

  const playableCount = rows.filter((row) => row.audio_ready === true && !!row.audio_url).length;

  if (player.open) {
    return <WordNewDailyReadingPlayerOverlay player={player} trans={trans} onGoHome={onGoHome} />;
  }

  return (
    <section className={`${theme.cardClass} border border-white/5 ${routeMode
      ? 'min-h-[calc(100vh-10rem)] rounded-[2rem] p-5 sm:p-8 flex flex-col gap-6 overflow-hidden'
      : 'rounded-3xl p-5 space-y-4'}`}>
      <div className={routeMode
        ? 'relative rounded-3xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/10 via-slate-950/40 to-fuchsia-500/5 p-5 sm:p-7 space-y-5 overflow-hidden'
        : 'flex items-center justify-between gap-3'}>
        <div className={routeMode ? 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5' : 'contents'}>
          <div>
            <h2 className={`${routeMode ? 'text-xl sm:text-2xl' : 'text-sm font-mono uppercase tracking-widest'} font-black text-indigo-400 flex items-center gap-2`}>
              <Newspaper className={routeMode ? 'w-6 h-6' : 'w-4 h-4'} />
              {trans('home.dailyReading.title')}
            </h2>
            <p className={`${routeMode ? 'text-sm max-w-2xl' : 'text-[11px]'} text-zinc-500 mt-1`}>
              {trans('home.dailyReading.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {routeMode && (
              <button
                type="button"
                onClick={() => void load(false)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-bold text-zinc-300 hover:text-indigo-300 hover:border-indigo-500/30 transition-colors"
                title={trans('home.dailyReading.refresh')}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {trans('home.dailyReading.refresh')}
              </button>
            )}
            {!routeMode && loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />}
            {routeMode && onGoHome && (
              <button
                type="button"
                onClick={onGoHome}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 text-xs font-bold text-zinc-300 hover:text-indigo-300 hover:border-indigo-500/30 transition-colors"
                title={trans('home.dailyReading.backHome')}
              >
                <Home className="w-4 h-4" />
                {trans('home.dailyReading.backHome')}
              </button>
            )}
            {playableCount > 0 && (
              <button
                type="button"
                onClick={() => startPlayer()}
                className={`${routeMode ? 'px-4 py-2 text-xs' : 'px-3 py-1.5 text-[11px]'} flex items-center gap-1.5 rounded-xl font-bold bg-gradient-to-tr from-indigo-500 to-fuchsia-500 text-white shadow-md shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-transform`}
                title={trans('home.dailyReading.playAll')}
              >
                <ListMusic className="w-4 h-4" />
                {trans('home.dailyReading.playAll')}
              </button>
            )}
          </div>
        </div>

        {routeMode && (
          <label className="flex items-center justify-between gap-3 text-[11px] text-zinc-500">
            <span>{trans('home.dailyReading.startMode')}</span>
            <select
              value={selectionMode}
              onChange={(event) => changeSelectionMode(event.target.value as WfNewDailyReadingSelectionMode)}
              className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-zinc-300"
            >
              {SELECTION_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {trans(option.labelKey)}
                </option>
              ))}
            </select>
          </label>
        )}

        {routeMode && (
          <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            <span className="rounded-full border border-white/5 bg-white/[0.03] px-3 py-1.5">
              {trans('home.dailyReading.articleCount', { count: totalRows })}
            </span>
            <span className="rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-1.5 text-emerald-400/80">
              {trans('home.dailyReading.playableCount', { count: playableCount })}
            </span>
            <span className="rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-1.5 text-emerald-400/80">
              {trans('home.dailyReading.multiSentenceCount', { count: statistics.multiSentence })}
            </span>
            <span className="rounded-full border border-amber-500/15 bg-amber-500/5 px-3 py-1.5 text-amber-400/80">
              {trans('home.dailyReading.legacyAudioCount', { count: statistics.legacyAudio })}
            </span>
            <span className="rounded-full border border-sky-500/15 bg-sky-500/5 px-3 py-1.5 text-sky-400/80">
              {trans('home.dailyReading.rebuiltCount', { count: statistics.rebuilt })}
            </span>
            {statistics.historicalDuplicates > 0 && (
              <span className="rounded-full border border-zinc-500/15 bg-zinc-500/5 px-3 py-1.5 text-zinc-400/80">
                {trans('home.dailyReading.archivedDuplicateCount', { count: statistics.historicalDuplicates })}
              </span>
            )}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className={`text-xs ${error ? 'text-rose-400' : 'text-zinc-500'}`}>
          {loading ? '…' : error || trans('home.dailyReading.empty')}
        </p>
      ) : (
        <>
          <ul className={routeMode ? 'grid flex-1 auto-rows-min gap-4 xl:grid-cols-2' : 'space-y-3 max-h-[420px] overflow-y-auto pr-1'}>
          {rows.map((row) => {
            const expanded = expandedId === row.id;
            const dateLabel = row.reading_date ?? row.created_at;
            return (
              <li
                key={row.id}
                className={`rounded-2xl border border-white/5 bg-slate-900/40 p-4 hover:border-indigo-500/30 transition-colors ${routeMode ? 'h-full' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : row.id)}
                    className="min-w-0 flex-1 text-left"
                    title={trans('home.dailyReading.toggleText')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-zinc-100 truncate">{row.title_en}</span>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${row.audio_generation_type === 'multi_sentence'
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                          : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {trans(row.audio_generation_type === 'multi_sentence'
                          ? 'home.dailyReading.multiSentenceAudio'
                          : 'home.dailyReading.legacyAudio')}
                      </span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 shrink-0 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
                      />
                    </div>
                    {row.title_cn && (
                      <div className="text-xs text-zinc-400 mt-0.5 truncate">{row.title_cn}</div>
                    )}
                    <div className="text-[10px] font-mono text-zinc-600 mt-2">
                      {row.word_count ? `${row.word_count} words · ` : ''}
                      {dateLabel ? new Date(dateLabel).toLocaleDateString() : ''}
                    </div>
                  </button>
                  <div className={`shrink-0 flex gap-2 ${routeMode ? 'flex-row flex-wrap justify-end' : 'flex-col'}`}>
                    {row.audio_url && row.audio_ready && (
                      <button
                        type="button"
                        onClick={() => startPlayer(row.id)}
                        className="inline-flex items-center gap-1.5 p-2 rounded-xl border border-white/10 text-zinc-400 hover:text-indigo-300 transition-colors"
                        title={trans('home.dailyReading.playFrom')}
                      >
                        <Headphones className="w-4 h-4" />
                        {routeMode && <span className="text-[10px] font-bold">{trans('home.dailyReading.play')}</span>}
                      </button>
                    )}
                    {row.audio_url && !row.audio_ready && (
                      <button
                        type="button"
                        onClick={() => void queueAudio(row)}
                        disabled={queueingId === row.id}
                        className="inline-flex items-center gap-1.5 p-2 rounded-xl border border-amber-500/20 text-amber-300 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                        title={trans('home.dailyReading.audioQueued')}
                      >
                        {queueingId === row.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Headphones className="w-4 h-4" />}
                        {routeMode && <span className="text-[10px] font-bold">{trans('home.dailyReading.audioPending')}</span>}
                      </button>
                    )}
                    {row.source_key && (
                      <button
                        type="button"
                        onClick={() => onOpenBook(row.source_key!, row.title_en)}
                        className="inline-flex items-center gap-1.5 p-2 rounded-xl border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                        title={trans('home.agentArticles.read')}
                      >
                        <BookOpen className="w-4 h-4" />
                        {routeMode && <span className="text-[10px] font-bold">{trans('home.agentArticles.read')}</span>}
                      </button>
                    )}
                    {routeMode && (row.article_en || row.reference_cn) && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                        className="inline-flex items-center gap-1.5 p-2 rounded-xl border border-white/10 text-zinc-400 hover:text-indigo-300 transition-colors"
                        title={trans('home.dailyReading.toggleText')}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        <span className="text-[10px] font-bold">
                          {trans(expanded ? 'home.dailyReading.hideArticle' : 'home.dailyReading.showArticle')}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
                {expanded && (row.article_en || row.reference_cn) && (
                  <div className="mt-3 space-y-3 border-t border-white/5 pt-3">
                    {row.article_en && (
                      <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                        {row.article_en}
                      </p>
                    )}
                    {row.reference_cn && (
                      <p className="text-xs text-zinc-500 leading-relaxed whitespace-pre-wrap">
                        {row.reference_cn}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          </ul>
          {routeMode && rows.length < totalRows && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="mx-auto inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-zinc-300 hover:border-indigo-500/30 hover:text-indigo-300 disabled:opacity-50"
            >
              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              {trans('home.dailyReading.loadMore')}
            </button>
          )}
        </>
      )}
    </section>
  );
};
