import React, { useContext, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button } from '../../components/UI';

interface ToggleCardProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  icon?: React.ReactNode;
}

const ToggleCard: React.FC<ToggleCardProps> = ({ label, description, value, onChange, icon }) => (
  <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1">
        {icon && <div className="text-slate-600 dark:text-slate-400">{icon}</div>}
        <div className="flex-1">
          <p className="font-semibold text-slate-900 dark:text-white">{label}</p>
          {description && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
          )}
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-7 rounded-full p-1 transition-colors ${
          value ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform ${
            value ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  </Card>
);

const DataSyncPage = () => {
  const { navigate, settings, updateSettings, t } = useContext(AppContext);
  const [autoSync, setAutoSync] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const handleManualSync = async () => {
    setSyncing(true);
    // Simulate sync
    setTimeout(() => {
      setSyncing(false);
      alert('Sync completed successfully!');
    }, 2000);
  };

  const handleClearCache = () => {
    if (confirm('Are you sure you want to clear the cache? This will free up 200MB.')) {
      alert('Cache cleared successfully!');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6 max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('settings')}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.Back />
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {t('settings.dataSync')}
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Keep your learning data synchronized across devices
        </p>
      </div>

      <div className="max-w-md mx-auto px-6 space-y-6">
        {/* Sync Status Card */}
        <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-none shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg mb-1">Sync Status</h3>
              <p className="text-blue-100 text-sm mb-3">Last synced: Today, 10:00 AM</p>
              <button
                onClick={handleManualSync}
                disabled={syncing}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {syncing ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Syncing...
                  </>
                ) : (
                  'Sync Now'
                )}
              </button>
            </div>
          </div>
        </Card>

        {/* Sync Settings */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('settings.syncSettings')}
          </h2>

          <ToggleCard
            label={t('settings.autoSync')}
            description="Automatically sync data in the background"
            value={autoSync}
            onChange={setAutoSync}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            }
          />

          <ToggleCard
            label={t('settings.syncOnlyWifi')}
            description="Only sync when connected to Wi-Fi"
            value={wifiOnly}
            onChange={setWifiOnly}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            }
          />
        </div>

        {/* Storage Info */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            {t('settings.storage')}
          </h2>

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-slate-800 dark:to-slate-800 border border-purple-200 dark:border-slate-700">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center text-white">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{t('settings.usedStorage')}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">430 MB of 5 GB</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">8.6%</span>
              </div>

              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all" style={{ width: '8.6%' }} />
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg">
                  <div className="font-bold text-slate-900 dark:text-white">350 MB</div>
                  <div className="text-slate-500 dark:text-slate-400">Words</div>
                </div>
                <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg">
                  <div className="font-bold text-slate-900 dark:text-white">60 MB</div>
                  <div className="text-slate-500 dark:text-slate-400">Audio</div>
                </div>
                <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg">
                  <div className="font-bold text-slate-900 dark:text-white">20 MB</div>
                  <div className="text-slate-500 dark:text-slate-400">Images</div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Cache Management */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
            Cache Management
          </h2>

          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center text-orange-600 dark:text-orange-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">Cache Size</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">200 MB cached data</p>
                </div>
              </div>
            </div>
            <Button
              onClick={handleClearCache}
              variant="secondary"
              className="w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
            >
              {t('settings.clearCache')}
            </Button>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-slate-800 dark:to-slate-800 border border-amber-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">About Data Sync</h3>
              <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">•</span>
                  <span>Your progress syncs automatically every 30 minutes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">•</span>
                  <span>Wi-Fi only mode saves mobile data</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-orange-600">•</span>
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

export default DataSyncPage;
