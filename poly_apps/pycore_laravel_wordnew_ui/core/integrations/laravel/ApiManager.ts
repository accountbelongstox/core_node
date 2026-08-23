/**
 * API Manager - centrally manages all API endpoints
 * Provides persisted selection, first-run detection, and health checks
 */

import {
  BackendApiEndpoint,
  GLOBAL_API_ENDPOINTS,
  buildApiUrl,
  getEndpointById,
  getAllEndpoints,
} from '@/core/integrations/laravel/LaravelEndpoints';
import { clampRecheckInterval } from '../../health/OfflineRecheckScheduler';
import { loadWebAccessConfig } from '../../contracts/DomainConfig';
import { setSharedBaseURL } from './transport/BaseAPI';
import { StorageManager } from '../../persistence';
import { LaravelStorageKeys as StorageKeys } from './LaravelStorageKeys';
import { EndpointProbeAPI } from './transport/EndpointProbeAPI';
import { createLaravelModuleConfig, LARAVEL_API_PREFIX } from './transport/ApiContract';

/** Fired whenever a full health pass settles (startup, interval retry, manual re-detect). */
export const API_HEALTH_EVENT = 'api-health-initialized';

export interface HealthCheckResult {
  endpoint: BackendApiEndpoint;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: number;
}

interface ApiManagerOptions {
  autoDetect?: boolean;
  timeout?: number;
}

class ApiManager {
  private endpointProbe = new EndpointProbeAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.root));
  private currentEndpoint: BackendApiEndpoint | null = null;
  private healthResults: Map<string, HealthCheckResult> = new Map();
  private initialized = false;
  /**
   * Persistence invariant: localStorage is the source of truth for the active
   * Laravel endpoint. Health probes may update badges, but must never replace
   * a persisted endpoint during refresh, HMR, or React StrictMode remounts.
   * Only an explicit UI switch or reset may change the stored selection.
   */
  /**
   * In-flight promises used for single-flight guarding. The boolean
   * `initialized` flag is NOT sufficient under React 18 StrictMode (the init
   * effect fires twice) combined with concurrent callers: both callers can
   * observe `initialized === false` before either sets it. Storing the
   * in-flight Promise lets every concurrent/duplicate caller await the exact
   * same operation. `recheckPromise` single-flights the STORED-FIRST detection
   * pass shared by startup, the all-Offline interval retry and the manual
   * Re-detect button.
   */
  private initPromise: Promise<void> | null = null;
  private recheckPromise: Promise<boolean> | null = null;

  /** Select in memory and re-point every centralized Laravel transport. */
  private activateEndpoint(endpoint: BackendApiEndpoint): BackendApiEndpoint {
    this.currentEndpoint = endpoint;
    setSharedBaseURL(buildApiUrl(endpoint));
    return endpoint;
  }
  /**
   * Initialize the API manager.
   *
   * Behaviour (corrected requirement — detection is AUTOMATIC at startup,
   * never click-triggered):
   *  1. Every persisted current endpoint is locked until the user changes or
   *     resets it. Health checks update its status but never switch away.
   *  2. Select the active endpoint by precedence:
   *       a. Any resolvable stored endpoint, regardless of health.
   *       b. With no stored state, the first healthy endpoint by priority.
   *       c. With no stored state and nothing healthy, the synchronous
   *          first-run endpoint, kept marked unhealthy so the app renders.
   *  3. Automatic selection is allowed only when no persisted selection
   *     exists yet. Its first result is persisted and becomes stable.
   *
   * Single-flight + StrictMode-safe: concurrent/duplicate callers reuse the
   * same in-flight Promise (`recheckPromise`), so the stored-first pass runs
   * at most once at a time even when the StrictMode init effect double-fires.
   */
  /**
   * Synchronous endpoint pre-selection — NO network, NO probing.
   *
   * Picks the active endpoint instantly so the app shell can paint within a
   * tick (no white "Loading API endpoint..." screen). Precedence, by store
   * key then config order:
   *   1. api_user_modified  (the manual switcher's choice — highest trust)
   *   2. api_current_endpoint
   *   3. api_auto_detected
   *   4. first endpoint by priority index (config order)
   *
   * This is a best-effort guess made WITHOUT health knowledge; the background
   * stored-first pass (runBackgroundHealthPass) only probes persisted state.
   * Idempotent and StrictMode-safe: if
   * an endpoint is already selected it is kept (the background pass owns any
   * later change). Returns the chosen endpoint, or null if none are
   * configured.
   */
  preselectEndpointSync(): BackendApiEndpoint | null {
    if (this.currentEndpoint) {
      return this.currentEndpoint;
    }

    const endpoints = getAllEndpoints();

    const candidateId =
      this.getUserModifiedEndpoint() ??
      this.getStoredCurrentEndpoint() ??
      this.getAutoDetectedEndpoint();

    if (candidateId) {
      const stored = getEndpointById(candidateId);
      if (stored) {
        this.migrateResolvedEndpointId(candidateId, stored.id);
        this.setStoredCurrentEndpoint(stored.id);
        return this.activateEndpoint(stored);
      }
    }

    // Default to the highest-priority static endpoint (config order). No store
    // write-back here — this is only a synchronous guess; the background pass
    // is the source of truth for persisting a known-good endpoint.
    this.currentEndpoint = endpoints.length > 0 ? endpoints[0] : null;
    if (this.currentEndpoint) setSharedBaseURL(buildApiUrl(this.currentEndpoint));
    return this.currentEndpoint;
  }

  async initialize(options: ApiManagerOptions = {}): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize(options).finally(() => {
      // Keep initPromise resolved (not nulled) so a late concurrent caller
      // still awaits the completed work; `initialized` short-circuits future
      // calls entirely.
      this.initialized = true;
    });

    return this.initPromise;
  }

  private async doInitialize(options: ApiManagerOptions): Promise<void> {
    // Same stored-first pass as every later recheck — one code path for
    // startup, interval retry and manual Re-detect.
    await this.recheckEndpoints(options.timeout);
  }

  /**
   * Background health refinement (does NOT gate first paint). Runs the shared
   * STORED-FIRST detection pass (see recheckEndpoints) and returns the
   * endpoint that should now be live so the caller (App.tsx) can re-point
   * `api` after first-run selection. A stored endpoint is never replaced.
   * StrictMode-safe via the pass's single-flight.
   */
  async runBackgroundHealthPass(timeout?: number): Promise<BackendApiEndpoint | null> {
    await this.recheckEndpoints(timeout);
    return this.currentEndpoint;
  }

  /**
   * First-run availability selection. Callers reach this only when no
   * persisted endpoint resolves; established selections never enter it.
   */
  private applyAvailabilityFailover(results: HealthCheckResult[]): BackendApiEndpoint | null {
    const endpoints = getAllEndpoints();
    const healthyIds = new Set(
      results.filter(r => r.isHealthy).map(r => r.endpoint.id)
    );
    const userEndpointId = this.getUserModifiedEndpoint();
    const userEndpoint = userEndpointId ? getEndpointById(userEndpointId) : undefined;

    // A manual selection is a lock, not a preference. Its availability only
    // changes the status badge; automatic detection must never replace it.
    if (userEndpoint) {
      return this.activateEndpoint(userEndpoint);
    }

    // Synchronously-chosen endpoint is healthy — nothing to fail over.
    if (this.currentEndpoint && healthyIds.has(this.currentEndpoint.id)) {
      return this.currentEndpoint;
    }

    // Same precedence as init: a stored endpoint that is healthy wins.
    const storedEndpointId =
      this.getStoredCurrentEndpoint() ?? this.getAutoDetectedEndpoint();

    if (storedEndpointId && this.isStoredIdHealthy(storedEndpointId, healthyIds)) {
      const endpoint = getEndpointById(storedEndpointId);
      if (endpoint) {
        return this.activateEndpoint(endpoint);
      }
    }

    // First-run selection only: persist the first healthy endpoint. Later
    // refreshes treat api_current_endpoint as an immutable UI selection.
    const firstHealthy = endpoints.find(e => healthyIds.has(e.id));
    if (firstHealthy) {
      this.activateEndpoint(firstHealthy);
      this.setAutoDetectedEndpoint(firstHealthy.id);
      return this.currentEndpoint;
    }

    // Nothing healthy — keep the synchronous pick (marked unhealthy via
    // healthResults). Do NOT write back a dead endpoint.
    return this.currentEndpoint;
  }

  /**
   * The ONE detection routine — STORED-FIRST (startup, all-Offline interval
   * retry and the manual "Re-detect" button all land here; single-flight so
   * concurrent callers share one pass):
   *
   *  1. When any persisted current selection resolves, probe only that
   *     endpoint and keep it selected regardless of availability.
   *  2. Without persisted state, probe the synchronous first-run candidate.
   *     If it fails, probe all endpoints and persist one healthy endpoint.
   *  3. If nothing is healthy resolve false without changing the selection.
   *
   * Dispatches API_HEALTH_EVENT after every pass so health UIs refresh.
   */
  async recheckEndpoints(timeout?: number): Promise<boolean> {
    if (this.recheckPromise) {
      return this.recheckPromise;
    }

    this.recheckPromise = (async () => {
      try {
        // Refresh the shell-written domain config FIRST: current-url endpoint
        // resolution (api.<prefix>.<host> for HTTPS origins) must see the
        // latest region prefix before any persisted id resolves.
        await loadWebAccessConfig();
        const persistedEndpointId =
          this.getUserModifiedEndpoint() ??
          this.getStoredCurrentEndpoint() ??
          this.getAutoDetectedEndpoint();
        const persistedEndpoint = persistedEndpointId
          ? getEndpointById(persistedEndpointId)
          : undefined;

        if (persistedEndpoint) {
          if (persistedEndpointId) {
            this.migrateResolvedEndpointId(persistedEndpointId, persistedEndpoint.id);
          }
          this.setStoredCurrentEndpoint(persistedEndpoint.id);
          const result = await this.checkEndpoint(persistedEndpoint, { timeout });
          this.activateEndpoint(persistedEndpoint);
          return result.isHealthy;
        }

        // First run only: there is no localStorage selection yet.
        const preferred = this.currentEndpoint;

        if (preferred) {
          const result = await this.checkEndpoint(preferred, { timeout });
          if (result.isHealthy) {
            this.activateEndpoint(preferred);
            this.setAutoDetectedEndpoint(preferred.id);
            return true;
          }
        }

        // Stage 2: full parallel sweep + highest-weight failover.
        const results = await this.checkAllEndpoints(timeout);
        this.applyAvailabilityFailover(results);
        return results.some(r => r.isHealthy);
      } finally {
        this.recheckPromise = null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(API_HEALTH_EVENT));
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
   * All-Offline retry interval for the laravel-manager end. Defaults to the
   * config's healthCheckInterval; a per-browser override set in the endpoint
   * switcher UI is persisted in localStorage and read fresh on every tick.
   */
  getRecheckIntervalMs(): number {
    const raw = StorageManager.getRaw(StorageKeys.RECHECK_INTERVAL_MS);
    const parsed = raw === null ? NaN : Number(raw);
    return clampRecheckInterval(parsed, GLOBAL_API_ENDPOINTS.healthCheckInterval);
  }

  setRecheckIntervalMs(ms: number): void {
    const clamped = clampRecheckInterval(ms, GLOBAL_API_ENDPOINTS.healthCheckInterval);
    StorageManager.setRaw(StorageKeys.RECHECK_INTERVAL_MS, String(clamped));
  }

  /**
   * Check the health status of a single endpoint
   */
  async checkEndpoint(
    endpoint: BackendApiEndpoint,
    options: { timeout?: number } = {}
  ): Promise<HealthCheckResult> {
    const timeout = options.timeout ?? GLOBAL_API_ENDPOINTS.timeout;
    const startTime = performance.now();
    const baseURL = buildApiUrl(endpoint);
    let result: HealthCheckResult;

    try {
      const response = await this.endpointProbe.probeHealth(baseURL, timeout);
      const responseTime = Math.round(performance.now() - startTime);
      const payload = response.data;
      const healthy = response.success && !!payload && (payload.status !== undefined || payload.service !== undefined);
      result = {
        endpoint,
        isHealthy: healthy,
        responseTime,
        error: healthy ? undefined : response.error || 'Invalid Laravel health response',
        timestamp: Date.now()
      };
    } catch (error) {
      const responseTime = Math.round(performance.now() - startTime);
      result = {
        endpoint,
        isHealthy: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };

    }
    this.healthResults.set(endpoint.id, result);
    return result;
  }

  /**
   * Check all endpoints
   */
  async checkAllEndpoints(timeout?: number): Promise<HealthCheckResult[]> {
    const endpoints = getAllEndpoints();
    const results = await Promise.all(
      endpoints.map(endpoint => this.checkEndpoint(endpoint, { timeout }))
    );
    return results;
  }

  /**
   * Auto-detect the active endpoint.
   *
   * Detection now lives in `initialize()` (single parallel pass,
   * single-flight, StrictMode-safe), so this is a thin wrapper that
   * guarantees initialization has run and returns the selected endpoint. It
   * performs NO extra probing of its own.
   */
  async autoDetectEndpoint(options: { timeout?: number } = {}): Promise<BackendApiEndpoint | null> {
    await this.initialize({ timeout: options.timeout });
    return this.currentEndpoint;
  }

  /**
   * Manually set the endpoint (blind — no probe, no live re-point).
   * Prefer switchEndpoint(): it verifies reachability BEFORE persisting and
   * re-points every API module immediately.
   */
  setEndpoint(endpointId: string, saveAsUserChoice: boolean = true): boolean {
    const endpoint = getEndpointById(endpointId);
    if (!endpoint) return false;

    this.activateEndpoint(endpoint);
    this.setStoredCurrentEndpoint(endpointId);

    if (saveAsUserChoice) {
      this.setUserModifiedEndpoint(endpointId);
    }

    return true;
  }

  /**
   * Verified manual switch — the ONLY path UI switchers should use.
   *
   * 1. Probe the target endpoint first (config timeout, default 3000ms).
   * 2. Healthy → set as current, persist as the user pin, and re-point the
   *    SHARED base URL so every API module switches immediately (callers may
   *    still reload for a clean page state — now guaranteed to land on a
   *    working endpoint).
   * 3. Dead → change NOTHING (no pin, no current, no base URL); the caller
   *    shows the failure. This is what prevents the "switched to a dead
   *    endpoint and the whole page hangs" failure mode.
   *
   * Always dispatches API_HEALTH_EVENT so health badges reflect the probe.
   */
  async switchEndpoint(
    endpointId: string,
    timeout?: number
  ): Promise<{ ok: boolean; endpoint: BackendApiEndpoint | null; result: HealthCheckResult | null }> {
    const endpoint = getEndpointById(endpointId);
    if (!endpoint) {
      return { ok: false, endpoint: null, result: null };
    }

    const result = await this.checkEndpoint(endpoint, { timeout });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(API_HEALTH_EVENT));
    }

    if (!result.isHealthy) {
      return { ok: false, endpoint, result };
    }

    this.activateEndpoint(endpoint);
    this.setUserModifiedEndpoint(endpointId);
    return { ok: true, endpoint, result };
  }

  /**
   * Get the current endpoint
   */
  getCurrentEndpoint(): BackendApiEndpoint | null {
    return this.currentEndpoint;
  }

  /**
   * Get the current Base URL
   */
  getCurrentBaseUrl(): string {
    if (!this.currentEndpoint) {
      throw new Error('No endpoint selected. Call initialize() first.');
    }
    return buildApiUrl(this.currentEndpoint);
  }

  /**
   * Build the full URL
   */
  buildUrl(path: string): string {
    if (!this.currentEndpoint) {
      throw new Error('No endpoint selected. Call initialize() first.');
    }
    return buildApiUrl(this.currentEndpoint, path);
  }

  /**
   * Get all endpoints
   */
  getAllEndpoints(): BackendApiEndpoint[] {
    return getAllEndpoints();
  }

  /**
   * Get a health check result
   */
  getHealthResult(endpointId: string): HealthCheckResult | undefined {
    return this.healthResults.get(endpointId);
  }

  /**
   * Get all health check results
   */
  getAllHealthResults(): HealthCheckResult[] {
    return Array.from(this.healthResults.values());
  }

  // LocalStorage management methods

  private getStoredCurrentEndpoint(): string | null {
    return StorageManager.getRaw(StorageKeys.CURRENT_ENDPOINT);
  }

  private getAutoDetectedEndpoint(): string | null {
    return StorageManager.getRaw(StorageKeys.AUTO_DETECTED_ENDPOINT);
  }

  private setAutoDetectedEndpoint(endpointId: string): void {
    StorageManager.setRaw(StorageKeys.AUTO_DETECTED_ENDPOINT, endpointId);
    this.setStoredCurrentEndpoint(endpointId);
  }

  private getUserModifiedEndpoint(): string | null {
    return StorageManager.getRaw(StorageKeys.USER_MODIFIED_ENDPOINT);
  }

  /** Resolve a stored TYPE/id and test against probed endpoint ids. */
  private isStoredIdHealthy(storedId: string | null, healthyIds: Set<string>): boolean {
    if (!storedId) return false;
    const resolved = getEndpointById(storedId);
    return !!resolved && healthyIds.has(resolved.id);
  }

  private setUserModifiedEndpoint(endpointId: string): void {
    StorageManager.setRaw(StorageKeys.USER_MODIFIED_ENDPOINT, endpointId);
    this.setStoredCurrentEndpoint(endpointId);
  }

  /** Persist every accepted selection; health and reload paths never clear it. */
  private setStoredCurrentEndpoint(endpointId: string): void {
    StorageManager.setRaw(StorageKeys.CURRENT_ENDPOINT, endpointId);
  }

  /** Upgrade legacy dynamic IDs to the exact resolved endpoint in-place. */
  private migrateResolvedEndpointId(sourceId: string, resolvedId: string): void {
    if (!sourceId || sourceId === resolvedId) return;
    if (this.getUserModifiedEndpoint() === sourceId) {
      StorageManager.setRaw(StorageKeys.USER_MODIFIED_ENDPOINT, resolvedId);
    }
    if (this.getAutoDetectedEndpoint() === sourceId) {
      StorageManager.setRaw(StorageKeys.AUTO_DETECTED_ENDPOINT, resolvedId);
    }
    if (this.getStoredCurrentEndpoint() === sourceId) {
      this.setStoredCurrentEndpoint(resolvedId);
    }
  }

  /**
   * Clear only the manual marker; the persisted current endpoint remains.
   */
  clearUserModifiedEndpoint(): void {
    StorageManager.remove(StorageKeys.USER_MODIFIED_ENDPOINT);
  }

  /**
   * Reset all settings
   */
  reset(): void {
    StorageManager.remove(StorageKeys.AUTO_DETECTED_ENDPOINT);
    StorageManager.remove(StorageKeys.USER_MODIFIED_ENDPOINT);
    StorageManager.remove(StorageKeys.CURRENT_ENDPOINT);
    this.currentEndpoint = null;
    this.healthResults.clear();
  }
}

// Export the singleton
export const apiManager = new ApiManager();
// Restore localStorage during module evaluation, before child effects can issue
// Laravel requests. Refresh and HMR therefore start on the persisted endpoint.
apiManager.preselectEndpointSync();
