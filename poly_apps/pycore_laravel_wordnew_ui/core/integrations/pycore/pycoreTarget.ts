/**
 * pycoreTarget - shared selection of the active Pycore service backend.
 *
 * Every endpoint has an explicit kind, fixed by the contract (never guessed):
 *   - direct: `http://<loopback>:59000` - only from a loopback page on the
 *     pycore machine (K7a).
 *   - proxy:  `https://<machine>.<tailnet>.ts.net<pycore_path>` - the 175
 *     FrankenPHP tailnet mount of that machine's loopback pycore; offered for
 *     every live tailnet machine (discovered, never static) to loopback pages
 *     and pages of the same tailnet.
 *   - relay:  any other https entry - the server-side relay; requests ride the
 *     paired machine (PycoreLaravelRelayTransport).
 */
import {
  PYCORE_BACKEND_PORT,
  buildPycoreHttpUrl,
  normalizePycorePath,
} from './pycoreEndpoints';
import { RELAY_CONTRACT } from '../../contracts/RelayContract';
import {
  NEXUS_DASH_FRONTEND_PORT,
  SERVICE_CONTRACT_URL_ENTRIES,
  TAILNET_DNS_SUFFIX,
  TAILNET_PYCORE_LEGACY_PATHS,
  TAILNET_PYCORE_PATH,
} from '../../contracts/ServiceContract';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';
import { getWebAccessConfig } from '../../contracts/DomainConfig';
import { DEFAULT_FRONTEND_PORT } from '../../config/FrontendConfig';
import { StorageManager } from '../../persistence';
import { getTailnetPeers } from './PycoreTailnetDiscovery';
import { isNativeAppShell } from '../../network/NativeShell';
import { isLoopbackHost } from '../../network/hostDetection';

export type PycoreEndpointKind = 'direct' | 'proxy' | 'relay';
export type PycoreEndpointSource = 'this_machine' | 'tailnet' | 'relay_origin' | 'contract_url' | 'host_key' | 'recent' | 'lan_scan';

export interface PycoreTarget {
  kind: PycoreEndpointKind;
  /** Full backend base URL (no trailing slash). */
  url: string;
}

export interface PycoreEndpoint extends PycoreTarget {
  label: string;
  source: PycoreEndpointSource;
  /** Tailnet entries: Tailscale's own online flag, OS and self marker. */
  tailnetOnline?: boolean;
  tailnetSelf?: boolean;
  os?: string;
}

interface LegacyStoredTarget {
  mode?: string;
  url?: string;
  host?: string;
  kind?: string;
}

const PYCORE_DASHBOARD_ORIGIN_PORTS = [String(NEXUS_DASH_FRONTEND_PORT), String(PYCORE_BACKEND_PORT)];
const mountPath = (path: string): string => `/${path.replace(/^\/+|\/+$/g, '')}`;
const PROXY_PATH = mountPath(TAILNET_PYCORE_PATH);
const LEGACY_PROXY_PATHS = new Set(TAILNET_PYCORE_LEGACY_PATHS.map(mountPath));
const TAILNET_SUFFIX = `.${TAILNET_DNS_SUFFIX.toLowerCase()}`;
const RECENT_LIMIT = 6;
/** Tailnet machines on these OSes (phones) never run pycore. */
const NON_PYCORE_OS = new Set(['android', 'ios']);

function parseBackendUrl(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function urlPath(parsed: URL): string {
  return parsed.pathname.replace(/\/+$/, '');
}

/** Contract loopback hosts (K7): the only hosts pycore serves to browsers directly. */
export function isPycoreLoopbackHost(host: string): boolean {
  return isLoopbackHost(host);
}

export { isNativeAppShell };

/** A native shell's `localhost` names the phone, never a pycore machine. */
export function isLoopbackPage(): boolean {
  return !isNativeAppShell() && typeof location !== 'undefined' && isPycoreLoopbackHost(location.hostname);
}

/** `<tailnet>.ts.net` of a `<machine>.<tailnet>.ts.net` host; '' otherwise. */
export function tailnetDomainOf(hostname: string): string {
  const host = String(hostname || '').toLowerCase();
  if (!host.endsWith(TAILNET_SUFFIX)) return '';
  const labels = host.split('.');
  return labels.length >= 3 ? labels.slice(1).join('.') : '';
}

function pageTailnetDomain(): string {
  return typeof location === 'undefined' ? '' : tailnetDomainOf(location.hostname);
}

/** The endpoint kind a backend URL has under the contract; null for unusable URLs. */
export function classifyPycoreBackendUrl(url: string): PycoreEndpointKind | null {
  const parsed = parseBackendUrl(url);
  if (!parsed || !parsed.hostname) return null;
  const path = urlPath(parsed);
  if (parsed.protocol === 'https:' && path === PROXY_PATH) return 'proxy';
  if (path === '' && parsed.port === String(PYCORE_BACKEND_PORT)) return 'direct';
  if (parsed.protocol === 'https:') return 'relay';
  return null;
}

/**
 * Normalize user input to a full backend URL. A bare tailnet machine name
 * renders to its proxy entry, any other bare host to the direct form; URLs
 * keep scheme, host, port and path (query/hash dropped).
 */
export function normalizePycoreBackendUrl(input: string): string | null {
  const raw = (input || '').trim();
  if (!raw) return null;
  const hasScheme = /^https?:\/\//i.test(raw);
  const parsed = parseBackendUrl(hasScheme ? raw : `http://${raw}`);
  if (!parsed || !parsed.hostname) return null;
  if (!hasScheme && !parsed.port && urlPath(parsed) === '') {
    return tailnetDomainOf(parsed.hostname)
      ? `https://${parsed.hostname}${PROXY_PATH}`
      : `http://${parsed.hostname}:${PYCORE_BACKEND_PORT}`;
  }
  const path = urlPath(parsed);
  // A tailnet URL on a former pycore mount names the current mount.
  const mount = parsed.protocol === 'https:' && tailnetDomainOf(parsed.hostname) && LEGACY_PROXY_PATHS.has(path) ? PROXY_PATH : path;
  return `${parsed.protocol}//${parsed.host}${mount}`;
}

/** K7a: browsers reach pycore directly only from a loopback page on the pycore machine. */
export function isPycoreDirectAccessAllowed(): boolean {
  return isLoopbackPage();
}

/**
 * Proxy entries answer loopback pages and pages of the same tailnet (175 CORS
 * rule); a native shell calls them through the native HTTP stack (no Origin).
 */
function isProxyAllowed(hostname: string): boolean {
  const tailnet = tailnetDomainOf(hostname);
  if (!tailnet) return false;
  return isNativeAppShell() || isLoopbackPage() || pageTailnetDomain() === tailnet;
}

const PRIVATE_IPV4_RE = /^(10\.\d{1,3}|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}$/;

/** RFC 1918 IPv4 host (a LAN machine). */
export function isPrivateLanHost(hostname: string): boolean {
  return PRIVATE_IPV4_RE.test(String(hostname || '').trim());
}

function isAllowedTarget(target: PycoreTarget): boolean {
  const parsed = parseBackendUrl(target.url);
  if (!parsed || classifyPycoreBackendUrl(target.url) !== target.kind) return false;
  if (target.kind === 'relay') return true;
  if (target.kind === 'proxy') return isProxyAllowed(parsed.hostname);
  // A native shell reaches LAN machines through the native HTTP stack (the K7
  // gate on pycore still decides whether it is admitted).
  if (isNativeAppShell() && isPrivateLanHost(parsed.hostname)) return true;
  return isPycoreDirectAccessAllowed() && isPycoreLoopbackHost(parsed.hostname);
}

function targetFromUrl(input: string): PycoreTarget | null {
  const url = normalizePycoreBackendUrl(input);
  const kind = url ? classifyPycoreBackendUrl(url) : null;
  if (!url || !kind) return null;
  const target = { kind, url };
  return isAllowedTarget(target) ? target : null;
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

/** Page hostname (localhost stays localhost, not 127.0.0.1). */
export function localPycoreHost(): string {
  if (typeof location !== 'undefined' && location.hostname) return location.hostname;
  return '127.0.0.1';
}

export function localPycoreOrigin(): string {
  if (typeof location !== 'undefined' && location.host) return location.host;
  return '127.0.0.1';
}

/** UI served from the Vite dev shell (:13054). */
export function isViteDevShell(): boolean {
  return typeof location !== 'undefined'
    && location.port === String(DEFAULT_FRONTEND_PORT);
}

function directEndpointUrl(host: string): string {
  return buildPycoreHttpUrl(host, '/').replace(/\/+$/, '');
}

/**
 * Contract-rendered HTTPS relay preset (PART_3 §3.6): on a domain-served
 * HTTPS page the server-side relay entry comes from the shared Relay contract.
 * Null on loopback/IP pages, tailnet pages and plain-HTTP dev shells.
 */
function relayBackendPreset(): PycoreEndpoint | null {
  if (!isNativeAppShell()) {
    if (typeof location === 'undefined' || location.protocol !== 'https:') return null;
    const hostname = location.hostname.toLowerCase();
    if (pageTailnetDomain() || hostname.split('.').length < 2 || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)
      || hostname.includes(':') || hostname === 'localhost') return null;
  }
  const relayUrl = String(RELAY_CONTRACT.public_urls.laravel_api_origin || '').replace(/\/+$/, '');
  const parsedRelay = parseBackendUrl(relayUrl);
  if (!parsedRelay || parsedRelay.protocol !== 'https:') return null;
  return { kind: 'relay', url: relayUrl, label: parsedRelay.hostname, source: 'relay_origin' };
}

/** The page's own backend when nothing (valid) is stored. */
function defaultTarget(): PycoreTarget {
  if (isNativeAppShell()) {
    // The contract machines (GPU first), then discovered tailnet machines; relay last.
    const preferred = listPycoreEndpoints().find((endpoint) => endpoint.kind !== 'relay' && endpoint.tailnetOnline !== false)
      ?? relayBackendPreset();
    if (preferred) return { kind: preferred.kind, url: preferred.url };
  }
  if (isLoopbackPage()) return { kind: 'direct', url: directEndpointUrl(localPycoreHost()) };
  if (pageTailnetDomain()) return { kind: 'proxy', url: `https://${location.hostname.toLowerCase()}${PROXY_PATH}` };
  const relay = relayBackendPreset();
  if (relay) return { kind: relay.kind, url: relay.url };
  return { kind: 'direct', url: directEndpointUrl(localPycoreHost()) };
}

function storedTarget(): PycoreTarget | null {
  const stored = StorageManager.get<LegacyStoredTarget | null>(StorageKeys.TARGET, null);
  if (!stored) return null;
  // Legacy {mode:'origin'|'local'} meant this page's own backend (the default).
  if (stored.mode === 'origin' || stored.mode === 'local') return null;
  const target = targetFromUrl(String(stored.url || stored.host || ''));
  if (target && (stored.kind !== target.kind || stored.url !== target.url || stored.mode !== undefined)) {
    StorageManager.set(StorageKeys.TARGET, target);
  }
  return target;
}

/**
 * Session target: set for this page lifetime only (e.g. a LAN pycore found by a
 * scan), read before the stored choice by every request, never persisted - the
 * next start uses the stored / default target again.
 */
let sessionTarget: PycoreTarget | null = null;

export function setPycoreSessionTarget(input: string | null): boolean {
  if (input === null) {
    sessionTarget = null;
    return true;
  }
  const target = targetFromUrl(input);
  if (!target) return false;
  sessionTarget = target;
  return true;
}

export function getPycoreSessionTarget(): PycoreTarget | null {
  return sessionTarget;
}

function readTarget(): PycoreTarget {
  return sessionTarget ?? storedTarget() ?? defaultTarget();
}

export function getPycoreTarget(): PycoreTarget {
  return readTarget();
}

/** True when the active target is the page's own default backend. */
export function isPycoreDefaultTarget(): boolean {
  return readTarget().url === defaultTarget().url;
}

/** Full backend URL of the active target. */
export function pycoreTargetBackendUrl(): string {
  return readTarget().url;
}

export function isPycoreRelayMode(): boolean {
  return readTarget().kind === 'relay';
}

export function isPycoreProxyMode(): boolean {
  return readTarget().kind === 'proxy';
}

/** Any target other than a direct loopback backend. */
export function isPycoreRemote(): boolean {
  return readTarget().kind !== 'direct';
}

/** Host of a direct target (null for proxy and relay entries). */
export function pycoreTargetHost(): string | null {
  const target = readTarget();
  if (target.kind !== 'direct') return null;
  return parseBackendUrl(target.url)?.hostname ?? null;
}

/** Host for direct :59000 calls - a direct target's host, else the page host. */
export function directPycoreHost(): string {
  return pycoreTargetHost() ?? localPycoreHost();
}

export function pycoreEffectiveHost(): string {
  return directPycoreHost();
}

/** Resolve a relative pycore path to a full URL on the active backend. */
export function rewritePycoreEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const target = readTarget();
  if (target.kind === 'direct' && typeof location !== 'undefined' && location.port === String(PYCORE_BACKEND_PORT)
    && pycoreTargetHost() === location.hostname) {
    return normalizePycorePath(endpoint);
  }
  return `${target.url}${normalizePycorePath(endpoint)}`;
}

export function getPycoreTargetRecent(): string[] {
  const recent = StorageManager.get<unknown[]>(StorageKeys.TARGET_RECENT, []);
  return Array.isArray(recent)
    ? recent
      .map((value) => (typeof value === 'string' ? targetFromUrl(value)?.url : null))
      .filter((value): value is string => Boolean(value))
    : [];
}

function tailnetEndpoints(): PycoreEndpoint[] {
  const document = getTailnetPeers();
  return document.peers
    .filter((peer) => !NON_PYCORE_OS.has(peer.os.toLowerCase()))
    .map((peer): PycoreEndpoint => ({
      kind: 'proxy',
      url: `https://${peer.dnsName}${PROXY_PATH}`,
      label: peer.dnsName.split('.')[0],
      source: 'tailnet',
      tailnetOnline: peer.online,
      tailnetSelf: peer.self,
      os: peer.os,
    }))
    .filter((endpoint) => isAllowedTarget(endpoint));
}

/**
 * The pycore mount of a contract service URL on the tailnet: a contract entry
 * names a machine (e.g. the GPU machine's `/laravel-api`); its pycore is that
 * machine's `/pycore` mount, never the Laravel URL itself.
 */
function contractMachineEndpoint(entry: { label: string; url: string }): PycoreEndpoint | null {
  const parsed = parseBackendUrl(entry.url);
  if (!parsed || parsed.protocol !== 'https:' || !tailnetDomainOf(parsed.hostname)) return null;
  const target = targetFromUrl(`https://${parsed.hostname.toLowerCase()}${PROXY_PATH}`);
  return target ? { ...target, label: entry.label, source: 'contract_url' } : null;
}

/**
 * Every selectable backend, deduplicated by URL, in preference order: this
 * machine (loopback pages), the contract tailnet machines (the GPU machine
 * first), every tailnet machine discovered at run time, recent user entries,
 * then the relay entry. pycore never runs on the Laravel server: a contract
 * host is offered only as a loopback direct entry (loopback pages) - other
 * hosts cannot be reached by a browser under K7.
 */
export function listPycoreEndpoints(): PycoreEndpoint[] {
  const config = getWebAccessConfig();
  const candidates: PycoreEndpoint[] = [];
  if (isLoopbackPage()) {
    candidates.push({ kind: 'direct', url: directEndpointUrl(localPycoreHost()), label: localPycoreHost(), source: 'this_machine' });
  }
  SERVICE_CONTRACT_URL_ENTRIES.forEach((entry) => {
    const endpoint = contractMachineEndpoint(entry);
    if (endpoint) candidates.push(endpoint);
  });
  candidates.push(...tailnetEndpoints());
  config.serviceHostKeys.pycore.forEach((key) => {
    const target = targetFromUrl(config.hosts[key] || '');
    // Only a loopback direct entry is usable (K7); a loopback page lists it already.
    if (target?.kind === 'direct' && !isLoopbackPage()) {
      candidates.push({ ...target, label: key, source: 'host_key' });
    }
  });
  getPycoreTargetRecent().forEach((url) => {
    const target = targetFromUrl(url);
    if (target) candidates.push({ ...target, label: parseBackendUrl(url)?.host ?? url, source: 'recent' });
  });
  const relay = relayBackendPreset();
  if (relay) candidates.push(relay);
  const seen = new Set<string>();
  return candidates.filter((endpoint) => {
    if (seen.has(endpoint.url)) return false;
    seen.add(endpoint.url);
    return true;
  });
}

/** Drop a user-added entry; the active target falls back to the default when it was that entry. */
export function forgetPycoreTargetRecent(url: string): void {
  const recent = getPycoreTargetRecent().filter((entry) => entry !== url);
  StorageManager.set(StorageKeys.TARGET_RECENT, recent);
  if (readTarget().url === url) StorageManager.remove(StorageKeys.TARGET);
}

export interface SetPycoreTargetOptions {
  /** Reload the page after the change (default). Clients that re-read the
   *  target per request (the wordnew link) switch in place. */
  reload?: boolean;
}

/** Persist a target (and reload); false (nothing changes) for a target this page may not use. */
/** Record a usable entry in the recent list without selecting it; its URL, or null. */
export function rememberPycoreTarget(input: string): string | null {
  const target = targetFromUrl(input);
  if (!target) return null;
  const recent = [target.url, ...getPycoreTargetRecent().filter((url) => url !== target.url)].slice(0, RECENT_LIMIT);
  StorageManager.set(StorageKeys.TARGET_RECENT, recent);
  return target.url;
}

export function setPycoreTarget(input: string, options: SetPycoreTargetOptions = {}): boolean {
  const target = targetFromUrl(input);
  if (!target || !rememberPycoreTarget(target.url)) return false;
  if (target.url === defaultTarget().url) {
    StorageManager.remove(StorageKeys.TARGET);
  } else {
    StorageManager.set(StorageKeys.TARGET, target);
  }
  if (options.reload !== false && typeof location !== 'undefined') location.reload();
  return true;
}
