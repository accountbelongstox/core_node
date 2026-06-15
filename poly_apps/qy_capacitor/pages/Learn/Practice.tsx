/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Ad-hoc quiz SVG → lucide CircleCheck. Propagate the Iris layer to un-beautified siblings. */
import React, { useContext, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppContext } from '../../contexts/AppContext';
import { Icons, SectionTitle } from '../../components/UI';
import { CircleCheck } from 'lucide-react';

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
      recommended: true
    },
    {
      id: 'flashcards',
      title: t('home.flashcards'),
      subtitle: t('home.spacedRepetition'),
      description: 'Review vocabulary with smart spaced repetition system',
      icon: <Icons.Sparkles />,
      recommended: true
    },
    {
      id: 'quiz',
      title: t('home.quiz'),
      subtitle: t('home.gamifiedTest'),
      description: 'Test your knowledge with interactive quizzes',
      icon: <CircleCheck className="w-7 h-7" aria-hidden />,
      recommended: false
    },
    {
      id: 'listening',
      title: t('nav.listening'),
      subtitle: t('home.passive'),
      description: 'Listen to vocabulary with audio loop and auto-play',
      icon: <Icons.Sound />,
      recommended: false
    },
  ];

  const recommended = practiceModes.filter(m => m.recommended);
  const others = practiceModes.filter(m => !m.recommended);

  return (
    <div className="ds-page ds-section-gap min-h-screen bg-transparent pb-32">
      {/* Header */}
      <div className="pt-20 w-full">
        <div className="px-1">
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('nav.practice')}
          </h1>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">
            Choose your learning mode
          </p>
        </div>
      </div>

      <div className="w-full ds-section-gap">
        {/* Recommended Section — Iris gradient hero cards */}
        <div>
          <SectionTitle title={t('home.recommended')} className="mb-3 px-1" />
          <div className="ds-stack ds-stack-tight">
            {recommended.map((m) => (
              <div
                key={m.id}
                onClick={() => navigate(`learn/practice?mode=${m.id}`)}
                className="rounded-[var(--radius-card)] p-5 text-[color:var(--klein-on)] relative overflow-hidden cursor-pointer group"
                style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
              >
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/15 rounded-full blur-2xl pointer-events-none"></div>
                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                    {m.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-xl mb-1">{m.title}</h3>
                    <p className="text-sm text-white/90 mb-1">{m.subtitle}</p>
                    <p className="text-xs text-white/75">{m.description}</p>
                  </div>
                  <div className="text-white/90 group-active:scale-90 transition-transform flex-shrink-0">
                    <Icons.ChevronRight />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Other Modes Section */}
        <div>
          <SectionTitle title="Other Modes" className="mb-3 px-1" />
          <div className="ds-stack ds-stack-tight">
            {others.map((m) => (
              <div
                key={m.id}
                onClick={() => navigate(`learn/practice?mode=${m.id}`)}
                className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-[color:var(--klein-blue)]" style={{ background: 'var(--klein-blue-soft)' }}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-[var(--color-text-primary)] mb-0.5 truncate group-hover:text-[var(--klein-blue)] transition-colors">{m.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{m.subtitle}</p>
                  <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">{m.description}</p>
                </div>
                <div className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                  <Icons.ChevronRight />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
