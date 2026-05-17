import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card } from '../../components/UI';
import { StorageCenter, StorageKey } from '../../services/StorageCenter';

interface Tool {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  gradient: string;
  category: 'dictionary' | 'ai' | 'learning';
  featured?: boolean;
}

export default function ToolsIndex() {
  const { navigate, t } = useContext(AppContext);
  const [recentTools, setRecentTools] = useState<string[]>([]);

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
      gradient: 'from-blue-500 to-blue-600',
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
      gradient: 'from-purple-500 to-purple-600',
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
      gradient: 'from-indigo-500 to-purple-600',
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
      gradient: 'from-cyan-500 to-cyan-600',
      category: 'ai',
    },
    {
      id: 'tts',
      title: 'Text-to-Speech',
      subtitle: 'Natural voice synthesis',
      description: 'Convert text to speech in multiple languages and voices',
      icon: <Icons.Sound />,
      route: 'tools/tts',
      gradient: 'from-green-500 to-green-600',
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
      gradient: 'from-orange-500 to-orange-600',
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
      gradient: 'from-pink-500 to-rose-600',
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
      gradient: 'from-teal-500 to-teal-600',
      category: 'learning',
    },
  ];

  const featuredTools = tools.filter(t => t.featured);
  const recentToolsData = tools.filter(t => Array.isArray(recentTools) && recentTools.includes(t.id));

  const categories = [
    { id: 'dictionary', name: 'Dictionary Tools', icon: '📖', color: 'text-blue-600 dark:text-blue-400' },
    { id: 'ai', name: 'AI Tools', icon: '🤖', color: 'text-purple-600 dark:text-purple-400' },
    { id: 'learning', name: 'Learning Tools', icon: '📊', color: 'text-pink-600 dark:text-pink-400' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('nav.tools')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Powerful AI-driven learning tools
          </p>
        </div>
      </div>

      <div className="sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto px-6 space-y-6">
        {/* Featured Tools */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Featured
          </h2>
          <div className="grid grid-cols-1 gap-4">
            {featuredTools.map((tool) => (
              <Card
                key={tool.id}
                onClick={() => handleToolClick(tool)}
                className={`bg-gradient-to-br ${tool.gradient} text-white border-none shadow-xl cursor-pointer hover:scale-[1.02] transition-transform`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                    {tool.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-1">{tool.title}</h3>
                    <p className="text-sm text-white/90 mb-2">{tool.subtitle}</p>
                    <p className="text-xs text-white/70">{tool.description}</p>
                  </div>
                  <Icons.ChevronRight />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Tools */}
        {recentToolsData.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Recently Used
            </h2>
            <div className="grid grid-cols-3 gap-3">
              {recentToolsData.map((tool) => (
                <Card
                  key={tool.id}
                  onClick={() => handleToolClick(tool)}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg transition-all p-4"
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className={`w-12 h-12 bg-gradient-to-br ${tool.gradient} rounded-xl flex items-center justify-center text-white`}>
                      {React.cloneElement(tool.icon as React.ReactElement, { className: 'w-6 h-6' })}
                    </div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-2">
                      {tool.title}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Tools by Category */}
        {categories.map((category) => {
          const categoryTools = tools.filter(t => t.category === category.id);
          return (
            <div key={category.id} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <span className="text-2xl">{category.icon}</span>
                <h2 className={`text-sm font-bold uppercase tracking-wider ${category.color}`}>
                  {category.name}
                </h2>
              </div>
              <div className="space-y-3">
                {categoryTools.map((tool) => (
                  <Card
                    key={tool.id}
                    onClick={() => handleToolClick(tool)}
                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 bg-gradient-to-br ${tool.gradient} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                        {tool.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">
                          {tool.title}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
                          {tool.subtitle}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 line-clamp-1">
                          {tool.description}
                        </p>
                      </div>
                      <Icons.ChevronRight />
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 border border-blue-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">About Tools</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                All tools are fully integrated with AI-powered backends. Click any tool to get started.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
