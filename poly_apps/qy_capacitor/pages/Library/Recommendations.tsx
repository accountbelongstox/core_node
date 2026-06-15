/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */

import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button, Spinner, EmptyState, BackButton, Badge } from '../../components/UI';
import { PillNav } from '../../components/PillNav';
import {
  FileText,
  Briefcase,
  MessageCircle,
  Plane,
  Laptop,
  Clapperboard,
  GraduationCap,
  BookOpen,
  Lock,
  Star,
  Globe,
  Check,
} from 'lucide-react';

type IconComponent = React.ComponentType<{ className?: string }>;

const CATEGORY_ICONS: Record<string, IconComponent> = {
  exam: FileText,
  business: Briefcase,
  daily: MessageCircle,
  travel: Plane,
  technical: Laptop,
  entertainment: Clapperboard,
  academic: GraduationCap,
};
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
        setRecommendations(Array.isArray(response.data.data) ? response.data.data : []);
        setAvailableLevels(Array.isArray(response.data.filters?.levels) ? response.data.filters.levels : []);
        setAvailableCategories(Array.isArray(response.data.filters?.categories) ? response.data.filters.categories : []);
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

  const getCategoryIcon = (category: string): IconComponent => {
    return CATEGORY_ICONS[category] || BookOpen;
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
        <div className="w-20 h-20 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)] mb-5"><Lock className="w-9 h-9" /></div>
        <h2 className="ds-section-title !text-xl mb-2">
          {t('recommendations.loginRequired') || 'Login Required'}
        </h2>
        <p className="text-[var(--color-text-secondary)] text-center mb-7 max-w-xs text-sm leading-relaxed">
          {t('recommendations.loginDescription') || 'Please login to access vocabulary recommendations'}
        </p>
        <div className="w-full max-w-xs">
          <Button variant="grad" onClick={() => navigate('login')}>
            {t('auth.login') || 'Login'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <BackButton onClick={() => navigate('courses')} />
        <div className="flex-1 min-w-0">
          <h1 className="ds-section-title !text-2xl truncate">{t('recommendations.title') || 'Recommended Collections'}</h1>
          <p className="ds-section-sub truncate">
            {t('recommendations.subtitle') || 'Curated vocabulary collections for your learning journey'}
          </p>
        </div>
      </div>

      {/* Filters — v4.0 pill category bars */}
      <div className="mb-7 ds-stack-tight flex flex-col">
        {/* Level Filter */}
        {Array.isArray(availableLevels) && availableLevels.length > 0 && (
          <div>
            <label className="ds-section-label block mb-2 px-1">
              {t('recommendations.level') || 'Level'}
            </label>
            <PillNav
              items={[
                { id: 'all', label: t('common.all') || 'All' },
                ...availableLevels.map((level) => ({ id: level, label: level })),
              ]}
              activeId={selectedLevel}
              onChange={setSelectedLevel}
              aria-label={t('recommendations.level') as string}
              className="!px-0"
            />
          </div>
        )}

        {/* Category Filter */}
        {Array.isArray(availableCategories) && availableCategories.length > 0 && (
          <div>
            <label className="ds-section-label block mb-2 px-1">
              {t('recommendations.category') || 'Category'}
            </label>
            <PillNav
              items={[
                { id: 'all', label: t('common.all') || 'All' },
                ...availableCategories.map((category) => {
                  const CatIcon = getCategoryIcon(category);
                  return {
                    id: category,
                    label: (
                      <span className="flex items-center gap-1.5">
                        <CatIcon className="w-4 h-4" />
                        <span className="capitalize">{category}</span>
                      </span>
                    ),
                  };
                }),
              ]}
              activeId={selectedCategory}
              onChange={setSelectedCategory}
              aria-label={t('recommendations.category') as string}
              className="!px-0"
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 ds-stack">
        {loading ? (
          <Spinner size="lg" className="mx-auto my-10" />
        ) : !Array.isArray(recommendations) || recommendations.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-12 h-12" strokeWidth={1.5} />}
            title={t('recommendations.noResults') || 'No recommendations found'}
            description={t('recommendations.tryDifferentFilters') || 'Try adjusting your filters'}
          />
        ) : (
          recommendations.map((rec) => {
            const langInfo = SUPPORTED_LANGUAGES.find(l => l.code === rec.lang_code);
            const RecIcon = getCategoryIcon(rec.category);
            return (
              <Card key={rec.id} className="!p-5 group relative overflow-hidden">
                {/* Popular Badge */}
                {rec.is_popular && (
                  <div className="absolute top-3 right-3 z-20">
                    <Badge tone="klein" className="gap-1"><Star className="w-3 h-3" fill="currentColor" /> {t('recommendations.popular') || 'POPULAR'}</Badge>
                  </div>
                )}

                <div className="flex gap-4">
                  {/* Icon */}
                  <div className="ds-media-frame w-16 h-16 shrink-0 flex items-center justify-center text-[var(--klein-blue)]">
                    <RecIcon className="w-7 h-7" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title & Language */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-lg dark:text-white leading-tight">
                        {rec.name}
                      </h3>
                      {langInfo?.flag
                        ? <span className="text-xl shrink-0">{langInfo.flag}</span>
                        : <Globe className="w-5 h-5 shrink-0 text-[var(--color-text-tertiary)]" />}
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
                        className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all min-h-[var(--touch-min)] active:scale-[0.98] ${
                          rec.is_selected
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                            : 'text-[color:var(--klein-on)]'
                        }`}
                        style={rec.is_selected ? undefined : { background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
                      >
                        {rec.is_selected ? (
                          <span className="inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> {t('recommendations.selected') || 'Selected'}
                          </span>
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
