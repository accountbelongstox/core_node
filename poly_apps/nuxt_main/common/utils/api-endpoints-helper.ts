/**
 * API Endpoints Helper
 *
 * Provides global access to API endpoints outside of Vue component context
 */

import { GLOBAL_API_ENDPOINTS, buildApiUrl, getEndpointsByPriority } from '@/common/config/api-endpoints';
import type { ApiEndpoint } from '@/common/config/api-endpoints';

const HEALTH_CACHE_KEY = 'api_endpoints_health';
const ACTIVE_ENDPOINT_KEY = 'active_api_endpoint';

class ApiEndpointsHelper {
  private static instance: ApiEndpointsHelper;

  private constructor() {}

  static getInstance(): ApiEndpointsHelper {
    if (!ApiEndpointsHelper.instance) {
      ApiEndpointsHelper.instance = new ApiEndpointsHelper();
    }
    return ApiEndpointsHelper.instance;
  }

  /**
   * Get active endpoint ID from localStorage
   */
  getActiveEndpointId(): string | null {
    if (typeof window === 'undefined') return null;

    try {
      return localStorage.getItem(ACTIVE_ENDPOINT_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Get active endpoint
   */
  getActiveEndpoint(): ApiEndpoint | null {
    const activeId = this.getActiveEndpointId();
    if (!activeId) {
      // Return first endpoint as default
      const endpoints = getEndpointsByPriority();
      return endpoints.length > 0 ? endpoints[0] : null;
    }

    return GLOBAL_API_ENDPOINTS.endpoints.find(ep => ep.id === activeId) || null;
  }

  /**
   * Get active base URL
   */
  getActiveBaseUrl(): string {
    const endpoint = this.getActiveEndpoint();
    return endpoint ? buildApiUrl(endpoint) : '';
  }

  /**
   * Set active endpoint
   */
  setActiveEndpoint(endpointId: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(ACTIVE_ENDPOINT_KEY, endpointId);
    } catch (error) {
      console.error('Failed to set active endpoint:', error);
    }
  }
}

// Export singleton instance
export const apiEndpointsHelper = ApiEndpointsHelper.getInstance();
