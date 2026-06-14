/* [v4.1-Iris] Profile — ported from poly_apps/qy_capacitor/pages/Profile/Profile.tsx.
 * Self-contained: useWfApp() for user/logout/t, react-router useNavigate + wfPath()
 * for all nav. User-data normalization (display name, avatar URL, extended-field
 * cleanup) is owned by wfUserCenter (qy's UserDataCenter port) — no per-page
 * defensive reads. Stats / achievements / personal-info sections + a logout
 * confirm Sheet, built from the shared Iris primitives. The original <Avatar> is
 * inlined (img-or-initials). Reference-faithful Iris look
 * (design-reference-{light,dark}.webp). */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Card, Icons, Button, Badge, Sheet, SectionTitle } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wfUserCenter } from '../services/WfUserCenter';
import { deriveAchievements, statsToAchievementInput } from '../services/WfAchievementCenter';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { notify } from '../../../core/notify/notify';

/** Inline avatar (img when available, else gradient initials chip). */
const ProfileAvatar: React.FC<{ src?: string; name?: string; className?: string }> = ({ src, name, className = '' }) => {
  const letter = (name || '?').charAt(0).toUpperCase();
  if (src) {
    return <img src={src} alt="Avatar" className={`object-cover ${className}`} />;
  }
  return (
    <div className={`flex items-center justify-center font-bold bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] ${className}`}>
      {letter}
    </div>
  );
};

interface StatCardProps { value: number; label: string; icon: React.ReactNode; }
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

interface InfoCardProps { label: string; value: string; icon?: React.ReactNode; }
const InfoCard: React.FC<InfoCardProps> = ({ label, value, icon }) => (
  <div className="ds-row p-5 flex items-center gap-3">
    {icon && <div className="text-[var(--klein-blue)]">{icon}</div>}
    <div className="flex-1 min-w-0">
      <p className="ds-section-label mb-1">{label}</p>
      <p className="text-sm text-[var(--color-text-primary)] font-medium truncate">{value}</p>
    </div>
  </div>
);

const WfProfileProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, t } = useWfApp();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const confirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    notify.success(t('auth.logoutSuccess') || 'Logged out');
    navigate(wfPath('auth/login'));
  };

  // Real learning counters → shared achievement derivation (WfAchievementCenter;
  // previously a hardcoded always-unlocked list). /user/statistics is the rich
  // source (streak + study days); the profile's own counters are the fallback.
  const [statsInput, setStatsInput] = useState<any>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await wordflowApi.request<any>('/user/statistics');
        if (!cancelled && result && typeof result === 'object') {
          setStatsInput(statsToAchievementInput(result));
        }
      } catch (e) {
        console.warn('[WfProfile] statistics unavailable, using profile counters:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const achievements = useMemo(
    () =>
      deriveAchievements(
        statsInput ?? {
          learned: (user as any)?.learned_words ?? 0,
          mastered: (user as any)?.mastered_words ?? 0,
          total: (user as any)?.total_words ?? (user as any)?.totalLearned ?? 0,
          streak: (user as any)?.streak ?? 0,
        }
      ),
    [statsInput, user]
  );

  if (!user) {
    return (
      <div className="min-h-screen pb-28 flex items-center justify-center p-[var(--page-padding-h)]">
        <Card className="relative max-w-md w-full text-center">
          <div className="py-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)]">
              <Icons.User />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-[var(--color-text-primary)]">{t('home.loginRequired') || 'Login Required'}</h2>
            <p className="text-[var(--color-text-secondary)] mb-6">{t('profile.loginToViewProfile') || 'Log in to view your profile.'}</p>
            <Button variant="klein" onClick={() => navigate(wfPath('auth/login'))}>
              {t('auth.login') || 'Log in'}
            </Button>
            <Button variant="ghost" className="mt-3" onClick={() => navigate(wfPath('home'))}>
              {t('common.backHome') || 'Back home'}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Normalized profile view (wfUserCenter / qy UserDataCenter port): display
  // name fallback chain, resolved avatar URL and cleaned extended fields
  // (bio/phone/gender/age/...) — replaces the page's old loose-view reads.
  const profile = wfUserCenter.normalize(user);
  const displayName = wfUserCenter.getDisplayName(user);

  const getGender = () => {
    if (profile.gender === 'male') return t('profile.male') || 'Male';
    if (profile.gender === 'female') return t('profile.female') || 'Female';
    if (profile.gender === 'other') return t('profile.other') || 'Other';
    return t('profile.notSet') || 'Not set';
  };

  return (
    <div className="min-h-screen pb-28">

      {/* Asymmetric header: avatar-left, settings icon right */}
      <div className="relative pt-[var(--page-padding-v)] px-[var(--page-padding-h)] pb-[var(--space-breath)] max-w-md mx-auto">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(wfPath('profile_edit'))}
            className="relative flex-shrink-0 ds-touch-target rounded-full"
            aria-label={t('profile.editProfile') || 'Edit profile'}
          >
            <ProfileAvatar
              src={profile.avatar_url}
              name={displayName}
              className="w-16 h-16 rounded-full border border-[var(--border-highlight)] text-xl"
            />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[var(--klein-blue)] text-[var(--klein-on)] rounded-full flex items-center justify-center">
              <Icons.Edit />
            </div>
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] truncate">{displayName}</h1>
            {user.username && <p className="text-[var(--color-text-secondary)] text-sm truncate">@{user.username}</p>}
            {wfUserCenter.isPro(user) && (
              <Badge tone="klein" className="mt-2 gap-1"><Star className="w-3 h-3" fill="currentColor" /> {wfUserCenter.getPlanLabel(user)}</Badge>
            )}
          </div>
          <button
            onClick={() => navigate(wfPath('settings'))}
            className="ds-touch-target w-10 h-10 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            aria-label={t('nav.settings') || 'Settings'}
          >
            <Icons.Settings />
          </button>
        </div>

        {profile.bio && (
          <p className="mt-4 text-[var(--color-text-secondary)] text-sm leading-relaxed">{profile.bio}</p>
        )}
      </div>

      <div className="relative max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Learning stats */}
        <div className="space-y-3">
          <SectionTitle title="Learning Statistics" className="px-1" />
          <StatCard value={user.total_words ?? user.totalLearned ?? 0} label={t('profile.totalWords') || 'Total Words'} icon={<Icons.Book />} />
          <div className="grid grid-cols-2 gap-3">
            <StatCard value={user.learned_words ?? 0} label={t('profile.learnedWords') || 'Learned'} icon={<Icons.Check />} />
            <StatCard value={user.mastered_words ?? 0} label={t('profile.masteredWords') || 'Mastered'} icon={<Icons.Sparkles />} />
          </div>
        </div>

        {/* Achievements */}
        <div className="space-y-3">
          <SectionTitle title="Achievements" className="px-1" />
          <Card>
            <div className="grid grid-cols-3 gap-3">
              {achievements.map((a) => {
                const AchievementIcon = a.icon;
                return (
                  <button
                    key={a.id}
                    title={`${a.description} (${a.progress}/${a.maxProgress})`}
                    className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-1.5 px-1 transition-all ds-touch-target ${
                      a.unlocked ? 'bg-[var(--klein-blue)] text-[var(--klein-on)] shadow-[var(--klein-glow)]' : 'bg-[var(--klein-blue-soft)] opacity-60'
                    }`}
                  >
                    <AchievementIcon className="w-7 h-7" strokeWidth={2} />
                    <span className={`text-xs font-bold leading-tight text-center ${a.unlocked ? 'text-[var(--klein-on)]' : 'text-[var(--color-text-tertiary)]'}`}>{a.name}</span>
                    {!a.unlocked && (
                      <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)]">
                        {a.progress}/{a.maxProgress}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
          <div className="ds-row p-5 flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-full flex items-center justify-center flex-shrink-0">
              <Icons.Sparkles />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-1">
                {achievements.filter((a) => a.unlocked).length} / {achievements.length} Unlocked
              </h3>
              <p className="text-sm text-[var(--color-text-secondary)]">Keep learning to unlock more achievements!</p>
            </div>
          </div>
        </div>

        {/* Personal information */}
        {(user.email || profile.phone || profile.age || profile.gender || profile.birthday) && (
          <div className="space-y-3">
            <SectionTitle title="Personal Information" className="px-1" />
            {user.email && (
              <InfoCard label={t('profile.email') || 'Email'} value={user.email} icon={<Icons.Cloud />} />
            )}
            {profile.phone && (
              <InfoCard label={t('profile.phone') || 'Phone'} value={profile.phone} icon={<Icons.User />} />
            )}
            <div className="grid grid-cols-2 gap-3">
              {profile.age && (
                <InfoCard label={t('profile.age') || 'Age'} value={t('profile.yearsOld', { age: profile.age }) || `${profile.age} years old`} />
              )}
              {profile.gender && (
                <InfoCard label={t('profile.gender') || 'Gender'} value={getGender()} />
              )}
            </div>
            {profile.birthday && (
              <InfoCard label={t('profile.birthday') || 'Birthday'} value={profile.birthday} icon={<Icons.Sparkles />} />
            )}
          </div>
        )}

        {/* Location & background */}
        {(profile.location || profile.city || profile.occupation || profile.education || user.native_language) && (
          <div className="space-y-3">
            <SectionTitle title="Background" className="px-1" />
            {(profile.location || profile.city) && (
              <div className="grid grid-cols-2 gap-3">
                {profile.location && <InfoCard label={t('profile.location') || 'Location'} value={profile.location} />}
                {profile.city && <InfoCard label={t('profile.city') || 'City'} value={profile.city} />}
              </div>
            )}
            {(profile.occupation || profile.education) && (
              <div className="grid grid-cols-2 gap-3">
                {profile.occupation && <InfoCard label={t('profile.occupation') || 'Occupation'} value={profile.occupation} />}
                {profile.education && <InfoCard label={t('profile.education') || 'Education'} value={profile.education} />}
              </div>
            )}
            {user.native_language && (
              <InfoCard label={t('profile.nativeLanguage') || 'Native Language'} value={user.native_language} icon={<Icons.Globe />} />
            )}
          </div>
        )}

        {/* Social links */}
        {(profile.website || profile.github || profile.wechat || profile.weibo || profile.qq) && (
          <div className="space-y-3">
            <SectionTitle title="Social Links" className="px-1" />
            {profile.website && (
              <InfoCard label={t('profile.website') || 'Website'} value={profile.website} icon={<Icons.Globe />} />
            )}
            <div className="grid grid-cols-2 gap-3">
              {profile.github && <InfoCard label={t('profile.github') || 'GitHub'} value={profile.github} />}
              {profile.wechat && <InfoCard label={t('profile.wechat') || 'WeChat'} value={profile.wechat} />}
              {profile.weibo && <InfoCard label={t('profile.weibo') || 'Weibo'} value={profile.weibo} />}
              {profile.qq && <InfoCard label={t('profile.qq') || 'QQ'} value={profile.qq} />}
            </div>
          </div>
        )}

        {/* Logout */}
        <div className="space-y-3 pt-3">
          <Button variant="danger" className="opacity-80 hover:opacity-100" onClick={() => setShowLogoutConfirm(true)}>
            {t('auth.logout') || 'Log out'}
          </Button>
          <p className="text-center text-xs text-[var(--color-text-tertiary)] font-mono opacity-50">
            WORDFLOW AI • {user.username || user.name}
          </p>
        </div>
      </div>

      {/* Logout confirmation */}
      <Sheet open={showLogoutConfirm} onClose={() => setShowLogoutConfirm(false)} position="center" panelClassName="animate-slide-up">
        <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-2">{t('profile.logoutConfirmTitle') || 'Log out?'}</h3>
        <p className="text-[var(--color-text-secondary)] mb-6">{t('profile.logoutConfirmMessage') || 'You will need to sign in again to access your account.'}</p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowLogoutConfirm(false)} className="flex-1">
            {t('common.cancel') || 'Cancel'}
          </Button>
          <Button variant="danger" onClick={confirmLogout} className="flex-1">
            {t('auth.logout') || 'Log out'}
          </Button>
        </div>
      </Sheet>
    </div>
  );
};

export default WfProfileProfilePage;
