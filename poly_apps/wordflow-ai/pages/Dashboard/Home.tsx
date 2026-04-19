
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
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
        setDailyWords(response.data);
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
        setReviewQueue(response.data.slice(0, 5)); // Show max 5 words
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
        const libraries = Array.isArray(response.data) ? response.data : (response.data.libraries || []);
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

  return (
    <>
    <div className="ds-stack pb-32">
        {/* Welcome Section */}
        <div className="mb-2">
            <span className="ds-section-label pl-1">
                 {user ? t('home.startLearning') : t('home.guestMode')}
            </span>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-400">
                {user ? t('home.hiUser').replace('{name}', getUserDisplayName(user)) : t('home.welcomeGuest')}
            </h1>
        </div>

        {/* Language Selection Bar — base: glass + edge */}
        <div className="ds-glass ds-glass-edge flex items-center justify-between p-3 rounded-[var(--radius-card)]">
             <div className="flex items-center gap-3 flex-1 min-w-0">
                 {/* Multiple Language Flags */}
                 <div className="flex items-center gap-1.5">
                   {learningLanguages.map((lang, index) => (
                     <span
                       key={lang.code}
                       className="text-2xl hover:scale-110 transition-transform cursor-pointer"
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
                     <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">
                       {t('home.targetLanguage')}
                     </div>
                     <div className="text-sm font-bold text-slate-800 dark:text-white leading-none truncate">
                       {learningLanguages.map(l => l.name).join(', ')}
                     </div>
                 </div>
             </div>

             <button
                onClick={() => navigate('settings_lang')}
                className="ds-glass ds-glass-sm p-2 rounded-xl border border-white/20 shadow-sm flex-shrink-0 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors"
             >
                 <Icons.Settings />
             </button>
        </div>

        {/* Daily Words Section */}
        {user && (
          <div>
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="ds-section-label">
                {t('home.dailyWords') || 'Daily Words'}
              </h2>
              <Button variant="bento" onClick={() => navigate('dictionary')} className="w-auto ds-btn-bento-compact py-2 px-3">
                {t('home.viewMore') || 'More'}
              </Button>
            </div>

            {loadingDaily ? (
              <div className="ds-card flex items-center justify-center p-6">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">{t('common.loading') || 'Loading...'}</span>
                </div>
              </div>
            ) : dailyWords.length > 0 ? (
              <div className="ds-grid-breathing grid grid-cols-1">
                {dailyWords.map((word, index) => (
                  <div
                    key={word.id || index}
                    onClick={() => navigate('word_detail', { wordId: word.id })}
                    className="ds-row flex items-center justify-between p-4 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900/30 dark:to-orange-900/30 flex items-center justify-center text-xl shadow-inner border border-white/40 flex-shrink-0">
                        {word.emoji || '📝'}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                            {word.word || word.text}
                          </span>
                          {index === 0 && (
                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-yellow-100 text-yellow-700 rounded">
                              {t('home.new') || 'NEW'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 truncate">
                          {word.translation || word.meaning || t('home.noTranslation')}
                        </span>
                      </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors flex-shrink-0">
                      <Icons.ChevronRight />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ds-empty p-6 flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                  📝
                </div>
                <span className="font-bold text-center text-sm">
                  {t('home.noDailyWords') || 'No daily words available'}
                </span>
                <span className="text-xs text-center">
                  {t('home.checkBackLater') || 'Check back later for new words'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Review Queue Section */}
        {user && (
          <div>
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="ds-section-label">
                {t('home.reviewQueue') || 'Review Queue'}
              </h2>
              <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                {reviewQueue.length > 0 ? `${reviewQueue.length}${reviewQueue.length >= 5 ? '+' : ''}` : '0'}
              </span>
            </div>

            {loadingReview ? (
              <div className="ds-card flex items-center justify-center p-6">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">{t('common.loading') || 'Loading...'}</span>
                </div>
              </div>
            ) : reviewQueue.length > 0 ? (
              <div className="ds-stack ds-stack-tight">
                {reviewQueue.map((word, index) => (
                  <div
                    key={word.id}
                    onClick={() => navigate('word_detail', { wordId: word.id })}
                    className="ds-row flex items-center justify-between p-4 cursor-pointer group bg-gradient-to-r from-orange-50/80 to-red-50/80 dark:from-orange-900/20 dark:to-red-900/20 border-orange-200/50 dark:border-orange-700/50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-100 to-red-100 dark:from-orange-900/40 dark:to-red-900/40 flex items-center justify-center text-xl shadow-inner border border-white/40 flex-shrink-0">
                        ⏰
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-base font-bold text-slate-800 dark:text-white truncate group-hover:text-orange-600 transition-colors">
                          {word.text}
                        </span>
                        <span className="text-xs text-slate-500 truncate">
                          {word.translation || t('home.noTranslation')}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {word.masteryLevel && (
                        <div className="px-2 py-1 rounded-lg bg-white/50 text-xs font-bold text-orange-600">
                          {word.masteryLevel}%
                        </div>
                      )}
                      <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-500 transition-colors">
                        <Icons.ChevronRight />
                      </div>
                    </div>
                  </div>
                ))}
                {reviewQueue.length >= 5 && (
                  <Button
                    variant="fluid"
                    showPlay
                    onClick={() => navigate('review')}
                  >
                    {t('home.reviewAll') || 'Start Review Session'}
                  </Button>
                )}
              </div>
            ) : (
              <div className="ds-empty p-6 flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl">
                  ✅
                </div>
                <span className="font-bold text-center text-sm">
                  {t('home.noReviewNeeded') || 'All caught up!'}
                </span>
                <span className="text-xs text-center">
                  {t('home.noReviewDescription') || 'No words need review right now'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Recommended Vocabulary Libraries Section */}
        <div>
          <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="ds-section-label">
              {t('home.recommendedLibraries') || 'RECOMMENDED VOCABULARY'}
            </h2>
            {recommendedLibraries.length > 0 && (
              <Button variant="bento" onClick={() => navigate('courses')} className="w-auto ds-btn-bento-compact py-2 px-3">
                {t('home.viewMore') || 'More'}
              </Button>
            )}
          </div>

          {loadingLibraries ? (
            <div className="ds-card p-6 text-center">
              <span className="text-slate-500">Loading vocabulary libraries...</span>
            </div>
          ) : recommendedLibraries.length > 0 ? (
            <div className="ds-grid-breathing grid grid-cols-2">
              {recommendedLibraries.map((library, index) => {
                const gradients = [
                  'from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20',
                  'from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20',
                  'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
                  'from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20',
                  'from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20',
                  'from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20',
                ];
                const gradientClass = gradients[index % gradients.length];
                const defaultThumbnail = '📚';

                return (
                  <div
                    key={library.id}
                    className={`ds-card relative overflow-hidden bg-gradient-to-br ${gradientClass} border border-white/40 dark:border-white/10 group`}
                  >
                    <div
                      onClick={() => navigate(`vocabulary_library/${library.id}`)}
                      className="p-4 cursor-pointer"
                    >
                      {/* Thumbnail */}
                      <div className="w-full aspect-square rounded-xl mb-3 overflow-hidden bg-white/50 dark:bg-black/20 flex items-center justify-center">
                        {library.thumbnail || library.cover_image ? (
                          <img
                            src={library.thumbnail || library.cover_image}
                            alt={library.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling!.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <span className={`text-4xl ${library.thumbnail || library.cover_image ? 'hidden' : ''}`}>
                          {library.emoji || defaultThumbnail}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-sm text-slate-800 dark:text-white mb-1 line-clamp-2 min-h-[2.5rem] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {library.name}
                      </h3>

                      {/* Info */}
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium">{library.word_count || library.total_words} words</span>
                        {library.difficulty && (
                          <span className="px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 font-bold">
                            {library.difficulty}
                          </span>
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
                      className="ds-glass ds-glass-edge absolute top-2 right-2 w-8 h-8 rounded-full shadow-md flex items-center justify-center text-purple-600 dark:text-purple-400 hover:bg-purple-500 hover:text-white transition-all hover:scale-110 active:scale-95"
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
            <div className="ds-card p-6 text-center">
              <span className="text-slate-500">No recommended libraries available</span>
            </div>
          )}
        </div>

        {/* My Selected Libraries Section */}
        {user && selectedLibraries.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="ds-section-label">
                {t('home.myVocabulary') || 'My Vocabulary'}
              </h2>
              <Button variant="bento" onClick={() => navigate('courses')} className="w-auto ds-btn-bento-compact py-2 px-3">
                {t('home.viewAll') || 'View All'}
              </Button>
            </div>

            <div className="ds-stack ds-stack-tight">
              {selectedLibraries.map((library) => (
                <div
                  key={library.id}
                  onClick={() => navigate('courses')}
                  className="ds-row flex items-center justify-between p-4 cursor-pointer group bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200/50 dark:border-blue-700/50"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center text-xl shadow-inner border border-white/40 flex-shrink-0">
                      ✓
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-base font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-600 transition-colors">
                        {library.name}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{library.word_count || library.total_words} {t('library.words') || 'words'}</span>
                        {library.level && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold">
                            {library.level}
                          </span>
                        )}
                        {library.category && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            {library.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors flex-shrink-0">
                    <Icons.ChevronRight />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtered Word Groups Section */}
        {/* [GLOBAL SETTING] Show filtered courses based on global settings */}
        {user && settings.language.learningLanguages && settings.language.learningLanguages.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-3 px-1">
              <div>
                <h2 className="ds-section-label">
                  {t('home.availableCourses')}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('home.filteredBy')}: {settings.language.learningLanguages.map(code =>
                    SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code
                  ).join(', ')}
                </p>
              </div>
              <Button variant="bento" onClick={() => navigate('courses')} className="w-auto ds-btn-bento-compact py-2 px-3">
                {t('home.viewAll')}
              </Button>
            </div>

            {filteredGroups.length > 0 ? (
              <div className="ds-stack ds-stack-tight">
                {filteredGroups.slice(0, 3).map(group => (
                  <div
                    key={group.id}
                    onClick={() => navigate('course_detail', { groupId: group.id })}
                    className="ds-row flex items-center justify-between p-4 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-2xl shadow-inner border border-white/40 flex-shrink-0">
                        {group.coverImage || '📚'}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-600 transition-colors">
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
                    <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors flex-shrink-0">
                      <Icons.ChevronRight />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ds-empty p-6 flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Icons.Book />
                </div>
                <span className="font-bold text-center">
                  {t('home.noCoursesForLanguages')}
                </span>
                <span className="text-xs text-center">
                  {t('home.tryDifferentLanguages')}
                </span>
                <Button variant="bento" onClick={() => navigate('settings_lang')} className="w-auto ds-btn-bento-compact py-2 px-3 mt-2">
                  {t('home.changeLanguages')}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Library / Active Course Section */}
        <div>
            <div className="flex justify-between items-center mb-2 px-1">
                <h2 className="ds-section-label">
                    {user ? t('home.activeCourse') : t('home.library')}
                </h2>
                <Button variant="bento" onClick={() => handleProtectedAction(() => navigate('courses'))} className="w-auto ds-btn-bento-compact py-2 px-3">
                  {t('home.add')}
                </Button>
            </div>

            {user ? (
                <div
                    onClick={() => navigate('course_detail', { groupId: activeGroupId })}
                    className="ds-card ds-card-elevated flex items-center justify-between p-5 cursor-pointer group"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-3xl shadow-inner border border-white/40">
                            {activeGroup?.coverImage || '📚'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-bold text-slate-800 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors">
                                {activeGroup?.name || t('home.loading')}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                               <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                   <div className="h-full bg-blue-500" style={{width: `${activeGroup?.progress || 0}%`}}></div>
                               </div>
                               <span className="text-xs font-bold text-slate-400">{activeGroup?.progress}%</span>
                            </div>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-white/50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500 transition-colors">
                        <Icons.ChevronRight />
                    </div>
                </div>
            ) : (
                <div
                    onClick={() => handleProtectedAction(() => {})}
                    className="ds-empty p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/30 transition-colors group"
                >
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors">
                        <Icons.Book />
                    </div>
                    <span className="font-bold text-slate-500 group-hover:text-blue-500">{t('home.selectWordBank')}</span>
                    <span className="text-xs text-slate-400 bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded text-center">{t('home.loginRequired')}</span>
                </div>
            )}
        </div>

        {/* Study Modes Grid */}
        <div className="ds-grid-breathing grid grid-cols-2 auto-rows-min">
            <div className="col-span-2 flex items-center justify-between">
                <h2 className="ds-section-label pl-1">{t('home.studyCenter')}</h2>
            </div>

            {/* Playlist Mode — base Card + personalized CTA gradient */}
            <Card
                onClick={() => handleProtectedAction(() => navigate('playlist', { groupId: activeGroupId }))}
                className="col-span-2 !p-5 !rounded-[var(--radius-card)] bg-gradient-to-r from-blue-500 to-indigo-600 !border-none text-white shadow-xl shadow-blue-500/20 group relative overflow-hidden cursor-pointer"
            >
               <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
               <div className="relative z-10 flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded-lg bg-white/20 text-[10px] font-bold backdrop-blur-sm">{t('home.recommended')}</span>
                     </div>
                     <h3 className="font-bold text-2xl">{t('home.smartPlaylist')}</h3>
                     <p className="text-blue-100 text-sm font-medium">{t('home.autoPlayReview')}</p>
                  </div>
                  <div className="w-14 h-14 rounded-full bg-white text-blue-600 flex items-center justify-center text-2xl shadow-lg group-active:scale-90 transition-transform">
                     {user ? '▶' : <div className="text-slate-400"><Icons.Lock /></div>}
                  </div>
               </div>
            </Card>

            {/* Flashcards */}
            <Card
                onClick={() => handleProtectedAction(() => navigate('flashcard_run', { groupId: activeGroupId }))}
                className="aspect-[4/3] flex flex-col justify-between group hover:border-blue-300 transition-colors cursor-pointer relative overflow-hidden"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl shadow-sm">
                Aa
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-white text-lg">{t('home.flashcards')}</div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">{t('home.spacedRepetition')}</div>
              </div>
              {!user && <div className="absolute top-3 right-3 text-slate-300"><Icons.Lock /></div>}
            </Card>

            {/* Reading Flow */}
            <Card
                onClick={() => handleProtectedAction(() => navigate('reading_run', { groupId: activeGroupId }))}
                className="aspect-[4/3] flex flex-col justify-between group hover:border-purple-300 transition-colors cursor-pointer relative"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-xl shadow-sm">
                 <Icons.Book />
              </div>
              <div>
                <div className="font-bold text-slate-800 dark:text-white text-lg">{t('home.reading')}</div>
                <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">{t('home.flowContext')}</div>
              </div>
              {!user && <div className="absolute top-3 right-3 text-slate-300"><Icons.Lock /></div>}
            </Card>

            {/* Quiz Mode */}
            <Card
                onClick={() => handleProtectedAction(() => navigate('quiz_run', { groupId: activeGroupId }))}
                className="aspect-[4/3] flex flex-col justify-between group hover:border-orange-300 transition-colors cursor-pointer relative"
            >
               <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-500 flex items-center justify-center text-xl shadow-sm">
                  ?
               </div>
               <div>
                  <div className="font-bold text-slate-800 dark:text-white text-lg">{t('home.quiz')}</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">{t('home.gamifiedTest')}</div>
               </div>
               {!user && <div className="absolute top-3 right-3 text-slate-300"><Icons.Lock /></div>}
            </Card>

            {/* Passive Listening */}
            <Card
                onClick={() => handleProtectedAction(() => navigate('listening_player', { groupId: activeGroupId }))}
                className="aspect-[4/3] flex flex-col justify-between group hover:border-pink-300 transition-colors cursor-pointer relative"
            >
               <div className="w-10 h-10 rounded-xl bg-pink-100 text-pink-500 flex items-center justify-center text-xl shadow-sm">
                  🎧
               </div>
               <div>
                  <div className="font-bold text-slate-800 dark:text-white text-lg">{t('home.passive')}</div>
                  <div className="text-[10px] text-slate-500 font-bold mt-1 uppercase">{t('home.audioLoop')}</div>
               </div>
               {!user && <div className="absolute top-3 right-3 text-slate-300"><Icons.Lock /></div>}
            </Card>
        </div>

        {/* Progress Section */}
        <div>
            <h2 className="ds-section-label pl-1 mb-2">{t('home.myProgress')}</h2>

            {user ? (
                <div className="ds-grid-breathing grid grid-cols-2">
                   <Card onClick={() => navigate('stats')} className="flex flex-col gap-2 cursor-pointer">
                      <div className="text-3xl mb-1">🔥</div>
                      <div className="font-bold dark:text-white text-xl">{user.streak || 0} {t('home.days')}</div>
                      <div className="text-xs text-slate-500">{t('home.currentStreak')}</div>
                   </Card>
                   <Card onClick={() => navigate('review_dashboard')} className="flex flex-col gap-2 cursor-pointer">
                      <div className="text-3xl mb-1">🧠</div>
                      <div className="font-bold dark:text-white text-xl">85%</div>
                      <div className="text-xs text-slate-500">{t('home.retentionRate')}</div>
                   </Card>
                </div>
            ) : (
                <div className="bg-slate-900 rounded-[2rem] p-6 text-center text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl rounded-full"></div>
                    <h3 className="text-xl font-bold mb-2 relative z-10">{t('home.syncYourProgress')}</h3>
                    <p className="text-slate-400 text-sm mb-6 relative z-10">{t('home.syncProgressDescription')}</p>
                    <Button onClick={() => navigate('login')} className="bg-white text-slate-900 shadow-none border-none hover:bg-slate-100 relative z-10">
                        {t('home.loginNow')}
                    </Button>
                </div>
            )}
        </div>
    </div>

      {/* Add to Group Modal */}
      {showAddToGroupModal && selectedLibraryForGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
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
                    {t('home.selectStudyGroup') || '选择背诵分组'}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {t('home.addLibraryToGroup', { name: selectedLibraryForGroup.name })
                      .replace('{name}', selectedLibraryForGroup.name) ||
                      `将"${selectedLibraryForGroup.name}"加入到哪个背诵分组？`}
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    📚 {selectedLibraryForGroup.word_count || selectedLibraryForGroup.total_words} {t('home.words') || '个单词'}
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
                {allGroups.length > 0 ? (
                  allGroups.map((group) => (
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
                              `成功添加 ${wordsAdded} 个单词`;
                            alert(successMsg + '\n' + (t('home.addedToGroup', { name: group.name }).replace('{name}', group.name) || `已添加到"${group.name}"`));
                          } else {
                            throw new Error(response.error?.message || 'Failed to add library to group');
                          }
                        } catch (error: any) {
                          console.error('Failed to add library to group:', error);
                          alert(error.message || '添加失败，请重试');
                        } finally {
                          setAddingToGroupId(null);
                        }
                      }}
                      disabled={addingToGroupId !== null}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl transition-all group ${
                        addingToGroupId === group.id
                          ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 opacity-70'
                          : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-slate-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/40 dark:to-indigo-900/40 flex items-center justify-center text-xl flex-shrink-0">
                        {group.coverImage || '📚'}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {group.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {group.count} {t('home.words') || 'words'} · {group.progress}%
                        </div>
                      </div>
                      {addingToGroupId === group.id ? (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            {t('common.loading') || '加载中...'}
                          </span>
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white dark:bg-slate-600 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-2xl mx-auto mb-3">
                      📚
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
