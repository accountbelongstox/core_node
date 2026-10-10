/**
 * pycoreTarget - shared selection of the active Pycore service backend.
 *
 * Every endpoint has an explicit kind, fixed by the contract (never guessed):
 *   - direct: `http://<loopback>:59000` - only from a loopback page on the
 *     pycore machine (K7a).
 *   - proxy:  `https://<machine>.<tailnet domain><pycore_path>` - the 175
 *     FrankenPHP tailnet mount of that machine's loopback pycore; offered for
 *     every live tailnet machine (discovered, never static) to loopback pages
 *     and pages of the same tailnet.
 *   - relay:  any other https entry - the server-side relay; requests ride the
 *     paired machine (RelayTransport).
 *
 * LAN route: a native shell reaches the selected machine's pycore at a LAN
 * address that machine reported (`http://<RFC 1918 host>:59000`, open to a
 * private LAN peer, no key). The route only changes the address requests use; the
 * selection, and its availability (`pycoreLink`), stay the same machine.
 */
import {
  PYCORE_BACKEND_PORT,
  buildPycoreHttpUrl,
  normalizePycorePath,
  pycoreHttpProto,
} from './pycoreEndpoints';
import { RELAY_CONTRACT } from '../../contracts/RelayContract';
import {
  NEXUS_DASH_FRONTEND_PORT,
  TAILNET_PYCORE_LEGACY_PATHS,
  TAILNET_PYCORE_PATH,
} from '../../contracts/ServiceContract';
import { tailnetDomainOf } from '../../contracts/MeshDomain';
import { PycoreStorageKeys as StorageKeys } from './PycoreStorageKeys';
import { getWebAccessConfig } from '../../contracts/DomainConfig';
import { DEFAULT_FRONTEND_PORT } from '../../config/FrontendConfig';
import { StorageManager } from '../../persistence';
import { getServiceUrlEntries, getTailnetPeers, getTailnetServerPeers } from '../../network/TailnetDiscovery';
import { isNativeAppShell } from '../../network/NativeShell';
import { isPrivateIpv4 } from '../../network/LanDiscovery';
import { isLoopbackHost } from '../../network/hostDetection';

export type PycoreEndpointKind = 'direct' | 'proxy' | 'relay';
export type PycoreEndpointSource = 'this_machine' | 'tailnet' | 'relay_origin' | 'contract_url' | 'host_key' | 'recent' | 'lan_scan' | 'lan';

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
const RECENT_LIMIT = 6;

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

export { isNativeAppShell, tailnetDomainOf };

/** A native shell's `localhost` names the phone, never a pycore machine. */
export function isLoopbackPage(): boolean {
  return !isNativeAppShell() && typeof location !== 'undefined' && isPycoreLoopbackHost(location.hostname);
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
  const scheme = pycoreHttpProto();
  const parsed = parseBackendUrl(hasScheme ? raw : `${scheme}://${raw}`);
  if (!parsed || !parsed.hostname) return null;
  if (!hasScheme && !parsed.port && urlPath(parsed) === '') {
    return tailnetDomainOf(parsed.hostname)
      ? `https://${parsed.hostname}${PROXY_PATH}`
      : `${scheme}://${parsed.hostname}:${PYCORE_BACKEND_PORT}`;
  }
  const path = urlPath(parsed);
  // A tailnet URL on a former pycore mount names the current mount.
  const mount = parsed.protocol === 'https:' && tailnetDomainOf(parsed.hostname) && LEGACY_PROXY_PATHS.has(path) ? PROXY_PATH : path;
  return `${parsed.protocol}//${parsed.host}${mount}`;
}

/**
 * The backend a non-loopback page derives from its own origin: `<page scheme>://<page host>:59000`.
 * Null on loopback, tailnet and native pages and on domain-served HTTPS pages (those use the relay).
 */
export function pageHostBackendUrl(): string | null {
  if (typeof location === 'undefined' || isNativeAppShell() || isLoopbackPage() || pageTailnetDomain()) return null;
  if (relayBackendPreset()) return null;
  const parsed = parseBackendUrl(location.origin);
  if (!parsed || !parsed.hostname || (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')) return null;
  parsed.port = String(PYCORE_BACKEND_PORT);
  return parsed.origin;
}

/** True when the active target is the backend derived from this page's host. */
export function isPycorePageHostTarget(): boolean {
  const pageHost = pageHostBackendUrl();
  const target = readTarget();
  return pageHost !== null && target.kind === 'direct' && target.url === pageHost;
}

/** K7a: a loopback page, or a page whose own host is offered as a candidate (K3 still decides on pycore). */
export function isPycoreDirectAccessAllowed(): boolean {
  return isLoopbackPage() || pageHostBackendUrl() !== null;
}

/**
 * Proxy entries answer loopback pages and pages of the same tailnet (175 CORS
 * rule); a native shell calls them through the native HTTP stack (no Origin).
 */
function isProxyAllowed(hostname: string): boolean {
  const tailnet = tailnetDomainOf(hostname);
  if (!tailnet) return false;
  return isNativeAppShell() || isLoopbackPage() || isLanPage() || pageTailnetDomain() === tailnet;
}


/** RFC 1918 IPv4 host (a LAN machine). */
export function isPrivateLanHost(hostname: string): boolean {
  return isPrivateIpv4(String(hostname || '').trim());
}

/** A browser page served from a LAN machine's own address (`http://192.168.x.y:<ui port>`). */
export function isLanPage(): boolean {
  return typeof location !== 'undefined' && !isNativeAppShell() && isPrivateLanHost(location.hostname) && pageHostBackendUrl() !== null;
}

/**
 * The pycore this page asks about its LAN and tailnet (never a selection): the loopback pycore of a
 * loopback page, the page host's pycore of a LAN page. Null on native shells (their roster path
 * reports LAN machines) and on tailnet / relay pages.
 */
export function pycoreLanSourceUrl(): string | null {
  if (isLoopbackPage()) return directEndpointUrl(localPycoreHost());
  return isLanPage() ? pageHostBackendUrl() : null;
}

function isAllowedTarget(target: PycoreTarget): boolean {
  const parsed = parseBackendUrl(target.url);
  if (!parsed || classifyPycoreBackendUrl(target.url) !== target.kind) return false;
  // The relay entry is the contract relay origin and exists only on pages that
  // offer it (never on loopback, tailnet or plain-HTTP pages), so a direct or
  // proxy page can never be switched into relay mode by a stored or typed URL.
  if (target.kind === 'relay') return relayBackendPreset()?.url === target.url;
  if (target.kind === 'proxy') return isProxyAllowed(parsed.hostname);
  if (target.kind === 'direct' && target.url === pageHostBackendUrl()) return true;
  // A native shell or a LAN page reaches LAN machines directly (the K7 gate on
  // pycore still decides whether it is admitted).
  if ((isNativeAppShell() || isLanPage()) && isPrivateLanHost(parsed.hostname)) return true;
  // Loopback names the viewer's own machine: only a page on the pycore machine itself reaches pycore there.
  return isLoopbackPage() && isPycoreLoopbackHost(parsed.hostname);
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
    // A machine the live tailnet list reports online (contract machines first); relay last.
    // An entry the list does not confirm (a contract machine absent from the tailnet) never is the default.
    const preferred = listPycoreEndpoints().find((endpoint) => endpoint.kind !== 'relay' && endpoint.tailnetOnline === true)
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
/** LAN address of the selected machine requests use while it answers (null: the selection's own URL). */
let lanRoute: PycoreTarget | null = null;
/** LAN entries the machines reported (Laravel work-node roster), offered as candidates. */
let lanEndpoints: PycoreEndpoint[] = [];

const targetListeners = new Set<() => void>();

/** Fires when the effective target (session entry or persisted choice) changes without a reload. */
export function subscribePycoreTarget(listener: () => void): () => void {
  targetListeners.add(listener);
  return () => { targetListeners.delete(listener); };
}

function notifyPycoreTarget(): void {
  targetListeners.forEach((listener) => listener());
}

export function setPycoreSessionTarget(input: string | null): boolean {
  if (input === null) {
    sessionTarget = null;
    notifyPycoreTarget();
    return true;
  }
  const target = targetFromUrl(input);
  if (!target) return false;
  sessionTarget = target;
  notifyPycoreTarget();
  return true;
}

export function getPycoreSessionTarget(): PycoreTarget | null {
  return sessionTarget;
}

/** Route requests of the selection over a LAN address of the same machine (null: leave the route). */
export function setPycoreLanRoute(input: string | null): boolean {
  const target = input === null ? null : targetFromUrl(input);
  if (input !== null && target?.kind !== 'direct') return false;
  if ((lanRoute?.url ?? null) === (target?.url ?? null)) return true;
  lanRoute = target;
  notifyPycoreTarget();
  return true;
}

export function getPycoreLanRoute(): PycoreTarget | null {
  return lanRoute;
}

const LAN_URLS_PER_HOST = 4;

/**
 * LAN URLs per machine (host label) as last reported, merged with `reported`: a machine that left
 * the roster for a while (restarting, busy) keeps its last URLs; a probe decides whether they answer.
 */
export function rememberPycoreLanUrls(reported: Map<string, string[]>): Map<string, string[]> {
  const stored = StorageManager.get<Record<string, unknown> | null>(StorageKeys.LAN_URLS, null) ?? {};
  const merged = new Map<string, string[]>();
  Object.entries(stored).forEach(([host, urls]) => {
    if (Array.isArray(urls)) merged.set(host, urls.filter((url): url is string => typeof url === 'string' && targetFromUrl(url)?.kind === 'direct'));
  });
  reported.forEach((urls, host) => merged.set(host, urls.filter((url) => targetFromUrl(url)?.kind === 'direct').slice(0, LAN_URLS_PER_HOST)));
  StorageManager.set(StorageKeys.LAN_URLS, Object.fromEntries(merged));
  return merged;
}

/** Replace the LAN candidates (every entry must be a usable direct LAN URL). */
export function setPycoreLanEndpoints(entries: Array<{ url: string; label: string }>): void {
  lanEndpoints = entries.flatMap((entry): PycoreEndpoint[] => {
    const target = targetFromUrl(entry.url);
    return target?.kind === 'direct' ? [{ ...target, label: entry.label, source: 'lan' }] : [];
  });
}

/** The selection without the LAN route: the address the event socket keeps (no signed WebSocket upgrade). */
function readSelectedTarget(): PycoreTarget {
  return sessionTarget ?? storedTarget() ?? defaultTarget();
}

function readTarget(): PycoreTarget {
  return sessionTarget ?? lanRoute ?? storedTarget() ?? defaultTarget();
}

export function getPycoreTarget(): PycoreTarget {
  return readTarget();
}

/** URLs that reach the selected machine: the selection and, while active, its LAN route. */
export function getPycoreSelectionUrls(): string[] {
  return Array.from(new Set([readSelectedTarget().url, readTarget().url]));
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

/** Full URL of a pycore path on the selection itself, never the LAN route (the event socket). */
export function rewritePycoreSelectedEndpoint(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return lanRoute && !sessionTarget ? `${readSelectedTarget().url}${normalizePycorePath(endpoint)}` : rewritePycoreEndpoint(endpoint);
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
  return getTailnetServerPeers()
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
 * Tailscale's online flag of a machine in the live list; false for a machine a
 * non-empty list does not contain (it is not on this tailnet); unknown without a list.
 */
function tailnetPresence(hostname: string): boolean | undefined {
  const peers = getTailnetPeers().peers;
  if (peers.length === 0) return undefined;
  return peers.find((peer) => peer.dnsName.toLowerCase() === hostname)?.online ?? false;
}

/**
 * The pycore mount of a contract service URL on the tailnet: a contract entry
 * names a machine (e.g. the GPU machine's `/laravel-api`); its pycore is that
 * machine's `/pycore-api` mount, never the Laravel URL itself. Its availability
 * is the live tailnet list's, never assumed from the static entry.
 */
function contractMachineEndpoint(entry: { label: string; url: string }): PycoreEndpoint | null {
  const parsed = parseBackendUrl(entry.url);
  if (!parsed || parsed.protocol !== 'https:' || !tailnetDomainOf(parsed.hostname)) return null;
  const hostname = parsed.hostname.toLowerCase();
  const target = targetFromUrl(`https://${hostname}${PROXY_PATH}`);
  return target ? { ...target, label: entry.label, source: 'contract_url', tailnetOnline: tailnetPresence(hostname) } : null;
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
  const pageHost = pageHostBackendUrl();
  if (pageHost) candidates.push({ kind: 'direct', url: pageHost, label: location.hostname, source: 'this_machine' });
  getServiceUrlEntries().forEach((entry) => {
    const endpoint = contractMachineEndpoint(entry);
    if (endpoint) candidates.push(endpoint);
  });
  candidates.push(...tailnetEndpoints());
  candidates.push(...lanEndpoints);
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

/** Record a usable entry in the recent list without selecting it; its URL, or null. */
export function rememberPycoreTarget(input: string): string | null {
  const target = targetFromUrl(input);
  if (!target) return null;
  const recent = [target.url, ...getPycoreTargetRecent().filter((url) => url !== target.url)].slice(0, RECENT_LIMIT);
  StorageManager.set(StorageKeys.TARGET_RECENT, recent);
  return target.url;
}

/**
 * Persist a target (and reload); false (nothing changes) for a target this page
 * may not use. The choice is always stored: a default that moves with the
 * discovered machines never replaces it.
 */
export function setPycoreTarget(input: string, options: SetPycoreTargetOptions = {}): boolean {
  const target = targetFromUrl(input);
  if (!target || !rememberPycoreTarget(target.url)) return false;
  StorageManager.set(StorageKeys.TARGET, target);
  notifyPycoreTarget();
  if (options.reload !== false && typeof location !== 'undefined') location.reload();
  return true;
}

/** The persisted choice usable on this page (null: none made yet). */
export function getPycoreSelectedTarget(): PycoreTarget | null {
  return storedTarget();
}
