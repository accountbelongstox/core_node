/**
 * WordflowApiManager — unified backend endpoint management for the wordflow end.
 *
 * Ported from poly_apps/qy_capacitor/services/ApiManager.ts. Detection is
 * STORED-FIRST (the realized contract for all ends):
 *   - probe ONLY the stored last-used endpoint first; if it answers, use it
 *     and probe nothing else,
 *   - only when it is dead probe all endpoints in parallel and fail over to
 *     the highest-weight healthy one (availability-first, user pin by weight),
 *   - health-marker check (backend /api/health JSON only, not an SPA index),
 *   - persisted auto/current choice via WordflowStorage (wf_-namespaced).
 */

import {
  ApiEndpoint,
  GLOBAL_API_ENDPOINTS,
  buildApiUrl,
  getEndpointById,
  getAllEndpoints
} from './wordflow-api-endpoints';
import { StorageCenter, StorageKey } from './WordflowStorage';
import { clampRecheckInterval } from '../../../../core/health/OfflineRecheckScheduler';
import {
  WF_PROBE_ERROR,
  classifyProbeFailure,
} from './wordflowApiMessages';
// Unified endpoint source: the Settings-selected endpoint the canonical
// wfNewApi transport uses (WfNewEndpoints). Request routing delegates to it so
// the wordflow stack targets the SAME base URL the user picked in Settings,
// not this manager's own probe list — the probe machinery below is kept only
// for the offline-recheck loop, never for building request/media URLs.
import { wfNewEndpoints } from '../../api/WfNewEndpoints';

/** Fired whenever a full wordflow health pass settles (interval retry / manual re-detect). */
export const WORDFLOW_API_HEALTH_EVENT = 'wf-api-health-changed';

/**
 * Plain localStorage (not the async StorageCenter): the offline retry loop
 * needs a synchronous read on every tick, and this is per-browser UI config,
 * not user data.
 */
const RECHECK_INTERVAL_LS_KEY = 'wf_api_recheck_interval_ms';

export interface HealthCheckResult {
  endpoint: ApiEndpoint;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: number;
}

interface ApiManagerOptions {
  autoDetect?: boolean;
  timeout?: number;
}

class WordflowApiManager {
  private currentEndpoint: ApiEndpoint | null = null;
  private healthResults: Map<string, HealthCheckResult> = new Map();
  private ready = false;
  private readyResolvers: Array<() => void> = [];
  /** Single-flight for initialize(): WfApp's proactive init and WordflowApi's lazy ensureReady share one probe. */
  private initPromise: Promise<void> | null = null;
  /** Single-flight for recheckAndFailover(): interval ticks and the settings page's Refresh share one probe. */
  private recheckPromise: Promise<boolean> | null = null;

  /**
   * Resolves once endpoint detection has completed (or failed). Callers that
   * issue requests should await this so they never hit a null endpoint.
   */
  whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise<void>(resolve => this.readyResolvers.push(resolve));
  }

  private markReady(): void {
    this.ready = true;
    const resolvers = this.readyResolvers;
    this.readyResolvers = [];
    resolvers.forEach(resolve => resolve());
  }

  /**
   * Initialize the manager.
   *
   * Selection is AVAILABILITY-FIRST: all endpoints are probed once in parallel,
   * then the best HEALTHY endpoint is chosen. A stored choice (user-modified or
   * auto-detected) only ranks higher in weight — it is never blindly pinned, so
   * a dead manual/auto choice still yields a working session endpoint.
   */
  async initialize(options: ApiManagerOptions = {}): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.doInitialize(options);
    return this.initPromise;
  }

  private async doInitialize(options: ApiManagerOptions): Promise<void> {
    const { autoDetect = true, timeout = 3000 } = options;

    try {
      if (!autoDetect) {
        const userId = await this.getUserModifiedEndpoint();
        const autoId = await this.getAutoDetectedEndpoint();
        const storedId = userId ?? autoId;
        const stored = storedId ? getEndpointById(storedId) : undefined;
        this.currentEndpoint = stored ?? getAllEndpoints()[0];
        return;
      }

      // Same stored-first pass as every later recheck — one code path for
      // startup, interval retry and manual re-detect.
      await this.detectStoredFirst(timeout);
    } finally {
      this.markReady();
    }
  }

  /**
   * The ONE detection routine — STORED-FIRST:
   *  1. Probe ONLY the stored last-used endpoint (user pin → auto-detected →
   *     in-memory current). If it answers, keep it — nothing else is probed.
   *  2. Otherwise probe ALL endpoints in parallel and auto-switch to the
   *     highest-weight healthy one (selectAvailabilityFirst: user pin →
   *     auto-detected → config priority; write-back, user pin untouched).
   *  3. Returns false when nothing is healthy — the caller keeps the
   *     all-Offline interval retry loop ticking.
   */
  private async detectStoredFirst(timeout?: number): Promise<boolean> {
    const userId = await this.getUserModifiedEndpoint();
    const autoId = await this.getAutoDetectedEndpoint();

    // Stage 1: stored last-used endpoint only.
    const preferredId = userId ?? autoId;
    const preferred =
      (preferredId ? getEndpointById(preferredId) : undefined) ?? this.currentEndpoint;

    if (preferred) {
      const result = await this.checkEndpoint(preferred, { timeout });
      if (result.isHealthy) {
        this.currentEndpoint = preferred;
        return true;
      }
    }

    // Stage 2: full parallel sweep + highest-weight failover.
    const results = await this.checkAllEndpoints(timeout);
    this.selectAvailabilityFirst(results, userId, autoId);
    return results.some(r => r.isHealthy);
  }

  /**
   * Pick the best endpoint from a set of probe results, availability-first.
   *
   * PRIMARY sort key = availability. Tie-break among healthy endpoints,
   * lowest-rank-first: user-modified, then auto-detected, then config priority.
   * The chosen endpoint is persisted to api_auto_detected + api_current_endpoint.
   * api_user_modified is never written here — only setEndpoint owns it.
   */
  private selectAvailabilityFirst(
    results: HealthCheckResult[],
    userId: string | null,
    autoId: string | null
  ): ApiEndpoint | null {
    const weight = (id: string): number => {
      if (id === userId) return 0;
      if (id === autoId) return 1;
      return 2;
    };

    const healthy = results
      .filter(result => result.isHealthy)
      .map(result => result.endpoint)
      .sort((a, b) => {
        const w = weight(a.id) - weight(b.id);
        return w !== 0 ? w : a.priority - b.priority;
      });

    const best = healthy[0];
    if (best) {
      this.currentEndpoint = best;
      this.setAutoDetectedEndpoint(best.id);
      console.log(
        `[WordflowApiManager] Selected endpoint "${best.id}" ` +
        `(${best.description}, priority ${best.priority})`
      );
      return best;
    }

    this.currentEndpoint = getAllEndpoints()[0];
    const fallback = this.currentEndpoint;
    console.warn(
      '[WordflowApiManager] No healthy backend API found. ' +
      'Laravel may be stopped on :9000, remote endpoints may be unreachable, ' +
      'or the UI dev server was mistaken for the API. ' +
      `Falling back to "${fallback?.id ?? 'unknown'}" (${fallback?.description ?? 'n/a'}) — still unhealthy. ` +
      'Start poly_apps/laravel_main on port 9000 or pick an endpoint under Settings → API Server.'
    );
    return null;
  }

  /**
   * Check the health status of a single endpoint.
   */
  async checkEndpoint(
    endpoint: ApiEndpoint,
    options: { timeout?: number } = {}
  ): Promise<HealthCheckResult> {
    const timeout = options.timeout ?? GLOBAL_API_ENDPOINTS.timeout;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const startTime = performance.now();

    try {
      const url = buildApiUrl(endpoint, '/api/health');
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });

      const responseTime = Math.round(performance.now() - startTime);
      const isHealthy = await this.isBackendHealthResponse(response);
      let probeError: string | undefined;
      if (!isHealthy) {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (response.ok && contentType.includes('text/html')) {
          probeError = WF_PROBE_ERROR.HTML;
        } else if (!response.ok) {
          probeError = `${WF_PROBE_ERROR.HTTP}:${response.status}`;
        }
      }

      const result: HealthCheckResult = {
        endpoint,
        isHealthy,
        responseTime,
        error: probeError,
        timestamp: Date.now()
      };

      this.healthResults.set(endpoint.id, result);
      return result;
    } catch (error) {
      const responseTime = Math.round(performance.now() - startTime);
      const result: HealthCheckResult = {
        endpoint,
        isHealthy: false,
        responseTime,
        error: classifyProbeFailure(error),
        timestamp: Date.now()
      };

      this.healthResults.set(endpoint.id, result);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * True only when the response is the Laravel backend's /api/health payload.
   * Accepts any 2xx JSON body carrying a recognizable marker (`status` or
   * `service`), and rejects everything else — most importantly a dev server's
   * SPA index.html (200, text/html), which would otherwise be a false "healthy".
   */
  private async isBackendHealthResponse(response: Response): Promise<boolean> {
    if (response.status < 200 || response.status >= 300) return false;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) return false;

    try {
      const body = await response.clone().json();
      if (!body || typeof body !== 'object') return false;
      return body.status !== undefined || body.service !== undefined;
    } catch {
      return false;
    }
  }

  /**
   * Check all endpoints concurrently.
   */
  async checkAllEndpoints(timeout?: number): Promise<HealthCheckResult[]> {
    const endpoints = getAllEndpoints();
    const results = await Promise.all(
      endpoints.map(endpoint => this.checkEndpoint(endpoint, { timeout }))
    );
    return results;
  }

  /**
   * Explicit FULL sweep: probe ALL in parallel, then pick the best HEALTHY
   * one via the shared availability-first selection. Bypasses the stored-first
   * short-circuit on purpose — normal flows should use recheckAndFailover().
   */
  async autoDetectEndpoint(options: { timeout?: number } = {}): Promise<ApiEndpoint | null> {
    const userId = await this.getUserModifiedEndpoint();
    const autoId = await this.getAutoDetectedEndpoint();
    const results = await this.checkAllEndpoints(options.timeout);
    return this.selectAvailabilityFirst(results, userId, autoId);
  }

  /**
   * STORED-FIRST recheck (see detectStoredFirst). The all-Offline interval
   * retry and the settings page's manual Refresh land here; single-flight so
   * concurrent callers share one pass. Resolves true when the kept/failed-over
   * endpoint is healthy. Dispatches WORDFLOW_API_HEALTH_EVENT after every
   * pass so health UIs refresh.
   */
  async recheckAndFailover(timeout?: number): Promise<boolean> {
    if (this.recheckPromise) {
      return this.recheckPromise;
    }

    this.recheckPromise = (async () => {
      try {
        return await this.detectStoredFirst(timeout);
      } finally {
        this.recheckPromise = null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(WORDFLOW_API_HEALTH_EVENT));
        }
      }
    })();

    return this.recheckPromise;
  }

  /** True when the last finished pass saw at least one healthy endpoint. */
  hasHealthyEndpoint(): boolean {
    return Array.from(this.healthResults.values()).some(r => r.isHealthy);
  }

  /**
   * All-Offline retry interval for the wordflow end. Defaults to the config's
   * healthCheckInterval; overridable in WfSettingsApiServerPage, read fresh on
   * every loop tick.
   */
  getRecheckIntervalMs(): number {
    const raw = localStorage.getItem(RECHECK_INTERVAL_LS_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    return clampRecheckInterval(parsed, GLOBAL_API_ENDPOINTS.healthCheckInterval);
  }

  setRecheckIntervalMs(ms: number): void {
    const clamped = clampRecheckInterval(ms, GLOBAL_API_ENDPOINTS.healthCheckInterval);
    localStorage.setItem(RECHECK_INTERVAL_LS_KEY, String(clamped));
  }

  /**
   * Manually set endpoint (pins it as the user choice by default).
   */
  setEndpoint(endpointId: string, saveAsUserChoice: boolean = true): boolean {
    const endpoint = getEndpointById(endpointId);
    if (!endpoint) return false;

    this.currentEndpoint = endpoint;
    if (saveAsUserChoice) {
      this.setUserModifiedEndpoint(endpointId);
    }
    // A manual switch invalidates the completed one-shot detection pass: drop
    // the single-flight promise so the next initialize() — re-armed by
    // wordflowApi.resetEndpointInit() → ensureReady on the next request —
    // really re-probes instead of returning the stale resolved promise. The
    // fresh pass ranks the new user_modified pin first but stays
    // AVAILABILITY-FIRST: a dead manual pick still fails over.
    this.initPromise = null;
    return true;
  }

  getCurrentEndpoint(): ApiEndpoint | null {
    return this.currentEndpoint;
  }

  getCurrentBaseUrl(): string {
    // Delegate to the Settings-selected endpoint so every wordflow request +
    // media/avatar URL resolves to the ONE API the user chose in Settings
    // (unified with wfNewApi). This manager's own currentEndpoint is not used
    // for routing — see the wfNewEndpoints import note.
    return wfNewEndpoints.getCurrentBaseUrl();
  }

  buildUrl(path: string): string {
    return wfNewEndpoints.buildUrl(path);
  }

  getAllEndpoints(): ApiEndpoint[] {
    return getAllEndpoints();
  }

  getHealthResult(endpointId: string): HealthCheckResult | undefined {
    return this.healthResults.get(endpointId);
  }

  getAllHealthResults(): HealthCheckResult[] {
    return Array.from(this.healthResults.values());
  }

  // ---- WordflowStorage-backed endpoint persistence ----

  private getAutoDetectedEndpoint(): Promise<string | null> {
    return StorageCenter.get<string>(StorageKey.API_AUTO_DETECTED);
  }

  private setAutoDetectedEndpoint(endpointId: string): void {
    StorageCenter.set(StorageKey.API_AUTO_DETECTED, endpointId);
    StorageCenter.set(StorageKey.API_CURRENT_ENDPOINT, endpointId);
  }

  private getUserModifiedEndpoint(): Promise<string | null> {
    return StorageCenter.get<string>(StorageKey.API_USER_MODIFIED);
  }

  private setUserModifiedEndpoint(endpointId: string): void {
    StorageCenter.set(StorageKey.API_USER_MODIFIED, endpointId);
    StorageCenter.set(StorageKey.API_CURRENT_ENDPOINT, endpointId);
  }

  clearUserModifiedEndpoint(): void {
    StorageCenter.remove(StorageKey.API_USER_MODIFIED);
  }

  reset(): void {
    StorageCenter.remove(StorageKey.API_AUTO_DETECTED);
    StorageCenter.remove(StorageKey.API_USER_MODIFIED);
    StorageCenter.remove(StorageKey.API_CURRENT_ENDPOINT);
    this.currentEndpoint = null;
    this.healthResults.clear();
    // Allow a post-reset initialize() to run a fresh detection pass.
    this.initPromise = null;
  }
}

export { WF_PROBE_ERROR } from './wordflowApiMessages';
export const apiManager = new WordflowApiManager();
export const wordflowApiManager = apiManager;
