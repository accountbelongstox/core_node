
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';
import { LanguageCenter } from '../../i18n/LanguageCenter';

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

  return (
    <div className="h-full flex flex-col p-4 pt-12 animate-slide-up pb-24">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('home')} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
          <Icons.Back />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold dark:text-white">{t('stats.title') || 'Statistics'}</h1>
        </div>
        <button onClick={loadStats} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700" title={t('common.refresh') || 'Refresh'}>
          <div className={loading ? 'animate-spin' : ''}>🔄</div>
        </button>
      </div>

      {loading && !stats ? (
        <div className="flex items-center justify-center p-10">
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">{t('common.loading') || 'Loading...'}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Total Words Card */}
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-none shadow-xl">
            <div className="text-slate-400 text-sm mb-1">{t('stats.totalWordsLearned') || 'Total Words in Progress'}</div>
            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
              {stats?.total_words || user?.totalLearned || 0}
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <div>
                <span className="text-slate-400">{t('stats.mastered') || 'Mastered'}:</span>{' '}
                <span className="text-green-400 font-bold">{stats?.mastered_words || 0}</span>
              </div>
              <div>
                <span className="text-slate-400">{t('stats.learning') || 'Learning'}:</span>{' '}
                <span className="text-yellow-400 font-bold">{stats?.learning_words || 0}</span>
              </div>
              <div>
                <span className="text-slate-400">{t('stats.new') || 'New'}:</span>{' '}
                <span className="text-blue-400 font-bold">{stats?.new_words || 0}</span>
              </div>
            </div>
          </Card>

          {/* Progress Breakdown */}
          {stats && (
            <div className="glass-panel p-5 rounded-2xl">
              <h3 className="font-bold mb-4 dark:text-white">{t('stats.progressBreakdown') || 'Progress Breakdown'}</h3>
              <div className="space-y-3">
                {/* Mastered */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">
                      ✅ {t('stats.mastered') || 'Mastered'}
                    </span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {stats.mastered_words} ({Math.round((stats.mastered_words / (stats.total_words || 1)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-500"
                      style={{ width: `${(stats.mastered_words / (stats.total_words || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Learning */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">
                      📖 {t('stats.learning') || 'Learning'}
                    </span>
                    <span className="font-bold text-yellow-600 dark:text-yellow-400">
                      {stats.learning_words} ({Math.round((stats.learning_words / (stats.total_words || 1)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 transition-all duration-500"
                      style={{ width: `${(stats.learning_words / (stats.total_words || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* New */}
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-400">
                      🆕 {t('stats.new') || 'New'}
                    </span>
                    <span className="font-bold text-blue-600 dark:text-blue-400">
                      {stats.new_words} ({Math.round((stats.new_words / (stats.total_words || 1)) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${(stats.new_words / (stats.total_words || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <Card onClick={() => navigate('review_dashboard')} className="cursor-pointer hover:scale-[1.02] transition-transform">
              <div className="text-3xl mb-2">🔔</div>
              <div className="font-bold dark:text-white text-2xl">{stats?.needs_review || 0}</div>
              <div className="text-xs text-slate-500">{t('stats.needsReview') || 'Needs Review'}</div>
            </Card>
            <Card onClick={() => navigate('courses')} className="cursor-pointer hover:scale-[1.02] transition-transform">
              <div className="text-3xl mb-2">📚</div>
              <div className="font-bold dark:text-white text-2xl">{selectedLibrariesCount}</div>
              <div className="text-xs text-slate-500">{t('stats.activeLibraries') || 'Active Libraries'}</div>
            </Card>
            <Card>
              <div className="text-3xl mb-2">🧠</div>
              <div className="font-bold dark:text-white text-2xl">{retentionRate}%</div>
              <div className="text-xs text-slate-500">{t('stats.retentionRate') || 'Retention Rate'}</div>
            </Card>
            <Card>
              <div className="text-3xl mb-2">🔥</div>
              <div className="font-bold dark:text-white text-2xl">{user?.streak || 0}</div>
              <div className="text-xs text-slate-500">{t('stats.dayStreak') || 'Day Streak'}</div>
            </Card>
          </div>

          {/* Weekly Activity (Mock data for now) */}
          <div className="glass-panel p-5 rounded-2xl">
            <h3 className="font-bold mb-4 dark:text-white">{t('stats.weeklyActivity') || 'Weekly Activity'}</h3>
            <div className="flex items-end justify-between h-32 gap-2">
              {mockWeeklyData.map((h, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-blue-500/20 rounded-t-md relative overflow-hidden" style={{ height: '100%' }}>
                    <div
                      className="absolute bottom-0 w-full bg-blue-500 rounded-t-md transition-all duration-1000"
                      style={{ height: `${h}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-slate-400">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">
              {t('stats.weeklyActivityNote') || 'Activity data updates daily based on your learning sessions'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsPage;
