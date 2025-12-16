/**
 * API Testing Center - Multi-endpoint testing and monitoring
 */

import React, { useState, useEffect } from 'react';
import { apiManager, HealthCheckResult } from '../services/ApiManager';
import { ApiEndpoint, getAllEndpoints } from '../config/api-endpoints';

export const ApiTestingCenter: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [healthResults, setHealthResults] = useState<Map<string, HealthCheckResult>>(new Map());
  const [currentEndpoint, setCurrentEndpoint] = useState<ApiEndpoint | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    loadEndpoints();
  }, []);

  const loadEndpoints = async () => {
    const allEndpoints = getAllEndpoints();
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
  };

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
      // Trigger page refresh to use new endpoint
      window.location.reload();
    }
  };

  const getStatusIcon = (endpoint: ApiEndpoint) => {
    const result = healthResults.get(endpoint.id);
    if (!result) return '⚪';
    return result.isHealthy ? '🟢' : '🔴';
  };

  const getStatusText = (endpoint: ApiEndpoint) => {
    const result = healthResults.get(endpoint.id);
    if (!result) return 'Not tested';
    if (!result.isHealthy) return `Failed: ${result.error || 'Unknown error'}`;
    return `${result.responseTime}ms`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">API Testing Center</h2>
              <p className="text-blue-100 mt-1">Multi-endpoint monitoring and testing</p>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Current Endpoint */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Current Active Endpoint
            </h3>
            {currentEndpoint ? (
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getStatusIcon(currentEndpoint)}</span>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {currentEndpoint.description}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {currentEndpoint.protocol}://{currentEndpoint.url}
                    {currentEndpoint.port && `:${currentEndpoint.port}`}
                  </div>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {getStatusText(currentEndpoint)}
                </div>
              </div>
            ) : (
              <div className="text-gray-600 dark:text-gray-400">No endpoint selected</div>
            )}
          </div>

          {/* Test All Button */}
          <div className="mb-4 flex gap-3">
            <button
              onClick={testAllEndpoints}
              disabled={isTesting}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-semibold py-3 px-6 rounded-xl transition"
            >
              {isTesting ? '⏳ Testing...' : '🔍 Test All Endpoints'}
            </button>
            <button
              onClick={loadEndpoints}
              className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-3 px-6 rounded-xl transition"
            >
              🔄 Refresh
            </button>
          </div>

          {/* Endpoints List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              All Endpoints (Priority Order)
            </h3>
            {endpoints.map(endpoint => {
              const result = healthResults.get(endpoint.id);
              const isCurrent = currentEndpoint?.id === endpoint.id;

              return (
                <div
                  key={endpoint.id}
                  className={`p-4 rounded-xl border-2 transition ${
                    isCurrent
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getStatusIcon(endpoint)}</span>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {endpoint.description}
                        </span>
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                          P{endpoint.priority}
                        </span>
                        {endpoint.isLocal && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-1 rounded">
                            LOCAL
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {endpoint.protocol}://{endpoint.url}
                        {endpoint.port && `:${endpoint.port}`}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {getStatusText(endpoint)}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => testEndpoint(endpoint)}
                        disabled={isTesting}
                        className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-gray-800 dark:text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition"
                      >
                        Test
                      </button>
                      {!isCurrent && (
                        <button
                          onClick={() => switchEndpoint(endpoint)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                        >
                          Switch
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div>🟢 Green = Healthy | 🔴 Red = Failed | ⚪ Gray = Not tested</div>
            <div>Switching endpoint will reload the application</div>
          </div>
        </div>
      </div>
    </div>
  );
};
