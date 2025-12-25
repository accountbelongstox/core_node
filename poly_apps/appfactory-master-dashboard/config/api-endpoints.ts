/**
 * API Endpoint Configuration
 * Defines all available backend API server endpoints
 */

export interface ApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  priority: number; // 1 is highest, smaller number means higher priority
  isLocal: boolean;
  description: string;
}

/**
 * Build complete API URL
 */
export const buildApiUrl = (endpoint: ApiEndpoint): string => {
  const { protocol, url, port } = endpoint;
  if (port) {
    return `${protocol}://${url}:${port}`;
  }
  return `${protocol}://${url}`;
};

/**
 * Get endpoint by ID
 */
export const getEndpointById = (id: string): ApiEndpoint | undefined => {
  return API_ENDPOINTS.find(ep => ep.id === id);
};

/**
 * All available API endpoint list
 * Sorted by priority (smaller priority number means higher priority)
 * 
 * Strategy: Local first, automatically switch to cloud server when local is unavailable
 */
export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'localhost',
    url: 'localhost',
    protocol: 'http',
    port: 9000,
    priority: 1,
    isLocal: true,
    description: 'Local Development Server',
  },
  {
    id: 'cloud-production',
    url: 'api.si.12gm.com',
    protocol: 'https',
    port: undefined,
    priority: 2,
    isLocal: false,
    description: 'Cloud Production Server',
  },
].sort((a, b) => a.priority - b.priority); // Sort by priority

