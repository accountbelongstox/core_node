/**
 * Global API Endpoints Plugin
 *
 * Initializes API endpoints globally and makes them available throughout the app
 */

import { ref } from 'vue';
import type { ApiEndpoint } from '@/common/config/api-endpoints';
import { GLOBAL_API_ENDPOINTS, buildApiUrl, getEndpointsByPriority } from '@/common/config/api-endpoints';
import type { EndpointHealth } from '@/common/composables/useApiEndpoints';

const HEALTH_CACHE_KEY = 'api_endpoints_health';
const ACTIVE_ENDPOINT_KEY = 'active_api_endpoint';

export default defineNuxtPlugin((nuxtApp) => {
  const endpointsHealth = ref<Map<string, EndpointHealth>>(new Map());
  const activeEndpointId = ref<string | null>(null);
  const isChecking = ref(false);
  let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Load cached health status from localStorage
   */
  const loadHealthCache = () => {
    if (typeof window === 'undefined') return;

    try {
      const cached = localStorage.getItem(HEALTH_CACHE_KEY);
      const activeId = localStorage.getItem(ACTIVE_ENDPOINT_KEY);

      if (cached) {
        const healthData = JSON.parse(cached);
        endpointsHealth.value = new Map(Object.entries(healthData));
      }

      if (activeId) {
        activeEndpointId.value = activeId;
      }
    } catch (error) {
      console.error('Failed to load endpoint health cache:', error);
    }
  };

  /**
   * Save health status to localStorage
   */
  const saveHealthCache = () => {
    if (typeof window === 'undefined') return;

    try {
      const healthObj = Object.fromEntries(endpointsHealth.value);
      localStorage.setItem(HEALTH_CACHE_KEY, JSON.stringify(healthObj));

      if (activeEndpointId.value) {
        localStorage.setItem(ACTIVE_ENDPOINT_KEY, activeEndpointId.value);
      }
    } catch (error) {
      console.error('Failed to save endpoint health cache:', error);
    }
  };

  /**
   * Check single endpoint health status
   */
  const checkEndpointHealth = async (endpoint: ApiEndpoint): Promise<EndpointHealth> => {
    const startTime = Date.now();

    try {
      const url = buildApiUrl(endpoint, 'api/health');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), GLOBAL_API_ENDPOINTS.timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // Any HTTP response (including 404, 403, etc.) means server is reachable
      return {
        endpointId: endpoint.id,
        isHealthy: true,
        lastChecked: Date.now(),
        responseTime,
        errorMessage: response.ok ? undefined : `HTTP ${response.status} (Server reachable)`
      };
    } catch (error) {
      return {
        endpointId: endpoint.id,
        isHealthy: false,
        lastChecked: Date.now(),
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  /**
   * Check all endpoints health status (concurrent)
   */
  const checkAllEndpoints = async () => {
    if (isChecking.value) return;

    isChecking.value = true;

    try {
      const endpoints = getEndpointsByPriority();
      const healthChecks = await Promise.all(
        endpoints.map(endpoint => checkEndpointHealth(endpoint))
      );

      // Update health status
      healthChecks.forEach(health => {
        endpointsHealth.value.set(health.endpointId, health);
      });

      // Auto-switch to healthy endpoint if current is unhealthy
      if (activeEndpointId.value) {
        const currentHealth = endpointsHealth.value.get(activeEndpointId.value);
        if (!currentHealth?.isHealthy) {
          selectBestEndpoint();
        }
      } else {
        selectBestEndpoint();
      }

      saveHealthCache();
    } finally {
      isChecking.value = false;
    }
  };

  /**
   * Select best endpoint (healthy with highest priority)
   */
  const selectBestEndpoint = () => {
    const endpoints = getEndpointsByPriority();

    for (const endpoint of endpoints) {
      const health = endpointsHealth.value.get(endpoint.id);
      if (health?.isHealthy) {
        activeEndpointId.value = endpoint.id;
        saveHealthCache();
        console.log(`[API Endpoints] Selected healthy endpoint: ${endpoint.id} (${endpoint.description})`);
        return endpoint;
      }
    }

    // If no healthy endpoints, select highest priority
    if (endpoints.length > 0) {
      activeEndpointId.value = endpoints[0].id;
      saveHealthCache();
      console.log(`[API Endpoints] No healthy endpoints, using default: ${endpoints[0].id} (${endpoints[0].description})`);
      return endpoints[0];
    }

    return null;
  };

  /**
   * Get active endpoint base URL
   */
  const getActiveBaseUrl = (): string => {
    if (!activeEndpointId.value) return '';
    const endpoint = GLOBAL_API_ENDPOINTS.endpoints.find(ep => ep.id === activeEndpointId.value);
    return endpoint ? buildApiUrl(endpoint) : '';
  };

  /**
   * Get active endpoint
   */
  const getActiveEndpoint = (): ApiEndpoint | null => {
    if (!activeEndpointId.value) return null;
    return GLOBAL_API_ENDPOINTS.endpoints.find(ep => ep.id === activeEndpointId.value) || null;
  };

  /**
   * Start health check timer
   */
  const startHealthCheck = () => {
    // Execute immediately once
    checkAllEndpoints();

    // Setup periodic checking
    if (!healthCheckInterval) {
      healthCheckInterval = setInterval(() => {
        checkAllEndpoints();
      }, GLOBAL_API_ENDPOINTS.healthCheckInterval);
    }
  };

  /**
   * Stop health check timer
   */
  const stopHealthCheck = () => {
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
  };

  // Initialize
  loadHealthCache();

  // If no active endpoint after loading cache, select the first one as default
  if (!activeEndpointId.value) {
    selectBestEndpoint();
  }

  // Start health check
  startHealthCheck();

  // Cleanup on app unmount
  nuxtApp.hook('app:unmounted', () => {
    stopHealthCheck();
  });

  // Provide globally
  return {
    provide: {
      apiEndpoints: {
        getActiveBaseUrl,
        getActiveEndpoint,
        checkAllEndpoints,
        selectBestEndpoint,
        endpointsHealth: readonly(endpointsHealth),
        activeEndpointId: readonly(activeEndpointId),
        isChecking: readonly(isChecking)
      }
    }
  };
});
