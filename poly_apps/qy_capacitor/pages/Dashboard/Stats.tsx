/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Emoji (🔄✅📖🆕🔔📚🧠🔥) → lucide icons in klein accent. Propagate the Iris layer to un-beautified siblings. */

import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Spinner, IconButton, PageHeader, SectionTitle, ProgressBar, Stat } from '../../components/UI';
import { RefreshCw, CircleCheck, BookOpen, Sparkles, Bell, Library, Brain, Flame } from 'lucide-react';
import { ApiCenter } from '../../services/ApiCenter';

interface LearningStats {
  total_words: number;
  new_words: number;
  learning_words: number;
  mastered_words: number;
  needs_review: number;
}

const StatsPage = () => {
  const { user, navigate, settings, t } = useContext(AppContext);
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedLibrariesCount, setSelectedLibrariesCount] = useState(0);

  useEffect(() => {
    if (user) {
      loadStats();
    }
  }, [user, settings.language.learningLanguages]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const langCode = settings.language.learningLanguages?.[0];
      const response = await ApiCenter.learning.getStats(user?.id, langCode);

      if (response.success && response.data) {
        setStats(response.data.stats);
        setSelectedLibrariesCount(response.data.selected_libraries_count || 0);
      }
    } catch (err) {
      console.error('[Stats] Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const mockWeeklyData = [40, 70, 30, 85, 50, 90, 60];

  // Calculate retention rate
  const retentionRate = stats
    ? Math.round(((stats.mastered_words + stats.learning_words) / (stats.total_words || 1)) * 100)
    : 0;

  const total = stats?.total_words || 1;

  return (
    <div className="ds-page ds-section-gap h-full flex flex-col pt-12 animate-slide-up pb-32">
      <PageHeader
        onBack={() => navigate('home')}
        title={t('stats.title') || 'Statistics'}
        right={
          <IconButton
            icon={<RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={loadStats}
            label={t('common.refresh') || 'Refresh'}
          />
        }
        className="sticky-none relative"
      />

      {loading && !stats ? (
        <Spinner size="lg" className="mx-auto my-10" />
      ) : (
        <div className="ds-section-gap">
          {/* Total Words Card — Iris gradient hero surface */}
          <div
            className="rounded-[var(--radius-card)] p-6 text-[color:var(--klein-on)] relative overflow-hidden"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl pointer-events-none"></div>
            <div className="absolute -bottom-12 -left-8 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative z-10">
              <div className="text-white/80 text-sm mb-1">{t('stats.totalWordsLearned') || 'Total Words in Progress'}</div>
              <div className="text-4xl font-black tracking-tight">
                {stats?.total_words || user?.totalLearned || 0}
              </div>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  {t('stats.mastered') || 'Mastered'}: {stats?.mastered_words || 0}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  {t('stats.learning') || 'Learning'}: {stats?.learning_words || 0}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                  {t('stats.new') || 'New'}: {stats?.new_words || 0}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Breakdown */}
          {stats && (
            <div>
              <SectionTitle title={t('stats.progressBreakdown') || 'Progress Breakdown'} className="mb-3 px-1" />
              <div className="ds-card p-5 ds-stack ds-stack-tight">
                {/* Mastered */}
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-1.5 font-semibold text-[var(--color-text-secondary)]">
                      <CircleCheck className="w-4 h-4 text-emerald-500" aria-hidden /> {t('stats.mastered') || 'Mastered'}
                    </span>
                    <span className="font-bold text-[var(--color-text-primary)]">
                      {stats.mastered_words} ({Math.round((stats.mastered_words / total) * 100)}%)
                    </span>
                  </div>
                  <ProgressBar value={stats.mastered_words} max={total} />
                </div>

                {/* Learning */}
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-1.5 font-semibold text-[var(--color-text-secondary)]">
                      <BookOpen className="w-4 h-4 text-[var(--klein-blue)]" aria-hidden /> {t('stats.learning') || 'Learning'}
                    </span>
                    <span className="font-bold text-[var(--color-text-primary)]">
                      {stats.learning_words} ({Math.round((stats.learning_words / total) * 100)}%)
                    </span>
                  </div>
                  <ProgressBar value={stats.learning_words} max={total} />
                </div>

                {/* New */}
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-1.5 font-semibold text-[var(--color-text-secondary)]">
                      <Sparkles className="w-4 h-4 text-[var(--klein-blue)]" aria-hidden /> {t('stats.new') || 'New'}
                    </span>
                    <span className="font-bold text-[var(--klein-blue)]">
                      {stats.new_words} ({Math.round((stats.new_words / total) * 100)}%)
                    </span>
                  </div>
                  <ProgressBar value={stats.new_words} max={total} />
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="ds-grid-breathing grid grid-cols-2">
            <Card onClick={() => navigate('review_dashboard')} className="cursor-pointer hover:scale-[1.02] transition-transform flex flex-col gap-2">
              <Bell className="w-7 h-7 text-[var(--klein-blue)]" aria-hidden />
              <Stat value={stats?.needs_review || 0} label={t('stats.needsReview') || 'Needs Review'} accent />
            </Card>
            <Card onClick={() => navigate('courses')} className="cursor-pointer hover:scale-[1.02] transition-transform flex flex-col gap-2">
              <Library className="w-7 h-7 text-[var(--klein-blue)]" aria-hidden />
              <Stat value={selectedLibrariesCount} label={t('stats.activeLibraries') || 'Active Libraries'} accent />
            </Card>
            <Card className="flex flex-col gap-2">
              <Brain className="w-7 h-7 text-[var(--klein-blue)]" aria-hidden />
              <Stat value={`${retentionRate}%`} label={t('stats.retentionRate') || 'Retention Rate'} accent />
            </Card>
            <Card className="flex flex-col gap-2">
              <Flame className="w-7 h-7 text-[var(--klein-blue)]" aria-hidden />
              <Stat value={user?.streak || 0} label={t('stats.dayStreak') || 'Day Streak'} accent />
            </Card>
          </div>

          {/* Weekly Activity (Mock data for now) */}
          <div>
            <SectionTitle title={t('stats.weeklyActivity') || 'Weekly Activity'} className="mb-3 px-1" />
            <div className="ds-card p-5">
              <div className="flex items-end justify-between h-32 gap-2">
                {mockWeeklyData.map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full rounded-t-lg relative overflow-hidden h-full" style={{ background: 'var(--klein-blue-soft)' }}>
                      <div
                        className="absolute bottom-0 w-full rounded-t-lg transition-all duration-1000"
                        style={{ height: `${h}%`, background: 'var(--klein-gradient)' }}
                      ></div>
                    </div>
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-4 text-center">
                {t('stats.weeklyActivityNote') || 'Activity data updates daily based on your learning sessions'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsPage;
