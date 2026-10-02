/** Daily Reading article list and routed player page. Lists the latest reading
 * articles (title_en + title_cn + date); clicking a row expands the reading
 * text inline (article_en with reference_cn). A Play button (header = play
 * all, per row = start from that article) opens the article route; the book
 * button opens the read-along reader. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { WordNewDailyReadingPlayerOverlay } from './WordNewDailyReadingPlayerOverlay';
import { LARAVEL_REALTIME_EVENTS, laravelRealtime } from '../../../../core/integrations/laravel';
import { wfNewApi, type WfNewDailyReadingSelectionMode } from '../../api';
import { requestAuthLogin } from '../../../../core/auth/AuthRequestCenter';
import { dailyReadingArticleId, dailyReadingHash } from '../../routing/WordNewHashRoutes';
import { WordNewDailyReadingResourcePreview } from './WordNewDailyReadingResourcePreview';
import { WordNewDailyReadingRowItem } from './WordNewDailyReadingRowItem';
import { SelectField } from '@/shared/ui/SelectField';

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
  const playerWasOpen = useRef(false);
  const player = useDailyReadingPlayer();
  const routeArticleId = routeMode ? readDailyHashId() : null;

  useEffect(() => {
    onPlaybackStateChange?.({ open: player.open, playing: player.playing });
  }, [onPlaybackStateChange, player.open, player.playing]);

  useEffect(() => () => {
    onPlaybackStateChange?.({ open: false, playing: false });
  }, [onPlaybackStateChange]);

  /** Start the player and reflect the playing article in the URL hash. */
  const startPlayer = useCallback((startId?: string, singleArticle = false) => {
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
    if (onOpenPage) {
      onOpenPage(articleId);
      return;
    }
    const playbackRows = singleArticle
      ? playableRows.filter((row) => row.id === articleId)
      : rows;
    player.start(playbackRows, articleId);
    if (routeMode && typeof window !== 'undefined') {
      window.history.replaceState(null, '', dailyReadingHash(articleId));
    }
  }, [onOpenPage, player, routeMode, rows, savedArticleId, selectionMode]);

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

  // Deep link: #/daily-reading/<articleId> auto-starts once rows arrive.
  useEffect(() => {
    if (deepLinkHandled.current || rows.length === 0) return;
    const id = readDailyHashId();
    if (!id) return;
    const target = rows.find((row) => row.id === id);
    if (!target) return;
    deepLinkHandled.current = true;
    if (target.audio_ready) {
      player.start([target], target.id);
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
  const statisticPills = [
    { key: 'articles', labelKey: 'home.dailyReading.articleCount', count: totalRows, className: 'border-white/5 bg-white/[0.03]' },
    { key: 'playable', labelKey: 'home.dailyReading.playableCount', count: playableCount, className: 'border-emerald-500/15 bg-emerald-500/5 text-emerald-400/80' },
    { key: 'multi', labelKey: 'home.dailyReading.multiSentenceCount', count: statistics.multiSentence, className: 'border-emerald-500/15 bg-emerald-500/5 text-emerald-400/80' },
    { key: 'legacy', labelKey: 'home.dailyReading.legacyAudioCount', count: statistics.legacyAudio, className: 'border-amber-500/15 bg-amber-500/5 text-amber-400/80' },
    { key: 'rebuilt', labelKey: 'home.dailyReading.rebuiltCount', count: statistics.rebuilt, className: 'border-sky-500/15 bg-sky-500/5 text-sky-400/80' },
    ...(statistics.historicalDuplicates > 0
      ? [{ key: 'archived', labelKey: 'home.dailyReading.archivedDuplicateCount', count: statistics.historicalDuplicates, className: 'border-zinc-500/15 bg-zinc-500/5 text-zinc-400/80' }]
      : []),
  ];

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
            {routeArticleId && (
              <WordNewDailyReadingResourcePreview
                articleId={routeArticleId}
                settings={player}
                trans={trans}
              />
            )}
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

      {rows.length === 0 ? (
        <p className={`text-xs ${error ? 'text-rose-400' : 'text-zinc-500'}`}>
          {loading ? '…' : error || trans('home.dailyReading.empty')}
        </p>
      ) : (
        <>
          <ul className={routeMode ? 'grid min-w-0 w-full flex-1 auto-rows-min gap-4 xl:grid-cols-2' : 'space-y-3 max-h-[420px] overflow-y-auto pr-1'}>
          {rows.map((row) => (
            <WordNewDailyReadingRowItem
              key={row.id}
              row={row}
              routeMode={routeMode}
              expanded={expandedId === row.id}
              queueing={queueingId === row.id}
              player={player}
              trans={trans}
              onToggleExpand={() => setExpandedId(expandedId === row.id ? null : row.id)}
              onPlay={() => startPlayer(row.id, true)}
              onQueueAudio={() => void queueAudio(row)}
              onOpenBook={onOpenBook}
            />
          ))}
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
