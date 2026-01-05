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
      // catch 代码必要性：必须保留
      // 原因：健康检查请求可能失败（网络错误、超时、服务器不可达等）
      // 需要捕获错误并标记端点不可用，避免应用崩溃
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
   * Detection priority: 127.0.0.1 (localhost) → LAN server → Remote server
   * Stops at first available endpoint
   */
  async autoDetectEndpoint(
    timeout: number = 1000,
    testPath: string = '/'
  ): Promise<ApiEndpoint | null> {
    // Ensure endpoints are sorted by priority (1 = highest, 3 = lowest)
    const sortedEndpoints = [...API_ENDPOINTS].sort((a, b) => a.priority - b.priority);
    
    console.log('[ApiManager] Starting endpoint detection in priority order:');
    sortedEndpoints.forEach(ep => {
      console.log(`  Priority ${ep.priority}: ${ep.description} (${buildApiUrl(ep)})`);
    });

    // Test in priority order: 127.0.0.1 → LAN → Remote
    for (const endpoint of sortedEndpoints) {
      console.log(`[ApiManager] Testing endpoint: ${endpoint.description} (${buildApiUrl(endpoint)})`);
      const isAvailable = await this.checkEndpoint(endpoint, timeout, testPath);
      if (isAvailable) {
        console.log(`[ApiManager] ✓ Endpoint available: ${endpoint.description} (${buildApiUrl(endpoint)})`);
        return endpoint;
      } else {
        console.log(`[ApiManager] ✗ Endpoint unavailable: ${endpoint.description} (${buildApiUrl(endpoint)})`);
      }
    }
    
    console.warn('[ApiManager] No available endpoints found after testing all priorities');
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
      return status ?? {
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
   * Automatically switches to higher priority endpoint when available
   * Priority order: 127.0.0.1 → LAN → Remote
   */
  startHealthCheck(interval: number = 60000): void {
    setInterval(async () => {
      // Skip if user manually selected an endpoint (respect user choice)
      const userSelectedId = storageService.get<string>(STORAGE_KEYS.API_USER_SELECTED);
      if (userSelectedId) {
        // Still check if user-selected endpoint is available
        const userEndpoint = getEndpointById(userSelectedId);
        if (userEndpoint) {
          const isAvailable = await this.checkEndpoint(userEndpoint);
          if (!isAvailable) {
            console.warn(`[ApiManager] User-selected endpoint unavailable: ${userEndpoint.description}`);
          }
        }
        return; // Don't auto-switch if user manually selected
      }

      // Check all endpoints in priority order to find best available
      const sortedEndpoints = [...API_ENDPOINTS].sort((a, b) => a.priority - b.priority);
      let bestAvailableEndpoint: ApiEndpoint | null = null;

      // Test endpoints in priority order: 127.0.0.1 → LAN → Remote
      for (const endpoint of sortedEndpoints) {
        const isAvailable = await this.checkEndpoint(endpoint, 1000, '/');
        if (isAvailable) {
          bestAvailableEndpoint = endpoint;
          break; // Found highest priority available endpoint
        }
      }

      if (!bestAvailableEndpoint) {
        // No endpoints available, enable mock mode
        if (!this.useMockMode) {
          console.warn('[ApiManager] No endpoints available, enabling mock mode');
          this.useMockMode = true;
          this.currentEndpoint = null;
        }
        return;
      }

      // Check if we should switch to higher priority endpoint
      const currentPriority = this.currentEndpoint?.priority ?? 999;
      const bestPriority = bestAvailableEndpoint.priority;

      if (bestPriority < currentPriority) {
        // Found higher priority endpoint, switch to it
        console.log(
          `[ApiManager] Switching to higher priority endpoint: ` +
          `${bestAvailableEndpoint.description} (Priority ${bestPriority}) ` +
          `replacing ${this.currentEndpoint?.description} (Priority ${currentPriority})`
        );
        this.currentEndpoint = bestAvailableEndpoint;
        this.useMockMode = false;
        storageService.set(STORAGE_KEYS.API_AUTO_DETECTED, bestAvailableEndpoint.id);
      } else if (this.currentEndpoint?.id !== bestAvailableEndpoint.id) {
        // Current endpoint unavailable but we found a replacement
        console.log(
          `[ApiManager] Current endpoint unavailable, switching to: ${bestAvailableEndpoint.description}`
        );
        this.currentEndpoint = bestAvailableEndpoint;
        this.useMockMode = false;
        storageService.set(STORAGE_KEYS.API_AUTO_DETECTED, bestAvailableEndpoint.id);
      }
      // else: Current endpoint is still the best available, no change needed
    }, interval);
  }
}

// Export singleton
export const apiManager = new ApiManager();

