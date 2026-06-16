/* [v4.1-Iris] Vocabulary Browser — ported from
 * poly_apps/qy_capacitor/pages/Tools/VocabularyBrowser.tsx. Self-contained:
 * reads /vocabulary/statistics + /vocabulary/libraries[/recommended] via
 * wordflowApi.request, filters by language/level with pill navs, react-router
 * useNavigate for the back action. Every API call try/caught; LoadingState /
 * EmptyState on failure or empty. Faithful Iris look. */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Icons, LoadingState, EmptyState, PageHeader, Badge, SectionTitle } from '../WfUI';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';

interface VocabularyLibrary {
  id: number;
  name: string;
  description?: string;
  word_count: number;
  language?: string;
  level?: string;
  category?: string;
}

interface VocabularyStatistics {
  total_libraries: number;
  total_words: number;
  languages: string[];
}

function buildQuery(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

const WfToolsVocabularyBrowserPage: React.FC = () => {
  const navigate = useNavigate();

  const [statistics, setStatistics] = useState<VocabularyStatistics | null>(null);
  const [libraries, setLibraries] = useState<VocabularyLibrary[]>([]);
  const [recommendedLibraries, setRecommendedLibraries] = useState<VocabularyLibrary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'recommended'>('recommended');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');

  const normalizeList = (data: any): VocabularyLibrary[] => {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.libraries)) return data.libraries;
    if (Array.isArray(data?.recommendations)) return data.recommendations;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  };

  const loadStatistics = async () => {
    try {
      const data = await wordflowApi.request<any>('/vocabulary/statistics');
      if (data) {
        setStatistics({
          total_libraries: data.total_libraries || 0,
          total_words: data.total_words || 0,
          languages: Array.isArray(data.languages) ? data.languages : [],
        });
      }
    } catch (error) {
      console.error('[WfVocabularyBrowser] Failed to load statistics:', error);
    }
  };

  const loadLibraries = async () => {
    setLoading(true);
    try {
      const data = await wordflowApi.request<any>(
        `/vocabulary/libraries${buildQuery({ language: selectedLanguage || undefined })}`
      );
      setLibraries(normalizeList(data));
    } catch (error) {
      console.error('[WfVocabularyBrowser] Failed to load libraries:', error);
      setLibraries([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommended = async () => {
    setLoading(true);
    try {
      const data = await wordflowApi.request<any>(
        `/vocabulary/libraries/recommended${buildQuery({
          language: selectedLanguage || undefined,
          level: selectedLevel || undefined,
        })}`
      );
      setRecommendedLibraries(normalizeList(data));
    } catch (error) {
      console.error('[WfVocabularyBrowser] Failed to load recommended libraries:', error);
      setRecommendedLibraries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'all') loadLibraries();
    else loadRecommended();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedLanguage, selectedLevel]);

  const displayLibraries = (() => {
    const list = activeTab === 'all' ? libraries : recommendedLibraries;
    return Array.isArray(list) ? list : [];
  })();

  const languageItems = [
    { id: '', label: 'All Languages' },
    { id: 'en', label: 'English' },
    { id: 'zh', label: 'Chinese' },
    { id: 'es', label: 'Spanish' },
    { id: 'fr', label: 'French' },
    { id: 'de', label: 'German' },
    { id: 'ja', label: 'Japanese' },
  ];

  const levelItems = [
    { id: '', label: 'All Levels' },
    { id: 'beginner', label: 'Beginner' },
    { id: 'intermediate', label: 'Intermediate' },
    { id: 'advanced', label: 'Advanced' },
  ];

  const renderPillNav = (
    items: { id: string; label: string }[],
    activeId: string,
    onChange: (id: string) => void,
    label: string
  ) => (
    <div className="ds-pill-nav" role="tablist" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.id || 'all'}
          type="button"
          role="tab"
          aria-selected={activeId === item.id}
          onClick={() => onChange(item.id)}
          className={`ds-pill-chip ${activeId === item.id ? 'is-active' : ''}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="route-fade min-h-screen bg-transparent pb-32">
      <PageHeader title="Vocabulary Library" onBack={() => navigate(-1)} />

      <div className="ds-page ds-section-gap pt-[var(--space-breath)]">
        <div className="px-1">
          <p className="text-sm text-[var(--color-text-secondary)]">Browse and explore vocabulary collections</p>
        </div>

        {/* Statistics cards */}
        {statistics && (
          <div className="ds-grid-breathing grid grid-cols-1 sm:grid-cols-3">
            <div className="rounded-[var(--radius-card)] p-6 relative overflow-hidden text-[color:var(--klein-on)]">
              <div className="absolute inset-0 -z-0" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }} />
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/15 rounded-full blur-2xl" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-white/80 text-sm">Total Libraries</p>
                  <p className="text-3xl font-bold mt-1">{statistics.total_libraries}</p>
                </div>
                <span className="text-white/50"><Icons.Library /></span>
              </div>
            </div>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--color-text-secondary)] text-sm">Total Words</p>
                  <p className="text-3xl font-bold mt-1 text-[var(--color-text-primary)]">{(statistics.total_words || 0).toLocaleString()}</p>
                </div>
                <span className="text-[var(--klein-blue)]"><Icons.Book /></span>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[var(--color-text-secondary)] text-sm">Languages</p>
                  <p className="text-3xl font-bold mt-1 text-[var(--color-text-primary)]">{Array.isArray(statistics.languages) ? statistics.languages.length : 0}</p>
                </div>
                <span className="text-[var(--klein-blue)]"><Icons.Globe /></span>
              </div>
            </Card>
          </div>
        )}

        {/* Tab pill nav */}
        {renderPillNav(
          [
            { id: 'recommended', label: 'Recommended' },
            { id: 'all', label: 'All Libraries' },
          ],
          activeTab,
          (id) => setActiveTab(id as 'all' | 'recommended'),
          'Library view'
        )}

        {/* Filters */}
        <div className="ds-stack-tight">
          <div>
            <SectionTitle title="Language" className="px-1 mb-2" />
            {renderPillNav(languageItems, selectedLanguage, setSelectedLanguage, 'Language filter')}
          </div>

          {activeTab === 'recommended' && (
            <div>
              <SectionTitle title="Level" className="px-1 mb-2" />
              {renderPillNav(levelItems, selectedLevel, setSelectedLevel, 'Level filter')}
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && <LoadingState label="Loading libraries..." />}

        {/* Empty state */}
        {!loading && displayLibraries.length === 0 && (
          <EmptyState
            icon={<Icons.Library />}
            title="No libraries found"
            description="Try adjusting your filters"
          />
        )}

        {/* Libraries grid */}
        {!loading && displayLibraries.length > 0 && (
          <div className="ds-grid-breathing grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {displayLibraries.map((library) => (
              <Card key={library.id}>
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">{library.name}</h3>
                  {library.description && (
                    <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{library.description}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-4">
                  {library.language && <Badge tone="klein">{library.language.toUpperCase()}</Badge>}
                  {library.level && <Badge tone="klein">{library.level}</Badge>}
                  {library.category && <Badge tone="klein">{library.category}</Badge>}
                </div>

                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                  <span className="text-[var(--klein-blue)] [&_svg]:w-4 [&_svg]:h-4"><Icons.Book /></span>
                  <span>{library.word_count} words</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WfToolsVocabularyBrowserPage;
