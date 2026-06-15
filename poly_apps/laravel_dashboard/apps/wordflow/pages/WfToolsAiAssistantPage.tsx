/* [v4.1-Iris] WordFlow AI Assistant, matched to qy_capacitor design-reference-{light,dark}.webp.
 * Ported from poly_apps/qy_capacitor/pages/Tools/AIAssistant.tsx but self-contained:
 * launches the shared chat via useShell().openChat('wordflow') and embeds the
 * shared AiChatKit (wired to WordFlow's app_qy_v1 assistant). Iris-styled with
 * .ds-* classes + lucide icons; uses react-router useNavigate for tool links. */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot,
  Zap,
  Globe2,
  Target,
  Languages,
  Globe,
  Volume2,
  FileText,
  BookMarked,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { Card, Button } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useShell } from '../../../shell/ShellContext';
import { AiChatKit } from '../../../shared/AiChatKit/AiChatKit';
import { wordflowChatAdapter } from '../../../shared/AiChatKit/adapters/wordflowChatAdapter';

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

const WfToolsAiAssistantPage: React.FC = () => {
  const navigate = useNavigate();
  const { openChat } = useShell();

  const aiTools: AITool[] = [
    {
      id: 'translation',
      title: 'Smart Translation',
      subtitle: 'AI-powered translation',
      description: 'Context-aware AI translation across many languages and learning modes.',
      icon: <Languages className="w-8 h-8" />,
      route: wfPath('tools/translation'),
      badge: 'Popular',
    },
    {
      id: 'tts',
      title: 'Text-to-Speech',
      subtitle: 'Natural voice synthesis',
      description: 'Convert text to natural-sounding speech with multiple voices.',
      icon: <Volume2 className="w-8 h-8" />,
      route: wfPath('tools/tts'),
      badge: 'New',
    },
    {
      id: 'article-processor',
      title: 'Article Processor',
      subtitle: 'Extract vocabulary',
      description: 'Process articles to auto-extract vocabulary and learning material.',
      icon: <FileText className="w-8 h-8" />,
      route: wfPath('tools/article-processor'),
    },
    {
      id: 'personal-dictionary',
      title: 'Personal Dictionary',
      subtitle: 'Custom word collections',
      description: 'Manage personal vocabulary entries with notes and examples.',
      icon: <BookMarked className="w-8 h-8" />,
      route: wfPath('tools/personal-dictionary'),
    },
  ];

  const features: AIFeature[] = [
    { Icon: Bot, title: 'AI-Powered', description: 'Advanced machine learning' },
    { Icon: Zap, title: 'Real-time', description: 'Instant results' },
    { Icon: Globe2, title: 'Multi-language', description: '50+ languages' },
    { Icon: Target, title: 'Context-aware', description: 'Understands meaning' },
  ];

  return (
    <div className="ds-page ds-section-gap route-fade pt-16 pb-32">
      {/* Header */}
      <div className="px-1">
        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Powerful AI tools for language learning
        </span>
        <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight mt-1 text-[var(--color-text-primary)]">
          AI Assistant
        </h1>
      </div>

      {/* Hero — gradient surface with a launch-chat CTA */}
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
            Chat with the WordFlow assistant for context-aware help with translation,
            definitions, and your learning plan.
          </p>
          <button
            onClick={() => openChat('wordflow')}
            className="inline-flex items-center gap-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm px-5 py-2.5 font-semibold transition-colors"
          >
            <MessageSquare className="w-5 h-5" />
            Open assistant chat
          </button>
        </div>
      </div>

      {/* Embedded chat (shared AiChatKit, wired to WordFlow's app_qy_v1 assistant) */}
      <div>
        <h2 className="ds-section-title mb-3 px-1">Ask anything</h2>
        <div className="ds-card overflow-hidden" style={{ height: 420 }}>
          <AiChatKit adapter={wordflowChatAdapter} className="h-full" />
        </div>
      </div>

      {/* Tools grid */}
      <div>
        <h2 className="ds-section-title mb-3 px-1">Available tools</h2>
        <div className="ds-grid-breathing grid grid-cols-1 sm:grid-cols-2">
          {aiTools.map((tool) => (
            <div
              key={tool.id}
              onClick={() => navigate(tool.route)}
              className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
            >
              <div className="w-14 h-14 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-2xl flex items-center justify-center flex-shrink-0 shadow-inner">
                {tool.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-bold text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
                    {tool.title}
                  </h3>
                  {tool.badge && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full text-[color:var(--klein-on)]"
                      style={{ background: 'var(--klein-gradient)' }}
                    >
                      {tool.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] truncate">{tool.subtitle}</p>
                <p className="text-xs text-[var(--color-text-tertiary)] line-clamp-1">{tool.description}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Features grid */}
      <div>
        <h2 className="ds-section-title mb-3 px-1">AI features</h2>
        <div className="ds-grid-breathing grid grid-cols-2">
          {features.map((feature, index) => (
            <div key={index} className="ds-card text-center p-4">
              <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] flex items-center justify-center">
                <feature.Icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">{feature.title}</h3>
              <p className="text-xs text-[var(--color-text-secondary)]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="ds-section-title mb-3 px-1">Quick actions</h2>
        <div className="ds-grid-breathing grid grid-cols-2">
          <Button variant="grad" onClick={() => navigate(wfPath('tools/translation'))} className="!py-5 flex-col gap-1">
            <Globe className="w-6 h-6" />
            Quick Translate
          </Button>
          <Button variant="grad" onClick={() => navigate(wfPath('tools/tts'))} className="!py-5 flex-col gap-1">
            <Volume2 className="w-6 h-6" />
            Text to Speech
          </Button>
        </div>
      </div>

      {/* Info card */}
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
};

export default WfToolsAiAssistantPage;
