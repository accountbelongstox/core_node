/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Emoji status dots → lucide CircleCheck/CircleX/CircleDashed; phone column max-w-md. Propagate the Iris layer to un-beautified siblings. */
/**
 * API Testing Center - Multi-endpoint testing and monitoring
 */
import React, { useState, useEffect, useCallback } from 'react';
import { CircleCheck, CircleX, CircleDashed } from 'lucide-react';
import { apiManager, HealthCheckResult } from '../services/ApiManager';
import { ApiEndpoint, getAllEndpoints } from '../config/api-endpoints';
import { EventBus } from '../services/EventBus';
import { IconButton, Badge, Icons, Spinner, Button, Portal } from './UI';

export const ApiTestingCenter: React.FC<{ onClose?: () => void; embedded?: boolean }> = ({ onClose, embedded = false }) => {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [healthResults, setHealthResults] = useState<Map<string, HealthCheckResult>>(new Map());
  const [currentEndpoint, setCurrentEndpoint] = useState<ApiEndpoint | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const loadEndpoints = useCallback(async () => {
    const loaded = getAllEndpoints();
    const allEndpoints = Array.isArray(loaded) ? loaded : [];
    setEndpoints(allEndpoints);

    const current = apiManager.getCurrentEndpoint();
    setCurrentEndpoint(current);

    // Load cached health results
    const results = new Map<string, HealthCheckResult>();
    allEndpoints.forEach(endpoint => {
      const result = apiManager.getHealthResult(endpoint.id);
      if (result) {
        results.set(endpoint.id, result);
      }
    });
    setHealthResults(results);
  }, []);

  useEffect(() => {
    loadEndpoints();
  }, [loadEndpoints]);


  const testAllEndpoints = async () => {
    setIsTesting(true);
    try {
      const results = await apiManager.checkAllEndpoints(1500);
      const resultsMap = new Map<string, HealthCheckResult>();
      results.forEach(result => {
        resultsMap.set(result.endpoint.id, result);
      });
      setHealthResults(resultsMap);
    } finally {
      setIsTesting(false);
    }
  };

  const testEndpoint = async (endpoint: ApiEndpoint) => {
    setIsTesting(true);
    try {
      const result = await apiManager.checkEndpoint(endpoint, { timeout: 1500 });
      setHealthResults(prev => new Map(prev).set(endpoint.id, result));
    } finally {
      setIsTesting(false);
    }
  };

  const switchEndpoint = (endpoint: ApiEndpoint) => {
    const success = apiManager.setEndpoint(endpoint.id, true);
    if (success) {
      setCurrentEndpoint(endpoint);

      // Emit event for components that need to react to endpoint change
      EventBus.emit('api-endpoint-changed', { endpointId: endpoint.id });

      console.log('[ApiTestingCenter] Endpoint switched to:', endpoint.id);
    }
  };

  const getStatusIcon = (endpoint: ApiEndpoint) => {
    const result = healthResults.get(endpoint.id);
    if (!result) {
      return <CircleDashed className="w-6 h-6 text-[var(--color-text-tertiary)]" aria-label="Not tested" />;
    }
    return result.isHealthy
      ? <CircleCheck className="w-6 h-6 text-emerald-500" aria-label="Healthy" />
      : <CircleX className="w-6 h-6 text-red-500" aria-label="Failed" />;
  };

  const getStatusText = (endpoint: ApiEndpoint) => {
    const result = healthResults.get(endpoint.id);
    if (!result) return 'Not tested';
    if (!result.isHealthy) return `Failed: ${result.error || 'Unknown error'}`;
    return `${result.responseTime}ms`;
  };

  const content = (
    <div className={`${embedded ? 'w-full ds-card' : 'ds-modal-panel max-w-md mx-auto w-full max-h-[90vh] overflow-hidden'} flex flex-col`}>
      {/* Header — hero banner uses the Iris gradient */}
      <div className="p-6" style={{ background: 'var(--klein-gradient)', color: 'var(--klein-on)', boxShadow: 'var(--klein-grad-glow)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">API Testing Center</h2>
            <p className="opacity-80 mt-1">Multi-endpoint monitoring and testing</p>
          </div>
          {onClose && !embedded && (
            <IconButton
              icon={<Icons.Close />}
              onClick={onClose}
              label="Close"
              className="!text-[var(--klein-on)] hover:!bg-white/15"
            />
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 ds-section-gap">
        {/* Current Endpoint */}
        <div className="p-5 rounded-[var(--radius-card)]" style={{ background: 'var(--klein-blue-soft)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--klein-blue)' }}>
            Current Active Endpoint
          </h3>
          {currentEndpoint ? (
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0">{getStatusIcon(currentEndpoint)}</span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[var(--color-text-primary)] truncate">
                  {currentEndpoint.description}
                </div>
                <div className="text-sm text-[var(--color-text-secondary)] break-all">
                  {currentEndpoint.protocol}://{currentEndpoint.url}
                  {currentEndpoint.port && `:${currentEndpoint.port}`}
                </div>
                <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                  {getStatusText(currentEndpoint)}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-[var(--color-text-secondary)]">No endpoint selected</div>
          )}
        </div>

        {/* Test All Button */}
        <div className="flex gap-3">
          <Button variant="klein" onClick={testAllEndpoints} disabled={isTesting} className="flex-1">
            {isTesting ? <><Spinner size="sm" /> Testing...</> : 'Test All Endpoints'}
          </Button>
          <Button variant="secondary" onClick={loadEndpoints} className="!w-auto px-6">
            Refresh
          </Button>
        </div>

        {/* Endpoints List */}
        <div>
          <h3 className="ds-section-label mb-4">
            All Endpoints (Priority Order)
          </h3>
          <div className="ds-stack-tight flex flex-col">
            {(Array.isArray(endpoints) ? endpoints : []).map(endpoint => {
              const result = healthResults.get(endpoint.id);
              const isCurrent = currentEndpoint?.id === endpoint.id;

              return (
                <div
                  key={endpoint.id}
                  className={`ds-row p-4 transition ${isCurrent ? 'ds-active' : ''}`}
                  style={isCurrent ? { borderColor: 'var(--klein-ring)' } : undefined}
                >
                  <div className="flex items-start gap-3 flex-wrap">
                    <span className="flex-shrink-0">{getStatusIcon(endpoint)}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[var(--color-text-primary)] break-words">
                          {endpoint.description}
                        </span>
                        <Badge tone="klein">P{endpoint.priority}</Badge>
                        {endpoint.isLocal && <Badge tone="success">LOCAL</Badge>}
                        {isCurrent && <Badge tone="klein">ACTIVE</Badge>}
                      </div>
                      <div className="text-sm text-[var(--color-text-secondary)] mt-1 break-all">
                        {endpoint.protocol}://{endpoint.url}
                        {endpoint.port && `:${endpoint.port}`}
                      </div>
                      <div className="text-xs text-[var(--color-text-tertiary)] mt-1 break-words">
                        {getStatusText(endpoint)}
                      </div>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button variant="secondary" onClick={() => testEndpoint(endpoint)} disabled={isTesting} className="flex-1 sm:!w-auto px-4 !py-2 text-sm">
                        Test
                      </Button>
                      {!isCurrent && (
                        <Button variant="klein" onClick={() => switchEndpoint(endpoint)} className="flex-1 sm:!w-auto px-4 !py-2 text-sm">
                          Switch
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[var(--border-highlight)] p-4">
        <div className="text-xs text-[var(--color-text-tertiary)] space-y-1">
          <div>Green = Healthy | Red = Failed | Gray = Not tested</div>
          <div>Switching endpoint updates API requests without reloading</div>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="w-full">
        {content}
      </div>
    );
  }

  return (
    <Portal>
      <div className="ds-modal-backdrop fixed inset-0 flex items-center justify-center ds-z-modal p-4" role="dialog" aria-modal="true" aria-label="API Testing Center">
        {content}
      </div>
    </Portal>
  );
};
