import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';

interface AITool {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  gradient: string;
  badge?: string;
}

export default function ToolsAIAssistant() {
  const { navigate, t } = useContext(AppContext);

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
      gradient: 'from-cyan-500 to-blue-600',
      badge: 'Popular',
    },
    {
      id: 'tts',
      title: 'Text-to-Speech',
      subtitle: 'Natural voice synthesis',
      description: 'Convert text to natural-sounding speech in multiple languages with various voice options',
      icon: <Icons.Sound />,
      route: 'tools/tts',
      gradient: 'from-green-500 to-emerald-600',
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
      gradient: 'from-orange-500 to-red-600',
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
      gradient: 'from-purple-500 to-pink-600',
    },
  ];

  const features = [
    {
      icon: '🤖',
      title: 'AI-Powered',
      description: 'Advanced machine learning algorithms'
    },
    {
      icon: '⚡',
      title: 'Real-time',
      description: 'Instant results and processing'
    },
    {
      icon: '🌍',
      title: 'Multi-language',
      description: 'Support for 50+ languages'
    },
    {
      icon: '🎯',
      title: 'Context-aware',
      description: 'Understands meaning and context'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 max-w-md mx-auto">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            AI Assistant
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Powerful AI tools for language learning
          </p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Hero Card */}
        <Card className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white border-none shadow-xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-4xl">
                🤖
              </div>
              <div>
                <h2 className="text-2xl font-bold">AI-Powered Tools</h2>
                <p className="text-white/80 text-sm">Smart learning assistance</p>
              </div>
            </div>
            <p className="text-white/90">
              Access advanced AI capabilities to enhance your language learning experience with intelligent translation, voice synthesis, and content processing.
            </p>
          </div>
        </Card>

        {/* AI Tools Grid */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Available Tools
          </h2>
          {aiTools.map((tool) => (
            <Card
              key={tool.id}
              onClick={() => navigate(tool.route)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 bg-gradient-to-br ${tool.gradient} rounded-xl flex items-center justify-center text-white flex-shrink-0`}>
                  {tool.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                      {tool.title}
                    </h3>
                    {tool.badge && (
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs rounded font-semibold">
                        {tool.badge}
                      </span>
                    )}
                  </div>
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

        {/* Features Grid */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            AI Features
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-4"
              >
                <div className="text-3xl mb-2">{feature.icon}</div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                  {feature.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('tools/translation')}
              className="bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl p-4 font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              <div className="text-2xl mb-2">🌐</div>
              Quick Translate
            </button>
            <button
              onClick={() => navigate('tools/tts')}
              className="bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-xl p-4 font-semibold hover:scale-105 transition-transform shadow-lg"
            >
              <div className="text-2xl mb-2">🔊</div>
              Text to Speech
            </button>
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 border border-blue-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">About AI Tools</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                Our AI tools use advanced machine learning models to provide accurate, context-aware assistance for your language learning journey.
              </p>
              <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Powered by latest AI models
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Privacy-focused processing
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Continuous improvement
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
