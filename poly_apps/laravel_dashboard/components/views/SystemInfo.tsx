
import React, { useState, useEffect } from 'react';
import { SystemInfo as SystemInfoType, AsyncState } from '../../types';
import { apiService } from '../../services/apiService';
import { Language } from '../../types';
import { TRANSLATIONS } from '../../constants';
import { Server, Code, Database, Zap, List, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { commonClasses } from '../../styles/theme';

interface SystemInfoProps {
  lang?: Language;
}

type TabType = 'server' | 'php' | 'laravel' | 'database' | 'cache' | 'queue' | 'routes';

const SystemInfo: React.FC<SystemInfoProps> = ({ lang = 'en' }) => {
  const [systemInfo, setSystemInfo] = useState<AsyncState<SystemInfoType>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [activeTab, setActiveTab] = useState<TabType>('server');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);

  const t = TRANSLATIONS[lang].system;

  const fetchSystemInfo = async () => {
    setSystemInfo(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await apiService.getSystemInfo();
      if (response.success && response.data) {
        setSystemInfo({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
      } else {
        throw new Error(response.error || 'Failed to fetch system info');
      }
    } catch (error: any) {
      setSystemInfo({
        data: null,
        loading: false,
        error: error.message,
        status: 'error'
      });
    }
  };

  useEffect(() => {
    fetchSystemInfo();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchSystemInfo, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const tabs = [
    { id: 'server' as TabType, label: t.tabs.server, icon: Server },
    { id: 'php' as TabType, label: t.tabs.php, icon: Code },
    { id: 'laravel' as TabType, label: t.tabs.laravel, icon: Zap },
    { id: 'database' as TabType, label: t.tabs.database, icon: Database },
    { id: 'cache' as TabType, label: t.tabs.cache, icon: Zap },
    { id: 'queue' as TabType, label: t.tabs.queue, icon: List },
    { id: 'routes' as TabType, label: t.tabs.routes, icon: List },
  ];

  const InfoRow: React.FC<{ label: string; value: string | number | boolean; highlighted?: boolean }> = ({ label, value, highlighted }) => (
    <div className={`flex justify-between items-center py-2 px-4 ${highlighted ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-mono ${highlighted ? 'text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>
        {String(value)}
      </span>
    </div>
  );

  const renderTabContent = () => {
    if (!systemInfo.data) return null;

    switch (activeTab) {
      case 'server':
        return (
          <div className={commonClasses.card + ' p-6'}>
            <h3 className="text-lg font-semibold mb-4">Server Information</h3>
            <div className="space-y-1">
              <InfoRow label="OS" value={systemInfo.data.server.os} />
              <InfoRow label="Architecture" value={systemInfo.data.server.architecture} />
              <InfoRow label="Hostname" value={systemInfo.data.server.hostname} />
              <InfoRow label="Web Server" value={systemInfo.data.server.server_software} />
              <InfoRow label="Protocol" value={systemInfo.data.server.server_protocol} />
              <InfoRow label="Document Root" value={systemInfo.data.server.document_root} />
            </div>
          </div>
        );

      case 'php':
        return (
          <div className={commonClasses.card + ' p-6'}>
            <h3 className="text-lg font-semibold mb-4">PHP Configuration</h3>
            <div className="space-y-1">
              <InfoRow label="Version" value={systemInfo.data.php.version} highlighted />
              <InfoRow label="Memory Limit" value={systemInfo.data.php.memory_limit} />
              <InfoRow label="Max Execution Time" value={systemInfo.data.php.max_execution_time} />
              <InfoRow label="Upload Max Size" value={systemInfo.data.php.upload_max_filesize} />
              <InfoRow label="Post Max Size" value={systemInfo.data.php.post_max_size} />
              <InfoRow label="Timezone" value={systemInfo.data.php.timezone} />
              <InfoRow label="Display Errors" value={systemInfo.data.php.display_errors ? 'Yes' : 'No'} />
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-semibold mb-2">Extensions</h4>
                <div className="flex flex-wrap gap-2">
                  {systemInfo.data.php.extensions.map((ext, idx) => (
                    <span key={idx} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                      {ext}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );

      case 'laravel':
        return (
          <div className={commonClasses.card + ' p-6'}>
            <h3 className="text-lg font-semibold mb-4">Laravel Information</h3>
            <div className="space-y-1">
              <InfoRow label="Version" value={systemInfo.data.laravel.version} highlighted />
              <InfoRow label="Environment" value={systemInfo.data.laravel.environment} />
              <InfoRow label="Debug Mode" value={systemInfo.data.laravel.debug_mode ? 'Enabled' : 'Disabled'} />
              <InfoRow label="App URL" value={systemInfo.data.laravel.app_url} />
              <InfoRow label="App Name" value={systemInfo.data.laravel.app_name} />
              <InfoRow label="Timezone" value={systemInfo.data.laravel.timezone} />
              <InfoRow label="Locale" value={systemInfo.data.laravel.locale} />
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-semibold mb-2">Cache Status</h4>
                <div className="space-y-1">
                  <InfoRow label="Config Cached" value={systemInfo.data.laravel.config_cached ? 'Yes' : 'No'} />
                  <InfoRow label="Routes Cached" value={systemInfo.data.laravel.routes_cached ? 'Yes' : 'No'} />
                  <InfoRow label="Events Cached" value={systemInfo.data.laravel.events_cached ? 'Yes' : 'No'} />
                  <InfoRow label="Views Cached" value={systemInfo.data.laravel.views_cached ? 'Yes' : 'No'} />
                </div>
              </div>
            </div>
          </div>
        );

      case 'database':
        return (
          <div className={commonClasses.card + ' p-6'}>
            <h3 className="text-lg font-semibold mb-4">Database Connections</h3>
            <div className="space-y-4">
              {systemInfo.data.database.connections.map((conn, idx) => (
                <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    {conn.connected ? (
                      <CheckCircle className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="font-semibold">{conn.name}</span>
                    <span className={`px-2 py-1 rounded text-xs ${conn.connected ? commonClasses.badgeSuccess : commonClasses.badgeError}`}>
                      {conn.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <InfoRow label="Driver" value={conn.driver} />
                    <InfoRow label="Host" value={`${conn.host}:${conn.port}`} />
                    <InfoRow label="Database" value={conn.database} />
                    <InfoRow label="Username" value={conn.username} />
                    {conn.charset && <InfoRow label="Charset" value={conn.charset} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'cache':
        return (
          <div className={commonClasses.card + ' p-6'}>
            <h3 className="text-lg font-semibold mb-4">Cache Stores</h3>
            <div className="space-y-2">
              <InfoRow label="Default Driver" value={systemInfo.data.cache.default_driver} highlighted />
              {systemInfo.data.cache.stores.map((store, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded">
                  <span className="text-sm font-medium">{store.name}</span>
                  <span className="text-xs text-slate-500">({store.driver})</span>
                  {store.available ? (
                    <CheckCircle className="w-4 h-4 text-emerald-500 ml-auto" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 ml-auto" />
                  )}
                </div>
              ))}
            </div>
          </div>
        );

      case 'queue':
        return (
          <div className={commonClasses.card + ' p-6'}>
            <h3 className="text-lg font-semibold mb-4">Queue Connections</h3>
            <div className="space-y-2">
              <InfoRow label="Default Connection" value={systemInfo.data.queue.default_connection} highlighted />
              {systemInfo.data.queue.connections.map((conn, idx) => (
                <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold">{conn.name}</span>
                    <span className="text-xs text-slate-500">({conn.driver})</span>
                    {conn.running ? (
                      <span className={`ml-auto ${commonClasses.badgeSuccess}`}>Running</span>
                    ) : (
                      <span className={`ml-auto ${commonClasses.badgeError}`}>Stopped</span>
                    )}
                  </div>
                  {conn.queue && <InfoRow label="Queue" value={conn.queue} />}
                  {conn.retry_after && <InfoRow label="Retry After" value={`${conn.retry_after}s`} />}
                </div>
              ))}
            </div>
          </div>
        );

      case 'routes':
        return (
          <div className={commonClasses.card + ' p-6'}>
            <h3 className="text-lg font-semibold mb-4">Routes ({systemInfo.data.routes.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700">
                    <th className="text-left py-2 px-2">Method</th>
                    <th className="text-left py-2 px-2">URI</th>
                    <th className="text-left py-2 px-2">Name</th>
                    <th className="text-left py-2 px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {systemInfo.data.routes.slice(0, 50).map((route, idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="py-2 px-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          route.method === 'GET' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                          route.method === 'POST' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                          route.method === 'PUT' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                          route.method === 'DELETE' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400'
                        }`}>
                          {route.method}
                        </span>
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">{route.uri}</td>
                      <td className="py-2 px-2 text-slate-500">{route.name || '-'}</td>
                      <td className="py-2 px-2 font-mono text-xs text-slate-600 dark:text-slate-400">{route.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col p-6 overflow-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold">{t.title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span>{t.auto_refresh}</span>
            </label>
            <button
              onClick={fetchSystemInfo}
              disabled={systemInfo.loading}
              className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
            >
              <RefreshCw className={`w-4 h-4 ${systemInfo.loading ? 'animate-spin' : ''}`} />
              {t.refresh}
            </button>
          </div>
        </div>
        {systemInfo.data && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{t.last_updated}: {new Date(systemInfo.data.timestamp).toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1">
        {systemInfo.loading && (
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        )}
        {systemInfo.error && (
          <div className={`${commonClasses.card} p-6 text-center`}>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 dark:text-red-400">{systemInfo.error}</p>
          </div>
        )}
        {systemInfo.data && renderTabContent()}
      </div>
    </div>
  );
};

export default SystemInfo;

