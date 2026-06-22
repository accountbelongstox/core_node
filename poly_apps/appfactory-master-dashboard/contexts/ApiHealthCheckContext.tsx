import React, { createContext, useContext, ReactNode } from 'react';
import { useInterval } from '../hooks/useInterval';
import { apiManager } from '../services/ApiManager';
import { storageService } from '../services/storageService';
import { getEndpointById, API_ENDPOINTS } from '../config/api-endpoints';
import { STORAGE_KEYS } from '../services/storageService';

/**
 * API Health Check Context
 * Uses React Hook useInterval instead of manual setInterval
 * Automatically checks endpoint health and switches to higher priority endpoints
 */

interface ApiHealthCheckContextType {
  // Context provides health check functionality
  // Actual checking is done automatically via useInterval hook
}

const ApiHealthCheckContext = createContext<ApiHealthCheckContextType>({});

export const ApiHealthCheckProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Use React Hook instead of manual setInterval
  useInterval(() => {
    // Skip if user manually selected an endpoint (respect user choice)
    const userSelectedId = storageService.get<string>(STORAGE_KEYS.API_USER_SELECTED);
    if (userSelectedId) {
      // Still check if user-selected endpoint is available
      const userEndpoint = getEndpointById(userSelectedId);
      if (userEndpoint) {
        apiManager.checkEndpoint(userEndpoint).then((isAvailable) => {
          if (!isAvailable) {
            console.warn(`[ApiHealthCheck] User-selected endpoint unavailable: ${userEndpoint.description}`);
          }
        });
      }
      return; // Don't auto-switch if user manually selected
    }

    // Check all endpoints in priority order to find best available
    const sortedEndpoints = [...API_ENDPOINTS].sort((a, b) => a.priority - b.priority);
    let bestAvailableEndpoint: typeof API_ENDPOINTS[0] | null = null;

    // Test endpoints in priority order: 127.0.0.1 → LAN → Remote
    (async () => {
      for (const endpoint of sortedEndpoints) {
        const isAvailable = await apiManager.checkEndpoint(endpoint, 1000, '/');
        if (isAvailable) {
          bestAvailableEndpoint = endpoint;
          break; // Found highest priority available endpoint
        }
      }

      if (!bestAvailableEndpoint) {
        // No endpoints available, enable mock mode
        if (!apiManager.isMockMode()) {
          console.warn('[ApiHealthCheck] No endpoints available, enabling mock mode');
          apiManager.enableMockMode();
        }
        return;
      }

      // Check if we should switch to higher priority endpoint
      const currentEndpoint = apiManager.getCurrentEndpoint();
      const currentPriority = currentEndpoint?.priority ?? 999;
      const bestPriority = bestAvailableEndpoint.priority;

      if (bestPriority < currentPriority) {
        // Found higher priority endpoint, switch to it
        console.log(
          `[ApiHealthCheck] Switching to higher priority endpoint: ` +
          `${bestAvailableEndpoint.description} (Priority ${bestPriority}) ` +
          `replacing ${currentEndpoint?.description} (Priority ${currentPriority})`
        );
        apiManager.setEndpoint(bestAvailableEndpoint.id);
      } else if (currentEndpoint?.id !== bestAvailableEndpoint.id) {
        // Current endpoint unavailable but we found a replacement
        console.log(
          `[ApiHealthCheck] Current endpoint unavailable, switching to: ${bestAvailableEndpoint.description}`
        );
        apiManager.setEndpoint(bestAvailableEndpoint.id);
      }
    })();
  }, 60000); // Check every 60 seconds

  return (
    <ApiHealthCheckContext.Provider value={{}}>
      {children}
    </ApiHealthCheckContext.Provider>
  );
};

export const useApiHealthCheck = (): ApiHealthCheckContextType => {
  return useContext(ApiHealthCheckContext);
};

