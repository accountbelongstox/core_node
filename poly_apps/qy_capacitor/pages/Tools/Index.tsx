/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card, BentoTile, SectionTitle, IconTile } from '../../components/UI';
import { PillNav } from '../../components/PillNav';
import { StorageCenter, StorageKey } from '../../services/StorageCenter';

interface Tool {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  category: 'dictionary' | 'ai' | 'learning';
  featured?: boolean;
}

export default function ToolsIndex() {
  const { navigate, t } = useContext(AppContext);
  const [recentTools, setRecentTools] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    StorageCenter.get<string[]>(StorageKey.RECENT_TOOLS, [])
      .then((recent) => {
        if (cancelled) return;
        setRecentTools(Array.isArray(recent) ? recent : []);
      })
      .catch(() => {
        if (!cancelled) setRecentTools([]);
      });
    return () => { cancelled = true; };
  }, []);

  const handleToolClick = (tool: Tool) => {
    const current = Array.isArray(recentTools) ? recentTools : [];
    const updated = [tool.id, ...current.filter(id => id !== tool.id)].slice(0, 3);
    setRecentTools(updated);
    StorageCenter.set(StorageKey.RECENT_TOOLS, updated);

    navigate(tool.route);
  };

  const tools: Tool[] = [
    // Dictionary Category
    {
      id: 'dictionary',
      title: 'Smart Dictionary',
      subtitle: 'Multi-language dictionary',
      description: 'Search words, get definitions, examples, and pronunciations',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
      route: 'tools/dictionary',
      category: 'dictionary',
      featured: true,
    },
    {
      id: 'personal-dictionary',
      title: 'Personal Dictionary',
      subtitle: 'Your vocabulary collection',
      description: 'Manage your personal word collections with notes and examples',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      route: 'tools/personal-dictionary',
      category: 'dictionary',
    },

    // AI Category
    {
      id: 'ai-assistant',
      title: 'AI Assistant',
      subtitle: 'All-in-one AI tools',
      description: 'Translation, TTS, article processing, and more AI tools',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      route: 'tools/ai-assistant',
      category: 'ai',
      featured: true,
    },
    {
      id: 'translation',
      title: 'Translation',
      subtitle: 'Multi-language translation',
      description: 'Translate text with AI-powered engines and learning modes',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      ),
      route: 'tools/translation',
      category: 'ai',
    },
    {
      id: 'tts',
      title: 'Text-to-Speech',
      subtitle: 'Natural voice synthesis',
      description: 'Convert text to speech in multiple languages and voices',
      icon: <Icons.Sound />,
      route: 'tools/tts',
      category: 'ai',
    },
    {
      id: 'article-processor',
      title: 'Article Processor',
      subtitle: 'Extract vocabulary',
      description: 'Process articles and documents to create learning materials',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      route: 'tools/article-processor',
      category: 'ai',
    },

    // Learning Category
    {
      id: 'analytics',
      title: 'Learning Analytics',
      subtitle: 'Track your progress',
      description: 'Visualize your learning data with charts and statistics',
      icon: <Icons.Chart />,
      route: 'tools/analytics',
      category: 'learning',
      featured: true,
    },
    {
      id: 'vocabulary-browser',
      title: 'Vocabulary Browser',
      subtitle: 'Public libraries',
      description: 'Browse and discover public vocabulary collections',
      icon: <Icons.Library />,
      route: 'tools/vocabulary-browser',
      category: 'learning',
    },
  ];

  const featuredTools = tools.filter(t => t.featured);
  const recentToolsData = tools.filter(t => Array.isArray(recentTools) && recentTools.includes(t.id));

  const categories = [
    { id: 'all', label: 'All Tools' },
    { id: 'dictionary', label: 'Dictionary' },
    { id: 'ai', label: 'AI Tools' },
    { id: 'learning', label: 'Learning' },
  ];

  const visibleTools = activeCategory === 'all'
    ? tools
    : tools.filter(t => t.category === activeCategory);

  return (
    <div className="ds-page ds-section-gap pt-20 pb-32">
      {/* Header */}
      <div className="px-1">
        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Powerful AI-driven learning tools
        </span>
        <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight mt-1 text-[var(--color-text-primary)]">
          {t('nav.tools')}
        </h1>
      </div>

      {/* Category pill nav */}
      <PillNav
        items={categories}
        activeId={activeCategory}
        onChange={setActiveCategory}
        aria-label="Tool categories"
      />

      {/* Featured Tools — gradient hero bento */}
      {activeCategory === 'all' && (
        <div>
          <SectionTitle title="Featured" subtitle="Top tools for you" className="mb-3 px-1" />
          <div className="ds-grid-breathing grid grid-cols-1">
            {featuredTools.map((tool) => (
              <div
                key={tool.id}
                onClick={() => handleToolClick(tool)}
                className="rounded-[var(--radius-card)] p-5 relative overflow-hidden cursor-pointer group text-[color:var(--klein-on)]"
              >
                <div className="absolute inset-0 -z-0" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }} />
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
                <div className="absolute -bottom-12 -left-8 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0">
                    {tool.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-xl mb-1 truncate">{tool.title}</h3>
                    <p className="text-sm text-white/90 mb-1 truncate">{tool.subtitle}</p>
                    <p className="text-xs text-white/70 line-clamp-1">{tool.description}</p>
                  </div>
                  <span className="flex-shrink-0 group-active:scale-90 transition-transform"><Icons.ChevronRight /></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Tools — icon tiles */}
      {activeCategory === 'all' && recentToolsData.length > 0 && (
        <div>
          <SectionTitle title="Recently Used" className="mb-3 px-1" />
          <div className="ds-card flex items-start gap-4 overflow-x-auto px-5 py-5">
            {recentToolsData.map((tool) => (
              <IconTile
                key={tool.id}
                onClick={() => handleToolClick(tool)}
                bg="var(--klein-blue-soft)"
                icon={
                  <span className="text-[var(--klein-blue)]">
                    {React.cloneElement(tool.icon as React.ReactElement, { className: 'w-6 h-6' })}
                  </span>
                }
                label={tool.title}
              />
            ))}
          </div>
        </div>
      )}

      {/* All Tools (filtered by pill) */}
      <div>
        <SectionTitle
          title={categories.find(c => c.id === activeCategory)?.label || 'All Tools'}
          className="mb-3 px-1"
        />
        <div className="ds-grid-breathing grid grid-cols-1 sm:grid-cols-2">
          {visibleTools.map((tool) => (
            <div
              key={tool.id}
              onClick={() => handleToolClick(tool)}
              className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
            >
              <div className="w-14 h-14 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
                {tool.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-0.5 truncate group-hover:text-[var(--klein-blue)] transition-colors">
                  {tool.title}
                </h3>
                <p className="text-sm text-[var(--color-text-secondary)] truncate">
                  {tool.subtitle}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-1">
                  {tool.description}
                </p>
              </div>
              <div className="w-8 h-8 rounded-full bg-white/50 dark:bg-white/5 flex items-center justify-center text-[var(--color-text-tertiary)] group-hover:bg-[var(--klein-blue-soft)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                <Icons.ChevronRight />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info Card */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[color:var(--klein-on)]" style={{ background: 'var(--klein-gradient)' }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-[var(--color-text-primary)] mb-1">About Tools</h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              All tools are fully integrated with AI-powered backends. Click any tool to get started.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
