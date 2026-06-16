/* [v4.1-Iris] Social Center — ported from poly_apps/qy_capacitor/pages/Mine/Social.tsx.
 * Live data only: friends / activities / leaderboard come from the AppQyV1
 * social API (GET /social/friends, /social/activities, /social/leaderboard;
 * routes/AppQyV1Router/AppQyV1Social.php). No mock fallback — failed or empty
 * loads render EmptyState blocks. Achievements have no backend entity yet, so
 * they are DERIVED from the current user's real learning counters (their
 * leaderboard entry: learned/mastered/total words) via the shared
 * WfAchievementCenter.deriveAchievements.
 * Faithful Iris look (asymmetric header, quick-stat grid, pill-nav tabs,
 * podium, achievements grid). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Icons, Button, ProgressBar, SectionTitle, EmptyState, LoadingState } from '../WfUI';
import { useWfApp, useWfT } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { deriveAchievements, leaderEntryToAchievementInput } from '../services/WfAchievementCenter';
import { wfSettingsCenter } from '../services/WfSettingsCenter';
import { Users, Gift, Heart, Crown, Trophy, Zap, Check } from 'lucide-react';

type TabType = 'friends' | 'leaderboard' | 'achievements';

// Response shapes of routes/AppQyV1Router/AppQyV1Social.php (after the
// WordflowApi envelope unwrap to `data`).
interface SocialFriend {
  id: number;
  username: string;
  name: string;
  avatar_url?: string | null;
  status: 'online' | 'studying' | 'offline';
  stats: { total_words: number; learned_words: number; mastered_words: number };
}
interface SocialActivity {
  id: string;
  user_id: number;
  user_name: string;
  avatar_url?: string | null;
  action: string;
  time: string;
}
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

const avatarLetter = (name: string) => (name || '?').charAt(0).toUpperCase();

const SocialAvatar: React.FC<{ name: string; src?: string | null; className?: string }> = ({ name, src, className = '' }) =>
  src ? (
    <img src={src} alt={name} className={`object-cover ${className}`} />
  ) : (
    <div className={`flex items-center justify-center font-bold bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] ${className}`}>
      {avatarLetter(name)}
    </div>
  );

// "2026-06-11 11:09:40" / ISO → compact relative label.
const timeAgo = (raw: string): string => {
  const date = new Date(String(raw).replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return raw;
  const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
};

// Fallback weekly target when the user has no per-account daily goal yet.
const WEEKLY_CHALLENGE_FALLBACK = 50;

const WfMineSocialPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useWfApp();
  const { t } = useWfT();
  const [activeTab, setActiveTab] = useState<TabType>('friends');

  const [friends, setFriends] = useState<SocialFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState(false);
  const [activities, setActivities] = useState<SocialActivity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState(false);
  // Weekly learned-word count of the current user (period=week leaderboard
  // entry) — powers the weekly-challenge card with real data.
  const [weeklyLearned, setWeeklyLearned] = useState<number | null>(null);
  // Weekly target = the user's own daily goal × 7 (wfSettingsCenter, which
  // roams via /user/preferences); fixed fallback only when no goal is set.
  const [weeklyTarget, setWeeklyTarget] = useState<number>(() => {
    const dailyGoal = wfSettingsCenter.getSnapshot().learning.dailyGoal;
    return dailyGoal > 0 ? dailyGoal * 7 : WEEKLY_CHALLENGE_FALLBACK;
  });
  useEffect(() => {
    let alive = true;
    wfSettingsCenter.load().then((s) => {
      if (alive && s.learning.dailyGoal > 0) setWeeklyTarget(s.learning.dailyGoal * 7);
    });
    const unsubscribe = wfSettingsCenter.subscribe((s) => {
      if (s.learning.dailyGoal > 0) setWeeklyTarget(s.learning.dailyGoal * 7);
    });
    return () => { alive = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await wordflowApi.request<{ friends: SocialFriend[] }>('/social/friends');
        if (!cancelled) setFriends(Array.isArray(res?.friends) ? res.friends : []);
      } catch {
        if (!cancelled) { setFriends([]); setFriendsError(true); }
      } finally {
        if (!cancelled) setFriendsLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await wordflowApi.request<{ activities: SocialActivity[] }>('/social/activities');
        if (!cancelled) setActivities(Array.isArray(res?.activities) ? res.activities : []);
      } catch {
        if (!cancelled) { setActivities([]); setActivitiesError(true); }
      } finally {
        if (!cancelled) setActivitiesLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await wordflowApi.request<{ leaderboard: LeaderEntry[] }>('/social/leaderboard?period=all');
        if (!cancelled) setLeaderboard(Array.isArray(res?.leaderboard) ? res.leaderboard : []);
      } catch {
        if (!cancelled) { setLeaderboard([]); setLeaderboardError(true); }
      } finally {
        if (!cancelled) setLeaderboardLoading(false);
      }
    })();

    (async () => {
      try {
        const res = await wordflowApi.request<{ leaderboard: LeaderEntry[] }>('/social/leaderboard?period=week');
        const mine = Array.isArray(res?.leaderboard) ? res.leaderboard.find((u) => u.is_current_user) : undefined;
        if (!cancelled) setWeeklyLearned(mine ? mine.learned_words + mine.mastered_words : 0);
      } catch {
        if (!cancelled) setWeeklyLearned(null);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  if (!user) {
    return (
      <div className="min-h-screen pb-28 flex items-center justify-center px-[var(--page-padding-h)]">
        <Card className="relative max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)]">
            <Icons.Lock />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            {t('social.loginRequired') || 'Login Required'}
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {t('social.loginToView') || 'Please login to view your social network'}
          </p>
          <Button variant="klein" onClick={() => navigate(wfPath('auth/login'))}>
            {t('auth.login') || 'Log in'}
          </Button>
        </Card>
      </div>
    );
  }

  const me = leaderboard.find((u) => u.is_current_user);
  const achievements = deriveAchievements(leaderEntryToAchievementInput(me));
  const activeFriends = friends.filter((f) => f.status === 'online' || f.status === 'studying');
  const unlockedAchievements = achievements.filter((a) => a.unlocked).length;

  const statusDot = (status: string) =>
    status === 'online' ? 'bg-green-500' : status === 'studying' ? 'bg-[var(--klein-blue)]' : 'bg-slate-400';

  return (
    <div className="min-h-screen pb-28">
      <div className="relative pt-16 px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            {t('social.center') || 'Social Center'}
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            {t('social.centerSubtitle') || 'Connect with friends and compete globally'}
          </p>
        </div>

        {/* Quick stats — real counts (friends / global rank / derived badges) */}
        <div className="ds-grid-breathing grid-cols-3">
          {[
            { v: friendsError ? '-' : friends.length, l: t('social.friendsShort') || 'Friends' },
            { v: me ? `#${me.rank}` : '-', l: t('social.globalRank') || 'Global Rank' },
            { v: unlockedAchievements, l: t('social.badgesShort') || 'Badges' },
          ].map((s, i) => (
            <div key={i} className="ds-card text-center p-5">
              <p className="text-3xl font-bold text-[var(--klein-blue)]">{s.v}</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="ds-pill-nav" role="tablist" aria-label="Social tabs">
          {([
            { id: 'friends', label: t('social.friendsTab') || 'Friends' },
            { id: 'leaderboard', label: t('social.leaderboardTab') || 'Leaderboard' },
            { id: 'achievements', label: t('social.achievementsTab') || 'Achievements' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`ds-pill-chip ${activeTab === tab.id ? 'is-active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Friends */}
        {activeTab === 'friends' && (
          <>
            <div className="space-y-3">
              <SectionTitle
                title={`${t('social.activeNow') || 'Active Now'} (${activeFriends.length})`}
                className="px-1"
                action={
                  <button
                    onClick={() => navigate(wfPath('friends'))}
                    className="text-sm text-[var(--klein-blue)] hover:underline font-semibold ds-touch-target"
                  >
                    + {t('social.addFriends') || 'Add Friends'}
                  </button>
                }
              />
              {friendsLoading ? (
                <LoadingState label={t('common.loading') || 'Loading...'} />
              ) : friendsError ? (
                <EmptyState
                  icon={<Users className="w-10 h-10" />}
                  title={t('social.friendsLoadFailed') || 'Could not load friends'}
                  description={t('social.tryAgainLater') || 'Please try again later'}
                />
              ) : activeFriends.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {activeFriends.map((friend) => (
                    <div key={friend.id} className="flex flex-col items-center gap-2 min-w-[70px]">
                      <div className="relative">
                        <SocialAvatar name={friend.name} src={friend.avatar_url} className="w-16 h-16 rounded-2xl border border-[var(--border-highlight)] shadow-sm text-xl" />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--color-surface)] ${statusDot(friend.status)}`} />
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-secondary)] truncate w-full text-center">
                        {friend.name.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Users className="w-10 h-10" />}
                  title={t('social.noFriendsOnline') || 'No friends online right now'}
                  description={
                    friends.length === 0
                      ? (t('social.followSomeone') || 'Follow someone to build your circle')
                      : undefined
                  }
                />
              )}
            </div>

            {!friendsLoading && !friendsError && friends.length > 0 && (
              <div className="space-y-3">
                <SectionTitle title={`${t('social.allFriends') || 'All Friends'} (${friends.length})`} className="px-1" />
                <div className="ds-stack-tight flex flex-col">
                  {friends.map((friend) => (
                    <div key={friend.id} className="ds-row p-5 cursor-pointer ds-touch-target flex items-center gap-4" onClick={() => navigate(wfPath('friends'))}>
                      <div className="relative">
                        <SocialAvatar name={friend.name} src={friend.avatar_url} className="w-12 h-12 rounded-full border border-[var(--border-highlight)]" />
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-surface)] ${statusDot(friend.status)}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-[var(--color-text-primary)] truncate">{friend.name}</h3>
                        <p className="text-xs text-[var(--color-text-tertiary)]">
                          {friend.stats.learned_words} {t('social.learnedWords') || 'learned'} · {friend.stats.mastered_words} {t('social.masteredWords') || 'mastered'}
                        </p>
                      </div>
                      <span className="text-[var(--color-text-tertiary)]"><Icons.ChevronRight /></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <SectionTitle title={t('social.recentActivity') || 'Recent Activity'} className="px-1" />
              {activitiesLoading ? (
                <LoadingState label={t('common.loading') || 'Loading...'} />
              ) : activitiesError ? (
                <EmptyState
                  icon={<Heart className="w-10 h-10" />}
                  title={t('social.activitiesLoadFailed') || 'Could not load activity'}
                  description={t('social.tryAgainLater') || 'Please try again later'}
                />
              ) : activities.length === 0 ? (
                <EmptyState
                  icon={<Heart className="w-10 h-10" />}
                  title={t('social.noActivity') || 'No recent activity'}
                  description={t('social.noActivityHint') || 'Activity from people you follow shows up here'}
                />
              ) : (
                <div className="ds-stack-tight flex flex-col">
                  {activities.map((activity) => (
                    <div key={activity.id} className="ds-row p-5 flex gap-4">
                      <SocialAvatar name={activity.user_name} src={activity.avatar_url} className="w-12 h-12 rounded-full border border-[var(--border-highlight)] text-base flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[var(--color-text-primary)]">
                          <span className="font-bold">{activity.user_name}</span> {activity.action}
                        </p>
                        <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{timeAgo(activity.time)}</p>
                      </div>
                      <div className="flex flex-col items-center justify-center gap-1">
                        <button aria-label="Like" className="text-slate-300 hover:text-red-500 transition-colors">
                          <Heart className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Card>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1 text-[var(--color-text-primary)]">{t('social.inviteFriends') || 'Invite Friends'}</h3>
                  <p className="text-[var(--color-text-secondary)] text-sm">{t('social.getProFree') || 'Get Pro features free for each friend'}</p>
                </div>
                <Gift className="w-9 h-9 text-[var(--klein-blue)]" />
              </div>
              <Button variant="klein" className="mt-4">{t('social.shareInvite') || 'Share Invite Link'}</Button>
            </Card>
          </>
        )}

        {/* Leaderboard */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-3">
            <SectionTitle title={t('social.globalRankings') || 'Global Rankings'} className="px-1" />
            {leaderboardLoading ? (
              <LoadingState label={t('common.loading') || 'Loading...'} />
            ) : leaderboardError ? (
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
              <>
                <Card>
                  <div className="flex items-end justify-center gap-4 py-4">
                    {leaderboard[1] && (
                      <div className="flex flex-col items-center">
                        <SocialAvatar name={leaderboard[1].name} src={leaderboard[1].avatar_url} className="w-16 h-16 rounded-full border-4 border-slate-300 mb-2 text-xl" />
                        <div className="w-20 h-16 bg-slate-300 rounded-t-xl flex items-center justify-center text-2xl font-bold text-white">2</div>
                        <p className="text-xs font-bold text-[var(--color-text-secondary)] mt-2 truncate w-20 text-center">{leaderboard[1].name.split(' ')[0]}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">{leaderboard[1].xp} XP</p>
                      </div>
                    )}
                    {leaderboard[0] && (
                      <div className="flex flex-col items-center -mt-4">
                        <Crown className="w-6 h-6 mb-1 text-[var(--klein-blue)]" fill="currentColor" />
                        <SocialAvatar name={leaderboard[0].name} src={leaderboard[0].avatar_url} className="w-20 h-20 rounded-full border-4 border-[var(--klein-blue)] mb-2 text-2xl" />
                        <div
                          className="w-24 h-20 rounded-t-xl flex items-center justify-center text-3xl font-bold text-[var(--klein-on)]"
                          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
                        >1</div>
                        <p className="text-sm font-bold text-[var(--color-text-primary)] mt-2 truncate w-24 text-center">{leaderboard[0].name.split(' ')[0]}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">{leaderboard[0].xp} XP</p>
                      </div>
                    )}
                    {leaderboard[2] && (
                      <div className="flex flex-col items-center">
                        <SocialAvatar name={leaderboard[2].name} src={leaderboard[2].avatar_url} className="w-16 h-16 rounded-full border-4 border-orange-300 mb-2 text-xl" />
                        <div className="w-20 h-12 bg-orange-300 rounded-t-xl flex items-center justify-center text-xl font-bold text-white">3</div>
                        <p className="text-xs font-bold text-[var(--color-text-secondary)] mt-2 truncate w-20 text-center">{leaderboard[2].name.split(' ')[0]}</p>
                        <p className="text-xs text-[var(--color-text-tertiary)]">{leaderboard[2].xp} XP</p>
                      </div>
                    )}
                  </div>
                </Card>

                {leaderboard.length > 3 && (
                  <div className="ds-stack-tight flex flex-col">
                    {leaderboard.slice(3).map((u) => (
                      <div
                        key={u.user_id}
                        className={`ds-row p-5 flex items-center gap-4 ${u.is_current_user ? 'ring-2 ring-[var(--klein-ring)]' : ''}`}
                      >
                        <div
                          className={`w-8 h-8 flex items-center justify-center font-bold rounded-full ${
                            u.is_current_user
                              ? 'bg-[var(--klein-blue)] text-[var(--klein-on)]'
                              : 'bg-[var(--klein-blue-soft)] text-[var(--color-text-secondary)]'
                          }`}
                        >
                          {u.rank}
                        </div>
                        <SocialAvatar name={u.name} src={u.avatar_url} className="w-10 h-10 rounded-full border border-[var(--border-highlight)]" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-[var(--color-text-primary)] truncate">
                            {u.name}
                            {u.is_current_user && <span className="ml-2 text-xs font-normal text-[var(--klein-blue)]">{t('social.you') || '(You)'}</span>}
                          </h3>
                        </div>
                        <div className="text-[var(--klein-blue)] font-mono font-bold">{u.xp} XP</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Achievements — derived from the current user's real learning stats */}
        {activeTab === 'achievements' && (
          <>
            <div className="space-y-3">
              <SectionTitle title={`${t('social.achievementsTab') || 'Achievements'} (${unlockedAchievements}/${achievements.length})`} className="px-1" />
              {leaderboardLoading ? (
                <LoadingState label={t('common.loading') || 'Loading...'} />
              ) : leaderboardError ? (
                <EmptyState
                  icon={<Trophy className="w-10 h-10" />}
                  title={t('social.badgesLoadFailed') || 'Could not load achievements'}
                  description={t('social.tryAgainLater') || 'Please try again later'}
                />
              ) : (
                <>
                  <Card>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 bg-[var(--klein-blue)] rounded-2xl flex items-center justify-center text-[var(--klein-on)] flex-shrink-0">
                        <Trophy className="w-7 h-7" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-[var(--color-text-primary)] mb-1">
                          {t('social.achievementProgress') || 'Achievement Progress'}
                        </h3>
                        <ProgressBar value={unlockedAchievements} max={achievements.length} className="mb-2" />
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {unlockedAchievements} of {achievements.length} {t('social.unlockedLower') || 'unlocked'}
                        </p>
                      </div>
                    </div>
                  </Card>

                  <div className="ds-grid-breathing grid-cols-2">
                    {achievements.map((achievement) => {
                      const AchIcon = achievement.icon;
                      return (
                        <div key={achievement.id} className={`ds-card p-5 ${!achievement.unlocked ? 'opacity-60' : ''}`}>
                          <div className="flex flex-col items-center text-center">
                            <div className={`mb-3 ${!achievement.unlocked ? 'text-[var(--color-text-tertiary)] opacity-50' : 'text-[var(--klein-blue)]'}`}>
                              <AchIcon className="w-9 h-9" />
                            </div>
                            <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">{achievement.name}</h3>
                            <p className="text-xs text-[var(--color-text-tertiary)] mb-3 leading-tight">{achievement.description}</p>
                            {achievement.unlocked ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold rounded-full">
                                <Check className="w-3.5 h-3.5" /> {t('social.unlocked') || 'Unlocked'}
                              </span>
                            ) : (
                              <div className="w-full">
                                <ProgressBar value={achievement.progress} max={achievement.maxProgress} />
                                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                                  {achievement.progress}/{achievement.maxProgress}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Weekly challenge — progress = this week's real learned+mastered
                count (period=week leaderboard entry); target = the user's own
                daily goal × 7 (settings/preferences). Hidden when unavailable. */}
            {weeklyLearned !== null && (
              <Card>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Zap className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1 text-[var(--color-text-primary)]">{t('social.weeklyChallenge') || 'Weekly Challenge'}</h3>
                    <p className="text-[var(--color-text-secondary)] text-sm mb-3">
                      {t('social.weeklyChallengeDesc') || `Learn ${weeklyTarget} words this week`}
                    </p>
                    <ProgressBar value={Math.min(weeklyLearned, weeklyTarget)} max={weeklyTarget} className="mb-2" />
                    <p className="text-xs text-[var(--color-text-tertiary)]">
                      {Math.min(weeklyLearned, weeklyTarget)}/{weeklyTarget} {t('social.wordsCompleted') || 'words completed'}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WfMineSocialPage;
