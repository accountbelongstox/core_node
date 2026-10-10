/**
 * PycoreLanScanner - finds pycore on the local network: `GET /api/status` on every host of a segment
 * (port 59000) through the shared LanDiscovery probe and pool, results streamed as they arrive. A host
 * that answers 401 / 403 runs pycore but refuses this caller (K7); silent hosts are skipped.
 */
import { lanScanHosts, lanSegmentHosts, probeHttpService, runPool, type LanSegment } from '../../network/LanDiscovery';
import { PYCORE_BACKEND_PORT, pycoreHttpProto } from './pycoreEndpoints';
import { PYCORE_HTTP_PATHS } from './PycoreNetwork';
import { recordPycoreProbe } from './PycoreEndpointProbe';

export { lanScanHosts, lanSegmentHosts, type LanSegment };

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

const DEFAULT_CONCURRENCY = 32;
const REFUSED = new Set([401, 403]);

async function probe(host: string, port: number, timeoutMs: number | undefined, signal?: AbortSignal): Promise<LanScanResult | null> {
  const url = `${pycoreHttpProto()}://${host}:${port}`;
  const answer = await probeHttpService(`${url}${PYCORE_HTTP_PATHS.status}`, timeoutMs, signal);
  if (!answer) return null;
  if (REFUSED.has(answer.status)) return { host, url, state: 'refused', ms: answer.ms, hostname: '' };
  const payload = answer.body as { is_http_service?: boolean; hostname?: string } | null;
  return { host, url, state: payload?.is_http_service ? 'up' : 'no_route', ms: answer.ms, hostname: String(payload?.hostname || '') };
}

/** Scan `hosts`; resolves with every host that answered (pycore up first, fastest first). */
export async function scanLanPycore(hosts: string[], options: LanScanOptions = {}): Promise<LanScanResult[]> {
  const port = options.port ?? PYCORE_BACKEND_PORT;
  const found: LanScanResult[] = [];
  let done = 0;
  await runPool(hosts, options.concurrency ?? DEFAULT_CONCURRENCY, async (host) => {
    const result = await probe(host, port, options.timeoutMs, options.signal);
    done += 1;
    options.onProgress?.(done, hosts.length);
    if (!result) return;
    found.push(result);
    if (result.state !== 'no_route') recordPycoreProbe(result.url, result.state === 'up' ? 'up' : 'rejected', result.ms, { hostname: result.hostname });
    options.onResult?.(result);
  }, options.signal);
  return found.sort((left, right) => (left.state === 'up' ? 0 : 1) - (right.state === 'up' ? 0 : 1) || left.ms - right.ms);
}
