/**
 * Global API Endpoints Configuration
 * Defines all available API endpoints
 */

import { CURRENT_URL_TYPE, isCurrentUrlId } from '../../network/api-client/endpointIdentity';
import { getWebAccessConfig, resolveApiHostname } from '../../contracts/DomainConfig';
import {
  LARAVEL_API_BACKEND_PORT,
  TAILNET_API_LABEL,
  TAILNET_API_PATH,
} from '../../contracts/ServiceContract';
import { tailnetDomainOf } from '../../contracts/MeshDomain';
import { getServiceUrlEntries, getTailnetServerPeers } from '../../network/TailnetDiscovery';
import { StorageManager } from '../../persistence';
import { isLoopbackHost, isPrivateHost } from '../../network/hostDetection';
import { NETWORK_TIMEOUTS } from '../../config/NetworkTiming';
import { LaravelStorageKeys as StorageKeys } from './LaravelStorageKeys';

export { CURRENT_URL_TYPE, isCurrentUrlId } from '../../network/api-client/endpointIdentity';

export interface BackendApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  /** Path prefix the API is mounted under behind a reverse proxy (e.g. /laravel-api). */
  basePath?: string;
  priority: number;
  isLocal: boolean;
  description: string;
  /** Health probe budget of this endpoint (overrides the end's default). */
  probeTimeoutMs?: number;
}

export interface ApiEndpointsConfig {
  endpoints: BackendApiEndpoint[];
  healthCheckInterval: number;
  timeout: number;
  retryAttempts: number;
}

/** Laravel Octane API port — independent of the FE shell port (e.g. :13054). */
export const FIXED_API_PORT = LARAVEL_API_BACKEND_PORT;
const TAILNET_PRIORITY_BASE = 20;

function isLocalHostname(hostname: string): boolean {
  return isPrivateHost(hostname);
}

/**
 * The Laravel API of every root domain: `https://api.<region>.<domain>`
 * (ids kept stable so persisted selections survive).
 */
function getDomainApiEndpoints(): BackendApiEndpoint[] {
  const config = getWebAccessConfig();
  return config.domains.map((domain, index): BackendApiEndpoint => ({
    id: index === 0 ? 'primary-remote' : index === 1 ? 'secondary-remote' : `remote-domain-${index + 1}`,
    url: `api.${config.apiRegionPrefix}.${domain}`,
    protocol: 'https',
    priority: index,
    isLocal: false,
    description: domain,
    probeTimeoutMs: NETWORK_TIMEOUTS.remoteHealthProbeTimeoutMs,
  }));
}

/**
 * The Laravel API of every contract tailnet machine (service_url_entries): listed
 * before any discovery answered, so a phone that cannot list the tailnet itself
 * still offers them (the health probe tells whether the mesh is reachable).
 */
function getContractTailnetApiEndpoints(): BackendApiEndpoint[] {
  return getServiceUrlEntries().flatMap((entry): BackendApiEndpoint[] => {
    try {
      const parsed = new URL(entry.url);
      const host = parsed.hostname.toLowerCase();
      const basePath = parsed.pathname.replace(/\/+$/, '');
      if (parsed.protocol !== 'https:' || !tailnetDomainOf(host) || basePath !== TAILNET_API_PATH) return [];
      return [{
        id: tailnetEndpointId(host),
        url: host,
        protocol: 'https',
        basePath,
        priority: 0,
        isLocal: false,
        description: entry.label,
      }];
    } catch {
      return [];
    }
  });
}

/**
 * `https://<machine>.<tailnet domain>/laravel-api` of every contract and discovered tailnet machine
 * (static in a build, live in dev). All rank after the root-domain APIs, which stay the default.
 */
function getTailnetApiEndpoints(): BackendApiEndpoint[] {
  const discovered = getTailnetServerPeers().map((peer): BackendApiEndpoint => ({
    id: tailnetEndpointId(peer.dnsName),
    url: peer.dnsName,
    protocol: 'https',
    basePath: TAILNET_API_PATH,
    priority: 0,
    isLocal: false,
    description: peer.dnsName.split('.')[0],
  }));
  const seen = new Set<string>();
  return [...getContractTailnetApiEndpoints(), ...discovered]
    .filter((endpoint) => {
      const key = endpointKey(endpoint);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((endpoint, index) => ({ ...endpoint, priority: TAILNET_PRIORITY_BASE + index }));
}

function getBuiltInEndpoints(): BackendApiEndpoint[] {
  return [...getDomainApiEndpoints(), ...getTailnetApiEndpoints()];
}

function createCurrentOriginEndpoint(
  hostname: string,
  protocol: 'http' | 'https',
): BackendApiEndpoint {
  const isLocal = isLocalHostname(hostname);

  // Tailnet origin (<machine>.<tailnet domain>): Laravel main is reverse
  // proxied on the same trusted name under the tailnet API path.
  const tailnetHost = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (protocol === 'https' && tailnetDomainOf(tailnetHost)) {
    const machineHost = tailnetHost.startsWith(`${TAILNET_API_LABEL}.`)
      ? tailnetHost.slice(TAILNET_API_LABEL.length + 1)
      : tailnetHost;
    return {
      id: `${CURRENT_URL_TYPE}:${machineHost}${TAILNET_API_PATH}`,
      url: machineHost,
      protocol,
      basePath: TAILNET_API_PATH,
      priority: 5,
      isLocal: false,
      description: `Current URL - this machine (${protocol}://${machineHost}${TAILNET_API_PATH})`,
    };
  }

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
      priority: 5,
      isLocal: false,
      description: `Current URL - this site (${protocol}://${apiHost})`,
    };
  }

  // A loopback/LAN origin serves its own Laravel backend on :9000, so it ranks
  // ahead of the configured remote domains for first-run selection.
  return {
    id: `${CURRENT_URL_TYPE}:${hostname}`,
    url: hostname,
    protocol,
    port: FIXED_API_PORT,
    priority: isLocal ? -1 : 5,
    isLocal,
    description: `Current URL — this site (${protocol}://${hostname}:${FIXED_API_PORT})`,
  };
}

/**
 * Health-probe error code recorded when the browser's mixed-content policy
 * makes an endpoint unreachable from the current page (no request is sent).
 */
export const MIXED_CONTENT_BLOCKED_ERROR = 'MIXED_CONTENT_BLOCKED';

/** Loopback hosts stay fetchable from secure pages (potentially trustworthy). */
function isLoopbackHostname(hostname: string): boolean {
  return isLoopbackHost(hostname);
}

/**
 * True when this endpoint can NEVER be fetched from the current page: the
 * page is HTTPS and the endpoint is plain HTTP on a non-loopback host, so the
 * browser blocks every request as mixed content before it hits the network.
 */
export function isEndpointMixedContentBlocked(
  endpoint: Pick<BackendApiEndpoint, 'protocol' | 'url'>,
): boolean {
  if (endpoint.protocol !== 'http') return false;
  if (typeof window === 'undefined' || !window.location) return false;
  if (window.location.protocol !== 'https:') return false;
  return !isLoopbackHostname(endpoint.url);
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
  endpoints: [],
  // Default ALL-Offline retry interval for this end (laravel-manager). While
  // every endpoint is Offline the end re-probes at this cadence and stops as
  // soon as one recovers; a healthy backend is never polled. Overridable per
  // browser in the endpoint switcher UI.
  healthCheckInterval: NETWORK_TIMEOUTS.healthCheckIntervalMs,
  // 3s, not 1s: the Laravel backend under Octane can have first-byte latency
  // (cold worker / reload) above 1s, which made a healthy localhost probe abort
  // and show "✗ Unavailable" while real 15s-timeout requests still succeeded.
  timeout: NETWORK_TIMEOUTS.healthProbeTimeoutMs,
  retryAttempts: 3
};

/**
 * Build the full API URL
 */
export function endpointBaseUrl(
  endpoint: Pick<BackendApiEndpoint, 'protocol' | 'url' | 'port' | 'basePath'>,
): string {
  const port = endpoint.port ? `:${endpoint.port}` : '';
  return `${endpoint.protocol}://${endpoint.url}${port}${endpoint.basePath ?? ''}`;
}

export function buildApiUrl(endpoint: BackendApiEndpoint, path: string = ''): string {
  const baseUrl = endpointBaseUrl(endpoint);

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
export function endpointKey(e: { protocol: string; url: string; port?: number; basePath?: string }): string {
  const port = e.port ? `:${e.port}` : '';
  return `${e.protocol}://${(e.url || '').toLowerCase()}${port}${e.basePath ?? ''}`;
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
  const builtinKeys = new Set(getBuiltInEndpoints().map(endpointKey));
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
  for (const e of [...getBuiltInEndpoints(), ...getCustomEndpoints()]) {
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
    isLocal: isPrivateHost(url),
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

function tailnetEndpointId(dnsName: string): string {
  return `tailnet-${dnsName}`;
}

/**
 * The listed endpoint serving this page's own API: its tailnet machine
 * (a loopback page: the machine the dev server runs on), or
 * api.<region>.<domain> of a domain page; null elsewhere.
 */
export function getPagePreferredEndpoint(): BackendApiEndpoint | null {
  const endpoints = getAllEndpoints();
  if (typeof window !== 'undefined' && isLoopbackHost(window.location.hostname)) {
    const self = getTailnetServerPeers().find((peer) => peer.self);
    return self ? endpoints.find((endpoint) => endpoint.id === tailnetEndpointId(self.dnsName)) ?? null : null;
  }
  const page = getCurrentOriginEndpoint();
  if (!page) return null;
  const key = endpointKey(page);
  return endpoints.find((endpoint) => endpointKey(endpoint) === key) ?? null;
}

/** The listed API of the first root domain (api.<region>.<domain>), or null without one. */
export function getPrimaryDomainEndpoint(): BackendApiEndpoint | null {
  const primary = getDomainApiEndpoints()[0];
  if (!primary) return null;
  const key = endpointKey(primary);
  return getAllEndpoints().find((endpoint) => endpointKey(endpoint) === key) ?? null;
}

/**
 * Get an endpoint by ID. A legacy current-url id resolves to the listed
 * endpoint with the same address (or undefined when that is no longer listed).
 */
export function getEndpointById(id: string): BackendApiEndpoint | undefined {
  const endpoints = getAllEndpoints();
  const listed = endpoints.find((endpoint) => endpoint.id === id);
  if (listed || !isCurrentUrlId(id)) return listed;
  const hostname = id.slice(`${CURRENT_URL_TYPE}:`.length).trim().split('/')[0];
  const legacy = hostname ? createCurrentOriginEndpoint(hostname, 'https') : getCurrentOriginEndpoint();
  if (!legacy) return undefined;
  const key = endpointKey(legacy);
  return endpoints.find((endpoint) => endpointKey(endpoint) === key);
}

/** Every selectable endpoint: built-in (domains, tailnet machines) + custom, sorted by priority. */
export function getAllEndpoints(): BackendApiEndpoint[] {
  return getMergedEndpoints();
}
