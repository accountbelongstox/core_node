/**
 * WfNewEndpoints — backend endpoint management for the /wordnew app.
 *
 * Functionality is modeled on wordflow's WordflowApiManager (NOT its UI):
 * detection is STORED-FIRST —
 *   1. probe ONLY the stored last-used endpoint; if it answers, use it and probe
 *      nothing else (so a previously-working choice is reused instantly);
 *   2. otherwise probe ALL endpoints in parallel and fail over to the
 *      highest-weight HEALTHY one (availability-first; a user pin only ranks
 *      higher, it is never blindly trusted);
 *   3. when nothing is healthy, an offline retry loop keeps re-testing on an
 *      interval until an endpoint recovers, then stops.
 *
 * Applies the project's shared libraries:
 *   - persistence: all settings live in `WfNewEndpointStore` (a subclass of the
 *     shared `PersistedStore`) under ONE localStorage key — the selection is a
 *     TYPE token, resolved to a concrete endpoint here at runtime,
 *   - store pattern: a `useSyncExternalStore`-friendly snapshot + subscribe
 *     (same shape as core/logstore + core/notify) so UIs react without polling.
 *
 * Health = a 2xx JSON `/api/health` body carrying a `status` or `service`
 * marker (an SPA index.html 200 is rejected). Self-contained: no dependency on
 * the wordflow library beyond the shared offline scheduler + persistence.
 */
import {
  OfflineRecheckScheduler,
  clampRecheckInterval,
} from '../../../core/health/OfflineRecheckScheduler';
import { wfNewEndpointStore, CURRENT_URL_TYPE } from './WfNewEndpointStore';
import type {
  WfNewEndpoint, WfNewEndpointHealth, WfNewEndpointSnapshot,
} from './WfNewApiTypes';

export { CURRENT_URL_TYPE } from './WfNewEndpointStore';

/** Fired after every detection pass so non-React listeners can refresh. */
export const WFNEW_API_HEALTH_EVENT = 'wfnew-api-health-changed';

/** The fixed backend API port for every wordnew endpoint. */
export const WFNEW_API_PORT = 9000;

/** Default ALL-Offline retry cadence (ms) and per-probe timeout (ms). */
const DEFAULT_RECHECK_INTERVAL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 3_000;

/**
 * Default endpoints (all port 9000). The primary default is 43.163.112.77; the
 * page's current origin is auto-injected at priority 2 (host from the current
 * URL, port pinned to 9000 — see getCurrentOriginEndpoint).
 */
const DEFAULT_ENDPOINTS: WfNewEndpoint[] = [
  // Primary default (priority 1). Current-url (host:9000) is injected at
  // priority 2 — see getCurrentOriginEndpoint — so 43.163 stays the default,
  // then the page's own origin, then the loopback / mesh nodes.
  { id: 'remote-primary', kind: 'default', url: '43.163.112.77', protocol: 'http', port: WFNEW_API_PORT, priority: 1, isLocal: false, description: 'Primary remote API 43.163.112.77:9000' },
  { id: 'loopback', kind: 'default', url: '127.0.0.1', protocol: 'http', port: WFNEW_API_PORT, priority: 3, isLocal: true, description: 'Loopback 127.0.0.1:9000' },
  { id: 'tailnet-1', kind: 'default', url: '100.101.149.39', protocol: 'http', port: WFNEW_API_PORT, priority: 4, isLocal: true, description: 'Mesh node 100.101.149.39:9000' },
  { id: 'tailnet-2', kind: 'default', url: '100.106.85.16', protocol: 'http', port: WFNEW_API_PORT, priority: 5, isLocal: true, description: 'Mesh node 100.106.85.16:9000' },
];

/** Build a base/full URL for an endpoint. */
export function buildEndpointUrl(ep: WfNewEndpoint, path = ''): string {
  const port = ep.port ? `:${ep.port}` : '';
  const base = `${ep.protocol}://${ep.url}${port}`;
  if (!path) return base;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Highest-priority endpoint derived from the page's current origin: host +
 * protocol from `window.location`, but the PORT is always pinned to 9000 (the
 * API runs as a separate process from the FE dev server). Null off-web.
 */
function getCurrentOriginEndpoint(): WfNewEndpoint | null {
  if (typeof window === 'undefined' || !window.location) return null;
  const { protocol, hostname } = window.location;
  if ((protocol !== 'http:' && protocol !== 'https:') || !hostname) return null;
  const proto: 'http' | 'https' = protocol === 'https:' ? 'https' : 'http';
  const isLocal =
    hostname === 'localhost' || hostname === '127.0.0.1' ||
    /^192\.168\./.test(hostname) || /^10\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) || /^100\./.test(hostname);
  return {
    id: CURRENT_URL_TYPE,
    kind: 'current-url',
    url: hostname,
    protocol: proto,
    port: WFNEW_API_PORT,
    // After the primary default (43.163, priority 1); the page's own origin is
    // tried before the loopback / mesh nodes.
    priority: 2,
    isLocal,
    description: `Current URL — this site (${proto}://${hostname}:${WFNEW_API_PORT})`,
  };
}

class WfNewEndpointManager {
  private current: WfNewEndpoint | null = null;
  private healthMap = new Map<string, WfNewEndpointHealth>();
  private ready = false;
  private testing = false;
  private initPromise: Promise<void> | null = null;
  private recheckPromise: Promise<boolean> | null = null;
  private scheduler = new OfflineRecheckScheduler({
    recheck: () => this.recheckAndFailover(),
    getIntervalMs: () => this.getRecheckIntervalMs(),
  });

  // ---- reactive store (useSyncExternalStore-friendly) ----

  private listeners = new Set<() => void>();
  private snapshot: WfNewEndpointSnapshot = this.buildSnapshot();

  /** Subscribe to state changes; returns an unsubscribe. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Stable snapshot reference (rebuilt only on change). */
  getSnapshot = (): WfNewEndpointSnapshot => this.snapshot;

  private buildSnapshot(): WfNewEndpointSnapshot {
    const health: Record<string, WfNewEndpointHealth> = {};
    for (const [id, r] of this.healthMap) health[id] = r;
    return {
      endpoints: this.getAllEndpoints(),
      health,
      currentId: this.current?.id ?? null,
      healthy: this.hasHealthyEndpoint(),
      ready: this.ready,
      testing: this.testing,
    };
  }

  /** Rebuild the snapshot, notify React subscribers + the legacy window event. */
  private emit(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((l) => l());
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WFNEW_API_HEALTH_EVENT));
    }
  }

  // ---- persistence (WfNewEndpointStore subclass of PersistedStore) ----

  private loadCustom(): WfNewEndpoint[] {
    return wfNewEndpointStore.customEndpoints;
  }

  private saveCustom(list: WfNewEndpoint[]): void {
    wfNewEndpointStore.setCustomEndpoints(list);
  }

  // ---- endpoint list (defaults + custom + current-url) ----

  getAllEndpoints(): WfNewEndpoint[] {
    const list = [...DEFAULT_ENDPOINTS, ...this.loadCustom()];
    const current = getCurrentOriginEndpoint();
    if (current) {
      // ALWAYS surface the current-URL endpoint as its own prominent row. If a
      // default/custom points at the same target, drop that one and keep the
      // current-url entry (still ONE row per target, but labelled "Current
      // URL") — never silently fold it into a look-alike default.
      const same = (e: WfNewEndpoint) =>
        e.id !== current.id &&
        e.protocol === current.protocol &&
        e.url === current.url &&
        (e.port ?? null) === (current.port ?? null);
      const filtered = list.filter((e) => !same(e));
      filtered.unshift(current);
      return filtered.sort((a, b) => a.priority - b.priority);
    }
    return list.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Resolve a selection TYPE (endpoint id) to a concrete endpoint. The
   * 'current-url' type is resolved live from window.location every time, so a
   * stored selection follows the page origin instead of freezing a stale host.
   */
  getEndpointById(id: string): WfNewEndpoint | undefined {
    if (id === CURRENT_URL_TYPE) return getCurrentOriginEndpoint() ?? undefined;
    return this.getAllEndpoints().find((e) => e.id === id);
  }

  // ---- health probing ----

  async checkEndpoint(ep: WfNewEndpoint, timeout = DEFAULT_TIMEOUT_MS): Promise<WfNewEndpointHealth> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const start = performance.now();
    try {
      const res = await fetch(buildEndpointUrl(ep, '/api/health'), {
        method: 'GET',
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      const responseTime = Math.round(performance.now() - start);
      const isHealthy = await this.isHealthBody(res);
      const result: WfNewEndpointHealth = {
        id: ep.id,
        isHealthy,
        responseTime,
        error: isHealthy ? undefined : (res.ok ? 'not-a-backend' : `http-${res.status}`),
        timestamp: Date.now(),
      };
      this.healthMap.set(ep.id, result);
      return result;
    } catch (e: any) {
      const result: WfNewEndpointHealth = {
        id: ep.id,
        isHealthy: false,
        responseTime: Math.round(performance.now() - start),
        error: e?.name === 'AbortError' ? 'timeout' : (e?.message || 'network-error'),
        timestamp: Date.now(),
      };
      this.healthMap.set(ep.id, result);
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  private async isHealthBody(res: Response): Promise<boolean> {
    if (res.status < 200 || res.status >= 300) return false;
    if (!(res.headers.get('content-type') || '').toLowerCase().includes('application/json')) return false;
    try {
      const body = await res.clone().json();
      return !!body && typeof body === 'object' && (body.status !== undefined || body.service !== undefined);
    } catch {
      return false;
    }
  }

  private async checkAll(timeout?: number): Promise<WfNewEndpointHealth[]> {
    return Promise.all(this.getAllEndpoints().map((ep) => this.checkEndpoint(ep, timeout)));
  }

  // ---- STORED-FIRST detection ----

  private async detectStoredFirst(timeout?: number): Promise<boolean> {
    const userId = wfNewEndpointStore.selectedType;
    const autoId = wfNewEndpointStore.autoType;

    // Stage 1 — stored last-used endpoint only.
    const preferredId = userId ?? autoId;
    const preferred = (preferredId ? this.getEndpointById(preferredId) : undefined) ?? this.current ?? undefined;
    if (preferred) {
      const r = await this.checkEndpoint(preferred, timeout);
      if (r.isHealthy) {
        this.current = preferred;
        return true;
      }
    }

    // Stage 2 — full parallel sweep + availability-first failover.
    const results = await this.checkAll(timeout);
    this.selectAvailabilityFirst(results, userId, autoId);
    return results.some((r) => r.isHealthy);
  }

  private selectAvailabilityFirst(results: WfNewEndpointHealth[], userId: string | null, autoId: string | null): void {
    const weight = (id: string) => (id === userId ? 0 : id === autoId ? 1 : 2);
    const healthy = results
      .filter((r) => r.isHealthy)
      .map((r) => this.getEndpointById(r.id))
      .filter((e): e is WfNewEndpoint => !!e)
      .sort((a, b) => (weight(a.id) - weight(b.id)) || (a.priority - b.priority));

    const best = healthy[0];
    if (best) {
      this.current = best;
      wfNewEndpointStore.setAuto(best.id);
      return;
    }
    // Nothing healthy — keep a usable base (the highest-priority endpoint) so
    // requests have a target; the offline loop keeps re-testing.
    this.current = this.current ?? this.getAllEndpoints()[0] ?? null;
  }

  // ---- lifecycle ----

  /** Run the first detection pass (single-flight). Safe to call repeatedly. */
  initialize(timeout?: number): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = (async () => {
      try {
        await this.detectStoredFirst(timeout);
      } finally {
        this.ready = true;
        this.emit();
        this.syncLoop();
      }
    })();
    return this.initPromise;
  }

  whenReady(): Promise<void> {
    return this.ready ? Promise.resolve() : this.initialize();
  }

  /** STORED-FIRST recheck (single-flight). The offline loop + manual test land here. */
  recheckAndFailover(timeout?: number): Promise<boolean> {
    if (this.recheckPromise) return this.recheckPromise;
    this.recheckPromise = (async () => {
      try {
        return await this.detectStoredFirst(timeout);
      } finally {
        this.recheckPromise = null;
        this.emit();
        this.syncLoop();
      }
    })();
    return this.recheckPromise;
  }

  /** Manual "Test & select" — exposes a `testing` flag to the store while running. */
  async testAll(): Promise<boolean> {
    this.testing = true;
    this.emit();
    try {
      return await this.recheckAndFailover();
    } finally {
      this.testing = false;
      this.emit();
    }
  }

  /** Run the offline retry loop only while nothing is healthy. */
  private syncLoop(): void {
    if (this.hasHealthyEndpoint()) this.scheduler.stop();
    else this.scheduler.start();
  }

  // ---- selection + queries ----

  /** Pin an endpoint as the user choice, then re-detect (stays availability-first). */
  setEndpoint(id: string, saveAsUserChoice = true): boolean {
    const ep = this.getEndpointById(id);
    if (!ep) return false;
    this.current = ep;
    if (saveAsUserChoice) {
      wfNewEndpointStore.setSelected(id);
    }
    this.initPromise = null;
    this.emit();
    void this.recheckAndFailover();
    return true;
  }

  /** Add a user endpoint (host required; port defaults to 9000). Returns its id. */
  addCustomEndpoint(input: { url: string; protocol?: 'http' | 'https'; port?: number; description?: string }): string {
    const host = (input.url || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
    const id = `custom-${host}-${input.port ?? WFNEW_API_PORT}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    const ep: WfNewEndpoint = {
      id,
      kind: 'custom',
      url: host,
      protocol: input.protocol ?? 'http',
      port: input.port ?? WFNEW_API_PORT,
      priority: 50,
      isLocal: /^(localhost|127\.|192\.168\.|10\.|100\.)/.test(host),
      description: input.description?.trim() || `Custom ${host}:${input.port ?? WFNEW_API_PORT}`,
      custom: true,
    };
    const list = this.loadCustom().filter((e) => e.id !== id);
    list.push(ep);
    this.saveCustom(list);
    this.emit();
    return id;
  }

  removeCustomEndpoint(id: string): void {
    this.saveCustom(this.loadCustom().filter((e) => e.id !== id));
    // Drop any persisted reference to the removed TYPE so detection re-picks.
    wfNewEndpointStore.forgetType(id);
    if (this.current?.id === id) this.current = null;
    this.emit();
  }

  hasHealthyEndpoint(): boolean {
    return Array.from(this.healthMap.values()).some((r) => r.isHealthy);
  }

  getCurrentEndpoint(): WfNewEndpoint | null {
    return this.current;
  }

  getCurrentBaseUrl(): string {
    if (!this.current) this.current = this.getAllEndpoints()[0] ?? null;
    return this.current ? buildEndpointUrl(this.current) : '';
  }

  buildUrl(path: string): string {
    if (!this.current) this.current = this.getAllEndpoints()[0] ?? null;
    return this.current ? buildEndpointUrl(this.current, path) : path;
  }

  getHealthResult(id: string): WfNewEndpointHealth | undefined {
    return this.healthMap.get(id);
  }

  getAllHealthResults(): WfNewEndpointHealth[] {
    return Array.from(this.healthMap.values());
  }

  getRecheckIntervalMs(): number {
    const raw = wfNewEndpointStore.recheckIntervalMs;
    return clampRecheckInterval(Number(raw ?? NaN), DEFAULT_RECHECK_INTERVAL_MS);
  }

  setRecheckIntervalMs(ms: number): void {
    wfNewEndpointStore.setRecheckIntervalMs(clampRecheckInterval(ms, DEFAULT_RECHECK_INTERVAL_MS));
  }
}

export const wfNewEndpoints = new WfNewEndpointManager();
