/**
 * PycoreLanScanner - finds pycore on the local network: `GET /api/status` on
 * every host of a /24 (port 59000), bounded concurrency, short timeouts,
 * results streamed as they arrive. Requests go through `protocolFetch` (native
 * Cronet in the app: plain LAN http is allowed there, the WebView would block
 * it). A host that answers 401 / 403 runs pycore but refuses this caller (K7);
 * silent hosts are skipped.
 */
import { protocolFetch } from '../../network/ProtocolFetch';
import { LAN_MAX_SCAN_HOSTS } from '../../contracts/ServiceContract';
import { PYCORE_BACKEND_PORT, pycoreHttpProto } from './pycoreEndpoints';
import { PYCORE_HTTP_PATHS } from './PycoreNetwork';
import { recordPycoreProbe } from './PycoreEndpointProbe';
import { isPrivateLanHost } from './pycoreTarget';

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
const DEFAULT_CONCURRENCY = 32;
const DEFAULT_TIMEOUT_MS = 1_200;
const REFUSED = new Set([401, 403]);

const CIDR_RE = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/;
const IPV4_BITS = 32;
const MIN_PREFIX = 8;
const MAX_PREFIX = 30;
const OCTET_SHIFTS = [24, 16, 8, 0];

export interface LanSegment {
  /** Network the interface sits on (`192.168.1.0/24`), from the machine's real netmask. */
  cidr: string;
  /** The interface address the network was derived from. */
  address: string;
}

function ipv4ToInt(address: string): number | null {
  const match = IPV4_RE.exec(String(address || '').trim());
  if (!match || match.slice(1).some((part) => Number(part) > 255)) return null;
  return match.slice(1).reduce((value, part, index) => value + Number(part) * 2 ** OCTET_SHIFTS[index], 0);
}

function intToIpv4(value: number): string {
  return OCTET_SHIFTS.map((shift) => Math.floor(value / 2 ** shift) % 256).join('.');
}

/**
 * Hosts of a LAN segment (network and broadcast addresses excluded). A segment wider than `limit`
 * hosts is narrowed to the aligned block of that size around its interface address; a non-IPv4 or
 * non-private-sized input yields [].
 */
export function lanSegmentHosts(segment: LanSegment, limit: number = LAN_MAX_SCAN_HOSTS): string[] {
  const match = CIDR_RE.exec(segment.cidr);
  const addressValue = ipv4ToInt(segment.address);
  if (!match || addressValue === null || !isPrivateLanHost(segment.address)) return [];
  let prefix = Number(match[2]);
  if (prefix < MIN_PREFIX || prefix > MAX_PREFIX) return [];
  while (2 ** (IPV4_BITS - prefix) - 2 > limit && prefix < MAX_PREFIX) prefix += 1;
  const size = 2 ** (IPV4_BITS - prefix);
  const network = Math.floor(addressValue / size) * size;
  return Array.from({ length: size - 2 }, (_, index) => intToIpv4(network + index + 1));
}

/** The hosts of the /24 an address (or a gateway such as 192.168.1.1) belongs to; [] for a non-IPv4 input. */
export function lanScanHosts(address: string): string[] {
  return lanSegmentHosts({ cidr: `${address}/24`, address });
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
