/**
 * PycoreEndpointProbe - live reachability of every selectable pycore backend,
 * keyed by backend URL. The endpoint switcher and PycoreHealth (active
 * endpoint) write into and read from the same table, so a row never shows a
 * state the backend does not have.
 */
import { PYCORE_HEALTH_DEFAULTS, PYCORE_HTTP_PATHS } from './PycoreNetwork';
import type { PycoreTarget } from './pycoreTarget';

/** no_route: the host answers, but not with pycore (its 175 /pycore-api mount is missing). */
export type PycoreProbeState = 'probing' | 'up' | 'down' | 'rejected' | 'no_route' | 'relay';

export interface PycoreProbeResult {
  state: PycoreProbeState;
  ms: number | null;
  httpStatus: number;
  /** Identity the backend reports in /api/status. */
  hostname: string;
  instanceId: string;
  checkedAt: number;
}

type ProbeListener = (url: string, result: PycoreProbeResult) => void;

const REJECTED_HTTP_STATUSES = new Set([401, 403]);
const NO_ROUTE_HTTP_STATUSES = new Set([404, 405]);

const results = new Map<string, PycoreProbeResult>();
const inFlight = new Map<string, Promise<PycoreProbeResult>>();
const listeners = new Set<ProbeListener>();

function publish(url: string, result: PycoreProbeResult): PycoreProbeResult {
  results.set(url, result);
  listeners.forEach((listener) => listener(url, result));
  return result;
}

function outcome(state: PycoreProbeState, ms: number | null, httpStatus = 0, payload?: any): PycoreProbeResult {
  return {
    state,
    ms,
    httpStatus,
    hostname: String(payload?.hostname || ''),
    instanceId: String(payload?.instance_id || ''),
    checkedAt: Date.now(),
  };
}

export function getPycoreProbe(url: string): PycoreProbeResult | null {
  return results.get(url) ?? null;
}

/** Record a result measured elsewhere (the active-endpoint health loop). */
export function recordPycoreProbe(url: string, state: PycoreProbeState, ms: number | null, payload?: any): void {
  publish(url, outcome(state, ms, state === 'up' ? 200 : 0, payload));
}

export function subscribePycoreProbes(listener: ProbeListener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Probe one backend's `GET /api/status` (simple CORS request, no custom
 * headers). Relay entries have no direct status route; their liveness is the
 * relay roster.
 */
export function probePycoreEndpoint(
  target: PycoreTarget,
  timeoutMs: number = PYCORE_HEALTH_DEFAULTS.pingTimeoutMs,
): Promise<PycoreProbeResult> {
  if (target.kind === 'relay') return Promise.resolve(publish(target.url, outcome('relay', null)));
  const running = inFlight.get(target.url);
  if (running) return running;
  const previous = results.get(target.url);
  publish(target.url, { ...(previous ?? outcome('probing', null)), state: 'probing' });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  const probe = fetch(`${target.url}${PYCORE_HTTP_PATHS.status}`, { cache: 'no-store', signal: controller.signal })
    .then(async (response) => {
      const ms = Math.round(performance.now() - started);
      if (REJECTED_HTTP_STATUSES.has(response.status)) return outcome('rejected', ms, response.status);
      if (NO_ROUTE_HTTP_STATUSES.has(response.status)) return outcome('no_route', ms, response.status);
      if (!response.ok) return outcome('down', ms, response.status);
      const payload = await response.json().catch(() => null);
      return outcome(payload?.is_http_service ? 'up' : 'no_route', ms, response.status, payload);
    })
    .catch(() => outcome('down', null))
    .then((result) => publish(target.url, result))
    .finally(() => {
      clearTimeout(timer);
      inFlight.delete(target.url);
    });
  inFlight.set(target.url, probe);
  return probe;
}

export function probePycoreEndpoints(targets: PycoreTarget[], timeoutMs?: number): Promise<PycoreProbeResult[]> {
  return Promise.all(targets.map((target) => probePycoreEndpoint(target, timeoutMs)));
}
