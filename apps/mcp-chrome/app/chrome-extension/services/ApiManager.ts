import {
  API_ENDPOINTS,
  DEFAULT_API_ENDPOINT_ID,
  buildApiUrl,
  getEndpointById,
  type ApiEndpoint,
} from '../config/api-endpoints';
import { STORAGE_KEYS } from '@/utils/storage-keys';
import { delay, fetchWithTimeout } from '@/utils/async';
import { API_HEALTH_PATHS } from '@/utils/api-paths';
import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import type { BaseApiClient } from '@/entrypoints/background/api/BaseApiClient';

// Re-export so consumers can import the endpoint type from ApiManager directly.
export type { ApiEndpoint };

export interface EndpointStatus {
  endpoint: ApiEndpoint;
  isAvailable: boolean;
  responseTime: number;
  lastChecked: number;
}

interface ApiSettings {
  userSelectedEndpointId?: string;
  autoDetectedEndpointId?: string;
  customEndpoints?: ApiEndpoint[];
  autoMode?: boolean;
  /** Id of the write that produced this revision, so a context recognises its own echoes. */
  writeId?: string;
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

function getDefaultApiEndpoint(): ApiEndpoint | null {
  return getEndpointById(DEFAULT_API_ENDPOINT_ID) || API_ENDPOINTS[0] || null;
}

export class ApiManager {
  private currentEndpoint: ApiEndpoint | null = getDefaultApiEndpoint();
  private endpointStatuses: Map<string, EndpointStatus> = new Map();
  private failureStreak: Map<string, number> = new Map();
  private customEndpoints: ApiEndpoint[] = [];
  private lastNoEndpointWarn = 0;
  // Auto mode: always ride the highest-weight (lowest `priority`) endpoint that
  // is reachable, upgrading back automatically as better endpoints recover.
  private autoMode = false;
  private readonly storageKey = STORAGE_KEYS.API_SETTINGS;
  private readonly pendingWrites = new Set<string>();
  private followingStorage = false;
  private endpointChangeListeners = new Set<() => void>();

  /** Subscribe to endpoint changes made in this context or in any other context. */
  onEndpointChange(listener: () => void): () => void {
    this.endpointChangeListeners.add(listener);
    return () => this.endpointChangeListeners.delete(listener);
  }

  private notifyEndpointChange(): void {
    for (const listener of this.endpointChangeListeners) {
      try {
        listener();
      } catch {
        // ignore listener errors
      }
    }
  }

  async initialize(options: { autoDetect?: boolean; timeout?: number } = {}) {
    const { autoDetect = true, timeout = 3000 } = options;

    this.followStorageChanges();
    const settings = await this.loadSettings();
    const isFirstRun = !settings.userSelectedEndpointId
      && !settings.autoDetectedEndpointId
      && settings.autoMode !== true;

    if (this.applySettings(settings)) {
      this.notifyEndpointChange();
    }

    if (isFirstRun) {
      await this.saveSettings({
        userSelectedEndpointId: DEFAULT_API_ENDPOINT_ID,
        autoMode: false,
      });
      console.log(`[API Manager] First-run default endpoint: ${DEFAULT_API_ENDPOINT_ID}`);
      return;
    }

    // A resolvable manual selection wins while auto mode is off; never probe it away.
    if (this.hasManualSelection(settings)) {
      return;
    }

    if (autoDetect) {
      await this.autoDetectEndpoint(timeout);
    }
  }

  /**
   * Apply persisted settings to memory without writing or probing. Returns true
   * when the effective selection (base URL, mode or custom list) changed.
   */
  private applySettings(settings: ApiSettings): boolean {
    const before = this.selectionSignature();
    this.customEndpoints = Array.isArray(settings.customEndpoints) ? settings.customEndpoints : [];
    this.autoMode = settings.autoMode === true;

    // A manual selection only wins while auto mode is OFF. In auto mode the last
    // auto-detected endpoint is a provisional start until the caller re-picks.
    const selectedEndpoint = this.hasManualSelection(settings)
      ? this.resolveEndpoint(settings.userSelectedEndpointId as string)
      : undefined;
    const detectedEndpoint = settings.autoDetectedEndpointId
      ? this.resolveEndpoint(settings.autoDetectedEndpointId)
      : undefined;
    this.currentEndpoint = selectedEndpoint || detectedEndpoint || getDefaultApiEndpoint();

    return before !== this.selectionSignature();
  }

  private hasManualSelection(settings: ApiSettings): boolean {
    return settings.autoMode !== true
      && !!settings.userSelectedEndpointId
      && !!this.resolveEndpoint(settings.userSelectedEndpointId);
  }

  private selectionSignature(): string {
    return JSON.stringify([
      this.autoMode,
      this.currentEndpoint ? buildApiUrl(this.currentEndpoint) : '',
      this.customEndpoints.map((endpoint) => endpoint.id),
    ]);
  }

  /**
   * Follow `api_settings` writes from every extension context (popup, options,
   * background) so this context's endpoint never goes stale. Echoes of this
   * context's own intermediate writes are skipped; the last one is re-applied
   * (a no-op unless a concurrent initialize() read stale storage).
   */
  private followStorageChanges(): boolean {
    if (this.followingStorage) return true;
    if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) return false;
    this.followingStorage = true;
    chrome.storage.onChanged.addListener((changes, areaName) => {
      const change = areaName === 'local' ? changes[this.storageKey] : undefined;
      if (!change) return;
      const settings = (change.newValue || {}) as ApiSettings;
      const ownEcho = !!settings.writeId && this.pendingWrites.delete(settings.writeId);
      if (ownEcho && this.pendingWrites.size > 0) return;
      if (this.applySettings(settings)) {
        this.notifyEndpointChange();
      }
    });
    return true;
  }

  /** Resolve an endpoint id against both custom and built-in endpoints. */
  private resolveEndpoint(id: string): ApiEndpoint | undefined {
    return this.customEndpoints.find((e) => e.id === id) || getEndpointById(id);
  }

  /**
   * One reachability/health probe. Prefers a REAL check routed through the
   * background service worker (which bypasses CORS via host_permissions and can
   * actually read `/api/health`), so the result reflects whether the API truly
   * works — not just that the host answered an opaque response.
   *
   * Falls back to a direct `no-cors` reachability probe against `/up` when the
   * background isn't reachable (e.g. running outside a popup context).
   */
  private async probeOnce(endpoint: ApiEndpoint, timeout: number): Promise<boolean> {
    const base = buildApiUrl(endpoint); // protocol://host[:port]/

    // Preferred: ask the background SW for a genuine, CORS-free health check.
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        const resp: any = await chrome.runtime.sendMessage({
          type: BACKGROUND_MESSAGE_TYPES.API_HEALTH_CHECK,
          url: base,
          timeoutMs: timeout,
        });
        if (resp && typeof resp.healthy === 'boolean') {
          // Healthy (real 2xx from /api/health) is the accurate "API works" signal.
          return resp.healthy;
        }
      }
    } catch {
      // Background unavailable — fall through to the direct probe.
    }

    // Fallback: direct no-cors reachability probe (opaque; can't read the body).
    try {
      await fetchWithTimeout(buildApiUrl(endpoint, API_HEALTH_PATHS.UP), timeout, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
      });
      return true;
    } catch {
      return false;
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
      await delay(PROBE_RETRY_DELAY_MS);
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

        this.notifyEndpointChange();
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

  /**
   * Probe endpoints in weight order and switch to the highest-weight (lowest
   * `priority` number) one that answers — even if the current endpoint is still
   * up. This is the "Auto" behaviour: always ride the best available server,
   * upgrading back as higher-weight endpoints recover. Unlike
   * `autoDetectEndpoint`, it does NOT short-circuit on the current endpoint, so
   * it can climb back to a preferred server once it returns.
   */
  async selectBestAvailable(timeout: number = 3000): Promise<ApiEndpoint | null> {
    const sorted = [...this.getAllEndpoints()].sort((a, b) => a.priority - b.priority);

    for (const endpoint of sorted) {
      const status = await this.checkEndpoint(endpoint, timeout);
      if (status.isAvailable) {
        if (this.currentEndpoint?.id !== endpoint.id) {
          this.currentEndpoint = endpoint;
          await this.saveSettings({ autoDetectedEndpointId: endpoint.id });
          console.log(
            `[API Manager] Auto-selected best endpoint: ${endpoint.id} (${status.responseTime}ms)`,
          );
          this.notifyEndpointChange();
        }
        return endpoint;
      }
    }

    // Nothing reachable — keep the current endpoint so we recover when the
    // network returns, and rate-limit the warning to avoid log spam.
    const now = Date.now();
    if (now - this.lastNoEndpointWarn > NO_ENDPOINT_WARN_INTERVAL_MS) {
      console.warn('[API Manager] No endpoints reachable; keeping current and will keep retrying');
      this.lastNoEndpointWarn = now;
    }
    return null;
  }

  isAutoMode(): boolean {
    return this.autoMode;
  }

  /** Toggle auto mode and persist it. Selecting a specific endpoint turns it off. */
  async setAutoMode(enabled: boolean): Promise<void> {
    this.autoMode = enabled;
    await this.saveSettings({ autoMode: enabled });
    console.log('[API Manager] Auto mode:', enabled ? 'on' : 'off');
    this.notifyEndpointChange();
  }

  async setEndpoint(endpointId: string): Promise<boolean> {
    const endpoint = this.resolveEndpoint(endpointId);

    if (!endpoint) {
      console.error(`[API Manager] Endpoint not found: ${endpointId}`);
      return false;
    }

    this.currentEndpoint = endpoint;
    this.autoMode = false; // an explicit pick wins over auto mode

    await this.saveSettings({
      userSelectedEndpointId: endpointId,
      autoMode: false,
    });

    console.log('[API Manager] Endpoint manually set to:', endpointId);
    this.notifyEndpointChange();
    return true;
  }

  getCurrentBaseUrl(): string {
    const endpoint = this.currentEndpoint || getDefaultApiEndpoint();
    if (!endpoint) throw new Error('No API endpoints configured');

    this.currentEndpoint = endpoint;
    return buildApiUrl(endpoint);
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

  async saveSettings(updates: Omit<ApiSettings, 'writeId'>) {
    const writeId = crypto.randomUUID();
    try {
      const currentSettings = await this.loadSettings();
      const newSettings: ApiSettings = { ...currentSettings, ...updates, writeId };

      if (this.followStorageChanges()) this.pendingWrites.add(writeId);
      await chrome.storage.local.set({ [this.storageKey]: newSettings });
    } catch (error) {
      this.pendingWrites.delete(writeId);
      console.error('[API Manager] Failed to save settings:', error);
    }
  }

  async loadSettings(): Promise<ApiSettings> {
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
    this.notifyEndpointChange();

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

    this.notifyEndpointChange();

    return true;
  }
}

export const apiManager = new ApiManager();

let apiManagerReady: Promise<void> | null = null;

/**
 * Load `api_settings` into this context once and start following later
 * changes. Every async caller (background workers, tools, listeners) awaits
 * this instead of re-running initialize().
 */
export function ensureApiManagerReady(): Promise<void> {
  if (!apiManagerReady) {
    apiManagerReady = apiManager.initialize({ autoDetect: false }).catch((error) => {
      apiManagerReady = null;
      throw error;
    });
  }
  return apiManagerReady;
}

/**
 * The single API base resolver: current endpoint with trailing slashes
 * stripped, so callers append `/api/...` without double-slashing.
 */
export function getApiBase(): string {
  return apiManager.getCurrentBaseUrl().replace(/\/+$/, '');
}

/** getApiBase() after the persisted selection has been loaded in this context. */
export async function resolveApiBase(): Promise<string> {
  await ensureApiManagerReady();
  return getApiBase();
}

const boundApiClients = new Map<Function, BaseApiClient>();

/** One cached client per class, rebuilt whenever the current API base changes. */
export function currentApiClient<T extends BaseApiClient>(
  ClientClass: new (baseUrl: string) => T,
): T {
  const baseUrl = getApiBase();
  const cached = boundApiClients.get(ClientClass) as T | undefined;
  if (cached && cached.getBaseUrl() === baseUrl) return cached;
  const client = new ClientClass(baseUrl);
  boundApiClients.set(ClientClass, client);
  return client;
}
