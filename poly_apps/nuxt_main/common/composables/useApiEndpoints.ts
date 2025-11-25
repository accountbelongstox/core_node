/**
 * API Endpoints Management Composable
 * API端点管理组合式函数
 *
 * 功能：
 * - 健康检查
 * - 自动故障转移
 * - 端点状态缓存
 * - 最优端点选择
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { ApiEndpoint, ApiEndpointsConfig } from '@/common/config/api-endpoints';
import { GLOBAL_API_ENDPOINTS, buildApiUrl, getEndpointsByPriority } from '@/common/config/api-endpoints';

export interface EndpointHealth {
  endpointId: string;
  isHealthy: boolean;
  lastChecked: number;
  responseTime: number; // 毫秒
  errorMessage?: string;
}

const HEALTH_CACHE_KEY = 'api_endpoints_health';
const ACTIVE_ENDPOINT_KEY = 'active_api_endpoint';

export function useApiEndpoints(customConfig?: Partial<ApiEndpointsConfig>) {
  const config = { ...GLOBAL_API_ENDPOINTS, ...customConfig };
  const endpointsHealth = ref<Map<string, EndpointHealth>>(new Map());
  const activeEndpointId = ref<string | null>(null);
  const isChecking = ref(false);
  let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Load cached health status from localStorage
   */
  const loadHealthCache = () => {
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
      const timeoutId = setTimeout(() => controller.abort(), config.timeout);

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
      // Only network errors (timeout, connection refused) should mark as unhealthy
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
        return endpoint;
      }
    }

    // If no healthy endpoints, select highest priority
    if (endpoints.length > 0) {
      activeEndpointId.value = endpoints[0].id;
      saveHealthCache();
      return endpoints[0];
    }

    return null;
  };

  /**
   * Manually set active endpoint
   */
  const setActiveEndpoint = (endpointId: string) => {
    const endpoint = config.endpoints.find(ep => ep.id === endpointId);
    if (endpoint) {
      activeEndpointId.value = endpointId;
      saveHealthCache();
    }
  };

  /**
   * Get current active endpoint
   */
  const activeEndpoint = computed<ApiEndpoint | null>(() => {
    if (!activeEndpointId.value) return null;
    return config.endpoints.find(ep => ep.id === activeEndpointId.value) || null;
  });

  /**
   * Get active endpoint base URL
   */
  const activeBaseUrl = computed<string>(() => {
    if (!activeEndpoint.value) return '';
    return buildApiUrl(activeEndpoint.value);
  });

  /**
   * Get all endpoints with health status
   */
  const endpointsWithHealth = computed(() => {
    return config.endpoints.map(endpoint => ({
      ...endpoint,
      health: endpointsHealth.value.get(endpoint.id)
    }));
  });

  /**
   * Count healthy endpoints
   */
  const healthyEndpointsCount = computed(() => {
    return Array.from(endpointsHealth.value.values()).filter(h => h.isHealthy).length;
  });

  /**
   * Start health check timer
   */
  const startHealthCheck = () => {
    // Execute immediately once
    checkAllEndpoints();

    // Setup periodic checking
    healthCheckInterval = setInterval(() => {
      checkAllEndpoints();
    }, config.healthCheckInterval);
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

  // Lifecycle hooks
  onMounted(() => {
    loadHealthCache();

    // If no active endpoint after loading cache, select the first one as default
    if (!activeEndpointId.value) {
      selectBestEndpoint();
    }

    startHealthCheck();
  });

  onUnmounted(() => {
    stopHealthCheck();
  });

  return {
    // State
    endpointsHealth,
    activeEndpointId,
    activeEndpoint,
    activeBaseUrl,
    isChecking,
    endpointsWithHealth,
    healthyEndpointsCount,

    // Methods
    checkEndpointHealth,
    checkAllEndpoints,
    selectBestEndpoint,
    setActiveEndpoint,
    startHealthCheck,
    stopHealthCheck
  };
}
