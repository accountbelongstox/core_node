/**
 * Node-side middleware of the UI server: answers the live tailnet machine
 * list from `tailscale status --json` (short cache, never static). Without
 * Tailscale it answers an empty list. The build reads the same list once
 * (`readTailnetPeersSync`) and bakes it in as the seed a native shell starts
 * from before its first live answer.
 */
import { execFile, execFileSync } from 'child_process';
import type { IncomingMessage, ServerResponse } from 'http';
import { TAILNET_PEERS_FILE_NAME } from '../contracts/ServiceContract';
import {
  EMPTY_TAILNET_PEERS,
  type TailnetPeer,
  type TailnetPeersDocument,
} from '../contracts/TailnetPeers';

const TAILSCALE_BIN = 'tailscale';
const TAILSCALE_STATUS_ARGS = ['status', '--json'];
const TAILSCALE_TIMEOUT_MS = 4_000;
const TAILSCALE_MAX_BUFFER = 8 * 1024 * 1024;
const CACHE_TTL_MS = 5_000;
const PEERS_PATH = `/${TAILNET_PEERS_FILE_NAME}`;

interface TailscaleNode {
  DNSName?: string;
  HostName?: string;
  OS?: string;
  Online?: boolean;
}

interface TailscaleStatus {
  Self?: TailscaleNode;
  Peer?: Record<string, TailscaleNode>;
  MagicDNSSuffix?: string;
  CurrentTailnet?: { MagicDNSSuffix?: string } | null;
}

let cached: { at: number; document: TailnetPeersDocument } | null = null;
let pending: Promise<TailnetPeersDocument> | null = null;

function toPeer(node: TailscaleNode | undefined, self: boolean): TailnetPeer | null {
  const dnsName = String(node?.DNSName || '').replace(/\.$/, '').toLowerCase();
  if (!dnsName) return null;
  return {
    dnsName,
    hostName: String(node?.HostName || dnsName.split('.')[0]),
    os: String(node?.OS || ''),
    online: self || Boolean(node?.Online),
    self,
  };
}

function parseStatus(raw: string): TailnetPeersDocument {
  const status = JSON.parse(raw) as TailscaleStatus;
  const tailnet = String(status.CurrentTailnet?.MagicDNSSuffix || status.MagicDNSSuffix || '').replace(/\.$/, '').toLowerCase();
  const peers = [
    toPeer(status.Self, true),
    ...Object.values(status.Peer || {}).map((node) => toPeer(node, false)),
  ].filter((peer): peer is TailnetPeer => peer !== null && (!tailnet || peer.dnsName.endsWith(`.${tailnet}`)));
  return { tailnet, peers };
}

/** The list at build time (empty without Tailscale). */
export function readTailnetPeersSync(): TailnetPeersDocument {
  try {
    const stdout = execFileSync(TAILSCALE_BIN, TAILSCALE_STATUS_ARGS, {
      timeout: TAILSCALE_TIMEOUT_MS, maxBuffer: TAILSCALE_MAX_BUFFER, windowsHide: true, encoding: 'utf8',
    });
    return parseStatus(stdout);
  } catch {
    return EMPTY_TAILNET_PEERS;
  }
}

function readTailnetPeers(): Promise<TailnetPeersDocument> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return Promise.resolve(cached.document);
  if (pending) return pending;
  pending = new Promise<TailnetPeersDocument>((resolve) => {
    execFile(
      TAILSCALE_BIN,
      TAILSCALE_STATUS_ARGS,
      { timeout: TAILSCALE_TIMEOUT_MS, maxBuffer: TAILSCALE_MAX_BUFFER, windowsHide: true },
      (error, stdout) => {
        let document = EMPTY_TAILNET_PEERS;
        if (!error) {
          try {
            document = parseStatus(stdout);
          } catch {
            document = EMPTY_TAILNET_PEERS;
          }
        }
        cached = { at: Date.now(), document };
        resolve(document);
      },
    );
  }).finally(() => {
    pending = null;
  });
  return pending;
}

export function serveTailnetPeers(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  if ((req.url || '').split('?')[0] !== PEERS_PATH) {
    next();
    return;
  }
  void readTailnetPeers().then((document) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(document));
  });
}
