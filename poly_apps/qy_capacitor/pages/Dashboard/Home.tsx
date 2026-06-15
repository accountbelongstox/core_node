/* [v4.1-Iris] App-style redesign (NOT a device frame — full-bleed native-app
   feel): hero greeting + streak chip, sleek language pill, horizontal snap
   carousels for daily words / recommended / my-vocabulary, compact review
   card, bento study modes, stat progress. All data logic (loaders / safe*
   guards / Array.isArray / handlers / modal) preserved. Verified parity vs
   public/design-reference-{light,dark}.webp. */

import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button, Spinner, EmptyState, Badge, ProgressBar, SectionTitle, BentoTile, Stat } from '../../components/UI';
import { Pencil, Clock, CircleCheck, BookOpen, Check, Play, Headphones, Flame, Brain } from 'lucide-react';
import { PillNav } from '../../components/PillNav';
import { api } from '../../services/api';
import { WordGroup, Word } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../services/mockData';
import { IconMappingService } from '../../services/IconMappingService';
import { ApiCenter } from '../../services/ApiCenter';
import { mapLanguageCode } from '../../services/languageMapper';
import { WordGroupsCenter } from '../../services/WordGroupsCenter';

const DashboardPage = () => {
  const { user, navigate, t, activeGroupId, settings } = useContext(AppContext);
  const [activeGroup, setActiveGroup] = useState<WordGroup | null>(null);
  const [allGroups, setAllGroups] = useState<WordGroup[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<WordGroup[]>([]);
  const [dailyWords, setDailyWords] = useState<any[]>([]);
  const [reviewQueue, setReviewQueue] = useState<Word[]>([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [recommendedLibraries, setRecommendedLibraries] = useState<any[]>([]);
  const [selectedLibraries, setSelectedLibraries] = useState<any[]>([]);
  const [loadingLibraries, setLoadingLibraries] = useState(false);
  const [showAddToGroupModal, setShowAddToGroupModal] = useState(false);
  const [selectedLibraryForGroup, setSelectedLibraryForGroup] = useState<any>(null);
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null);
  // v4.0 pill horizontal category menu (Today / Recommended)
  const [homeFilter, setHomeFilter] = useState<'today' | 'recommended'>('today');

  // Subscribe to WordGroupsCenter for automatic updates
  useEffect(() => {
    const unsubscribe = WordGroupsCenter.subscribe((groups) => {
      setAllGroups(groups);
      const found = groups.find(g => g.id === activeGroupId) || groups[0];
      setActiveGroup(found);
    });

    // Initial fetch
    WordGroupsCenter.fetchAll();

    return unsubscribe;
  }, [activeGroupId]);

  useEffect(() => {
    if (user) {
      // Debug: Log user object to identify available fields
      console.group('[Home] User Data Debug');
      console.log('User object:', user);
      console.log('Available fields:', {
        id: user.id,
        name: user.name,
        nickname: user.nickname,
        username: user.username,
        email: user.email,
      });
      console.groupEnd();

      // Load daily words
      loadDailyWords();

      // Load review queue
      loadReviewQueue();

      // Load selected vocabulary libraries
      loadSelectedLibraries();
    }
  }, [user]);

  useEffect(() => {
    loadRecommendedLibraries();
  }, [settings.language.learningLanguages]);

  const loadDailyWords = async () => {
    if (!user) return;

    setLoadingDaily(true);
    try {
      const response = await ApiCenter.words.getDailyWords(5);
      if (response.success && response.data) {
        // API body may be non-array (non-JSON / error) — keep state an array
        setDailyWords(Array.isArray(response.data) ? response.data : []);
      }
    } catch (err: any) {
      if (err?.message?.includes('not found') || err?.code === 'HTTP_404') {
        console.log('[Home] Daily words endpoint not implemented yet');
      } else {
        console.error('[Home] Failed to load daily words:', err);
      }
    } finally {
      setLoadingDaily(false);
    }
  };

  const loadReviewQueue = async () => {
    if (!user) return;

    setLoadingReview(true);
    try {
      const response = await ApiCenter.learning.getReviewQueue();
      if (response.success && response.data) {
        // API body may be non-array (non-JSON / error) — normalize before slice
        const queue = Array.isArray(response.data) ? response.data : [];
        setReviewQueue(queue.slice(0, 5)); // Show max 5 words
      }
    } catch (err: any) {
      if (err?.message?.includes('not found') || err?.code === 'HTTP_404') {
        console.log('[Home] Review queue endpoint not implemented yet');
      } else {
        console.error('[Home] Failed to load review queue:', err);
      }
    } finally {
      setLoadingReview(false);
    }
  };

  const loadRecommendedLibraries = async () => {
    console.log('[Home] Loading vocabulary libraries...');
    console.log('[Home] Learning languages:', settings.language.learningLanguages);
    setLoadingLibraries(true);
    try {
      const langCode = settings.language.learningLanguages?.[0] || 'en';
      const language = mapLanguageCode(langCode);
      console.log('[Home] Language code:', langCode, '-> Backend format:', language);

      const response = await ApiCenter.vocabulary.getLibraries({ language, per_page: 20 });
      console.log('[Home] API response:', response);

      if (response.success && response.data) {
        const libraries = Array.isArray(response.data)
          ? response.data
          : ((response.data as { libraries?: any[] }).libraries || []);
        console.log('[Home] Extracted libraries:', libraries);

        const sorted = [...libraries].sort((a, b) => {
          if (a.is_recommended && !b.is_recommended) return -1;
          if (!a.is_recommended && b.is_recommended) return 1;
          return 0;
        });

        setRecommendedLibraries(sorted.slice(0, 10));
        console.log('[Home] Set libraries count:', sorted.length);
      } else {
        console.log('[Home] API failed or no data:', response);
      }
    } catch (err) {
      console.error('[Home] Failed to load libraries:', err);
    } finally {
      setLoadingLibraries(false);
    }
  };

  const loadSelectedLibraries = async () => {
    if (!user) return;

    try {
      const response = await ApiCenter.learning.getSelectedCollections();
      if (response.success && response.data) {
        const collections = Array.isArray(response.data) ? response.data : (response.data.data || []);
        setSelectedLibraries(collections.slice(0, 3)); // Max 3 on home page
      }
    } catch (err) {
      console.error('[Home] Failed to load selected libraries:', err);
    }
  };

  // [GLOBAL SETTING] Filter word groups based on global learning languages
  useEffect(() => {
    if (!settings.language.learningLanguages || settings.language.learningLanguages.length === 0) {
      // No languages selected, show all groups
      setFilteredGroups(allGroups);
    } else {
      // Filter groups by selected learning languages
      const filtered = allGroups.filter(group =>
        settings.language.learningLanguages!.includes(group.language)
      );
      setFilteredGroups(filtered);
    }
  }, [settings.language.learningLanguages, allGroups]);

  // Unified Auth Guard
  const handleProtectedAction = (action: () => void) => {
      if (user) {
          action();
      } else {
          if (window.confirm(t('home.accountRequired'))) {
              navigate('login');
          }
      }
  };

  // Helper function to get user display name
  const getUserDisplayName = (user: any): string => {
    if (!user) return 'User';
    // Priority: nickname > name > username > email prefix > 'User'
    const displayName = user.nickname ||
                        user.name ||
                        user.username ||
                        user.email?.split('@')[0] ||
                        'User';
    return displayName.split(' ')[0]; // Only take first name
  };

  // [GLOBAL SETTING] Use global settings instead of user.learningLanguages
  const currentLangCode = settings.language.learningLanguages?.[0] || 'en';
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  // Get all learning languages from global settings
  const learningLanguages = (settings.language.learningLanguages || ['en']).map(code =>
    SUPPORTED_LANGUAGES.find(l => l.code === code) || { code, name: code, flag: '🌐' }
  );

  // Defensive: render only ever touches guaranteed arrays — a non-array from
  // any API/state path can never throw "x.map is not a function" here.
  const safeDailyWords = Array.isArray(dailyWords) ? dailyWords : [];
  const safeReviewQueue = Array.isArray(reviewQueue) ? reviewQueue : [];
  const safeRecommended = Array.isArray(recommendedLibraries) ? recommendedLibraries : [];
  const safeSelected = Array.isArray(selectedLibraries) ? selectedLibraries : [];
  const safeFilteredGroups = Array.isArray(filteredGroups) ? filteredGroups : [];
  const safeAllGroups = Array.isArray(allGroups) ? allGroups : [];

  return (
    <>
    <div className="ds-page ds-section-gap pb-32">
        {/* Welcome Section — app hero greeting + streak chip */}
        <div className="flex items-end justify-between gap-3 px-1 pt-1">
            <div className="min-w-0">
                <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
                     {user ? t('home.startLearning') : t('home.guestMode')}
                </span>
                <h1 className="text-[2.1rem] leading-[1.05] font-black tracking-tight mt-0.5 text-slate-900 dark:text-white">
                    {user ? t('home.hiUser').replace('{name}', getUserDisplayName(user)) : t('home.welcomeGuest')}
                </h1>
            </div>
            {user && (user.streak ?? 0) > 0 && (
                <div className="shrink-0 flex items-center gap-1.5 rounded-full px-3 py-2 ds-glass ds-glass-edge">
                    <Flame className="w-4 h-4 text-orange-500" aria-hidden />
                    <span className="text-sm font-black text-slate-800 dark:text-white">{user.streak}</span>
                </div>
            )}
        </div>

        {/* v4.0 Pill horizontal category menu (Today / Recommended) */}
        <PillNav
          aria-label={t('home.startLearning') || 'Sections'}
          items={[
            { id: 'today', label: t('home.startLearning') || 'Today' },
            { id: 'recommended', label: t('home.recommended') || 'Recommended' },
          ]}
          activeId={homeFilter}
          onChange={(id) => setHomeFilter(id as 'today' | 'recommended')}
        />

        {/* Language Selection Bar — sleek glass pill (app-style) */}
        <button
          onClick={() => navigate('settings_lang')}
          className="ds-glass ds-glass-edge w-full flex items-center justify-between gap-3 pl-2 pr-2.5 py-2 rounded-full text-left active:scale-[0.99] transition-transform"
        >
             <div className="flex items-center gap-2.5 flex-1 min-w-0">
                 {/* Multiple Language Flags */}
                 <div className="flex items-center -space-x-1">
                   {learningLanguages.map((lang) => (
                     <span
                       key={lang.code}
                       className="w-8 h-8 rounded-full bg-white/70 dark:bg-white/10 border border-white/50 dark:border-white/10 shadow-sm flex items-center justify-center text-lg"
                       title={lang.name}
                     >
                       {lang.flag || IconMappingService.getEmoji(
                         IconMappingService.getFlagIconName(lang.code)
                       )}
                     </span>
                   ))}
                 </div>

                 {/* Language Names */}
                 <div className="min-w-0 flex-1">
                     <div className="text-[9px] font-bold text-[var(--color-text-tertiary)] uppercase tracking-wide leading-none mb-0.5">
                       {t('home.targetLanguage')}
                     </div>
                     <div className="text-sm font-bold text-slate-800 dark:text-white leading-none truncate">
                       {learningLanguages.map(l => l.name).join(', ')}
                     </div>
                 </div>
             </div>

             <span className="ds-fab-grad flex-shrink-0 w-9 h-9 [&_svg]:w-4 [&_svg]:h-4" aria-hidden>
                 <Icons.Settings />
             </span>
        </button>

        {/* Daily Words Section */}
        {homeFilter === 'today' && user && (
          <div>
            <SectionTitle
              title={t('home.dailyWords') || 'Daily Words'}
              moreLabel={t('home.viewMore') || 'More'}
              onMore={() => navigate('dictionary')}
              className="mb-3 px-1"
            />

            {loadingDaily ? (
              <div className="ds-card flex items-center justify-center p-6">
                <Spinner size="sm" />
              </div>
            ) : safeDailyWords.length > 0 ? (
              <div
                className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
                style={{ marginInline: 'calc(var(--page-padding-h) * -1)', paddingInline: 'var(--page-padding-h)' }}
              >
                {safeDailyWords.map((word, index) => (
                  <button
                    key={word.id || index}
                    type="button"
                    onClick={() => navigate('word_detail', { wordId: word.id })}
                    className="snap-start shrink-0 w-40 ds-card !p-4 text-left flex flex-col gap-3 active:scale-[0.97] transition-transform"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 flex items-center justify-center shadow-inner border border-white/40 text-[var(--klein-blue)]">
                        {word.emoji || <Pencil className="w-5 h-5" aria-hidden />}
                      </div>
                      {index === 0 && (
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-yellow-100 text-yellow-700 rounded-full">
                          {t('home.new') || 'NEW'}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold text-slate-800 dark:text-white truncate">
                        {word.word || word.text}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {word.translation || word.meaning || t('home.noTranslation')}
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

        {/* Review Queue Section */}
        {homeFilter === 'today' && user && (
          <div>
            <SectionTitle
              title={t('home.reviewQueue') || 'Review Queue'}
              className="mb-3 px-1"
              action={
                <Badge tone="danger">
                  {safeReviewQueue.length > 0 ? `${safeReviewQueue.length}${safeReviewQueue.length >= 5 ? '+' : ''}` : '0'}
                </Badge>
              }
            />

            {loadingReview ? (
              <div className="ds-card flex items-center justify-center p-6">
                <Spinner size="sm" />
              </div>
            ) : safeReviewQueue.length > 0 ? (
              <button
                type="button"
                onClick={() => navigate('review')}
                className="w-full ds-card !p-4 flex items-center gap-4 text-left active:scale-[0.99] transition-transform bg-gradient-to-r from-orange-50/80 to-red-50/80 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200/50 dark:border-orange-700/50"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/40 dark:to-red-900/40 flex items-center justify-center shadow-inner border border-white/40 text-orange-500 shrink-0">
                  <Clock className="w-7 h-7" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-slate-800 dark:text-white">
                    {t('home.reviewAll') || 'Start Review Session'}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 truncate">
                    {safeReviewQueue.length}{safeReviewQueue.length >= 5 ? '+' : ''} {t('home.words') || 'words'} · {t('home.reviewQueue') || 'Review Queue'}
                  </div>
                </div>
                <div className="w-10 h-10 rounded-full bg-white/70 dark:bg-white/10 flex items-center justify-center text-orange-500 shrink-0">
                  <Icons.ChevronRight />
                </div>
              </button>
            ) : (
              <EmptyState
                icon={<CircleCheck className="w-10 h-10 text-emerald-500" aria-hidden />}
                title={t('home.noReviewNeeded') || 'All caught up!'}
                description={t('home.noReviewDescription') || 'No words need review right now'}
              />
            )}
          </div>
        )}

        {/* Recommended Vocabulary Libraries Section */}
        {homeFilter === 'recommended' && (
        <div>
          <SectionTitle
            title={t('home.recommendedLibraries') || 'Recommended Vocabulary'}
            moreLabel={t('home.viewMore') || 'More'}
            onMore={safeRecommended.length > 0 ? () => navigate('courses') : undefined}
            className="mb-3 px-1"
          />

          {loadingLibraries ? (
            <div className="ds-card flex items-center justify-center p-6">
              <Spinner size="sm" />
            </div>
          ) : safeRecommended.length > 0 ? (
            <div
              className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
              style={{ marginInline: 'calc(var(--page-padding-h) * -1)', paddingInline: 'var(--page-padding-h)' }}
            >
              {safeRecommended.map((library, index) => {
                const gradients = [
                  'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
                  'bg-[var(--klein-blue-soft)]',
                  'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
                  'from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20',
                  'from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20',
                  'from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20',
                ];
                const gradientClass = gradients[index % gradients.length];

                return (
                  <div
                    key={library.id}
                    className={`snap-start shrink-0 w-44 ds-card !p-3 relative overflow-hidden bg-gradient-to-br ${gradientClass} border border-white/40 dark:border-white/10 group`}
                  >
                    <div
                      onClick={() => navigate(`vocabulary_library/${library.id}`)}
                      className="cursor-pointer"
                    >
                      {/* Thumbnail — v4.0 transparent-media frame */}
                      <div className="ds-media-frame w-full aspect-square mb-3">
                        {library.thumbnail || library.cover_image ? (
                          <img
                            src={library.thumbnail || library.cover_image}
                            alt={library.name}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling!.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <span className={`text-4xl text-[var(--klein-blue)] ${library.thumbnail || library.cover_image ? 'hidden' : ''}`}>
                          {library.emoji || <BookOpen className="w-9 h-9" aria-hidden />}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-1 line-clamp-2 min-h-[2.5rem]">
                        {library.name}
                      </h3>

                      {/* Info */}
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium">{library.word_count || library.total_words} {t('home.words') || 'words'}</span>
                        {library.difficulty && (
                          <Badge tone="neutral">{library.difficulty}</Badge>
                        )}
                      </div>
                    </div>

                    {/* Add to Group Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!user) {
                          navigate('login');
                        } else {
                          setSelectedLibraryForGroup(library);
                          setShowAddToGroupModal(true);
                        }
                      }}
                      className="ds-glass ds-glass-edge absolute top-2 right-2 w-8 h-8 rounded-full shadow-md flex items-center justify-center text-[color:var(--klein-blue)] hover:bg-[color:var(--klein-blue)] hover:text-[color:var(--klein-on)] transition-all active:scale-95"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Icons.Library />}
              title="No recommended libraries available"
            />
          )}
        </div>
        )}

        {/* My Selected Libraries Section */}
        {homeFilter === 'today' && user && safeSelected.length > 0 && (
          <div>
            <SectionTitle
              title={t('home.myVocabulary') || 'My Vocabulary'}
              moreLabel={t('home.viewAll') || 'View All'}
              onMore={() => navigate('courses')}
              className="mb-3 px-1"
            />

            <div
              className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-1"
              style={{ marginInline: 'calc(var(--page-padding-h) * -1)', paddingInline: 'var(--page-padding-h)' }}
            >
              {safeSelected.map((library) => (
                <button
                  key={library.id}
                  type="button"
                  onClick={() => navigate('courses')}
                  className="snap-start shrink-0 w-44 ds-card !p-4 text-left flex flex-col gap-3 active:scale-[0.97] transition-transform bg-[var(--klein-blue-soft)]/30 border-[var(--klein-ring)]/30"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center shadow-inner border border-white/40 text-[var(--klein-blue)]">
                      <Check className="w-5 h-5" aria-hidden />
                    </div>
                    {library.level && (
                      <Badge tone="klein">{library.level}</Badge>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-bold text-slate-800 dark:text-white truncate">
                      {library.name}
                    </div>
                    <div className="text-xs text-slate-500 truncate mt-0.5">
                      {library.word_count || library.total_words} {t('library.words') || 'words'}{library.category ? ` · ${library.category}` : ''}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filtered Word Groups Section */}
        {/* [GLOBAL SETTING] Show filtered courses based on global settings */}
        {homeFilter === 'today' && user && settings.language.learningLanguages && settings.language.learningLanguages.length > 0 && (
          <div>
            <SectionTitle
              title={t('home.availableCourses')}
              subtitle={`${t('home.filteredBy')}: ${settings.language.learningLanguages.map(code =>
                SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code
              ).join(', ')}`}
              moreLabel={t('home.viewAll')}
              onMore={() => navigate('courses')}
              className="mb-3 px-1"
            />

            {safeFilteredGroups.length > 0 ? (
              <div className="ds-stack ds-stack-tight">
                {safeFilteredGroups.slice(0, 3).map(group => (
                  <div
                    key={group.id}
                    onClick={() => navigate('course_detail', { groupId: group.id })}
                    className="ds-row flex items-center justify-between p-4 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-[var(--klein-blue-soft)] flex items-center justify-center text-2xl shadow-inner border border-white/40 flex-shrink-0 text-[var(--klein-blue)]">
                        {group.coverImage || <BookOpen className="w-6 h-6" aria-hidden />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-[var(--klein-blue)] transition-colors">
                          {group.name}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">
                            {IconMappingService.getEmoji(
                              IconMappingService.getFlagIconName(group.language)
                            )} {group.count} {t('home.words')}
                          </span>
                          <span className="text-xs font-bold text-slate-400">· {group.progress}%</span>
                        </div>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-slate-400 group-hover:bg-[var(--klein-blue-soft)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                      <Icons.ChevronRight />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Icons.Book />}
                title={t('home.noCoursesForLanguages')}
                description={t('home.tryDifferentLanguages')}
                action={
                  <Button variant="bento" onClick={() => navigate('settings_lang')} className="w-auto ds-btn-bento-compact py-2 px-3">
                    {t('home.changeLanguages')}
                  </Button>
                }
              />
            )}
          </div>
        )}

        {/* Library / Active Course Section */}
        {homeFilter === 'today' && (
        <div>
            <SectionTitle
              title={user ? t('home.activeCourse') : t('home.library')}
              moreLabel={t('home.add')}
              onMore={() => handleProtectedAction(() => navigate('courses'))}
              className="mb-2 px-1"
            />

            {user ? (
                <div
                    onClick={() => navigate('course_detail', { groupId: activeGroupId })}
                    className="ds-card ds-card-elevated flex items-center justify-between p-5 cursor-pointer group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center text-3xl shadow-inner border border-white/40 text-[var(--klein-blue)]">
                            {activeGroup?.coverImage || <BookOpen className="w-7 h-7" aria-hidden />}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-[var(--klein-blue)] transition-colors">
                                {activeGroup?.name || t('home.loading')}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                               <ProgressBar value={activeGroup?.progress || 0} className="w-24" />
                               <span className="text-xs font-bold text-slate-400">{activeGroup?.progress}%</span>
                            </div>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-slate-400 group-hover:bg-[var(--klein-blue-soft)] group-hover:text-[var(--klein-blue)] transition-colors">
                        <Icons.ChevronRight />
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => handleProtectedAction(() => {})}
                    className="ds-empty p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/30 transition-colors group"
                >
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-[var(--klein-blue)] transition-colors">
                        <Icons.Book />
                    </div>
                    <span className="font-bold text-slate-500 group-hover:text-[var(--klein-blue)]">{t('home.selectWordBank')}</span>
                    <span className="text-xs text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-center">{t('home.loginRequired')}</span>
                </div>
            )}
        </div>
        )}

        {/* Study Modes Grid */}
        {homeFilter === 'today' && (
        <div className="ds-grid-breathing grid grid-cols-2 auto-rows-min">
            <div className="col-span-2">
                <h2 className="ds-section-title pl-1">{t('home.studyCenter')}</h2>
            </div>

            {/* Playlist Mode — base Card + personalized CTA gradient */}
            <Card
                onClick={() => handleProtectedAction(() => navigate('playlist', { groupId: activeGroupId }))}
                className="col-span-2 !p-5 !rounded-[var(--radius-card)] !border-none text-[color:var(--klein-on)] group relative overflow-hidden cursor-pointer"
            >
               <div className="absolute inset-0 -z-0" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}></div>
               <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl"></div>
               <div className="absolute -bottom-12 -left-8 w-36 h-36 bg-white/10 rounded-full blur-3xl"></div>
               <div className="relative z-10 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[10px] font-bold backdrop-blur-sm">{t('home.recommended')}</span>
                     </div>
                     <h3 className="font-bold text-2xl">{t('home.smartPlaylist')}</h3>
                     <p className="text-white/80 text-sm font-medium">{t('home.autoPlayReview')}</p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-white text-[color:var(--klein-blue)] flex items-center justify-center text-2xl shadow-lg group-active:scale-90 transition-transform">
                     {user ? <Play className="w-6 h-6 fill-current" aria-hidden /> : <div className="text-slate-400"><Icons.Lock /></div>}
                  </div>
               </div>
            </Card>

            {/* Study modes — reference bento tiles w/ gradient corner chip */}
            <BentoTile
                onClick={() => handleProtectedAction(() => navigate('flashcard_run', { groupId: activeGroupId }))}
                title={t('home.flashcards')}
                description={t('home.spacedRepetition')}
                chipIcon={<span className="text-base font-black">Aa</span>}
            >
              {!user && <div className="absolute top-3 right-3 text-[var(--color-text-tertiary)]"><Icons.Lock /></div>}
            </BentoTile>

            <BentoTile
                onClick={() => handleProtectedAction(() => navigate('reading_run', { groupId: activeGroupId }))}
                title={t('home.reading')}
                description={t('home.flowContext')}
                chipIcon={<Icons.Book />}
            >
              {!user && <div className="absolute top-3 right-3 text-[var(--color-text-tertiary)]"><Icons.Lock /></div>}
            </BentoTile>

            <BentoTile
                onClick={() => handleProtectedAction(() => navigate('quiz_run', { groupId: activeGroupId }))}
                title={t('home.quiz')}
                description={t('home.gamifiedTest')}
                chipIcon={<span className="text-lg font-black">?</span>}
            >
              {!user && <div className="absolute top-3 right-3 text-[var(--color-text-tertiary)]"><Icons.Lock /></div>}
            </BentoTile>

            <BentoTile
                onClick={() => handleProtectedAction(() => navigate('listening_player', { groupId: activeGroupId }))}
                title={t('home.passive')}
                description={t('home.audioLoop')}
                chipIcon={<Headphones className="w-5 h-5" aria-hidden />}
            >
              {!user && <div className="absolute top-3 right-3 text-[var(--color-text-tertiary)]"><Icons.Lock /></div>}
            </BentoTile>
        </div>
        )}

        {/* Progress Section */}
        {homeFilter === 'today' && (
        <div>
            <h2 className="ds-section-title pl-1 mb-3">{t('home.myProgress')}</h2>

            {user ? (
                <div className="ds-grid-breathing grid grid-cols-2">
                   <Card onClick={() => navigate('stats')} className="flex flex-col gap-3 cursor-pointer">
                      <span className="ds-bento-chip"><Flame className="w-5 h-5" aria-hidden /></span>
                      <Stat accent value={`${user.streak || 0} ${t('home.days')}`} label={t('home.currentStreak')} />
                   </Card>
                   <Card onClick={() => navigate('review_dashboard')} className="flex flex-col gap-3 cursor-pointer">
                      <span className="ds-bento-chip"><Brain className="w-5 h-5" aria-hidden /></span>
                      <Stat accent value="85%" label={t('home.retentionRate')} />
                   </Card>
                </div>
            ) : (
                <div className="rounded-[var(--radius-card)] p-7 text-center text-white relative overflow-hidden" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}>
                    <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/15 blur-2xl rounded-full"></div>
                    <div className="absolute -bottom-12 -left-10 w-36 h-36 bg-white/10 blur-3xl rounded-full"></div>
                    <h3 className="text-xl font-bold mb-2 relative z-10">{t('home.syncYourProgress')}</h3>
                    <p className="text-white/80 text-sm mb-6 relative z-10">{t('home.syncProgressDescription')}</p>
                    <button onClick={() => navigate('login')} className="relative z-10 inline-flex items-center justify-center px-6 py-3 rounded-full bg-white text-[var(--klein-blue)] font-bold shadow-lg hover:scale-[1.03] active:scale-95 transition-transform">
                        {t('home.loginNow')}
                    </button>
                </div>
            )}
        </div>
        )}
    </div>

      {/* Add to Group Modal */}
      {showAddToGroupModal && selectedLibraryForGroup && (
        <div className="fixed inset-0 ds-z-modal flex items-center justify-center p-4 animate-fade-in">
          <div
            className="ds-modal-backdrop absolute inset-0"
            onClick={() => setShowAddToGroupModal(false)}
          ></div>

          <div className="ds-modal-panel relative max-w-md w-full max-h-[80vh] overflow-hidden animate-slide-up">
            {/* Header */}
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                    {t('home.selectStudyGroup') || 'Select a recitation group'}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t('home.addLibraryToGroup', { name: selectedLibraryForGroup.name })
                      .replace('{name}', selectedLibraryForGroup.name) ||
                      `Which recitation group should "${selectedLibraryForGroup.name}" be added to?`}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mt-2">
                    <BookOpen className="w-3.5 h-3.5" aria-hidden /> {selectedLibraryForGroup.word_count || selectedLibraryForGroup.total_words} {t('home.words') || 'words'}
                  </p>
                </div>
                <button
                  onClick={() => setShowAddToGroupModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Groups List */}
            <div className="overflow-y-auto max-h-[400px] custom-scrollbar">
              <div className="p-6 space-y-3">
                {safeAllGroups.length > 0 ? (
                  safeAllGroups.map((group) => (
                    <button
                      key={group.id}
                      onClick={async () => {
                        setAddingToGroupId(group.id);
                        try {
                          const response = await ApiCenter.wordGroups.addLibraryToGroup({
                            gid: group.id,
                            library_id: selectedLibraryForGroup.id,
                          });

                          if (response.success) {
                            const wordsAdded = response.data?.words_added || 0;
                            setShowAddToGroupModal(false);
                            setAddingToGroupId(null);

                            // Show success message
                            const successMsg = t('home.wordsAddedSuccess', { count: wordsAdded })
                              .replace('{count}', String(wordsAdded)) ||
                              `Successfully added ${wordsAdded} words`;
                            alert(successMsg + '\n' + (t('home.addedToGroup', { name: group.name }).replace('{name}', group.name) || `Added to "${group.name}"`));
                          } else {
                            throw new Error(response.error?.message || 'Failed to add library to group');
                          }
                        } catch (error: any) {
                          console.error('Failed to add library to group:', error);
                          alert(error.message || 'Failed to add. Please try again.');
                        } finally {
                          setAddingToGroupId(null);
                        }
                      }}
                      disabled={addingToGroupId !== null}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all group ${
                        addingToGroupId === group.id
                          ? 'bg-[var(--klein-blue-soft)] border-[var(--klein-ring)] opacity-70'
                          : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-[var(--klein-blue-soft)] border border-slate-200 dark:border-slate-600 hover:border-[var(--klein-ring)]'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-[var(--klein-blue-soft)] flex items-center justify-center text-xl flex-shrink-0 text-[var(--klein-blue)]">
                        {group.coverImage || <BookOpen className="w-5 h-5" aria-hidden />}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-bold text-slate-800 dark:text-white truncate group-hover:text-[var(--klein-blue)] transition-colors">
                          {group.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {group.count} {t('home.words') || 'words'} · {group.progress}%
                        </div>
                      </div>
                      {addingToGroupId === group.id ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Spinner size="sm" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--klein-blue-soft)]0 group-hover:text-white transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl mx-auto mb-3 text-[var(--klein-blue)]">
                      <BookOpen className="w-6 h-6" aria-hidden />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                      {t('home.noGroupsYet') || 'No groups yet'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Create New Group */}
            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <Button
                variant="fluid"
                showPlay
                onClick={() => {
                  setShowAddToGroupModal(false);
                  navigate('group_management');
                }}
                className="shadow-lg hover:shadow-xl transition-shadow"
              >
                {t('home.createNewGroup') || 'Create New Group'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DashboardPage;
