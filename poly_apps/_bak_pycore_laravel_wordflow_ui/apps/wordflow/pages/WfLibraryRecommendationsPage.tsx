/* [v4.1-Iris] Recommendations — ported from
 * qy_capacitor/pages/Library/Recommendations.tsx. Self-contained for the shell:
 * loads recommended libraries from wordflowApi.getRecommendedLibraries() (cross-
 * checked against getSelectedCollections()), derives level/category facets from
 * the result, and filters client-side. Select/deselect is server-backed via
 * wordflowApi.selectCollection() (original ApiCenter.learning.selectCollection);
 * each card also offers Add-to-Group via the shared WfAddToLibrarySheet.
 * Anonymous browsing is allowed (the endpoint is public since 2026-06-12 and
 * serves is_selected=false to guests); Select/Deselect and Add-to-Group are
 * gated through useWfProtectedAction (Sheet-based login confirm). Uses
 * react-router useNavigate + wfPath() for nav and the shared Iris primitives
 * in WfUI. Pill filter rows (.ds-pill-nav/.ds-pill-chip), not <select>.
 * Faithful to design-reference-{light,dark}.webp. */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Briefcase,
  MessageCircle,
  Plane,
  Laptop,
  Clapperboard,
  GraduationCap,
  BookOpen,
  Star,
  Globe,
  Check,
  Plus,
} from 'lucide-react';
import { wordflowApi, type VocabularyRecommendation } from '../../../core/api-libs/wordflow/WordflowApi';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { Card, Spinner, EmptyState, BackButton, Badge } from '../WfUI';
import { notify } from '../../../core/notify/notify';
import { useWfProtectedAction } from '../hooks/useWfProtectedAction';
import WfAddToLibrarySheet, {
  type WfAddToLibraryContent,
} from '../components/WfAddToLibrarySheet';

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

const LANG_FLAGS: Record<string, string> = {
  en: '🇬🇧',
  zh: '🇨🇳',
  ja: '🇯🇵',
  ko: '🇰🇷',
  fr: '🇫🇷',
  es: '🇪🇸',
  de: '🇩🇪',
};

const WfLibraryRecommendationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, user } = useWfApp();

  const [recommendations, setRecommendations] = useState<VocabularyRecommendation[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectingId, setSelectingId] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [addSheetContent, setAddSheetContent] = useState<WfAddToLibraryContent | null>(null);
  const { runProtected, loginConfirmSheet } = useWfProtectedAction();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        // GET /learning/recommendations is public since 2026-06-12: anonymous
        // users browse the same list with is_selected=false. Cross-check the
        // is_selected flags against the user's actual selected collections
        // (the recommendation list may be served from a longer-lived cache);
        // guests skip that call.
        const [list, selected] = await Promise.all([
          wordflowApi.getRecommendedLibraries(),
          user
            ? wordflowApi.getSelectedCollections().catch(() => [] as any[])
            : Promise.resolve([] as any[]),
        ]);
        if (cancelled) return;
        const items = Array.isArray(list) ? list : [];
        const selectedSet = new Set<number>(items.filter((r) => r.is_selected).map((r) => r.id));
        for (const s of Array.isArray(selected) ? selected : []) {
          const sid = Number(s?.id ?? s?.collection_id ?? s?.library_id);
          if (!Number.isNaN(sid)) selectedSet.add(sid);
        }
        setRecommendations(items);
        setSelectedIds(selectedSet);
      } catch (err) {
        console.error('[WfRecommendations] Failed to load:', err);
        if (!cancelled) setRecommendations([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const availableLevels = useMemo(
    () => Array.from(new Set(recommendations.map((r) => r.level).filter(Boolean))),
    [recommendations]
  );
  const availableCategories = useMemo(
    () => Array.from(new Set(recommendations.map((r) => r.category).filter(Boolean))),
    [recommendations]
  );

  const filtered = recommendations.filter(
    (r) =>
      (selectedLevel === 'all' || r.level === selectedLevel) &&
      (selectedCategory === 'all' || r.category === selectedCategory)
  );

  // Server-backed select/deselect (original ApiCenter.learning.selectCollection),
  // auth-gated via useWfProtectedAction (anonymous taps get the login Sheet).
  const handleToggleSelect = (id: number) =>
    runProtected(async () => {
      const isCurrentlySelected = selectedIds.has(id);
      setSelectingId(id);
      try {
        await wordflowApi.selectCollection({ collection_id: id, selected: !isCurrentlySelected });
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (isCurrentlySelected) next.delete(id);
          else next.add(id);
          return next;
        });
        setRecommendations((prev) =>
          prev.map((rec) => (rec.id === id ? { ...rec, is_selected: !isCurrentlySelected } : rec))
        );
      } catch (err: any) {
        notify.error(
          err?.message ||
            (isCurrentlySelected
              ? t('recommendations.deselectFailed') || 'Failed to deselect collection'
              : t('recommendations.selectFailed') || 'Failed to select collection') ||
            (t('recommendations.error') || 'An error occurred')
        );
      } finally {
        setSelectingId(null);
      }
    });

  // Add-to-Group — shared WfAddToLibrarySheet, auth-gated.
  const handleAddToGroup = (rec: VocabularyRecommendation) =>
    runProtected(() => setAddSheetContent({ kind: 'library', id: rec.id, name: rec.name }));

  const getCategoryIcon = (category: string): IconComponent => CATEGORY_ICONS[category] || BookOpen;

  // /learning/recommendations serves a numeric difficulty (1-5); since the
  // 2026-06-12 real-data rewrite the rows mirror the real libraries, whose
  // difficulty may also arrive as a string ('beginner'|'intermediate'|
  // 'advanced'). Normalize both to a 1-5 rank before bucketing.
  const difficultyRank = (difficulty: number | string): number => {
    if (typeof difficulty === 'number') return difficulty;
    const key = String(difficulty).toLowerCase();
    if (key === 'beginner') return 1;
    if (key === 'intermediate') return 3;
    if (key === 'advanced') return 5;
    const n = Number(difficulty);
    return Number.isNaN(n) ? 3 : n;
  };

  const getDifficultyColor = (difficulty: number | string): string => {
    const rank = difficultyRank(difficulty);
    if (rank <= 2) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (rank <= 4) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  const getDifficultyLabel = (difficulty: number | string): string => {
    const rank = difficultyRank(difficulty);
    if (rank <= 2) return t('recommendations.beginner') || 'Beginner';
    if (rank <= 4) return t('recommendations.intermediate') || 'Intermediate';
    return t('recommendations.advanced') || 'Advanced';
  };

  // No full-page login gate anymore: the endpoint is public, anonymous users
  // browse freely; only Select/Deselect and Add-to-Group are auth-gated.
  return (
    <div className="ds-page route-fade flex flex-col pt-12 pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <BackButton onClick={() => navigate(wfPath('courses'))} />
        <div className="flex-1 min-w-0">
          <h1 className="ds-section-title !text-2xl truncate">
            {t('recommendations.title') || 'Recommended Collections'}
          </h1>
          <p className="ds-section-sub truncate">
            {t('recommendations.subtitle') || 'Curated vocabulary collections for your learning journey'}
          </p>
        </div>
      </div>

      {/* Filters — pill category bars */}
      <div className="mb-7 ds-stack-tight flex flex-col">
        {availableLevels.length > 0 && (
          <div>
            <label className="ds-section-label block mb-2 px-1">{t('recommendations.level') || 'Level'}</label>
            <div className="ds-pill-nav" role="tablist" aria-label="Level">
              {['all', ...availableLevels].map((level) => (
                <button
                  key={level}
                  type="button"
                  role="tab"
                  aria-selected={selectedLevel === level}
                  onClick={() => setSelectedLevel(level)}
                  className={`ds-pill-chip ${selectedLevel === level ? 'is-active' : ''}`}
                >
                  {level === 'all' ? t('common.all') || 'All' : level}
                </button>
              ))}
            </div>
          </div>
        )}

        {availableCategories.length > 0 && (
          <div>
            <label className="ds-section-label block mb-2 px-1">{t('recommendations.category') || 'Category'}</label>
            <div className="ds-pill-nav" role="tablist" aria-label="Category">
              {['all', ...availableCategories].map((category) => {
                if (category === 'all') {
                  return (
                    <button
                      key="all"
                      type="button"
                      role="tab"
                      aria-selected={selectedCategory === 'all'}
                      onClick={() => setSelectedCategory('all')}
                      className={`ds-pill-chip ${selectedCategory === 'all' ? 'is-active' : ''}`}
                    >
                      {t('common.all') || 'All'}
                    </button>
                  );
                }
                const CatIcon = getCategoryIcon(category);
                return (
                  <button
                    key={category}
                    type="button"
                    role="tab"
                    aria-selected={selectedCategory === category}
                    onClick={() => setSelectedCategory(category)}
                    className={`ds-pill-chip ${selectedCategory === category ? 'is-active' : ''}`}
                  >
                    <CatIcon className="w-4 h-4" />
                    <span className="capitalize">{category}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 ds-stack">
        {loading ? (
          <Spinner size="lg" className="mx-auto my-10" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<BookOpen strokeWidth={1.5} />}
            title={t('recommendations.noResults') || 'No recommendations found'}
            description={t('recommendations.tryDifferentFilters') || 'Try adjusting your filters'}
          />
        ) : (
          filtered.map((rec) => {
            const flag = LANG_FLAGS[rec.lang_code];
            const RecIcon = getCategoryIcon(rec.category);
            const isSelected = selectedIds.has(rec.id);
            return (
              <Card key={rec.id} className="!p-5 group relative overflow-hidden">
                {rec.is_popular && (
                  <div className="absolute top-3 right-3 z-20">
                    <Badge tone="klein" className="gap-1">
                      <Star className="w-3 h-3" fill="currentColor" /> {t('recommendations.popular') || 'POPULAR'}
                    </Badge>
                  </div>
                )}

                <div className="flex gap-4">
                  <div className="ds-media-frame w-16 h-16 shrink-0 flex items-center justify-center text-[var(--klein-blue)]">
                    <RecIcon className="w-7 h-7" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-lg dark:text-white leading-tight">{rec.name}</h3>
                      {flag ? (
                        <span className="text-xl shrink-0">{flag}</span>
                      ) : (
                        <Globe className="w-5 h-5 shrink-0 text-[var(--color-text-tertiary)]" />
                      )}
                    </div>

                    <p className="text-xs text-[var(--color-text-secondary)] mb-3 line-clamp-2">{rec.description}</p>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] font-bold uppercase">
                          {t('recommendations.words') || 'Words'}
                        </span>
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">
                          {(rec.total_words ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] font-bold uppercase">
                          {t('recommendations.level') || 'Level'}
                        </span>
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">{rec.level}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-[var(--color-text-tertiary)] font-bold uppercase">
                          {t('recommendations.days') || 'Est. Days'}
                        </span>
                        <span className="text-sm font-bold text-[var(--color-text-primary)]">~{rec.estimated_days}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded-lg ${getDifficultyColor(rec.difficulty)}`}>
                        {getDifficultyLabel(rec.difficulty)}
                      </span>

                      <div className="flex items-center gap-2">
                        {/* Add to study group (registered add_to_group route) */}
                        <button
                          onClick={() => handleAddToGroup(rec)}
                          className="ds-glass ds-glass-edge w-9 h-9 rounded-full flex items-center justify-center text-[var(--klein-blue)] hover:bg-[var(--klein-blue)] hover:text-[color:var(--klein-on)] transition-all active:scale-95"
                          title={t('home.selectStudyGroup') || 'Add to group'}
                          aria-label={t('home.selectStudyGroup') || 'Add to group'}
                        >
                          <Plus className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => handleToggleSelect(rec.id)}
                          disabled={selectingId === rec.id}
                          className={`px-5 py-2.5 rounded-full text-xs font-bold transition-all min-h-[var(--touch-min)] active:scale-[0.98] ${
                            isSelected ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'text-[color:var(--klein-on)]'
                          } ${selectingId === rec.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                          style={isSelected ? undefined : { background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
                        >
                          {isSelected ? (
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
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Login-required confirm (anonymous taps) + add-to-group sheet */}
      {loginConfirmSheet}
      <WfAddToLibrarySheet
        open={addSheetContent !== null}
        content={addSheetContent}
        onClose={() => setAddSheetContent(null)}
      />
    </div>
  );
};

export default WfLibraryRecommendationsPage;
