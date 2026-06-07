/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Badge, SectionTitle, Button } from '../../components/UI';
import { Bot, Zap, Globe2, Target, Globe, Volume2 } from 'lucide-react';

interface AITool {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  badge?: string;
}

interface AIFeature {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export default function ToolsAIAssistant() {
  const { navigate } = useContext(AppContext);

  const aiTools: AITool[] = [
    {
      id: 'translation',
      title: 'Smart Translation',
      subtitle: 'AI-powered translation',
      description: 'Translate text with context-aware AI, supporting multiple languages and learning modes',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
        </svg>
      ),
      route: 'tools/translation',
      badge: 'Popular',
    },
    {
      id: 'tts',
      title: 'Text-to-Speech',
      subtitle: 'Natural voice synthesis',
      description: 'Convert text to natural-sounding speech in multiple languages with various voice options',
      icon: <Icons.Sound />,
      route: 'tools/tts',
      badge: 'New',
    },
    {
      id: 'article-processor',
      title: 'Article Processor',
      subtitle: 'Extract vocabulary',
      description: 'Process articles and documents to automatically extract vocabulary and create learning materials',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      route: 'tools/article-processor',
    },
    {
      id: 'personal-dictionary',
      title: 'Personal Dictionary',
      subtitle: 'Custom word collections',
      description: 'Create and manage your personal vocabulary entries with custom notes and examples',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      route: 'tools/personal-dictionary',
    },
  ];

  const features: AIFeature[] = [
    { Icon: Bot, title: 'AI-Powered', description: 'Advanced machine learning algorithms' },
    { Icon: Zap, title: 'Real-time', description: 'Instant results and processing' },
    { Icon: Globe2, title: 'Multi-language', description: 'Support for 50+ languages' },
    { Icon: Target, title: 'Context-aware', description: 'Understands meaning and context' },
  ];

  return (
    <div className="ds-page ds-section-gap pt-20 pb-32">
      {/* Header */}
      <div className="px-1">
        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Powerful AI tools for language learning
        </span>
        <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight mt-1 text-[var(--color-text-primary)]">
          AI Assistant
        </h1>
      </div>

      {/* Hero Card — gradient */}
      <div className="rounded-[var(--radius-card)] p-6 relative overflow-hidden text-[color:var(--klein-on)]">
        <div className="absolute inset-0 -z-0" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }} />
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl" />
        <div className="absolute -bottom-12 -left-8 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0">
              <Bot className="w-9 h-9" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold">AI-Powered Tools</h2>
              <p className="text-white/80 text-sm">Smart learning assistance</p>
            </div>
          </div>
          <p className="text-white/90 text-sm leading-relaxed">
            Access advanced AI capabilities to enhance your language learning experience with intelligent translation, voice synthesis, and content processing.
          </p>
        </div>
      </div>

      {/* AI Tools Grid */}
      <div>
        <SectionTitle title="Available Tools" subtitle="Pick a workspace" className="mb-3 px-1" />
        <div className="ds-grid-breathing grid grid-cols-1 sm:grid-cols-2">
          {aiTools.map((tool) => (
            <div
              key={tool.id}
              onClick={() => navigate(tool.route)}
              className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
            >
              <div className="w-16 h-16 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
                {tool.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-bold text-lg text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
                    {tool.title}
                  </h3>
                  {tool.badge && (
                    <Badge tone="klein">{tool.badge}</Badge>
                  )}
                </div>
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

      {/* Features Grid */}
      <div>
        <SectionTitle title="AI Features" className="mb-3 px-1" />
        <div className="ds-grid-breathing grid grid-cols-2">
          {features.map((feature, index) => (
            <Card key={index} className="text-center !p-4">
              <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] flex items-center justify-center">
                <feature.Icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <SectionTitle title="Quick Actions" className="mb-3 px-1" />
        <div className="ds-grid-breathing grid grid-cols-2">
          <Button variant="grad" onClick={() => navigate('tools/translation')} className="!py-5 flex-col gap-1">
            <Globe className="w-6 h-6" />
            Quick Translate
          </Button>
          <Button variant="grad" onClick={() => navigate('tools/tts')} className="!py-5 flex-col gap-1">
            <Volume2 className="w-6 h-6" />
            Text to Speech
          </Button>
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
            <h3 className="font-bold text-[var(--color-text-primary)] mb-1">About AI Tools</h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-2">
              Our AI tools use advanced machine learning models to provide accurate, context-aware assistance for your language learning journey.
            </p>
            <ul className="space-y-1 text-xs text-[var(--color-text-secondary)]">
              {['Powered by latest AI models', 'Privacy-focused processing', 'Continuous improvement'].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[var(--klein-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
