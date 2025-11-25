/**
 * Global API Endpoints Configuration
 *
 * Supports multiple API endpoints with automatic health checking and failover
 */

export interface ApiEndpoint {
  id: string;
  url: string;
  protocol: 'https' | 'http';
  port?: number; // Port number (optional, uses protocol default if not specified)
  priority: number; // Priority: lower number = higher priority
  isLocal: boolean;
  description: string;
}

export interface ApiEndpointsConfig {
  endpoints: ApiEndpoint[];
  healthCheckInterval: number; // Health check interval in milliseconds
  timeout: number; // Request timeout in milliseconds
  retryAttempts: number; // Number of retry attempts
}

/**
 * Global API Endpoints Configuration
 * All sub-applications can inherit and extend this configuration
 */
export const GLOBAL_API_ENDPOINTS: ApiEndpointsConfig = {
  endpoints: [
    // Remote API endpoints (no port specified, uses protocol default)
    {
      id: 'primary',
      url: 'api.si.12gm.com',
      protocol: 'https',
      priority: 1,
      isLocal: false,
      description: 'Primary API Server'
    },
    {
      id: 'secondary',
      url: 'api.si.gm15.com',
      protocol: 'https',
      priority: 2,
      isLocal: false,
      description: 'Secondary API Server'
    },
    // Local API endpoints (domain names - no port specified, uses protocol default)
    {
      id: 'local-domain-primary',
      url: 'local.api.12gm.com',
      protocol: 'http',
      priority: 3,
      isLocal: true,
      description: 'Local Domain API (Primary)'
    },
    {
      id: 'local-domain-secondary',
      url: 'local.api.gm15.com',
      protocol: 'http',
      priority: 4,
      isLocal: true,
      description: 'Local Domain API (Secondary)'
    },
    // Local API endpoints (IP addresses with port 9003)
    {
      id: 'local-ip-1',
      url: '192.168.2.1',
      protocol: 'http',
      port: 9003,
      priority: 5,
      isLocal: true,
      description: 'Local IP Server 1'
    },
    {
      id: 'local-ip-2',
      url: '192.168.50.2',
      protocol: 'http',
      port: 9003,
      priority: 6,
      isLocal: true,
      description: 'Local IP Server 2'
    }
  ],
  healthCheckInterval: 60000, // Check every 60 seconds
  timeout: 5000, // 5 second timeout
  retryAttempts: 3
};

/**
 * Build complete API URL with optional path
 */
export function buildApiUrl(endpoint: ApiEndpoint, path: string = ''): string {
  let baseUrl = `${endpoint.protocol}://${endpoint.url}`;

  // Add port if specified
  if (endpoint.port) {
    baseUrl += `:${endpoint.port}`;
  }

  return path ? `${baseUrl}/${path.replace(/^\//, '')}` : baseUrl;
}

/**
 * Get all endpoints sorted by priority
 */
export function getEndpointsByPriority(): ApiEndpoint[] {
  return [...GLOBAL_API_ENDPOINTS.endpoints].sort((a, b) => a.priority - b.priority);
}

/**
 * Get endpoint by ID
 */
export function getEndpointById(id: string): ApiEndpoint | undefined {
  return GLOBAL_API_ENDPOINTS.endpoints.find(ep => ep.id === id);
}
