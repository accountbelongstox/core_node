/**
 * API Manager - centrally manages all API endpoints
 * Provides auto-detection, health checks, failover, and other features
 */

import {
  ApiEndpoint,
  GLOBAL_API_ENDPOINTS,
  buildApiUrl,
  getEndpointById,
  getAllEndpoints
} from '../config/api-endpoints';

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

class ApiManager {
  private currentEndpoint: ApiEndpoint | null = null;
  private healthResults: Map<string, HealthCheckResult> = new Map();
  private initialized = false;
  /**
   * In-flight promises used for single-flight guarding. The boolean
   * `initialized` flag is NOT sufficient under React 18 StrictMode (the init
   * effect fires twice) combined with concurrent callers: both callers can
   * observe `initialized === false` before either sets it. Storing the
   * in-flight Promise lets every concurrent/duplicate caller await the exact
   * same operation so the parallel detection pass runs at most once per app
   * load. `healthPassPromise` holds the single parallel all-endpoints probe;
   * both `initialize()` and `runInitialHealthCheck()` await that same Promise
   * so endpoints are never probed more than once.
   */
  private initPromise: Promise<void> | null = null;
  private healthPassPromise: Promise<HealthCheckResult[]> | null = null;
  private readonly STORAGE_KEY_CURRENT = 'api_current_endpoint';
  private readonly STORAGE_KEY_AUTO = 'api_auto_detected';
  private readonly STORAGE_KEY_USER = 'api_user_modified';

  /**
   * Initialize the API manager.
   *
   * Behaviour (corrected requirement — detection is AUTOMATIC at startup,
   * never click-triggered):
   *  1. Probe ALL endpoints in PARALLEL exactly once and compute the healthy
   *     set from that single pass. No timers, no intervals, no retries.
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
   *     now-known-good one. api_user_modified is NEVER written by
   *     auto-detection (only the manual switcher sets it).
   *
   * Single-flight + StrictMode-safe: concurrent/duplicate callers reuse the
   * same in-flight Promise, and the parallel probe itself is single-flighted
   * via `healthPassPromise`, so every endpoint is probed exactly once per app
   * load even when the StrictMode init effect double-fires.
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
   * parallel pass (runBackgroundHealthPass) refines it and auto-fails-over if
   * this pick turns out to be unreachable. Idempotent and StrictMode-safe: if
   * an endpoint is already selected it is kept (the background pass owns any
   * later change). Returns the chosen endpoint, or null if none are
   * configured.
   */
  preselectEndpointSync(): ApiEndpoint | null {
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

    // Fall back to the highest-priority endpoint (config order). No store
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
    const timeout = options.timeout;
    const endpoints = getAllEndpoints();

    // 1. Single parallel pass over ALL endpoints (single-flighted).
    const results = await this.runInitialHealthCheck(timeout);

    // 2. Healthy set from that one pass.
    const healthyIds = new Set(
      results.filter(r => r.isHealthy).map(r => r.endpoint.id)
    );

    // 3a. Prefer a stored endpoint IF it is healthy. User-modified wins, then
    //     the auto-detected / current store key.
    const userEndpointId = this.getUserModifiedEndpoint();
    const storedEndpointId =
      this.getStoredCurrentEndpoint() ?? this.getAutoDetectedEndpoint();

    if (userEndpointId && healthyIds.has(userEndpointId)) {
      const endpoint = getEndpointById(userEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        return;
      }
    }

    if (storedEndpointId && healthyIds.has(storedEndpointId)) {
      const endpoint = getEndpointById(storedEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        return;
      }
    }

    // 3b. First healthy endpoint in priority order.
    const firstHealthy = endpoints.find(e => healthyIds.has(e.id));
    if (firstHealthy) {
      this.currentEndpoint = firstHealthy;
      // Write back so the next load prefers this now-known-good endpoint.
      // api_user_modified is intentionally NOT touched here — only the manual
      // switcher owns that key. The user's manual choice is dead this session,
      // but we keep it on disk and just use a working endpoint for now.
      this.setAutoDetectedEndpoint(firstHealthy.id);
      return;
    }

    // 3c. Nothing healthy — fall back to the highest-priority endpoint so the
    //     app can still render. Its health stays marked unhealthy; do NOT
    //     write it back as a known-good endpoint.
    this.currentEndpoint = endpoints.length > 0 ? endpoints[0] : null;
  }

  /**
   * The single parallel all-endpoints probe. Runs AT MOST once per app load
   * (single-flight via stored Promise) and never on a timer/interval. Both
   * `initialize()` (for selection) and the switcher (for its health dots)
   * await this exact Promise, so endpoints are probed exactly once. Health
   * checks do NOT retry.
   */
  async runInitialHealthCheck(timeout?: number): Promise<HealthCheckResult[]> {
    if (this.healthPassPromise) {
      return this.healthPassPromise;
    }

    this.healthPassPromise = this.checkAllEndpoints(timeout).catch(error => {
      console.warn('[ApiManager] Initial health check failed:', error);
      // Keep the resolved (empty) promise cached so duplicate callers do not
      // re-probe; checkEndpoint already records per-endpoint failures.
      return [] as HealthCheckResult[];
    });

    return this.healthPassPromise;
  }

  /**
   * Background health refinement (does NOT gate first paint).
   *
   * Runs the single PARALLEL all-endpoints probe exactly once (single-flight
   * via the shared `healthPassPromise`, StrictMode-safe, no timers, no
   * retries), then applies "以能使用的为准" auto-failover relative to the
   * endpoint that was already chosen synchronously by preselectEndpointSync():
   *
   *  - If the synchronously-chosen endpoint is in the healthy set: keep it
   *    (no store change).
   *  - Else pick a healthy endpoint by the SAME precedence used at init:
   *      a. a stored endpoint that is healthy (api_user_modified first, then
   *         api_current_endpoint / api_auto_detected), then
   *      b. the first healthy endpoint in priority order.
   *    Re-point the manager to it and write it back to
   *    api_current_endpoint / api_auto_detected so the next load prefers the
   *    now-known-good endpoint. api_user_modified is NEVER written here — only
   *    the manual switcher owns that key.
   *  - If nothing is healthy: stay on the synchronous pick (kept marked
   *    unhealthy via the recorded health results) so the app stays usable; no
   *    write-back of a dead endpoint.
   *
   * Returns the endpoint that should now be live so the caller (App.tsx) can
   * re-point `api` if it changed and then dispatch `api-health-initialized`.
   * The returned endpoint's id differing from the pre-selected id is the
   * caller's signal that a live re-point is required.
   */
  async runBackgroundHealthPass(timeout?: number): Promise<ApiEndpoint | null> {
    const endpoints = getAllEndpoints();
    const results = await this.runInitialHealthCheck(timeout);

    const healthyIds = new Set(
      results.filter(r => r.isHealthy).map(r => r.endpoint.id)
    );

    // Synchronously-chosen endpoint is healthy — nothing to fail over.
    if (this.currentEndpoint && healthyIds.has(this.currentEndpoint.id)) {
      return this.currentEndpoint;
    }

    // Same precedence as init: a stored endpoint that is healthy wins.
    const userEndpointId = this.getUserModifiedEndpoint();
    const storedEndpointId =
      this.getStoredCurrentEndpoint() ?? this.getAutoDetectedEndpoint();

    if (userEndpointId && healthyIds.has(userEndpointId)) {
      const endpoint = getEndpointById(userEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        return this.currentEndpoint;
      }
    }

    if (storedEndpointId && healthyIds.has(storedEndpointId)) {
      const endpoint = getEndpointById(storedEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        return this.currentEndpoint;
      }
    }

    // First healthy endpoint in priority order — write back so the next load
    // prefers it. api_user_modified is intentionally NOT touched.
    const firstHealthy = endpoints.find(e => healthyIds.has(e.id));
    if (firstHealthy) {
      this.currentEndpoint = firstHealthy;
      this.setAutoDetectedEndpoint(firstHealthy.id);
      return this.currentEndpoint;
    }

    // Nothing healthy — keep the synchronous pick (marked unhealthy via
    // healthResults). Do NOT write back a dead endpoint.
    return this.currentEndpoint;
  }

  /**
   * Check the health status of a single endpoint
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
        headers: {
          'Accept': 'application/json'
        }
      });

      const responseTime = Math.round(performance.now() - startTime);

      const result: HealthCheckResult = {
        endpoint,
        isHealthy: response.ok,
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
  async autoDetectEndpoint(options: { timeout?: number } = {}): Promise<ApiEndpoint | null> {
    await this.initialize({ timeout: options.timeout });
    return this.currentEndpoint;
  }

  /**
   * Manually set the endpoint
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
   * Get the current endpoint
   */
  getCurrentEndpoint(): ApiEndpoint | null {
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
  getAllEndpoints(): ApiEndpoint[] {
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
    return localStorage.getItem(this.STORAGE_KEY_CURRENT);
  }

  private getAutoDetectedEndpoint(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_AUTO);
  }

  private setAutoDetectedEndpoint(endpointId: string): void {
    localStorage.setItem(this.STORAGE_KEY_AUTO, endpointId);
    localStorage.setItem(this.STORAGE_KEY_CURRENT, endpointId);
  }

  private getUserModifiedEndpoint(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_USER);
  }

  private setUserModifiedEndpoint(endpointId: string): void {
    localStorage.setItem(this.STORAGE_KEY_USER, endpointId);
    localStorage.setItem(this.STORAGE_KEY_CURRENT, endpointId);
  }

  /**
   * Clear the user setting (restore auto-detection)
   */
  clearUserModifiedEndpoint(): void {
    localStorage.removeItem(this.STORAGE_KEY_USER);
  }

  /**
   * Reset all settings
   */
  reset(): void {
    localStorage.removeItem(this.STORAGE_KEY_AUTO);
    localStorage.removeItem(this.STORAGE_KEY_USER);
    localStorage.removeItem(this.STORAGE_KEY_CURRENT);
    this.currentEndpoint = null;
    this.healthResults.clear();
  }
}

// Export the singleton
export const apiManager = new ApiManager();
