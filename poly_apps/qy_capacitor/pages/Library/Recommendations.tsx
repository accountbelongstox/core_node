
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';
import { VocabularyRecommendation } from '../../types';
import { LanguageCenter } from '../../i18n/LanguageCenter';
import { SUPPORTED_LANGUAGES } from '../../services/mockData';

const RecommendationsPage = () => {
  const { navigate, t, user, settings } = useContext(AppContext);
  const [recommendations, setRecommendations] = useState<VocabularyRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      loadRecommendations();
    }
  }, [user, selectedLevel, selectedCategory, settings.language.learningLanguages]);

  const loadRecommendations = async () => {
    setLoading(true);
    try {
      const langCodes = settings.language.learningLanguages || ['en'];
      const response = await ApiCenter.learning.getRecommendations({
        lang_codes: langCodes,
        level: selectedLevel === 'all' ? undefined : selectedLevel,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
      });

      if (response.success && response.data) {
        setRecommendations(response.data.data);
        setAvailableLevels(response.data.filters.levels);
        setAvailableCategories(response.data.filters.categories);
      }
    } catch (err) {
      console.error('[Recommendations] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCollection = async (collectionId: number, isCurrentlySelected: boolean) => {
    try {
      const action = isCurrentlySelected ? 'deselect' : 'select';
      const response = await ApiCenter.learning.selectCollection(collectionId, action);

      if (response.success) {
        // Update local state
        setRecommendations(prev =>
          prev.map(rec =>
            rec.id === collectionId ? { ...rec, is_selected: !isCurrentlySelected } : rec
          )
        );
      } else {
        alert(response.error?.message || (isCurrentlySelected ? t('recommendations.deselectFailed') : t('recommendations.selectFailed')) || 'Operation failed');
      }
    } catch (err: any) {
      alert(err.message || t('recommendations.error') || 'An error occurred');
    }
  };

  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      exam: '📝',
      business: '💼',
      daily: '💬',
      travel: '✈️',
      technical: '💻',
      entertainment: '🎬',
      academic: '🎓',
    };
    return icons[category] || '📚';
  };

  const getDifficultyColor = (difficulty: number): string => {
    if (difficulty <= 2) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (difficulty <= 4) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  const getDifficultyLabel = (difficulty: number): string => {
    if (difficulty <= 2) return t('recommendations.beginner') || 'Beginner';
    if (difficulty <= 4) return t('recommendations.intermediate') || 'Intermediate';
    return t('recommendations.advanced') || 'Advanced';
  };

  if (!user) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-5">
        <div className="text-6xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
          {t('recommendations.loginRequired') || 'Login Required'}
        </h2>
        <p className="text-slate-500 text-center mb-6 max-w-xs">
          {t('recommendations.loginDescription') || 'Please login to access vocabulary recommendations'}
        </p>
        <button
          onClick={() => navigate('login')}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold hover:shadow-lg hover:scale-105 transition-all"
        >
          {t('auth.login') || 'Login'}
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('courses')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
          <Icons.Back />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold dark:text-white">{t('recommendations.title') || 'Recommended Collections'}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {t('recommendations.subtitle') || 'Curated vocabulary collections for your learning journey'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        {/* Level Filter */}
        {availableLevels.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">
              {t('recommendations.level') || 'Level'}
            </label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setSelectedLevel('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedLevel === 'all'
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:bg-white/80'
                }`}
              >
                {t('common.all') || 'All'}
              </button>
              {availableLevels.map((level) => (
                <button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    selectedLevel === level
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:bg-white/80'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category Filter */}
        {availableCategories.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-2 px-1">
              {t('recommendations.category') || 'Category'}
            </label>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:bg-white/80'
                }`}
              >
                {t('common.all') || 'All'}
              </button>
              {availableCategories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                    selectedCategory === category
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:bg-white/80'
                  }`}
                >
                  <span>{getCategoryIcon(category)}</span>
                  <span className="capitalize">{category}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center p-10">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm">{t('common.loading') || 'Loading...'}</span>
            </div>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-10">
            <div className="text-5xl mb-4">📚</div>
            <p className="text-slate-400 font-medium">
              {t('recommendations.noResults') || 'No recommendations found'}
            </p>
            <p className="text-xs text-slate-400 mt-2">
              {t('recommendations.tryDifferentFilters') || 'Try adjusting your filters'}
            </p>
          </div>
        ) : (
          recommendations.map((rec) => {
            const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === rec.lang_code);
            return (
              <Card key={rec.id} className="!p-5 group relative overflow-hidden">
                {/* Popular Badge */}
                {rec.is_popular && (
                  <div className="absolute top-3 right-3">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-lg shadow-sm">
                      ⭐ {t('recommendations.popular') || 'POPULAR'}
                    </span>
                  </div>
                )}

                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-3xl shadow-inner border border-white/40 shrink-0">
                    {getCategoryIcon(rec.category)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title & Language */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-lg dark:text-white leading-tight">
                        {rec.name}
                      </h3>
                      <span className="text-xl shrink-0">{langInfo?.flag || '🌍'}</span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-500 mb-3 line-clamp-2">
                      {rec.description}
                    </p>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {t('recommendations.words') || 'Words'}
                        </span>
                        <span className="text-sm font-bold text-slate-700 dark:text-white">
                          {rec.total_words.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {t('recommendations.level') || 'Level'}
                        </span>
                        <span className="text-sm font-bold text-slate-700 dark:text-white">
                          {rec.level}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">
                          {t('recommendations.days') || 'Est. Days'}
                        </span>
                        <span className="text-sm font-bold text-slate-700 dark:text-white">
                          ~{rec.estimated_days}
                        </span>
                      </div>
                    </div>

                    {/* Difficulty Badge */}
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${getDifficultyColor(rec.difficulty)}`}>
                        {getDifficultyLabel(rec.difficulty)}
                      </span>

                      {/* Select Button */}
                      <button
                        onClick={() => handleSelectCollection(rec.id, rec.is_selected)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          rec.is_selected
                            ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                            : 'bg-blue-500 text-white hover:shadow-lg hover:scale-105'
                        }`}
                      >
                        {rec.is_selected ? (
                          <>
                            ✓ {t('recommendations.selected') || 'Selected'}
                          </>
                        ) : (
                          t('recommendations.select') || 'Select'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default RecommendationsPage;
