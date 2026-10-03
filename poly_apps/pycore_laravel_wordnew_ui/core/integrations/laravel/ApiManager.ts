/**
 * API Manager - the Laravel endpoints (root-domain APIs, tailnet machines,
 * user entries), their detection, the persisted selection and the link to it.
 * Detection never switches a selection: a selected endpoint that goes down is
 * reconnected to (ServiceLink); only the user changes it.
 */

import {
  BackendApiEndpoint,
  GLOBAL_API_ENDPOINTS,
  buildApiUrl,
  getEndpointById,
  getAllEndpoints,
  getPagePreferredEndpoint,
  isEndpointMixedContentBlocked,
  MIXED_CONTENT_BLOCKED_ERROR,
} from '@/core/integrations/laravel/LaravelEndpoints';
import { ServiceLink } from '../../network/ServiceLink';
import { refreshTailnetPeers } from '../../network/TailnetDiscovery';
import { clampRecheckInterval } from '../../health/OfflineRecheckScheduler';
import { loadWebAccessConfig } from '../../contracts/DomainConfig';
import { persistSharedBaseURL, setSharedBaseURL, setSharedServiceLink } from './transport/BaseAPI';
import { StorageManager } from '../../persistence';
import { registerAuthServerId } from '../../auth/AuthSession';
import { LaravelStorageKeys as StorageKeys } from './LaravelStorageKeys';
import { EndpointProbeAPI } from './transport/EndpointProbeAPI';
import { serverSchemaGate } from './ServerSchemaGate';
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
  timeout?: number;
}

class ApiManager {
  private endpointProbe = new EndpointProbeAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.root));
  private currentEndpoint: BackendApiEndpoint | null = null;
  private healthResults: Map<string, HealthCheckResult> = new Map();
  private initPromise: Promise<void> | null = null;
  /** Single-flight detection pass (startup, reconnect without a selection, manual detect). */
  private detectPromise: Promise<boolean> | null = null;

  /**
   * The connection to the selected endpoint. It never switches: requests wait
   * on it while it reconnects and continue once the endpoint answers again.
   * Without a persisted selection yet, its probe is a detection pass, so the
   * first endpoint that answers becomes the selection.
   */
  readonly link = new ServiceLink({
    probe: async () => {
      if (!this.persistedEndpoint()) return this.detectEndpoints();
      const endpoint = this.currentEndpoint;
      return endpoint ? (await this.checkEndpoint(endpoint)).isHealthy : false;
    },
  });

  constructor() {
    serverSchemaGate.setHealthProbe(async () => {
      if (this.currentEndpoint) await this.checkEndpoint(this.currentEndpoint);
    });
  }

  /** Select in memory and re-point every centralized Laravel transport. */
  private activateEndpoint(endpoint: BackendApiEndpoint): BackendApiEndpoint {
    const previous = this.currentEndpoint;
    this.currentEndpoint = endpoint;
    setSharedBaseURL(buildApiUrl(endpoint));
    if (previous && previous.id !== endpoint.id) this.link.retarget();
    return endpoint;
  }

  /** The persisted selection (manual choice first), resolved; legacy ids are rewritten. */
  private persistedEndpoint(): BackendApiEndpoint | null {
    const storedId =
      this.getUserModifiedEndpoint() ??
      this.getStoredCurrentEndpoint() ??
      this.getAutoDetectedEndpoint();
    if (!storedId) return null;
    const endpoint = getEndpointById(storedId);
    if (!endpoint) return null;
    this.migrateResolvedEndpointId(storedId, endpoint.id);
    return endpoint;
  }

  /** Endpoints in first-run order: this page's own API first, then by priority. */
  private firstRunOrder(): BackendApiEndpoint[] {
    const preferred = getPagePreferredEndpoint();
    const endpoints = getAllEndpoints();
    return preferred ? [preferred, ...endpoints.filter((endpoint) => endpoint.id !== preferred.id)] : endpoints;
  }

  /**
   * Synchronous selection - NO network: the persisted selection, else the
   * first-run guess (this page's own API, else the first by priority; not
   * persisted). Idempotent and StrictMode-safe.
   */
  preselectEndpointSync(): BackendApiEndpoint | null {
    if (this.currentEndpoint) return this.currentEndpoint;
    const persisted = this.persistedEndpoint();
    if (persisted) {
      this.setStoredCurrentEndpoint(persisted.id);
      return this.activateEndpoint(persisted);
    }
    const guess = this.firstRunOrder().find((endpoint) => !isEndpointMixedContentBlocked(endpoint));
    return guess ? this.activateEndpoint(guess) : null;
  }

  /** First detection pass (single-flight, StrictMode-safe). */
  initialize(options: ApiManagerOptions = {}): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.detectEndpoints(options.timeout).then(() => undefined);
    }
    return this.initPromise;
  }

  /** Background detection (does not gate first paint); the endpoint now in use. */
  async runBackgroundHealthPass(timeout?: number): Promise<BackendApiEndpoint | null> {
    await this.detectEndpoints(timeout);
    return this.currentEndpoint;
  }

  /** Re-detect every endpoint; true when the selected one answers. */
  recheckEndpoints(timeout?: number): Promise<boolean> {
    return this.detectEndpoints(timeout);
  }

  /**
   * The ONE detection routine: probes every endpoint (availability badges)
   * and never changes a persisted selection. Only without one (first run) is
   * the first answering endpoint - this page's own API first - selected and
   * persisted. A selected endpoint that does not answer turns the link
   * `reconnecting`. Dispatches API_HEALTH_EVENT after every pass.
   */
  detectEndpoints(timeout?: number): Promise<boolean> {
    if (this.detectPromise) return this.detectPromise;
    this.detectPromise = (async () => {
      try {
        // The shell-written domain config and the tailnet list shape the endpoint list.
        await Promise.all([loadWebAccessConfig(), refreshTailnetPeers()]);
        const results = await this.checkAllEndpoints(timeout);
        const healthy = new Set(results.filter((result) => result.isHealthy).map((result) => result.endpoint.id));
        const persisted = this.persistedEndpoint();
        if (persisted) {
          this.activateEndpoint(persisted);
        } else {
          const chosen = this.firstRunOrder().find((endpoint) => healthy.has(endpoint.id));
          if (chosen) {
            this.activateEndpoint(chosen);
            this.setAutoDetectedEndpoint(chosen.id);
          } else {
            this.preselectEndpointSync();
          }
        }
        const up = this.currentEndpoint !== null && healthy.has(this.currentEndpoint.id);
        if (up) this.link.markOnline();
        else this.link.markDown();
        return up;
      } finally {
        this.detectPromise = null;
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(API_HEALTH_EVENT));
        }
      }
    })();
    return this.detectPromise;
  }

  /** True when the selected endpoint answered its last probe. */
  hasHealthyEndpoint(): boolean {
    const endpoint = this.currentEndpoint;
    return endpoint !== null && this.healthResults.get(endpoint.id)?.isHealthy === true;
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
    // A slow public backend keeps its own longer budget; a fast tailnet/local one keeps the short default.
    const timeout = endpoint.probeTimeoutMs ?? options.timeout ?? GLOBAL_API_ENDPOINTS.timeout;
    const startTime = performance.now();
    const baseURL = buildApiUrl(endpoint);

    // HTTPS pages can never reach plain-HTTP endpoints (browser mixed-content
    // policy). Record the definitive block WITHOUT issuing a request — a real
    // fetch would only produce a console Mixed Content error and a misleading
    // "Network unreachable" result.
    if (isEndpointMixedContentBlocked(endpoint)) {
      const blocked: HealthCheckResult = {
        endpoint,
        isHealthy: false,
        responseTime: 0,
        error: MIXED_CONTENT_BLOCKED_ERROR,
        timestamp: Date.now()
      };
      this.healthResults.set(endpoint.id, blocked);
      return blocked;
    }

    let result: HealthCheckResult;

    try {
      const response = await this.endpointProbe.probeHealth(baseURL, timeout);
      const responseTime = Math.round(performance.now() - startTime);
      const payload = response.data ?? (response.debugInfo as typeof response.data);
      const schema = serverSchemaGate.readHealth(payload);
      const healthy = (response.success || schema === 'pending') && !!payload
        && (payload.status !== undefined || payload.service !== undefined || schema !== 'unknown');
      if (endpoint.id === this.currentEndpoint?.id) serverSchemaGate.observeHealth(payload);
      // Endpoints answering with one server id are one server and share one login session.
      if (healthy && typeof payload?.server_id === 'string') registerAuthServerId(baseURL, payload.server_id);
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
    if (result.isHealthy && endpoint.id === this.currentEndpoint?.id) this.link.markOnline();
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

    this.setUserModifiedEndpoint(endpoint.id);
    this.activateEndpoint(endpoint);
    this.link.markOnline();
    await persistSharedBaseURL(buildApiUrl(endpoint));
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
setSharedServiceLink(apiManager.link);
// Restore localStorage during module evaluation, before child effects can issue
// Laravel requests. Refresh and HMR therefore start on the persisted endpoint.
apiManager.preselectEndpointSync();
