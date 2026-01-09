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
import { i18nService } from './i18nService';

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
   * Priority: User selected > Auto-detected > Auto-detect all endpoints
   * If any endpoint is unavailable, immediately skip to next
   */
  async initialize(options: ApiManagerOptions = {}): Promise<void> {
    const {
      autoDetect = true,
      timeout = 2000,
      testPath = '/',
    } = options;

    // 1. Check user manually selected endpoint (highest priority)
    // If unavailable, skip immediately to auto-detection
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
        } else {
          // User-selected endpoint unavailable, skip to auto-detection
          console.log(`[ApiManager] User-selected endpoint unavailable, skipping to auto-detection`);
        }
      }
    }

    // 2. Execute auto-detection (tests all endpoints in priority order)
    // This will find the first available endpoint, skipping unavailable ones
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

    // 3. If all endpoints are unavailable, enable mock mode
    this.useMockMode = true;
    this.currentEndpoint = null;
    this.isInitialized = true;
    console.log(i18nService.t('apiEndpoint.noAvailable'));
  }

  /**
   * Check endpoint connectivity
   * Tests endpoint availability through actual network request
   * Returns true if endpoint is available, false otherwise
   * All endpoints are tested regardless of environment - test results determine availability
   */
  async checkEndpoint(
    endpoint: ApiEndpoint,
    timeout: number = 2000,
    testPath: string = '/'
  ): Promise<boolean> {
    const startTime = Date.now();
    const url = `${buildApiUrl(endpoint)}${testPath}`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Use 'cors' mode to properly detect availability
      // This will catch CORS errors (e.g., accessing private IP from public IP) and mark endpoint as unavailable
      const fetchOptions: RequestInit = {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-cache',
        mode: 'cors', // Always use cors to detect CORS errors and availability
      };

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      // Check if response is ok (status 200-299)
      const isAvailable = response.ok;

      // Update status
      this.endpointStatuses.set(endpoint.id, {
        endpoint,
        isAvailable,
        responseTime,
        lastChecked: Date.now(),
      });

      return isAvailable;
    } catch (error) {
      // Error handling is necessary and must be kept
      // Reason: Health check requests may fail (network errors, timeouts, CORS errors, server unreachable, etc.)
      // Need to catch errors and mark endpoint as unavailable to prevent application crash
      // If it's a CORS error (e.g., accessing private IP from public IP), it will also be caught and marked as unavailable
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
   * Tests endpoints in priority order (1 = highest priority)
   * Immediately skips unavailable endpoints and continues to next
   * Returns first available endpoint, or null if all unavailable
   * 
   * Priority only determines test order - all endpoints are tested through actual network requests
   * If an endpoint fails (network error, CORS error, timeout, etc.), it's marked unavailable and we continue to next
   */
  async autoDetectEndpoint(
    timeout: number = 2000,
    testPath: string = '/'
  ): Promise<ApiEndpoint | null> {
    // Ensure endpoints are sorted by priority (1 = highest, 3 = lowest)
    const sortedEndpoints = [...API_ENDPOINTS].sort((a, b) => a.priority - b.priority);
    
    console.log(`[ApiManager] Starting endpoint detection in priority order:`);
    sortedEndpoints.forEach(ep => {
      console.log(`  Priority ${ep.priority}: ${ep.description} (${buildApiUrl(ep)})`);
    });

    // Test endpoints in priority order, immediately skip unavailable ones
    // Priority only determines test order, not retry behavior
    // All endpoints are tested through actual network requests
    for (const endpoint of sortedEndpoints) {
      console.log(`[ApiManager] Testing endpoint: ${endpoint.description} (${buildApiUrl(endpoint)})`);
      const isAvailable = await this.checkEndpoint(endpoint, timeout, testPath);
      
      if (isAvailable) {
        // Found first available endpoint, return immediately
        console.log(`[ApiManager] ✓ Endpoint available: ${endpoint.description} (${buildApiUrl(endpoint)})`);
        return endpoint;
      } else {
        // Endpoint unavailable (network error, CORS error, timeout, etc.), immediately skip to next (no retry)
        console.log(`[ApiManager] ✗ Endpoint unavailable, skipping to next: ${endpoint.description} (${buildApiUrl(endpoint)})`);
        // Continue to next endpoint in priority order
      }
    }
    
    // All endpoints tested and unavailable
    console.log(`[ApiManager] ✗ All endpoints unavailable after testing in priority order`);
    console.log(i18nService.t('apiEndpoint.noAvailable'));
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
   * Tests endpoints in priority order, immediately skips unavailable ones
   * Automatically switches to highest priority available endpoint
   * Priority only determines test order, not retry behavior
   */
  startHealthCheck(interval: number = 60000): void {
    setInterval(async () => {
      // Skip if user manually selected an endpoint (respect user choice)
      const userSelectedId = storageService.get<string>(STORAGE_KEYS.API_USER_SELECTED);
      if (userSelectedId) {
        // Still check if user-selected endpoint is available
        const userEndpoint = getEndpointById(userSelectedId);
        if (userEndpoint) {
          const isAvailable = await this.checkEndpoint(userEndpoint, 2000, '/');
          if (!isAvailable) {
            console.warn(`[ApiManager] User-selected endpoint unavailable: ${userEndpoint.description}`);
            // Don't auto-switch if user manually selected, but log warning
          }
        }
        return; // Don't auto-switch if user manually selected
      }

      // Test all endpoints in priority order to find best available
      // Immediately skip unavailable endpoints, no retry
      const sortedEndpoints = [...API_ENDPOINTS].sort((a, b) => a.priority - b.priority);
      let bestAvailableEndpoint: ApiEndpoint | null = null;

      // Test endpoints in priority order, skip unavailable ones immediately
      for (const endpoint of sortedEndpoints) {
        const isAvailable = await this.checkEndpoint(endpoint, 2000, '/');
        if (isAvailable) {
          // Found first available endpoint (highest priority)
          bestAvailableEndpoint = endpoint;
          break; // Stop testing, use this endpoint
        }
        // If unavailable, continue to next endpoint (no retry)
      }

      if (!bestAvailableEndpoint) {
        // All endpoints tested and unavailable, enable mock mode
        if (!this.useMockMode) {
          console.log(`[ApiManager] All endpoints unavailable, enabling mock mode`);
          console.log(i18nService.t('apiEndpoint.noAvailable'));
          this.useMockMode = true;
          this.currentEndpoint = null;
        }
        return;
      }

      // Check if we should switch to the best available endpoint
      const currentEndpointId = this.currentEndpoint?.id;
      const bestEndpointId = bestAvailableEndpoint.id;

      if (currentEndpointId !== bestEndpointId) {
        // Switch to best available endpoint
        const currentPriority = this.currentEndpoint?.priority ?? 999;
        const bestPriority = bestAvailableEndpoint.priority;

        if (bestPriority < currentPriority) {
          // Found higher priority endpoint
          console.log(
            `[ApiManager] Switching to higher priority endpoint: ` +
            `${bestAvailableEndpoint.description} (Priority ${bestPriority}) ` +
            `replacing ${this.currentEndpoint?.description} (Priority ${currentPriority})`
          );
        } else {
          // Current endpoint unavailable, switching to available replacement
          console.log(
            `[ApiManager] Current endpoint unavailable, switching to: ${bestAvailableEndpoint.description} (Priority ${bestPriority})`
          );
        }

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

