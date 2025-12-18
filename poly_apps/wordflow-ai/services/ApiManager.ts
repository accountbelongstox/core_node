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

  /**
   * Initialize API Manager
   */
  async initialize(options: ApiManagerOptions = {}): Promise<void> {
    const { autoDetect = true, timeout = 1000 } = options;

    // 1. Check user-configured endpoint
    const userEndpointId = this.getUserModifiedEndpoint();
    if (userEndpointId) {
      const endpoint = getEndpointById(userEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        return;
      }
    }

    // 2. Check auto-detected endpoint
    const autoEndpointId = this.getAutoDetectedEndpoint();
    if (autoEndpointId) {
      const endpoint = getEndpointById(autoEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        // Verify endpoint is still healthy
        if (autoDetect) {
          const health = await this.checkEndpoint(endpoint, { timeout });
          if (!health.isHealthy) {
            // Auto-detected endpoint is unhealthy, re-detect
            await this.autoDetectEndpoint({ timeout });
          }
        }
        return;
      }
    }

    // 3. Auto-detect best endpoint
    if (autoDetect) {
      await this.autoDetectEndpoint({ timeout });
    } else {
      // Use highest priority endpoint
      this.currentEndpoint = getAllEndpoints()[0];
    }
  }

  /**
   * 检查单个端点健康状态
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
        isHealthy: response.status >= 200 && response.status < 500,
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
   * 检查所有端点
   */
  async checkAllEndpoints(timeout?: number): Promise<HealthCheckResult[]> {
    const endpoints = getAllEndpoints();
    const results = await Promise.all(
      endpoints.map(endpoint => this.checkEndpoint(endpoint, { timeout }))
    );
    return results;
  }

  /**
   * Auto-detect first available healthy endpoint (fast mode)
   */
  async autoDetectEndpoint(options: { timeout?: number } = {}): Promise<ApiEndpoint | null> {
    const endpoints = getAllEndpoints();
    let firstHealthyEndpoint: ApiEndpoint | null = null;

    for (const endpoint of endpoints) {
      const result = await this.checkEndpoint(endpoint, options);

      if (result.isHealthy && !firstHealthyEndpoint) {
        firstHealthyEndpoint = endpoint;
        this.currentEndpoint = endpoint;
        this.setAutoDetectedEndpoint(endpoint.id);

        this.checkRemainingEndpointsInBackground(endpoints, endpoint.id, options.timeout);

        return endpoint;
      }
    }

    return null;
  }

  /**
   * Check remaining endpoints in background
   */
  private checkRemainingEndpointsInBackground(
    allEndpoints: ApiEndpoint[],
    selectedId: string,
    timeout?: number
  ): void {
    const remaining = allEndpoints.filter(ep => ep.id !== selectedId);

    Promise.all(
      remaining.map(endpoint => this.checkEndpoint(endpoint, { timeout }))
    ).catch(err => {
      console.warn('[ApiManager] Background health check failed:', err);
    });
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
   * 获取当前端点
   */
  getCurrentEndpoint(): ApiEndpoint | null {
    return this.currentEndpoint;
  }

  /**
   * 获取当前Base URL
   */
  getCurrentBaseUrl(): string {
    if (!this.currentEndpoint) {
      throw new Error('No endpoint selected. Call initialize() first.');
    }
    return buildApiUrl(this.currentEndpoint);
  }

  /**
   * 构建完整URL
   */
  buildUrl(path: string): string {
    if (!this.currentEndpoint) {
      throw new Error('No endpoint selected. Call initialize() first.');
    }
    return buildApiUrl(this.currentEndpoint, path);
  }

  /**
   * 获取所有端点
   */
  getAllEndpoints(): ApiEndpoint[] {
    return getAllEndpoints();
  }

  /**
   * 获取健康检查结果
   */
  getHealthResult(endpointId: string): HealthCheckResult | undefined {
    return this.healthResults.get(endpointId);
  }

  /**
   * 获取所有健康检查结果
   */
  getAllHealthResults(): HealthCheckResult[] {
    return Array.from(this.healthResults.values());
  }

  // StorageCenter management methods

  private getAutoDetectedEndpoint(): string | null {
    return StorageCenter.get<string>(StorageKey.API_AUTO_DETECTED);
  }

  private setAutoDetectedEndpoint(endpointId: string): void {
    StorageCenter.set(StorageKey.API_AUTO_DETECTED, endpointId);
    StorageCenter.set(StorageKey.API_CURRENT_ENDPOINT, endpointId);
  }

  private getUserModifiedEndpoint(): string | null {
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

// 导出单例
export const apiManager = new ApiManager();
