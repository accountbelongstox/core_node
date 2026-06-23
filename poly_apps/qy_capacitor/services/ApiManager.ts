/**
 * API Manager - Unified backend API endpoint management
 * Provides auto-detection, health checking, and failover capabilities
 */

import {
  ApiEndpoint,
  GLOBAL_API_ENDPOINTS,
  buildApiUrl,
  getEndpointById,
  getAllEndpoints
} from '../config/api-endpoints';
import { StorageCenter, StorageKey } from './StorageCenter';

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
  private ready = false;
  private readyResolvers: Array<() => void> = [];

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
   * Initialize API Manager.
   *
   * Selection is AVAILABILITY-FIRST: all endpoints are probed once in parallel
   * (a single round, so total wait is ~one timeout instead of N), then the best
   * HEALTHY endpoint is chosen. A stored localStorage choice (user-modified or
   * auto-detected) only ranks higher in weight — it is never blindly pinned, so
   * a dead manual/auto choice still yields a working session endpoint.
   */
  async initialize(options: ApiManagerOptions = {}): Promise<void> {
    const { autoDetect = true, timeout = 3000 } = options;

    try {
      const userId = await this.getUserModifiedEndpoint();
      const autoId = await this.getAutoDetectedEndpoint();

      if (!autoDetect) {
        // No probing requested: honour a stored choice if present, else the
        // highest-priority endpoint.
        const storedId = userId ?? autoId;
        const stored = storedId ? getEndpointById(storedId) : undefined;
        this.currentEndpoint = stored ?? getAllEndpoints()[0];
        return;
      }

      // Probe every endpoint concurrently in a single round.
      const results = await this.checkAllEndpoints(timeout);
      this.selectAvailabilityFirst(results, userId, autoId);
    } finally {
      // Always unblock waiting requests, even if detection found nothing.
      this.markReady();
    }
  }

  /**
   * Pick the best endpoint from a set of probe results, availability-first.
   *
   * PRIMARY sort key = availability (a healthy endpoint always beats an
   * unhealthy one). Tie-break among healthy endpoints, lowest-rank-first:
   * the api_user_modified endpoint, then the api_auto_detected endpoint, then
   * config priority ascending.
   *
   * The chosen endpoint is persisted to api_auto_detected + api_current_endpoint.
   * The api_user_modified key is never written here — only the manual switcher
   * (setEndpoint) owns it, so a dead manual choice survives without re-pinning.
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
        `[ApiManager] Selected endpoint "${best.id}" ` +
        `(${best.description}, priority ${best.priority})`
      );
      return best;
    }

    // Nothing healthy: fall back to the highest-priority endpoint so requests
    // still have a target. Left marked unhealthy; this path should be rare.
    this.currentEndpoint = getAllEndpoints()[0];
    console.warn(
      '[ApiManager] No healthy endpoint found; falling back to highest-priority ' +
      `"${this.currentEndpoint?.id}" (still marked unhealthy)`
    );
    return null;
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

      // Availability must mean "the Laravel backend answered", not merely "some
      // server returned 2xx". A same-origin Vite dev server answers GET
      // /api/health with its SPA index.html (200, text/html) — a false positive
      // that would pin every API call to the dev server (POSTs then 404). So we
      // require: 2xx + JSON content-type + the backend's health marker
      // ({"status":"healthy","service":"Laravel API",...}). An HTML fallback,
      // a proxy error page, or a 4xx/5xx all correctly read as unhealthy.
      const isHealthy = await this.isBackendHealthResponse(response);

      const result: HealthCheckResult = {
        endpoint,
        isHealthy,
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
   * True only when the response is the Laravel backend's /api/health payload.
   *
   * The backend returns 200 with content-type application/json and a body of
   * `{"status":"healthy","service":"Laravel API",...}`. We accept any 2xx JSON
   * body carrying a recognizable marker (`status` or `service`), and reject
   * everything else — most importantly the Vite dev server's SPA index.html
   * (200, text/html), which would otherwise be a false "healthy".
   */
  private async isBackendHealthResponse(response: Response): Promise<boolean> {
    if (response.status < 200 || response.status >= 300) return false;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) return false;

    try {
      const body = await response.clone().json();
      if (!body || typeof body !== 'object') return false;
      // Backend marker: status:"healthy"/"ok" or service:"Laravel API".
      return body.status !== undefined || body.service !== undefined;
    } catch {
      // JSON content-type but unparseable body (proxy/error page) -> not healthy.
      return false;
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
   * Auto-detect the best endpoint: probe ALL endpoints in parallel (one round,
   * ~1 timeout total instead of N sequential timeouts), then pick the best
   * HEALTHY one via the shared availability-first selection.
   */
  async autoDetectEndpoint(options: { timeout?: number } = {}): Promise<ApiEndpoint | null> {
    const userId = await this.getUserModifiedEndpoint();
    const autoId = await this.getAutoDetectedEndpoint();
    const results = await this.checkAllEndpoints(options.timeout);
    return this.selectAvailabilityFirst(results, userId, autoId);
  }

  /**
   * Manually set endpoint
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
   * Get the current base URL
   */
  getCurrentBaseUrl(): string {
    if (!this.currentEndpoint) {
      console.warn('[ApiManager] currentEndpoint is null, using fallback endpoint');
      this.currentEndpoint = getAllEndpoints()[0];
    }
    return buildApiUrl(this.currentEndpoint);
  }

  /**
   * Build a complete URL
   */
  buildUrl(path: string): string {
    if (!this.currentEndpoint) {
      console.warn('[ApiManager] currentEndpoint is null, using fallback endpoint');
      this.currentEndpoint = getAllEndpoints()[0];
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

  // StorageCenter management methods

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

  /**
   * Clear user settings
   */
  clearUserModifiedEndpoint(): void {
    StorageCenter.remove(StorageKey.API_USER_MODIFIED);
  }

  /**
   * Reset all settings
   */
  reset(): void {
    StorageCenter.remove(StorageKey.API_AUTO_DETECTED);
    StorageCenter.remove(StorageKey.API_USER_MODIFIED);
    StorageCenter.remove(StorageKey.API_CURRENT_ENDPOINT);
    this.currentEndpoint = null;
    this.healthResults.clear();
  }
}

// Export the singleton instance
export const apiManager = new ApiManager();
