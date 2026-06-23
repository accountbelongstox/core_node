/* [v4.1-Iris] Data Sync — ported from qy_capacitor/pages/Settings/DataSync.tsx.
 * autoSync/wifiOnly persist via wfSettingsCenter (sync section). Manual sync
 * refreshes the wordflowApi caches (profile + word groups) plus the learning
 * stats via wfLearningStatsCenter.refresh(); clear cache invalidates them. All
 * try/caught and degrade gracefully. Storage stats are illustrative.
 * Self-contained: useNavigate + wfPath(), useWfApp().t, shared Iris primitives.
 * Iris reference parity (design-reference-{light,dark}.webp). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, BackButton, Spinner, ProgressBar, Stat, SectionTitle } from '../WfUI';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import { wfSettingsCenter } from '../services/WfSettingsCenter';
import { wfLearningStatsCenter } from '../services/WfLearningStatsCenter';

interface ToggleCardProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

const ToggleCard: React.FC<ToggleCardProps> = ({ label, description, value, onChange, icon }) => (
  <div className="ds-row p-4 flex items-center justify-between gap-3">
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

const WfSettingsDataSyncPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfApp();
  const [autoSync, setAutoSync] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Hydrate the sync section from the settings center on mount.
  useEffect(() => {
    let alive = true;
    wfSettingsCenter.load().then((s) => {
      if (!alive) return;
      setAutoSync(s.sync.autoSync);
      setWifiOnly(s.sync.wifiOnly);
    });
    return () => { alive = false; };
  }, []);

  const changeAutoSync = (value: boolean) => {
    setAutoSync(value);
    wfSettingsCenter.update({ sync: { autoSync: value } });
  };

  const changeWifiOnly = (value: boolean) => {
    setWifiOnly(value);
    wfSettingsCenter.update({ sync: { wifiOnly: value } });
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await Promise.all([
        wordflowApi.refreshUserProfile().catch(() => null),
        wordflowApi.refreshWordGroups().catch(() => null),
        wfLearningStatsCenter.refresh().catch(() => null),
      ]);
      setLastSynced(new Date().toLocaleTimeString());
    } catch (e) {
      console.error('[WfSettingsDataSync] sync failed:', e);
    } finally {
      setSyncing(false);
    }
  };

  const handleClearCache = () => {
    try {
      if (confirm('Are you sure you want to clear the cache? Your progress will not be deleted.')) {
        wordflowApi.clearCache();
        alert('Cache cleared successfully!');
      }
    } catch (e) {
      console.error('[WfSettingsDataSync] clear cache failed:', e);
    }
  };

  return (
    <div className="min-h-screen pb-28">

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        {/* Minimal asymmetric header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            {t('settings.dataSync')}
          </h1>
          <BackButton onClick={() => navigate(wfPath('settings'))} />
        </div>

        {/* Sync Status — gradient hero card */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-white relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-12 -right-10 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-14 -left-10 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-4">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg mb-1">Sync Status</h3>
              <p className="text-white/80 text-sm mb-3">
                {lastSynced ? `Last synced: ${lastSynced}` : 'Not synced yet'}
              </p>
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="ds-touch-target px-4 py-2 bg-white/15 hover:bg-white/25 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 inline-flex items-center gap-2"
              >
                {syncing ? (<><Spinner size="sm" />Syncing...</>) : 'Sync Now'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Sync Settings */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title="Sync Settings" className="px-1 mb-1" />

          <ToggleCard
            label={t('settings.autoSync')}
            description="Automatically sync data in the background"
            value={autoSync}
            onChange={changeAutoSync}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />

          <ToggleCard
            label={t('settings.syncOnlyWifi')}
            description="Only sync when connected to Wi-Fi"
            value={wifiOnly}
            onChange={changeWifiOnly}
            icon={
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            }
          />
        </div>

        {/* Storage Info */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.storage')} className="px-1 mb-1" />

          <Card>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-[var(--klein-blue-soft)] rounded-xl flex items-center justify-center text-[var(--klein-blue)] flex-shrink-0 shadow-sm">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-text-primary)]">{t('settings.usedStorage')}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">430 MB of 5 GB</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-[var(--klein-blue)]">8.6%</span>
              </div>

              <ProgressBar value={8.6} className="h-3" barClassName="h-3" />

              <div className="grid grid-cols-3 gap-3">
                <div className="ds-row p-3 text-center">
                  <Stat value="350 MB" label={t('settings.words')} className="items-center" />
                </div>
                <div className="ds-row p-3 text-center">
                  <Stat value="60 MB" label={t('settings.audio')} className="items-center" />
                </div>
                <div className="ds-row p-3 text-center">
                  <Stat value="20 MB" label={t('settings.images')} className="items-center" />
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Cache Management */}
        <div className="ds-stack-tight flex flex-col">
          <SectionTitle title={t('settings.cacheManagement')} className="px-1 mb-1" />

          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-[var(--klein-blue-soft)] rounded-xl flex items-center justify-center text-[var(--klein-blue)] flex-shrink-0 shadow-sm">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-[var(--color-text-primary)]">Cache Size</p>
                <p className="text-sm text-[var(--color-text-secondary)]">Cached learning data</p>
              </div>
            </div>
            <Button onClick={handleClearCache} variant="danger">
              {t('settings.clearCache')}
            </Button>
          </Card>
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
              <h3 className="font-bold text-[var(--color-text-primary)] mb-2">About Data Sync</h3>
              <ul className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Your progress syncs automatically in the background</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Wi-Fi only mode saves mobile data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[var(--klein-blue)]">•</span>
                  <span>Clearing cache won't delete your progress</span>
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default WfSettingsDataSyncPage;
