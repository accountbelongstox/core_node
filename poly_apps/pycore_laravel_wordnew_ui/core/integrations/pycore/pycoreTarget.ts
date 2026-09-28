/**
 * pycoreTarget - shared selection of the active Pycore service backend.
 *
 * Targets carry FULL backend URLs (scheme + host + optional port):
 *   - `http://<host>:59000`  -> direct transport (byte-for-byte the classic
 *     behavior; origin/local modes and host presets render to this form).
 *   - `https://<host>`       -> relay scheme: the entry is the server-side
 *     reverse proxy of the relay, requests ride the paired machine
 *     (PycoreLaravelRelayTransport), and the Relay-scoped Laravel roster link runs.
 */
import {
  PYCORE_PORT,
  buildPycoreHttpUrl,
  normalizePycorePath,
} from './pycoreEndpoints';
import { RELAY_CONTRACT } from '../../contracts/RelayContract';
import {
  LOCAL_RPC_LOOPBACK_HOSTS,
  NEXUS_DASH_FRONTEND_PORT,
  SERVICE_CONTRACT_URL_ENTRIES,
} from '../../contracts/ServiceContract';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';
import { getWebAccessConfig } from '../../contracts/DomainConfig';
import { DEFAULT_FRONTEND_PORT } from '../../config/FrontendConfig';
import { StorageManager } from '../../persistence';

export type PycorePresetSource = 'relay_origin' | 'contract_url' | 'host_key';

export interface PycorePresetHost {
  host: string;
  label: string;
  source: PycorePresetSource;
  /** Full backend URL preset (relay scheme https entry); bare-host entries render to the direct :59000 form. */
  url?: string;
}

export interface PycoreTarget {
  mode: 'origin' | 'local' | 'remote';
  /** Remote: full backend URL (direct http://host:59000 or https relay entry). */
  url?: string;
  /** Legacy bare-host form (pre-URL model); migrated to url on read. */
  host?: string;
}

const PYCORE_LOOPBACK_HOSTS = new Set(LOCAL_RPC_LOOPBACK_HOSTS.map((host) => host.toLowerCase()));
const PYCORE_DASHBOARD_ORIGIN_PORTS = [String(NEXUS_DASH_FRONTEND_PORT), String(PYCORE_PORT)];

function parseBackendUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/** Contract loopback hosts (K7): the only hosts pycore serves to browsers directly. */
export function isPycoreLoopbackHost(host: string): boolean {
  return PYCORE_LOOPBACK_HOSTS.has(String(host || '').trim().toLowerCase().replace(/^\[|\]$/g, ''));
}

function isRelayBackendUrl(parsed: URL): boolean {
  return parsed.protocol === 'https:' && parsed.port !== String(PYCORE_PORT);
}

/**
 * K7a: browsers reach pycore directly only from a loopback page on the pycore
 * machine; every other browser manages pycore through the HTTPS relay.
 */
export function isPycoreDirectAccessAllowed(): boolean {
  return isLoopbackPage();
}

/** Contract dashboard ports pycore accepts as a browser Origin on a loopback page (K7). */
export function pycoreDashboardOriginPorts(): string[] {
  return [...PYCORE_DASHBOARD_ORIGIN_PORTS];
}

/** True when this loopback page's origin is on pycore's contract allow-list. */
export function isPycoreDashboardOrigin(): boolean {
  return isLoopbackPage()
    && typeof location !== 'undefined'
    && PYCORE_DASHBOARD_ORIGIN_PORTS.includes(location.port);
}

function isAllowedBackendUrl(url: string): boolean {
  const parsed = parseBackendUrl(url);
  if (!parsed) return false;
  if (isRelayBackendUrl(parsed)) return true;
  return isPycoreDirectAccessAllowed() && isPycoreLoopbackHost(parsed.hostname);
}

/**
 * Normalize user input to a full backend URL. Bare hosts render to the
 * direct form (`http://host:59000`); URLs keep their scheme/host/port and
 * drop any path. Returns null for unusable input.
 */
export function normalizePycoreBackendUrl(input: string): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  const parsed = parseBackendUrl(withScheme);
  if (!parsed || !parsed.hostname) return null;
  const directBareHost = !/^https?:\/\//i.test(raw) && !raw.includes(':');
  if (directBareHost) return `http://${parsed.hostname}:${PYCORE_PORT}`;
  const port = parsed.port ? `:${parsed.port}` : '';
  return `${parsed.protocol}//${parsed.hostname}${port}`;
}

function readTarget(): PycoreTarget {
  let relayPreset: PycorePresetHost | null = null;
  const target = StorageManager.get<PycoreTarget | null>(StorageKeys.TARGET, null);
  if (target?.mode === 'remote') {
    // Legacy bare-host entries migrate to the direct URL form in place.
    if (typeof target.host === 'string' && target.host.trim() && !target.url) {
      const migrated = normalizePycoreBackendUrl(target.host);
      if (migrated) {
        StorageManager.set(StorageKeys.TARGET, { mode: 'remote', url: migrated });
        return { mode: 'remote', url: migrated };
      }
    }
    const url = normalizePycoreBackendUrl(String(target.url || ''));
    if (url && isAllowedBackendUrl(url)) return { mode: 'remote', url };
  }
  if (target?.mode === 'local' && isPycoreDirectAccessAllowed()) return { mode: 'local' };
  relayPreset = relayBackendPreset();
  if (relayPreset?.url) return { mode: 'remote', url: relayPreset.url };
  return { mode: 'origin' };
}

export function getPycoreTarget(): PycoreTarget {
  return readTarget();
}

/** Full backend URL of the active target. */
export function pycoreTargetBackendUrl(): string {
  const target = readTarget();
  if (target.mode === 'remote' && target.url) return target.url;
  return buildPycoreHttpUrl(localPycoreHost(), '/');
}

/**
 * Relay scheme: an https backend that is NOT the direct TLS :59000 entry -
 * such an entry is the server-side reverse proxy of the relay.
 */
export function isPycoreRelayMode(): boolean {
  const target = readTarget();
  if (target.mode !== 'remote' || !target.url) return false;
  const parsed = parseBackendUrl(target.url);
  return parsed !== null && isRelayBackendUrl(parsed);
}

export function isPycoreRemote(): boolean {
  return readTarget().mode === 'remote';
}

/** Bare host of a DIRECT remote target (null for origin/local and relay entries). */
export function pycoreTargetHost(): string | null {
  const target = readTarget();
  if (target.mode !== 'remote' || !target.url) return null;
  const parsed = parseBackendUrl(target.url);
  if (!parsed || parsed.protocol !== 'http:' || parsed.port !== String(PYCORE_PORT)) return null;
  return parsed.hostname;
}

export function isLoopbackPage(): boolean {
  return typeof location !== 'undefined' && isPycoreLoopbackHost(location.hostname);
}

/** UI served from the Vite dev shell (:13054). */
export function isViteDevShell(): boolean {
  return typeof location !== 'undefined'
    && location.port === String(DEFAULT_FRONTEND_PORT);
}

/** Page hostname for origin/local target (localhost stays localhost, not 127.0.0.1). */
export function localPycoreHost(): string {
  if (typeof location !== 'undefined' && location.hostname) return location.hostname;
  return '127.0.0.1';
}

export function localPycoreOrigin(): string {
  if (typeof location !== 'undefined' && location.host) return location.host;
  return '127.0.0.1';
}

/**
 * Host for direct :59000 calls - remote direct target wins; otherwise the
 * page hostname. Does NOT remap localhost -> 127.0.0.1 (separate origins).
 */
export function directPycoreHost(): string {
  const host = pycoreTargetHost();
  return host ?? localPycoreHost();
}

export function pycoreEffectiveHost(): string {
  return directPycoreHost();
}

/** Resolve a relative pycore path to a full URL on the active backend. */
export function rewritePycoreEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const target = readTarget();
  if (target.mode === 'remote' && target.url) {
    const base = target.url.replace(/\/+$/, '');
    return `${base}${normalizePycorePath(endpoint)}`;
  }
  if (typeof location !== 'undefined' && location.port === String(PYCORE_PORT)) {
    return normalizePycorePath(endpoint);
  }
  return buildPycoreHttpUrl(directPycoreHost(), endpoint);
}

export function getPycoreTargetRecent(): string[] {
  const recent = StorageManager.get<unknown[]>(StorageKeys.TARGET_RECENT, []);
  return Array.isArray(recent)
    ? recent.filter((value): value is string => typeof value === 'string' && isAllowedBackendUrl(value))
    : [];
}

export function getPycoreTargetPresets(): PycorePresetHost[] {
  const relayPreset = relayBackendPreset();
  const config = getWebAccessConfig();
  const presets = config.serviceHostKeys.pycore
    .map((key): PycorePresetHost => ({
      host: config.hosts[key],
      label: key,
      source: 'host_key',
    }))
    .filter((preset) => isAllowedBackendUrl(buildPycoreHttpUrl(preset.host, '/')));
  const urlPresets = SERVICE_CONTRACT_URL_ENTRIES
    .map((entry): PycorePresetHost | null => {
      const parsed = parseBackendUrl(entry.url);
      const url = normalizePycoreBackendUrl(entry.url);
      if (!parsed || !parsed.hostname || !url || !isAllowedBackendUrl(url)) return null;
      return {
        host: parsed.hostname,
        label: entry.label,
        source: 'contract_url',
        url,
      };
    })
    .filter((preset): preset is PycorePresetHost => preset !== null);
  const ordered = [...urlPresets, ...presets];
  return relayPreset ? [relayPreset, ...ordered] : ordered;
}

/**
 * Contract-rendered HTTPS relay preset (PART_3 §3.6): on a domain-served
 * HTTPS page the server-side relay entry comes from the shared Relay contract.
 * Null on loopback/IP pages and plain-HTTP dev shells.
 */
function relayBackendPreset(): PycorePresetHost | null {
  if (typeof location === 'undefined' || location.protocol !== 'https:') return null;
  const hostname = location.hostname.toLowerCase();
  const labels = hostname.split('.');
  if (labels.length < 2 || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.includes(':') || hostname === 'localhost') return null;
  const relayUrl = String(RELAY_CONTRACT.public_urls.laravel_api_origin || '').replace(/\/+$/, '');
  const parsedRelay = parseBackendUrl(relayUrl);
  if (!parsedRelay || parsedRelay.protocol !== 'https:') return null;
  return {
    host: parsedRelay.hostname,
    url: relayUrl,
    label: parsedRelay.hostname,
    source: 'relay_origin',
  };
}

/** Legacy direct-host normalizer (preset entries stay bare hosts). */
export function normalizePycoreHost(input: string): string {
  const url = normalizePycoreBackendUrl(input);
  if (!url) return '';
  return parseBackendUrl(url)?.hostname ?? '';
}

/** Persist a target and reload; false (nothing changes) for a direct target K7a does not allow. */
export function setPycoreTarget(target: PycoreTarget): boolean {
  if (target.mode === 'remote') {
    // Accept a stored url, a legacy host, or raw user input alike.
    const raw = target.url
      || (typeof (target as { host?: string }).host === 'string' ? (target as { host?: string }).host : '')
      || '';
    const url = normalizePycoreBackendUrl(raw);
    if (!url || !isAllowedBackendUrl(url)) return false;
    StorageManager.set(StorageKeys.TARGET, { mode: 'remote', url });
    const recent = [url, ...getPycoreTargetRecent().filter((u) => u !== url)].slice(0, 6);
    StorageManager.set(StorageKeys.TARGET_RECENT, recent);
  } else {
    if (target.mode === 'local' && !isPycoreDirectAccessAllowed()) return false;
    StorageManager.set(StorageKeys.TARGET, { mode: target.mode === 'local' ? 'local' : 'origin' });
  }
  if (typeof location !== 'undefined') location.reload();
  return true;
}
