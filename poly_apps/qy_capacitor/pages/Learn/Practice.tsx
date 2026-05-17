import React, { useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card } from '../../components/UI';

export default function LearnPractice() {
  const { navigate, t } = useContext(AppContext);
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const libraryId = searchParams.get('library');
  const resumeId = searchParams.get('resume');

  // If mode is specified, redirect to the appropriate practice page
  useEffect(() => {
    if (mode) {
      const routes: Record<string, string> = {
        'reading': 'reading/run',
        'flashcards': 'flashcards/run',
        'quiz': 'quiz/run',
        'listening': 'listening/run'
      };

      const route = routes[mode];
      if (route) {
        const params = new URLSearchParams();
        if (libraryId) params.append('library', libraryId);
        if (resumeId) params.append('resume', resumeId);
        const queryString = params.toString();
        navigate(`${route}${queryString ? `?${queryString}` : ''}`);
      }
    }
  }, [mode, libraryId, resumeId, navigate]);

  const practiceModes = [
    {
      id: 'reading',
      title: t('home.reading'),
      subtitle: t('home.flowContext'),
      description: 'Read articles and books to learn vocabulary in context',
      icon: <Icons.Book />,
      color: 'from-blue-500 to-blue-600',
      recommended: true
    },
    {
      id: 'flashcards',
      title: t('home.flashcards'),
      subtitle: t('home.spacedRepetition'),
      description: 'Review vocabulary with smart spaced repetition system',
      icon: <Icons.Sparkles />,
      color: 'from-purple-500 to-purple-600',
      recommended: true
    },
    {
      id: 'quiz',
      title: t('home.quiz'),
      subtitle: t('home.gamifiedTest'),
      description: 'Test your knowledge with interactive quizzes',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'from-green-500 to-green-600',
      recommended: false
    },
    {
      id: 'listening',
      title: t('nav.listening'),
      subtitle: t('home.passive'),
      description: 'Listen to vocabulary with audio loop and auto-play',
      icon: <Icons.Sound />,
      color: 'from-orange-500 to-orange-600',
      recommended: false
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-8 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('nav.practice')}
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Choose your learning mode
          </p>
        </div>
      </div>

      <div className="sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto px-6 space-y-6">
        {/* Recommended Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('home.recommended')}
          </h2>
          <div className="space-y-4">
            {practiceModes.filter(m => m.recommended).map((mode) => (
              <Card
                key={mode.id}
                onClick={() => navigate(`learn/practice?mode=${mode.id}`)}
                className={`bg-gradient-to-br ${mode.color} text-white border-none shadow-xl cursor-pointer hover:scale-[1.02] transition-transform`}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                    {mode.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-xl mb-1">{mode.title}</h3>
                    <p className="text-sm text-white/90 mb-2">{mode.subtitle}</p>
                    <p className="text-xs text-white/70">{mode.description}</p>
                  </div>
                  <Icons.ChevronRight />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Other Modes Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Other Modes
          </h2>
          <div className="space-y-4">
            {practiceModes.filter(m => !m.recommended).map((mode) => (
              <Card
                key={mode.id}
                onClick={() => navigate(`learn/practice?mode=${mode.id}`)}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 bg-gradient-to-br ${mode.color} rounded-2xl flex items-center justify-center flex-shrink-0 text-white`}>
                    {mode.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-1">{mode.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{mode.subtitle}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">{mode.description}</p>
                  </div>
                  <Icons.ChevronRight />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
