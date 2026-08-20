/**
 * Global API Endpoints Configuration
 * Defines all available API endpoints
 */

import { CURRENT_URL_TYPE, isCurrentUrlId } from '../../network/api-client/endpointIdentity';
import { resolveApiHostname } from '../../contracts/DomainConfig';
import { StorageManager } from '../../persistence';
import { LaravelStorageKeys as StorageKeys } from './LaravelStorageKeys';

export { CURRENT_URL_TYPE, isCurrentUrlId } from '../../network/api-client/endpointIdentity';

export interface BackendApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  priority: number;
  isLocal: boolean;
  description: string;
}

export interface ApiEndpointsConfig {
  endpoints: BackendApiEndpoint[];
  healthCheckInterval: number;
  timeout: number;
  retryAttempts: number;
}

/** Laravel Octane API port — independent of the FE shell port (e.g. :13054). */
export const FIXED_API_PORT = 9000;

function createCurrentOriginEndpoint(
  hostname: string,
  protocol: 'http' | 'https',
): BackendApiEndpoint {
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    /^192\.168\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
    /^100\./.test(hostname);

  // HTTPS on a public origin: the api.<prefix>.<domain> nginx site serves
  // the API on 443, so the :9000 backend port is NEVER appended; the region
  // prefix comes from the shell-written domain config (DomainConfig). A
  // hostname that already is an api fqdn (persisted current-url id) is kept
  // verbatim; a leading www. folds back to the apex.
  if (protocol === 'https' && !isLocal) {
    const apiHost = resolveApiHostname(hostname);
    return {
      id: `${CURRENT_URL_TYPE}:${apiHost}`,
      url: apiHost,
      protocol,
      priority: 99,
      isLocal: false,
      description: `Current URL - this site (${protocol}://${apiHost})`,
    };
  }

  return {
    id: `${CURRENT_URL_TYPE}:${hostname}`,
    url: hostname,
    protocol,
    port: FIXED_API_PORT,
    priority: 99,
    isLocal,
    description: `Current URL — this site (${protocol}://${hostname}:${FIXED_API_PORT})`,
  };
}

/**
 * Build the current-page-origin endpoint: host + protocol from `window.location`,
 * port pinned to FIXED_API_PORT (:9000). Null off-web or on non-http(s) origins.
 */
export function getCurrentOriginEndpoint(): BackendApiEndpoint | null {
  if (typeof window === 'undefined' || !window.location) return null;

  const { protocol, hostname } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') return null;
  if (!hostname) return null;

  const proto: 'http' | 'https' = protocol === 'https:' ? 'https' : 'http';
  return createCurrentOriginEndpoint(hostname, proto);
}

/**
 * Global API endpoints configuration
 */
export const GLOBAL_API_ENDPOINTS: ApiEndpointsConfig = {
  endpoints: [
    {
      id: 'primary-remote',
      url: 'api.si.12gm.com',
      protocol: 'https',
      priority: 1,
      isLocal: false,
      description: 'Primary Remote API Server'
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
      id: 'local-ip-50-3',
      url: '192.168.50.3',
      protocol: 'http',
      port: 9000,
      priority: 3,
      isLocal: true,
      description: 'Local IP 192.168.50.3'
    },
    {
      id: 'local-ip-50-2',
      url: '192.168.50.2',
      protocol: 'http',
      port: 9000,
      priority: 4,
      isLocal: true,
      description: 'Local IP 192.168.50.2'
    },
    {
      id: 'remote-cloud-43',
      url: '43.163.112.77',
      protocol: 'http',
      port: 9000,
      priority: 5,
      isLocal: false,
      description: 'Remote API Server 43.163.112.77'
    },
    {
      id: 'secondary-remote',
      url: 'api.si.gm15.com',
      protocol: 'https',
      priority: 6,
      isLocal: false,
      description: 'Secondary Remote API Server'
    },
    {
      id: 'loopback',
      url: '127.0.0.1',
      protocol: 'http',
      port: 9000,
      priority: 7,
      isLocal: true,
      description: 'Loopback 127.0.0.1:9000'
    },
    {
      id: 'tailnet-1',
      url: '100.101.149.39',
      protocol: 'http',
      port: 9000,
      priority: 8,
      isLocal: true,
      description: 'Mesh node 100.101.149.39:9000'
    },
    {
      id: 'tailnet-2',
      url: '100.106.85.16',
      protocol: 'http',
      port: 9000,
      priority: 9,
      isLocal: true,
      description: 'Mesh node 100.106.85.16:9000'
    }
  ],
  // Default ALL-Offline retry interval for this end (laravel-manager). While
  // every endpoint is Offline the end re-probes at this cadence and stops as
  // soon as one recovers; a healthy backend is never polled. Overridable per
  // browser in the endpoint switcher UI.
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
export function buildApiUrl(endpoint: BackendApiEndpoint, path: string = ''): string {
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
/** Normalized identity of an endpoint for de-duplication. */
export function endpointKey(e: { protocol: string; url: string; port?: number }): string {
  const port = e.port ? `:${e.port}` : '';
  return `${e.protocol}://${(e.url || '').toLowerCase()}${port}`;
}

function readCustomEndpoints(): BackendApiEndpoint[] {
  try {
    const parsed = StorageManager.get<BackendApiEndpoint[]>(StorageKeys.CUSTOM_ENDPOINTS, []);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is BackendApiEndpoint =>
        e && typeof e.id === 'string' && typeof e.url === 'string' &&
        (e.protocol === 'http' || e.protocol === 'https'),
    );
  } catch {
    return [];
  }
}

function writeCustomEndpoints(list: BackendApiEndpoint[]): void {
  StorageManager.set(StorageKeys.CUSTOM_ENDPOINTS, list);
}

/** User-added endpoints only (already de-duplicated against built-ins). */
export function getCustomEndpoints(): BackendApiEndpoint[] {
  const builtinKeys = new Set(GLOBAL_API_ENDPOINTS.endpoints.map(endpointKey));
  // Drop any custom entry that collides with a built-in (built-in wins).
  return readCustomEndpoints().filter(e => !builtinKeys.has(endpointKey(e)));
}

export function isCustomEndpoint(id: string): boolean {
  return getCustomEndpoints().some(e => e.id === id);
}

/** Built-in + custom, de-duplicated by key (built-in wins), sorted by priority. */
export function getMergedEndpoints(): BackendApiEndpoint[] {
  const seen = new Set<string>();
  const merged: BackendApiEndpoint[] = [];
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
  { ok: true; endpoint: BackendApiEndpoint } | { ok: false; error: string } {
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

  const candidate: BackendApiEndpoint = {
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
 * A host-qualified current-url ID restores its exact persisted hostname.
 * Only the legacy unqualified type resolves from window.location.
 */
export function getEndpointById(id: string): BackendApiEndpoint | undefined {
  if (id === CURRENT_URL_TYPE) return getCurrentOriginEndpoint() ?? undefined;
  if (isCurrentUrlId(id)) {
    const hostname = id.slice(`${CURRENT_URL_TYPE}:`.length).trim();
    const live = getCurrentOriginEndpoint();
    if (!hostname || !live) return live ?? undefined;
    return createCurrentOriginEndpoint(hostname, live.protocol);
  }
  return getAllEndpoints().find(e => e.id === id);
}

/**
 * Get all endpoints — built-in + custom + current-url, de-duplicated, sorted by priority.
 * When the current-url target matches a static/custom entry, the static row is
 * dropped so the list shows one "Current URL" row for that host:port.
 */
export function getAllEndpoints(): BackendApiEndpoint[] {
  const list = getMergedEndpoints();
  const current = getCurrentOriginEndpoint();
  if (!current) return list;

  const sameTarget = (e: BackendApiEndpoint) =>
    e.id !== current.id &&
    e.protocol === current.protocol &&
    e.url === current.url &&
    (e.port ?? null) === (current.port ?? null);

  const filtered = list.filter(e => !sameTarget(e));
  filtered.push(current);
  // The persisted Laravel endpoint remains visible even when a debug reload
  // opens the UI through a different hostname (for example localhost instead
  // of 127.0.0.1). Listing must follow localStorage, not window.location.
  const storedId = StorageManager.getRaw(StorageKeys.CURRENT_ENDPOINT);
  const stored = storedId && isCurrentUrlId(storedId)
    ? getEndpointById(storedId)
    : undefined;
  const storedExists = stored && filtered.some(e => endpointKey(e) === endpointKey(stored));
  if (stored && !storedExists) filtered.push(stored);
  return filtered.sort((a, b) => a.priority - b.priority);
}
