/* [v4.1-Iris] Media Library — PUBLIC browse page for the synced books &
 * subtitles (Wave-2 of the media redesign; 2026-06-12 backend contract).
 * Deliberately NO login gate: the PUBLIC /media list endpoints work
 * anonymously and degrade to an empty page inside the API layer, so this page
 * always renders (browse → inline empty state on failure). Type pills
 * (Books / Subtitles) + language filter pills (same pattern as
 * WfLearnLibraryPage), load-more pagination over the MediaBrowseController
 * paginator envelope {items, total, per_page, current_page, last_page}.
 * Card tap → 'library/media_detail'; the "+" button is the only
 * auth-gated action (useWfProtectedAction → WfAddToLibrarySheet).
 *
 * Legacy entry: the home cards link to 'library/media?type=…&id=…' — when both
 * params are present this page immediately forwards to the detail route. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, Captions, Plus, Volume2 } from 'lucide-react';
import { wordflowApi, resolveWfPosterUrl } from '../../../core/api-libs/wordflow/WordflowApi';
import type {
  WfBookSummary,
  WfSubtitleSummary,
} from '../../../core/api-libs/wordflow/WordflowApi';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { BackButton, Badge, Button, EmptyState, LoadingState, Spinner } from '../WfUI';
import { wfLibraryCenter } from '../services/WfLibraryCenter';
import { useWfProtectedAction } from '../hooks/useWfProtectedAction';
import WfAddToLibrarySheet, {
  type WfAddToLibraryContent,
} from '../components/WfAddToLibrarySheet';
import { CoverThumb, libGradient } from './WfLearnLibraryPage';

type MediaKind = 'book' | 'subtitle';

const PAGE_SIZE = 20;

// Same language filter set as WfLearnLibraryPage ('' = all languages).
const LANG_PILLS: { id: string; label: string }[] = [
  { id: '', label: 'All Languages' },
  { id: 'en', label: 'English' },
  { id: 'zh', label: 'Chinese' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'ja', label: 'Japanese' },
];

/** List-row shape normalized across the two summary types. */
interface MediaListItem {
  kind: MediaKind;
  id: number;
  sourceKey: string;
  title: string;
  language: string;
  sentenceCount: number;
  segmentCount: number | null;
  durationSec: number | null;
  hasAudio: boolean;
  syncedAt: string | null;
  // Movie/TV poster (MOVIE_POSTER_PIPELINE.md): resolved loadable URL + status.
  imageUrl: string | null;
  posterStatus: string | null;
}

const fromBook = (b: WfBookSummary): MediaListItem => ({
  kind: 'book',
  id: b.id,
  sourceKey: b.source_key,
  title: b.title,
  language: b.language,
  sentenceCount: b.sentence_count,
  segmentCount: null,
  durationSec: null,
  hasAudio: !!b.has_audio,
  syncedAt: b.synced_at,
  imageUrl: resolveWfPosterUrl(b.image_url),
  posterStatus: b.poster_status ?? null,
});

const fromSubtitle = (s: WfSubtitleSummary): MediaListItem => ({
  kind: 'subtitle',
  id: s.id,
  sourceKey: s.source_key,
  title: s.title,
  language: s.language,
  sentenceCount: s.sentence_count,
  segmentCount: s.segment_count,
  durationSec: s.duration_sec,
  hasAudio: false,
  syncedAt: s.synced_at,
  imageUrl: resolveWfPosterUrl(s.image_url),
  posterStatus: s.poster_status ?? null,
});

/** Seconds → m:ss (h:mm:ss past the hour). */
export const formatMediaClock = (sec: number): string => {
  const total = Math.max(0, Math.floor(sec));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const WfMediaLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfApp();
  const [searchParams] = useSearchParams();
  const { runProtected, loginConfirmSheet } = useWfProtectedAction();

  // Legacy home-card deep link: 'library/media?type=…&id=…' → detail route.
  const typeParam = searchParams.get('type');
  const idParam = searchParams.get('id');
  const isDeepLink = (typeParam === 'book' || typeParam === 'subtitle') && !!idParam;
  useEffect(() => {
    if (isDeepLink) {
      navigate(
        wfPath(`library/media_detail?type=${typeParam}&id=${encodeURIComponent(idParam!)}`),
        { replace: true }
      );
    }
  }, [isDeepLink, typeParam, idParam, navigate]);

  const [activeKind, setActiveKind] = useState<MediaKind>('book');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [items, setItems] = useState<MediaListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [addSheetContent, setAddSheetContent] = useState<WfAddToLibraryContent | null>(null);
  // Per-row poster-retry in flight, keyed by `${kind}-${id}`.
  const [retryingPosters, setRetryingPosters] = useState<Set<string>>(new Set());
  // Cancellation-safe loads: only the latest sequence may commit state.
  const seqRef = useRef(0);

  /** Fetch one paginator page (1-based; append=true keeps earlier pages). */
  const loadPage = useCallback(
    async (kind: MediaKind, language: string, page: number, append: boolean) => {
      const seq = ++seqRef.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const params = {
          ...(language ? { language } : {}),
          page,
          perPage: PAGE_SIZE,
        };
        // Both list calls degrade to an empty page inside the API layer.
        let pageItems: MediaListItem[] = [];
        let pageTotal = 0;
        let pageCurrent = page;
        let pageLast = 1;
        if (kind === 'book') {
          const res = await wfLibraryCenter.getBooks(params);
          pageItems = (res.books || []).map(fromBook);
          pageTotal = res.total || 0;
          pageCurrent = res.current_page || page;
          pageLast = res.last_page || 1;
        } else {
          const res = await wfLibraryCenter.getSubtitles(params);
          pageItems = (res.subtitles || []).map(fromSubtitle);
          pageTotal = res.total || 0;
          pageCurrent = res.current_page || page;
          pageLast = res.last_page || 1;
        }
        if (seq !== seqRef.current) return;
        setTotal(pageTotal);
        setCurrentPage(pageCurrent);
        setLastPage(pageLast);
        setItems((prev) => (append ? [...prev, ...pageItems] : pageItems));
      } catch (error) {
        if (seq !== seqRef.current) return;
        console.error('[WfMediaLibrary] Failed to load public media:', error);
        if (!append) {
          setItems([]);
          setTotal(0);
          setCurrentPage(1);
          setLastPage(1);
        }
      } finally {
        if (seq === seqRef.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    []
  );

  // (Re)load from page 1 on every filter change; cancel in-flight on unmount.
  useEffect(() => {
    if (isDeepLink) return;
    loadPage(activeKind, selectedLanguage, 1, false);
    return () => {
      seqRef.current++;
    };
  }, [isDeepLink, activeKind, selectedLanguage, loadPage]);

  // On-demand poster fetch for one row, then reload the current page so the new
  // poster_status/image_url is reflected. Non-blocking and self-guarded.
  // Declared before the deep-link early return to keep hook order stable.
  const handleRetryPoster = useCallback(
    async (item: MediaListItem) => {
      const key = `${item.kind}-${item.id}`;
      setRetryingPosters((prev) => { const n = new Set(prev); n.add(key); return n; });
      try {
        await wordflowApi.retryPoster(item.kind, { id: item.id });
        await loadPage(activeKind, selectedLanguage, 1, false);
      } catch (error) {
        console.error('[WfMediaLibrary] Poster retry failed:', error);
      } finally {
        setRetryingPosters((prev) => { const n = new Set(prev); n.delete(key); return n; });
      }
    },
    [activeKind, selectedLanguage, loadPage]
  );

  // While forwarding a deep link, render nothing (no browse-UI flash).
  if (isDeepLink) return null;

  const hasMore = currentPage < lastPage && items.length < total;

  const openDetail = (item: MediaListItem) => {
    navigate(wfPath(`library/media_detail?type=${item.kind}&id=${encodeURIComponent(String(item.id))}`));
  };

  const kindTabs: { id: MediaKind; label: string }[] = [
    { id: 'book', label: t('media.books') || 'Books' },
    { id: 'subtitle', label: t('media.subtitles') || 'Subtitles' },
  ];

  return (
    <div className="ds-page route-fade flex flex-col pt-12 pb-24 min-h-screen bg-transparent">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <BackButton onClick={() => navigate(-1)} label={t('common.back') || 'Back'} />
        <div className="flex-1 min-w-0">
          <h1 className="ds-section-title !text-2xl truncate">
            {t('media.browseTitle') || 'Books & Subtitles'}
          </h1>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-0.5 truncate">
            {t('media.browseHint') || 'Browse public books and subtitles'}
          </p>
        </div>
      </div>

      {/* Type tabs — Iris pill segment */}
      <div className="ds-pill-nav mb-4" role="tablist" aria-label={t('media.browseTitle') || 'Content type'}>
        {kindTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeKind === tab.id}
            onClick={() => setActiveKind(tab.id)}
            className={`ds-pill-chip ${activeKind === tab.id ? 'is-active' : ''}`}
          >
            {tab.id === 'book' ? <BookOpen className="w-4 h-4" aria-hidden /> : <Captions className="w-4 h-4" aria-hidden />}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Language filter — Iris pill category menu */}
      <div className="ds-pill-nav flex-wrap mb-5" role="tablist" aria-label="Language">
        {LANG_PILLS.map((p) => (
          <button
            key={p.id || 'all'}
            type="button"
            role="tab"
            aria-selected={selectedLanguage === p.id}
            onClick={() => setSelectedLanguage(p.id)}
            className={`ds-pill-chip ${selectedLanguage === p.id ? 'is-active' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Card list */}
      <div className="flex-1 ds-stack ds-stack-tight">
        {loading ? (
          <LoadingState label={t('common.loading') || 'Loading…'} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={activeKind === 'book' ? <BookOpen strokeWidth={1.5} /> : <Captions strokeWidth={1.5} />}
            title={t('media.empty') || 'No public content yet'}
            description={t('media.emptyHint') || 'Books and subtitles will appear here once synced'}
          />
        ) : (
          <>
            {items.map((item) => (
              <div
                key={`${item.kind}-${item.id}`}
                onClick={() => openDetail(item)}
                className="ds-card rounded-[var(--radius-card)] p-4 flex items-center gap-3 cursor-pointer group hover:ring-2 transition-all"
                style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
              >
                {/* Movie/TV poster thumbnail — reuses CoverThumb's
                    ready/pending/failed lifecycle over a gradient fallback. */}
                <div
                  className="ds-cover w-12 h-[4.5rem] rounded-xl overflow-hidden shadow-inner border border-white/40 flex-shrink-0"
                  style={{ backgroundImage: libGradient(item.title) }}
                >
                  <CoverThumb
                    src={item.imageUrl}
                    alt={item.title}
                    status={item.posterStatus}
                    retrying={retryingPosters.has(`${item.kind}-${item.id}`)}
                    onRetry={() => handleRetryPoster(item)}
                    labels={{
                      generating: t('media.posterGenerating') || 'Fetching poster…',
                      failed: t('media.posterFailed') || 'No poster',
                      retry: t('media.posterRetry') || 'Retry',
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {item.language && <Badge tone="klein">{item.language.toUpperCase()}</Badge>}
                    <span className="text-xs text-[var(--color-text-tertiary)]">
                      {item.sentenceCount} {t('media.sentences') || 'sentences'}
                      {item.segmentCount != null && (
                        <> &bull; {item.segmentCount} {t('media.segments') || 'segments'}</>
                      )}
                      {item.durationSec != null && item.durationSec > 0 && (
                        <> &bull; {formatMediaClock(item.durationSec)}</>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-secondary)]">
                    {item.hasAudio && (
                      <span className="inline-flex items-center gap-1 text-[var(--klein-blue)] font-semibold">
                        <Volume2 className="w-3.5 h-3.5" aria-hidden />
                        {t('media.hasAudio') || 'Audio'}
                      </span>
                    )}
                    {item.syncedAt && (
                      <span>
                        {t('media.synced') || 'Synced'}: {new Date(item.syncedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                {/* Add to learning library — the only auth-gated action here */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    runProtected(() =>
                      setAddSheetContent({ kind: item.kind, sourceKey: item.sourceKey, title: item.title })
                    );
                  }}
                  className="ds-glass ds-glass-edge w-9 h-9 rounded-full shadow-md flex items-center justify-center text-[color:var(--klein-blue)] hover:bg-[color:var(--klein-blue)] hover:text-[color:var(--klein-on)] transition-all active:scale-95 flex-shrink-0"
                  title={t('media.addToLibrary') || 'Add to library'}
                  aria-label={t('media.addToLibrary') || 'Add to library'}
                >
                  <Plus className="w-4 h-4" aria-hidden />
                </button>
              </div>
            ))}

            {/* Load more — paginator semantics (page / per_page / last_page) */}
            {hasMore && (
              <Button
                variant="secondary"
                disabled={loadingMore}
                onClick={() => loadPage(activeKind, selectedLanguage, currentPage + 1, true)}
              >
                {loadingMore ? (
                  <Spinner size="sm" />
                ) : (
                  <span>
                    {t('media.loadMore') || 'Load more'} ({items.length} / {total})
                  </span>
                )}
              </Button>
            )}
          </>
        )}
      </div>

      <WfAddToLibrarySheet
        open={!!addSheetContent}
        content={addSheetContent}
        onClose={() => setAddSheetContent(null)}
      />
      {loginConfirmSheet}
    </div>
  );
};

export default WfMediaLibraryPage;
