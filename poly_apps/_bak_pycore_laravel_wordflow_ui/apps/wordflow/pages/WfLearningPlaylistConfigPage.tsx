/* [v4.1-Iris] Playlist Config — ported from
 * poly_apps/qy_capacitor/pages/Learning/PlaylistConfig.tsx. Self-contained:
 * the original AppContext.playlistSettings/updatePlaylistSettings are replaced by
 * local state persisted to StorageCenter.settings (so WfLearningPlaylistPage
 * reads the same config back). react-router useNavigate + wfPath() for nav,
 * shared Iris primitives. Reference-faithful settings rows (ds-row + toggle). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons, Button, BackButton, SectionLabel } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { StorageCenter } from '../../../core/api-libs/wordflow/WordflowStorage';

interface PlaylistSettings {
  wordsPerPage: number;
  playbackSpeed: number;
  playInterval: number;
  repeatCount: number;
  instantReviewEnabled: boolean;
  instantReviewInterval: number;
  instantReviewBackCount: number;
  instantReviewRepeat: number;
  reviewModeEnabled: boolean;
  disableIRInReview: boolean;
  displayMode: 'simple' | 'detailed';
  largeFont: boolean;
  accent: 'US' | 'UK';
  autoScroll: boolean;
  showAnimation: boolean;
  dailyGoal: number;
}

const DEFAULT_SETTINGS: PlaylistSettings = {
  wordsPerPage: 20,
  playbackSpeed: 1,
  playInterval: 3,
  repeatCount: 1,
  instantReviewEnabled: false,
  instantReviewInterval: 3,
  instantReviewBackCount: 1,
  instantReviewRepeat: 1,
  reviewModeEnabled: false,
  disableIRInReview: false,
  displayMode: 'detailed',
  largeFont: false,
  accent: 'US',
  autoScroll: true,
  showAnimation: true,
  dailyGoal: 200,
};

/** Tappable value row: label left, current value + chevron right. */
const SettingItem: React.FC<{ label: string; value?: React.ReactNode; onClick?: () => void }> = ({ label, value, onClick }) => (
  <div
    onClick={onClick}
    className={`ds-row w-full p-4 flex items-center justify-between gap-3 group ${onClick ? 'cursor-pointer ds-touch-target' : ''}`}
  >
    <span className="font-semibold text-[var(--color-text-primary)] truncate">{label}</span>
    <div className="flex items-center gap-2 flex-shrink-0">
      {value !== undefined && <span className="text-sm text-[var(--klein-blue)] font-semibold">{value}</span>}
      {onClick && <span className="text-[var(--color-text-tertiary)] group-hover:text-[var(--klein-blue)] transition-colors"><Icons.ChevronRight /></span>}
    </div>
  </div>
);

/** Toggle row (gradient track when on). */
const ToggleItem: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <div className="ds-row w-full p-4 flex items-center justify-between gap-3">
    <span className="font-semibold text-[var(--color-text-primary)] truncate">{label}</span>
    <button
      onClick={onClick}
      className="ds-touch-target w-12 h-7 rounded-full p-1 transition-colors flex-shrink-0"
      style={{ background: active ? 'var(--klein-gradient)' : 'var(--color-glass-border)' }}
      role="switch"
      aria-checked={active}
      aria-label={label}
    >
      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${active ? 'translate-x-5' : ''}`} />
    </button>
  </div>
);

const WfLearningPlaylistConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfApp();
  const [settings, setSettings] = useState<PlaylistSettings>(DEFAULT_SETTINGS);

  // Load persisted config on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await StorageCenter.settings.get();
        if (!cancelled && stored?.playlist) {
          setSettings({ ...DEFAULT_SETTINGS, ...stored.playlist });
        }
      } catch (e) {
        console.error('[WfPlaylistConfig] failed to load settings:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Merge + persist back into the shared APP_SETTINGS blob (try/caught).
  const update = (patch: Partial<PlaylistSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      (async () => {
        try {
          const stored = (await StorageCenter.settings.get()) || {};
          await StorageCenter.settings.set({ ...stored, playlist: next });
        } catch (e) {
          console.error('[WfPlaylistConfig] failed to persist settings:', e);
        }
      })();
      return next;
    });
  };

  return (
    <div className="min-h-screen pb-28">

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        <div className="flex items-center gap-3 mb-2">
          <BackButton onClick={() => navigate(wfPath('settings_learning'))} />
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.playlistConfig') || 'Playlist Config'}
          </h1>
        </div>
        <p className="text-[var(--color-text-secondary)] pl-1">
          Configure your automated sequential learning experience.
        </p>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Playback */}
        <div className="ds-stack-tight flex flex-col">
          <SectionLabel className="px-1 mb-1">{t('settings.playback') || 'Playback'}</SectionLabel>
          <SettingItem label="Words Per Page" value={settings.wordsPerPage} onClick={() => update({ wordsPerPage: settings.wordsPerPage === 20 ? 50 : settings.wordsPerPage === 50 ? 100 : 20 })} />
          <SettingItem label="Playback Speed" value={`${settings.playbackSpeed}x`} onClick={() => update({ playbackSpeed: settings.playbackSpeed >= 2.0 ? 0.5 : settings.playbackSpeed + 0.25 })} />
          <SettingItem label="Interval (sec)" value={`${settings.playInterval}s`} onClick={() => update({ playInterval: settings.playInterval >= 5 ? 1 : settings.playInterval + 1 })} />
          <SettingItem label="Repeat Word" value={`${settings.repeatCount}x`} onClick={() => update({ repeatCount: settings.repeatCount >= 3 ? 1 : settings.repeatCount + 1 })} />
        </div>

        {/* Instant Review */}
        <div className="ds-stack-tight flex flex-col">
          <SectionLabel className="px-1 mb-1">Instant Review (IR)</SectionLabel>
          <ToggleItem label="Enable IR" active={settings.instantReviewEnabled} onClick={() => update({ instantReviewEnabled: !settings.instantReviewEnabled })} />
          {settings.instantReviewEnabled && (
            <>
              <SettingItem label="IR Interval" value={`Every ${settings.instantReviewInterval}`} onClick={() => update({ instantReviewInterval: settings.instantReviewInterval >= 10 ? 3 : settings.instantReviewInterval + 1 })} />
              <SettingItem label="Jump Back" value={`${settings.instantReviewBackCount} words`} onClick={() => update({ instantReviewBackCount: settings.instantReviewBackCount >= 5 ? 1 : settings.instantReviewBackCount + 1 })} />
              <SettingItem label="IR Repeat" value={`${settings.instantReviewRepeat}x`} onClick={() => update({ instantReviewRepeat: settings.instantReviewRepeat >= 2 ? 1 : settings.instantReviewRepeat + 1 })} />
            </>
          )}
        </div>

        {/* Review Mode */}
        <div className="ds-stack-tight flex flex-col">
          <SectionLabel className="px-1 mb-1">Review Mode</SectionLabel>
          <ToggleItem label="Review After Page" active={settings.reviewModeEnabled} onClick={() => update({ reviewModeEnabled: !settings.reviewModeEnabled })} />
          {settings.reviewModeEnabled && (
            <ToggleItem label="Disable IR during Review" active={settings.disableIRInReview} onClick={() => update({ disableIRInReview: !settings.disableIRInReview })} />
          )}
        </div>

        {/* Appearance & Audio */}
        <div className="ds-stack-tight flex flex-col">
          <SectionLabel className="px-1 mb-1">Appearance & Audio</SectionLabel>
          <SettingItem label="Display Mode" value={settings.displayMode === 'simple' ? 'Simple' : 'Detailed'} onClick={() => update({ displayMode: settings.displayMode === 'simple' ? 'detailed' : 'simple' })} />
          <ToggleItem label="Large Font" active={settings.largeFont} onClick={() => update({ largeFont: !settings.largeFont })} />
          <SettingItem label="Accent" value={settings.accent} onClick={() => update({ accent: settings.accent === 'US' ? 'UK' : 'US' })} />
          <ToggleItem label="Auto Scroll" active={settings.autoScroll} onClick={() => update({ autoScroll: !settings.autoScroll })} />
          <ToggleItem label="Show Animation" active={settings.showAnimation} onClick={() => update({ showAnimation: !settings.showAnimation })} />
        </div>

        {/* Goals */}
        <div className="ds-stack-tight flex flex-col">
          <SectionLabel className="px-1 mb-1">{t('settings.goals') || 'Goals'}</SectionLabel>
          <SettingItem label="Daily Word Goal" value={settings.dailyGoal} onClick={() => update({ dailyGoal: settings.dailyGoal + 100 })} />
        </div>

        <div className="pt-2">
          <Button variant="grad" onClick={() => navigate(wfPath('playlist'))}>
            Start Playing
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WfLearningPlaylistConfigPage;
