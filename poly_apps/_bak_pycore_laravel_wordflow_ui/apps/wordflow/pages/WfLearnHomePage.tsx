/* [v4.1-Iris] WordFlow learning home, matched to qy_capacitor design-reference-{light,dark}.webp.
 * Ported from poly_apps/qy_capacitor/pages/Learn/Home.tsx but self-contained:
 * reads data from WordflowApi (no AppContext/LanguageCenter/RouteCenter), uses
 * react-router useNavigate + wfPath() for links. Stats prefer the real
 * /learning/stats endpoint (original ApiCenter.learning.getStats contract) with
 * the profile counters as fallback; learning modes route to learn/practice?mode=X
 * like the original; guest users get the sync/login prompt card. Degrades to
 * inline empty/error states when the backend is unreachable. */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarCheck,
  Sparkles,
  CircleCheck,
  Volume2,
  Library,
  ChevronRight,
  Flame,
  GraduationCap,
  Loader2,
} from 'lucide-react';
import { Button } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp, useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { wfRecitationCenter } from '../services/WfRecitationCenter';
import type { WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';

interface HomeStats {
  wordsLearned: number;
  currentStreak: number;
  todayGoal: number;
  todayProgress: number;
}

/** Tiny Klein progress ring for the Daily Recitation entry card. */
const MiniRing: React.FC<{ done: number; goal: number }> = ({ done, goal }) => {
  const size = 46;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(done / goal, 1) : 0;
  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 text-[var(--klein-blue)]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.2} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-[var(--color-text-primary)]">
        {done}
      </span>
    </div>
  );
};

const WfLearnHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, learningLanguage } = useWfApp();
  const { t } = useWfT();

  const [stats, setStats] = useState<HomeStats>({
    wordsLearned: 0,
    currentStreak: 0,
    todayGoal: 20,
    todayProgress: 0,
  });
  const [userName, setUserName] = useState<string>('');
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Daily-recitation entry card data (server-backed; live-updates on flushes).
  const [recite, setRecite] = useState<{ done: number; goal: number; streak: number } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setRecite(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // limit=1 keeps the payload tiny — only done_today/goal are read here.
        const [plan, streak] = await Promise.all([
          wordflowApi.recitationTodayPlan({ language: learningLanguage, limit: 1 }),
          wordflowApi.recitationStreak(),
        ]);
        if (cancelled) return;
        setRecite({
          done: plan.done_today ?? 0,
          goal: plan.goal ?? 0,
          streak: streak.current_streak ?? 0,
        });
      } catch (e) {
        // Recitation card is additive — the home stays usable without it.
        console.warn('[WfLearnHome] recitation card data failed:', e);
        if (!cancelled) setRecite(null);
      }
    })();
    // Live-update the mini ring while the user recites elsewhere in the app.
    const unsubscribe = wfRecitationCenter.subscribe((update) => {
      if (cancelled) return;
      setRecite((prev) => ({
        done: update.today.unique_words,
        goal: update.today.goal || prev?.goal || 0,
        streak: prev?.streak ?? 0,
      }));
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [isAuthenticated, learningLanguage]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Profile (best-effort; assistant degrades to guest when unauthenticated).
        try {
          const user = await wordflowApi.getUserProfile();
          if (!cancelled && user) {
            setUserName(user.nickname || user.username || user.name || '');
            setStats((prev) => ({
              wordsLearned: user.learned_words ?? user.totalLearned ?? prev.wordsLearned,
              currentStreak: user.streak ?? prev.currentStreak,
              todayGoal: user.dailyGoal ?? prev.todayGoal,
              todayProgress: user.dailyProgress ?? prev.todayProgress,
            }));
          }
        } catch {
          /* unauthenticated / offline — keep guest defaults */
        }

        // Real learning stats (original ApiCenter.learning.getStats contract):
        // overrides the profile-derived counters where the backend provides them.
        try {
          const res = await wordflowApi.getLearningStats();
          const s = res?.stats ?? res;
          if (!cancelled && s && typeof s === 'object') {
            setStats((prev) => ({
              wordsLearned:
                res?.total_words_learned ??
                ((s.learning_words ?? 0) + (s.mastered_words ?? 0) || prev.wordsLearned),
              currentStreak: res?.current_streak ?? prev.currentStreak,
              todayGoal: res?.daily_goal ?? prev.todayGoal,
              todayProgress: res?.today_progress ?? prev.todayProgress,
            }));
          }
        } catch {
          /* learning stats unavailable — keep profile-derived counters */
        }

        // Featured libraries → fall back to the user's own word groups.
        const wordGroups = await wordflowApi.getWordGroups();
        if (!cancelled) setGroups(Array.isArray(wordGroups) ? wordGroups.slice(0, 4) : []);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Unable to reach WordFlow backend.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const progressPercentage =
    stats.todayGoal > 0 ? Math.min((stats.todayProgress / stats.todayGoal) * 100, 100) : 0;

  // Original behavior: each mode opens learn/practice?mode=X (which forwards to
  // the matching immersive runner).
  const learningModes = [
    { id: 'reading', title: t('home.reading') || 'Reading', subtitle: t('home.flowContext') || 'Flow in context', icon: <BookOpen className="w-6 h-6" />, route: `${wfPath('learn/practice')}?mode=reading` },
    { id: 'flashcards', title: t('home.flashcards') || 'Flashcards', subtitle: t('home.spacedRepetition') || 'Spaced repetition', icon: <Sparkles className="w-6 h-6" />, route: `${wfPath('learn/practice')}?mode=flashcards` },
    { id: 'quiz', title: t('home.quiz') || 'Quiz', subtitle: t('home.gamifiedTest') || 'Gamified test', icon: <CircleCheck className="w-6 h-6" />, route: `${wfPath('learn/practice')}?mode=quiz` },
    { id: 'listening', title: t('nav.listening') || 'Listening', subtitle: t('home.passive') || 'Passive audio loop', icon: <Volume2 className="w-6 h-6" />, route: `${wfPath('learn/practice')}?mode=listening` },
  ];

  return (
    <div className="ds-page ds-section-gap route-fade min-h-screen bg-transparent pb-32">
      {/* Header / greeting */}
      <div className="pt-16 w-full">
        <div className="px-1">
          <span className="text-sm font-semibold text-[var(--color-text-secondary)]">
            {t('home.welcome') || 'Welcome Back'}
          </span>
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight mt-1 text-[var(--color-text-primary)]">
            {userName ? (t('home.hiUser', { name: userName }) || `Hi, ${userName}`) : (t('home.welcomeGuest') || 'Welcome Guest')}
          </h1>
        </div>
      </div>

      <div className="w-full ds-section-gap">
        {/* Today's Progress — Iris gradient hero surface */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-[color:var(--klein-on)] relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-8 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">{t('home.todayGoal') || "Today's Goal"}</p>
                <p className="text-3xl font-black tracking-tight mt-1">
                  {stats.todayProgress}/{stats.todayGoal}
                </p>
                <p className="text-white/80 text-xs mt-1">{t('home.words') || 'words'}</p>
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-white/40 flex items-center justify-center bg-white/15">
                <span className="text-xl font-bold">{Math.round(progressPercentage)}%</span>
              </div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <div
                className="bg-white h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Daily Recitation (每日背诵) — prominent entry card */}
        <button
          type="button"
          onClick={() => navigate(wfPath('learn/daily_recitation'))}
          className="ds-card ds-card-elevated w-full flex items-center gap-4 p-5 text-left group active:scale-[0.99] transition-transform"
        >
          {isAuthenticated && recite ? (
            <MiniRing done={recite.done} goal={recite.goal} />
          ) : (
            <div
              className="w-[46px] h-[46px] rounded-2xl flex items-center justify-center text-[color:var(--klein-blue)] flex-shrink-0"
              style={{ background: 'var(--klein-blue-soft)' }}
            >
              <CalendarCheck className="w-6 h-6" aria-hidden />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg text-[var(--color-text-primary)] group-hover:text-[var(--klein-blue)] transition-colors">
              {t('recitation.title')}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] truncate">
              {isAuthenticated && recite
                ? t('recitation.progressLabel', { done: recite.done, goal: recite.goal })
                : t('recitation.homeCardSubtitle')}
            </p>
          </div>
          {isAuthenticated && recite && recite.streak > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 bg-orange-500/10 text-orange-500 text-sm font-black">
              <Flame className="w-4 h-4" aria-hidden />
              {recite.streak}
            </span>
          )}
          <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0" />
        </button>

        {/* Quick stats */}
        <div className="ds-grid-breathing grid grid-cols-2">
          <div className="ds-card p-4 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-[color:var(--klein-blue)] flex-shrink-0"
              style={{ background: 'var(--klein-blue-soft)' }}
            >
              <GraduationCap className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black text-[var(--color-text-primary)] leading-none">{stats.wordsLearned}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('home.wordsLearned') || 'Words Learned'}</p>
            </div>
          </div>
          <div className="ds-card p-4 flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-[color:var(--klein-blue)] flex-shrink-0"
              style={{ background: 'var(--klein-blue-soft)' }}
            >
              <Flame className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-black text-[var(--color-text-primary)] leading-none">{stats.currentStreak}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{t('home.streak') || 'Day Streak'}</p>
            </div>
          </div>
        </div>

        {/* Featured libraries (from WordflowApi) */}
        <div>
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="ds-section-title">{t('home.library') || 'Library'}</h2>
            <button className="ds-link-more" onClick={() => navigate(wfPath('learn/library'))}>
              {t('home.viewAll') || 'View All'}
            </button>
          </div>

          {loading ? (
            <div className="ds-card p-8 flex items-center justify-center text-[var(--color-text-secondary)]">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading libraries…
            </div>
          ) : error ? (
            <div className="ds-empty p-6 text-center text-sm">
              {error}
              <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                Showing offline. Your progress is kept locally.
              </div>
            </div>
          ) : groups.length === 0 ? (
            <div className="ds-empty p-8 text-center">
              <Library className="w-7 h-7 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">No libraries yet</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                Add a vocabulary library to start learning.
              </p>
            </div>
          ) : (
            <div className="ds-stack ds-stack-tight">
              {groups.map((g) => (
                <div
                  key={g.id}
                  onClick={() => navigate(`${wfPath('learn/practice')}?library=${encodeURIComponent(g.id)}`)}
                  className="ds-row flex items-center gap-4 p-4 cursor-pointer group"
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-[color:var(--klein-blue)] flex-shrink-0 text-xl"
                    style={{ background: 'var(--klein-blue-soft)' }}
                  >
                    {g.coverImage && g.coverImage.length <= 2 ? g.coverImage : <BookOpen className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
                      {g.name}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      {g.count} words · {Math.round(g.progress || 0)}% complete
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Learning modes */}
        <div>
          <h2 className="ds-section-title mb-3 px-1">{t('home.startLearning') || 'Start Learning'}</h2>
          <div className="ds-grid-breathing grid grid-cols-2">
            {learningModes.map((mode) => (
              <div key={mode.id} className="ds-bento" onClick={() => navigate(mode.route)}>
                <div className="ds-bento-chip mb-3">{mode.icon}</div>
                <p className="font-bold text-[var(--color-text-primary)]">{mode.title}</p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{mode.subtitle}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions — original pair: Library + Review Words */}
        <div className="ds-grid-breathing grid grid-cols-2">
          <button
            className="ds-card p-4 flex items-center justify-center gap-2 font-semibold text-[var(--color-text-primary)]"
            onClick={() => navigate(wfPath('learn/library'))}
          >
            <Library className="w-5 h-5 text-[var(--klein-blue)]" />
            <span>{t('home.library') || 'Library'}</span>
          </button>
          <button
            className="ds-card p-4 flex items-center justify-center gap-2 font-semibold text-[var(--color-text-primary)]"
            onClick={() => navigate(wfPath('learn/review'))}
          >
            <Sparkles className="w-5 h-5 text-[var(--klein-blue)]" />
            <span>{t('home.reviewWords') || 'Review Words'}</span>
          </button>
        </div>

        {/* Guest mode prompt — restored from the original Learn/Home */}
        {!isAuthenticated && (
          <div className="ds-card p-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg text-[var(--color-text-primary)]">
                  {t('home.syncYourProgress') || 'Sync Your Progress'}
                </p>
                <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                  {t('home.syncProgressDescription') ||
                    'Login to save your streaks, vocabulary lists, and mastery levels across devices.'}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Button variant="grad" onClick={() => navigate(wfPath('auth/login'))}>
                {t('home.loginNow') || 'Login Now'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WfLearnHomePage;
