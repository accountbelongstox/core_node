/**
 * WfNewEndpoints — /wordnew view over the ONE shared Laravel endpoint manager
 * (core/integrations/laravel/ApiManager). Endpoint list, detection, the
 * persisted selection and the link to it are owned by core; this adapter maps
 * them onto the wordnew surface (reactive snapshot and WfNewEndpoint shape).
 *
 * Detection shows which endpoints answer; it never switches the selection.
 * While the selected endpoint is down the link reconnects to it and requests
 * wait; only the user changes the selection (`switchEndpoint`).
 */
import {
  API_HEALTH_EVENT,
  apiManager,
  type HealthCheckResult,
} from '../../../core/integrations/laravel/ApiManager';
import {
  buildApiUrl,
  getAllEndpoints as getCoreEndpoints,
  getEndpointById as getCoreEndpointById,
  addCustomEndpoint as addCoreCustomEndpoint,
  removeCustomEndpoint as removeCoreCustomEndpoint,
  isCustomEndpoint,
  FIXED_API_PORT,
  type BackendApiEndpoint,
} from '@/core/integrations/laravel/LaravelEndpoints';
import type {
  WfNewEndpoint, WfNewEndpointHealth, WfNewEndpointSnapshot,
} from './WfNewApiTypes';

/** One health event for the whole UI — the core manager's pass event. */
export const WORDNEW_API_HEALTH_EVENT = API_HEALTH_EVENT;

/** The fixed backend API port for custom host entries (shared with core). */
export const WFNEW_API_PORT = FIXED_API_PORT;

/** Build a base/full URL for an endpoint. */
export function buildEndpointUrl(ep: WfNewEndpoint, path = ''): string {
  return buildApiUrl(ep, path);
}

function toWfNewEndpoint(ep: BackendApiEndpoint): WfNewEndpoint {
  const custom = isCustomEndpoint(ep.id);
  return {
    ...ep,
    kind: custom ? 'custom' : ep.basePath ? 'tailnet' : 'domain',
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
  /** Connection to the selected endpoint (shared with every Laravel transport). */
  readonly link = apiManager.link;
  private testing = false;
  private listeners = new Set<() => void>();
  private snapshot: WfNewEndpointSnapshot = this.buildSnapshot();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener(API_HEALTH_EVENT, () => this.emit());
    }
    apiManager.link.subscribe(() => this.emit());
    // Instant synchronous pick (no probing) so early requests use the
    // persisted endpoint before the first detection pass settles.
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
      link: apiManager.link.getState(),
      ready: true,
      testing: this.testing,
    };
  }

  /** Rebuild the snapshot and notify React subscribers. */
  private emit(): void {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((l) => l());
  }

  getAllEndpoints(): WfNewEndpoint[] {
    return getCoreEndpoints().map(toWfNewEndpoint);
  }

  getEndpointById(id: string): WfNewEndpoint | undefined {
    const core = getCoreEndpointById(id);
    return core ? toWfNewEndpoint(core) : undefined;
  }

  async checkEndpoint(ep: WfNewEndpoint, timeout?: number): Promise<WfNewEndpointHealth> {
    return toWfNewHealth(await apiManager.checkEndpoint(ep, { timeout }));
  }

  /** Run the first detection pass (single-flight). Safe to call repeatedly. */
  initialize(timeout?: number): Promise<void> {
    return apiManager.initialize({ timeout });
  }

  whenReady(): Promise<void> {
    return this.initialize();
  }

  /** Probe every endpoint (availability only); true when the selected one answers. */
  async detect(): Promise<boolean> {
    this.testing = true;
    this.emit();
    try {
      return await apiManager.detectEndpoints();
    } finally {
      this.testing = false;
      this.emit();
    }
  }

  /** Verified user switch: the core probes first and selects only a reachable endpoint. */
  async switchEndpoint(id: string, timeout?: number): Promise<{ ok: boolean; error: string | null }> {
    const { ok, result } = await apiManager.switchEndpoint(id, timeout);
    this.emit();
    return { ok, error: ok ? null : result?.error ?? null };
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

  /** The selected endpoint answered its last probe. */
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
}

export const wfNewEndpoints = new WfNewEndpointManager();
