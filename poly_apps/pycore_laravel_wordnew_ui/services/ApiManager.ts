/**
 * API Manager - centrally manages all API endpoints
 * Provides auto-detection, health checks, failover, and other features
 */

import {
  BackendApiEndpoint,
  GLOBAL_API_ENDPOINTS,
  buildApiUrl,
  getEndpointById,
  getAllEndpoints,
  getCurrentOriginEndpoint,
  isCurrentUrlId,
  CURRENT_URL_TYPE,
} from '../config/api-endpoints';
import { clampRecheckInterval } from '../core/health/OfflineRecheckScheduler';
import { setSharedBaseURL } from '@/apps/laravel-manager/api';
import { pycoreLaravelApi } from '../apps/laravel-manager/integrations/pycore';
import { StorageManager } from '../core/persistence';
import { LaravelManagerStorageKeys as StorageKeys } from '../apps/laravel-manager/persistence/LaravelManagerStorageKeys';

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
  private currentEndpoint: BackendApiEndpoint | null = null;
  private healthResults: Map<string, HealthCheckResult> = new Map();
  private initialized = false;
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
  /**
   * Initialize the API manager.
   *
   * Behaviour (corrected requirement — detection is AUTOMATIC at startup,
   * never click-triggered):
   *  1. A manually selected endpoint is locked until the user changes or
   *     resets it. Health checks update its status but never clear the pin or
   *     switch away. Without a manual pin, stored-first automatic detection
   *     probes the last-used endpoint and fails over when it is unavailable.
   *  2. Select the active endpoint by precedence:
   *       a. A stored endpoint (api_user_modified first, then
   *          api_current_endpoint / api_auto_detected) that is in the healthy
   *          set — it is the user's prior / last-used choice.
   *       b. Else the first healthy endpoint in priority order.
   *       c. Else (nothing healthy) the highest-priority endpoint, kept marked
   *          unhealthy, so the app still renders.
   *  3. Principle "以能使用的为准": if the stored endpoint is dead, the
   *     auto-selected healthy endpoint is written back to
   *     api_current_endpoint / api_auto_detected so the next load prefers the
   *     now-known-good one. api_user_modified is only changed by explicit
   *     user selection or reset.
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
   *   4. Current URL (:9000) when no localStorage preference exists yet
   *   5. first endpoint by priority index (config order)
   *
   * This is a best-effort guess made WITHOUT health knowledge; the background
   * stored-first pass (runBackgroundHealthPass) refines it and auto-fails-over if
   * this pick turns out to be unreachable. Idempotent and StrictMode-safe: if
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
        this.currentEndpoint = stored;
        return this.currentEndpoint;
      }
    }

    // No stored preference — default to the page's Current URL (:9000).
    const currentUrl = getCurrentOriginEndpoint();
    if (currentUrl) {
      this.currentEndpoint = currentUrl;
      return this.currentEndpoint;
    }

    // Fall back to the highest-priority static endpoint (config order). No store
    // write-back here — this is only a synchronous guess; the background pass
    // is the source of truth for persisting a known-good endpoint.
    this.currentEndpoint = endpoints.length > 0 ? endpoints[0] : null;
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
   * `api` if it changed. StrictMode-safe via the pass's single-flight.
   */
  async runBackgroundHealthPass(timeout?: number): Promise<BackendApiEndpoint | null> {
    await this.recheckEndpoints(timeout);
    return this.currentEndpoint;
  }

  /**
   * "以能使用的为准" selection applied to one finished health pass. Shared by
   * the startup background pass and every later recheck (interval retry /
   * manual re-detect), so failover semantics never diverge between the two.
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
      this.currentEndpoint = userEndpoint;
      return this.currentEndpoint;
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
        this.currentEndpoint = endpoint;
        return this.currentEndpoint;
      }
    }

    // First healthy endpoint in priority order — write back so the next load
    // prefers it when automatic selection is active.
    const firstHealthy = endpoints.find(e => healthyIds.has(e.id));
    if (firstHealthy) {
      this.currentEndpoint = firstHealthy;
      const persistId = isCurrentUrlId(firstHealthy.id) ? CURRENT_URL_TYPE : firstHealthy.id;
      this.setAutoDetectedEndpoint(persistId);
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
   *  1. When api_user_modified resolves, probe only that endpoint and keep it
   *     selected regardless of availability.
   *  2. Without a manual lock, probe the stored automatic endpoint first. If
   *     it fails, probe all endpoints and select the highest-weight healthy one.
   *  3. If nothing is healthy resolve false — the caller keeps the all-Offline
   *     interval retry loop ticking.
   *
   * Dispatches API_HEALTH_EVENT after every pass so health UIs refresh.
   */
  async recheckEndpoints(timeout?: number): Promise<boolean> {
    if (this.recheckPromise) {
      return this.recheckPromise;
    }

    this.recheckPromise = (async () => {
      try {
        const userEndpointId = this.getUserModifiedEndpoint();
        const userEndpoint = userEndpointId ? getEndpointById(userEndpointId) : undefined;

        if (userEndpoint) {
          const result = await this.checkEndpoint(userEndpoint, { timeout });
          this.currentEndpoint = userEndpoint;
          return result.isHealthy;
        }

        // Stage 1: stored last-used endpoint only.
        const preferredId =
          this.getStoredCurrentEndpoint() ??
          this.getAutoDetectedEndpoint();
        const preferred =
          (preferredId ? getEndpointById(preferredId) : undefined) ??
          this.currentEndpoint;

        if (preferred) {
          const result = await this.checkEndpoint(preferred, { timeout });
          if (result.isHealthy) {
            this.currentEndpoint = preferred;
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
    const raw = StorageManager.getRaw(StorageKeys.API_RECHECK_INTERVAL_MS);
    const parsed = raw === null ? NaN : Number(raw);
    return clampRecheckInterval(parsed, GLOBAL_API_ENDPOINTS.healthCheckInterval);
  }

  setRecheckIntervalMs(ms: number): void {
    const clamped = clampRecheckInterval(ms, GLOBAL_API_ENDPOINTS.healthCheckInterval);
    StorageManager.setRaw(StorageKeys.API_RECHECK_INTERVAL_MS, String(clamped));
  }

  /**
   * Check the health status of a single endpoint
   */
  async checkEndpoint(
    endpoint: BackendApiEndpoint,
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
        headers: {
          'Accept': 'application/json'
        }
      });

      const responseTime = Math.round(performance.now() - startTime);

      // Health must mean "the Laravel backend answered", not merely "some server
      // returned 2xx". A dev server / reverse proxy answers /api/health with a
      // 200 text/html SPA index — a false positive that would pin the dashboard
      // to a non-API origin and show the wrong availability. Require 2xx + JSON
      // content-type + the backend's health marker
      // ({"status":"healthy","service":"Laravel API",...}); reject HTML/non-JSON.
      let healthy = false;
      if (response.ok) {
        const contentType = (response.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          try {
            const body = await response.clone().json();
            healthy = !!body && typeof body === 'object' &&
              (body.status !== undefined || body.service !== undefined);
          } catch {
            healthy = false;
          }
        }
      }

      const result: HealthCheckResult = {
        endpoint,
        isHealthy: healthy,
        responseTime,
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
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };

      this.healthResults.set(endpoint.id, result);
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
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

    this.currentEndpoint = endpoint;

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

    this.currentEndpoint = endpoint;
    const persistId = isCurrentUrlId(endpointId) ? CURRENT_URL_TYPE : endpointId;
    this.setUserModifiedEndpoint(persistId);
    setSharedBaseURL(buildApiUrl(endpoint));
    // Persist the same choice pycore-side so its sync engine targets this
    // backend too (fire-and-forget: pycore may be offline; the UI switch
    // already succeeded and must not fail because of it).
    void pycoreLaravelApi.select(buildApiUrl(endpoint)).catch(() => {});
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
    return StorageManager.getRaw(StorageKeys.API_CURRENT_ENDPOINT);
  }

  private getAutoDetectedEndpoint(): string | null {
    return StorageManager.getRaw(StorageKeys.API_AUTO_DETECTED_ENDPOINT);
  }

  private setAutoDetectedEndpoint(endpointId: string): void {
    StorageManager.setRaw(StorageKeys.API_AUTO_DETECTED_ENDPOINT, endpointId);
    StorageManager.setRaw(StorageKeys.API_CURRENT_ENDPOINT, endpointId);
  }

  private getUserModifiedEndpoint(): string | null {
    return StorageManager.getRaw(StorageKeys.API_USER_MODIFIED_ENDPOINT);
  }

  /** Resolve a stored TYPE/id and test against probed endpoint ids. */
  private isStoredIdHealthy(storedId: string | null, healthyIds: Set<string>): boolean {
    if (!storedId) return false;
    const resolved = getEndpointById(storedId);
    return !!resolved && healthyIds.has(resolved.id);
  }

  private setUserModifiedEndpoint(endpointId: string): void {
    StorageManager.setRaw(StorageKeys.API_USER_MODIFIED_ENDPOINT, endpointId);
    StorageManager.setRaw(StorageKeys.API_CURRENT_ENDPOINT, endpointId);
  }

  /**
   * Clear the user setting (restore auto-detection)
   */
  clearUserModifiedEndpoint(): void {
    StorageManager.remove(StorageKeys.API_USER_MODIFIED_ENDPOINT);
  }

  /**
   * Reset all settings
   */
  reset(): void {
    StorageManager.remove(StorageKeys.API_AUTO_DETECTED_ENDPOINT);
    StorageManager.remove(StorageKeys.API_USER_MODIFIED_ENDPOINT);
    StorageManager.remove(StorageKeys.API_CURRENT_ENDPOINT);
    this.currentEndpoint = null;
    this.healthResults.clear();
  }
}

// Export the singleton
export const apiManager = new ApiManager();

