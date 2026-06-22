/* [v4.1-Iris] Social Leaderboard — ported from qy_capacitor/pages/Social/Leaderboard.tsx.
 * Live data only: the ranking tab loads GET /social/leaderboard?period=week|all
 * (AppQyV1Social.php) with a week/all period toggle. No mock fallback — a failed
 * or empty load renders an EmptyState. The badges tab has no dedicated backend
 * data source; achievements are DERIVED from the current user's real learning
 * stats (their leaderboard entry) via the shared WfAchievementCenter. */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { BackButton, ProgressBar, EmptyState, LoadingState } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { deriveAchievements, leaderEntryToAchievementInput } from '../services/WfAchievementCenter';

// Response shape of GET /social/leaderboard (after envelope unwrap to `data`).
interface LeaderEntry {
  rank: number;
  user_id: number;
  username: string;
  name: string;
  avatar_url?: string | null;
  xp: number;
  total_words: number;
  learned_words: number;
  mastered_words: number;
  is_current_user: boolean;
}
type Period = 'week' | 'all';

const avatarLetter = (name: string) => (name || '?').charAt(0).toUpperCase();

const SocialAvatar: React.FC<{ name: string; src?: string | null; className?: string }> = ({ name, src, className = '' }) =>
  src ? (
    <img src={src} alt={name} className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center font-bold bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] ${className}`}>
      {avatarLetter(name)}
    </div>
  );

const WfSocialLeaderboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const [tab, setTab] = useState<'ranking' | 'badges'>('ranking');
  const [period, setPeriod] = useState<Period>('all');
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const res = await wordflowApi.request<{ leaderboard: LeaderEntry[] }>(
          `/social/leaderboard?period=${period}`
        );
        if (!cancelled) setLeaderboard(Array.isArray(res?.leaderboard) ? res.leaderboard : []);
      } catch {
        if (!cancelled) {
          setLeaderboard([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period]);

  const me = leaderboard.find((u) => u.is_current_user);
  const achievements = deriveAchievements(leaderEntryToAchievementInput(me));

  const rankBadge = (rank: number) =>
    rank === 1
      ? 'bg-[var(--klein-blue)] text-[var(--klein-on)]'
      : rank === 2
        ? 'bg-slate-300 text-white'
        : rank === 3
          ? 'bg-orange-300 text-white'
          : 'bg-[var(--klein-blue-soft)] text-[var(--color-text-tertiary)]';

  return (
    <div className="min-h-screen pb-28">
      <div className="relative h-full flex flex-col px-[var(--page-padding-h)] pt-[var(--page-padding-v)] animate-slide-up max-w-md mx-auto">
        {/* Minimal asymmetric header */}
        <div className="flex justify-between items-center mb-[var(--space-breath)]">
          <div className="flex items-center gap-3">
            <BackButton onClick={() => navigate(wfPath('learn/home'))} />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              {t('social.community') || 'Community'}
            </h1>
          </div>
        </div>

        {/* Filter — pill nav */}
        <div className="ds-pill-nav mb-4" role="tablist" aria-label="Leaderboard filter">
          {([
            { id: 'ranking', label: t('social.rank') || 'Ranking' },
            { id: 'badges', label: t('social.badges') || 'Badges' },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={`ds-pill-chip ${tab === item.id ? 'is-active' : ''}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Period toggle (ranking only) */}
        {tab === 'ranking' && (
          <div className="ds-pill-nav mb-6" role="tablist" aria-label="Leaderboard period">
            {([
              { id: 'week', label: t('social.thisWeek') || 'This Week' },
              { id: 'all', label: t('social.allTime') || 'All Time' },
            ] as const).map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={period === item.id}
                onClick={() => setPeriod(item.id)}
                className={`ds-pill-chip ${period === item.id ? 'is-active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-3">
          {tab === 'ranking' ? (
            loading ? (
              <LoadingState label={t('common.loading') || 'Loading...'} />
            ) : loadError ? (
              <EmptyState
                icon={<Trophy className="w-10 h-10" />}
                title={t('social.leaderboardLoadFailed') || 'Could not load leaderboard'}
                description={t('social.tryAgainLater') || 'Please try again later'}
              />
            ) : leaderboard.length === 0 ? (
              <EmptyState
                icon={<Trophy className="w-10 h-10" />}
                title={t('social.leaderboardEmpty') || 'No rankings yet'}
                description={t('social.leaderboardEmptyHint') || 'Start learning words to appear here'}
              />
            ) : (
              <div className="ds-stack-tight flex flex-col">
                {leaderboard.map((u) => (
                  <div
                    key={u.user_id}
                    className={`ds-row p-5 flex items-center gap-4 ${u.is_current_user ? 'ring-2 ring-[var(--klein-ring)]' : ''}`}
                  >
                    <div className={`w-8 h-8 flex items-center justify-center font-bold rounded-full ${rankBadge(u.rank)}`}>
                      {u.rank}
                    </div>
                    <SocialAvatar name={u.name} src={u.avatar_url} className="w-10 h-10 rounded-full border border-[var(--border-highlight)]" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[var(--color-text-primary)] truncate">
                        {u.name}
                        {u.is_current_user && (
                          <span className="ml-2 text-xs font-normal text-[var(--klein-blue)]">
                            {t('social.you') || '(You)'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-tertiary)]">
                        {u.learned_words} {t('social.learnedWords') || 'learned'} · {u.mastered_words} {t('social.masteredWords') || 'mastered'}
                      </p>
                    </div>
                    <div className="text-[var(--klein-blue)] font-mono font-bold">{u.xp} XP</div>
                  </div>
                ))}
              </div>
            )
          ) : loading ? (
            <LoadingState label={t('common.loading') || 'Loading...'} />
          ) : loadError ? (
            <EmptyState
              icon={<Trophy className="w-10 h-10" />}
              title={t('social.badgesLoadFailed') || 'Could not load badges'}
              description={t('social.tryAgainLater') || 'Please try again later'}
            />
          ) : (
            <div className="ds-grid-breathing grid-cols-2">
              {achievements.map((a) => {
                const AchIcon = a.icon;
                return (
                  <div key={a.id} className={`ds-card p-5 flex flex-col items-center text-center ${!a.unlocked ? 'opacity-60' : ''}`}>
                    <div className={`mb-3 ${!a.unlocked ? 'text-[var(--color-text-tertiary)]' : 'text-[var(--klein-blue)]'}`}>
                      <AchIcon className="w-9 h-9" />
                    </div>
                    <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">{a.name}</h3>
                    <p className="text-xs text-[var(--color-text-tertiary)] mb-3 leading-tight">{a.description}</p>
                    {a.unlocked ? (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-[10px] font-bold rounded-full">
                        {t('social.unlocked') || 'Unlocked'}
                      </span>
                    ) : (
                      <ProgressBar value={a.progress} max={a.maxProgress} className="mt-auto" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WfSocialLeaderboardPage;
