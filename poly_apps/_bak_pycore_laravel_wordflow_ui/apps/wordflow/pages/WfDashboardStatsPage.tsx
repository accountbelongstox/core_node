/* [v4.1-Iris] Stats — ported from poly_apps/qy_capacitor/pages/Dashboard/Stats.tsx.
 * Self-contained: primary data source is the real /learning/stats endpoint
 * (wfLearningStatsCenter.getStats → { stats, selected_libraries_count }, same
 * contract as the original ApiCenter.learning.getStats), with profile +
 * retention buckets as fallback when it is unavailable. Refresh forces a cache
 * drop. react-router useNavigate + wfPath() for nav, useWfApp() for the current
 * user. Every call is try/caught; shows a spinner while loading and inline
 * empties when the backend is down. Faithful Iris look (gradient total hero,
 * progress breakdown, quick-stat grid, weekly activity). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, CircleCheck, BookOpen, Sparkles, Bell, Library, Brain, Flame,
} from 'lucide-react';
import {
  Card, Spinner, IconButton, PageHeader, SectionTitle, ProgressBar, Stat,
} from '../WfUI';
import { useWfApp, useWfT } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { wfLearningStatsCenter } from '../services/WfLearningStatsCenter';
import type { RetentionStat } from '../../../core/api-libs/wordflow/wordflowTypes';

interface LearningStats {
  total_words: number;
  new_words: number;
  learning_words: number;
  mastered_words: number;
  needs_review: number;
}

const WfDashboardStatsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useWfApp();
  const { t } = useWfT();

  const [stats, setStats] = useState<LearningStats | null>(null);
  const [selectedLibrariesCount, setSelectedLibrariesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadStats = async (force = false) => {
    setLoading(true);
    try {
      let derived: LearningStats | null = null;

      // Primary: the real learning-stats endpoint (original ApiCenter
      // contract: { stats: {...}, selected_libraries_count }).
      try {
        const res = await wfLearningStatsCenter.getStats(force);
        const s = res?.stats ?? res;
        if (s && typeof s === 'object' && ('total_words' in s || 'mastered_words' in s)) {
          derived = {
            total_words: s.total_words ?? 0,
            new_words: s.new_words ?? 0,
            learning_words: s.learning_words ?? 0,
            mastered_words: s.mastered_words ?? 0,
            needs_review: s.needs_review ?? 0,
          };
          setSelectedLibrariesCount(res?.selected_libraries_count ?? 0);
        }
      } catch {
        /* learning stats unavailable — fall through to profile/retention */
      }

      // Fallback: live profile counters.
      if (!derived) {
        try {
          const profile = await wordflowApi.getUserProfile();
          if (profile) {
            derived = {
              total_words: profile.total_words ?? profile.totalLearned ?? 0,
              mastered_words: profile.mastered_words ?? 0,
              learning_words: profile.learned_words ?? 0,
              new_words: 0,
              needs_review: 0,
            };
          }
        } catch {
          /* unauthenticated / offline */
        }

        try {
          const retention: RetentionStat[] = await wordflowApi.getRetentionStats();
          if (Array.isArray(retention) && retention.length > 0) {
            const bucket = (name: string) =>
              retention.find((r) => r.level?.toLowerCase().includes(name))?.count ?? 0;
            const mastered = bucket('master');
            const learning = bucket('learn');
            const critical = bucket('critical') || bucket('new');
            derived = {
              total_words: retention.reduce((sum, r) => sum + (r.count || 0), 0) || derived?.total_words || 0,
              mastered_words: mastered || derived?.mastered_words || 0,
              learning_words: learning || derived?.learning_words || 0,
              new_words: critical,
              needs_review: critical,
            };
          }
        } catch {
          /* retention endpoint unavailable — keep profile-derived stats */
        }
      }

      setStats(derived);
    } catch (e) {
      console.error('[WfStats] failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    // Re-fetch when another runner reports progress (stats caches were dropped).
    const unsubscribe = wfLearningStatsCenter.subscribe(() => loadStats());
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mockWeeklyData = [40, 70, 30, 85, 50, 90, 60];
  const total = stats?.total_words || 1;
  const retentionRate = stats
    ? Math.round(((stats.mastered_words + stats.learning_words) / total) * 100)
    : 0;

  return (
    <div className="ds-page ds-section-gap h-full flex flex-col pt-12 route-fade pb-32">
      <PageHeader
        onBack={() => navigate(wfPath('home'))}
        title={t('stats.title') || 'Statistics'}
        right={
          <IconButton
            icon={<RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => loadStats(true)}
            label={t('common.refresh') || 'Refresh'}
          />
        }
        className="sticky-none relative"
      />

      {loading && !stats ? (
        <Spinner size="lg" className="mx-auto my-10" />
      ) : (
        <div className="ds-section-gap">
          {/* Total words — Iris gradient hero */}
          <div
            className="rounded-[var(--radius-card)] p-6 text-[color:var(--klein-on)] relative overflow-hidden"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-8 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
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

          {/* Progress breakdown */}
          {stats && (
            <div>
              <SectionTitle title={t('stats.progressBreakdown') || 'Progress Breakdown'} className="mb-3 px-1" />
              <div className="ds-card p-5 ds-stack ds-stack-tight">
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

          {/* Quick stats grid */}
          <div className="ds-grid-breathing grid grid-cols-2">
            <Card onClick={() => navigate(wfPath('review_dashboard'))} className="cursor-pointer hover:scale-[1.02] transition-transform flex flex-col gap-2">
              <Bell className="w-7 h-7 text-[var(--klein-blue)]" aria-hidden />
              <Stat value={stats?.needs_review || 0} label={t('stats.needsReview') || 'Needs Review'} accent />
            </Card>
            <Card onClick={() => navigate(wfPath('courses'))} className="cursor-pointer hover:scale-[1.02] transition-transform flex flex-col gap-2">
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

          {/* Weekly activity */}
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
                      />
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

export default WfDashboardStatsPage;
