
import React, { useState, useEffect } from 'react';
import { LaravelSystemInfo as SystemInfoType, AsyncState } from '../../apps/laravel-manager/uiTypes';
import { api } from '@/apps/laravel-manager/api';
import { TRANSLATIONS } from '../../constants';
import { useAppState } from '../../contexts/AppStateContext';
import { Server, Code, Database, Zap, List, RefreshCw, CheckCircle, XCircle, Cpu, HardDrive, Clock } from 'lucide-react';
import { commonClasses } from '../../styles/theme';

const SystemInfo: React.FC = () => {
  const { lang } = useAppState();
  const [systemInfo, setSystemInfo] = useState<AsyncState<SystemInfoType>>({
    data: null,
    loading: false,
    error: null,
    status: 'idle'
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const t = TRANSLATIONS[lang].system;
  const fields = t.fields;

  const fetchSystemInfo = async () => {
    setSystemInfo(prev => ({ ...prev, loading: true, status: 'loading' }));
    try {
      const response = await api.serverManagerV1.getSystemInfo();
      if (response.success && response.data) {
        setSystemInfo({
          data: response.data,
          loading: false,
          error: null,
          status: 'success'
        });
        setLastUpdated(new Date());
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

  const InfoRow: React.FC<{ label: string; value: string | number | boolean; highlighted?: boolean }> = ({ label, value, highlighted }) => (
    <div className={`flex justify-between items-center py-2 px-4 ${highlighted ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
      <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</span>
      <span className={`text-sm font-mono ${highlighted ? 'text-indigo-700 dark:text-indigo-400 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>
        {String(value)}
      </span>
    </div>
  );

  const SectionCard: React.FC<{ title: string; icon: React.FC<any>; children: React.ReactNode }> = ({ title, icon: Icon, children }) => (
    <div className={`${commonClasses.card} mb-6`}>
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-700">
        <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      </div>
      {children}
    </div>
  );

  if (!systemInfo.data) {
    return (
      <div className="w-full h-full flex flex-col p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.title}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
            </div>
          </div>
        </div>
        <div className={`${commonClasses.card} flex-1 flex items-center justify-center`}>
          {systemInfo.loading ? (
            <div className="flex items-center gap-3 text-slate-500">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Loading system information...</span>
            </div>
          ) : systemInfo.error ? (
            <div className="text-center">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-red-600 dark:text-red-400">{systemInfo.error}</p>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  const data = systemInfo.data as any;

  return (
    <div className="w-full h-full flex flex-col p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t.title}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Clock className="w-4 h-4" />
                <span>{t.last_updated}: {lastUpdated.toLocaleTimeString()}</span>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className={commonClasses.checkbox}
              />
              <span>{t.auto_refresh}</span>
            </label>
            <button
              onClick={fetchSystemInfo}
              disabled={systemInfo.loading}
              className={`${commonClasses.button} flex items-center gap-2`}
            >
              <RefreshCw className={`w-4 h-4 ${systemInfo.loading ? 'animate-spin' : ''}`} />
              {t.refresh}
            </button>
          </div>
        </div>
      </div>

      {/* Content - All Sections in One Page */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Server Info */}
          <SectionCard title={t.tabs.server} icon={Server}>
            <div className="space-y-1">
              <InfoRow label={fields.hostname} value={data.basic_info?.hostname || 'N/A'} />
              <InfoRow label={fields.operating_system} value={data.basic_info?.operating_system || 'N/A'} />
              <InfoRow label={fields.server_time} value={data.basic_info?.server_time || 'N/A'} />
              <InfoRow label={fields.timezone} value={data.basic_info?.timezone || 'N/A'} />
              <InfoRow label={fields.uptime} value={data.basic_info?.uptime || 'N/A'} />
              <InfoRow label={fields.cpu_model} value={data.hardware_info?.cpu_info?.model || 'N/A'} />
              <InfoRow label={fields.cpu_cores} value={data.hardware_info?.cpu_info?.cores || 'N/A'} />
            </div>
          </SectionCard>

          {/* PHP Info */}
          <SectionCard title={t.tabs.php} icon={Code}>
            <div className="space-y-1">
              <InfoRow label={fields.version} value={data.php_config?.version || data.basic_info?.php_version || 'N/A'} highlighted />
              <InfoRow label={fields.memory_limit} value={data.php_config?.memory_limit || 'N/A'} />
              <InfoRow label={fields.max_execution_time} value={data.php_config?.max_execution_time || 'N/A'} />
              <InfoRow label={fields.upload_max_size} value={data.php_config?.upload_max_filesize || 'N/A'} />
              <InfoRow label={fields.post_max_size} value={data.php_config?.post_max_size || 'N/A'} />
              <InfoRow label={fields.timezone} value={data.php_config?.timezone || data.basic_info?.timezone || 'N/A'} />
              <InfoRow label={fields.display_errors} value={data.php_config?.display_errors ? fields.yes : fields.no} />
              {data.php_config?.extensions && data.php_config.extensions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold mb-2 px-4">{fields.extensions}</h4>
                  <div className="flex flex-wrap gap-2 px-4">
                    {data.php_config.extensions.map((ext: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                        {ext}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Laravel Info */}
          <SectionCard title={t.tabs.laravel} icon={Zap}>
            <div className="space-y-1">
              <InfoRow label={fields.version} value={data.basic_info?.laravel_version || 'N/A'} highlighted />
              <InfoRow label={fields.environment} value={data.laravel_info?.environment || 'N/A'} />
              <InfoRow label={fields.debug_mode} value={data.laravel_info?.debug_mode ? fields.yes : fields.no} />
              <InfoRow label={fields.app_url} value={data.laravel_info?.app_url || 'N/A'} />
              <InfoRow label={fields.app_name} value={data.laravel_info?.app_name || 'N/A'} />
              <InfoRow label={fields.timezone} value={data.basic_info?.timezone || 'N/A'} />
              <InfoRow label={fields.locale} value={data.laravel_info?.locale || 'N/A'} />
              {data.laravel_info?.cache_info && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-sm font-semibold mb-2 px-4">{fields.cache_status}</h4>
                  <div className="space-y-1">
                    <InfoRow label={fields.config_cached} value={data.laravel_info.cache_info.config_cached ? fields.yes : fields.no} />
                    <InfoRow label={fields.routes_cached} value={data.laravel_info.cache_info.routes_cached ? fields.yes : fields.no} />
                    <InfoRow label={fields.events_cached} value={data.laravel_info.cache_info.events_cached ? fields.yes : fields.no} />
                    <InfoRow label={fields.views_cached} value={data.laravel_info.cache_info.views_cached ? fields.yes : fields.no} />
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Database Info */}
          <SectionCard title={t.tabs.database} icon={Database}>
            {data.service_status?.mysql ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  {data.service_status.mysql.active ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="font-semibold">MySQL</span>
                  <span className={`px-2 py-1 rounded text-xs ${data.service_status.mysql.active ? commonClasses.badgeSuccess : commonClasses.badgeError}`}>
                    {data.service_status.mysql.active ? fields.active : fields.inactive}
                  </span>
                </div>
                <div className="space-y-1">
                  <InfoRow label={fields.service_name} value={data.service_status.mysql.name || 'mysql'} />
                  <InfoRow label={fields.enabled} value={data.service_status.mysql.enabled ? fields.yes : fields.no} />
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                {fields.not_available}
              </div>
            )}
          </SectionCard>

          {/* Cache Info */}
          <SectionCard title={t.tabs.cache} icon={HardDrive}>
            {data.service_status?.redis ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  {data.service_status.redis.active ? (
                    <CheckCircle className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  <span className="font-semibold">Redis</span>
                  <span className={`px-2 py-1 rounded text-xs ${data.service_status.redis.active ? commonClasses.badgeSuccess : commonClasses.badgeError}`}>
                    {data.service_status.redis.active ? fields.active : fields.inactive}
                  </span>
                </div>
                <div className="space-y-1">
                  <InfoRow label={fields.service_name} value={data.service_status.redis.name || 'redis'} />
                  <InfoRow label={fields.enabled} value={data.service_status.redis.enabled ? fields.yes : fields.no} />
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">
                {fields.not_available}
              </div>
            )}
          </SectionCard>

          {/* Queue Info */}
          <SectionCard title={t.tabs.queue} icon={List}>
            <div className="text-center text-slate-500 py-8">
              {fields.not_available}
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
};

export default SystemInfo;
