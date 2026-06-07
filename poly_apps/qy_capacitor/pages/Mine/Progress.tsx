/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Button, LoadingState, ProgressBar, SectionTitle } from '../../components/UI';
import { PillNav } from '../../components/PillNav';
import { ApiCenter } from '../../services/ApiCenter';

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

export default function MineProgress() {
  const { user, navigate, t } = useContext(AppContext);
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'alltime'>('weekly');

  useEffect(() => {
    if (user) {
      loadProgress();
    } else {
      navigate('login');
    }
  }, [user]);

  const loadProgress = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.user.getStatistics();
      if (result.success && result.data) {
        setProgress(result.data);
      }
    } catch (error) {
      console.error('Failed to load progress:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !progress) {
    return (
      <div className="ds-aura-bg min-h-screen pb-28 flex items-center justify-center">
        <div className="ds-aura-overlay" />
        <div className="relative">
          <LoadingState label="Loading progress..." />
        </div>
      </div>
    );
  }

  const progressPercentage = (progress.today_progress / progress.daily_goal) * 100;
  const retentionRate = progress.total_words > 0
    ? Math.round((progress.mastered_words / progress.total_words) * 100)
    : 0;

  const metrics = [
    { label: t('stats.words') || 'Total Words', value: progress.total_words },
    { label: t('stats.mastered'), value: progress.mastered_words },
    { label: 'Current Streak', value: `${progress.current_streak}d` },
    { label: 'Study Time', value: `${Math.floor(progress.total_study_time / 60)}h` },
  ];

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />
      {/* Minimal asymmetric header */}
      <div className="relative pt-[var(--page-padding-v)] px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
          Learning Progress
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Track your learning journey
        </p>
      </div>

      <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Today's Progress — Iris gradient hero card */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-[var(--klein-on)] relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-12 -right-10 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--klein-on)]/80 text-sm font-medium">{t('home.todayGoal')}</p>
                <p className="text-4xl font-bold mt-1">{progress.today_progress}/{progress.daily_goal}</p>
                <p className="text-[var(--klein-on)]/70 text-xs mt-1">{t('home.words')}</p>
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

        {/* Timeframe Selector — Pill nav */}
        <PillNav
          aria-label="Timeframe"
          activeId={timeframe}
          onChange={(id) => setTimeframe(id as typeof timeframe)}
          items={(['daily', 'weekly', 'monthly', 'alltime'] as const).map((tf) => ({
            id: tf,
            label: t(`stats.${tf}`),
          }))}
        />

        {/* Key Metrics — breathing card grid */}
        <SectionTitle title={t('stats.overview') || 'Overview'} className="px-1" />
        <div className="ds-grid-breathing grid-cols-2">
          {metrics.map((m, i) => (
            <div key={i} className="ds-card p-6">
              <p className="text-sm text-[var(--color-text-secondary)]">{m.label}</p>
              <p className="text-4xl font-bold mt-2 text-[var(--klein-blue)]">{m.value}</p>
            </div>
          ))}
        </div>

        {/* Additional Stats as ds-row group */}
        <div className="ds-stack-tight flex flex-col">
          <div className="ds-row p-5 flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-[var(--color-text-secondary)]">{t('stats.accuracy')}</p>
              <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{progress.average_accuracy}%</p>
            </div>
          </div>

          <div className="ds-row p-5">
            <div className="flex-1">
              <p className="text-sm text-[var(--color-text-secondary)] mb-2">{t('stats.retention')}</p>
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
                <Button variant="klein" className="!w-auto px-5 !py-2.5" onClick={() => navigate('learn/review')}>
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
}
