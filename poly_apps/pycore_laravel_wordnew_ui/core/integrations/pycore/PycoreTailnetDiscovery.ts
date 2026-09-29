/**
 * PycoreTailnetDiscovery - live tailnet machine list for pycore endpoint
 * selection. The UI server answers it same-origin from `tailscale status`;
 * every listed machine is a candidate `https://<machine><pycore_path>` entry.
 */
import { TAILNET_PEERS_FILE_NAME } from '../../contracts/ServiceContract';
import { EMPTY_TAILNET_PEERS, type TailnetPeersDocument } from '../../contracts/TailnetPeers';

const DISCOVERY_TIMEOUT_MS = 5_000;

type TailnetListener = (document: TailnetPeersDocument) => void;

let current: TailnetPeersDocument = EMPTY_TAILNET_PEERS;
let pending: Promise<TailnetPeersDocument> | null = null;
const listeners = new Set<TailnetListener>();

function isPeersDocument(value: unknown): value is TailnetPeersDocument {
  const document = value as TailnetPeersDocument;
  return Boolean(document)
    && typeof document.tailnet === 'string'
    && Array.isArray(document.peers)
    && document.peers.every((peer) => typeof peer?.dnsName === 'string' && peer.dnsName !== '');
}

export function getTailnetPeers(): TailnetPeersDocument {
  return current;
}

/** Re-read the live list (shared in-flight request); keeps the last list on failure. */
export function refreshTailnetPeers(): Promise<TailnetPeersDocument> {
  if (pending) return pending;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  pending = fetch(`/${TAILNET_PEERS_FILE_NAME}`, { cache: 'no-store', signal: controller.signal })
    .then((response) => (response.ok ? response.json() : null))
    .then((document: unknown) => {
      if (isPeersDocument(document)) {
        current = document;
        listeners.forEach((listener) => listener(current));
      }
      return current;
    })
    .catch(() => current)
    .finally(() => {
      clearTimeout(timer);
      pending = null;
    });
  return pending;
}

export function subscribeTailnetPeers(listener: TailnetListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
