/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Ad-hoc plus/book SVGs → lucide (Plus/BookOpen); safeLibraries Array.isArray guard kept. Propagate the Iris layer to un-beautified siblings. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card, Button, LoadingState, EmptyState, Badge } from '../../components/UI';
import { Plus, BookOpen } from 'lucide-react';
import { PillNav } from '../../components/PillNav';
import { ApiCenter } from '../../services/ApiCenter';

interface Library {
  id: number;
  name: string;
  description?: string;
  word_count: number;
  language?: string;
  level?: string;
  category?: string;
  is_system?: boolean;
}

export default function LearnLibrary() {
  const { navigate, t } = useContext(AppContext);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'mine'>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('');

  useEffect(() => {
    loadLibraries();
  }, [activeTab, selectedLanguage]);

  const loadLibraries = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.vocabulary.getLibraries({
        language: selectedLanguage || undefined,
      });

      if (result.success && result.data) {
        // API may return a raw array OR a wrapped/paginated object
        // ({ libraries: [...] } / { data: [...] }) — normalize to an array
        // so .filter/.map never throw (bugfix: libraries.map is not a function).
        const raw: any = result.data;
        const allLibs: Library[] = Array.isArray(raw)
          ? raw
          : (raw.libraries || raw.data || raw.items || []);
        setLibraries(
          activeTab === 'mine' ? allLibs.filter(lib => !lib.is_system) : allLibs
        );
      }
    } catch (error) {
      console.error('Failed to load libraries:', error);
    } finally {
      setLoading(false);
    }
  };

  // Defensive: never let a non-array slip into render (.map/.length safety)
  const safeLibraries = Array.isArray(libraries) ? libraries : [];

  const handleLibraryClick = (library: Library) => {
    navigate(`learn/practice?library=${library.id}`);
  };

  return (
    <div className="ds-page ds-section-gap min-h-screen bg-transparent pb-24">
      {/* Header */}
      <div className="pt-20 w-full">
        <div className="space-y-4">
          <div className="px-1">
            <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
              {t('nav.library')}
            </h1>
            <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">
              {t('library.explore')} {t('library.collections')}
            </p>
          </div>

          {/* Tabs — v4.0 pill segment */}
          <PillNav
            aria-label={t('nav.library') || 'Library tabs'}
            items={[
              { id: 'all', label: t('library.all') },
              { id: 'mine', label: t('library.myBooks') },
            ]}
            activeId={activeTab}
            onChange={(id) => setActiveTab(id as 'all' | 'mine')}
          />

          {/* Language Filter — v4.0 pill category menu (replaces <select>) */}
          <PillNav
            aria-label={t('settings.language') || 'Language'}
            items={[
              { id: '', label: 'All Languages' },
              { id: 'en', label: 'English' },
              { id: 'zh', label: 'Chinese' },
              { id: 'es', label: 'Spanish' },
              { id: 'fr', label: 'French' },
              { id: 'de', label: 'German' },
              { id: 'ja', label: 'Japanese' },
            ]}
            activeId={selectedLanguage}
            onChange={setSelectedLanguage}
          />
        </div>
      </div>

      <div className="w-full ds-stack ds-stack-tight">
        {/* Import Document Button — Iris hero CTA */}
        <Button variant="grad" onClick={() => navigate('tools/article-processor')}>
          <Plus className="w-6 h-6" aria-hidden />
          <span>{t('library.importDocument')}</span>
        </Button>

        {/* Loading State */}
        {loading && <LoadingState label={t('common.loading')} />}

        {/* Empty State */}
        {!loading && safeLibraries.length === 0 && (
          <EmptyState
            icon={<Icons.Library />}
            title={t('library.noBooksFound')}
            description="Try adjusting your filters or importing new content"
          />
        )}

        {/* Libraries Grid */}
        {!loading && safeLibraries.length > 0 && (
          <div className="ds-stack ds-stack-tight">
            {safeLibraries.map((library) => (
              <Card
                key={library.id}
                onClick={() => handleLibraryClick(library)}
                className="cursor-pointer hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center text-[color:var(--klein-blue)]" style={{ background: 'var(--klein-blue-soft)' }}>
                    <Icons.Book />
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

                    {/* Tags */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      {library.language && (
                        <Badge tone="klein">{library.language.toUpperCase()}</Badge>
                      )}
                      {library.level && (
                        <Badge tone="success">{library.level}</Badge>
                      )}
                      {library.category && (
                        <Badge tone="neutral">{library.category}</Badge>
                      )}
                      {library.is_system && (
                        <Badge tone="neutral">System</Badge>
                      )}
                    </div>

                    {/* Word Count */}
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                      <BookOpen className="w-4 h-4" aria-hidden />
                      <span>{library.word_count} {t('library.words')}</span>
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
      </div>
    </div>
  );
}
