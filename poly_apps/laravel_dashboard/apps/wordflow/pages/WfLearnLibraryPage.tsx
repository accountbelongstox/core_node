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
import { Plus, BookOpen, Captions } from 'lucide-react';
import { Icons, Card, Button, LoadingState, EmptyState, Badge, Spinner } from '../WfUI';
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

const LANG_PILLS: { id: string; label: string }[] = [
  { id: '', label: 'All Languages' },
  { id: 'en', label: 'English' },
  { id: 'zh', label: 'Chinese' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'ja', label: 'Japanese' },
];

/** Cover thumbnail with graceful fallback to the book icon on load failure. */
const CoverThumb: React.FC<{ src: string | null | undefined; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  // Reset the failure flag when the source changes (list re-renders).
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    return (
      <div
        className="w-full h-24 rounded-xl flex items-center justify-center text-[var(--klein-blue)]"
        style={{ background: 'var(--klein-blue-soft)' }}
      >
        <BookOpen className="w-8 h-8" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="w-full h-24 rounded-xl object-cover"
    />
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
          <div className="ds-stack ds-stack-tight">
            {visibleGroups.map((library) => (
              <Card
                key={library.id}
                onClick={() => handleGroupClick(library)}
                className="cursor-pointer hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center text-[color:var(--klein-blue)] text-xl"
                    style={{ background: 'var(--klein-blue-soft)' }}
                  >
                    {library.coverImage && library.coverImage.length <= 2
                      ? library.coverImage
                      : <Icons.Book />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-1 truncate group-hover:text-[var(--klein-blue)] transition-colors">
                      {library.name}
                    </h3>
                    {library.description && (
                      <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-2">
                        {library.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {library.language && <Badge tone="klein">{library.language.toUpperCase()}</Badge>}
                      {library.type === 'system' && <Badge tone="neutral">System</Badge>}
                      {library.type === 'document' && <Badge tone="neutral">Document</Badge>}
                    </div>

                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <BookOpen className="w-4 h-4" aria-hidden />
                      <span>{library.count} {t('library.words') || 'words'}</span>
                    </div>
                  </div>

                  <div className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                    <Icons.ChevronRight />
                  </div>
                </div>
              </Card>
            ))}
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
                    <div key={lib.id} className="ds-card !p-3 flex flex-col gap-3 relative">
                      <CoverThumb src={lib.image_url} alt={lib.name} />
                      {/* Add to study group — the only action (auth-gated) */}
                      <button
                        type="button"
                        onClick={() =>
                          runProtected(() =>
                            setAddSheetContent({ kind: 'library', id: lib.id, name: lib.name })
                          )
                        }
                        className="ds-glass ds-glass-edge absolute top-2 right-2 w-8 h-8 rounded-full shadow-md flex items-center justify-center text-[color:var(--klein-blue)] hover:bg-[color:var(--klein-blue)] hover:text-[color:var(--klein-on)] transition-all active:scale-95"
                        title={t('library.addToGroup') || 'Add to Group'}
                        aria-label={t('library.addToGroup') || 'Add to Group'}
                      >
                        <Plus className="w-4 h-4" aria-hidden />
                      </button>
                      <div className="min-w-0">
                        <h3 className="font-bold text-sm text-[var(--color-text-primary)] line-clamp-2 min-h-[2.5rem]">
                          {lib.name}
                        </h3>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {lib.difficulty && <Badge tone="klein">{difficultyLabel(lib.difficulty)}</Badge>}
                          {lib.category && (
                            <span className="text-xs text-[var(--color-text-tertiary)] capitalize truncate">
                              {lib.category}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                          {lib.word_count.toLocaleString()} {t('library.words') || 'words'}
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
