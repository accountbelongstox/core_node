import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button } from '../../components/UI';
import BentoCard from '../../components/BentoCard';

/**
 * Profile Page - Bento Box Layout with i18n
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slide-up">
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

  // Helper to format gender
  const getGender = () => {
    if (user?.gender === 'male') return t('profile.male');
    if (user?.gender === 'female') return t('profile.female');
    if (user?.gender === 'other') return t('profile.other');
    return t('profile.notSet');
  };

  return (
    <div className="h-full flex flex-col pt-safe animate-slide-up-fade">
      {/* Floating Title */}
      <div className="px-6 pt-12 pb-6 flex items-center justify-between">
        <h1 className="text-4xl font-serif text-slate-800 dark:text-white tracking-tight">
          {t('profile.myProfile')}
        </h1>
        <button
          onClick={() => navigate('settings')}
          className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/5"
        >
          <Icons.Close />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-32 no-scrollbar max-w-4xl mx-auto w-full">
        {/* Bento Box Grid Layout */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          {/* Large Card: Profile Header - Spans 2 columns */}
          <BentoCard colSpan={2} glowing className="p-6 bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-900/20 dark:to-purple-900/20">
            <div className="relative flex items-center gap-4">
              <div className="relative p-1 rounded-full border-2 border-blue-500/30 dark:border-white/20">
                <img
                  src={user?.avatar_url || user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || 'User')}&background=3b82f6&color=fff`}
                  className="w-20 h-20 rounded-full object-cover"
                  alt="Avatar"
                />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {user?.name || user?.nickname || user?.username || 'User'}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm">@{user?.username}</p>
                {user?.isPro && (
                  <span className="inline-block mt-2 px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-md">
                    ⭐ {t('profile.proMember')}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('profile_edit')}
              className="mt-4 w-full bg-white/60 dark:bg-slate-800/60 hover:bg-white/80 dark:hover:bg-slate-800/80 backdrop-blur-xl text-slate-900 dark:text-white font-bold py-2.5 px-6 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 border border-white/40 dark:border-white/10"
            >
              <Icons.Edit className="w-4 h-4" />
              {t('profile.editProfile')}
            </button>
          </BentoCard>

          {/* Stats Cards */}
          <BentoCard className="p-5 text-center bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
              {user?.total_words || 0}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wide">
              {t('profile.totalWords')}
            </div>
          </BentoCard>

          <BentoCard className="p-5 text-center bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">
              {user?.learned_words || 0}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wide">
              {t('profile.learnedWords')}
            </div>
          </BentoCard>

          <BentoCard colSpan={2} className="p-5 text-center bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10">
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">
              {user?.mastered_words || 0}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400 font-medium uppercase tracking-wide">
              {t('profile.masteredWords')}
            </div>
          </BentoCard>

          {/* Email Card */}
          <BentoCard colSpan={2} className="p-4">
            <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
              {t('profile.email')}
            </div>
            <div className="text-slate-800 dark:text-white font-medium">
              {user?.email || t('profile.notSet')}
            </div>
          </BentoCard>

          {/* Bio Card - Large */}
          {user?.bio && (
            <BentoCard colSpan={2} className="p-4">
              <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                {t('profile.bio')}
              </div>
              <div className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                {user.bio}
              </div>
            </BentoCard>
          )}

          {/* Personal Info Grid */}
          {(user?.phone || user?.age || user?.gender || user?.birthday) && (
            <>
              {user?.phone && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.phone')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium truncate">
                    {user.phone}
                  </div>
                </BentoCard>
              )}

              {user?.age && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.age')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium">
                    {t('profile.yearsOld', { age: user.age })}
                  </div>
                </BentoCard>
              )}

              {user?.gender && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.gender')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium">
                    {getGender()}
                  </div>
                </BentoCard>
              )}

              {user?.birthday && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.birthday')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium">
                    {user.birthday}
                  </div>
                </BentoCard>
              )}
            </>
          )}

          {/* Location Cards */}
          {(user?.location || user?.city) && (
            <>
              {user?.location && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.location')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium">
                    {user.location}
                  </div>
                </BentoCard>
              )}

              {user?.city && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.city')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium">
                    {user.city}
                  </div>
                </BentoCard>
              )}
            </>
          )}

          {/* Work & Education */}
          {(user?.occupation || user?.education) && (
            <>
              {user?.occupation && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.occupation')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium">
                    {user.occupation}
                  </div>
                </BentoCard>
              )}

              {user?.education && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.education')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium">
                    {user.education}
                  </div>
                </BentoCard>
              )}
            </>
          )}

          {/* Language & Culture */}
          {(user?.native_language || user?.religion) && (
            <>
              {user?.native_language && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.nativeLanguage')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium">
                    {user.native_language}
                  </div>
                </BentoCard>
              )}

              {user?.religion && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.religion')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium">
                    {user.religion}
                  </div>
                </BentoCard>
              )}
            </>
          )}

          {/* Social Links */}
          {(user?.website || user?.github || user?.wechat || user?.weibo || user?.qq) && (
            <>
              {user?.website && (
                <BentoCard colSpan={2} className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.website')}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400 font-medium truncate">
                    {user.website}
                  </div>
                </BentoCard>
              )}

              {user?.github && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.github')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium truncate">
                    {user.github}
                  </div>
                </BentoCard>
              )}

              {user?.wechat && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.wechat')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium truncate">
                    {user.wechat}
                  </div>
                </BentoCard>
              )}

              {user?.weibo && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.weibo')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium truncate">
                    {user.weibo}
                  </div>
                </BentoCard>
              )}

              {user?.qq && (
                <BentoCard className="p-4">
                  <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2">
                    {t('profile.qq')}
                  </div>
                  <div className="text-sm text-slate-800 dark:text-white font-medium truncate">
                    {user.qq}
                  </div>
                </BentoCard>
              )}
            </>
          )}
        </div>

        {/* Logout Button */}
        <div className="mt-6">
          <Button
            variant="danger"
            className="opacity-80 hover:opacity-100"
            onClick={handleLogout}
          >
            {t('auth.logout')}
          </Button>
          <p className="text-center text-xs text-slate-400 mt-6 font-mono opacity-50">
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
