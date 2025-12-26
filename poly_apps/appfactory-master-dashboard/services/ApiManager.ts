/**
 * API Manager
 * Handles multi-endpoint auto-detection, switching and management
 * 
 * Strategy:
 * - Priority 1: Local development server (localhost:9000) - Used for local debugging
 * - Priority 2: Cloud production server (https://api.si.12gm.com) - Auto-switch when local unavailable
 * 
 * Workflow:
 * 1. Auto-detect local server availability on app startup
 * 2. Use local if available, otherwise auto-switch to cloud
 * 3. Background health check for endpoints, automatic failover
 * 
 * Mock Mode:
 * - When no endpoints are available, system falls back to mock data
 * - Mock mode is automatically enabled when all endpoints fail
 */
import { API_ENDPOINTS, ApiEndpoint, buildApiUrl, getEndpointById } from '../config/api-endpoints';
import { storageService, STORAGE_KEYS } from './storageService';

interface ApiManagerOptions {
  autoDetect?: boolean;
  timeout?: number;
  testPath?: string;
}

interface EndpointStatus {
  endpoint: ApiEndpoint;
  isAvailable: boolean;
  responseTime?: number;
  lastChecked?: number;
}

class ApiManager {
  private currentEndpoint: ApiEndpoint | null = null;
  private endpointStatuses: Map<string, EndpointStatus> = new Map();
  private isInitialized = false;
  private useMockMode = false; // Flag to indicate if mock data should be used

  /**
   * Initialize API Manager
   */
  async initialize(options: ApiManagerOptions = {}): Promise<void> {
    const {
      autoDetect = true,
      timeout = 1000,
      testPath = '/',
    } = options;

    // 1. Check user manually selected endpoint (highest priority)
    const userSelectedId = storageService.get<string>(STORAGE_KEYS.API_USER_SELECTED);
    if (userSelectedId) {
      const endpoint = getEndpointById(userSelectedId);
      if (endpoint) {
        const isAvailable = await this.checkEndpoint(endpoint, timeout, testPath);
        if (isAvailable) {
          this.currentEndpoint = endpoint;
          this.useMockMode = false;
          this.isInitialized = true;
          return;
        }
      }
    }

    // 2. Check auto-detected result
    const autoDetectedId = storageService.get<string>(STORAGE_KEYS.API_AUTO_DETECTED);
    if (autoDetectedId && autoDetectedId !== userSelectedId) {
      const endpoint = getEndpointById(autoDetectedId);
      if (endpoint) {
        const isAvailable = await this.checkEndpoint(endpoint, timeout, testPath);
        if (isAvailable) {
          this.currentEndpoint = endpoint;
          this.useMockMode = false;
          this.isInitialized = true;
          return;
        }
      }
    }

    // 3. Execute auto-detection
    if (autoDetect) {
      const detectedEndpoint = await this.autoDetectEndpoint(timeout, testPath);
      if (detectedEndpoint) {
        this.currentEndpoint = detectedEndpoint;
        this.useMockMode = false;
        storageService.set(STORAGE_KEYS.API_AUTO_DETECTED, detectedEndpoint.id);
        this.isInitialized = true;
        return;
      }
    }

    // 4. If all endpoints are unavailable, enable mock mode
    this.useMockMode = true;
    this.currentEndpoint = null;
    this.isInitialized = true;
    console.warn('API Manager: No available endpoints, falling back to mock data');
  }

  /**
   * Check endpoint connectivity
   */
  async checkEndpoint(
    endpoint: ApiEndpoint,
    timeout: number = 1000,
    testPath: string = '/'
  ): Promise<boolean> {
    const startTime = Date.now();
    const url = `${buildApiUrl(endpoint)}${testPath}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-cache',
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // HTTP 2xx-4xx are considered available (accessible means healthy)
      const isAvailable = response.status >= 200 && response.status < 500;

      // Update status
      this.endpointStatuses.set(endpoint.id, {
        endpoint,
        isAvailable,
        responseTime,
        lastChecked: Date.now(),
      });

      return isAvailable;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.endpointStatuses.set(endpoint.id, {
        endpoint,
        isAvailable: false,
        responseTime,
        lastChecked: Date.now(),
      });
      return false;
    }
  }

  /**
   * Auto-detect best available endpoint
   */
  async autoDetectEndpoint(
    timeout: number = 1000,
    testPath: string = '/'
  ): Promise<ApiEndpoint | null> {
    // Test in priority order
    for (const endpoint of API_ENDPOINTS) {
      const isAvailable = await this.checkEndpoint(endpoint, timeout, testPath);
      if (isAvailable) {
        return endpoint;
      }
    }
    return null;
  }

  /**
   * Manually set endpoint
   */
  setEndpoint(endpointId: string): boolean {
    const endpoint = getEndpointById(endpointId);
    if (!endpoint) {
      return false;
    }

    this.currentEndpoint = endpoint;
    this.useMockMode = false;
    storageService.set(STORAGE_KEYS.API_USER_SELECTED, endpointId);
    return true;
  }

  /**
   * Clear user manually selected endpoint
   */
  clearUserSelection(): void {
    storageService.remove(STORAGE_KEYS.API_USER_SELECTED);
    // Re-initialize, use auto-detection result
    this.initialize({ autoDetect: true });
  }

  /**
   * Get current endpoint base URL
   * Returns empty string if in mock mode
   */
  getCurrentBaseUrl(): string {
    if (this.useMockMode || !this.currentEndpoint) {
      return '';
    }
    return buildApiUrl(this.currentEndpoint);
  }

  /**
   * Get current endpoint information
   */
  getCurrentEndpoint(): ApiEndpoint | null {
    return this.currentEndpoint;
  }

  /**
   * Get all endpoint statuses
   */
  getAllEndpointStatuses(): EndpointStatus[] {
    return API_ENDPOINTS.map(ep => {
      const status = this.endpointStatuses.get(ep.id);
      return status || {
        endpoint: ep,
        isAvailable: false,
      };
    });
  }

  /**
   * Check if manager is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if mock mode is enabled
   */
  isMockMode(): boolean {
    return this.useMockMode;
  }

  /**
   * Enable mock mode manually
   */
  enableMockMode(): void {
    this.useMockMode = true;
    this.currentEndpoint = null;
  }

  /**
   * Disable mock mode and try to detect endpoints again
   */
  async disableMockMode(options: ApiManagerOptions = {}): Promise<void> {
    this.useMockMode = false;
    await this.initialize(options);
  }

  /**
   * Background periodic health check for endpoints
   */
  startHealthCheck(interval: number = 60000): void {
    setInterval(async () => {
      if (this.currentEndpoint) {
        const isAvailable = await this.checkEndpoint(this.currentEndpoint);
        if (!isAvailable) {
          // Current endpoint unavailable, try to auto-detect new endpoint
          const newEndpoint = await this.autoDetectEndpoint();
          if (newEndpoint) {
            this.currentEndpoint = newEndpoint;
            this.useMockMode = false;
            storageService.set(STORAGE_KEYS.API_AUTO_DETECTED, newEndpoint.id);
          } else {
            // No endpoints available, enable mock mode
            this.useMockMode = true;
            this.currentEndpoint = null;
          }
        }
      }
    }, interval);
  }
}

// Export singleton
export const apiManager = new ApiManager();

