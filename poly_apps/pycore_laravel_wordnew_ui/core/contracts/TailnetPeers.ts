/**
 * Live tailnet machine list, answered same-origin by the UI server from
 * `tailscale status` (shape shared by the node middleware and the browser).
 */
export interface TailnetPeer {
  /** MagicDNS name without the trailing dot: <machine>.<tailnet>.ts.net */
  dnsName: string;
  hostName: string;
  os: string;
  online: boolean;
  /** The machine this UI server runs on. */
  self: boolean;
}

export interface TailnetPeersDocument {
  /** MagicDNS suffix of the tailnet (e.g. example.ts.net); empty without Tailscale. */
  tailnet: string;
  peers: TailnetPeer[];
}

export const EMPTY_TAILNET_PEERS: TailnetPeersDocument = { tailnet: '', peers: [] };
