/**
 * API Endpoints Configuration
 * Defines all available backend API endpoints
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
 * Global API endpoint configuration
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
  healthCheckInterval: 60000, // 1 minute
  // 3s: dev backend runs under `php artisan serve` which cold-boots the whole
  // framework per request (~2.5s observed), so a 1s probe would abort before a
  // healthy localhost replies. Durable cure is config:cache/route:cache or Octane.
  timeout: 3000,
  retryAttempts: 3
};

/**
 * Build a complete API URL
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
 * (auto-detected from `window.location`). It reuses the exact same `/api` path
 * contract as the static backend endpoints — only the host/port come from
 * wherever the app is currently served (e.g. `http://localhost`).
 *
 * This is most useful when the frontend is hosted same-origin with the backend
 * (production / reverse-proxy / Capacitor): the current site is then tried
 * first. In a split dev setup (Vite on a different port with no proxy) its
 * health probe simply fails and the manager falls through to the next endpoint,
 * so adding it is always safe.
 *
 * Returns null when there is no usable http(s) origin (SSR, file://,
 * capacitor:// custom scheme, etc.).
 */
export function getCurrentOriginEndpoint(): ApiEndpoint | null {
  if (typeof window === 'undefined' || !window.location) return null;

  const { protocol, hostname, port } = window.location;
  // Only http(s) origins can serve the REST API.
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
 * Get an endpoint by ID
 */
export function getEndpointById(id: string): ApiEndpoint | undefined {
  if (id === CURRENT_ORIGIN_ENDPOINT_ID) return getCurrentOriginEndpoint() ?? undefined;
  return GLOBAL_API_ENDPOINTS.endpoints.find(e => e.id === id);
}

/**
 * Get all endpoints (sorted by priority).
 *
 * The page's current origin is auto-injected as the highest-priority (weight 0)
 * endpoint, unless an identical protocol/host/port is already configured.
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
