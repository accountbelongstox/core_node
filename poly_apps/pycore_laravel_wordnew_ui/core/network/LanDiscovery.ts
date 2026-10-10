/**
 * Generic network service discovery: IPv4 segment math, a bounded worker pool, an HTTP service probe and a
 * multi-source scan over LAN segments, tailnet peers (Tailscale or Headscale: both publish the same peers
 * document, MagicDNS names under the mesh domain) and explicit hosts, on any set of ports. Requests go
 * through `protocolFetch` (native Cronet in the app, so plain LAN http works there).
 */
import { protocolFetch } from './ProtocolFetch';
import { LAN_MAX_SCAN_HOSTS } from '../contracts/ServiceContract';
import type { TailnetPeersDocument } from '../contracts/TailnetPeers';

export interface LanSegment {
  /** Network the interface sits on (`192.168.1.0/24`), from the machine's real netmask. */
  cidr: string;
  /** The interface address the network was derived from. */
  address: string;
}

export type DiscoverySource = 'lan' | 'tailnet' | 'host';

export interface DiscoveryTarget {
  host: string;
  source: DiscoverySource;
}

export interface HttpProbeResult {
  url: string;
  status: number;
  ms: number;
  body: unknown;
}

export interface DiscoveredService<T> extends DiscoveryTarget {
  port: number;
  url: string;
  ms: number;
  info: T;
}

export interface ServiceDiscoveryOptions<T> {
  ports: readonly number[];
  /** Path probed on every host:port (e.g. `/api/status`). */
  path: string;
  /** Maps an answer to service info; null means "not this service". */
  match: (probe: HttpProbeResult) => T | null;
  scheme?: 'http' | 'https';
  segments?: readonly LanSegment[];
  tailnet?: TailnetPeersDocument;
  hosts?: readonly string[];
  concurrency?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  onFound?: (service: DiscoveredService<T>) => void;
  onProgress?: (done: number, total: number) => void;
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const CIDR_RE = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/;
const IPV4_BITS = 32;
const MIN_PREFIX = 8;
const MAX_PREFIX = 30;
const OCTET_SHIFTS = [24, 16, 8, 0];
const MAX_OCTET = 255;
const OCTET_SIZE = 256;
const DEFAULT_PREFIX = 24;
const DEFAULT_CONCURRENCY = 32;
const DEFAULT_TIMEOUT_MS = 1_200;
const SOURCE_ORDER: Record<DiscoverySource, number> = { host: 0, tailnet: 1, lan: 2 };

export function ipv4ToInt(address: string): number | null {
  const match = IPV4_RE.exec(String(address || '').trim());
  if (!match || match.slice(1).some((part) => Number(part) > MAX_OCTET)) return null;
  return match.slice(1).reduce((value, part, index) => value + Number(part) * 2 ** OCTET_SHIFTS[index], 0);
}

export function intToIpv4(value: number): string {
  return OCTET_SHIFTS.map((shift) => Math.floor(value / 2 ** shift) % OCTET_SIZE).join('.');
}

/** RFC 1918 private IPv4 (10/8, 172.16/12, 192.168/16). */
export function isPrivateIpv4(address: string): boolean {
  const value = ipv4ToInt(address);
  if (value === null) return false;
  const [first, second] = address.split('.').map(Number);
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

/**
 * Hosts of a LAN segment (network and broadcast addresses excluded). A segment wider than `limit` hosts is
 * narrowed to the aligned block of that size around its interface address; invalid or public input yields [].
 */
export function lanSegmentHosts(segment: LanSegment, limit: number = LAN_MAX_SCAN_HOSTS): string[] {
  const match = CIDR_RE.exec(segment.cidr);
  const addressValue = ipv4ToInt(segment.address);
  if (!match || addressValue === null || !isPrivateIpv4(segment.address)) return [];
  let prefix = Number(match[2]);
  if (prefix < MIN_PREFIX || prefix > MAX_PREFIX) return [];
  while (2 ** (IPV4_BITS - prefix) - 2 > limit && prefix < MAX_PREFIX) prefix += 1;
  const size = 2 ** (IPV4_BITS - prefix);
  const network = Math.floor(addressValue / size) * size;
  return Array.from({ length: size - 2 }, (_, index) => intToIpv4(network + index + 1));
}

/** The hosts of the /24 an address (or a gateway such as 192.168.1.1) belongs to; [] for a non-IPv4 input. */
export function lanScanHosts(address: string): string[] {
  return lanSegmentHosts({ cidr: `${address}/${DEFAULT_PREFIX}`, address });
}

/** Segment of an interface address with its prefix length. */
export function lanSegmentOf(address: string, prefixLength: number = DEFAULT_PREFIX): LanSegment {
  return { cidr: `${address}/${prefixLength}`, address };
}

/** Online peers other than this machine, by MagicDNS name (works for Tailscale and Headscale tailnets). */
export function tailnetHosts(document: TailnetPeersDocument | undefined): string[] {
  return (document?.peers ?? []).filter((peer) => peer.online && !peer.self && peer.dnsName).map((peer) => peer.dnsName);
}

/** Runs `worker` over `items` with at most `concurrency` in flight; stops taking items once `signal` aborts. */
export async function runPool<T>(
  items: readonly T[], concurrency: number, worker: (item: T) => Promise<void>, signal?: AbortSignal,
): Promise<void> {
  let cursor = 0;
  const lane = async (): Promise<void> => {
    while (cursor < items.length && !signal?.aborted) {
      const item = items[cursor];
      cursor += 1;
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, lane));
}

/** One GET with a timeout; null when nothing answered. The body is parsed as JSON when it is JSON. */
export async function probeHttpService(url: string, timeoutMs: number = DEFAULT_TIMEOUT_MS, signal?: AbortSignal): Promise<HttpProbeResult | null> {
  const controller = new AbortController();
  const stop = (): void => controller.abort();
  const timer = setTimeout(stop, timeoutMs);
  signal?.addEventListener('abort', stop, { once: true });
  const started = performance.now();
  try {
    const response = await protocolFetch(url, { cache: 'no-store', signal: controller.signal });
    const ms = Math.round(performance.now() - started);
    const body = response.ok ? await response.json().catch(() => null) : null;
    return { url, status: response.status, ms, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
  }
}

/** Unique scan targets from every source; explicit hosts first, then tailnet peers, then LAN segments. */
export function discoveryTargets(options: Pick<ServiceDiscoveryOptions<unknown>, 'segments' | 'tailnet' | 'hosts'>): DiscoveryTarget[] {
  const targets = new Map<string, DiscoveryTarget>();
  const add = (host: string, source: DiscoverySource): void => {
    const key = host.trim().toLowerCase();
    if (key && !targets.has(key)) targets.set(key, { host: host.trim(), source });
  };
  (options.hosts ?? []).forEach((host) => add(host, 'host'));
  tailnetHosts(options.tailnet).forEach((host) => add(host, 'tailnet'));
  (options.segments ?? []).forEach((segment) => lanSegmentHosts(segment).forEach((host) => add(host, 'lan')));
  return [...targets.values()].sort((left, right) => SOURCE_ORDER[left.source] - SOURCE_ORDER[right.source]);
}

/** Probes every target on every port; resolves with the matched services, fastest first. */
export async function discoverServices<T>(options: ServiceDiscoveryOptions<T>): Promise<DiscoveredService<T>[]> {
  const scheme = options.scheme ?? 'http';
  const jobs = discoveryTargets(options).flatMap((target) => options.ports.map((port) => ({ target, port })));
  const found: DiscoveredService<T>[] = [];
  let done = 0;
  await runPool(jobs, options.concurrency ?? DEFAULT_CONCURRENCY, async ({ target, port }) => {
    const url = `${scheme}://${target.host}:${port}`;
    const probe = await probeHttpService(`${url}${options.path}`, options.timeoutMs, options.signal);
    done += 1;
    options.onProgress?.(done, jobs.length);
    const info = probe ? options.match(probe) : null;
    if (!probe || info === null) return;
    const service = { ...target, port, url, ms: probe.ms, info };
    found.push(service);
    options.onFound?.(service);
  }, options.signal);
  return found.sort((left, right) => left.ms - right.ms);
}
