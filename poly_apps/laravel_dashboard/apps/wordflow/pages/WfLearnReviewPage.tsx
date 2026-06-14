/* [v4.1-Iris] Learn Review — ported from qy_capacitor/pages/Learn/Review.tsx.
 * Self-contained: pulls review counters from wordflowApi (user profile +
 * retention stats), then offers spaced-repetition sessions that route to the
 * flashcard/quiz runners via wfPath(). Every API call is try/caught and the page
 * degrades to safe defaults / an empty state. Faithful Iris look. */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CalendarDays, CircleCheck, ClipboardCheck } from 'lucide-react';
import { Icons, Card, Button, SectionTitle, Stat, EmptyState } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { wfLearningStatsCenter } from '../services/WfLearningStatsCenter';

interface ReviewStats {
  due_today: number;
  due_this_week: number;
  mastered: number;
  learning: number;
}

const WfLearnReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, t } = useWfApp();
  const [stats, setStats] = useState<ReviewStats>({
    due_today: 0,
    due_this_week: 0,
    mastered: 0,
    learning: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        let next: ReviewStats = { due_today: 0, due_this_week: 0, mastered: 0, learning: 0 };
        let gotStats = false;
        // Primary source: the shared learning-stats center (real /learning/stats),
        // mapped defensively (snake/camel) like the original Review.tsx.
        try {
          const d: any = await wfLearningStatsCenter.getStats();
          if (d && typeof d === 'object' && !Array.isArray(d)) {
            next = {
              due_today: d.due_today ?? d.dueToday ?? 0,
              due_this_week: d.due_this_week ?? d.dueThisWeek ?? 0,
              mastered: d.mastered ?? d.mastered_words ?? 0,
              learning: d.learning ?? d.learning_words ?? 0,
            };
            gotStats = true;
          }
        } catch { /* fall back to profile + retention below */ }
        if (gotStats) {
          if (!cancelled) setStats(next);
          return;
        }
        // Fallback: derive counters defensively from the profile + retention buckets.
        try {
          const profile: any = await wordflowApi.getUserProfile();
          if (profile && typeof profile === 'object') {
            next.mastered = profile.mastered_words ?? profile.mastered ?? 0;
            next.learning = profile.learned_words ?? profile.learning ?? 0;
          }
        } catch { /* keep defaults */ }
        try {
          const retention: any = await wordflowApi.getRetentionStats();
          if (Array.isArray(retention)) {
            for (const r of retention) {
              const level = String(r?.level || '').toLowerCase();
              if (level.includes('critical') || level.includes('due')) next.due_today += r?.count || 0;
              else if (level.includes('learning')) next.learning = r?.count ?? next.learning;
              else if (level.includes('master')) next.mastered = r?.count ?? next.mastered;
            }
            next.due_this_week = next.due_today;
          }
        } catch { /* keep defaults */ }
        if (!cancelled) setStats(next);
      } catch (error) {
        console.error('[WfLearnReview] Failed to load review stats:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  if (!isAuthenticated || !user) {
    return (
      <div className="ds-page route-fade min-h-screen bg-transparent pb-32 flex items-center justify-center">
        <Card className="mx-6 w-full max-w-sm text-center p-8 flex flex-col items-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-[color:var(--klein-blue)] mb-4"
            style={{ background: 'var(--klein-blue-soft)' }}
          >
            <Icons.Lock />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">Login required</h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Sign in to track your reviews and progress.
          </p>
          <Button variant="grad" onClick={() => navigate(wfPath('mine'))}>
            {t('auth.login')}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="ds-page ds-section-gap route-fade min-h-screen bg-transparent pb-32">
      {/* Header */}
      <div className="pt-20 w-full">
        <div className="px-1">
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            Review Center
          </h1>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mt-1">
            Keep your vocabulary fresh with spaced repetition
          </p>
        </div>
      </div>

      <div className="w-full ds-section-gap">
        {/* Review stats */}
        <div className="ds-grid-breathing grid grid-cols-2">
          <Card className="flex flex-col gap-2">
            <Clock className="w-9 h-9 text-[var(--klein-blue)]" aria-hidden />
            <Stat value={stats.due_today} label="Due Today" accent />
          </Card>
          <Card className="flex flex-col gap-2">
            <CalendarDays className="w-9 h-9 text-[var(--klein-blue)]" aria-hidden />
            <Stat value={stats.due_this_week} label="This Week" accent />
          </Card>
          <Card className="flex flex-col gap-2">
            <span className="text-[var(--klein-blue)]"><Icons.Sparkles /></span>
            <Stat value={stats.learning} label="Learning" accent />
          </Card>
          <Card className="flex flex-col gap-2">
            <CircleCheck className="w-9 h-9 text-[var(--klein-blue)]" aria-hidden />
            <Stat value={stats.mastered} label="Mastered" accent />
          </Card>
        </div>

        {/* Restored CTA group (original Review.tsx): study session / flashcards / quiz */}
        <div className="ds-stack-tight flex flex-col">
          <Button variant="grad" onClick={() => navigate(wfPath('study_session'))}>
            {t('review.startSession') || 'Start Study Session'}
          </Button>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={() => navigate(wfPath('flashcard_setup'))}>
              {t('home.flashcards') || 'Flashcards'}
            </Button>
            <Button variant="secondary" onClick={() => navigate(wfPath('quiz_run'))}>
              {t('home.quiz') || 'Quiz'}
            </Button>
          </div>
        </div>

        {/* Review sessions */}
        <div>
          <SectionTitle title="Start a Session" className="mb-3 px-1" />
          <div className="ds-stack ds-stack-tight">
            {stats.due_today > 0 && (
              <div
                onClick={() => navigate(`${wfPath('flashcard_run')}?reviewMode=due`)}
                className="rounded-[var(--radius-card)] p-5 text-[color:var(--klein-on)] relative overflow-hidden cursor-pointer group"
                style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
              >
                <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/15 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 backdrop-blur-sm">
                      <Clock className="w-8 h-8" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xl">Review Due Cards</h3>
                      <p className="text-white/85 text-sm">{stats.due_today} cards waiting</p>
                    </div>
                  </div>
                  <div className="text-white/90 group-active:scale-90 transition-transform flex-shrink-0">
                    <Icons.ChevronRight />
                  </div>
                </div>
              </div>
            )}

            <div
              onClick={() => navigate(`${wfPath('flashcard_run')}?reviewMode=all`)}
              className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-[color:var(--klein-blue)]"
                style={{ background: 'var(--klein-blue-soft)' }}
              >
                <Icons.Sparkles />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
                  Practice All Cards
                </h3>
                <p className="text-[var(--color-text-secondary)] text-sm">Review any cards you want</p>
              </div>
              <div className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                <Icons.ChevronRight />
              </div>
            </div>

            <div
              onClick={() => navigate(`${wfPath('flashcard_run')}?reviewMode=mastered`)}
              className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-[color:var(--klein-blue)]"
                style={{ background: 'var(--klein-blue-soft)' }}
              >
                <CircleCheck className="w-7 h-7" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
                  Mastered Words
                </h3>
                <p className="text-[var(--color-text-secondary)] text-sm">{stats.mastered} words mastered</p>
              </div>
              <div className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                <Icons.ChevronRight />
              </div>
            </div>

            <div
              onClick={() => navigate(wfPath('quiz_run'))}
              className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-[color:var(--klein-blue)]"
                style={{ background: 'var(--klein-blue-soft)' }}
              >
                <ClipboardCheck className="w-7 h-7" aria-hidden />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
                  Take a Quiz
                </h3>
                <p className="text-[var(--color-text-secondary)] text-sm">Test your knowledge</p>
              </div>
              <div className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                <Icons.ChevronRight />
              </div>
            </div>
          </div>
        </div>

        {/* Empty state */}
        {!loading && stats.due_today === 0 && stats.learning === 0 && (
          <EmptyState
            icon={<CircleCheck className="w-10 h-10 text-[var(--klein-blue)]" aria-hidden />}
            title="All Caught Up!"
            description="No cards due for review right now. Great job!"
            action={
              <Button variant="grad" onClick={() => navigate(wfPath('learn/library'))}>
                Add More Content
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
};

export default WfLearnReviewPage;
