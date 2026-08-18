import React, { useState, useEffect, useRef } from 'react';
import { Server, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { apiManager, HealthCheckResult } from '@/core/integrations/laravel/ApiManager';
import { recheckApiEndpointsNow } from '@/apps/laravel-manager/services/ApiHealthRecheck';
import { BackendApiEndpoint } from '@/core/integrations/laravel/LaravelEndpoints';
import Portal from '@/shared/ui/Portal';
import { logError, logSuccess } from '@/core/logstore/logStore';

/**
 * Top-header API endpoint switcher.
 *
 * The dropdown is PORTALED to <body> (fixed-position, anchored to the trigger
 * button's rect). It used to render inline with `absolute … z-50`, which any
 * ancestor stacking/overflow context (sticky header backdrop-blur, the main
 * column's overflow-x-hidden) could clip or trap — the "click but no menu
 * appears" bug. Portaling is this project's standard overlay fix.
 *
 * Switching uses apiManager.switchEndpoint(): the target is PROBED first;
 * only a healthy endpoint is persisted + applied (then the page reloads for a
 * clean state). A dead target changes nothing and shows an inline error — so
 * the app can never be parked on an unreachable endpoint by a click.
 */
export const ApiEndpointSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<BackendApiEndpoint | null>(null);
  const [endpoints, setEndpoints] = useState<BackendApiEndpoint[]>([]);
  const [healthResults, setHealthResults] = useState<Map<string, HealthCheckResult>>(new Map());
  const [probing, setProbing] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [intervalSec, setIntervalSec] = useState(() => Math.round(apiManager.getRecheckIntervalMs() / 1000));
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize endpoints from ApiManager
    loadEndpoints();

    // Listen for the global health-check-completed event; only update local state, do not trigger new network requests
    const handleHealthInitialized = () => {
      loadEndpoints();
    };

    window.addEventListener('api-health-initialized', handleHealthInitialized);
    // Custom endpoints added/removed in Settings — refresh the list live so the
    // header switcher and Settings stay in sync (both read the merged list).
    window.addEventListener('api-endpoints-changed', handleHealthInitialized);

    return () => {
      window.removeEventListener('api-health-initialized', handleHealthInitialized);
      window.removeEventListener('api-endpoints-changed', handleHealthInitialized);
    };
  }, []);

  // Click outside (button AND portaled menu) closes the dropdown. The menu is
  // portaled to <body>, so a single container ref is not enough.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  // Detection runs AUTOMATICALLY at startup (App.tsx) as a STORED-FIRST pass.
  // Opening the dropdown never triggers a probe — health results come from
  // the startup pass, the all-Offline retry loop and the Re-detect button.
  const handleToggleOpen = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8,
        right: Math.max(8, window.innerWidth - rect.right)
      });
    }
    setSwitchError(null);
    setIsOpen(prev => !prev);
  };

  // Manual re-detect: same stored-first pass (current endpoint only → full
  // sweep just when it's down); also (re)starts the offline retry loop when
  // everything is still down.
  const handleRecheck = async () => {
    if (probing) return;
    setProbing(true);
    try {
      await recheckApiEndpointsNow();
    } finally {
      setProbing(false);
      loadEndpoints();
    }
  };

  // Persist the per-end retry interval; the loop reads it fresh on every
  // tick, so it applies without restart. Re-read after set to reflect clamping.
  const commitInterval = () => {
    apiManager.setRecheckIntervalMs(intervalSec * 1000);
    setIntervalSec(Math.round(apiManager.getRecheckIntervalMs() / 1000));
  };

  const loadEndpoints = () => {
    setCurrentEndpoint(apiManager.getCurrentEndpoint());
    setEndpoints(apiManager.getAllEndpoints());

    // Load existing health check results (if ApiManager has already completed detection)
    const results = new Map<string, HealthCheckResult>();
    apiManager.getAllHealthResults().forEach(result => {
      results.set(result.endpoint.id, result);
    });
    setHealthResults(results);
  };

  /**
   * Probe-before-switch. Healthy → persist + reload (guaranteed to land on a
   * working endpoint). Dead → nothing changes, inline error stays visible.
   */
  const selectEndpoint = async (endpointId: string) => {
    if (switching) return;
    if (endpointId === currentEndpoint?.id) {
      setIsOpen(false);
      return;
    }
    setSwitching(endpointId);
    setSwitchError(null);
    try {
      const res = await apiManager.switchEndpoint(endpointId);
      if (res.ok) {
        logSuccess('api', `Switched endpoint to ${res.endpoint?.description ?? endpointId}`);
        setIsOpen(false);
        // Reload for a clean page state — target verified reachable above.
        window.location.reload();
      } else {
        const desc = res.endpoint?.description ?? endpointId;
        const reason = res.result?.error ?? 'health check failed';
        logError('api', `Endpoint switch to ${desc} refused — ${reason}; kept ${currentEndpoint?.description ?? 'current endpoint'}`);
        setSwitchError(`${desc} is unreachable (${reason}). Kept the current endpoint.`);
        loadEndpoints();
      }
    } finally {
      setSwitching(null);
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
      {/* Switcher Button */}
      <button
        ref={buttonRef}
        onClick={handleToggleOpen}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg transition-all
          text-slate-600 dark:text-slate-300
          hover:bg-black/5 dark:hover:bg-white/10
          border border-transparent
          ${currentHealth?.isHealthy ? 'hover:border-emerald-500/20' : currentHealth ? 'hover:border-red-500/20' : 'hover:border-slate-300/40'}
        `}
        title="Switch API Endpoint"
      >
        {/* Health Status Dot */}
        <span className={`
          w-2 h-2 rounded-full transition-all
          ${currentHealth?.isHealthy
            ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
            : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
          }
        `} />

        {/* Server Icon */}
        <Server size={16} />

        {/* Endpoint Info */}
        <div className="flex flex-col items-start text-xs">
          <span className="font-medium">
            {currentEndpoint?.description.split(' ')[0] || 'API'}
          </span>
          {currentHealth && (
            <span className={`text-[10px] font-medium ${currentHealth.isHealthy ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {currentHealth.isHealthy ? `✓ ${currentHealth.responseTime}ms` : '✗ Unavailable'}
            </span>
          )}
          {!currentHealth && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              Manual endpoint selection
            </span>
          )}
        </div>

        {/* Dropdown Arrow */}
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu — portaled to <body> so no ancestor stacking/overflow
          context can clip it (the old inline `absolute` menu sometimes never
          became visible). z-[900]: above chrome, below OVERLAY_Z overlays. */}
      {isOpen && menuPos && (
        <Portal lockScroll={false}>
          <div
            ref={menuRef}
            style={{ top: menuPos.top, right: menuPos.right }}
            className="
              fixed w-80 z-[900]
              bg-white dark:bg-slate-800
              border border-slate-200 dark:border-slate-700
              rounded-lg shadow-xl
              overflow-hidden
            "
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
                  API Endpoints
                </h3>
                <button
                  onClick={handleRecheck}
                  disabled={probing}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium
                    text-indigo-600 dark:text-indigo-400
                    hover:bg-indigo-50 dark:hover:bg-indigo-900/30
                    disabled:opacity-50 transition-all"
                  title="Re-detect: checks the current endpoint first; sweeps all endpoints only if it is down"
                >
                  <RefreshCw size={12} className={probing ? 'animate-spin' : ''} />
                  Re-detect
                </button>
              </div>
            </div>

            {/* Endpoints List */}
            <div className="max-h-80 overflow-y-auto">
              {endpoints.map((endpoint) => {
                const health = getHealth(endpoint.id);
                const isCurrent = currentEndpoint?.id === endpoint.id;
                const isSwitching = switching === endpoint.id;

                return (
                  <button
                    key={endpoint.id}
                    onClick={() => selectEndpoint(endpoint.id)}
                    disabled={switching !== null}
                    className={`
                      w-full px-4 py-3 text-left transition-all
                      flex items-center justify-between gap-3
                      hover:bg-slate-50 dark:hover:bg-slate-700/50
                      disabled:opacity-60
                      ${isCurrent ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}
                    `}
                  >
                    {/* Left: Endpoint Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Priority Badge */}
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

                      {/* Endpoint Details */}
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

                    {/* Right: switching spinner OR last health result */}
                    {isSwitching ? (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <RefreshCw size={12} className="animate-spin text-indigo-500" />
                        <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          Testing…
                        </span>
                      </div>
                    ) : health ? (
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
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 space-y-2">
              {switchError && (
                <div className="flex items-start gap-1.5 text-[11px] text-red-600 dark:text-red-400">
                  <AlertTriangle size={12} className="flex-shrink-0 mt-px" />
                  <span>{switchError}</span>
                </div>
              )}
              {/* Offline retry interval — only ticks while ALL endpoints are Offline */}
              <div className="flex items-center justify-between gap-2">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">
                  Offline recheck interval
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={5}
                    step={5}
                    value={intervalSec}
                    onChange={(e) => setIntervalSec(Number(e.target.value))}
                    onBlur={commitInterval}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitInterval(); }}
                    className="w-16 px-1.5 py-0.5 text-xs text-right rounded border
                      border-slate-300 dark:border-slate-600
                      bg-white dark:bg-slate-800
                      text-slate-700 dark:text-slate-200"
                  />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">s</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Endpoints are verified before switching; an unreachable endpoint is never applied.
              </p>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};
