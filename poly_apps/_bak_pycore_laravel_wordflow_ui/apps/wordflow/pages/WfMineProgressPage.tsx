/* [v4.1-Iris] Learning Progress — ported from
 * poly_apps/qy_capacitor/pages/Mine/Progress.tsx. Self-contained: reads the
 * profile + retention stats from wordflowApi, derives progress metrics,
 * react-router useNavigate + wfPath() for nav, useWfApp() for the user. Shows a
 * LoadingState while loading and degrades gracefully when the backend is down.
 * Faithful Iris look (gradient today card, timeframe pill nav, metric grid). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, LoadingState, ProgressBar, SectionTitle } from '../WfUI';
import { useWfApp, useWfT } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import type { RetentionStat } from '../../../core/api-libs/wordflow/wordflowTypes';

interface LearningProgress {
  total_words: number;
  mastered_words: number;
  learning_words: number;
  review_due: number;
  current_streak: number;
  longest_streak: number;
  total_study_time: number;
  average_accuracy: number;
  daily_goal: number;
  today_progress: number;
}

const WfMineProgressPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useWfApp();
  const { t } = useWfT();

  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'alltime'>('weekly');

  useEffect(() => {
    if (!user) {
      navigate(wfPath('auth/login'));
      return;
    }
    let cancelled = false;

    (async () => {
      setLoading(true);

      // Primary source — GET /user/statistics (the original Mine/Progress data
      // source: full LearningProgress shape incl. accuracy / streaks / study
      // time / daily goal / review due).
      try {
        const stats = await wordflowApi.request<any>('/user/statistics');
        if (stats && typeof stats === 'object' && !Array.isArray(stats)) {
          if (!cancelled) {
            setProgress({
              total_words: stats.total_words ?? stats.total_words_learned ?? 0,
              mastered_words: stats.mastered_words ?? 0,
              learning_words: stats.learning_words ?? 0,
              review_due: stats.review_due ?? 0,
              current_streak: stats.current_streak ?? 0,
              longest_streak: stats.longest_streak ?? stats.current_streak ?? 0,
              total_study_time: stats.total_study_time ?? 0,
              average_accuracy: stats.average_accuracy ?? 0,
              daily_goal: stats.daily_goal ?? 20,
              today_progress: stats.today_progress ?? 0,
            });
            setLoading(false);
          }
          return;
        }
      } catch (e) {
        console.warn('[WfProgress] /user/statistics unavailable, deriving from profile/retention:', e);
      }

      try {
        const profile = await wordflowApi.getUserProfile().catch(() => null);

        let mastered = profile?.mastered_words ?? 0;
        let learning = profile?.learned_words ?? 0;
        let total = profile?.total_words ?? profile?.totalLearned ?? 0;
        let reviewDue = 0;

        try {
          const retention: RetentionStat[] = await wordflowApi.getRetentionStats();
          if (Array.isArray(retention) && retention.length > 0) {
            const bucket = (name: string) =>
              retention.find((r) => r.level?.toLowerCase().includes(name))?.count ?? 0;
            mastered = bucket('master') || mastered;
            learning = bucket('learn') || learning;
            reviewDue = bucket('critical') || bucket('review');
            total = retention.reduce((sum, r) => sum + (r.count || 0), 0) || total;
          }
        } catch {
          /* retention unavailable */
        }

        if (cancelled) return;
        setProgress({
          total_words: total,
          mastered_words: mastered,
          learning_words: learning,
          review_due: reviewDue,
          current_streak: profile?.streak ?? 0,
          longest_streak: profile?.streak ?? 0,
          total_study_time: 0,
          average_accuracy: total > 0 ? Math.round((mastered / total) * 100) : 0,
          daily_goal: profile?.dailyGoal ?? 20,
          today_progress: profile?.dailyProgress ?? 0,
        });
      } catch (e) {
        console.error('[WfProgress] failed:', e);
        if (!cancelled) setProgress(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !progress) {
    return (
      <div className="min-h-screen pb-28 flex items-center justify-center">
        <div className="relative">
          <LoadingState label={t('common.loading') || 'Loading progress...'} />
        </div>
      </div>
    );
  }

  const progressPercentage =
    progress.daily_goal > 0 ? (progress.today_progress / progress.daily_goal) * 100 : 0;
  const retentionRate =
    progress.total_words > 0 ? Math.round((progress.mastered_words / progress.total_words) * 100) : 0;

  const metrics = [
    { label: t('stats.words') || 'Total Words', value: progress.total_words },
    { label: t('stats.mastered') || 'Mastered', value: progress.mastered_words },
    { label: t('stats.streak') || 'Current Streak', value: `${progress.current_streak}d` },
    { label: t('stats.studyTime') || 'Study Time', value: `${Math.floor(progress.total_study_time / 60)}h` },
  ];

  return (
    <div className="min-h-screen pb-28">
      <div className="relative pt-16 px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          {t('reading.progress') || 'Learning Progress'}
        </h1>
        <p className="text-[var(--color-text-secondary)]">Track your learning journey</p>
      </div>

      <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Today's progress — gradient hero */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-[var(--klein-on)] relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-12 -right-10 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--klein-on)]/80 text-sm font-medium">{t('home.todayGoal') || "Today's goal"}</p>
                <p className="text-4xl font-bold mt-1">{progress.today_progress}/{progress.daily_goal}</p>
                <p className="text-[var(--klein-on)]/70 text-xs mt-1">{t('home.words') || 'words'}</p>
              </div>
              <div className="w-20 h-20 rounded-full border-4 border-[var(--klein-on)]/40 flex items-center justify-center bg-[var(--klein-on)]/15">
                <span className="text-2xl font-bold">{Math.round(progressPercentage)}%</span>
              </div>
            </div>
            <div className="w-full bg-[var(--klein-on)]/20 rounded-full h-3 overflow-hidden">
              <div
                className="bg-[var(--klein-on)] h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Timeframe selector — pill nav */}
        <div className="ds-pill-nav" role="tablist" aria-label="Timeframe">
          {(['daily', 'weekly', 'monthly', 'alltime'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              role="tab"
              aria-selected={timeframe === tf}
              onClick={() => setTimeframe(tf)}
              className={`ds-pill-chip ${timeframe === tf ? 'is-active' : ''}`}
            >
              {t(`stats.${tf}`) || tf}
            </button>
          ))}
        </div>

        {/* Key metrics */}
        <SectionTitle title={t('stats.overview') || 'Overview'} className="px-1" />
        <div className="ds-grid-breathing grid-cols-2">
          {metrics.map((m, i) => (
            <div key={i} className="ds-card p-6">
              <p className="text-sm text-[var(--color-text-secondary)]">{m.label}</p>
              <p className="text-4xl font-bold mt-2 text-[var(--klein-blue)]">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Additional stats */}
        <div className="ds-stack-tight flex flex-col">
          <div className="ds-row p-5 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-[var(--color-text-secondary)]">{t('stats.accuracy') || 'Accuracy'}</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{progress.average_accuracy}%</p>
            </div>
          </div>

          <div className="ds-row p-5">
            <div className="flex-1">
              <p className="text-sm text-[var(--color-text-secondary)] mb-2">{t('stats.retention') || 'Retention'}</p>
              <ProgressBar value={retentionRate} className="h-3" barClassName="h-3" />
              <p className="text-right text-sm font-semibold text-[var(--color-text-primary)] mt-1">{retentionRate}%</p>
            </div>
          </div>

          <div className="ds-row p-5 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-[var(--color-text-secondary)]">Words Due for Review</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{progress.review_due}</p>
            </div>
            {progress.review_due > 0 && (
              <div className="w-auto">
                <Button variant="klein" className="!w-auto px-5 !py-2.5" onClick={() => navigate(wfPath('learn/review'))}>
                  Review
                </Button>
              </div>
            )}
          </div>

          <div className="ds-row p-5 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-[var(--color-text-secondary)]">Longest Streak</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{progress.longest_streak} days</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WfMineProgressPage;
