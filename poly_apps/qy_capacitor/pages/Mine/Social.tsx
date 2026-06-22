/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState } from 'react';
import { Card, Icons, Button, ProgressBar, SectionTitle } from '../../components/UI';
import { Avatar } from '../../components/Avatar';
import { AppContext } from '../../contexts/AppContext';
import { PillNav } from '../../components/PillNav';
import { MOCK_FRIENDS as MOCK_FRIENDS_RAW, MOCK_ACTIVITIES, MOCK_LEADERBOARD as MOCK_LEADERBOARD_RAW, MOCK_ACHIEVEMENTS } from '../../services/mockData';
import type { Friend, LeaderboardUser } from '../../types';
import { Users, Gift, Heart, Crown, Trophy, Zap, Check, Sunrise, Bug, Flame, Globe2, type LucideIcon } from 'lucide-react';

// Backend friend/leaderboard objects can carry a full `avatar_url`; the shared
// types only declare the relative `avatar`. These page-local views widen with
// the optional field the rendering already reads defensively (`avatar_url ||
// avatar`). Runtime is unchanged — the mock objects simply lack `avatar_url`.
type FriendWithAvatarUrl = Friend & { avatar_url?: string };
type LeaderboardUserWithAvatarUrl = LeaderboardUser & { avatar_url?: string };
const MOCK_FRIENDS = MOCK_FRIENDS_RAW as FriendWithAvatarUrl[];
const MOCK_LEADERBOARD = MOCK_LEADERBOARD_RAW as LeaderboardUserWithAvatarUrl[];

type TabType = 'friends' | 'leaderboard' | 'achievements';

// Map achievement ids to lucide icons (no emoji as UI affordance)
const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  a1: Sunrise,
  a2: Bug,
  a3: Flame,
  a4: Globe2,
};

export default function MineSocial() {
  const { user, navigate, t } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<TabType>('friends');

  if (!user) {
    return (
      <div className="ds-aura-bg min-h-screen pb-28 flex items-center justify-center px-[var(--page-padding-h)]">
        <div className="ds-aura-overlay" />
        <Card className="relative max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)]">
            <Icons.Lock />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            Login Required
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            Please login to view your social network
          </p>
          <Button variant="klein" onClick={() => navigate('login')}>
            {t('auth.login')}
          </Button>
        </Card>
      </div>
    );
  }

  const currentUser = MOCK_LEADERBOARD.find(u => u.isCurrentUser);
  const activeFriends = MOCK_FRIENDS.filter(f => f.status === 'online' || f.status === 'studying');
  const unlockedAchievements = MOCK_ACHIEVEMENTS.filter(a => a.unlocked).length;

  const statusDot = (status: string) =>
    status === 'online' ? 'bg-green-500' : status === 'studying' ? 'bg-[var(--klein-blue)]' : 'bg-slate-400';

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />
      {/* Minimal asymmetric header */}
      <div className="relative pt-[var(--page-padding-v)] px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
            Social Center
          </h1>
          <p className="text-[var(--color-text-secondary)]">
            Connect with friends and compete globally
          </p>
        </div>

        {/* Quick Stats */}
        <div className="ds-grid-breathing grid-cols-3">
          {[
            { v: MOCK_FRIENDS.length, l: t('social.friendsShort') },
            { v: `#${currentUser?.rank || '-'}`, l: 'Global Rank' },
            { v: unlockedAchievements, l: t('social.badgesShort') },
          ].map((s, i) => (
            <div key={i} className="ds-card text-center p-5">
              <p className="text-3xl font-bold text-[var(--klein-blue)]">{s.v}</p>
              <p className="text-[var(--color-text-secondary)] text-xs mt-1">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Tabs — Pill nav */}
        <PillNav
          aria-label="Social tabs"
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as TabType)}
          items={[
            { id: 'friends', label: 'Friends' },
            { id: 'leaderboard', label: 'Leaderboard' },
            { id: 'achievements', label: 'Achievements' },
          ]}
        />
      </div>

      <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Friends Tab */}
        {activeTab === 'friends' && (
          <>
            {/* Active Friends */}
            <div className="space-y-3">
              <SectionTitle
                title={`Active Now (${activeFriends.length})`}
                className="px-1"
                action={
                  <button
                    onClick={() => navigate('social/add-friends')}
                    className="text-sm text-[var(--klein-blue)] hover:underline font-semibold ds-touch-target"
                  >
                    + Add Friends
                  </button>
                }
              />

              {activeFriends.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {activeFriends.map((friend) => (
                    <div key={friend.id} className="flex flex-col items-center gap-2 min-w-[70px]">
                      <div className="relative">
                        <Avatar
                          src={friend.avatar_url}
                          fallbackSrc={friend.avatar}
                          name={friend.name}
                          alt={friend.name}
                          className="w-16 h-16 rounded-2xl border border-[var(--border-highlight)] shadow-sm text-xl"
                        />
                        <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[var(--color-surface)] ${statusDot(friend.status)}`}></div>
                      </div>
                      <span className="text-xs font-bold text-[var(--color-text-secondary)] truncate w-full text-center">
                        {friend.name.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="ds-empty text-center py-8">
                  <Users className="w-10 h-10 mx-auto mb-3 text-[var(--klein-blue)]" />
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    No friends online right now
                  </p>
                </div>
              )}
            </div>

            {/* All Friends List */}
            <div className="space-y-3">
              <SectionTitle title={`All Friends (${MOCK_FRIENDS.length})`} className="px-1" />
              <div className="ds-stack-tight flex flex-col">
                {MOCK_FRIENDS.map((friend) => (
                  <div key={friend.id} className="ds-row p-5 cursor-pointer ds-touch-target flex items-center gap-4">
                    <div className="relative">
                      <Avatar
                        src={friend.avatar_url}
                        fallbackSrc={friend.avatar}
                        name={friend.name}
                        alt={friend.name}
                        className="w-12 h-12 rounded-full border border-[var(--border-highlight)]"
                      />
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[var(--color-surface)] ${statusDot(friend.status)}`}></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[var(--color-text-primary)] truncate">
                        {friend.name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-tertiary)] capitalize">
                        {friend.status}
                      </p>
                    </div>
                    <span className="text-[var(--color-text-tertiary)]"><Icons.ChevronRight /></span>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Feed */}
            <div className="space-y-3">
              <SectionTitle title="Recent Activity" className="px-1" />
              <div className="ds-stack-tight flex flex-col">
                {MOCK_ACTIVITIES.map((activity) => (
                  <div key={activity.id} className="ds-row p-5 flex gap-4">
                    <Avatar
                      src={activity.userAvatar}
                      name={activity.userName}
                      alt={activity.userName}
                      className="w-12 h-12 rounded-full border border-[var(--border-highlight)] text-base flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-text-primary)]">
                        <span className="font-bold">{activity.userName}</span> {activity.action}
                      </p>
                      <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{activity.time}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1">
                      <button aria-label="Like" className="text-slate-300 hover:text-red-500 transition-colors">
                        <Heart className="w-5 h-5" />
                      </button>
                      <span className="text-xs text-[var(--color-text-tertiary)]">{activity.likes}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Invite Card */}
            <Card>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1 text-[var(--color-text-primary)]">Invite Friends</h3>
                  <p className="text-[var(--color-text-secondary)] text-sm">Get Pro features free for each friend</p>
                </div>
                <Gift className="w-9 h-9 text-[var(--klein-blue)]" />
              </div>
              <Button variant="klein" className="mt-4">
                Share Invite Link
              </Button>
            </Card>
          </>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-3">
            <SectionTitle title="Global Rankings" className="px-1" />

            {/* Top 3 Podium */}
            <Card>
              <div className="flex items-end justify-center gap-4 py-4">
                {MOCK_LEADERBOARD[1] && (
                  <div className="flex flex-col items-center">
                    <Avatar
                      src={MOCK_LEADERBOARD[1].avatar_url}
                      fallbackSrc={MOCK_LEADERBOARD[1].avatar}
                      name={MOCK_LEADERBOARD[1].name}
                      alt={MOCK_LEADERBOARD[1].name}
                      className="w-16 h-16 rounded-full border-4 border-slate-300 mb-2 text-xl"
                    />
                    <div className="w-20 h-16 bg-slate-300 rounded-t-xl flex items-center justify-center text-2xl font-bold text-white">2</div>
                    <p className="text-xs font-bold text-[var(--color-text-secondary)] mt-2 truncate w-20 text-center">{MOCK_LEADERBOARD[1].name.split(' ')[0]}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{MOCK_LEADERBOARD[1].xp} XP</p>
                  </div>
                )}

                {MOCK_LEADERBOARD[0] && (
                  <div className="flex flex-col items-center -mt-4">
                    <Crown className="w-6 h-6 mb-1 text-[var(--klein-blue)]" fill="currentColor" />
                    <Avatar
                      src={MOCK_LEADERBOARD[0].avatar_url}
                      fallbackSrc={MOCK_LEADERBOARD[0].avatar}
                      name={MOCK_LEADERBOARD[0].name}
                      alt={MOCK_LEADERBOARD[0].name}
                      className="w-20 h-20 rounded-full border-4 border-[var(--klein-blue)] mb-2 text-2xl"
                    />
                    <div
                      className="w-24 h-20 rounded-t-xl flex items-center justify-center text-3xl font-bold text-[var(--klein-on)]"
                      style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
                    >1</div>
                    <p className="text-sm font-bold text-[var(--color-text-primary)] mt-2 truncate w-24 text-center">{MOCK_LEADERBOARD[0].name.split(' ')[0]}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{MOCK_LEADERBOARD[0].xp} XP</p>
                  </div>
                )}

                {MOCK_LEADERBOARD[2] && (
                  <div className="flex flex-col items-center">
                    <Avatar
                      src={MOCK_LEADERBOARD[2].avatar_url}
                      fallbackSrc={MOCK_LEADERBOARD[2].avatar}
                      name={MOCK_LEADERBOARD[2].name}
                      alt={MOCK_LEADERBOARD[2].name}
                      className="w-16 h-16 rounded-full border-4 border-orange-300 mb-2 text-xl"
                    />
                    <div className="w-20 h-12 bg-orange-300 rounded-t-xl flex items-center justify-center text-xl font-bold text-white">3</div>
                    <p className="text-xs font-bold text-[var(--color-text-secondary)] mt-2 truncate w-20 text-center">{MOCK_LEADERBOARD[2].name.split(' ')[0]}</p>
                    <p className="text-xs text-[var(--color-text-tertiary)]">{MOCK_LEADERBOARD[2].xp} XP</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Rest of Rankings as ds-row group */}
            <div className="ds-stack-tight flex flex-col">
              {MOCK_LEADERBOARD.slice(3).map((u) => (
                <div
                  key={u.rank}
                  className={`ds-row p-5 flex items-center gap-4 ${u.isCurrentUser ? 'ring-2 ring-[var(--klein-ring)]' : ''}`}
                >
                  <div
                    className={`w-8 h-8 flex items-center justify-center font-bold rounded-full ${
                      u.isCurrentUser
                        ? 'bg-[var(--klein-blue)] text-[var(--klein-on)]'
                        : 'bg-[var(--klein-blue-soft)] text-[var(--color-text-secondary)]'
                    }`}
                  >
                    {u.rank}
                  </div>
                  <Avatar
                    src={u.avatar_url}
                    fallbackSrc={u.avatar}
                    name={u.name}
                    alt={u.name}
                    className="w-10 h-10 rounded-full border border-[var(--border-highlight)]"
                  />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[var(--color-text-primary)] truncate">
                      {u.name}
                      {u.isCurrentUser && (
                        <span className="ml-2 text-xs font-normal text-[var(--klein-blue)]">(You)</span>
                      )}
                    </h3>
                  </div>
                  <div className="text-[var(--klein-blue)] font-mono font-bold">{u.xp} XP</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <>
            <div className="space-y-3">
              <SectionTitle
                title={`Achievements (${unlockedAchievements}/${MOCK_ACHIEVEMENTS.length})`}
                className="px-1"
              />

              {/* Progress Overview */}
              <Card>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[var(--klein-blue)] rounded-2xl flex items-center justify-center text-[var(--klein-on)] flex-shrink-0">
                    <Trophy className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-[var(--color-text-primary)] mb-1">
                      Achievement Progress
                    </h3>
                    <ProgressBar value={unlockedAchievements} max={MOCK_ACHIEVEMENTS.length} className="mb-2" />
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {unlockedAchievements} of {MOCK_ACHIEVEMENTS.length} unlocked
                    </p>
                  </div>
                </div>
              </Card>

              {/* Achievements Grid */}
              <div className="ds-grid-breathing grid-cols-2">
                {MOCK_ACHIEVEMENTS.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`ds-card p-5 ${!achievement.unlocked ? 'opacity-60' : ''}`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className={`mb-3 ${!achievement.unlocked ? 'text-[var(--color-text-tertiary)] opacity-50' : 'text-[var(--klein-blue)]'}`}>
                        {(() => {
                          const AchIcon = ACHIEVEMENT_ICONS[achievement.id] ?? Trophy;
                          return <AchIcon className="w-9 h-9" />;
                        })()}
                      </div>
                      <h3 className="font-bold text-sm text-[var(--color-text-primary)] mb-1">
                        {achievement.name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-tertiary)] mb-3 leading-tight">
                        {achievement.description}
                      </p>

                      {achievement.unlocked ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold rounded-full">
                          <Check className="w-3.5 h-3.5" /> Unlocked
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
                ))}
              </div>
            </div>

            {/* Challenge Card */}
            <Card>
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1 text-[var(--color-text-primary)]">Weekly Challenge</h3>
                  <p className="text-[var(--color-text-secondary)] text-sm mb-3">
                    Complete 50 words this week to unlock the "Speed Learner" badge
                  </p>
                  <ProgressBar value={75} className="mb-2" />
                  <p className="text-xs text-[var(--color-text-tertiary)]">37/50 words completed</p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
