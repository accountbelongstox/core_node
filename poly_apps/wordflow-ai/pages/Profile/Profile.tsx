import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';

/**
 * Profile Page - Unified Design System
 */

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText: string;
  cancelText: string;
  variant?: 'danger' | 'warning';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  variant = 'warning',
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl sm:max-w-2xl md:max-w-4xl lg:max-w-5xl w-full p-6 animate-slide-up">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{title}</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            {cancelText}
          </Button>
          <Button
            onClick={onConfirm}
            className={`flex-1 ${
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  value: number;
  label: string;
  icon: React.ReactNode;
  gradient: string;
}

const StatCard: React.FC<StatCardProps> = ({ value, label, icon, gradient }) => (
  <Card className={`bg-gradient-to-br ${gradient} border-none shadow-lg`}>
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-white flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-2xl font-bold text-white">{value}</div>
        <div className="text-sm text-white/90">{label}</div>
      </div>
    </div>
  </Card>
);

interface InfoCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

const InfoCard: React.FC<InfoCardProps> = ({ label, value, icon }) => (
  <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center gap-3">
      {icon && <div className="text-slate-600 dark:text-slate-400">{icon}</div>}
      <div className="flex-1">
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
          {label}
        </p>
        <p className="text-sm text-slate-900 dark:text-white font-medium">{value}</p>
      </div>
    </div>
  </Card>
);

const ProfilePage = () => {
  const { user, navigate, logout, t } = useContext(AppContext);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    navigate('home');
  };

  const getGender = () => {
    if (user?.gender === 'male') return t('profile.male');
    if (user?.gender === 'female') return t('profile.female');
    if (user?.gender === 'other') return t('profile.other');
    return t('profile.notSet');
  };

  // Mock achievements data
  const achievements = [
    { id: 1, name: 'First Steps', icon: '🎯', unlocked: true },
    { id: 2, name: '7-Day Streak', icon: '🔥', unlocked: true },
    { id: 3, name: '100 Words', icon: '📚', unlocked: true },
    { id: 4, name: 'Speed Learner', icon: '⚡', unlocked: false },
    { id: 5, name: 'Night Owl', icon: '🦉', unlocked: false },
    { id: 6, name: 'Perfect Week', icon: '✨', unlocked: false },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24 flex items-center justify-center p-6">
        <Card className="sm:max-w-2xl md:max-w-4xl lg:max-w-5xl w-full bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-xl">
          <div className="text-center py-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('home.loginRequired')}</h2>
            <p className="text-blue-100 mb-6">{t('profile.loginToViewProfile')}</p>
            <Button
              onClick={() => navigate('login')}
              className="w-full bg-white text-blue-600 hover:bg-blue-50"
            >
              {t('auth.login')}
            </Button>
            <button
              onClick={() => navigate('home')}
              className="mt-3 w-full px-4 py-2 text-white/80 hover:text-white transition-colors"
            >
              {t('common.backHome')}
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('profile.myProfile')}
          </h1>
          <button
            onClick={() => navigate('settings')}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.Close />
          </button>
        </div>
      </div>

      <div className="sm:max-w-2xl md:max-w-4xl lg:max-w-5xl mx-auto px-6 space-y-6">
        {/* Profile Header Card */}
        <Card
          onClick={() => navigate('profile_edit')}
          className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none shadow-xl cursor-pointer hover:scale-[1.02] transition-transform"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full border-4 border-white/30 overflow-hidden">
                <img
                  src={user?.avatar_url || user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'User')}&background=3b82f6&color=fff`}
                  className="w-full h-full object-cover"
                  alt="Avatar"
                />
              </div>
              <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center">
                <Icons.Edit className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-1">
                {user?.name || user?.nickname || user?.username || 'User'}
              </h2>
              <p className="text-blue-100 text-sm mb-2">@{user?.username}</p>
              {user?.isPro && (
                <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-bold rounded-full">
                  ⭐ {t('profile.proMember')}
                </span>
              )}
            </div>
          </div>

          {user?.bio && (
            <div className="mt-4 pt-4 border-t border-white/20">
              <p className="text-blue-100 text-sm leading-relaxed">{user.bio}</p>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-blue-100">
            <Icons.Edit className="w-4 h-4" />
            <span>{t('profile.editProfile')}</span>
          </div>
        </Card>

        {/* Learning Stats Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Learning Statistics
          </h2>

          <StatCard
            value={user?.total_words || 0}
            label={t('profile.totalWords')}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
            gradient="from-blue-500 to-blue-600"
          />

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={user?.learned_words || 0}
              label={t('profile.learnedWords')}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              gradient="from-green-500 to-emerald-600"
            />

            <StatCard
              value={user?.mastered_words || 0}
              label={t('profile.masteredWords')}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              }
              gradient="from-purple-500 to-pink-600"
            />
          </div>
        </div>

        {/* Achievements Section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Achievements
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-3 gap-3">
              {achievements.map((achievement) => (
                <button
                  key={achievement.id}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${
                    achievement.unlocked
                      ? 'bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg'
                      : 'bg-slate-100 dark:bg-slate-900 opacity-50'
                  }`}
                >
                  <span className="text-2xl">{achievement.icon}</span>
                  <span className={`text-xs font-bold ${achievement.unlocked ? 'text-white' : 'text-slate-400'}`}>
                    {achievement.name}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-slate-800 dark:to-slate-800 border border-orange-200 dark:border-slate-700">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900 dark:text-white mb-1">
                  {achievements.filter(a => a.unlocked).length} / {achievements.length} Unlocked
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Keep learning to unlock more achievements!
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Personal Information Section */}
        {(user?.email || user?.phone || user?.age || user?.gender || user?.birthday) && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Personal Information
            </h2>

            {user?.email && (
              <InfoCard
                label={t('profile.email')}
                value={user.email}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                }
              />
            )}

            {user?.phone && (
              <InfoCard
                label={t('profile.phone')}
                value={user.phone}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                }
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              {user?.age && (
                <InfoCard
                  label={t('profile.age')}
                  value={t('profile.yearsOld', { age: user.age })}
                />
              )}

              {user?.gender && (
                <InfoCard
                  label={t('profile.gender')}
                  value={getGender()}
                />
              )}
            </div>

            {user?.birthday && (
              <InfoCard
                label={t('profile.birthday')}
                value={user.birthday}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                }
              />
            )}
          </div>
        )}

        {/* Location & Background Section */}
        {(user?.location || user?.city || user?.occupation || user?.education || user?.native_language) && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Background
            </h2>

            {(user?.location || user?.city) && (
              <div className="grid grid-cols-2 gap-3">
                {user?.location && (
                  <InfoCard
                    label={t('profile.location')}
                    value={user.location}
                  />
                )}

                {user?.city && (
                  <InfoCard
                    label={t('profile.city')}
                    value={user.city}
                  />
                )}
              </div>
            )}

            {(user?.occupation || user?.education) && (
              <div className="grid grid-cols-2 gap-3">
                {user?.occupation && (
                  <InfoCard
                    label={t('profile.occupation')}
                    value={user.occupation}
                  />
                )}

                {user?.education && (
                  <InfoCard
                    label={t('profile.education')}
                    value={user.education}
                  />
                )}
              </div>
            )}

            {user?.native_language && (
              <InfoCard
                label={t('profile.nativeLanguage')}
                value={user.native_language}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                }
              />
            )}
          </div>
        )}

        {/* Social Links Section */}
        {(user?.website || user?.github || user?.wechat || user?.weibo || user?.qq) && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
              Social Links
            </h2>

            {user?.website && (
              <InfoCard
                label={t('profile.website')}
                value={user.website}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                }
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              {user?.github && (
                <InfoCard
                  label={t('profile.github')}
                  value={user.github}
                />
              )}

              {user?.wechat && (
                <InfoCard
                  label={t('profile.wechat')}
                  value={user.wechat}
                />
              )}

              {user?.weibo && (
                <InfoCard
                  label={t('profile.weibo')}
                  value={user.weibo}
                />
              )}

              {user?.qq && (
                <InfoCard
                  label={t('profile.qq')}
                  value={user.qq}
                />
              )}
            </div>
          </div>
        )}

        {/* Logout Button */}
        <div className="space-y-3 pt-3">
          <Button
            variant="danger"
            className="opacity-80 hover:opacity-100"
            onClick={handleLogout}
          >
            {t('auth.logout')}
          </Button>
          <p className="text-center text-xs text-slate-400 font-mono opacity-50">
            WORDFLOW AI • {user?.username}
          </p>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title={t('profile.logoutConfirmTitle')}
        message={t('profile.logoutConfirmMessage')}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        confirmText={t('auth.logout')}
        cancelText={t('common.cancel')}
        variant="danger"
      />
    </div>
  );
};

export default ProfilePage;
