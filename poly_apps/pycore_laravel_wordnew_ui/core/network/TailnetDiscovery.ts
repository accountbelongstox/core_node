/**
 * TailnetDiscovery - the tailnet machine list every service endpoint list
 * (Laravel `/laravel-api`, pycore `/pycore-api`) is built from.
 *
 * Built or not, the list is live. The build reads `tailscale status` once and
 * bakes the result in as the starting list (`__TAILNET_PEERS_SEED__`).
 * Refreshing asks the machines that publish the list:
 *   - the UI server (`/tailnet_peers.json`, dev and preview servers), and
 *   - pycore (`<pycore mount><peers_route>`, every machine that runs it),
 * both answering from that machine's `tailscale status`. A page asks its own
 * origin. A native app (which cannot list the tailnet itself: Tailscale on a
 * phone exposes no peer list to other apps) asks every known tailnet machine -
 * the starting list, the contract entries and its clients' endpoints - through
 * the native HTTP stack, and merges the answers; machines found that way are
 * asked on the next refresh too.
 */
import {
  PYCORE_BACKEND_PORT,
  SERVICE_CONTRACT_URL_ENTRIES,
  TAILNET_PEERS_FILE_NAME,
  TAILNET_CLIENT_ONLY_OS,
  TAILNET_PEERS_ROUTE,
  TAILNET_PYCORE_PATH,
} from '../contracts/ServiceContract';
import { EMPTY_TAILNET_PEERS, type TailnetPeer, type TailnetPeersDocument } from '../contracts/TailnetPeers';
import { resolveMeshUrl, tailnetDomainOf } from '../contracts/MeshDomain';
import { isNativeAppShell } from './NativeShell';
import { protocolFetch } from './ProtocolFetch';

const DISCOVERY_TIMEOUT_MS = 5_000;

type TailnetListener = (document: TailnetPeersDocument) => void;

declare const __TAILNET_PEERS_SEED__: TailnetPeersDocument | undefined;
declare const __TAILNET_PEERS_LIVE__: boolean | undefined;

const CLIENT_ONLY_OS = new Set(TAILNET_CLIENT_ONLY_OS);
/** The page is served by the dev server that read the starting list: its `self` machine is this page's machine. */
const SEED_FROM_PAGE_SERVER = typeof __TAILNET_PEERS_LIVE__ !== 'undefined' && __TAILNET_PEERS_LIVE__ === true;

let current: TailnetPeersDocument = buildSeed();
let pending: Promise<TailnetPeersDocument> | null = null;
const listeners = new Set<TailnetListener>();
const registeredOrigins = new Set<string>();
/** Peers documents of other machines' pycore (LAN machines): their `self` marker names that machine, not this page's. */
const registeredPublishers = new Set<string>();

function isPeersDocument(value: unknown): value is TailnetPeersDocument {
  const document = value as TailnetPeersDocument;
  return Boolean(document)
    && typeof document.tailnet === 'string'
    && Array.isArray(document.peers)
    && document.peers.every((peer) => typeof peer?.dnsName === 'string' && peer.dnsName !== '');
}

/**
 * The list the build / dev server read. The dev server serves this page, so its
 * own machine is this page's machine; a built bundle runs anywhere (no self).
 */
function buildSeed(): TailnetPeersDocument {
  const seed: unknown = typeof __TAILNET_PEERS_SEED__ === 'undefined' ? null : __TAILNET_PEERS_SEED__;
  if (!isPeersDocument(seed)) return EMPTY_TAILNET_PEERS;
  const keepSelf = SEED_FROM_PAGE_SERVER && !isNativeAppShell();
  return { tailnet: seed.tailnet, peers: seed.peers.map((peer) => ({ ...peer, self: keepSelf && peer.self })) };
}

/** `https://<machine>.<tailnet domain>` of a URL on the tailnet; '' otherwise. */
function tailnetOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && tailnetDomainOf(parsed.hostname)
      ? parsed.origin
      : '';
  } catch {
    return '';
  }
}

const PYCORE_PEERS_PATH = `/${TAILNET_PYCORE_PATH.replace(/^\/+|\/+$/g, '')}${TAILNET_PEERS_ROUTE}`;

/** Both publishers of a machine: its UI server and its pycore. */
function publisherUrls(origin: string): string[] {
  return [`${origin}/${TAILNET_PEERS_FILE_NAME}`, `${origin}${PYCORE_PEERS_PATH}`];
}

/** The page host's own pycore (direct :59000): it lists the tailnet of its machine whatever serves the UI. */
function pageHostPycoreUrl(): string[] {
  if (typeof location === 'undefined' || !location.hostname) return [];
  const scheme = location.protocol === 'https:' ? 'https' : 'http';
  return [`${scheme}://${location.hostname}:${PYCORE_BACKEND_PORT}${TAILNET_PEERS_ROUTE}`];
}

function discoveryUrls(): string[] {
  if (!isNativeAppShell()) {
    // A tailnet page also reaches its machine's pycore through the same-origin mount.
    const onTailnet = typeof location !== 'undefined' && tailnetOrigin(location.origin) !== '';
    const own = onTailnet ? publisherUrls('') : [`/${TAILNET_PEERS_FILE_NAME}`, ...pageHostPycoreUrl()];
    return [...new Set([...own, ...registeredPublishers])];
  }
  const origins = new Set<string>(registeredOrigins);
  getServiceUrlEntries().forEach((entry) => {
    const origin = tailnetOrigin(entry.url);
    if (origin) origins.add(origin);
  });
  getTailnetServerPeers().forEach((peer) => {
    if (peer.online) origins.add(`https://${peer.dnsName}`);
  });
  return [...new Set([...[...origins].flatMap(publisherUrls), ...registeredPublishers])];
}

async function readDocument(url: string): Promise<TailnetPeersDocument | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const response = await protocolFetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    const document: unknown = await response.json();
    if (!isPeersDocument(document)) return null;
    return registeredPublishers.has(url)
      ? { ...document, peers: document.peers.map((peer) => ({ ...peer, self: false })) }
      : document;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** One document from several answers: peers by DNS name, an online report wins. */
function mergeDocuments(documents: TailnetPeersDocument[]): TailnetPeersDocument {
  const peers = new Map<string, TailnetPeer>();
  documents.forEach((document) => document.peers.forEach((peer) => {
    const known = peers.get(peer.dnsName);
    // A native shell is never one of the listed machines.
    const next = isNativeAppShell() ? { ...peer, self: false } : peer;
    if (!known || (!known.online && next.online)) peers.set(peer.dnsName, next);
  }));
  return { tailnet: documents.find((document) => document.tailnet)?.tailnet ?? '', peers: [...peers.values()] };
}

export function getTailnetPeers(): TailnetPeersDocument {
  return current;
}

/** Contract URL entries on the live tailnet domain (the active mesh provider's), else the default provider's. */
export function getServiceUrlEntries(): { key: string; label: string; url: string }[] {
  return SERVICE_CONTRACT_URL_ENTRIES.map((entry) => ({ ...entry, url: resolveMeshUrl(entry.url, current.tailnet) }));
}

/** Machines that can serve an API (phones excluded). */
export function getTailnetServerPeers(): TailnetPeer[] {
  return current.peers.filter((peer) => !CLIENT_ONLY_OS.has(peer.os.toLowerCase()));
}

/**
 * Origins a native shell also asks for the peers document (only `https`
 * tailnet origins are kept). Returns true when a new origin was added.
 */
export function addTailnetDiscoveryOrigins(urls: string[]): boolean {
  const before = registeredOrigins.size;
  urls.forEach((url) => {
    const origin = tailnetOrigin(url);
    if (origin) registeredOrigins.add(origin);
  });
  return registeredOrigins.size !== before;
}

/**
 * Peers documents of other machines' pycore a page also asks (the LAN machines found by the scan).
 * Returns true when a new publisher was added.
 */
export function addTailnetPublishers(urls: string[]): boolean {
  const before = registeredPublishers.size;
  urls.forEach((url) => { if (/^https?:\/\//i.test(url)) registeredPublishers.add(url); });
  return registeredPublishers.size !== before;
}

/** Re-read the live list (shared in-flight request; keeps the last list when nothing answers). */
export function refreshTailnetPeers(): Promise<TailnetPeersDocument> {
  if (pending) return pending;
  pending = Promise.all(discoveryUrls().map(readDocument))
    .then((answers) => {
      const documents = answers.filter((document): document is TailnetPeersDocument => document !== null);
      if (documents.length > 0) {
        current = mergeDocuments(documents);
        listeners.forEach((listener) => listener(current));
      }
      return current;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

export function subscribeTailnetPeers(listener: TailnetListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
