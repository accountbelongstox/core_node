import React, { useState, useEffect } from 'react';
import { Globe, CheckCircle2, XCircle, RefreshCw, Clock } from 'lucide-react';
import { apiManager } from '../services/ApiManager';
import { API_ENDPOINTS, ApiEndpoint } from '../config/api-endpoints';
import { useApp } from '../contexts/AppContext';

/**
 * API端点切换器组件
 * 显示当前端点状态，提供手动切换功能
 */
export const ApiEndpointSwitcher: React.FC = () => {
  const { t } = useApp();
  const [currentEndpoint, setCurrentEndpoint] = useState<ApiEndpoint | null>(null);
  const [endpointStatuses, setEndpointStatuses] = useState<Map<string, { isAvailable: boolean; responseTime?: number }>>(new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // 获取当前端点
    const endpoint = apiManager.getCurrentEndpoint();
    setCurrentEndpoint(endpoint);

    // 获取所有端点状态
    const statuses = apiManager.getAllEndpointStatuses();
    const statusMap = new Map();
    statuses.forEach(status => {
      statusMap.set(status.endpoint.id, {
        isAvailable: status.isAvailable,
        responseTime: status.responseTime,
      });
    });
    setEndpointStatuses(statusMap);
  }, []);

  const handleSwitchEndpoint = async (endpointId: string) => {
    const success = apiManager.setEndpoint(endpointId);
    if (success) {
      const endpoint = apiManager.getCurrentEndpoint();
      setCurrentEndpoint(endpoint);
      setIsOpen(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await apiManager.initialize({ autoDetect: true, timeout: 1000 });
    const endpoint = apiManager.getCurrentEndpoint();
    setCurrentEndpoint(endpoint);
    
    // 重新检查所有端点状态
    for (const ep of API_ENDPOINTS) {
      await apiManager.checkEndpoint(ep);
    }
    
    const statuses = apiManager.getAllEndpointStatuses();
    const statusMap = new Map();
    statuses.forEach(status => {
      statusMap.set(status.endpoint.id, {
        isAvailable: status.isAvailable,
        responseTime: status.responseTime,
      });
    });
    setEndpointStatuses(statusMap);
    setIsRefreshing(false);
  };

  const getStatusIcon = (isAvailable: boolean) => {
    return isAvailable ? (
      <CheckCircle2 size={14} className="text-emerald-500" />
    ) : (
      <XCircle size={14} className="text-rose-500" />
    );
  };

  const formatResponseTime = (time?: number) => {
    if (!time) return '-';
    return `${time}ms`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
      >
        <Globe size={16} className="text-slate-600 dark:text-slate-400" />
        <span className="text-slate-700 dark:text-slate-300">
          {currentEndpoint?.description || t('apiEndpoint.notSelected')}
        </span>
        {currentEndpoint && (
          <span className={`w-2 h-2 rounded-full ${
            endpointStatuses.get(currentEndpoint.id)?.isAvailable
              ? 'bg-emerald-500'
              : 'bg-rose-500'
          }`} />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white">{t('apiEndpoint.title')}</h3>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                  title={t('apiEndpoint.refresh')}
                >
                  <RefreshCw
                    size={16}
                    className={`text-slate-600 dark:text-slate-400 ${isRefreshing ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
              {currentEndpoint && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {t('apiEndpoint.currentLabel')} {currentEndpoint.description}
                </div>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto">
              {API_ENDPOINTS.map(endpoint => {
                const status = endpointStatuses.get(endpoint.id);
                const isCurrent = currentEndpoint?.id === endpoint.id;
                const isAvailable = status?.isAvailable ?? false;

                return (
                  <button
                    key={endpoint.id}
                    onClick={() => handleSwitchEndpoint(endpoint.id)}
                    className={`w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-b-0 ${
                      isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getStatusIcon(isAvailable)}
                          <span className={`text-sm font-bold ${
                            isCurrent
                              ? 'text-indigo-600 dark:text-indigo-400'
                              : 'text-slate-800 dark:text-white'
                          }`}>
                            {endpoint.description}
                          </span>
                          {isCurrent && (
                            <span className="px-1.5 py-0.5 bg-indigo-600 text-white text-xs rounded">
                              {t('apiEndpoint.current')}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {endpoint.protocol}://{endpoint.url}
                          {endpoint.port && `:${endpoint.port}`}
                        </div>
                        {status?.responseTime !== undefined && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <Clock size={12} />
                            <span>{formatResponseTime(status.responseTime)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <button
                onClick={() => {
                  apiManager.clearUserSelection();
                  const endpoint = apiManager.getCurrentEndpoint();
                  setCurrentEndpoint(endpoint);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
              >
                {t('apiEndpoint.clearManualSelection')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

