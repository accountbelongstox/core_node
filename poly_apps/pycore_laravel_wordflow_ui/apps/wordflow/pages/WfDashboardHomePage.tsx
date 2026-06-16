/* [v4.1-Iris] Home — ported from poly_apps/qy_capacitor/pages/Dashboard/Home.tsx.
 * Self-contained: reads profile / word groups / recommended libraries from
 * wordflowApi, react-router useNavigate + wfPath() for nav, useWfApp() for the
 * current user + learning language. Every call is try/caught and degrades to an
 * inline empty state. Faithful Iris app-style look (hero greeting, language
 * pill, snap carousels, gradient study CTA, bento modes, progress). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock, BookOpen, CalendarCheck, ChevronRight, Play, Headphones, Flame, Brain, Pencil, CircleCheck, Check, Plus, Captions,
} from 'lucide-react';
import {
  Card, Icons, Spinner, EmptyState, Badge, ProgressBar, SectionTitle, BentoTile, Stat,
} from '../WfUI';
import { useWfApp, useWfT } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import {
  wordflowApi,
  type WfPublicLibrary,
  type WfBookSummary,
  type WfSubtitleSummary,
} from '../../../core/api-libs/wordflow/WordflowApi';
import { wfLearningStatsCenter } from '../services/WfLearningStatsCenter';
import { wfLibraryCenter } from '../services/WfLibraryCenter';
import { wfRecitationCenter } from '../services/WfRecitationCenter';
import { useWfProtectedAction } from '../hooks/useWfProtectedAction';
import WfAddToLibrarySheet, {
  type WfAddToLibraryContent,
} from '../components/WfAddToLibrarySheet';
import type { WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';

/** Library cover chip with graceful fallback to the book icon on load failure. */
const LibraryCoverChip: React.FC<{ src: string | null | undefined; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className="w-11 h-11 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center shadow-inner border border-white/40 text-[var(--klein-blue)] overflow-hidden">
      {!src || failed ? (
        <BookOpen className="w-5 h-5" aria-hidden />
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      )}
    </div>
  );
};

const WfDashboardHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, learningLanguage, activeGroupId } = useWfApp();
  const { t } = useWfT();

  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [recommended, setRecommended] = useState<WfPublicLibrary[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [loadingRecommended, setLoadingRecommended] = useState(true);
  const [homeFilter, setHomeFilter] = useState<'today' | 'recommended'>('today');
  // Restored original Home blocks: daily words / review queue / selected libs.
  const [dailyWords, setDailyWords] = useState<any[]>([]);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [selectedLibraries, setSelectedLibraries] = useState<any[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  // Public Books & Subtitles content (anonymous-friendly, 2026-06-12 contract).
  const [publicBooks, setPublicBooks] = useState<WfBookSummary[]>([]);
  const [publicSubtitles, setPublicSubtitles] = useState<WfSubtitleSummary[]>([]);
  const [loadingPublicMedia, setLoadingPublicMedia] = useState(true);
  const [addSheetContent, setAddSheetContent] = useState<WfAddToLibraryContent | null>(null);
  const { runProtected, loginConfirmSheet } = useWfProtectedAction();
  // Server-backed recitation streak — preferred over the profile's user.streak
  // (which only updates on profile refetch). null until the fetch lands.
  const [serverStreak, setServerStreak] = useState<number | null>(null);
  const [reciteToday, setReciteToday] = useState<{ done: number; goal: number } | null>(null);

  useEffect(() => {
    if (!user) {
      setServerStreak(null);
      setReciteToday(null);
      return;
    }
    let cancelled = false;
    const loadStreak = async () => {
      try {
        const s = await wordflowApi.recitationStreak();
        if (!cancelled) setServerStreak(s.current_streak ?? 0);
      } catch (e) {
        // Keep user.streak as the fallback — never break the home over this.
        console.warn('[WfHome] recitation streak failed:', e);
      }
    };
    void loadStreak();
    // Seed the chip counters (limit=1 — only done_today/goal are read here).
    (async () => {
      try {
        const plan = await wordflowApi.recitationTodayPlan({ language: learningLanguage, limit: 1 });
        if (!cancelled) setReciteToday({ done: plan.done_today ?? 0, goal: plan.goal ?? 0 });
      } catch (e) {
        console.warn('[WfHome] recitation plan failed:', e);
      }
    })();
    // Live-update on recitation flushes: counters arrive in the event payload;
    // the streak may have just been extended, so refetch it (the API layer's
    // short cache was cleared by the successful log).
    const unsubscribe = wfRecitationCenter.subscribe((update) => {
      if (cancelled) return;
      setReciteToday({ done: update.today.unique_words, goal: update.today.goal });
      if (!update.pending) void loadStreak();
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [user, learningLanguage]);

  /** Displayed streak: server recitation streak first, profile field fallback. */
  const displayStreak = serverStreak ?? (user?.streak ?? 0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingGroups(true);
      try {
        const wordGroups = await wordflowApi.getWordGroups();
        if (!cancelled) setGroups(Array.isArray(wordGroups) ? wordGroups : []);
      } catch (e) {
        console.error('[WfHome] groups failed:', e);
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoadingGroups(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  // Recommended tab — REAL public vocabulary libraries (anonymous-safe; their
  // ids are exactly what /group/add_library expects). Follows the learning
  // language ('en' is mapped to 'english' inside the API layer).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRecommended(true);
      try {
        const libs = await wfLibraryCenter.getPublicLibraries(learningLanguage);
        if (!cancelled) setRecommended(Array.isArray(libs) ? libs.slice(0, 10) : []);
      } catch (e) {
        console.error('[WfHome] public libraries failed:', e);
        if (!cancelled) setRecommended([]);
      } finally {
        if (!cancelled) setLoadingRecommended(false);
      }
    })();
    return () => { cancelled = true; };
  }, [learningLanguage]);

  // Public Books & Subtitles — anonymous-friendly (PUBLIC GETs degrade to
  // empty pages in the API layer). Filtered by the current learning language.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPublicMedia(true);
      try {
        const [bookPage, subtitlePage] = await Promise.all([
          wfLibraryCenter.getBooks({ language: learningLanguage, perPage: 6 }),
          wfLibraryCenter.getSubtitles({ language: learningLanguage, perPage: 6 }),
        ]);
        if (cancelled) return;
        setPublicBooks(Array.isArray(bookPage?.books) ? bookPage.books : []);
        setPublicSubtitles(Array.isArray(subtitlePage?.subtitles) ? subtitlePage.subtitles : []);
      } catch (e) {
        console.error('[WfHome] public media failed:', e);
        if (!cancelled) {
          setPublicBooks([]);
          setPublicSubtitles([]);
        }
      } finally {
        if (!cancelled) setLoadingPublicMedia(false);
      }
    })();
    return () => { cancelled = true; };
  }, [learningLanguage]);

  // User-gated loads (mirrors the original Home.tsx): daily words via the
  // learning-stats center, review queue + selected collections via wordflowApi.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      setLoadingDaily(true);
      try {
        const words = await wfLearningStatsCenter.getDailyWords(10);
        if (!cancelled) setDailyWords(Array.isArray(words) ? words : []);
      } catch (e) {
        console.error('[WfHome] daily words failed:', e);
        if (!cancelled) setDailyWords([]);
      } finally {
        if (!cancelled) setLoadingDaily(false);
      }

      setLoadingReview(true);
      try {
        const queue = await wordflowApi.getReviewQueue();
        if (!cancelled) setReviewQueue(Array.isArray(queue) ? queue.slice(0, 5) : []);
      } catch (e) {
        console.error('[WfHome] review queue failed:', e);
        if (!cancelled) setReviewQueue([]);
      } finally {
        if (!cancelled) setLoadingReview(false);
      }

      try {
        const selected = await wordflowApi.getSelectedCollections();
        if (!cancelled) setSelectedLibraries(Array.isArray(selected) ? selected : []);
      } catch (e) {
        console.error('[WfHome] selected collections failed:', e);
        if (!cancelled) setSelectedLibraries([]);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  const getUserDisplayName = (): string => {
    if (!user) return 'User';
    const name = user.nickname || user.name || user.username || user.email?.split('@')[0] || 'User';
    return name.split(' ')[0];
  };

  const activeGroup = groups.find((g) => g.id === activeGroupId) || groups[0] || null;

  // Selected-collection ids (id / collection_id / library_id item shapes) —
  // used to flag already-selected public libraries, logged-in users only.
  const selectedIdSet = new Set<string>(
    selectedLibraries
      .map((it: any) => it?.collection_id ?? it?.library_id ?? it?.id)
      .filter((id: any) => id !== undefined && id !== null)
      .map((id: any) => String(id))
  );

  const difficultyLabel = (difficulty: string): string => {
    const key = (difficulty || '').toLowerCase();
    if (key === 'beginner') return t('library.beginner') || 'Beginner';
    if (key === 'intermediate') return t('library.intermediate') || 'Intermediate';
    if (key === 'advanced') return t('library.advanced') || 'Advanced';
    return difficulty;
  };

  return (
    <div className="ds-page ds-section-gap route-fade pt-16 pb-32">
      {/* Welcome — app hero greeting + streak chip */}
      <div className="flex items-end justify-between gap-3 px-1 pt-1">
        <div className="min-w-0">
          <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
            {user ? t('home.startLearning') : t('home.guestMode')}
          </span>
          <h1 className="text-[2.1rem] leading-[1.05] font-black tracking-tight mt-0.5 text-[var(--color-text-primary)]">
            {user ? `${t('home.hiUser').replace('{name}', getUserDisplayName())}` : t('home.welcomeGuest')}
          </h1>
        </div>
        {user && displayStreak > 0 && (
          <div className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-2 ds-glass ds-glass-edge">
            <Flame className="w-4 h-4 text-orange-500" aria-hidden />
            <span className="text-sm font-black text-[var(--color-text-primary)]">{displayStreak}</span>
          </div>
        )}
      </div>

      {/* Category pill row (Today / Recommended) */}
      <div className="ds-pill-nav" role="tablist" aria-label="Sections">
        {([
          { id: 'today', label: t('home.startLearning') || 'Today' },
          { id: 'recommended', label: t('home.recommended') || 'Recommended' },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={homeFilter === item.id}
            onClick={() => setHomeFilter(item.id)}
            className={`ds-pill-chip ${homeFilter === item.id ? 'is-active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Language bar — sleek glass pill */}
      <button
        onClick={() => navigate(wfPath('settings_lang'))}
        className="ds-glass ds-glass-edge w-full flex items-center justify-between gap-3 pl-3 pr-2.5 py-2.5 rounded-full text-left active:scale-[0.99] transition-transform"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wide leading-none mb-0.5">
            {t('home.targetLanguage') || 'Target language'}
          </div>
          <div className="text-sm font-bold text-[var(--color-text-primary)] leading-none truncate uppercase">
            {learningLanguage}
          </div>
        </div>
        <span className="ds-fab-grad flex-shrink-0 w-9 h-9 [&_svg]:w-4 [&_svg]:h-4" aria-hidden>
          <Icons.Settings />
        </span>
      </button>

      {/* Recommended libraries */}
      {homeFilter === 'recommended' && (
        <div>
          <SectionTitle
            title={t('home.recommendedLibraries') || 'Recommended Vocabulary'}
            moreLabel={t('home.viewMore') || 'More'}
            onMore={recommended.length > 0 ? () => navigate(wfPath('courses')) : undefined}
            className="mb-3 px-1"
          />
          {loadingRecommended ? (
            <div className="ds-card flex items-center justify-center p-6">
              <Spinner size="sm" />
            </div>
          ) : recommended.length > 0 ? (
            <div
              className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
              style={{ marginInline: 'calc(var(--page-padding-h) * -1)', paddingInline: 'var(--page-padding-h)' }}
            >
              {recommended.map((library) => (
                // No public-library detail surface exists (the vocabulary_library
                // route is a GROUP page), so the card body is non-navigating; the
                // "+" (real library id → WfAddToLibrarySheet) is the action.
                <div
                  key={library.id}
                  className="snap-start shrink-0 w-44 ds-card !p-4 text-left flex flex-col gap-3 relative"
                >
                  <LibraryCoverChip src={library.image_url} alt={library.name} />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1 line-clamp-2 min-h-[2.5rem]">
                      {library.name}
                    </h3>
                    <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                      <span className="font-medium">{library.word_count.toLocaleString()} {t('home.words') || 'words'}</span>
                      {library.difficulty && <Badge tone="neutral">{difficultyLabel(library.difficulty)}</Badge>}
                    </div>
                    {/* is_selected indicator — logged-in users only */}
                    {user && selectedIdSet.has(String(library.id)) && (
                      <div className="mt-1.5">
                        <Badge tone="klein">
                          <Check className="w-3 h-3" aria-hidden /> {t('recommendations.selected') || 'Selected'}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {/* Add to Group — REAL library id → shared add-to-group sheet */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      runProtected(() =>
                        setAddSheetContent({ kind: 'library', id: library.id, name: library.name })
                      );
                    }}
                    className="ds-glass ds-glass-edge absolute top-2 right-2 w-8 h-8 rounded-full shadow-md flex items-center justify-center text-[color:var(--klein-blue)] hover:bg-[color:var(--klein-blue)] hover:text-[color:var(--klein-on)] transition-all active:scale-95"
                    title={t('home.selectStudyGroup') || 'Add to group'}
                    aria-label={t('home.selectStudyGroup') || 'Add to group'}
                  >
                    <Plus className="w-4 h-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Icons.Library />} title={t('home.noRecommended') || 'No recommended libraries available'} />
          )}
        </div>
      )}

      {/* Public Books & Subtitles — anonymous-friendly content rows */}
      {homeFilter === 'recommended' && (
        <div>
          <SectionTitle
            title={t('home.publicContent') || 'Books & Subtitles'}
            className="mb-3 px-1"
          />
          {loadingPublicMedia ? (
            <div className="ds-card flex items-center justify-center p-6">
              <Spinner size="sm" />
            </div>
          ) : publicBooks.length === 0 && publicSubtitles.length === 0 ? (
            // Compact hint row — media sync may not have pushed yet; never
            // render a broken-looking full-size empty block here.
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
            <div className="ds-stack ds-stack-tight">
              {[
                ...publicBooks.map((b) => ({
                  kind: 'book' as const,
                  id: b.id,
                  sourceKey: b.source_key,
                  title: b.title,
                  language: b.language,
                  counts: `${b.sentence_count} ${t('media.sentences') || 'sentences'}`,
                })),
                ...publicSubtitles.map((s) => ({
                  kind: 'subtitle' as const,
                  id: s.id,
                  sourceKey: s.source_key,
                  title: s.title,
                  language: s.language,
                  counts: `${s.segment_count} ${t('media.segments') || 'segments'} · ${s.sentence_count} ${t('media.sentences') || 'sentences'}`,
                })),
              ].map((item) => (
                <div
                  key={`${item.kind}-${item.id}`}
                  onClick={() => navigate(wfPath(`library/media?type=${item.kind}&id=${encodeURIComponent(String(item.id))}`))}
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
            </div>
          )}
        </div>
      )}

      {/* Today: daily words carousel — restored original block */}
      {homeFilter === 'today' && user && (
        <div>
          <SectionTitle
            title={t('home.dailyWords') || 'Daily Words'}
            moreLabel={t('home.viewMore') || 'More'}
            onMore={() => navigate(wfPath('dictionary'))}
            className="mb-3 px-1"
          />

          {/* Daily Recitation (每日背诵) — compact CTA chip into the recite flow */}
          <button
            type="button"
            onClick={() => navigate(wfPath('learn/daily_recitation'))}
            className="ds-row w-full flex items-center gap-3 p-3 mb-3 text-left group active:scale-[0.99] transition-transform"
          >
            <div className="w-9 h-9 rounded-xl bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)] flex-shrink-0">
              <CalendarCheck className="w-5 h-5" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--klein-blue)] transition-colors">
                {t('recitation.title')}
              </span>
              <span className="block text-xs text-[var(--color-text-secondary)] truncate">
                {reciteToday
                  ? t('recitation.progressLabel', { done: reciteToday.done, goal: reciteToday.goal })
                  : t('recitation.homeCardSubtitle')}
              </span>
            </div>
            {displayStreak > 0 && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-orange-500/10 text-orange-500 text-xs font-black">
                <Flame className="w-3.5 h-3.5" aria-hidden />
                {displayStreak}
              </span>
            )}
            <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0" aria-hidden />
          </button>
          {loadingDaily ? (
            <div className="ds-card flex items-center justify-center p-6">
              <Spinner size="sm" />
            </div>
          ) : dailyWords.length > 0 ? (
            <div
              className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
              style={{ marginInline: 'calc(var(--page-padding-h) * -1)', paddingInline: 'var(--page-padding-h)' }}
            >
              {dailyWords.map((word, index) => (
                <button
                  key={word.id || index}
                  type="button"
                  onClick={() => navigate(wfPath(`word_detail?wordId=${encodeURIComponent(word.id ?? '')}`))}
                  className="snap-start shrink-0 w-40 ds-card !p-4 text-left flex flex-col gap-3 active:scale-[0.97] transition-transform"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center shadow-inner border border-white/40 text-[var(--klein-blue)]">
                      <Pencil className="w-5 h-5" aria-hidden />
                    </div>
                    {index === 0 && (
                      <span className="px-2 py-0.5 text-[9px] font-bold bg-yellow-100 text-yellow-700 rounded-full">
                        {t('home.new') || 'NEW'}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-bold text-[var(--color-text-primary)] truncate">
                      {word.word || word.text}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                      {word.translation || word.meaning || t('home.noTranslation') || 'No translation'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Pencil className="w-10 h-10 text-[var(--klein-blue)]" aria-hidden />}
              title={t('home.noDailyWords') || 'No daily words available'}
              description={t('home.checkBackLater') || 'Check back later for new words'}
            />
          )}
        </div>
      )}

      {/* Today: review queue card — restored original block (first 5 + CTA) */}
      {homeFilter === 'today' && (
        <div>
          <SectionTitle
            title={t('home.reviewQueue') || 'Review Queue'}
            className="mb-3 px-1"
            action={
              user ? (
                <Badge tone="danger">
                  {reviewQueue.length > 0 ? `${reviewQueue.length}${reviewQueue.length >= 5 ? '+' : ''}` : '0'}
                </Badge>
              ) : undefined
            }
          />
          {loadingReview ? (
            <div className="ds-card flex items-center justify-center p-6">
              <Spinner size="sm" />
            </div>
          ) : user && reviewQueue.length === 0 ? (
            <EmptyState
              icon={<CircleCheck className="w-10 h-10 text-emerald-500" aria-hidden />}
              title={t('home.noReviewNeeded') || 'All caught up!'}
              description={t('home.noReviewDescription') || 'No words need review right now'}
            />
          ) : (
            <button
              type="button"
              onClick={() => navigate(wfPath(user && reviewQueue.length > 0 ? 'learn/review' : 'review_dashboard'))}
              className="w-full ds-card !p-4 flex items-center gap-4 text-left active:scale-[0.99] transition-transform"
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center shadow-inner border border-white/40 text-[var(--klein-blue)] shrink-0">
                <Clock className="w-7 h-7" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-[var(--color-text-primary)]">
                  {t('home.reviewAll') || 'Start Review Session'}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                  {user && reviewQueue.length > 0
                    ? `${reviewQueue.length}${reviewQueue.length >= 5 ? '+' : ''} ${t('home.words') || 'words'} · ${t('home.reviewQueue') || 'Review Queue'}`
                    : t('home.reviewQueue') || 'Review Queue'}
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)] shrink-0">
                <Icons.ChevronRight />
              </div>
            </button>
          )}
        </div>
      )}

      {/* Today: my selected libraries — restored original block */}
      {homeFilter === 'today' && user && selectedLibraries.length > 0 && (
        <div>
          <SectionTitle
            title={t('home.myVocabulary') || 'My Vocabulary'}
            moreLabel={t('home.viewAll') || 'View All'}
            onMore={() => navigate(wfPath('courses'))}
            className="mb-3 px-1"
          />
          <div
            className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
            style={{ marginInline: 'calc(var(--page-padding-h) * -1)', paddingInline: 'var(--page-padding-h)' }}
          >
            {selectedLibraries.slice(0, 3).map((library) => (
              <button
                key={library.id}
                type="button"
                onClick={() => navigate(wfPath('courses'))}
                className="snap-start shrink-0 w-44 ds-card !p-4 text-left flex flex-col gap-3 active:scale-[0.97] transition-transform"
              >
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center shadow-inner border border-white/40 text-[var(--klein-blue)]">
                    <Check className="w-5 h-5" aria-hidden />
                  </div>
                  {library.level && <Badge tone="klein">{library.level}</Badge>}
                </div>
                <div className="min-w-0">
                  <div className="text-base font-bold text-[var(--color-text-primary)] truncate">
                    {library.name}
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                    {library.word_count || library.total_words} {t('library.words') || 'words'}
                    {library.category ? ` · ${library.category}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* My libraries / active course */}
      {homeFilter === 'today' && (
        <div>
          <SectionTitle
            title={user ? t('home.activeCourse') || 'Active Course' : t('home.library') || 'Library'}
            moreLabel={t('home.add') || 'Add'}
            onMore={() => navigate(wfPath('courses'))}
            className="mb-2 px-1"
          />
          {loadingGroups ? (
            <div className="ds-card flex items-center justify-center p-6">
              <Spinner size="sm" />
            </div>
          ) : activeGroup ? (
            <div
              onClick={() => navigate(wfPath('course_detail'))}
              className="ds-card ds-card-elevated flex items-center justify-between p-5 cursor-pointer group"
            >
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center text-3xl shadow-inner border border-white/40 text-[var(--klein-blue)] flex-shrink-0">
                  {activeGroup.coverImage && activeGroup.coverImage.length <= 2
                    ? activeGroup.coverImage
                    : <BookOpen className="w-7 h-7" aria-hidden />}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xl font-bold text-[var(--color-text-primary)] line-clamp-1 group-hover:text-[var(--klein-blue)] transition-colors">
                    {activeGroup.name}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <ProgressBar value={activeGroup.progress || 0} className="w-24" />
                    <span className="text-xs font-bold text-[var(--color-text-tertiary)]">
                      {Math.round(activeGroup.progress || 0)}%
                    </span>
                  </div>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)] flex-shrink-0">
                <Icons.ChevronRight />
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Icons.Book />}
              title={t('home.selectWordBank') || 'No active course'}
              description={t('home.tryDifferentLanguages') || 'Add a vocabulary library to start learning.'}
            />
          )}
        </div>
      )}

      {/* Study modes grid */}
      {homeFilter === 'today' && (
        <div className="ds-grid-breathing grid grid-cols-2 auto-rows-min">
          <div className="col-span-2">
            <h2 className="ds-section-title pl-1">{t('home.studyCenter') || 'Study Center'}</h2>
          </div>

          {/* Smart playlist — gradient hero CTA */}
          <Card
            onClick={() => navigate(wfPath('playlist'))}
            className="col-span-2 !p-5 !border-none text-[color:var(--klein-on)] group relative overflow-hidden cursor-pointer"
          >
            <div className="absolute inset-0 -z-0" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }} />
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
            <div className="absolute -bottom-12 -left-8 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[10px] font-bold backdrop-blur-sm">
                    {t('home.recommended') || 'Recommended'}
                  </span>
                </div>
                <h3 className="font-bold text-2xl">{t('home.smartPlaylist') || 'Smart Playlist'}</h3>
                <p className="text-white/80 text-sm font-medium">{t('home.autoPlayReview') || 'Auto-play review'}</p>
              </div>
              <div className="w-14 h-14 rounded-full bg-white text-[color:var(--klein-blue)] flex items-center justify-center shadow-lg group-active:scale-90 transition-transform">
                <Play className="w-6 h-6 fill-current" aria-hidden />
              </div>
            </div>
          </Card>

          <BentoTile
            onClick={() => navigate(wfPath('flashcard_run'))}
            title={t('home.flashcards') || 'Flashcards'}
            description={t('home.spacedRepetition') || 'Spaced repetition'}
            chipIcon={<span className="text-base font-black">Aa</span>}
          />
          <BentoTile
            onClick={() => navigate(wfPath('reading_run'))}
            title={t('home.reading') || 'Reading'}
            description={t('home.flowContext') || 'Flow in context'}
            chipIcon={<Icons.Book />}
          />
          <BentoTile
            onClick={() => navigate(wfPath('quiz_run'))}
            title={t('home.quiz') || 'Quiz'}
            description={t('home.gamifiedTest') || 'Gamified test'}
            chipIcon={<span className="text-lg font-black">?</span>}
          />
          <BentoTile
            onClick={() => navigate(wfPath('listening_player'))}
            title={t('home.passive') || 'Listening'}
            description={t('home.audioLoop') || 'Passive audio loop'}
            chipIcon={<Headphones className="w-5 h-5" aria-hidden />}
          />
        </div>
      )}

      {/* Progress */}
      {homeFilter === 'today' && (
        <div>
          <h2 className="ds-section-title pl-1 mb-3">{t('home.myProgress') || 'My Progress'}</h2>
          <div className="ds-grid-breathing grid grid-cols-2">
            <Card onClick={() => navigate(wfPath('stats'))} className="flex flex-col gap-3 cursor-pointer">
              <span className="ds-bento-chip"><Flame className="w-5 h-5" aria-hidden /></span>
              <Stat accent value={`${displayStreak} ${t('home.days') || 'days'}`} label={t('home.currentStreak') || 'Current streak'} />
            </Card>
            <Card onClick={() => navigate(wfPath('review_dashboard'))} className="flex flex-col gap-3 cursor-pointer">
              <span className="ds-bento-chip"><Brain className="w-5 h-5" aria-hidden /></span>
              <Stat accent value={`${user?.mastered_words ?? 0}`} label={t('home.masteredWords') || 'Mastered'} />
            </Card>
          </div>
        </div>
      )}

      {/* Filtered word groups list */}
      {homeFilter === 'today' && !loadingGroups && groups.length > 0 && (
        <div>
          <SectionTitle
            title={t('home.availableCourses') || 'Available Courses'}
            moreLabel={t('home.viewAll') || 'View all'}
            onMore={() => navigate(wfPath('courses'))}
            className="mb-3 px-1"
          />
          <div className="ds-stack ds-stack-tight">
            {groups.slice(0, 3).map((group) => (
              <div
                key={group.id}
                onClick={() => navigate(wfPath('course_detail'))}
                className="ds-row flex items-center justify-between p-4 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[var(--klein-blue-soft)] flex items-center justify-center text-2xl shadow-inner border border-white/40 flex-shrink-0 text-[var(--klein-blue)]">
                    {group.coverImage && group.coverImage.length <= 2
                      ? group.coverImage
                      : <BookOpen className="w-6 h-6" aria-hidden />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
                      {group.name}
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[var(--color-text-tertiary)]">
                        {group.count} {t('home.words') || 'words'}
                      </span>
                      <span className="text-xs font-bold text-[var(--color-text-tertiary)]">· {Math.round(group.progress || 0)}%</span>
                    </div>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)] flex-shrink-0">
                  <Icons.ChevronRight />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

export default WfDashboardHomePage;
