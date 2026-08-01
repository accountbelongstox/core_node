import React from 'react';
import {
  ServerRuntimeSystemInfo,
  AsyncState,
  Language,
  SystemServiceStatus,
  SystemStorage,
  SystemProcess,
  StaticResourcesSummary
} from '../../../apps/laravel-manager/uiTypes';
import { TRANSLATIONS } from '../../../constants';
import { commonClasses } from '../../../styles/theme';
import { LoadingBlock, AlertBox, StatusBadge } from '../../common';
import StaticResourcesPanel from './StaticResourcesPanel';

interface SystemPanelProps {
  lang: Language;
  systemInfo: AsyncState<ServerRuntimeSystemInfo>;
  servicesSummary: any;
  systemServices: AsyncState<SystemServiceStatus[]>;
  systemStorage: AsyncState<SystemStorage[]>;
  systemProcesses: AsyncState<SystemProcess[]>;
  staticResources: AsyncState<StaticResourcesSummary>;
  onRefreshStaticResources: () => void;
  onOpenMedia?: () => void;
}

const SystemPanel: React.FC<SystemPanelProps> = ({
  lang,
  systemInfo,
  servicesSummary,
  systemServices,
  systemStorage,
  systemProcesses,
  staticResources,
  onRefreshStaticResources,
  onOpenMedia
}) => {
  const t = TRANSLATIONS[lang].server;

  return (
    <div className="space-y-4">
      <StaticResourcesPanel
        lang={lang}
        staticResources={staticResources}
        systemStorage={systemStorage}
        onRefresh={onRefreshStaticResources}
        onOpenMedia={onOpenMedia}
      />

      {systemInfo.loading && (
        <LoadingBlock />
      )}
      {systemInfo.error && (
        <AlertBox variant="error">{systemInfo.error}</AlertBox>
      )}
      {systemInfo.data && systemInfo.data.cpu && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`${commonClasses.card} p-4`}>
            <h3 className="font-semibold mb-3">{t.system.cpu}</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">Usage</span>
                <span className="text-sm font-mono">{systemInfo.data.cpu?.usage || 0}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-2 rounded-full transition-all"
                  style={{ width: `${systemInfo.data.cpu?.usage || 0}%` }}
                />
              </div>
            </div>
          </div>
          {systemInfo.data.memory && (
            <div className={`${commonClasses.card} p-4`}>
              <h3 className="font-semibold mb-3">{t.system.memory}</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Usage</span>
                  <span className="text-sm font-mono">{systemInfo.data.memory?.percentage || 0}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${systemInfo.data.memory?.percentage || 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          {systemInfo.data.disk && (
            <div className={`${commonClasses.card} p-4`}>
              <h3 className="font-semibold mb-3">{t.system.disk}</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Usage</span>
                  <span className="text-sm font-mono">{systemInfo.data.disk?.percentage || 0}%</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${systemInfo.data.disk?.percentage || 0}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Services Summary */}
      {servicesSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className={`${commonClasses.card} p-4 bg-blue-50 dark:bg-blue-900/20`}>
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">System Services</h4>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {servicesSummary.system_running} / {servicesSummary.system_total}
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Running</p>
          </div>
          <div className={`${commonClasses.card} p-4 bg-purple-50 dark:bg-purple-900/20`}>
            <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">Octane Services</h4>
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {servicesSummary.octane_running} / {servicesSummary.octane_total}
            </div>
            <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Running</p>
          </div>
          <div className={`${commonClasses.card} p-4 bg-green-50 dark:bg-green-900/20`}>
            <h4 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">Application Services</h4>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {servicesSummary.apps_running} / {servicesSummary.apps_total}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Running</p>
          </div>
        </div>
      )}

      {/* System Services */}
      {systemServices.data && systemServices.data.length > 0 && (
        <div className={`${commonClasses.card} p-4`}>
          <h3 className="font-semibold mb-3">{t.system.services} ({systemServices.data.length})</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {systemServices.data.map((service, idx) => (
              <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      service.status === 'running' ? 'bg-green-500' :
                      service.status === 'stopped' ? 'bg-slate-400' :
                      'bg-red-500'
                    }`} />
                    <span className="text-sm font-medium">{service.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={service.status}
                      tone={service.status === 'running' ? 'success' : service.status === 'stopped' ? 'idle' : 'error'}
                      withDot={false}
                    />
                    {service.enabled !== undefined && (
                      <span className={`text-xs px-2 py-1 rounded ${
                        service.enabled
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                      }`}>
                        {service.enabled ? 'Auto-start: ON' : 'Auto-start: OFF'}
                      </span>
                    )}
                  </div>
                </div>
                {service.status_output && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200">
                      View detailed status
                    </summary>
                    <pre className="mt-2 text-xs bg-slate-900 text-green-400 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto">
                      {service.status_output}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Storage */}
      {systemStorage.data && systemStorage.data.length > 0 && (
        <div className={`${commonClasses.card} p-4`}>
          <h3 className="font-semibold mb-3">{t.system.storage}</h3>
          <div className="space-y-2">
            {systemStorage.data.map((storage, idx) => (
              <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-800 rounded">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{storage.filesystem}</span>
                  <span className="text-xs text-slate-500">{storage.use_percent}</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 mb-1">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: storage.use_percent }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{storage.used} / {storage.size}</span>
                  <span>{storage.available} available</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">Mounted on: {storage.mounted_on}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Processes */}
      {systemProcesses.data && systemProcesses.data.length > 0 && (
        <div className={`${commonClasses.card} p-4`}>
          <h3 className="font-semibold mb-3">{t.system.processes}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left p-2">PID</th>
                  <th className="text-left p-2">User</th>
                  <th className="text-right p-2">CPU %</th>
                  <th className="text-right p-2">Memory %</th>
                  <th className="text-left p-2">Command</th>
                </tr>
              </thead>
              <tbody>
                {systemProcesses.data.slice(0, 20).map((process, idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="p-2 font-mono text-xs">{process.pid}</td>
                    <td className="p-2">{process.user}</td>
                    <td className="p-2 text-right">{process.cpu}%</td>
                    <td className="p-2 text-right">{process.memory}%</td>
                    <td className="p-2 font-mono text-xs truncate max-w-xs">{process.command}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemPanel;
