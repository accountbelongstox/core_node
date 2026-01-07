import { ApiEndpoint, API_ENDPOINTS, buildApiUrl, getEndpointById } from '../../config/api-endpoints';

interface InitializeOptions {
  autoDetect?: boolean;
  timeout?: number;
}

class ApiManager {
  private currentEndpoint: ApiEndpoint | null = null;
  private readonly STORAGE_KEY_CURRENT = 'api_current_endpoint';
  private readonly STORAGE_KEY_AUTO = 'api_auto_detected';
  private readonly STORAGE_KEY_USER = 'api_user_modified';

  async initialize(options: InitializeOptions = { autoDetect: true, timeout: 1000 }): Promise<void> {
    // 1. Check user manually selected endpoint (highest priority)
    const userEndpointId = localStorage.getItem(this.STORAGE_KEY_USER);
    if (userEndpointId) {
      const endpoint = getEndpointById(userEndpointId);
      if (endpoint && await this.checkEndpoint(endpoint, options.timeout)) {
        this.currentEndpoint = endpoint;
        localStorage.setItem(this.STORAGE_KEY_CURRENT, endpoint.id);
        return;
      }
    }

    // 2. Check auto-detected result
    const autoEndpointId = localStorage.getItem(this.STORAGE_KEY_AUTO);
    if (autoEndpointId) {
      const endpoint = getEndpointById(autoEndpointId);
      if (endpoint && await this.checkEndpoint(endpoint, options.timeout)) {
        this.currentEndpoint = endpoint;
        localStorage.setItem(this.STORAGE_KEY_CURRENT, endpoint.id);
        return;
      }
    }

    // 3. Execute auto-detection
    if (options.autoDetect) {
      const detected = await this.autoDetectEndpoint(options.timeout);
      if (detected) {
        this.currentEndpoint = detected;
        localStorage.setItem(this.STORAGE_KEY_CURRENT, detected.id);
        localStorage.setItem(this.STORAGE_KEY_AUTO, detected.id);
      }
    }
  }

  async checkEndpoint(endpoint: ApiEndpoint, timeout: number = 1000): Promise<boolean> {
    try {
      const url = buildApiUrl(endpoint);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${url}/health`, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors'
      });

      clearTimeout(timeoutId);
      return response.status >= 200 && response.status < 500;
    } catch (error) {
      return false;
    }
  }

  async autoDetectEndpoint(timeout: number = 1000): Promise<ApiEndpoint | null> {
    const sortedEndpoints = [...API_ENDPOINTS].sort((a, b) => a.priority - b.priority);

    for (const endpoint of sortedEndpoints) {
      if (await this.checkEndpoint(endpoint, timeout)) {
        return endpoint;
      }
    }

    return null;
  }

  setEndpoint(endpointId: string): void {
    const endpoint = getEndpointById(endpointId);
    if (endpoint) {
      this.currentEndpoint = endpoint;
      localStorage.setItem(this.STORAGE_KEY_CURRENT, endpoint.id);
      localStorage.setItem(this.STORAGE_KEY_USER, endpoint.id);
    }
  }

  getCurrentBaseUrl(): string {
    if (!this.currentEndpoint) {
      const storedId = localStorage.getItem(this.STORAGE_KEY_CURRENT);
      if (storedId) {
        const endpoint = getEndpointById(storedId);
        if (endpoint) {
          this.currentEndpoint = endpoint;
        }
      }
    }

    if (!this.currentEndpoint) {
      // Default to first endpoint
      this.currentEndpoint = API_ENDPOINTS[0];
    }

    return buildApiUrl(this.currentEndpoint);
  }

  getCurrentEndpoint(): ApiEndpoint | null {
    return this.currentEndpoint;
  }

  getAllEndpoints(): ApiEndpoint[] {
    return [...API_ENDPOINTS];
  }
}

export const apiManager = new ApiManager();

