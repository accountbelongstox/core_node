/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button, Badge, Sheet, SectionTitle } from '../../components/UI';
import { Avatar } from '../../components/Avatar';
import { Target, Flame, BookOpen, Zap, Moon, Sparkles, Star } from 'lucide-react';

/**
 * Profile Page - v4.1 Iris layer
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
}) => (
  <Sheet open={isOpen} onClose={onCancel} position="center" panelClassName="animate-slide-up">
    <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">{title}</h3>
    <p className="text-[var(--color-text-secondary)] mb-6">{message}</p>
    <div className="flex gap-3">
      <Button variant="secondary" onClick={onCancel} className="flex-1">
        {cancelText}
      </Button>
      <Button
        variant={variant === 'danger' ? 'danger' : 'klein'}
        onClick={onConfirm}
        className="flex-1"
      >
        {confirmText}
      </Button>
    </div>
  </Sheet>
);

interface StatCardProps {
  value: number;
  label: string;
  icon: React.ReactNode;
}

const StatCard: React.FC<StatCardProps> = ({ value, label, icon }) => (
  <div className="ds-card p-5">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-2xl flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1">
        <div className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</div>
        <div className="text-sm text-[var(--color-text-secondary)]">{label}</div>
      </div>
    </div>
  </div>
);

interface InfoCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

const InfoCard: React.FC<InfoCardProps> = ({ label, value, icon }) => (
  <div className="ds-row p-5 flex items-center gap-3">
    {icon && <div className="text-[var(--klein-blue)]">{icon}</div>}
    <div className="flex-1">
      <p className="ds-section-label mb-1">{label}</p>
      <p className="text-sm text-[var(--color-text-primary)] font-medium">{value}</p>
    </div>
  </div>
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

  // Mock achievements data — icons from lucide-react (no emoji as UI icons)
  const achievements = [
    { id: 1, name: 'First Steps', Icon: Target, unlocked: true },
    { id: 2, name: '7-Day Streak', Icon: Flame, unlocked: true },
    { id: 3, name: '100 Words', Icon: BookOpen, unlocked: true },
    { id: 4, name: 'Speed Learner', Icon: Zap, unlocked: false },
    { id: 5, name: 'Night Owl', Icon: Moon, unlocked: false },
    { id: 6, name: 'Perfect Week', Icon: Sparkles, unlocked: false },
  ];

  if (!user) {
    return (
      <div className="ds-aura-bg min-h-screen pb-28 flex items-center justify-center p-[var(--page-padding-h)]">
        <div className="ds-aura-overlay" />
        <Card className="relative max-w-md w-full text-center">
          <div className="py-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)]">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-[var(--color-text-primary)]">{t('home.loginRequired')}</h2>
            <p className="text-[var(--color-text-secondary)] mb-6">{t('profile.loginToViewProfile')}</p>
            <Button variant="klein" onClick={() => navigate('login')}>
              {t('auth.login')}
            </Button>
            <Button variant="ghost" className="mt-3" onClick={() => navigate('home')}>
              {t('common.backHome')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />
      {/* Minimal asymmetric header: avatar-left, icon-only right */}
      <div className="relative pt-[var(--page-padding-v)] px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('profile_edit')}
            className="relative flex-shrink-0 ds-touch-target rounded-full"
            aria-label={t('profile.editProfile')}
          >
            <Avatar
              src={user?.avatar_url}
              fallbackSrc={user?.avatar}
              name={user?.name || user?.nickname || user?.username}
              alt="Avatar"
              className="w-16 h-16 rounded-full border border-[var(--border-highlight)] text-xl"
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[var(--klein-blue)] text-[var(--klein-on)] rounded-full flex items-center justify-center">
              <Icons.Edit className="w-3.5 h-3.5" />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] truncate">
              {user?.name || user?.nickname || user?.username || 'User'}
            </h1>
            <p className="text-[var(--color-text-secondary)] text-sm truncate">@{user?.username}</p>
            {user?.isPro && (
              <Badge tone="klein" className="mt-2 gap-1"><Star className="w-3 h-3" fill="currentColor" /> {t('profile.proMember')}</Badge>
            )}
          </div>
          <button
            onClick={() => navigate('settings')}
            className="ds-touch-target w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label={t('nav.settings')}
          >
            <Icons.Settings />
          </button>
        </div>

        {user?.bio && (
          <p className="mt-4 text-[var(--color-text-secondary)] text-sm leading-relaxed">{user.bio}</p>
        )}
      </div>

      <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Learning Stats Section */}
        <div className="space-y-3">
          <SectionTitle title="Learning Statistics" className="px-1" />

          <StatCard
            value={user?.total_words || 0}
            label={t('profile.totalWords')}
            icon={
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            }
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
            />

            <StatCard
              value={user?.mastered_words || 0}
              label={t('profile.masteredWords')}
              icon={
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              }
            />
          </div>
        </div>

        {/* Achievements Section */}
        <div className="space-y-3">
          <SectionTitle title="Achievements" className="px-1" />

          <Card>
            <div className="grid grid-cols-3 gap-3">
              {achievements.map((achievement) => (
                <button
                  key={achievement.id}
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-2 transition-all ds-touch-target ${
                    achievement.unlocked
                      ? 'bg-[var(--klein-blue)] text-[var(--klein-on)] shadow-[var(--klein-glow)]'
                      : 'bg-[var(--klein-blue-soft)] opacity-50'
                  }`}
                >
                  <achievement.Icon className="w-7 h-7" strokeWidth={2} />
                  <span className={`text-xs font-bold ${achievement.unlocked ? 'text-[var(--klein-on)]' : 'text-[var(--color-text-tertiary)]'}`}>
                    {achievement.name}
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <div className="ds-row p-5 flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-1">
                {achievements.filter(a => a.unlocked).length} / {achievements.length} Unlocked
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Keep learning to unlock more achievements!
              </p>
            </div>
          </div>
        </div>

        {/* Personal Information Section */}
        {(user?.email || user?.phone || user?.age || user?.gender || user?.birthday) && (
          <div className="space-y-3">
            <SectionTitle title="Personal Information" className="px-1" />

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
            <SectionTitle title="Background" className="px-1" />

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
            <SectionTitle title="Social Links" className="px-1" />

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
          <p className="text-center text-xs text-[var(--color-text-tertiary)] font-mono opacity-50">
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
