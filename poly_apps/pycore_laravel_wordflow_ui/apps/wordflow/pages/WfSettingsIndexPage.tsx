/* [v4.1-Iris] Settings hub — ported from qy_capacitor/pages/Settings/Index.tsx.
 * Self-contained: react-router useNavigate + wfPath() for nav, useWfApp() for
 * user/logout/t, shared Iris primitives from WfUI. Matches the reference
 * gradient-hero account card + grouped setting rows (design-reference-*.webp). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Icons, Spinner, SectionTitle, SectionLabel } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';

interface SettingItemProps {
  label: string;
  value?: string;
  onClick: () => void;
  icon?: React.ReactNode;
  tone?: 'klein' | 'danger';
}

/** Reference settings row: soft rounded icon-chip + label + value + chevron. */
const SettingItem: React.FC<SettingItemProps> = ({ label, value, onClick, icon, tone = 'klein' }) => (
  <button
    type="button"
    onClick={onClick}
    className="ds-row w-full p-4 cursor-pointer ds-touch-target flex items-center justify-between gap-3 text-left group"
  >
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <span
          className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm [&_svg]:w-5 [&_svg]:h-5 ${
            tone === 'danger'
              ? 'bg-red-500/10 text-red-500'
              : 'bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]'
          }`}
        >
          {icon}
        </span>
      )}
      <span className="font-semibold text-[var(--color-text-primary)] truncate group-hover:text-[var(--klein-blue)] transition-colors">
        {label}
      </span>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      {value && (
        <span className="text-sm text-[var(--color-text-tertiary)] truncate max-w-[7rem]">{value}</span>
      )}
      <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors">
        <Icons.ChevronRight />
      </span>
    </div>
  </button>
);

const iconPaths = {
  lang: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129',
  goal: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  theme: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z',
  server: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  sync: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  lock: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  stats: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
};

const Ico = ({ d }: { d: string }) => (
  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const WfSettingsIndexPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, t } = useWfApp();
  const go = (p: string) => navigate(wfPath(p));

  // Invitation code — GET /invitation-code (the original ApiCenter.misc
  // endpoint); degrades to the "no code" copy when unavailable.
  const [invitationCode, setInvitationCode] = useState('');
  const [loadingCode, setLoadingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingCode(true);
      try {
        const result = await wordflowApi.request<{ masked_code?: string }>('/invitation-code');
        if (!cancelled) setInvitationCode(result?.masked_code || '');
      } catch (e) {
        console.error('[WfSettings] failed to load invitation code:', e);
      } finally {
        if (!cancelled) setLoadingCode(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const handleCopyCode = () => {
    if (!invitationCode) return;
    try {
      navigator.clipboard.writeText(invitationCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch (e) {
      console.error('[WfSettings] copy failed:', e);
    }
  };

  const initial = (user?.name || user?.nickname || user?.username || 'W').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen pb-28">

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        {/* Minimal asymmetric header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.settings')}
          </h1>
          <button
            onClick={() => go('mine')}
            className="ds-touch-target w-10 h-10 rounded-full ds-glass ds-glass-edge flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[var(--klein-blue)] transition-colors"
            aria-label={t('common.close')}
          >
            <Icons.Close />
          </button>
        </div>

        {/* Profile — gradient hero card */}
        {user ? (
          <button
            type="button"
            onClick={() => go('profile')}
            className="w-full text-left rounded-[var(--radius-card)] p-5 relative overflow-hidden text-white flex items-center gap-4 active:scale-[0.99] transition-transform"
            style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
          >
            <div className="absolute -top-12 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl" />
            <div className="absolute -bottom-14 -left-10 w-36 h-36 bg-white/10 rounded-full blur-3xl" />
            <div className="relative flex-shrink-0">
              {user.avatar_url || user.avatar ? (
                <img
                  src={user.avatar_url || user.avatar}
                  alt={user.name}
                  className="w-16 h-16 rounded-full border-2 border-white/40 object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full border-2 border-white/40 bg-white/15 flex items-center justify-center text-xl font-bold">
                  {initial}
                </div>
              )}
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-2 border-white" />
            </div>
            <div className="relative flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{user.name || user.nickname || user.username}</h2>
              <p className="text-white/80 text-sm truncate">
                {user.isPro ? t('profile.proMember') : t('settings.freePlan')}
              </p>
            </div>
            <span className="relative text-white/80"><Icons.ChevronRight /></span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go('auth/login')}
            className="ds-row w-full p-5 cursor-pointer ds-touch-target flex items-center gap-4 text-left group"
          >
            <div className="w-16 h-16 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center flex-shrink-0 text-[var(--klein-blue)]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{t('home.welcomeGuest')}</h2>
              <p className="text-[var(--color-text-secondary)] text-sm">{t('home.tapToLogin')}</p>
            </div>
            <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors"><Icons.ChevronRight /></span>
          </button>
        )}
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Preferences */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.preferences')} className="px-1 mb-1" />
          <SettingItem label={t('settings.languageAudio')} value="En" onClick={() => go('settings_lang')} icon={<Ico d={iconPaths.lang} />} />
          <SettingItem label={t('settings.learningGoals')} value={`20${t('settings.perDay')}`} onClick={() => go('settings_learning')} icon={<Ico d={iconPaths.goal} />} />
          <SettingItem label="Word Reading" value="Walkman" onClick={() => go('settings_word_reading')} icon={<Ico d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />} />
          <SettingItem label={t('settings.displayTheme')} value={t('settings.auto')} onClick={() => go('settings_display')} icon={<Ico d={iconPaths.theme} />} />
        </div>

        {/* System */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.system')} className="px-1 mb-1" />
          <SettingItem label={t('settings.apiServer')} value={t('settings.auto')} onClick={() => go('settings_api_server')} icon={<Ico d={iconPaths.server} />} />
          <SettingItem label={t('settings.notifications')} value={t('settings.on')} onClick={() => go('settings_notifications')} icon={<Ico d={iconPaths.bell} />} />
          <SettingItem label={t('settings.dataSync')} value={t('settings.active')} onClick={() => go('settings_data')} icon={<Ico d={iconPaths.sync} />} />
          <SettingItem label={t('settings.privacySecurity')} onClick={() => go('settings_privacy')} icon={<Ico d={iconPaths.lock} />} />
          <SettingItem label={t('settings.systemStatistics')} onClick={() => go('settings_statistics')} icon={<Ico d={iconPaths.stats} />} />
          <SettingItem label={t('settings.about')} value={`${t('settings.version')} 1.0`} onClick={() => go('settings_about')} icon={<Ico d={iconPaths.info} />} />
        </div>

        {/* Account */}
        <div className="ds-stack-tight flex flex-col">
          {user && (
            <div
              className="rounded-[var(--radius-card)] p-6 relative overflow-hidden text-center text-white"
              style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
            >
              <div className="absolute -top-12 -right-10 w-36 h-36 bg-white/15 rounded-full blur-2xl" />
              <div className="relative">
                <p className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-white/70 mb-2">
                  {t('settings.invitationCode') || 'Invitation Code'}
                </p>
                {loadingCode ? (
                  <div className="h-8 flex items-center justify-center"><Spinner size="sm" /></div>
                ) : invitationCode ? (
                  <div className="space-y-3">
                    <p className="font-mono text-2xl font-bold tracking-wider">{invitationCode}</p>
                    <button
                      onClick={handleCopyCode}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white text-[var(--klein-blue)] font-bold shadow-lg hover:scale-[1.03] active:scale-95 transition-transform"
                    >
                      {copiedCode ? (
                        <><Icons.Check />{t('common.copied') || 'Copied!'}</>
                      ) : (
                        <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{t('settings.copyCode') || 'Copy Code'}</>
                      )}
                    </button>
                    <p className="text-xs text-white/70">{t('settings.shareWithFriends') || 'Share with friends to invite them'}</p>
                  </div>
                ) : (
                  <p className="text-sm text-white/70">{t('settings.noInvitationCode') || 'No invitation code available'}</p>
                )}
              </div>
            </div>
          )}

          <div className="ds-row p-4 text-center">
            <SectionLabel className="justify-center">{t('settings.userId')}</SectionLabel>
            <p className="font-mono text-sm text-[var(--color-text-primary)] mt-1">{user?.id || '—'}</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">{t('settings.builtWith')} WordFlow AI</p>
          </div>

          {user ? (
            <Button variant="danger" onClick={logout}>{t('settings.signOut')}</Button>
          ) : (
            <Button variant="grad" onClick={() => go('auth/login')}>{t('auth.login')}</Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WfSettingsIndexPage;
