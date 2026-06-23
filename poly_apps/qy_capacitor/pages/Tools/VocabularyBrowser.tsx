/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiCenter } from '../../services/ApiCenter';
import { Card, Icons, LoadingState, EmptyState, PageHeader, Badge, SectionTitle } from '../../components/UI';
import { PillNav } from '../../components/PillNav';

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

export default function VocabularyBrowser() {
  const navigate = useNavigate();

  const [statistics, setStatistics] = useState<VocabularyStatistics | null>(null);
  const [libraries, setLibraries] = useState<VocabularyLibrary[]>([]);
  const [recommendedLibraries, setRecommendedLibraries] = useState<VocabularyLibrary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'recommended'>('recommended');

  // Filter state
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');

  // Load statistics
  const loadStatistics = async () => {
    try {
      const result = await ApiCenter.vocabulary.getStatistics();
      if (result.success && result.data) {
        setStatistics({
          total_libraries: result.data.total_libraries || 0,
          total_words: result.data.total_words || 0,
          languages: Array.isArray(result.data.languages) ? result.data.languages : [],
        });
      }
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  };

  // Load all libraries
  const loadLibraries = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.vocabulary.getLibraries({
        language: selectedLanguage || undefined,
      });

      if (result.success && result.data) {
        setLibraries(Array.isArray(result.data) ? result.data : []);
      } else {
        setLibraries([]);
      }
    } catch (error) {
      console.error('Failed to load libraries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load recommended libraries
  const loadRecommended = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.vocabulary.getRecommendedLibraries({
        language: selectedLanguage || undefined,
        level: selectedLevel || undefined,
      });

      if (result.success && result.data) {
        setRecommendedLibraries(Array.isArray(result.data) ? result.data : []);
      } else {
        setRecommendedLibraries([]);
      }
    } catch (error) {
      console.error('Failed to load recommended libraries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load data based on active tab
  const loadData = () => {
    if (activeTab === 'all') {
      loadLibraries();
    } else {
      loadRecommended();
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  useEffect(() => {
    loadData();
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

  return (
    <div className="min-h-screen bg-transparent pb-32">
      <PageHeader title="Vocabulary Library" onBack={() => navigate(-1)} />

      <div className="ds-page ds-section-gap pt-[var(--space-breath)]">
        <div className="px-1">
          <p className="text-sm text-[var(--color-text-secondary)]">Browse and explore vocabulary collections</p>
        </div>

        {/* Statistics Cards */}
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
        <PillNav
          items={[
            { id: 'recommended', label: 'Recommended' },
            { id: 'all', label: 'All Libraries' },
          ]}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as 'all' | 'recommended')}
          aria-label="Library view"
        />

        {/* Filters — pill nav */}
        <div className="ds-stack-tight">
          <div>
            <SectionTitle title="Language" className="px-1 mb-2" />
            <PillNav
              items={languageItems}
              activeId={selectedLanguage}
              onChange={setSelectedLanguage}
              aria-label="Language filter"
            />
          </div>

          {activeTab === 'recommended' && (
            <div>
              <SectionTitle title="Level" className="px-1 mb-2" />
              <PillNav
                items={levelItems}
                activeId={selectedLevel}
                onChange={setSelectedLevel}
                aria-label="Level filter"
              />
            </div>
          )}
        </div>

        {/* Loading State */}
        {loading && <LoadingState label="Loading libraries..." />}

        {/* Empty State */}
        {!loading && displayLibraries.length === 0 && (
          <EmptyState
            icon={<Icons.Library />}
            title="No libraries found"
            description="Try adjusting your filters"
          />
        )}

        {/* Libraries Grid */}
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
                  {library.language && (
                    <Badge tone="klein">{library.language.toUpperCase()}</Badge>
                  )}
                  {library.level && (
                    <Badge tone="klein">{library.level}</Badge>
                  )}
                  {library.category && (
                    <Badge tone="klein">{library.category}</Badge>
                  )}
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
}
