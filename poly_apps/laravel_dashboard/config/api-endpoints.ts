/**
 * Global API Endpoints Configuration
 * Defines all available API endpoints
 */

export interface ApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  priority: number;
  isLocal: boolean;
  description: string;
}

export interface ApiEndpointsConfig {
  endpoints: ApiEndpoint[];
  healthCheckInterval: number;
  timeout: number;
  retryAttempts: number;
}

/**
 * Global API endpoints configuration
 */
export const GLOBAL_API_ENDPOINTS: ApiEndpointsConfig = {
  endpoints: [
    {
      id: 'localhost',
      url: 'localhost',
      protocol: 'http',
      port: 9000,
      priority: 1,
      isLocal: true,
      description: 'Localhost API Server'
    },
    {
      id: 'local-ip-50-3',
      url: '192.168.50.3',
      protocol: 'http',
      port: 9000,
      priority: 2,
      isLocal: true,
      description: 'Local IP 192.168.50.3'
    },
    {
      id: 'local-ip-50-2',
      url: '192.168.50.2',
      protocol: 'http',
      port: 9000,
      priority: 3,
      isLocal: true,
      description: 'Local IP 192.168.50.2'
    },
    {
      id: 'primary-remote',
      url: 'api.si.12gm.com',
      protocol: 'https',
      priority: 4,
      isLocal: false,
      description: 'Primary Remote API Server'
    },
    {
      id: 'secondary-remote',
      url: 'api.si.gm15.com',
      protocol: 'https',
      priority: 5,
      isLocal: false,
      description: 'Secondary Remote API Server'
    }
  ],
  healthCheckInterval: 60000, // 1 minute
  timeout: 1000, // 1 second timeout
  retryAttempts: 3
};

/**
 * Build the full API URL
 */
export function buildApiUrl(endpoint: ApiEndpoint, path: string = ''): string {
  const port = endpoint.port ? `:${endpoint.port}` : '';
  const baseUrl = `${endpoint.protocol}://${endpoint.url}${port}`;

  if (!path) return baseUrl;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * Get an endpoint by ID
 */
export function getEndpointById(id: string): ApiEndpoint | undefined {
  return GLOBAL_API_ENDPOINTS.endpoints.find(e => e.id === id);
}

/**
 * Get all endpoints (sorted by priority)
 */
export function getAllEndpoints(): ApiEndpoint[] {
  return [...GLOBAL_API_ENDPOINTS.endpoints].sort((a, b) => a.priority - b.priority);
}
