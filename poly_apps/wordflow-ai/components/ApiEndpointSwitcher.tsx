import React, { useState, useEffect, useRef } from 'react';
import { Server, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { apiManager, HealthCheckResult } from '../services/ApiManager';
import { ApiEndpoint } from '../config/api-endpoints';
import { EventBus } from '../services/EventBus';

export const ApiEndpointSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<ApiEndpoint | null>(null);
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [healthResults, setHealthResults] = useState<Map<string, HealthCheckResult>>(new Map());
  const [isChecking, setIsChecking] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadEndpoints();
    checkAllHealth();

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadEndpoints = () => {
    setCurrentEndpoint(apiManager.getCurrentEndpoint());
    setEndpoints(apiManager.getAllEndpoints());

    const results = new Map<string, HealthCheckResult>();
    apiManager.getAllHealthResults().forEach(result => {
      results.set(result.endpoint.id, result);
    });
    setHealthResults(results);
  };

  const checkAllHealth = async () => {
    setIsChecking(true);
    try {
      const results = await apiManager.checkAllEndpoints();
      const resultsMap = new Map<string, HealthCheckResult>();
      results.forEach(result => {
        resultsMap.set(result.endpoint.id, result);
      });
      setHealthResults(resultsMap);
    } finally {
      setIsChecking(false);
    }
  };

  const selectEndpoint = (endpointId: string) => {
    const success = apiManager.setEndpoint(endpointId, true);
    if (success) {
      setCurrentEndpoint(apiManager.getCurrentEndpoint());
      setIsOpen(false);

      // Emit event for components that need to react to endpoint change
      EventBus.emit('api-endpoint-changed', { endpointId });

      console.log('[ApiEndpointSwitcher] Endpoint changed to:', endpointId);
    }
  };

  const getCurrentHealth = (): HealthCheckResult | undefined => {
    if (!currentEndpoint) return undefined;
    return healthResults.get(currentEndpoint.id);
  };

  const getHealth = (endpointId: string): HealthCheckResult | undefined => {
    return healthResults.get(endpointId);
  };

  const currentHealth = getCurrentHealth();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg transition-all
          text-slate-600 dark:text-slate-300
          hover:bg-black/5 dark:hover:bg-white/10
          border border-transparent
          ${currentHealth?.isHealthy ? 'hover:border-emerald-500/20' : 'hover:border-red-500/20'}
        `}
        title="Switch API Endpoint"
      >
        <span className={`
          w-2 h-2 rounded-full transition-all
          ${currentHealth?.isHealthy
            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
            : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
          }
        `} />

        <Server size={16} />

        <div className="flex flex-col items-start text-xs">
          <span className="font-medium">
            {currentEndpoint?.description.split(' ')[0] || 'API'}
          </span>
          {currentHealth ? (
            <span className={`text-[10px] font-medium ${currentHealth.isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {currentHealth.isHealthy ? `✓ ${currentHealth.responseTime}ms` : '✗ Unavailable'}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Checking...</span>
          )}
        </div>

        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="
          absolute right-0 top-full mt-2 w-80
          bg-white dark:bg-slate-800
          border border-slate-200 dark:border-slate-700
          rounded-lg shadow-xl
          overflow-hidden
          z-50
        ">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                API Endpoints
              </h3>
              <button
                onClick={checkAllHealth}
                disabled={isChecking}
                className="
                  p-1.5 rounded-md
                  text-slate-500 hover:text-indigo-600
                  dark:text-slate-400 dark:hover:text-indigo-400
                  hover:bg-slate-100 dark:hover:bg-slate-700
                  transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                "
                title="Refresh Health Check"
              >
                <RefreshCw size={14} className={isChecking ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {endpoints.map((endpoint) => {
              const health = getHealth(endpoint.id);
              const isCurrent = currentEndpoint?.id === endpoint.id;

              return (
                <button
                  key={endpoint.id}
                  onClick={() => selectEndpoint(endpoint.id)}
                  className={`
                    w-full px-4 py-3 text-left transition-all
                    flex items-center justify-between gap-3
                    hover:bg-slate-50 dark:hover:bg-slate-700/50
                    ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}
                  `}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="
                      w-6 h-6 rounded-full
                      flex items-center justify-center
                      bg-slate-200 dark:bg-slate-700
                      text-[10px] font-bold
                      text-slate-600 dark:text-slate-300
                      flex-shrink-0
                    ">
                      {endpoint.priority}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-white truncate">
                          {endpoint.description}
                        </span>
                        {isCurrent && (
                          <Check size={14} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`
                          text-[10px] uppercase font-bold px-1.5 py-0.5 rounded
                          ${endpoint.protocol === 'https'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                          }
                        `}>
                          {endpoint.protocol}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {endpoint.url}{endpoint.port ? `:${endpoint.port}` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {health && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {health.isHealthy ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                            {health.responseTime}ms
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                            Offline
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Selected endpoint will be saved and used for all API requests
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
