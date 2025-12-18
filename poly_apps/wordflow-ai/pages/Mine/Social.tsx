import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { MOCK_FRIENDS, MOCK_ACTIVITIES, MOCK_LEADERBOARD, MOCK_ACHIEVEMENTS } from '../../services/mockData';

type TabType = 'friends' | 'leaderboard' | 'achievements';

export default function MineSocial() {
  const { user, navigate, t } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<TabType>('friends');

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24 flex items-center justify-center">
        <Card className="mx-6 max-w-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center p-8">
          <Icons.Lock />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-4 mb-2">
            Login Required
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">
            Please login to view your social network
          </p>
          <button
            onClick={() => navigate('login')}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
          >
            {t('auth.login')}
          </button>
        </Card>
      </div>
    );
  }

  const currentUser = MOCK_LEADERBOARD.find(u => u.isCurrentUser);
  const activeFriends = MOCK_FRIENDS.filter(f => f.status === 'online' || f.status === 'studying');
  const unlockedAchievements = MOCK_ACHIEVEMENTS.filter(a => a.unlocked).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 max-w-md mx-auto">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Social Center
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Connect with friends and compete globally
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg text-center p-4">
              <p className="text-3xl font-bold">{MOCK_FRIENDS.length}</p>
              <p className="text-blue-100 text-xs mt-1">Friends</p>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg text-center p-4">
              <p className="text-3xl font-bold">#{currentUser?.rank || '-'}</p>
              <p className="text-purple-100 text-xs mt-1">Global Rank</p>
            </Card>
            <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white border-none shadow-lg text-center p-4">
              <p className="text-3xl font-bold">{unlockedAchievements}</p>
              <p className="text-pink-100 text-xs mt-1">Badges</p>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
            {(['friends', 'leaderboard', 'achievements'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Friends Tab */}
        {activeTab === 'friends' && (
          <>
            {/* Active Friends */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Active Now ({activeFriends.length})
                </h2>
                <button
                  onClick={() => navigate('social/add-friends')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  + Add Friends
                </button>
              </div>

              {activeFriends.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                  {activeFriends.map((friend) => (
                    <div key={friend.id} className="flex flex-col items-center gap-2 min-w-[70px]">
                      <div className="relative">
                        <img
                          src={friend.avatar_url || friend.avatar}
                          alt={friend.name}
                          className="w-16 h-16 rounded-2xl border-2 border-white dark:border-slate-700 shadow-sm"
                        />
                        <div
                          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${
                            friend.status === 'online'
                              ? 'bg-green-500'
                              : friend.status === 'studying'
                              ? 'bg-blue-500'
                              : 'bg-slate-400'
                          }`}
                        ></div>
                      </div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate w-full text-center">
                        {friend.name.split(' ')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-center py-8">
                  <div className="text-4xl mb-3">👥</div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No friends online right now
                  </p>
                </Card>
              )}
            </div>

            {/* All Friends List */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                All Friends ({MOCK_FRIENDS.length})
              </h2>
              {MOCK_FRIENDS.map((friend) => (
                <Card
                  key={friend.id}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-500 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <img
                        src={friend.avatar_url || friend.avatar}
                        alt={friend.name}
                        className="w-12 h-12 rounded-full border border-slate-100 dark:border-slate-700"
                      />
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-800 ${
                          friend.status === 'online'
                            ? 'bg-green-500'
                            : friend.status === 'studying'
                            ? 'bg-blue-500'
                            : 'bg-slate-400'
                        }`}
                      ></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate">
                        {friend.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                        {friend.status}
                      </p>
                    </div>
                    <Icons.ChevronRight />
                  </div>
                </Card>
              ))}
            </div>

            {/* Activity Feed */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Recent Activity
              </h2>
              {MOCK_ACTIVITIES.map((activity) => (
                <Card
                  key={activity.id}
                  className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex gap-4">
                    <img
                      src={activity.userAvatar}
                      alt={activity.userName}
                      className="w-12 h-12 rounded-full border border-slate-100 dark:border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-900 dark:text-white">
                        <span className="font-bold">{activity.userName}</span> {activity.action}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{activity.time}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-1">
                      <button className="text-slate-300 hover:text-red-500 transition-colors text-xl">
                        ♥
                      </button>
                      <span className="text-xs text-slate-400">{activity.likes}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Invite Card */}
            <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white border-none shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">Invite Friends</h3>
                  <p className="text-white/80 text-sm">Get Pro features free for each friend</p>
                </div>
                <div className="text-4xl">🎁</div>
              </div>
              <button className="w-full mt-4 px-4 py-3 bg-white/20 hover:bg-white/30 rounded-xl font-semibold transition-colors">
                Share Invite Link
              </button>
            </Card>
          </>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <>
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Global Rankings
              </h2>

              {/* Top 3 Podium */}
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 border border-amber-200 dark:border-slate-700">
                <div className="flex items-end justify-center gap-4 py-4">
                  {/* 2nd Place */}
                  {MOCK_LEADERBOARD[1] && (
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full border-4 border-slate-300 overflow-hidden mb-2">
                        <img
                          src={MOCK_LEADERBOARD[1].avatar_url || MOCK_LEADERBOARD[1].avatar}
                          alt={MOCK_LEADERBOARD[1].name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="w-20 h-16 bg-slate-300 rounded-t-xl flex items-center justify-center text-2xl font-bold text-white">
                        2
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-2 truncate w-20 text-center">
                        {MOCK_LEADERBOARD[1].name.split(' ')[0]}
                      </p>
                      <p className="text-xs text-slate-500">{MOCK_LEADERBOARD[1].xp} XP</p>
                    </div>
                  )}

                  {/* 1st Place */}
                  {MOCK_LEADERBOARD[0] && (
                    <div className="flex flex-col items-center -mt-4">
                      <div className="text-2xl mb-1">👑</div>
                      <div className="w-20 h-20 rounded-full border-4 border-yellow-400 overflow-hidden mb-2">
                        <img
                          src={MOCK_LEADERBOARD[0].avatar_url || MOCK_LEADERBOARD[0].avatar}
                          alt={MOCK_LEADERBOARD[0].name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="w-24 h-20 bg-yellow-400 rounded-t-xl flex items-center justify-center text-3xl font-bold text-white">
                        1
                      </div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white mt-2 truncate w-24 text-center">
                        {MOCK_LEADERBOARD[0].name.split(' ')[0]}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">{MOCK_LEADERBOARD[0].xp} XP</p>
                    </div>
                  )}

                  {/* 3rd Place */}
                  {MOCK_LEADERBOARD[2] && (
                    <div className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full border-4 border-orange-300 overflow-hidden mb-2">
                        <img
                          src={MOCK_LEADERBOARD[2].avatar_url || MOCK_LEADERBOARD[2].avatar}
                          alt={MOCK_LEADERBOARD[2].name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="w-20 h-12 bg-orange-300 rounded-t-xl flex items-center justify-center text-xl font-bold text-white">
                        3
                      </div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-2 truncate w-20 text-center">
                        {MOCK_LEADERBOARD[2].name.split(' ')[0]}
                      </p>
                      <p className="text-xs text-slate-500">{MOCK_LEADERBOARD[2].xp} XP</p>
                    </div>
                  )}
                </div>
              </Card>

              {/* Rest of Rankings */}
              {MOCK_LEADERBOARD.slice(3).map((user) => (
                <Card
                  key={user.rank}
                  className={`bg-white dark:bg-slate-800 border transition-all ${
                    user.isCurrentUser
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-lg'
                      : 'border-slate-200 dark:border-slate-700 hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-8 h-8 flex items-center justify-center font-bold rounded-full ${
                        user.isCurrentUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {user.rank}
                    </div>
                    <img
                      src={user.avatar_url || user.avatar}
                      alt={user.name}
                      className="w-10 h-10 rounded-full border border-slate-100 dark:border-slate-700"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate">
                        {user.name}
                        {user.isCurrentUser && (
                          <span className="ml-2 text-xs font-normal text-blue-600 dark:text-blue-400">
                            (You)
                          </span>
                        )}
                      </h3>
                    </div>
                    <div className="text-blue-600 dark:text-blue-400 font-mono font-bold">
                      {user.xp} XP
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Achievements ({unlockedAchievements}/{MOCK_ACHIEVEMENTS.length})
                </h2>
              </div>

              {/* Progress Overview */}
              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 border border-purple-200 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center text-white text-2xl flex-shrink-0">
                    🏆
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                      Achievement Progress
                    </h3>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-2">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${(unlockedAchievements / MOCK_ACHIEVEMENTS.length) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {unlockedAchievements} of {MOCK_ACHIEVEMENTS.length} unlocked
                    </p>
                  </div>
                </div>
              </Card>

              {/* Achievements Grid */}
              <div className="grid grid-cols-2 gap-3">
                {MOCK_ACHIEVEMENTS.map((achievement) => (
                  <Card
                    key={achievement.id}
                    className={`bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all ${
                      !achievement.unlocked ? 'opacity-60' : 'hover:shadow-lg'
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div
                        className={`text-4xl mb-3 ${
                          !achievement.unlocked ? 'grayscale opacity-50' : ''
                        }`}
                      >
                        {achievement.icon}
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
                        {achievement.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-tight">
                        {achievement.description}
                      </p>

                      {achievement.unlocked ? (
                        <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-xs font-bold rounded-full">
                          ✓ Unlocked
                        </span>
                      ) : (
                        <div className="w-full">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{
                                width: `${(achievement.progress / achievement.maxProgress) * 100}%`,
                              }}
                            />
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {achievement.progress}/{achievement.maxProgress}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Challenge Card */}
            <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white border-none shadow-xl">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                  ⚡
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1">Weekly Challenge</h3>
                  <p className="text-white/90 text-sm mb-3">
                    Complete 50 words this week to unlock the "Speed Learner" badge
                  </p>
                  <div className="w-full bg-white/20 rounded-full h-2 mb-2">
                    <div className="w-3/4 bg-white h-2 rounded-full"></div>
                  </div>
                  <p className="text-xs text-white/80">37/50 words completed</p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
