import { API_ENDPOINTS, buildApiUrl, getEndpointById, type ApiEndpoint } from '../config/api-endpoints';

export interface EndpointStatus {
  endpoint: ApiEndpoint;
  isAvailable: boolean;
  responseTime: number;
  lastChecked: number;
}

export class ApiManager {
  private currentEndpoint: ApiEndpoint | null = null;
  private endpointStatuses: Map<string, EndpointStatus> = new Map();
  private storageKey = 'api_settings';

  async initialize(options: { autoDetect?: boolean; timeout?: number } = {}) {
    const { autoDetect = true, timeout = 1000 } = options;

    const settings = await this.loadSettings();

    if (settings.userSelectedEndpointId) {
      const endpoint = getEndpointById(settings.userSelectedEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        console.log('[API Manager] Using user-selected endpoint:', endpoint.id);
        return;
      }
    }

    if (settings.autoDetectedEndpointId) {
      const endpoint = getEndpointById(settings.autoDetectedEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        console.log('[API Manager] Using auto-detected endpoint:', endpoint.id);
      }
    }

    if (autoDetect) {
      await this.autoDetectEndpoint(timeout);
    }

    if (!this.currentEndpoint && API_ENDPOINTS.length > 0) {
      this.currentEndpoint = API_ENDPOINTS[0];
    }
  }

  async checkEndpoint(endpoint: ApiEndpoint, timeout: number = 1000): Promise<EndpointStatus> {
    const startTime = Date.now();
    const testUrl = buildApiUrl(endpoint, '/');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(testUrl, {
        method: 'GET',
        signal: controller.signal,
        mode: 'no-cors',
      });

      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;
      const status: EndpointStatus = {
        endpoint,
        isAvailable: true,
        responseTime,
        lastChecked: Date.now(),
      };

      this.endpointStatuses.set(endpoint.id, status);
      return status;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const status: EndpointStatus = {
        endpoint,
        isAvailable: false,
        responseTime,
        lastChecked: Date.now(),
      };

      this.endpointStatuses.set(endpoint.id, status);
      return status;
    }
  }

  async autoDetectEndpoint(timeout: number = 1000): Promise<ApiEndpoint | null> {
    console.log('[API Manager] Auto-detecting best endpoint...');

    const sortedEndpoints = [...API_ENDPOINTS].sort((a, b) => a.priority - b.priority);

    for (const endpoint of sortedEndpoints) {
      const status = await this.checkEndpoint(endpoint, timeout);

      if (status.isAvailable) {
        console.log(`[API Manager] Found available endpoint: ${endpoint.id} (${status.responseTime}ms)`);
        this.currentEndpoint = endpoint;

        await this.saveSettings({
          autoDetectedEndpointId: endpoint.id,
        });

        return endpoint;
      }
    }

    console.warn('[API Manager] No available endpoints found');
    return null;
  }

  async setEndpoint(endpointId: string): Promise<boolean> {
    const endpoint = getEndpointById(endpointId);

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
      this.currentEndpoint = API_ENDPOINTS[0];
    }

    return buildApiUrl(this.currentEndpoint);
  }

  getCurrentEndpoint(): ApiEndpoint | null {
    return this.currentEndpoint;
  }

  getAllEndpoints(): ApiEndpoint[] {
    return API_ENDPOINTS;
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

    if (this.currentEndpoint?.id === endpointId) {
      this.currentEndpoint = null;
      await this.initialize({ autoDetect: true });
    }

    return true;
  }
}

export const apiManager = new ApiManager();
