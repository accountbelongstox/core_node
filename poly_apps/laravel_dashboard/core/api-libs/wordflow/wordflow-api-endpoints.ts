/**
 * WordFlow API endpoint configuration.
 *
 * Ported from poly_apps/qy_capacitor/config/api-endpoints.ts. Defines the
 * configured backend endpoints plus the auto-injected current-origin endpoint,
 * and the URL builder used by the probe / auto-select / failover logic.
 */

import { ApiEndpoint, ApiEndpointsConfig } from './wordflowTypes';

export type { ApiEndpoint, ApiEndpointsConfig } from './wordflowTypes';

/**
 * Global API endpoint configuration.
 */
export const GLOBAL_API_ENDPOINTS: ApiEndpointsConfig = {
  endpoints: [
    {
      id: 'local-ip-50-3',
      url: '192.168.50.3',
      protocol: 'http',
      port: 9000,
      priority: 1,
      isLocal: true,
      description: 'Local IP 192.168.50.3'
    },
    {
      id: 'localhost',
      url: 'localhost',
      protocol: 'http',
      port: 9000,
      priority: 2,
      isLocal: true,
      description: 'Localhost API Server'
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
      id: 'loopback-9000',
      url: '127.0.0.1',
      protocol: 'http',
      port: 9000,
      priority: 5,
      isLocal: true,
      description: 'Loopback fallback 127.0.0.1:9000 (lowest weight, tried last)'
    }
  ],
  // Default ALL-Offline retry interval for the wordflow end. While every
  // endpoint is Offline the end re-probes at this cadence and stops as soon as
  // one recovers; a healthy backend is never polled. Overridable in
  // WfSettingsApiServerPage (loop glue: WordflowHealthRecheck.ts).
  healthCheckInterval: 60000, // 1 minute
  // 3s: dev backend may cold-boot the whole framework per request, so a shorter
  // probe would abort before a healthy localhost replies.
  timeout: 3000,
  retryAttempts: 3
};

/**
 * Build a complete API URL.
 */
export function buildApiUrl(endpoint: ApiEndpoint, path: string = ''): string {
  const port = endpoint.port ? `:${endpoint.port}` : '';
  const baseUrl = `${endpoint.protocol}://${endpoint.url}${port}`;

  if (!path) return baseUrl;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * ID of the auto-injected, highest-priority endpoint derived from the page's
 * current origin (window.location).
 */
export const CURRENT_ORIGIN_ENDPOINT_ID = 'current-origin';

/**
 * Build the highest-priority endpoint from the page's CURRENT origin
 * (auto-detected from `window.location`). Reuses the same `/api` path contract;
 * only the host/port come from wherever the app is currently served. Returns
 * null when there is no usable http(s) origin.
 */
export function getCurrentOriginEndpoint(): ApiEndpoint | null {
  if (typeof window === 'undefined' || !window.location) return null;

  const { protocol, hostname, port } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  if (!hostname) return null;

  const proto: 'http' | 'https' = protocol === 'https:' ? 'https' : 'http';
  const parsedPort = port ? parseInt(port, 10) : undefined;
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

  return {
    id: CURRENT_ORIGIN_ENDPOINT_ID,
    url: hostname,
    protocol: proto,
    port: parsedPort,
    priority: 0, // highest weight — always probed / selected first when healthy
    isLocal,
    description: `Current site origin (${proto}://${hostname}${parsedPort ? ':' + parsedPort : ''})`,
  };
}

/**
 * Get an endpoint by ID.
 */
export function getEndpointById(id: string): ApiEndpoint | undefined {
  if (id === CURRENT_ORIGIN_ENDPOINT_ID) return getCurrentOriginEndpoint() ?? undefined;
  return GLOBAL_API_ENDPOINTS.endpoints.find(e => e.id === id);
}

/**
 * Get all endpoints (sorted by priority). The page's current origin is
 * auto-injected as the highest-priority (weight 0) endpoint unless an identical
 * protocol/host/port is already configured.
 */
export function getAllEndpoints(): ApiEndpoint[] {
  const list = [...GLOBAL_API_ENDPOINTS.endpoints];

  const current = getCurrentOriginEndpoint();
  if (
    current &&
    !list.some(
      e =>
        e.protocol === current.protocol &&
        e.url === current.url &&
        (e.port ?? null) === (current.port ?? null)
    )
  ) {
    list.unshift(current);
  }

  return list.sort((a, b) => a.priority - b.priority);
}
