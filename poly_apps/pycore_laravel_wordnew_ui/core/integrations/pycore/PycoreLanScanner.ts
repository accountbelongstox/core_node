/**
 * PycoreLanScanner - finds pycore on the local network: `GET /api/status` on
 * every host of a /24 (port 59000), bounded concurrency, short timeouts,
 * results streamed as they arrive. Requests go through `protocolFetch` (native
 * Cronet in the app: plain LAN http is allowed there, the WebView would block
 * it). A host that answers 401 / 403 runs pycore but refuses this caller (K7);
 * silent hosts are skipped.
 */
import { protocolFetch } from '../../network/ProtocolFetch';
import { PYCORE_BACKEND_PORT, pycoreHttpProto } from './pycoreEndpoints';
import { PYCORE_HTTP_PATHS } from './PycoreNetwork';
import { recordPycoreProbe } from './PycoreEndpointProbe';

export type LanScanState = 'up' | 'refused' | 'no_route';

export interface LanScanResult {
  host: string;
  /** Direct backend URL (`<scheme>://<host>:59000`). */
  url: string;
  state: LanScanState;
  ms: number;
  /** Machine name pycore reports ('' when refused). */
  hostname: string;
}

export interface LanScanOptions {
  port?: number;
  concurrency?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onResult?: (result: LanScanResult) => void;
  onProgress?: (done: number, total: number) => void;
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HOSTS_PER_SUBNET = 254;
const DEFAULT_CONCURRENCY = 32;
const DEFAULT_TIMEOUT_MS = 1_200;
const REFUSED = new Set([401, 403]);

/** The 254 hosts of the /24 an address (or a gateway such as 192.168.1.1) belongs to; [] for a non-IPv4 input. */
export function lanScanHosts(address: string): string[] {
  const match = IPV4_RE.exec(String(address || '').trim());
  if (!match || match.slice(1).some((part) => Number(part) > 255)) return [];
  const prefix = `${match[1]}.${match[2]}.${match[3]}`;
  return Array.from({ length: HOSTS_PER_SUBNET }, (_, index) => `${prefix}.${index + 1}`);
}

async function probe(host: string, port: number, timeoutMs: number, signal?: AbortSignal): Promise<LanScanResult | null> {
  const url = `${pycoreHttpProto()}://${host}:${port}`;
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  const timer = setTimeout(stop, timeoutMs);
  signal?.addEventListener('abort', stop, { once: true });
  const started = performance.now();
  try {
    const statusUrl = `${url}${PYCORE_HTTP_PATHS.status}`;
    const response = await protocolFetch(statusUrl, { cache: 'no-store', signal: controller.signal });
    const ms = Math.round(performance.now() - started);
    if (REFUSED.has(response.status)) return { host, url, state: 'refused', ms, hostname: '' };
    const payload = response.ok ? await response.json().catch(() => null) : null;
    const state: LanScanState = payload?.is_http_service ? 'up' : 'no_route';
    return { host, url, state, ms, hostname: String(payload?.hostname || '') };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

/** Scan `hosts`; resolves with every host that answered (pycore up first, fastest first). */
export async function scanLanPycore(hosts: string[], options: LanScanOptions = {}): Promise<LanScanResult[]> {
  const port = options.port ?? PYCORE_BACKEND_PORT;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const found: LanScanResult[] = [];
  let cursor = 0;
  let done = 0;
  const lane = async (): Promise<void> => {
    while (cursor < hosts.length && !options.signal?.aborted) {
      const host = hosts[cursor];
      cursor += 1;
      const result = await probe(host, port, timeoutMs, options.signal);
      done += 1;
      options.onProgress?.(done, hosts.length);
      if (!result) continue;
      found.push(result);
      if (result.state !== 'no_route') recordPycoreProbe(result.url, result.state === 'up' ? 'up' : 'rejected', result.ms, { hostname: result.hostname });
      options.onResult?.(result);
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, hosts.length) }, lane));
  return found.sort((left, right) => (left.state === 'up' ? 0 : 1) - (right.state === 'up' ? 0 : 1) || left.ms - right.ms);
}
