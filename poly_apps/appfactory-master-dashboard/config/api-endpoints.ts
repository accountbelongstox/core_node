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
 * Detection priority order (smaller priority number = higher priority):
 * 1. 127.0.0.1:9000 (localhost) - Tested first
 * 2. 192.168.50.3:9000 (LAN server) - Tested second
 * 3. api.si.12gm.com (Remote HTTPS) - Tested last
 * 
 * Strategy: Test endpoints in priority order, use first available endpoint
 * This ensures local development is preferred, then LAN, then remote
 */
export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'localhost',
    url: '127.0.0.1',
    protocol: 'http' as const,
    port: 9000,
    priority: 1, // Highest priority - tested first
    isLocal: true,
    description: 'Local Development Server (127.0.0.1:9000)',
  },
  {
    id: 'lan-server',
    url: '192.168.50.3',
    protocol: 'http' as const,
    port: 9000,
    priority: 2, // Second priority - tested if localhost unavailable
    isLocal: true,
    description: 'LAN Server (192.168.50.3:9000)',
  },
  {
    id: 'cloud-production',
    url: 'api.si.12gm.com',
    protocol: 'https' as const,
    port: undefined,
    priority: 3, // Lowest priority - tested last
    isLocal: false,
    description: 'Cloud Production Server (HTTPS)',
  },
].sort((a, b) => a.priority - b.priority); // Sort by priority: 1 → 2 → 3

