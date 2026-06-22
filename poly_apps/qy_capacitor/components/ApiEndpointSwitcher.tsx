/* [v4.1-Iris] Endpoint switcher panel converted from an anchored Popover to a
   bottom Sheet (modal): backdrop dims + blocks background scroll/touch, sits at
   z-modal (above the bottom island/chrome), closes on backdrop tap, full-width
   (no left-edge clipping). Fixes the stacking / pass-through / can't-close bugs. */
import React, { useState, useEffect } from 'react';
import { Server, RefreshCw, Check, X, ChevronDown } from 'lucide-react';
import { apiManager, HealthCheckResult } from '../services/ApiManager';
import { ApiEndpoint } from '../config/api-endpoints';
import { EventBus } from '../services/EventBus';
import { IconButton, Badge, Sheet } from './UI';

export const ApiEndpointSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<ApiEndpoint | null>(null);
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [healthResults, setHealthResults] = useState<Map<string, HealthCheckResult>>(new Map());
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    loadEndpoints();
    checkAllHealth();
    // outside-click / Escape handled by <Popover>
  }, []);

  const loadEndpoints = () => {
    setCurrentEndpoint(apiManager.getCurrentEndpoint());
    const loaded = apiManager.getAllEndpoints();
    setEndpoints(Array.isArray(loaded) ? loaded : []);

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
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-full transition-all ds-touch-target
          ds-glass ds-glass-edge border border-[var(--border-highlight)] text-[var(--color-text-secondary)]
          hover:opacity-90 active:scale-[0.98]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--klein-ring)]
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
            <span className={`flex items-center gap-1 text-[10px] font-medium ${currentHealth.isHealthy ? 'text-emerald-500' : 'text-red-500'}`}>
              {currentHealth.isHealthy ? (
                <><Check size={10} aria-hidden /> {currentHealth.responseTime}ms</>
              ) : (
                <><X size={10} aria-hidden /> Unavailable</>
              )}
            </span>
          ) : (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">Checking...</span>
          )}
        </div>

        <ChevronDown
          size={12}
          aria-hidden
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <Sheet
        open={isOpen}
        onClose={() => setIsOpen(false)}
        position="bottom"
        panelClassName="!p-0 max-h-[85vh] flex flex-col overflow-hidden"
      >
          {/* grab handle */}
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <span className="w-10 h-1.5 rounded-full bg-[var(--color-text-tertiary)] opacity-30" />
          </div>

          <div className="px-5 py-3 border-b border-[var(--border-highlight)] flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--color-text-primary)]">
                API Endpoints
              </h3>
              <IconButton
                icon={<RefreshCw size={16} className={isChecking ? 'animate-spin' : ''} />}
                onClick={checkAllHealth}
                disabled={isChecking}
                label="Refresh Health Check"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2">
            {(Array.isArray(endpoints) ? endpoints : []).map((endpoint) => {
              const health = getHealth(endpoint.id);
              const isCurrent = currentEndpoint?.id === endpoint.id;

              return (
                <button
                  key={endpoint.id}
                  onClick={() => selectEndpoint(endpoint.id)}
                  className={`ds-row w-full p-4 text-left transition-all flex items-center justify-between gap-3 ${isCurrent ? 'ds-active' : ''}`}
                  style={isCurrent ? { borderColor: 'var(--klein-ring)' } : undefined}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={isCurrent
                        ? { background: 'var(--klein-blue)', color: 'var(--klein-on)' }
                        : { background: 'var(--klein-blue-soft)', color: 'var(--klein-blue)' }}
                    >
                      {endpoint.priority}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {endpoint.description}
                        </span>
                        {isCurrent && (
                          <Check size={14} className="flex-shrink-0" style={{ color: 'var(--klein-blue)' }} />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge tone={endpoint.protocol === 'https' ? 'success' : 'klein'}>
                          {endpoint.protocol}
                        </Badge>
                        <span className="text-xs text-[var(--color-text-tertiary)] truncate">
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
                          <span className="text-xs text-emerald-500 font-medium">
                            {health.responseTime}ms
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-xs text-red-500 font-medium">
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

          <div
            className="px-5 py-3 border-t border-[var(--border-highlight)] flex-shrink-0"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              Selected endpoint will be saved and used for all API requests
            </p>
          </div>
      </Sheet>
    </div>
  );
};
