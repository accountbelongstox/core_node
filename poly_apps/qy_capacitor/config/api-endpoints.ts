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

/** Default port the Laravel backend REST API listens on (matches the static endpoints). */
export const DEFAULT_API_PORT = 9000;

/**
 * ID of the auto-injected endpoint that targets the CURRENT host on the backend
 * API port (9000).
 */
export const CURRENT_ORIGIN_API_ENDPOINT_ID = 'current-origin-api';

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/**
 * Build an endpoint that reuses the CURRENT page's host but targets the backend
 * API port (9000). This is the split-dev / direct-backend counterpart to
 * getCurrentOriginEndpoint(): the frontend is served on one port (e.g. Vite
 * :3000, with no /api proxy) while the Laravel backend listens on :9000 of the
 * SAME host. Without this, the current-origin endpoint (page port :3000) probes
 * Vite's SPA index.html for /api/health, reads as unhealthy, and API calls 404.
 *
 * Returns null for non-http(s) origins, or when the page is already served on
 * the API port (it would just duplicate the exact current-origin endpoint).
 */
export function getCurrentOriginApiEndpoint(): ApiEndpoint | null {
  if (typeof window === 'undefined' || !window.location) return null;

  const { protocol, hostname, port } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  if (!hostname) return null;

  const pagePort = port ? parseInt(port, 10) : (protocol === 'https:' ? 443 : 80);
  if (pagePort === DEFAULT_API_PORT) return null; // identical to current-origin

  const proto: 'http' | 'https' = protocol === 'https:' ? 'https' : 'http';

  return {
    id: CURRENT_ORIGIN_API_ENDPOINT_ID,
    url: hostname,
    protocol: proto,
    port: DEFAULT_API_PORT,
    priority: 0, // highest weight, alongside current-origin
    isLocal: isLocalHostname(hostname),
    description: `Current host · API port (${proto}://${hostname}:${DEFAULT_API_PORT})`,
  };
}

/**
 * Get an endpoint by ID
 */
export function getEndpointById(id: string): ApiEndpoint | undefined {
  if (id === CURRENT_ORIGIN_ENDPOINT_ID) return getCurrentOriginEndpoint() ?? undefined;
  if (id === CURRENT_ORIGIN_API_ENDPOINT_ID) return getCurrentOriginApiEndpoint() ?? undefined;
  return GLOBAL_API_ENDPOINTS.endpoints.find(e => e.id === id);
}

/**
 * Get all endpoints (sorted by priority).
 *
 * Two endpoints are auto-injected from the page's current URL at the highest
 * priority (weight 0), each unless an identical protocol/host/port is already
 * present:
 *   - current-origin      → the exact page origin (host + page port). Wins when
 *                           the frontend is served same-origin with the backend
 *                           (reverse-proxy / production / Capacitor).
 *   - current-origin-api  → the page host on the backend API port (9000). Wins
 *                           in split dev (Vite on :3000, Laravel on :9000 of the
 *                           same host) and when reaching the dev box over the LAN.
 * Availability-first selection then picks whichever actually answers /api/health.
 */
export function getAllEndpoints(): ApiEndpoint[] {
  const list = [...GLOBAL_API_ENDPOINTS.endpoints];

  const sameTarget = (a: ApiEndpoint, b: ApiEndpoint): boolean =>
    a.protocol === b.protocol && a.url === b.url && (a.port ?? null) === (b.port ?? null);

  // Inject current-origin-api first, then current-origin, so the exact origin
  // ends up at the very front (preferred when both are healthy, e.g. prod).
  const currentApi = getCurrentOriginApiEndpoint();
  if (currentApi && !list.some(e => sameTarget(e, currentApi))) {
    list.unshift(currentApi);
  }

  const current = getCurrentOriginEndpoint();
  if (current && !list.some(e => sameTarget(e, current))) {
    list.unshift(current);
  }

  return list.sort((a, b) => a.priority - b.priority);
}
