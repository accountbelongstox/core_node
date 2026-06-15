/* [v4.1-Iris] Privacy & Security — ported style from
 * qy_capacitor/pages/Settings/About.tsx (same Iris settings shell), tailored to
 * privacy/security controls. Privacy toggles are local UI prefs; data actions
 * are try/caught. Self-contained: useNavigate + wfPath(), useWfApp() for
 * user/logout/t, shared Iris primitives. Iris reference parity. */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Icons, BackButton, SectionTitle, Badge } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';

interface ToggleCardProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

const ToggleCard: React.FC<ToggleCardProps> = ({ label, description, value, onChange, icon }) => (
  <div className="ds-row w-full p-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] [&_svg]:w-5 [&_svg]:h-5">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="font-semibold text-[var(--color-text-primary)] truncate">{label}</p>
        {description && <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{description}</p>}
      </div>
    </div>
    <button
      onClick={() => onChange(!value)}
      className="ds-touch-target w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0"
      style={{ background: value ? 'var(--klein-gradient)' : 'var(--color-glass-border)' }}
      role="switch"
      aria-checked={value}
    >
      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${value ? 'translate-x-5' : ''}`} />
    </button>
  </div>
);

interface ActionRowProps {
  label: string;
  description?: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: 'klein' | 'danger';
}

const ActionRow: React.FC<ActionRowProps> = ({ label, description, icon, onClick, tone = 'klein' }) => (
  <button
    type="button"
    onClick={onClick}
    className="ds-row w-full p-4 flex items-center justify-between gap-3 group ds-touch-target text-left"
  >
    <div className="flex items-center gap-3 min-w-0">
      <span
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm [&_svg]:w-5 [&_svg]:h-5 ${
          tone === 'danger' ? 'bg-red-500/10 text-red-500' : 'bg-[var(--klein-blue-soft)] text-[var(--klein-blue)]'
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className={`font-semibold truncate transition-colors ${tone === 'danger' ? 'text-red-500' : 'text-[var(--color-text-primary)] group-hover:text-[var(--klein-blue)]'}`}>{label}</p>
        {description && <p className="text-sm text-[var(--color-text-secondary)]">{description}</p>}
      </div>
    </div>
    <span className="text-[var(--color-text-tertiary)] flex-shrink-0"><Icons.ChevronRight /></span>
  </button>
);

const WfSettingsPrivacyPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, t } = useWfApp();

  const [analytics, setAnalytics] = useState(true);
  const [personalization, setPersonalization] = useState(true);
  const [profilePublic, setProfilePublic] = useState(false);
  const [shareActivity, setShareActivity] = useState(false);

  const handleClearLocalData = () => {
    try {
      if (confirm('Clear locally cached data on this device? Your account data is not affected.')) {
        wordflowApi.clearCache();
        alert('Local data cleared.');
      }
    } catch (e) {
      console.error('[WfSettingsPrivacy] clear local data failed:', e);
    }
  };

  const handleSignOutEverywhere = () => {
    try {
      if (confirm('Sign out of this session?')) logout();
    } catch (e) {
      console.error('[WfSettingsPrivacy] sign out failed:', e);
    }
  };

  return (
    <div className="min-h-screen pb-28">

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        {/* Minimal asymmetric header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.privacySecurity')}
          </h1>
          <BackButton onClick={() => navigate(wfPath('settings'))} />
        </div>

        {/* Privacy hero card */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-white relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-12 -right-10 w-44 h-44 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-14 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg mb-1">Your data, your control</h3>
              <p className="text-white/80 text-sm">Manage how your information is used and kept private.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Privacy Controls */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="Privacy Controls" className="px-1 mb-1" />

          <ToggleCard
            label="Usage Analytics"
            description="Share anonymous usage data to improve the app"
            value={analytics}
            onChange={setAnalytics}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
          />

          <ToggleCard
            label="Personalized Recommendations"
            description="Use my learning history to tailor content"
            value={personalization}
            onChange={setPersonalization}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            }
          />

          <ToggleCard
            label="Public Profile"
            description="Allow others to view your profile"
            value={profilePublic}
            onChange={setProfilePublic}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
          />

          <ToggleCard
            label="Share Activity"
            description="Let friends see your learning activity"
            value={shareActivity}
            onChange={setShareActivity}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
          />
        </div>

        {/* Account Security */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="Account Security" className="px-1 mb-1" />

          <ActionRow
            label="Change Password"
            description="Update your account password"
            onClick={() => navigate(wfPath('auth/forgot-password'))}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            }
          />

          {user && (
            <ActionRow
              label="Sign Out"
              description="End your session on this device"
              onClick={handleSignOutEverywhere}
              icon={
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              }
            />
          )}
        </div>

        {/* Data Management */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="Data Management" className="px-1 mb-1" />

          <ActionRow
            label="Clear Local Data"
            description="Remove cached data from this device"
            onClick={handleClearLocalData}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            }
          />

          <ActionRow
            label="Delete Account"
            description="Permanently remove your account and data"
            tone="danger"
            onClick={() => alert('Please contact support@wordflow.ai to request account deletion.')}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          />
        </div>

        {/* Info Card */}
        <Card>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-2">About Your Privacy</h3>
              <p className="text-sm text-[var(--color-text-secondary)] mb-3">
                We only use your data to power your learning experience. You can opt out of analytics and personalization at any time.
              </p>
              <Badge tone="klein">End-to-end account control</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WfSettingsPrivacyPage;
