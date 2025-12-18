
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
import { Header } from '../../components/Header';
import { api } from '../../services/api';
import { WordGroup, Word } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../services/mockData';
import { IconMappingService } from '../../services/IconMappingService';
import { ApiCenter } from '../../services/ApiCenter';

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

  useEffect(() => {
    if (user) {
      api.getWordGroups().then(groups => {
          setAllGroups(groups);
          const found = groups.find(g => g.id === activeGroupId) || groups[0];
          setActiveGroup(found);
      });

      // Load daily words
      loadDailyWords();

      // Load review queue
      loadReviewQueue();

      // Load selected vocabulary libraries
      loadSelectedLibraries();
    }
  }, [user, activeGroupId]);

  // Load recommended vocabulary libraries based on learning languages
  // Always load recommendations (fallback to 'english' if no languages selected)
  useEffect(() => {
    loadRecommendedLibraries();
  }, [settings.language.learningLanguages]);

  const loadDailyWords = async () => {
    setLoadingDaily(true);
    try {
      const response = await ApiCenter.words.getDailyWords(5);
      if (response.success && response.data) {
        setDailyWords(response.data);
      }
    } catch (err) {
      console.error('[Home] Failed to load daily words:', err);
    } finally {
      setLoadingDaily(false);
    }
  };

  const loadReviewQueue = async () => {
    setLoadingReview(true);
    try {
      const response = await ApiCenter.learning.getReviewQueue();
      if (response.success && response.data) {
        setReviewQueue(response.data.slice(0, 5)); // Show max 5 words
      }
    } catch (err) {
      console.error('[Home] Failed to load review queue:', err);
    } finally {
      setLoadingReview(false);
    }
  };

  const loadRecommendedLibraries = async () => {
    console.log('[Home] Loading recommended libraries...');
    console.log('[Home] Learning languages:', settings.language.learningLanguages);
    setLoadingLibraries(true);
    try {
      // Get first learning language for recommendations
      const language = settings.language.learningLanguages?.[0] || 'english';
      console.log('[Home] Using language:', language);
      const response = await ApiCenter.vocabulary.getRecommendedLibraries({ language, limit: 5 });
      console.log('[Home] API response:', response);

      if (response.success && response.data) {
        // API returns { success, data: { libraries: [...] } }
        const libraries = Array.isArray(response.data) ? response.data : (response.data.libraries || []);
        console.log('[Home] Extracted libraries:', libraries);
        setRecommendedLibraries(libraries.slice(0, 5)); // Max 5 recommendations
        console.log('[Home] Set recommended libraries count:', libraries.length);
      } else {
        console.log('[Home] API failed or no data:', response);
      }
    } catch (err) {
      console.error('[Home] Failed to load recommended libraries:', err);
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

  // [GLOBAL SETTING] Use global settings instead of user.learningLanguages
  const currentLangCode = settings.language.learningLanguages?.[0] || 'en';
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="h-full flex flex-col bg-[#f8fafc] dark:bg-slate-950">
      <Header />

      {/* Scrollable Content Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pt-24 pb-32 animate-slide-up">
        {/* Welcome Section */}
        <div className="mb-6">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">
                 {user ? t('home.startLearning') : t('home.guestMode')}
            </span>
            <h1 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-white dark:to-slate-400">
                {user ? t('home.hiUser').replace('{name}', (user.name || user.nickname || user.username || 'User').split(' ')[0]) : t('home.welcomeGuest')}
            </h1>
        </div>

        {/* Language Selection Bar */}
        <div className="flex items-center justify-between bg-white/50 dark:bg-slate-800/50 p-3 rounded-2xl border border-white/40 backdrop-blur-sm mb-8 shadow-sm">
             <div className="flex items-center gap-3">
                 <span className="text-2xl">
                   {currentLang.flag || IconMappingService.getEmoji(
                     IconMappingService.getFlagIconName(currentLangCode)
                   )}
                 </span>
                 <div>
                     <div className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">{t('home.targetLanguage')}</div>
                     <div className="text-sm font-bold text-slate-800 dark:text-white leading-none">{currentLang.name}</div>
                 </div>
             </div>

             <button
                onClick={() => navigate('settings_lang')}
                className="p-2 rounded-xl bg-white/60 dark:bg-slate-700/60 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border border-white/20 shadow-sm"
             >
                 <Icons.Settings />
             </button>
        </div>

        {/* Daily Words Section */}
        {user && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                {t('home.dailyWords') || 'Daily Words'}
              </h2>
              <button
                onClick={() => navigate('dictionary')}
                className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg"
              >
                {t('home.viewMore') || 'More'}
              </button>
            </div>

            {loadingDaily ? (
              <div className="flex items-center justify-center p-6 rounded-[2rem] bg-white/60 dark:bg-slate-800/60 border border-white/40 backdrop-blur-md">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">{t('common.loading') || 'Loading...'}</span>
                </div>
              </div>
            ) : dailyWords.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {dailyWords.map((word, index) => (
                  <div
                    key={word.id || index}
                    onClick={() => navigate('word_detail', { wordId: word.id })}
                    className="flex items-center justify-between p-4 rounded-[1.5rem] bg-white/60 dark:bg-slate-800/60 border border-white/40 backdrop-blur-md cursor-pointer hover:scale-[1.01] transition-all shadow-sm group"
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
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-2xl">
                  📝
                </div>
                <span className="font-bold text-slate-500 text-center text-sm">
                  {t('home.noDailyWords') || 'No daily words available'}
                </span>
                <span className="text-xs text-slate-400 text-center">
                  {t('home.checkBackLater') || 'Check back later for new words'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Review Queue Section */}
        {user && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                {t('home.reviewQueue') || 'Review Queue'}
              </h2>
              <span className="text-xs font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-lg">
                {reviewQueue.length > 0 ? `${reviewQueue.length}${reviewQueue.length >= 5 ? '+' : ''}` : '0'}
              </span>
            </div>

            {loadingReview ? (
              <div className="flex items-center justify-center p-6 rounded-[2rem] bg-white/60 dark:bg-slate-800/60 border border-white/40 backdrop-blur-md">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-sm">{t('common.loading') || 'Loading...'}</span>
                </div>
              </div>
            ) : reviewQueue.length > 0 ? (
              <div className="space-y-3">
                {reviewQueue.map((word, index) => (
                  <div
                    key={word.id}
                    onClick={() => navigate('word_detail', { wordId: word.id })}
                    className="flex items-center justify-between p-4 rounded-[1.5rem] bg-gradient-to-r from-orange-50/80 to-red-50/80 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200/50 dark:border-orange-700/50 backdrop-blur-md cursor-pointer hover:scale-[1.01] transition-all shadow-sm group"
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
                  <button
                    onClick={() => navigate('review')}
                    className="w-full p-3 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 transition-colors shadow-md"
                  >
                    {t('home.reviewAll') || 'Start Review Session'}
                  </button>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-2xl">
                  ✅
                </div>
                <span className="font-bold text-slate-500 text-center text-sm">
                  {t('home.noReviewNeeded') || 'All caught up!'}
                </span>
                <span className="text-xs text-slate-400 text-center">
                  {t('home.noReviewDescription') || 'No words need review right now'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Recommended Vocabulary Libraries Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-3 px-1">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              {t('home.recommendedLibraries') || 'RECOMMENDED VOCABULARY'}
            </h2>
            {recommendedLibraries.length > 0 && (
              <button
                onClick={() => navigate('recommendations')}
                className="text-xs font-bold text-purple-500 bg-purple-50 px-2 py-1 rounded-lg"
              >
                {t('home.viewMore') || 'More'}
              </button>
            )}
          </div>

          {loadingLibraries ? (
            <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800 text-center">
              <span className="text-slate-500">Loading vocabulary libraries...</span>
            </div>
          ) : recommendedLibraries.length > 0 ? (
            <div className="space-y-3">
              {recommendedLibraries.map((library) => (
                <div
                  key={library.id}
                  onClick={() => navigate('recommendations')}
                  className="flex items-center justify-between p-4 rounded-[1.5rem] bg-gradient-to-r from-purple-50/80 to-pink-50/80 dark:from-purple-900/20 dark:to-pink-900/20 border border-purple-200/50 dark:border-purple-700/50 backdrop-blur-md cursor-pointer hover:scale-[1.01] transition-all shadow-sm group"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/40 dark:to-pink-900/40 flex items-center justify-center text-xl shadow-inner border border-white/40 flex-shrink-0">
                      📚
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-base font-bold text-slate-800 dark:text-white truncate group-hover:text-purple-600 transition-colors">
                        {library.name}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{library.word_count || library.total_words} {t('library.words') || 'words'}</span>
                        {library.difficulty && (
                          <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold">
                            {library.difficulty}
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
                  <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-500 transition-colors flex-shrink-0">
                    <Icons.ChevronRight />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* My Selected Libraries Section */}
        {user && selectedLibraries.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3 px-1">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                {t('home.myVocabulary') || 'My Vocabulary'}
              </h2>
              <button
                onClick={() => navigate('courses')}
                className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg"
              >
                {t('home.viewAll') || 'View All'}
              </button>
            </div>

            <div className="space-y-3">
              {selectedLibraries.map((library) => (
                <div
                  key={library.id}
                  onClick={() => navigate('courses')}
                  className="flex items-center justify-between p-4 rounded-[1.5rem] bg-gradient-to-r from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-700/50 backdrop-blur-md cursor-pointer hover:scale-[1.01] transition-all shadow-sm group"
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
          <div className="mb-8">
            <div className="flex justify-between items-center mb-3 px-1">
              <div>
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                  {t('home.availableCourses')}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {t('home.filteredBy')}: {settings.language.learningLanguages.map(code =>
                    SUPPORTED_LANGUAGES.find(l => l.code === code)?.name || code
                  ).join(', ')}
                </p>
              </div>
              <button
                onClick={() => navigate('courses')}
                className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg"
              >
                {t('home.viewAll')}
              </button>
            </div>

            {filteredGroups.length > 0 ? (
              <div className="space-y-3">
                {filteredGroups.slice(0, 3).map(group => (
                  <div
                    key={group.id}
                    onClick={() => navigate('course_detail', { groupId: group.id })}
                    className="flex items-center justify-between p-4 rounded-[1.5rem] bg-white/60 dark:bg-slate-800/60 border border-white/40 backdrop-blur-md cursor-pointer hover:scale-[1.01] transition-all shadow-sm group"
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
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                  <Icons.Book />
                </div>
                <span className="font-bold text-slate-500 text-center">
                  {t('home.noCoursesForLanguages')}
                </span>
                <span className="text-xs text-slate-400 text-center">
                  {t('home.tryDifferentLanguages')}
                </span>
                <button
                  onClick={() => navigate('settings_lang')}
                  className="mt-2 text-xs font-bold text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg"
                >
                  {t('home.changeLanguages')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Library / Active Course Section */}
        <div className="mb-8">
            <div className="flex justify-between items-center mb-2 px-1">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                    {user ? t('home.activeCourse') : t('home.library')}
                </h2>
                <button
                    onClick={() => handleProtectedAction(() => navigate('courses'))}
                    className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg"
                >
                    {t('home.add')}
                </button>
            </div>

            {user ? (
                <div
                    onClick={() => navigate('course_detail', { groupId: activeGroupId })}
                    className="flex items-center justify-between p-5 rounded-[2rem] bg-gradient-to-br from-white/60 to-white/30 dark:from-slate-800/60 dark:to-slate-900/40 border border-white/40 backdrop-blur-md cursor-pointer hover:scale-[1.01] transition-all shadow-lg shadow-blue-500/5 group"
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
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/30 transition-colors group"
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
        <div className="grid grid-cols-2 gap-4 auto-rows-min mb-8">
            <div className="col-span-2 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1">{t('home.studyCenter')}</h2>
            </div>

            {/* Playlist Mode */}
            <Card
                onClick={() => handleProtectedAction(() => navigate('playlist', { groupId: activeGroupId }))}
                className="col-span-2 !p-5 bg-gradient-to-r from-blue-500 to-indigo-600 !border-none text-white shadow-xl shadow-blue-500/20 group relative overflow-hidden cursor-pointer"
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
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1 mb-2">{t('home.myProgress')}</h2>

            {user ? (
                <div className="grid grid-cols-2 gap-4">
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
    </div>
  );
};

export default DashboardPage;
