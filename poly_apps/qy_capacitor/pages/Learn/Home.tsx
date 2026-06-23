/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Ad-hoc quiz SVG → lucide CircleCheck; Array.isArray guard added before recentActivities.map. Propagate the Iris layer to un-beautified siblings. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Card, Button, SectionTitle, BentoTile, Stat } from '../../components/UI';
import { CircleCheck } from 'lucide-react';
import { ApiCenter } from '../../services/ApiCenter';

interface LearningStats {
  wordsLearned: number;
  currentStreak: number;
  todayGoal: number;
  todayProgress: number;
}

interface RecentActivity {
  id: string;
  type: 'reading' | 'flashcard' | 'quiz' | 'listening';
  title: string;
  progress: number;
  lastAccessed: string;
}

export default function LearnHome() {
  const { user, navigate, t } = useContext(AppContext);
  const [stats, setStats] = useState<LearningStats>({
    wordsLearned: 0,
    currentStreak: 0,
    todayGoal: 20,
    todayProgress: 0
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLearningData();
  }, [user]);

  const loadLearningData = async () => {
    setLoading(true);
    try {
      if (user) {
        // Load actual user statistics
        const statsResult = await ApiCenter.learning.getStats(user.id);
        if (statsResult.success && statsResult.data) {
          setStats({
            wordsLearned: statsResult.data.total_words_learned || 0,
            currentStreak: statsResult.data.current_streak || 0,
            todayGoal: statsResult.data.daily_goal || 20,
            todayProgress: statsResult.data.today_progress || 0
          });
        }
      }
    } catch (error) {
      console.error('Failed to load learning data:', error);
    } finally {
      setLoading(false);
    }
  };

  const progressPercentage = (stats.todayProgress / stats.todayGoal) * 100;

  // Defensive: a non-array from any state path can never throw .map here
  const safeRecentActivities = Array.isArray(recentActivities) ? recentActivities : [];

  const learningModes = [
    {
      id: 'reading',
      title: t('home.reading'),
      subtitle: t('home.flowContext'),
      icon: <Icons.Book />,
      route: 'learn/practice?mode=reading'
    },
    {
      id: 'flashcards',
      title: t('home.flashcards'),
      subtitle: t('home.spacedRepetition'),
      icon: <Icons.Sparkles />,
      route: 'learn/practice?mode=flashcards'
    },
    {
      id: 'quiz',
      title: t('home.quiz'),
      subtitle: t('home.gamifiedTest'),
      icon: <CircleCheck className="w-6 h-6" aria-hidden />,
      route: 'learn/practice?mode=quiz'
    },
    {
      id: 'listening',
      title: t('nav.listening'),
      subtitle: t('home.passive') + ' - ' + t('home.audioLoop'),
      icon: <Icons.Sound />,
      route: 'learn/practice?mode=listening'
    },
  ];

  return (
    <div className="ds-page ds-section-gap min-h-screen bg-transparent pb-32">
      {/* Header */}
      <div className="pt-20 w-full">
        <div className="px-1">
          <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
            {t('home.welcome')}
          </span>
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight mt-1 text-[var(--color-text-primary)]">
            {user ? t('home.hiUser').replace('{name}', user.username) : t('home.welcomeGuest')}
          </h1>
        </div>
      </div>

      <div className="w-full ds-section-gap">
        {/* Today's Progress Card — Iris gradient hero surface */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-[color:var(--klein-on)] relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-12 -left-8 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">{t('home.todayGoal')}</p>
                <p className="text-3xl font-black tracking-tight mt-1">{stats.todayProgress}/{stats.todayGoal}</p>
                <p className="text-white/80 text-xs mt-1">{t('home.words')}</p>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-white/40 flex items-center justify-center bg-white/15">
                <span className="text-xl font-bold">{Math.round(progressPercentage)}%</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="ds-grid-breathing grid grid-cols-2">
          <Card>
            <Stat value={stats.wordsLearned} label={t('home.wordsLearned')} accent />
          </Card>
          <Card>
            <Stat value={stats.currentStreak} label={`${t('home.currentStreak')} · ${t('home.days')}`} accent />
          </Card>
        </div>

        {/* Continue Learning Section */}
        {safeRecentActivities.length > 0 && (
          <div>
            <SectionTitle title={t('home.continueReading')} className="mb-3 px-1" />
            <div className="ds-stack ds-stack-tight">
              {safeRecentActivities.map((activity) => (
                <div
                  key={activity.id}
                  onClick={() => navigate(`learn/practice?mode=${activity.type}&resume=${activity.id}`)}
                  className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[color:var(--klein-blue)] flex-shrink-0" style={{ background: 'var(--klein-blue-soft)' }}>
                    <Icons.Book />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">{activity.title}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{activity.progress}% complete</p>
                  </div>
                  <div className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0">
                    <Icons.ChevronRight />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Learning Modes */}
        <div>
          <SectionTitle title={t('home.startLearning')} className="mb-3 px-1" />
          <div className="ds-grid-breathing grid grid-cols-2">
            {learningModes.map((mode) => (
              <BentoTile
                key={mode.id}
                title={mode.title}
                description={mode.subtitle}
                chipIcon={mode.icon}
                onClick={() => navigate(mode.route)}
                className="cursor-pointer"
              />
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="ds-grid-breathing grid grid-cols-2">
          <Button variant="secondary" onClick={() => navigate('learn/library')}>
            <Icons.Library />
            <span>{t('home.library')}</span>
          </Button>
          <Button variant="secondary" onClick={() => navigate('learn/review')}>
            <Icons.Sparkles />
            <span>{t('home.reviewWords')}</span>
          </Button>
        </div>

        {/* Guest Mode Prompt */}
        {!user && (
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg text-[var(--color-text-primary)]">{t('home.syncYourProgress')}</p>
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">{t('home.syncProgressDescription')}</p>
              </div>
            </div>
            <div className="mt-4">
              <Button variant="grad" onClick={() => navigate('login')}>
                {t('home.loginNow')}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
