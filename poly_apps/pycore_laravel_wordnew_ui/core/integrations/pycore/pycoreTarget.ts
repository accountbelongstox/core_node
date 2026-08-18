/**
 * pycoreTarget - shared selection of the active Pycore service backend.
 *
 * Targets carry FULL backend URLs (scheme + host + optional port):
 *   - `http://<host>:59000`  -> direct transport (byte-for-byte the classic
 *     behavior; origin/local modes and host presets render to this form).
 *   - `https://<host>`       -> relay scheme: the entry is the server-side
 *     reverse proxy of the relay, requests ride the paired machine
 *     (PycoreRelayTransport), and the always-on Laravel roster link runs.
 */
import {
  PYCORE_PORT,
  buildPycoreHttpUrl,
  normalizePycorePath,
} from './pycoreEndpoints';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';
import { getApiRegionPrefix } from '../../contracts/DomainConfig';
import { DEFAULT_FRONTEND_PORT } from '../../config/FrontendConfig';
import { StorageManager } from '../../persistence';

export interface PycorePresetHost {
  host: string;
  label: string;
  hint?: string;
  /** Full backend URL preset (relay scheme https entry); bare-host entries render to the direct :59000 form. */
  url?: string;
}

const PRESET_HOSTS: PycorePresetHost[] = [
  { host: '127.0.0.1', label: 'Localhost', hint: 'loopback (browser must be on the pycore machine)' },
  { host: '43.163.112.77', label: 'Public IP', hint: 'cloud server' },
  { host: '100.126.119.99', label: 'Tailscale LAN', hint: 'private mesh' },
  { host: '100.101.149.39', label: 'NUUL', hint: 'Tailscale' },
];

export interface PycoreTarget {
  mode: 'origin' | 'local' | 'remote';
  /** Remote: full backend URL (direct http://host:59000 or https relay entry). */
  url?: string;
  /** Legacy bare-host form (pre-URL model); migrated to url on read. */
  host?: string;
}

function parseBackendUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
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
    if (url) return { mode: 'remote', url };
  }
  if (target?.mode === 'local') return { mode: 'local' };
  if (target?.mode === 'origin') return { mode: 'origin' };
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
  return parsed !== null
    && parsed.protocol === 'https:'
    && parsed.port !== String(PYCORE_PORT);
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

function isSandbox(): boolean {
  return typeof location !== 'undefined'
    && (location.hostname.includes('run.app') || location.port === '3000');
}

export function isLoopbackPage(): boolean {
  if (typeof location === 'undefined') return false;
  const h = location.hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h === '::1';
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

export function pycoreLocalConnectionHint(): string {
  return `${directPycoreHost()}:${PYCORE_PORT} (direct)`;
}

export function isPycoreSecureContext(): boolean {
  if (typeof window === 'undefined') return false;
  if (isSandbox()) return false;
  return !!window.isSecureContext;
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

export function pnaBlockedReason(host: string | null): string | null {
  // Relay entries never touch the loopback directly - no PNA surface.
  if (isPycoreRelayMode()) return null;
  if (isPycoreSecureContext()) return null;
  if (!host) return null;
  const h = host.toLowerCase();
  const isLoopback = h === '127.0.0.1' || h === 'localhost' || h === '::1';
  const isPrivate = isLoopback
    || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h)
    || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) || h.startsWith('fd') || h.startsWith('fc');
  if (!isPrivate) return null;
  return `This page is not a secure context (HTTP on a public IP). The browser blocks direct access to ${host}:${PYCORE_PORT} via Private Network Access. Switch to the HTTPS relay backend or use a localhost origin.`;
}

export function getPycoreTargetRecent(): string[] {
  const recent = StorageManager.get<unknown[]>(StorageKeys.TARGET_RECENT, []);
  return Array.isArray(recent) ? recent.filter((value): value is string => typeof value === 'string') : [];
}

export function getPycoreTargetPresets(): PycorePresetHost[] {
  const relayPreset = relayBackendPreset();
  return relayPreset ? [relayPreset, ...PRESET_HOSTS] : PRESET_HOSTS;
}

/**
 * Contract-rendered HTTPS relay preset (PART_3 §3.6): on a domain-served
 * HTTPS page the server-side relay entry is `https://api.<prefix>.<domain>`
 * - prefix from the shell-written domain config (not hardcoded), domain
 * from the page origin. Null on loopback/IP pages and plain-HTTP dev shells
 * (no same-origin relay entry exists there).
 */
function relayBackendPreset(): PycorePresetHost | null {
  if (typeof location === 'undefined' || location.protocol !== 'https:') return null;
  const hostname = location.hostname.toLowerCase();
  const labels = hostname.split('.');
  if (labels.length < 2 || /^\d+\x2e?/.test(hostname) || hostname === 'localhost') return null;
  const prefix = getApiRegionPrefix();
  const relayHost = `api.${prefix}.${labels.slice(-2).join('.')}`;
  return {
    host: relayHost,
    url: `https://${relayHost}`,
    label: 'Relay (this server)',
    hint: 'https relay scheme - rides the designated machine',
  };
}

/** Legacy direct-host normalizer (preset entries stay bare hosts). */
export function normalizePycoreHost(input: string): string {
  const url = normalizePycoreBackendUrl(input);
  if (!url) return '';
  return parseBackendUrl(url)?.hostname ?? '';
}

export function setPycoreTarget(target: PycoreTarget): void {
  if (target.mode === 'remote') {
    // Accept a stored url, a legacy host, or raw user input alike.
    const raw = target.url
      || (typeof (target as { host?: string }).host === 'string' ? (target as { host?: string }).host : '')
      || '';
    const url = normalizePycoreBackendUrl(raw);
    if (!url) return;
    StorageManager.set(StorageKeys.TARGET, { mode: 'remote', url });
    const recent = [url, ...getPycoreTargetRecent().filter((u) => u !== url)].slice(0, 6);
    StorageManager.set(StorageKeys.TARGET_RECENT, recent);
  } else {
    StorageManager.set(StorageKeys.TARGET, { mode: target.mode === 'local' ? 'local' : 'origin' });
  }
  if (typeof location !== 'undefined') location.reload();
}
