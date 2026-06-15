/* [v4.1-Iris] Learn Library — ported from qy_capacitor/pages/Learn/Library.tsx.
 * Self-contained: reads word groups via wordflowApi.getWordGroups(), filters by
 * tab (all / mine) + language pills, and navigates with wfPath(). Every API call
 * is try/caught and degrades to LoadingState/EmptyState — never crashes. Keeps
 * the faithful Iris look (design-reference-{light,dark}.webp).
 *
 * 2026-06-12: added the "Public Library" section so anonymous/new users (who
 * have no groups) see real content: PUBLIC vocabulary libraries (real ids that
 * work with /group/add_library) + public books/subtitles. The "+" on every
 * public card is auth-gated via useWfProtectedAction → WfAddToLibrarySheet.
 * Library cards are non-navigating (no public-library detail surface exists —
 * WfVocabularyLibraryDetailPage is a GROUP surface); media cards open
 * 'library/media_detail'. When both media lists are empty (media sync not run
 * yet) a compact hint row renders instead of a broken-looking empty block. */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, BookOpen, Captions, Image as ImageIcon, RefreshCw,
  Star, Briefcase, Plane, FlaskConical, GraduationCap, Library as LibraryIcon,
} from 'lucide-react';
import { Icons, Button, LoadingState, EmptyState, Badge, Spinner } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import type {
  WfPublicLibrary,
  WfBookSummary,
  WfSubtitleSummary,
} from '../../../core/api-libs/wordflow/WordflowApi';
import type { WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';
import { wfLibraryCenter } from '../services/WfLibraryCenter';
import { useWfProtectedAction } from '../hooks/useWfProtectedAction';
import WfAddToLibrarySheet, {
  type WfAddToLibraryContent,
} from '../components/WfAddToLibrarySheet';

type LibraryTab = 'all' | 'mine';

/** Deterministic vivid gradient cover from a seed (name) — gives every library
 * a distinct "图" banner even without a generated cover image. */
const seedHash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
const libGradient = (seed: string): string => {
  const a = seedHash(seed) % 360;
  const b = (a + 38) % 360;
  return `linear-gradient(135deg, hsl(${a} 72% 60%) 0%, hsl(${b} 66% 48%) 100%)`;
};
const libInitial = (name: string): string => (name || '?').trim().charAt(0).toUpperCase();
/** Coarse category icon (lucide) for the cover chip — never an emoji affordance. */
const LibGlyph: React.FC<{ lib: { type?: string; category?: string } }> = ({ lib }) => {
  const c = `${lib.category || ''} ${lib.type || ''}`.toLowerCase();
  const cls = 'w-4 h-4';
  if (c.includes('system')) return <Star className={cls} aria-hidden />;
  if (c.includes('document') || c.includes('book')) return <BookOpen className={cls} aria-hidden />;
  if (c.includes('business')) return <Briefcase className={cls} aria-hidden />;
  if (c.includes('travel')) return <Plane className={cls} aria-hidden />;
  if (c.includes('science') || c.includes('tech')) return <FlaskConical className={cls} aria-hidden />;
  if (c.includes('exam') || c.includes('test')) return <GraduationCap className={cls} aria-hidden />;
  return <LibraryIcon className={cls} aria-hidden />;
};

const LANG_PILLS: { id: string; label: string }[] = [
  { id: '', label: 'All Languages' },
  { id: 'en', label: 'English' },
  { id: 'zh', label: 'Chinese' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'ja', label: 'Japanese' },
];

/** Cover thumbnail that reflects the backend cover lifecycle, not just load
 * success: a not-yet-generated cover (pending/processing/retry) shows a shimmer
 * "generating" placeholder, a failed cover shows the book fallback plus an
 * unobtrusive retry, and a ready cover (or any image that loads) shows the
 * image. The onError→fallback stays as a final safety net for the ready-but-404
 * race. Statuses come from the API (image_url, cover_status, cover_attempts). */
const CoverThumb: React.FC<{
  src: string | null | undefined;
  alt: string;
  status?: string | null;
  attempts?: number;
  errorMessage?: string | null;
  onRetry?: () => void;
  retrying?: boolean;
  labels: {
    generating: string;
    failed: string;
    retry: string;
  };
}> = ({ src, alt, status, attempts, errorMessage, onRetry, retrying, labels }) => {
  const [failed, setFailed] = useState(false);
  // Reset the failure flag when the source changes (list re-renders).
  useEffect(() => setFailed(false), [src]);

  const normalized = (status || '').toLowerCase();
  const isReady = normalized === 'ready' || (!normalized && !!src);
  const isGenerating = normalized === 'pending' || normalized === 'processing' || normalized === 'retry';
  const isFailed = normalized === 'failed';

  // Image path: ready (or status-less but has a src), and not yet flagged 404.
  if (src && !failed && (isReady || (!isGenerating && !isFailed))) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    );
  }

  // In-progress generation — subtle shimmer so it's clearly NOT "no cover".
  if (isGenerating && !failed) {
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center gap-1 text-white animate-pulse"
        aria-busy="true"
      >
        <ImageIcon className="w-7 h-7 opacity-90" aria-hidden />
        <span className="text-[0.65rem] font-medium opacity-90">{labels.generating}</span>
      </div>
    );
  }

  // Failed (or final 404 fallback). Show the book icon plus a muted hint and an
  // optional unobtrusive retry that re-queues the cover for pycore.
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-1 text-white"
    >
      <BookOpen className="w-7 h-7" aria-hidden />
      {isFailed && (
        <>
          <span
            className="text-[0.65rem] font-medium text-white/80"
            title={errorMessage || labels.failed}
          >
            {labels.failed}
            {typeof attempts === 'number' && attempts > 0 ? ` (${attempts})` : ''}
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRetry();
              }}
              disabled={retrying}
              className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-white hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} aria-hidden />
              {labels.retry}
            </button>
          )}
        </>
      )}
    </div>
  );
};

const WfLearnLibraryPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();

  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');

  // Public Library section — renders for EVERYONE (anonymous included).
  const [publicLibraries, setPublicLibraries] = useState<WfPublicLibrary[]>([]);
  const [publicBooks, setPublicBooks] = useState<WfBookSummary[]>([]);
  const [publicSubtitles, setPublicSubtitles] = useState<WfSubtitleSummary[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);
  const [addSheetContent, setAddSheetContent] = useState<WfAddToLibraryContent | null>(null);
  // Per-library cover-retry in flight (so each card spins independently).
  const [retryingCovers, setRetryingCovers] = useState<Set<number>>(new Set());
  const { runProtected, loginConfirmSheet } = useWfProtectedAction();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await wordflowApi.getWordGroups();
        if (!cancelled) setGroups(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error('[WfLearnLibrary] Failed to load libraries:', error);
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Re-read group cards after any add/remove (WfAddToLibrarySheet refreshes
  // the word-groups cache BEFORE broadcasting 'group-sources-changed', and the
  // API layer invalidates it on every mutation — so getWordGroups() here
  // returns fresh totals, never the stale pre-add counts).
  useEffect(() => {
    let cancelled = false;
    const unsubscribe = wfLibraryCenter.subscribeGroupSources(async () => {
      try {
        const fresh = await wordflowApi.getWordGroups();
        if (!cancelled) setGroups(Array.isArray(fresh) ? fresh : []);
      } catch (error) {
        console.error('[WfLearnLibrary] Failed to refresh groups after change:', error);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  // Public content — all three calls degrade to empty inside the API layer.
  // Libraries follow the language pill (the API maps 'en' → 'english'); the
  // media lists stay unfiltered (small first page, hidden when empty).
  // Reload only the public vocabulary libraries (used after a cover retry, where
  // the media lists don't change). Always refreshes the bypass cache so the new
  // cover_status is picked up.
  const refreshPublicLibraries = React.useCallback(async () => {
    try {
      const libs = await wfLibraryCenter.getPublicLibraries(selectedLanguage || undefined, true);
      setPublicLibraries(Array.isArray(libs) ? libs : []);
    } catch (error) {
      console.error('[WfLearnLibrary] Failed to refresh public libraries:', error);
    }
  }, [selectedLanguage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPublic(true);
      try {
        const [libs, bookPage, subtitlePage] = await Promise.all([
          wfLibraryCenter.getPublicLibraries(selectedLanguage || undefined),
          wfLibraryCenter.getBooks({ perPage: 6 }),
          wfLibraryCenter.getSubtitles({ perPage: 6 }),
        ]);
        if (cancelled) return;
        setPublicLibraries(Array.isArray(libs) ? libs : []);
        setPublicBooks(Array.isArray(bookPage?.books) ? bookPage.books : []);
        setPublicSubtitles(Array.isArray(subtitlePage?.subtitles) ? subtitlePage.subtitles : []);
      } catch (error) {
        console.error('[WfLearnLibrary] Failed to load public content:', error);
        if (!cancelled) {
          setPublicLibraries([]);
          setPublicBooks([]);
          setPublicSubtitles([]);
        }
      } finally {
        if (!cancelled) setLoadingPublic(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedLanguage]);

  // Re-queue a failed library cover for pycore, then refetch the library list so
  // the card flips from "failed" to the "generating" placeholder.
  const handleRetryCover = React.useCallback(async (libraryId: number) => {
    setRetryingCovers((prev) => { const n = new Set(prev); n.add(libraryId); return n; });
    try {
      await wordflowApi.retryCover(libraryId);
      await refreshPublicLibraries();
    } catch (error) {
      console.error('[WfLearnLibrary] Cover retry failed:', error);
    } finally {
      setRetryingCovers((prev) => { const n = new Set(prev); n.delete(libraryId); return n; });
    }
  }, [refreshPublicLibraries]);

  // Defensive: never let a non-array slip into render (.map/.length safety).
  const safeGroups = Array.isArray(groups) ? groups : [];

  const visibleGroups = useMemo(() => {
    let list = safeGroups;
    if (activeTab === 'mine') list = list.filter((g) => g.type !== 'system');
    if (selectedLanguage) list = list.filter((g) => (g.language || '').toLowerCase() === selectedLanguage);
    return list;
  }, [safeGroups, activeTab, selectedLanguage]);

  const handleGroupClick = (group: WordGroup) => {
    navigate(`${wfPath('learn/practice')}?library=${encodeURIComponent(group.id)}`);
  };

  const difficultyLabel = (difficulty: string): string => {
    const key = (difficulty || '').toLowerCase();
    if (key === 'beginner') return t('library.beginner') || 'Beginner';
    if (key === 'intermediate') return t('library.intermediate') || 'Intermediate';
    if (key === 'advanced') return t('library.advanced') || 'Advanced';
    return difficulty;
  };

  // Normalized public media rows (books first, then subtitles).
  const publicMediaItems = useMemo(
    () => [
      ...publicBooks.map((b) => ({
        kind: 'book' as const,
        id: b.id,
        sourceKey: b.source_key,
        title: b.title,
        counts: `${b.sentence_count} ${t('media.sentences') || 'sentences'}`,
      })),
      ...publicSubtitles.map((s) => ({
        kind: 'subtitle' as const,
        id: s.id,
        sourceKey: s.source_key,
        title: s.title,
        counts: `${s.segment_count} ${t('media.segments') || 'segments'} · ${s.sentence_count} ${t('media.sentences') || 'sentences'}`,
      })),
    ],
    [publicBooks, publicSubtitles, t]
  );

  const Pill = ({ active, onClick, children }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={`ds-pill-chip ${active ? 'is-active' : ''}`}
    >
      {children}
    </button>
  );

  return (
    <div className="ds-page ds-section-gap route-fade min-h-screen bg-transparent pb-24">
      {/* Header */}
      <div className="pt-20 w-full">
        <div className="space-y-4">
          <div className="px-1">
            <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
              {t('nav.library')}
            </h1>
            <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">
              {t('library.explore') || 'Explore'} {t('library.collections') || 'Collections'}
            </p>
          </div>

          {/* Tabs — Iris pill segment (+ entry to the public media browse page) */}
          <div className="ds-pill-nav" role="tablist" aria-label="Library tabs">
            <Pill active={activeTab === 'all'} onClick={() => setActiveTab('all')}>{t('library.all') || 'All'}</Pill>
            <Pill active={activeTab === 'mine'} onClick={() => setActiveTab('mine')}>{t('library.myBooks') || 'My Books'}</Pill>
            <button
              type="button"
              onClick={() => navigate(wfPath('library/media'))}
              className="ds-pill-chip"
              title={t('media.browseTitle') || 'Books & Subtitles'}
            >
              <Captions className="w-4 h-4" aria-hidden />
              <span>{t('media.browseTitle') || 'Books & Subtitles'}</span>
            </button>
          </div>

          {/* Language filter — Iris pill category menu */}
          <div className="ds-pill-nav flex-wrap" role="tablist" aria-label="Language">
            {LANG_PILLS.map((p) => (
              <Pill key={p.id || 'all'} active={selectedLanguage === p.id} onClick={() => setSelectedLanguage(p.id)}>
                {p.label}
              </Pill>
            ))}
          </div>
        </div>
      </div>

      <div className="w-full ds-stack ds-stack-tight">
        {/* Import Document — Iris hero CTA */}
        <Button variant="grad" onClick={() => navigate(wfPath('tools/article-processor'))}>
          <Plus className="w-6 h-6" aria-hidden />
          <span>{t('library.importDocument') || 'Import Document'}</span>
        </Button>

        {loading && <LoadingState label={t('common.loading')} />}

        {!loading && visibleGroups.length === 0 && (
          <EmptyState
            icon={<Icons.Library />}
            title={t('library.noBooksFound') || 'No libraries found'}
            description={t('library.noBooksHint') || 'Try adjusting your filters or importing new content'}
          />
        )}

        {!loading && visibleGroups.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {visibleGroups.map((library) => {
              const emojiCover = library.coverImage && library.coverImage.length <= 2 ? library.coverImage : null;
              return (
                <button
                  key={library.id}
                  type="button"
                  onClick={() => handleGroupClick(library)}
                  className="ds-cover-card ds-card !p-0"
                >
                  {/* Cover banner — gradient + monogram + chip + word-count tag */}
                  <div className="ds-cover h-24">
                    <div className="ds-cover-img" style={{ backgroundImage: libGradient(library.name) }} />
                    <span className="ds-cover-glyph text-4xl">{emojiCover || libInitial(library.name)}</span>
                    <span className="ds-cover-chip"><LibGlyph lib={library} /></span>
                    <span className="ds-cover-tag">
                      <BookOpen className="w-3 h-3" aria-hidden />
                      {library.count}
                    </span>
                  </div>
                  {/* Text block */}
                  <div className="p-3 flex flex-col gap-2 flex-1">
                    <h3 className="font-bold text-sm text-[var(--color-text-primary)] line-clamp-2 leading-snug min-h-[2.5rem]">
                      {library.name}
                    </h3>
                    <div className="mt-auto flex items-center gap-1.5 flex-wrap">
                      {library.language && <Badge tone="klein" className="!px-2 !py-0.5">{library.language.toUpperCase()}</Badge>}
                      {library.type === 'system' && <Badge tone="neutral" dot className="!px-2 !py-0.5">System</Badge>}
                      {library.type === 'document' && <Badge tone="neutral" className="!px-2 !py-0.5">Document</Badge>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ---- Public Library — real content for EVERYONE (anonymous OK) ---- */}
        <div className="pt-2">
          <h2 className="ds-section-title pl-1 mb-3">
            {t('library.publicSection') || 'Public Library'}
          </h2>

          {loadingPublic ? (
            <div className="ds-card flex items-center justify-center p-6">
              <Spinner size="sm" />
            </div>
          ) : (
            <div className="ds-stack ds-stack-tight">
              {/* Vocabulary libraries — real ids, work with /group/add_library */}
              {publicLibraries.length === 0 ? (
                <div className="ds-row flex items-center gap-3 p-3">
                  <Icons.Library />
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {t('library.publicEmpty') || 'No public vocabulary libraries available'}
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {publicLibraries.map((lib) => (
                    <div key={lib.id} className="ds-cover-card ds-card !p-0">
                      {/* Cover banner — real cover image over a gradient fallback */}
                      <div className="ds-cover h-28" style={{ backgroundImage: libGradient(lib.name) }}>
                        <div className="ds-cover-img">
                          <CoverThumb
                            src={lib.image_url}
                            alt={lib.name}
                            status={lib.cover_status}
                            attempts={lib.cover_attempts}
                            errorMessage={lib.cover_error_message}
                            retrying={retryingCovers.has(lib.id)}
                            onRetry={() => handleRetryCover(lib.id)}
                            labels={{
                              generating: t('library.coverGenerating') || 'Generating cover…',
                              failed: t('library.coverFailed') || 'No cover',
                              retry: t('library.coverRetry') || 'Retry',
                            }}
                          />
                        </div>
                        <span className="ds-cover-chip"><LibGlyph lib={lib} /></span>
                        <span className="ds-cover-tag">
                          <BookOpen className="w-3 h-3" aria-hidden />
                          {lib.word_count.toLocaleString()}
                        </span>
                        {/* Add to study group — the only action (auth-gated) */}
                        <button
                          type="button"
                          onClick={() =>
                            runProtected(() =>
                              setAddSheetContent({ kind: 'library', id: lib.id, name: lib.name })
                            )
                          }
                          className="ds-glass ds-glass-edge absolute top-2 right-2 z-10 w-8 h-8 rounded-full shadow-md flex items-center justify-center text-[color:var(--klein-blue)] hover:bg-[color:var(--klein-blue)] hover:text-[color:var(--klein-on)] transition-all active:scale-90 hover:rotate-90"
                          title={t('library.addToGroup') || 'Add to Group'}
                          aria-label={t('library.addToGroup') || 'Add to Group'}
                        >
                          <Plus className="w-4 h-4" aria-hidden />
                        </button>
                      </div>
                      {/* Text block */}
                      <div className="p-3 flex flex-col gap-2 flex-1">
                        <h3 className="font-bold text-sm text-[var(--color-text-primary)] line-clamp-2 leading-snug min-h-[2.5rem]">
                          {lib.name}
                        </h3>
                        <div className="mt-auto flex items-center gap-1.5 flex-wrap">
                          {lib.difficulty && <Badge tone="klein" className="!px-2 !py-0.5">{difficultyLabel(lib.difficulty)}</Badge>}
                          {lib.category && (
                            <span className="text-xs text-[var(--color-text-tertiary)] capitalize truncate">
                              {lib.category}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Books & subtitles — compact hint when nothing is synced yet */}
              {publicMediaItems.length === 0 ? (
                <button
                  type="button"
                  onClick={() => navigate(wfPath('library/media'))}
                  className="ds-row w-full flex items-center gap-3 p-3 text-left"
                >
                  <Captions className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" aria-hidden />
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {t('media.emptyCompact') || 'No books or subtitles synced yet'}
                  </span>
                </button>
              ) : (
                <>
                  <span className="ds-section-label pl-1">
                    {t('media.browseTitle') || 'Books & Subtitles'}
                  </span>
                  {publicMediaItems.map((item) => (
                    <div
                      key={`${item.kind}-${item.id}`}
                      onClick={() =>
                        navigate(
                          wfPath(`library/media_detail?type=${item.kind}&id=${encodeURIComponent(String(item.id))}`)
                        )
                      }
                      className="ds-row flex items-center justify-between p-4 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-xl bg-[var(--klein-blue-soft)] flex items-center justify-center shadow-inner border border-white/40 flex-shrink-0 text-[var(--klein-blue)]">
                          {item.kind === 'book'
                            ? <BookOpen className="w-6 h-6" aria-hidden />
                            : <Captions className="w-6 h-6" aria-hidden />}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
                            {item.title}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge tone="neutral">
                              {item.kind === 'book'
                                ? t('media.books') || 'Books'
                                : t('media.subtitles') || 'Subtitles'}
                            </Badge>
                            <span className="text-xs text-[var(--color-text-tertiary)] truncate">
                              {item.counts}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          runProtected(() =>
                            setAddSheetContent({
                              kind: item.kind,
                              sourceKey: item.sourceKey,
                              title: item.title,
                            })
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
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Login-required confirm (anonymous "+" taps) + add-to-group sheet */}
      {loginConfirmSheet}
      <WfAddToLibrarySheet
        open={addSheetContent !== null}
        content={addSheetContent}
        onClose={() => setAddSheetContent(null)}
      />
    </div>
  );
};

export default WfLearnLibraryPage;
