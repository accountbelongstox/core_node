import { API_ENDPOINTS, buildApiUrl, getEndpointById, type ApiEndpoint } from '../config/api-endpoints';

// Re-export so consumers can import the endpoint type from ApiManager directly.
export type { ApiEndpoint };

export interface EndpointStatus {
  endpoint: ApiEndpoint;
  isAvailable: boolean;
  responseTime: number;
  lastChecked: number;
}

// A probe must fail this many times in a row before an endpoint flips to
// "unavailable". Riding out the first failure absorbs transient network blips
// so a single dropped request can't trigger an endpoint switch / dot flap.
const FAILURE_THRESHOLD = 2;
// Within one probe, retry once after a short delay before counting a failure.
const PROBE_RETRIES = 1;
const PROBE_RETRY_DELAY_MS = 300;
// Rate-limit the "all endpoints down" warning so an outage can't flood the log.
const NO_ENDPOINT_WARN_INTERVAL_MS = 60000;

export class ApiManager {
  private currentEndpoint: ApiEndpoint | null = null;
  private endpointStatuses: Map<string, EndpointStatus> = new Map();
  private failureStreak: Map<string, number> = new Map();
  private customEndpoints: ApiEndpoint[] = [];
  private lastNoEndpointWarn = 0;
  private storageKey = 'api_settings';

  async initialize(options: { autoDetect?: boolean; timeout?: number } = {}) {
    const { autoDetect = true, timeout = 3000 } = options;

    const settings = await this.loadSettings();
    // Load persisted custom endpoints into memory so they participate in
    // listing, selection, and auto-detect (previously they were ignored).
    this.customEndpoints = Array.isArray(settings.customEndpoints)
      ? settings.customEndpoints
      : [];

    if (settings.userSelectedEndpointId) {
      const endpoint = this.resolveEndpoint(settings.userSelectedEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        console.log('[API Manager] Using user-selected endpoint:', endpoint.id);
        return;
      }
    }

    if (settings.autoDetectedEndpointId) {
      const endpoint = this.resolveEndpoint(settings.autoDetectedEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        console.log('[API Manager] Using auto-detected endpoint:', endpoint.id);
      }
    }

    if (autoDetect) {
      await this.autoDetectEndpoint(timeout);
    }

    if (!this.currentEndpoint && this.getAllEndpoints().length > 0) {
      this.currentEndpoint = this.getAllEndpoints()[0];
    }
  }

  /** Resolve an endpoint id against both custom and built-in endpoints. */
  private resolveEndpoint(id: string): ApiEndpoint | undefined {
    return this.customEndpoints.find((e) => e.id === id) || getEndpointById(id);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** One raw reachability probe. Resolves true if the host answered at all. */
  private async probeOnce(endpoint: ApiEndpoint, timeout: number): Promise<boolean> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
      await fetch(buildApiUrl(endpoint, '/'), {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors',
        cache: 'no-store',
      });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async checkEndpoint(
    endpoint: ApiEndpoint,
    timeout: number = 3000,
    retries: number = PROBE_RETRIES,
  ): Promise<EndpointStatus> {
    const startTime = Date.now();

    let reachable = await this.probeOnce(endpoint, timeout);
    for (let attempt = 0; !reachable && attempt < retries; attempt++) {
      await this.delay(PROBE_RETRY_DELAY_MS);
      reachable = await this.probeOnce(endpoint, timeout);
    }

    // Apply hysteresis: a single failure does NOT mark the endpoint down; it
    // takes FAILURE_THRESHOLD consecutive failures. Any success resets it.
    let isAvailable: boolean;
    if (reachable) {
      this.failureStreak.set(endpoint.id, 0);
      isAvailable = true;
    } else {
      const failures = (this.failureStreak.get(endpoint.id) || 0) + 1;
      this.failureStreak.set(endpoint.id, failures);
      isAvailable = failures < FAILURE_THRESHOLD;
    }

    const status: EndpointStatus = {
      endpoint,
      isAvailable,
      responseTime: Date.now() - startTime,
      lastChecked: Date.now(),
    };
    this.endpointStatuses.set(endpoint.id, status);
    return status;
  }

  async autoDetectEndpoint(timeout: number = 3000): Promise<ApiEndpoint | null> {
    // Prefer the current endpoint: if it still answers, keep it. This avoids
    // needlessly switching/sweeping when only a transient blip occurred.
    if (this.currentEndpoint) {
      const status = await this.checkEndpoint(this.currentEndpoint, timeout);
      if (status.isAvailable) {
        return this.currentEndpoint;
      }
    }

    const sortedEndpoints = [...this.getAllEndpoints()].sort((a, b) => a.priority - b.priority);

    for (const endpoint of sortedEndpoints) {
      if (this.currentEndpoint && endpoint.id === this.currentEndpoint.id) continue; // already probed
      const status = await this.checkEndpoint(endpoint, timeout);

      if (status.isAvailable) {
        console.log(`[API Manager] Switched to available endpoint: ${endpoint.id} (${status.responseTime}ms)`);
        this.currentEndpoint = endpoint;

        await this.saveSettings({
          autoDetectedEndpointId: endpoint.id,
        });

        return endpoint;
      }
    }

    // Nothing reachable. KEEP the current endpoint (so we recover automatically
    // when the network returns) and rate-limit the warning to avoid log spam.
    const now = Date.now();
    if (now - this.lastNoEndpointWarn > NO_ENDPOINT_WARN_INTERVAL_MS) {
      console.warn('[API Manager] No endpoints reachable; keeping current and will keep retrying');
      this.lastNoEndpointWarn = now;
    }
    return null;
  }

  async setEndpoint(endpointId: string): Promise<boolean> {
    const endpoint = this.resolveEndpoint(endpointId);

    if (!endpoint) {
      console.error(`[API Manager] Endpoint not found: ${endpointId}`);
      return false;
    }

    this.currentEndpoint = endpoint;

    await this.saveSettings({
      userSelectedEndpointId: endpointId,
    });

    console.log('[API Manager] Endpoint manually set to:', endpointId);
    return true;
  }

  getCurrentBaseUrl(): string {
    if (!this.currentEndpoint) {
      console.warn('[API Manager] No endpoint set, using first available');
      this.currentEndpoint = this.getAllEndpoints()[0];
    }

    return buildApiUrl(this.currentEndpoint);
  }

  getCurrentEndpoint(): ApiEndpoint | null {
    return this.currentEndpoint;
  }

  getAllEndpoints(): ApiEndpoint[] {
    // Built-in endpoints plus any user-added custom ones.
    return [...API_ENDPOINTS, ...this.customEndpoints];
  }

  getEndpointStatus(endpointId: string): EndpointStatus | undefined {
    return this.endpointStatuses.get(endpointId);
  }

  getAllEndpointStatuses(): EndpointStatus[] {
    return Array.from(this.endpointStatuses.values());
  }

  async saveSettings(updates: Partial<{
    userSelectedEndpointId: string;
    autoDetectedEndpointId: string;
    customEndpoints: ApiEndpoint[];
  }>) {
    try {
      const currentSettings = await this.loadSettings();
      const newSettings = { ...currentSettings, ...updates };

      await chrome.storage.local.set({ [this.storageKey]: newSettings });
    } catch (error) {
      console.error('[API Manager] Failed to save settings:', error);
    }
  }

  async loadSettings(): Promise<{
    userSelectedEndpointId?: string;
    autoDetectedEndpointId?: string;
    customEndpoints?: ApiEndpoint[];
  }> {
    try {
      const result = await chrome.storage.local.get(this.storageKey);
      return result[this.storageKey] || {};
    } catch (error) {
      console.error('[API Manager] Failed to load settings:', error);
      return {};
    }
  }

  async addCustomEndpoint(endpoint: Omit<ApiEndpoint, 'id'>): Promise<string> {
    const id = `custom-${Date.now()}`;
    const newEndpoint: ApiEndpoint = { ...endpoint, id };

    const settings = await this.loadSettings();
    const customEndpoints = settings.customEndpoints || [];
    customEndpoints.push(newEndpoint);

    await this.saveSettings({ customEndpoints });
    this.customEndpoints = customEndpoints; // keep in-memory list in sync

    return id;
  }

  async removeCustomEndpoint(endpointId: string): Promise<boolean> {
    const settings = await this.loadSettings();
    const customEndpoints = settings.customEndpoints || [];

    const filtered = customEndpoints.filter(e => e.id !== endpointId);

    if (filtered.length === customEndpoints.length) {
      return false;
    }

    await this.saveSettings({ customEndpoints: filtered });
    this.customEndpoints = filtered; // keep in-memory list in sync

    if (this.currentEndpoint?.id === endpointId) {
      this.currentEndpoint = null;
      await this.initialize({ autoDetect: true });
    }

    return true;
  }
}

export const apiManager = new ApiManager();
