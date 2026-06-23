/* [v4.1-Iris] Media Detail — PUBLIC detail page for one synced book/subtitle
 * (Wave-2 of the media redesign; 2026-06-12 backend contract). Route:
 * 'library/media_detail?type=book|subtitle&id=N' (search params, consistent
 * with group_detail?gid=). NO login gate — getMediaContentDetail is a PUBLIC
 * GET; it rethrows on failure so this page surfaces a real inline error state
 * instead of fake data. Iris gradient hero info card, "Add to learning
 * library" CTA (useWfProtectedAction → WfAddToLibrarySheet), and a
 * server-paginated sentence list (start/limit, prev/next pagination card like
 * WfVocabularyLibraryDetailPage). Sentence audio resolves through
 * wfAudioCenter and only one row plays at a time. */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  Captions,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Loader2,
  Pause,
  Play,
  Plus,
} from 'lucide-react';
import {
  wordflowApi,
  resolveWfPosterUrl,
  type WfMediaContentDetail,
  type WfMediaSentence,
} from '../../../core/api-libs/wordflow/WordflowApi';
import { CoverThumb, libGradient } from './WfLearnLibraryPage';
import { notify } from '../../../core/notify/notify';
import { apiManager } from '../../../core/api-libs/wordflow/WordflowApiManager';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { Badge, Button, EmptyState, LoadingState, PageHeader } from '../WfUI';
import { wfAudioCenter } from '../services/WfAudioCenter';
import { useWfProtectedAction } from '../hooks/useWfProtectedAction';
import WfAddToLibrarySheet, {
  type WfAddToLibraryContent,
} from '../components/WfAddToLibrarySheet';
import { formatMediaClock } from './WfMediaLibraryPage';

const SENTENCES_PER_PAGE = 50;

/**
 * Resolve a sentence audio value to a playable absolute URL. Media-synced
 * sentence audio may be an absolute URL, a server-rooted static path (the
 * clips→static pipeline), or a TTS-route form — only the last one goes through
 * wfAudioCenter's TTS repair; rooted paths are joined onto the active endpoint.
 */
function resolveSentenceAudioUrl(audio: string): string {
  if (!audio) return '';
  if (audio.startsWith('http://') || audio.startsWith('https://')) return audio;
  if (audio.startsWith('/') && !audio.includes('tts/audio/')) {
    return `${apiManager.getCurrentBaseUrl()}${audio}`;
  }
  return wfAudioCenter.resolveAudioUrl(audio);
}

const WfMediaDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfApp();
  const [searchParams] = useSearchParams();
  const { runProtected, loginConfirmSheet } = useWfProtectedAction();

  const type: 'book' | 'subtitle' = searchParams.get('type') === 'subtitle' ? 'subtitle' : 'book';
  const id = searchParams.get('id') || '';

  const [detail, setDetail] = useState<WfMediaContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const [addSheetContent, setAddSheetContent] = useState<WfAddToLibraryContent | null>(null);
  // Poster on-demand fetch in flight + a bump key to force a detail reload.
  const [posterRetrying, setPosterRetrying] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // One playing row at a time — own the HTMLAudioElement so play/pause state
  // tracks reliably (wfAudioCenter resolves the URL).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingSeq, setPlayingSeq] = useState<number | null>(null);
  // Per-sentence file-first resolution state for rows whose synced `audio` is
  // not yet present: resolving spinner per seq, queued ("generating…") per seq,
  // and a resolved-url cache so a second tap plays without re-resolving.
  const [resolvingSeq, setResolvingSeq] = useState<number | null>(null);
  const [queuedSeqs, setQueuedSeqs] = useState<Set<number>>(new Set());
  const resolvedUrls = useRef<Map<number, string>>(new Map());

  // Cancellation-safe loads: only the latest sequence may commit state.
  const seqRef = useRef(0);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingSeq(null);
  }, []);

  // Reset to the first page when the target content changes.
  useEffect(() => {
    setStart(0);
  }, [type, id]);

  // Load one sentence page; getMediaContentDetail rethrows → real error state.
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setDetail(null);
      return;
    }
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await wordflowApi.getMediaContentDetail(type, id, {
          start,
          limit: SENTENCES_PER_PAGE,
        });
        if (seq !== seqRef.current) return;
        setDetail(res);
      } catch (err: any) {
        if (seq !== seqRef.current) return;
        console.error('[WfMediaDetail] Failed to load content detail:', err);
        setError(err?.message || (t('media.loadFailed') || 'Failed to load public content'));
        setDetail(null);
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    })();
    return () => {
      seqRef.current++;
    };
    // t intentionally omitted: it only shapes the fallback error message.
    // reloadKey forces a refetch after an on-demand poster fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, id, start, reloadKey]);

  // Stop playback when the page/content changes and on unmount.
  useEffect(() => stopAudio, [type, id, start, stopAudio]);

  // Drop per-sentence resolve caches when the visible page/content changes —
  // seq numbers are page-relative, so stale entries must not leak across pages.
  useEffect(() => {
    resolvedUrls.current.clear();
    setQueuedSeqs(new Set());
    setResolvingSeq(null);
  }, [type, id, start]);

  // Play one already-resolved absolute/static/TTS URL for a sentence row.
  const playResolvedUrl = (seq: number, url: string) => {
    const audio = new Audio(url);
    audioRef.current = audio;
    setPlayingSeq(seq);
    audio.onended = () => {
      audioRef.current = null;
      setPlayingSeq(null);
    };
    audio.play().catch((err) => {
      console.error('[WfMediaDetail] Sentence audio playback failed:', err);
      audioRef.current = null;
      setPlayingSeq(null);
    });
  };

  const toggleSentenceAudio = async (sentence: WfMediaSentence) => {
    if (playingSeq === sentence.seq) {
      stopAudio();
      return;
    }
    stopAudio();

    // 1) Row already carries a synced audio reference — play it directly.
    if (sentence.audio) {
      playResolvedUrl(sentence.seq, resolveSentenceAudioUrl(sentence.audio));
      return;
    }
    // 2) Already resolved once this session — reuse the cached url.
    const cached = resolvedUrls.current.get(sentence.seq);
    if (cached) {
      playResolvedUrl(sentence.seq, cached);
      return;
    }
    // 3) Resolve file-first via …/tts/sentence/audio. On a miss the server may
    //    enqueue generation — surface a "generating…" state for that row.
    if (resolvingSeq != null) return;
    setResolvingSeq(sentence.seq);
    try {
      const res = await wordflowApi.resolveSentenceAudio({
        text: sentence.text,
        language: (info?.language as string) || detail?.info.language || 'english',
      });
      if (res?.exists && res.url) {
        const url = resolveSentenceAudioUrl(res.url);
        resolvedUrls.current.set(sentence.seq, url);
        setQueuedSeqs((prev) => { const n = new Set(prev); n.delete(sentence.seq); return n; });
        playResolvedUrl(sentence.seq, url);
      } else if (res && res.exists === false) {
        if (res.queued) {
          setQueuedSeqs((prev) => new Set(prev).add(sentence.seq));
          notify.success(t('media.audioQueued') || 'Audio generation queued — try again shortly');
        } else {
          notify.error(t('media.noAudio') || 'No audio available for this sentence');
        }
      }
    } catch (err: any) {
      console.error('[WfMediaDetail] Sentence audio resolve failed:', err);
      notify.error(err?.message || t('media.audioFailed') || 'Could not resolve sentence audio');
    } finally {
      setResolvingSeq((cur) => (cur === sentence.seq ? null : cur));
    }
  };

  const info = detail?.info;
  const totalSentences = detail?.total_sentences ?? 0;
  const sentences = detail?.sentences ?? [];
  const totalPages = Math.max(1, Math.ceil(totalSentences / SENTENCES_PER_PAGE));
  const currentPage = Math.floor(start / SENTENCES_PER_PAGE) + 1;

  const typeLabel = type === 'book' ? (t('media.books') || 'Books') : (t('media.subtitles') || 'Subtitles');
  const TypeIcon = type === 'book' ? BookOpen : Captions;
  const title = info?.title || typeLabel;

  const openAddSheet = () => {
    if (!info?.source_key) return;
    runProtected(() =>
      setAddSheetContent({ kind: type, sourceKey: info.source_key, title: info.title })
    );
  };

  // On-demand movie/TV poster fetch for this item, then reload the detail so the
  // hero flips from "failed/none" toward the new poster. Non-blocking.
  const handleRetryPoster = async () => {
    if (!id || posterRetrying) return;
    setPosterRetrying(true);
    try {
      await wordflowApi.retryPoster(type, { id });
      setReloadKey((k) => k + 1);
    } catch (err) {
      console.error('[WfMediaDetail] Poster retry failed:', err);
    } finally {
      setPosterRetrying(false);
    }
  };

  const posterUrl = resolveWfPosterUrl(info?.image_url);

  return (
    <div className="min-h-screen bg-transparent pb-24">
      <PageHeader title={title} onBack={() => navigate(-1)} />

      <div className="ds-page pt-4">
        {loading ? (
          <LoadingState label={t('common.loading') || 'Loading…'} />
        ) : !id || error || !detail ? (
          <EmptyState
            icon={<TypeIcon strokeWidth={1.5} />}
            title={error || (t('media.loadFailed') || 'Failed to load public content')}
            description={t('media.emptyHint') || 'Books and subtitles will appear here once synced'}
            action={
              <Button
                variant="secondary"
                className="!w-auto px-8"
                onClick={() => navigate(wfPath('library/media'))}
              >
                {t('media.browseTitle') || 'Books & Subtitles'}
              </Button>
            }
          />
        ) : (
          <>
            {/* Iris gradient hero info card */}
            <div
              className="mb-5 rounded-[var(--radius-card)] p-6 text-[color:var(--klein-on)] relative overflow-hidden"
              style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
            >
              <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl" />
              <div className="absolute -bottom-12 -left-10 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
              <div className="relative z-10 flex items-start gap-4">
                {/* Movie/TV poster — reuses CoverThumb's ready/pending/failed
                    lifecycle over a gradient fallback (MOVIE_POSTER_PIPELINE.md). */}
                <div
                  className="ds-cover w-20 h-28 sm:w-24 sm:h-36 rounded-xl overflow-hidden shadow-lg border border-white/30 flex-shrink-0"
                  style={{ backgroundImage: libGradient(info?.title || title) }}
                >
                  <CoverThumb
                    src={posterUrl}
                    alt={info?.title || title}
                    status={info?.poster_status}
                    retrying={posterRetrying}
                    onRetry={handleRetryPoster}
                    labels={{
                      generating: t('media.posterGenerating') || 'Fetching poster…',
                      failed: t('media.posterFailed') || 'No poster',
                      retry: t('media.posterRetry') || 'Retry',
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-bold">
                    <TypeIcon className="w-3.5 h-3.5" aria-hidden />
                    {typeLabel}
                  </span>
                  {info?.language && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/20 text-xs font-bold">
                      <Globe className="w-3.5 h-3.5" aria-hidden />
                      {String(info.language).toUpperCase()}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl font-bold mb-3 line-clamp-2">{info?.title}</h2>
                <div className="flex items-center gap-4 text-sm text-white/85 flex-wrap">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-4 h-4" aria-hidden />
                    {totalSentences} {t('media.sentences') || 'sentences'}
                  </span>
                  {type === 'subtitle' && info?.segment_count != null && (
                    <span className="flex items-center gap-1">
                      <Captions className="w-4 h-4" aria-hidden />
                      {info.segment_count} {t('media.segments') || 'segments'}
                    </span>
                  )}
                  {type === 'subtitle' && info?.duration_sec != null && info.duration_sec > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" aria-hidden />
                      {formatMediaClock(info.duration_sec)}
                    </span>
                  )}
                </div>
                </div>
              </div>
            </div>

            {/* Add to learning library — the only auth-gated action here */}
            <Button variant="grad" className="mb-6" onClick={openAddSheet}>
              <Plus className="w-5 h-5" aria-hidden />
              <span>{t('media.addToLibrary') || 'Add to library'}</span>
            </Button>

            {/* Sentence list (server-paginated via start/limit) */}
            {sentences.length === 0 ? (
              <EmptyState
                icon={<TypeIcon strokeWidth={1.5} />}
                title={t('media.noSentences') || 'No sentences available'}
              />
            ) : (
              <div className="ds-stack-tight flex flex-col mb-6">
                {sentences.map((sentence) => {
                  const isPlaying = playingSeq === sentence.seq;
                  const isResolving = resolvingSeq === sentence.seq;
                  const hasTimeRange =
                    type === 'subtitle' && sentence.start_sec != null && sentence.end_sec != null;
                  return (
                    <div key={sentence.seq} className="ds-row p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-[var(--color-text-tertiary)] font-mono text-sm font-semibold min-w-[3rem] flex-shrink-0 mt-0.5">
                          {sentence.seq}.
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-2">
                            <p className="flex-1 text-[var(--color-text-primary)] font-medium leading-relaxed break-words">
                              {sentence.text}
                            </p>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {queuedSeqs.has(sentence.seq) && (
                                <span
                                  className="text-[10px] font-semibold text-[var(--klein-blue)]"
                                  title={t('media.audioGenerating') || 'Audio is being generated'}
                                >
                                  {t('media.audioGenerating') || 'generating…'}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => toggleSentenceAudio(sentence)}
                                disabled={isResolving}
                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full transition-all disabled:opacity-60 ${
                                  isPlaying
                                    ? 'bg-[var(--klein-blue)] text-[var(--klein-on)] shadow-[var(--klein-glow)]'
                                    : 'bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] hover:opacity-80'
                                }`}
                                title={
                                  sentence.audio
                                    ? (t('media.hasAudio') || 'Audio')
                                    : (t('media.resolveAudio') || 'Resolve and play audio')
                                }
                                aria-label={t('media.hasAudio') || 'Audio'}
                              >
                                {isResolving ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                                ) : isPlaying ? (
                                  <Pause className="w-3.5 h-3.5" fill="currentColor" aria-hidden />
                                ) : (
                                  <Play className="w-3.5 h-3.5" fill="currentColor" aria-hidden />
                                )}
                              </button>
                            </div>
                          </div>
                          {hasTimeRange && (
                            <div className="text-xs text-[var(--klein-blue)] mt-1.5 font-mono bg-[var(--klein-blue-soft)] inline-flex items-center gap-1 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" aria-hidden />
                              {formatMediaClock(sentence.start_sec!)} – {formatMediaClock(sentence.end_sec!)}
                            </div>
                          )}
                          {sentence.explanation && (
                            <p className="text-sm text-[var(--color-text-secondary)] mt-2 leading-relaxed">
                              {sentence.explanation}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination card (prev/next, like WfVocabularyLibraryDetailPage) */}
            {totalPages > 1 && (
              <div className="ds-card rounded-[var(--radius-card)] p-4 sticky bottom-4">
                <div className="flex items-center justify-between gap-4">
                  <Button
                    onClick={() => setStart((s) => Math.max(0, s - SENTENCES_PER_PAGE))}
                    disabled={currentPage === 1 || loading}
                    variant="secondary"
                    className="flex-1"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" aria-hidden />
                    {t('common.previous') || 'Previous'}
                  </Button>
                  <div className="text-center min-w-[100px]">
                    <div className="text-2xl font-bold text-[var(--klein-blue)]">{currentPage}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {t('common.of') || 'of'} {totalPages}
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      setStart((s) => Math.min((totalPages - 1) * SENTENCES_PER_PAGE, s + SENTENCES_PER_PAGE))
                    }
                    disabled={currentPage === totalPages || loading}
                    variant="secondary"
                    className="flex-1"
                  >
                    {t('common.next') || 'Next'}
                    <ChevronRight className="w-4 h-4 ml-1" aria-hidden />
                  </Button>
                </div>
              </div>
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

export default WfMediaDetailPage;
