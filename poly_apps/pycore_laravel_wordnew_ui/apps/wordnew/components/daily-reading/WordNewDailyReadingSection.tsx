/** Daily Reading: a swipeable week date strip over a day-scoped, cursor-paged
 * article list. Each card shows a round read-check backed by Laravel (tap to
 * toggle); tapping the card opens the reader (which marks it read), the small
 * play icon starts audio, and finishing playback marks the article read. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { useDailyReadingFeed } from './useDailyReadingFeed';
import { rowDayKey } from './dailyReadingDates';
import { WordNewDailyReadingPlayerOverlay } from './WordNewDailyReadingPlayerOverlay';
import { WordNewDailyReadingDateStrip } from './WordNewDailyReadingDateStrip';
import { LARAVEL_REALTIME_EVENTS, laravelRealtime } from '../../../../core/integrations/laravel';
import { wfNewApi, type WfNewDailyReadingSelectionMode } from '../../api';
import { requestAuthLogin } from '../../../../core/auth/AuthRequestCenter';
import { dailyReadingArticleId, dailyReadingHash } from '../../routing/WordNewHashRoutes';
import { WordNewDailyReadingResourcePreview } from './WordNewDailyReadingResourcePreview';
import { WordNewDailyReadingRowItem } from './WordNewDailyReadingRowItem';
import { SelectField } from '@/shared/ui/SelectField';
import { useWfNewLoadMoreSentinel } from '../../hooks/useWfNewLoadMoreSentinel';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

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
const PAGE_SIZE = 20;
const ROUTE_PAGE_SIZE = 50;
const DEEP_LINK_LOOKUP_LIMIT = 100;
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
  return dailyReadingArticleId(window.location.hash);
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
  const feed = useDailyReadingFeed(routeMode ? ROUTE_PAGE_SIZE : PAGE_SIZE, trans('home.dailyReading.loadFailed'));
  const rows = feed.items;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState<WfNewDailyReadingSelectionMode>('latest');
  const [savedArticleId, setSavedArticleId] = useState<string | null>(null);
  const [queueingId, setQueueingId] = useState<string | null>(null);
  const mounted = useRef(true);
  const deepLinkHandled = useRef(false);
  const playerWasOpen = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const player = useDailyReadingPlayer((finished) => feed.markRead(finished.id));
  const routeArticleId = routeMode ? readDailyHashId() : null;
  const { selectDate, loadMore, refresh, patchItems, loading } = feed;

  useEffect(() => {
    onPlaybackStateChange?.({ open: player.open, playing: player.playing });
  }, [onPlaybackStateChange, player.open, player.playing]);

  useEffect(() => () => {
    onPlaybackStateChange?.({ open: false, playing: false });
  }, [onPlaybackStateChange]);

  /** Start the player and reflect the playing article in the URL hash. */
  const startPlayer = useCallback(async (startId?: string, singleArticle = false) => {
    const allRows = !startId && feed.hasMore ? await feed.loadAll() : rows;
    const playableRows = allRows.filter((row) => row.audio_ready === true && !!row.audio_url);
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
    if (onOpenPage) {
      onOpenPage(articleId);
      return;
    }
    const playbackRows = singleArticle
      ? playableRows.filter((row) => row.id === articleId)
      : allRows;
    player.start(playbackRows, articleId);
    if (routeMode && typeof window !== 'undefined') {
      window.history.replaceState(null, '', dailyReadingHash(articleId));
    }
  }, [feed, onOpenPage, player, routeMode, rows, savedArticleId, selectionMode]);

  useEffect(() => {
    if (!player.open || !player.current) return;
    setSavedArticleId(player.current.id);
    if (routeMode && typeof window !== 'undefined') {
      window.history.replaceState(
        null,
        '',
        dailyReadingHash(player.current.id),
      );
    }
  }, [player.current, player.open, routeMode]);

  // Player closed -> return to the Daily Reading list route.
  useEffect(() => {
    if (player.open) {
      playerWasOpen.current = true;
      return;
    }
    if (!playerWasOpen.current || !routeMode || typeof window === 'undefined') return;
    playerWasOpen.current = false;
    if (/^#\/daily-reading\//.test(window.location.hash)) {
      window.history.replaceState(null, '', dailyReadingHash());
    }
  }, [player.open, routeMode]);

  // Deep link: #/daily-reading/<articleId> starts once its article is known.
  // The article may sit on another day, so the legacy newest-first list is the fallback lookup.
  useEffect(() => {
    if (deepLinkHandled.current || loading) return;
    const id = readDailyHashId();
    if (!id) return;
    deepLinkHandled.current = true;
    const start = (target: DailyReadingRow) => {
      if (target.audio_ready) {
        player.start([target], target.id);
      } else {
        const day = rowDayKey(target.reading_date, target.created_at);
        if (day) selectDate(day);
        setExpandedId(target.id);
      }
    };
    const local = rows.find((row) => row.id === id);
    if (local) {
      start(local);
      return;
    }
    void fetchDailyReadings(DEEP_LINK_LOOKUP_LIMIT, 0).then((page) => {
      const target = page.items.find((row) => row.id === id);
      if (target && mounted.current) start(target);
    }).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, player, rows]);

  const changeSelectionMode = useCallback((next: WfNewDailyReadingSelectionMode) => {
    setSelectionMode(next);
    if (wfNewApi.isAuthenticated()) {
      void wfNewApi.saveDailyReadingProgress(savedArticleId, next).then((progress) => {
        if (progress && mounted.current) setSavedArticleId(progress.articleId);
      });
    }
  }, [savedArticleId]);

  const queueAudio = useCallback(async (row: DailyReadingRow) => {
    if (!row.audio_url || row.audio_ready) return;
    if (!wfNewApi.isAuthenticated()) {
      requestAuthLogin({ source: 'wordnew-daily-reading', reason: 'audio-request' });
      return;
    }
    setQueueingId(row.id);
    try {
      await requestDailyReadingAudio(row);
      await refresh(true);
    } finally {
      if (mounted.current) setQueueingId(null);
    }
  }, [refresh]);

  useEffect(() => {
    mounted.current = true;
    if (wfNewApi.isAuthenticated()) {
      void wfNewApi.getDailyReadingProgress().then((progress) => {
        if (!progress || !mounted.current) return;
        setSavedArticleId(progress.articleId);
        setSelectionMode(progress.selectionMode);
      });
    }
    const id = setInterval(() => void refresh(true), POLL_MS);
    const onArticlePublished = () => void refresh(true);
    const unsubscribePublished = laravelRealtime.subscribe(
      LARAVEL_REALTIME_EVENTS.articlePublished,
      onArticlePublished,
    );
    const unsubscribeAudio = laravelRealtime.subscribe(
      LARAVEL_REALTIME_EVENTS.articleAudioReady,
      (payload) => {
        patchItems((row) => applyDailyReadingAudioReady(row, payload));
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
  }, [patchItems, refresh]);

  const openBook = useCallback((sourceKey: string, title: string) => {
    feed.markRead(sourceKey);
    onOpenBook(sourceKey, title);
  }, [feed, onOpenBook]);

  const pullRefresh = usePullToRefresh(listRef, () => refresh(true), !player.open);
  useWfNewLoadMoreSentinel(sentinelRef, feed.hasMore && !feed.loadingMore && !loading, () => void loadMore(), rows.length);

  const dayCount = feed.calendar[feed.selectedDate];
  const readCount = useMemo(() => rows.filter((row) => row.read === true).length, [rows]);
  const playableCount = rows.filter((row) => row.audio_ready === true && !!row.audio_url).length;
  const multiSentenceCount = rows.filter((row) => row.audio_generation_type === 'multi_sentence').length;
  const statisticPills = [
    { key: 'articles', labelKey: 'home.dailyReading.articleCount', count: feed.total, className: 'border-white/5 bg-white/[0.03]' },
    { key: 'read', labelKey: 'home.dailyReading.readArticlesCount', count: dayCount?.read ?? readCount, className: 'border-emerald-500/15 bg-emerald-500/5 text-emerald-400/80' },
    { key: 'playable', labelKey: 'home.dailyReading.playableCount', count: playableCount, className: 'border-emerald-500/15 bg-emerald-500/5 text-emerald-400/80' },
    { key: 'multi', labelKey: 'home.dailyReading.multiSentenceCount', count: multiSentenceCount, className: 'border-emerald-500/15 bg-emerald-500/5 text-emerald-400/80' },
    { key: 'legacy', labelKey: 'home.dailyReading.legacyAudioCount', count: Math.max(0, rows.length - multiSentenceCount), className: 'border-amber-500/15 bg-amber-500/5 text-amber-400/80' },
  ];
  const selectedLabel = feed.selectedDate === feed.todayKey
    ? trans('home.dailyReading.today')
    : new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
      .format(new Date(`${feed.selectedDate}T12:00:00`));

  if (player.open) {
    return <WordNewDailyReadingPlayerOverlay player={player} trans={trans} onGoHome={onGoHome} />;
  }

  const refreshButtonClass = `inline-flex items-center gap-2 px-3 py-2 rounded-xl border ${theme.borderClass} text-xs font-bold ${theme.textSecondaryClass} transition-colors`;

  return (
    <section className={`${theme.cardClass} border border-white/5 ${routeMode
      ? 'min-h-[calc(100vh-10rem)] rounded-[2rem] p-5 sm:p-8 flex flex-col gap-6 overflow-hidden'
      : 'rounded-3xl p-4 space-y-4'}`}>
      <div className={routeMode
        ? 'relative rounded-3xl border border-indigo-500/15 bg-gradient-to-br from-indigo-500/10 via-slate-950/40 to-fuchsia-500/5 p-5 sm:p-7 space-y-5 overflow-hidden'
        : 'flex items-center justify-between gap-3'}>
        <div className={routeMode ? 'flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5' : 'contents'}>
          <div className="min-w-0">
            <h2 className={`${routeMode ? 'text-xl sm:text-2xl' : 'text-sm font-mono uppercase tracking-widest'} font-black ${theme.accentText} flex items-center gap-2`}>
              <Newspaper className={routeMode ? 'w-6 h-6' : 'w-4 h-4'} />
              {trans('home.dailyReading.title')}
            </h2>
            {routeMode && (
              <p className={`text-sm max-w-2xl ${theme.textSecondaryClass} mt-1`}>
                {trans('home.dailyReading.subtitle')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {routeArticleId && (
              <WordNewDailyReadingResourcePreview
                articleId={routeArticleId}
                settings={player}
                trans={trans}
              />
            )}
            <button
              type="button"
              onClick={() => void refresh(false)}
              className={routeMode ? refreshButtonClass : `rounded-full p-2 ${theme.textSecondaryClass}`}
              title={trans('home.dailyReading.refresh')}
              aria-label={trans('home.dailyReading.refresh')}
            >
              <RefreshCw className={`w-4 h-4 ${loading || pullRefresh.refreshing ? 'animate-spin' : ''}`} />
              {routeMode && trans('home.dailyReading.refresh')}
            </button>
            {routeMode && onGoHome && (
              <button
                type="button"
                onClick={onGoHome}
                className={refreshButtonClass}
                title={trans('home.dailyReading.backHome')}
              >
                <Home className="w-4 h-4" />
                {trans('home.dailyReading.backHome')}
              </button>
            )}
          </div>
        </div>

        {routeMode && (
          <SelectField
            variant="compact"
            label={trans('home.dailyReading.startMode')}
            value={selectionMode}
            onChange={changeSelectionMode}
            options={SELECTION_MODE_OPTIONS.map((option) => ({ value: option.value, label: trans(option.labelKey) }))}
          />
        )}

        {routeMode && (
          <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            {statisticPills.map((pill) => (
              <span key={pill.key} className={`rounded-full border px-3 py-1.5 ${pill.className}`}>
                {trans(pill.labelKey, { count: pill.count })}
              </span>
            ))}
          </div>
        )}
      </div>

      <WordNewDailyReadingDateStrip
        theme={theme}
        trans={trans}
        selectedDate={feed.selectedDate}
        todayKey={feed.todayKey}
        calendar={feed.calendar}
        onSelect={selectDate}
        onVisibleWeek={feed.ensureWeek}
      />

      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className={`truncate text-sm font-bold ${theme.textPrimaryClass}`}>{selectedLabel}</div>
          <div className={`text-[10px] ${theme.textSecondaryClass}`}>
            {trans('home.dailyReading.dayProgress', { read: dayCount?.read ?? readCount, total: dayCount?.total ?? feed.total })}
          </div>
        </div>
        {playableCount > 0 && (
          <button
            type="button"
            onClick={() => void startPlayer()}
            className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-to-tr from-indigo-500 to-fuchsia-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-md shadow-indigo-500/20 transition-transform active:scale-95"
            title={trans('home.dailyReading.playAll')}
          >
            <ListMusic className="h-3.5 w-3.5" />
            {trans('home.dailyReading.playAll')}
          </button>
        )}
      </div>

      <div ref={listRef} className="min-w-0 flex-1">
        <div
          className={`flex items-center justify-center gap-2 overflow-hidden text-[11px] ${theme.textSecondaryClass} transition-[height] ${pullRefresh.pull > 0 || pullRefresh.refreshing ? '' : 'h-0'}`}
          style={pullRefresh.pull > 0 || pullRefresh.refreshing ? { height: pullRefresh.refreshing ? 32 : pullRefresh.pull } : undefined}
        >
          {pullRefresh.refreshing && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pullRefresh.refreshing
            ? trans('home.dailyReading.refreshing')
            : pullRefresh.pull > 0
              ? trans(pullRefresh.ready ? 'home.dailyReading.releaseToRefresh' : 'home.dailyReading.pullToRefresh')
              : null}
        </div>
        {rows.length === 0 ? (
          <p className={`py-6 text-center text-xs ${feed.error ? 'text-rose-400' : theme.textSecondaryClass}`}>
            {loading ? '…' : feed.error || trans('home.dailyReading.emptyDay')}
          </p>
        ) : (
          <>
            <ul className={routeMode ? 'grid min-w-0 w-full auto-rows-min gap-2 xl:grid-cols-2' : 'space-y-1.5'}>
              {rows.map((row) => (
                <WordNewDailyReadingRowItem
                  key={row.id}
                  row={row}
                  theme={theme}
                  routeMode={routeMode}
                  expanded={expandedId === row.id}
                  queueing={queueingId === row.id}
                  player={player}
                  trans={trans}
                  onToggleExpand={() => setExpandedId(expandedId === row.id ? null : row.id)}
                  onToggleRead={() => void feed.setRead(row.id, row.read !== true)}
                  onPlay={() => void startPlayer(row.id, true)}
                  onQueueAudio={() => void queueAudio(row)}
                  onOpenBook={openBook}
                />
              ))}
            </ul>
            <div ref={sentinelRef} className="h-px" />
            {feed.hasMore ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={feed.loadingMore}
                className={`mx-auto mt-3 inline-flex items-center gap-2 rounded-xl border ${theme.borderClass} px-4 py-2 text-xs font-bold ${theme.textSecondaryClass} disabled:opacity-50`}
              >
                {feed.loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {trans(feed.loadingMore ? 'home.dailyReading.loadingMore' : 'home.dailyReading.loadMore')}
              </button>
            ) : (
              <p className={`mt-3 text-center text-[11px] ${theme.textSecondaryClass} opacity-60`}>
                {trans('home.dailyReading.allLoaded')}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
};
