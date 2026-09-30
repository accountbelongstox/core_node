/**
 * PycoreTailnetDiscovery - live tailnet machine list for pycore endpoint
 * selection. The UI server answers it from `tailscale status`; every listed
 * machine is a candidate `https://<machine><pycore_path>` entry.
 *
 * A browser page reads it same-origin. A native shell has no UI server of its
 * own, so it reads the document from every known tailnet origin (the contract
 * URL entries plus the origins a client registers, e.g. its Laravel
 * endpoints) through the native HTTP stack, and merges the answers. It starts
 * from the list the build read from `tailscale status` (`__TAILNET_PEERS_SEED__`),
 * so every tailnet machine is offered and asked from the first start.
 */
import {
  SERVICE_CONTRACT_URL_ENTRIES,
  TAILNET_DNS_SUFFIX,
  TAILNET_PEERS_FILE_NAME,
} from '../../contracts/ServiceContract';
import { EMPTY_TAILNET_PEERS, type TailnetPeer, type TailnetPeersDocument } from '../../contracts/TailnetPeers';
import { isNativeAppShell } from '../../network/NativeShell';
import { protocolFetch } from '../../network/ProtocolFetch';

const DISCOVERY_TIMEOUT_MS = 5_000;
const TAILNET_HOST_SUFFIX = `.${TAILNET_DNS_SUFFIX.toLowerCase()}`;

type TailnetListener = (document: TailnetPeersDocument) => void;

declare const __TAILNET_PEERS_SEED__: TailnetPeersDocument | undefined;

let current: TailnetPeersDocument = buildSeed();
let pending: Promise<TailnetPeersDocument> | null = null;
const listeners = new Set<TailnetListener>();
const registeredOrigins = new Set<string>();

function isPeersDocument(value: unknown): value is TailnetPeersDocument {
  const document = value as TailnetPeersDocument;
  return Boolean(document)
    && typeof document.tailnet === 'string'
    && Array.isArray(document.peers)
    && document.peers.every((peer) => typeof peer?.dnsName === 'string' && peer.dnsName !== '');
}

/** The build machine's list; no entry is this page's machine. */
function buildSeed(): TailnetPeersDocument {
  const seed: unknown = typeof __TAILNET_PEERS_SEED__ === 'undefined' ? null : __TAILNET_PEERS_SEED__;
  if (!isPeersDocument(seed)) return EMPTY_TAILNET_PEERS;
  return { tailnet: seed.tailnet, peers: seed.peers.map((peer) => ({ ...peer, self: false })) };
}

/** `https://<machine>.<tailnet>.ts.net` of a URL on the tailnet; '' otherwise. */
function tailnetOrigin(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.toLowerCase().endsWith(TAILNET_HOST_SUFFIX)
      ? parsed.origin
      : '';
  } catch {
    return '';
  }
}

function discoveryUrls(): string[] {
  if (!isNativeAppShell()) return [`/${TAILNET_PEERS_FILE_NAME}`];
  const origins = new Set<string>(registeredOrigins);
  SERVICE_CONTRACT_URL_ENTRIES.forEach((entry) => {
    const origin = tailnetOrigin(entry.url);
    if (origin) origins.add(origin);
  });
  current.peers.forEach((peer) => {
    if (peer.online) origins.add(`https://${peer.dnsName}`);
  });
  return [...origins].map((origin) => `${origin}/${TAILNET_PEERS_FILE_NAME}`);
}

async function readDocument(url: string): Promise<TailnetPeersDocument | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const response = await protocolFetch(url, { cache: 'no-store', signal: controller.signal });
    if (!response.ok) return null;
    const document: unknown = await response.json();
    return isPeersDocument(document) ? document : null;
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

/** Re-read the live list (shared in-flight request); keeps the last list on failure. */
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
