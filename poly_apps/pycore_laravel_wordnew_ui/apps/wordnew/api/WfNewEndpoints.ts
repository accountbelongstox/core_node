/**
 * WfNewEndpoints — /wordnew view over the ONE shared Laravel endpoint manager
 * (core/api-libs/laravel/ApiManager). Endpoint detection, health probing,
 * first-run detection, custom endpoints and the persisted selection are owned by core;
 * this adapter only maps them onto the wordnew surface (reactive snapshot,
 * WfNewEndpoint shape, legacy event name) so wordnew consumers keep a single
 * import site while the whole UI shares one endpoint state.
 */
import {
  OfflineRecheckScheduler,
  clampRecheckInterval,
} from '../../../core/health/OfflineRecheckScheduler';
import {
  API_HEALTH_EVENT,
  apiManager,
  type HealthCheckResult,
} from '../../../core/api-libs/laravel/ApiManager';
import {
  buildApiUrl,
  getAllEndpoints as getCoreEndpoints,
  getEndpointById as getCoreEndpointById,
  addCustomEndpoint as addCoreCustomEndpoint,
  removeCustomEndpoint as removeCoreCustomEndpoint,
  isCustomEndpoint,
  getCurrentOriginEndpoint,
  FIXED_API_PORT,
  type BackendApiEndpoint,
} from '../../../config/api-endpoints';
import { CURRENT_URL_TYPE, isCurrentUrlId } from '../../../core/api-libs/base/endpointIdentity';
import { wfNewEndpointStore } from './WfNewEndpointStore';
import type {
  WfNewEndpoint, WfNewEndpointHealth, WfNewEndpointSnapshot,
} from './WfNewApiTypes';

export { CURRENT_URL_TYPE } from '../../../core/api-libs/base/endpointIdentity';
export { isCurrentUrlId } from '../../../core/api-libs/base/endpointIdentity';

/** One health event for the whole UI — the core manager's pass event. */
export const WORDNEW_API_HEALTH_EVENT = API_HEALTH_EVENT;

/** The fixed backend API port for every wordnew endpoint (shared with core). */
export const WFNEW_API_PORT = FIXED_API_PORT;

/** Build a base/full URL for an endpoint. */
export function buildEndpointUrl(ep: WfNewEndpoint, path = ''): string {
  return buildApiUrl(ep, path);
}

function toWfNewEndpoint(ep: BackendApiEndpoint): WfNewEndpoint {
  const currentUrl = isCurrentUrlId(ep.id);
  const custom = !currentUrl && isCustomEndpoint(ep.id);
  return {
    ...ep,
    kind: currentUrl ? 'current-url' : custom ? 'custom' : 'default',
    custom,
  };
}

function toWfNewHealth(result: HealthCheckResult): WfNewEndpointHealth {
  return {
    id: result.endpoint.id,
    isHealthy: result.isHealthy,
    responseTime: result.responseTime,
    error: result.error,
    timestamp: result.timestamp,
  };
}

class WfNewEndpointManager {
  private testing = false;
  private listeners = new Set<() => void>();
  private snapshot: WfNewEndpointSnapshot = this.buildSnapshot();
  private scheduler = new OfflineRecheckScheduler({
    recheck: () => this.recheckAndFailover(),
    getIntervalMs: () => this.getRecheckIntervalMs(),
  });

  constructor() {
    wfNewEndpointStore.migrateToCore();
    if (typeof window !== 'undefined') {
      window.addEventListener(API_HEALTH_EVENT, () => {
        this.emit();
        this.syncLoop();
      });
    }
    // Instant synchronous pick (no probing) so early requests reuse the
    // persisted last-used endpoint before the first health pass settles.
    apiManager.preselectEndpointSync();
  }

  /** Subscribe to state changes; returns an unsubscribe. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Stable snapshot reference (rebuilt only on change). */
  getSnapshot = (): WfNewEndpointSnapshot => this.snapshot;

  private buildSnapshot(): WfNewEndpointSnapshot {
    const health: Record<string, WfNewEndpointHealth> = {};
    for (const result of apiManager.getAllHealthResults()) {
      const mapped = toWfNewHealth(result);
      health[mapped.id] = mapped;
    }
    return {
      endpoints: this.getAllEndpoints(),
      health,
      currentId: apiManager.getCurrentEndpoint()?.id ?? null,
      healthy: this.hasHealthyEndpoint(),
      ready: true,
      testing: this.testing,
    };
  }

  /** Rebuild the snapshot and notify React subscribers. */
  private emit(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }

  // ---- endpoint list (core registry, mapped) ----

  getAllEndpoints(): WfNewEndpoint[] {
    return getCoreEndpoints().map(toWfNewEndpoint);
  }

  /**
   * Resolve a selection TYPE (endpoint id) to a concrete endpoint. The
   * 'current-url' type is resolved live from window.location every time.
   */
  getEndpointById(id: string): WfNewEndpoint | undefined {
    const core = getCoreEndpointById(id);
    if (core) return toWfNewEndpoint(core);
    if (isCurrentUrlId(id)) {
      const current = getCurrentOriginEndpoint();
      return current ? toWfNewEndpoint(current) : undefined;
    }
    return undefined;
  }

  // ---- health probing (delegated) ----

  async checkEndpoint(ep: WfNewEndpoint, timeout?: number): Promise<WfNewEndpointHealth> {
    return toWfNewHealth(await apiManager.checkEndpoint(ep, { timeout }));
  }

  // ---- lifecycle (delegated, single-flight in core) ----

  /** Run the first detection pass (single-flight). Safe to call repeatedly. */
  initialize(timeout?: number): Promise<void> {
    return apiManager.initialize({ timeout });
  }

  whenReady(): Promise<void> {
    return this.initialize();
  }

  /** STORED-FIRST recheck (single-flight). The offline loop + manual test land here. */
  async recheckAndFailover(timeout?: number): Promise<boolean> {
    const healthy = await apiManager.recheckEndpoints(timeout);
    this.emit();
    this.syncLoop();
    return healthy;
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

  /** Pin an endpoint as the user choice (persisted by the core manager). */
  setEndpoint(id: string, saveAsUserChoice = true): boolean {
    const ok = apiManager.setEndpoint(id, saveAsUserChoice);
    this.emit();
    if (ok) void this.recheckAndFailover();
    return ok;
  }

  /** Add a user endpoint (persisted in the core registry). Returns its id or ''. */
  addCustomEndpoint(input: { url: string; protocol?: 'http' | 'https'; port?: number; description?: string }): string {
    const result = addCoreCustomEndpoint(input);
    if (!result.ok) return '';
    this.emit();
    return result.endpoint.id;
  }

  removeCustomEndpoint(id: string): void {
    removeCoreCustomEndpoint(id);
    this.emit();
  }

  hasHealthyEndpoint(): boolean {
    return apiManager.hasHealthyEndpoint();
  }

  getCurrentEndpoint(): WfNewEndpoint | null {
    const ep = apiManager.getCurrentEndpoint() ?? apiManager.preselectEndpointSync();
    return ep ? toWfNewEndpoint(ep) : null;
  }

  getCurrentBaseUrl(): string {
    const ep = apiManager.getCurrentEndpoint() ?? apiManager.preselectEndpointSync();
    return ep ? buildApiUrl(ep) : '';
  }

  buildUrl(path: string): string {
    const base = this.getCurrentBaseUrl();
    if (!base) return path;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }

  getHealthResult(id: string): WfNewEndpointHealth | undefined {
    const result = apiManager.getHealthResult(id);
    return result ? toWfNewHealth(result) : undefined;
  }

  getAllHealthResults(): WfNewEndpointHealth[] {
    return apiManager.getAllHealthResults().map(toWfNewHealth);
  }

  getRecheckIntervalMs(): number {
    return clampRecheckInterval(apiManager.getRecheckIntervalMs(), 60_000);
  }

  setRecheckIntervalMs(ms: number): void {
    apiManager.setRecheckIntervalMs(clampRecheckInterval(ms, 60_000));
  }
}

export const wfNewEndpoints = new WfNewEndpointManager();
