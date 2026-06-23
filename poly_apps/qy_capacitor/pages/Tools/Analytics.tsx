/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, LoadingState, ProgressBar, Stat, SectionTitle, Button } from '../../components/UI';
import { PillNav } from '../../components/PillNav';
import { ApiCenter } from '../../services/ApiCenter';

// The /user/statistics payload can include extra optional metrics beyond the
// four guaranteed by ApiCenter.user.getStatistics(); the page reads them
// defensively with `|| 0`. Page-local view that widens the typed result to
// match the real backend object without altering runtime access.
interface UserStatisticsView {
  total_words_learned?: number;
  mastered_words?: number;
  learning_words?: number;
  weak_words?: number;
  total_study_time?: number;
  average_accuracy?: number;
  current_streak?: number;
  longest_streak?: number;
  daily_average?: number;
  weekly_progress?: number[];
}

interface AnalyticsData {
  totalWords: number;
  masteredWords: number;
  learningWords: number;
  weakWords: number;
  totalStudyTime: number;
  averageAccuracy: number;
  currentStreak: number;
  longestStreak: number;
  dailyAverage: number;
  weeklyProgress: number[];
}

export default function ToolsAnalytics() {
  const { user, navigate, t } = useContext(AppContext);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    if (user) {
      loadAnalytics();
    } else {
      setLoading(false);
    }
  }, [user, timeframe]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const result = await ApiCenter.user.getStatistics();
      if (result.success && result.data) {
        const data = result.data as UserStatisticsView;
        setAnalytics({
          totalWords: data.total_words_learned || 0,
          masteredWords: data.mastered_words || 0,
          learningWords: data.learning_words || 0,
          weakWords: data.weak_words || 0,
          totalStudyTime: data.total_study_time || 0,
          averageAccuracy: data.average_accuracy || 0,
          currentStreak: data.current_streak || 0,
          longestStreak: data.longest_streak || 0,
          dailyAverage: data.daily_average || 0,
          weeklyProgress: data.weekly_progress || [0, 0, 0, 0, 0, 0, 0],
        });
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="ds-page pt-20 pb-32 flex items-center justify-center min-h-[70vh]">
        <Card className="text-center !p-8 max-w-sm w-full">
          <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center text-[color:var(--klein-on)]" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}>
            <Icons.Lock />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mt-4 mb-2">
            Login Required
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Please login to view your learning analytics
          </p>
          <Button variant="grad" onClick={() => navigate('login')}>
            {t('auth.login')}
          </Button>
        </Card>
      </div>
    );
  }

  if (loading || !analytics) {
    return (
      <div className="ds-page pt-20 pb-32 flex items-center justify-center min-h-[70vh]">
        <LoadingState label="Loading analytics..." />
      </div>
    );
  }

  const masteryPercentage = analytics.totalWords > 0
    ? Math.round((analytics.masteredWords / analytics.totalWords) * 100)
    : 0;

  const maxWeeklyValue = Math.max(...analytics.weeklyProgress, 1);

  const overviewStats = [
    { label: 'Total Words', value: analytics.totalWords, hint: 'words', icon: <Icons.Book /> },
    { label: 'Mastered', value: analytics.masteredWords, hint: 'words', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ) },
    { label: 'Study Time', value: Math.floor(analytics.totalStudyTime / 60), hint: 'hours', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    ) },
    { label: 'Streak', value: analytics.currentStreak, hint: 'days', icon: <Icons.Sparkles /> },
  ];

  const detailStats = [
    { label: 'Avg Accuracy', value: `${analytics.averageAccuracy}%` },
    { label: 'Daily Average', value: analytics.dailyAverage },
    { label: 'Best Streak', value: analytics.longestStreak },
    { label: 'Hours/Week', value: Math.round(analytics.totalStudyTime / 60 / 7) },
  ];

  return (
    <div className="ds-page ds-section-gap pt-20 pb-32">
      {/* Header */}
      <div className="px-1">
        <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
          Track your progress and insights
        </span>
        <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight mt-1 text-[var(--color-text-primary)]">
          Learning Analytics
        </h1>
      </div>

      {/* Timeframe pill nav */}
      <PillNav
        items={[
          { id: 'week', label: 'Week' },
          { id: 'month', label: 'Month' },
          { id: 'year', label: 'Year' },
        ]}
        activeId={timeframe}
        onChange={(id) => setTimeframe(id as 'week' | 'month' | 'year')}
        aria-label="Timeframe"
      />

      {/* Overview Stats — first card is gradient hero, rest are glass */}
      <div className="ds-grid-breathing grid grid-cols-2">
        {overviewStats.map((stat, idx) => (
          idx === 0 ? (
            <div key={stat.label} className="rounded-[var(--radius-card)] p-6 relative overflow-hidden text-[color:var(--klein-on)]">
              <div className="absolute inset-0 -z-0" style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }} />
              <div className="absolute -top-8 -right-8 w-28 h-28 bg-white/15 rounded-full blur-2xl" />
              <div className="relative z-10 flex flex-col">
                <span className="opacity-90">{stat.icon}</span>
                <p className="text-white/80 text-sm mt-2">{stat.label}</p>
                <p className="text-4xl font-bold mt-1">{stat.value}</p>
                <p className="text-white/70 text-xs">{stat.hint}</p>
              </div>
            </div>
          ) : (
            <Card key={stat.label}>
              <div className="flex flex-col">
                <span className="text-[var(--klein-blue)]">{stat.icon}</span>
                <p className="text-[var(--color-text-secondary)] text-sm mt-2">{stat.label}</p>
                <p className="text-4xl font-bold mt-1 text-[var(--color-text-primary)]">{stat.value}</p>
                <p className="text-[var(--color-text-tertiary)] text-xs">{stat.hint}</p>
              </div>
            </Card>
          )
        ))}
      </div>

      {/* Weekly Progress Chart */}
      <Card>
        <h2 className="ds-section-title mb-4">
          Weekly Activity
        </h2>
          <div className="flex items-end justify-between gap-2 h-32">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
              const value = analytics.weeklyProgress[index];
              const height = (value / maxWeeklyValue) * 100;
              return (
                <div key={day} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full bg-[var(--klein-blue-soft)] rounded-t-lg relative" style={{ height: '100px' }}>
                    <div
                      className="absolute bottom-0 w-full bg-[var(--klein-blue)] rounded-t-lg transition-all"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">{day}</span>
                  <span className="text-xs text-[var(--color-text-tertiary)]">{value}</span>
                </div>
              );
            })}
          </div>
        </Card>

      {/* Mastery Progress */}
      <Card>
        <h2 className="ds-section-title mb-4">
          Vocabulary Mastery
        </h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-[var(--color-text-secondary)]">Mastered</span>
                <span className="font-bold text-[var(--color-text-primary)]">{masteryPercentage}%</span>
              </div>
              <ProgressBar value={masteryPercentage} className="h-3" barClassName="h-3" />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {[
                { label: 'Mastered', value: analytics.masteredWords },
                { label: 'Learning', value: analytics.learningWords },
                { label: 'Weak', value: analytics.weakWords },
              ].map((m) => (
                <Stat key={m.label} value={m.value} label={m.label} accent className="items-center" />
              ))}
            </div>
          </div>
        </Card>

        {/* Additional Stats — card rows (no table) */}
        <div className="ds-stack-tight">
          {detailStats.map((stat) => (
            <div key={stat.label} className="ds-row flex items-center justify-between p-5">
              <span className="text-sm text-[var(--color-text-secondary)]">{stat.label}</span>
              <span className="text-2xl font-bold text-[var(--color-text-primary)]">{stat.value}</span>
            </div>
          ))}
        </div>

      {/* Insights Card */}
      <Card>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[color:var(--klein-on)]" style={{ background: 'var(--klein-gradient)' }}>
            <Icons.Sparkles />
          </div>
            <div className="flex-1">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-1">AI Insights</h3>
              <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>You're learning {analytics.dailyAverage} words per day on average</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Your mastery rate is {masteryPercentage}%, keep up the good work!</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Current streak: {analytics.currentStreak} days. Try to beat your record of {analytics.longestStreak} days!</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
    </div>
  );
}
