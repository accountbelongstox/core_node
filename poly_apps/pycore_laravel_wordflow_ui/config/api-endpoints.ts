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

/** Selection TYPE token for the dynamic current-page-origin endpoint. */
export const CURRENT_URL_TYPE = 'current-url';

/** Laravel Octane API port — independent of the FE shell port (e.g. :13054). */
export const FIXED_API_PORT = 9000;

/** True for the stable type token or a host-qualified runtime id. */
export function isCurrentUrlId(id: string | null | undefined): boolean {
  return id === CURRENT_URL_TYPE || (typeof id === 'string' && id.startsWith(`${CURRENT_URL_TYPE}:`));
}

/**
 * Build the current-page-origin endpoint: host + protocol from `window.location`,
 * port pinned to FIXED_API_PORT (:9000). Null off-web or on non-http(s) origins.
 */
export function getCurrentOriginEndpoint(): ApiEndpoint | null {
  if (typeof window === 'undefined' || !window.location) return null;

  const { protocol, hostname } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  if (!hostname) return null;

  const proto: 'http' | 'https' = protocol === 'https:' ? 'https' : 'http';
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^100\./.test(hostname);

  return {
    id: `${CURRENT_URL_TYPE}:${hostname}`,
    url: hostname,
    protocol: proto,
    port: FIXED_API_PORT,
    priority: 0,
    isLocal,
    description: `Current URL — this site (${proto}://${hostname}:${FIXED_API_PORT})`,
  };
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
      id: 'remote-cloud-43',
      url: '43.163.112.77',
      protocol: 'http',
      port: 9000,
      priority: 4,
      isLocal: false,
      description: 'Remote API Server 43.163.112.77'
    },
    {
      id: 'primary-remote',
      url: 'api.si.12gm.com',
      protocol: 'https',
      priority: 5,
      isLocal: false,
      description: 'Primary Remote API Server'
    },
    {
      id: 'secondary-remote',
      url: 'api.si.gm15.com',
      protocol: 'https',
      priority: 6,
      isLocal: false,
      description: 'Secondary Remote API Server'
    }
  ],
  // Default ALL-Offline retry interval for this end (laravel-manager). While
  // every endpoint is Offline the end re-probes at this cadence and stops as
  // soon as one recovers; a healthy backend is never polled. Overridable per
  // browser in the endpoint switcher UI (services/ApiHealthRecheck.ts).
  healthCheckInterval: 60000, // 1 minute
  // 3s, not 1s: the Laravel backend under Octane can have first-byte latency
  // (cold worker / reload) above 1s, which made a healthy localhost probe abort
  // and show "✗ Unavailable" while real 15s-timeout requests still succeeded.
  timeout: 3000,
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

/* -------------------------------------------------------------------------- *
 * Custom endpoints (user-added, persisted in localStorage)                    *
 *                                                                             *
 * Both the top API-Endpoints switcher and the Settings page read through the  *
 * MERGED list (built-in config + custom), so a custom endpoint added in       *
 * Settings appears in both. Duplicates are never added: an endpoint is keyed  *
 * by protocol://host:port and a built-in always wins over a custom with the   *
 * same key.                                                                    *
 * -------------------------------------------------------------------------- */
const CUSTOM_ENDPOINTS_KEY = 'api_custom_endpoints';

/** Normalized identity of an endpoint for de-duplication. */
export function endpointKey(e: { protocol: string; url: string; port?: number }): string {
  const port = e.port ? `:${e.port}` : '';
  return `${e.protocol}://${(e.url || '').toLowerCase()}${port}`;
}

function readCustomEndpoints(): ApiEndpoint[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_ENDPOINTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is ApiEndpoint =>
        e && typeof e.id === 'string' && typeof e.url === 'string' &&
        (e.protocol === 'http' || e.protocol === 'https'),
    );
  } catch {
    return [];
  }
}

function writeCustomEndpoints(list: ApiEndpoint[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_ENDPOINTS_KEY, JSON.stringify(list));
  } catch {
    /* storage full / disabled — non-fatal */
  }
}

/** User-added endpoints only (already de-duplicated against built-ins). */
export function getCustomEndpoints(): ApiEndpoint[] {
  const builtinKeys = new Set(GLOBAL_API_ENDPOINTS.endpoints.map(endpointKey));
  // Drop any custom entry that collides with a built-in (built-in wins).
  return readCustomEndpoints().filter(e => !builtinKeys.has(endpointKey(e)));
}

export function isCustomEndpoint(id: string): boolean {
  return getCustomEndpoints().some(e => e.id === id);
}

/** Built-in + custom, de-duplicated by key (built-in wins), sorted by priority. */
export function getMergedEndpoints(): ApiEndpoint[] {
  const seen = new Set<string>();
  const merged: ApiEndpoint[] = [];
  for (const e of [...GLOBAL_API_ENDPOINTS.endpoints, ...getCustomEndpoints()]) {
    const k = endpointKey(e);
    if (seen.has(k)) continue;       // no redundant duplicates
    seen.add(k);
    merged.push(e);
  }
  return merged.sort((a, b) => a.priority - b.priority);
}

export interface AddEndpointInput {
  url: string;
  protocol?: 'http' | 'https';
  port?: number;
  description?: string;
}

/**
 * Add a user endpoint (persisted). Rejects duplicates (same protocol://host:port
 * as any built-in or existing custom endpoint). Returns the created endpoint or
 * an error message.
 */
export function addCustomEndpoint(input: AddEndpointInput):
  { ok: true; endpoint: ApiEndpoint } | { ok: false; error: string } {
  let url = (input.url || '').trim();
  if (!url) return { ok: false, error: 'Host / URL is required' };

  // Accept a full URL, peel protocol/port off it.
  let protocol: 'http' | 'https' = input.protocol || 'http';
  let port = input.port;
  const m = url.match(/^(https?):\/\/(.+)$/i);
  if (m) {
    protocol = m[1].toLowerCase() as 'http' | 'https';
    url = m[2];
  }
  const portInPath = url.match(/^([^/:]+):(\d+)/);
  if (portInPath) {
    url = portInPath[1];
    if (port == null) port = Number(portInPath[2]);
  }
  url = url.replace(/\/.*$/, '').replace(/:\d+$/, '').toLowerCase();
  if (!url) return { ok: false, error: 'Invalid host / URL' };
  if (port != null && (Number.isNaN(port) || port < 1 || port > 65535)) {
    return { ok: false, error: 'Port must be 1–65535' };
  }

  const candidate: ApiEndpoint = {
    id: `custom-${endpointKey({ protocol, url, port }).replace(/[^a-z0-9]+/gi, '-')}`,
    url,
    protocol,
    port,
    priority: 0,            // assigned below
    isLocal: /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url),
    description: (input.description || '').trim() || `${url}${port ? `:${port}` : ''}`,
  };

  const key = endpointKey(candidate);
  const existing = getMergedEndpoints();
  if (existing.some(e => endpointKey(e) === key)) {
    return { ok: false, error: 'This endpoint already exists' };
  }

  candidate.priority = Math.max(0, ...existing.map(e => e.priority)) + 1;
  const custom = getCustomEndpoints();
  custom.push(candidate);
  writeCustomEndpoints(custom);
  return { ok: true, endpoint: candidate };
}

/** Remove a user endpoint by id (built-ins are never removed). */
export function removeCustomEndpoint(id: string): boolean {
  const custom = getCustomEndpoints();
  const next = custom.filter(e => e.id !== id);
  if (next.length === custom.length) return false;
  writeCustomEndpoints(next);
  return true;
}

/**
 * Get an endpoint by ID (built-in, custom, or current-url type).
 * The 'current-url' type re-resolves live from window.location on every call.
 */
export function getEndpointById(id: string): ApiEndpoint | undefined {
  if (isCurrentUrlId(id)) return getCurrentOriginEndpoint() ?? undefined;
  return getAllEndpoints().find(e => e.id === id);
}

/**
 * Get all endpoints — built-in + custom + current-url, de-duplicated, sorted by priority.
 * When the current-url target matches a static/custom entry, the static row is
 * dropped so the list shows one "Current URL" row for that host:port.
 */
export function getAllEndpoints(): ApiEndpoint[] {
  const list = getMergedEndpoints();
  const current = getCurrentOriginEndpoint();
  if (!current) return list;

  const sameTarget = (e: ApiEndpoint) =>
    e.id !== current.id &&
    e.protocol === current.protocol &&
    e.url === current.url &&
    (e.port ?? null) === (current.port ?? null);

  const filtered = list.filter(e => !sameTarget(e));
  filtered.push(current);
  return filtered.sort((a, b) => a.priority - b.priority);
}
