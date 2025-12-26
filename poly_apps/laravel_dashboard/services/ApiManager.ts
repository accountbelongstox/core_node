/**
 * API Manager - 统一管理所有API端点
 * 提供自动检测、健康检查、故障转移等功能
 */

import {
  ApiEndpoint,
  GLOBAL_API_ENDPOINTS,
  buildApiUrl,
  getEndpointById,
  getAllEndpoints
} from '../config/api-endpoints';

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
  private readonly STORAGE_KEY_CURRENT = 'api_current_endpoint';
  private readonly STORAGE_KEY_AUTO = 'api_auto_detected';
  private readonly STORAGE_KEY_USER = 'api_user_modified';

  /**
   * 初始化API管理器
   */
  async initialize(options: ApiManagerOptions = {}): Promise<void> {
    const { autoDetect = true, timeout = 1000 } = options;

    // 1. 检查用户手动设置的端点
    const userEndpointId = this.getUserModifiedEndpoint();
    if (userEndpointId) {
      const endpoint = getEndpointById(userEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        return;
      }
    }

    // 2. 检查自动检测的端点
    const autoEndpointId = this.getAutoDetectedEndpoint();
    if (autoEndpointId) {
      const endpoint = getEndpointById(autoEndpointId);
      if (endpoint) {
        this.currentEndpoint = endpoint;
        // 验证端点是否仍然健康
        if (autoDetect) {
          const health = await this.checkEndpoint(endpoint, { timeout });
          if (!health.isHealthy) {
            // 自动检测的端点不健康，重新检测
            await this.autoDetectEndpoint({ timeout });
          }
        }
        return;
      }
    }

    // 3. 自动检测最佳端点
    if (autoDetect) {
      await this.autoDetectEndpoint({ timeout });
    } else {
      // 使用优先级最高的端点
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
        isHealthy: response.ok,
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
   * Checks endpoints by priority order and returns immediately on first success
   * Other endpoints continue checking in background for display purposes
   */
  async autoDetectEndpoint(options: { timeout?: number } = {}): Promise<ApiEndpoint | null> {
    const endpoints = getAllEndpoints();
    let firstHealthyEndpoint: ApiEndpoint | null = null;

    // Check endpoints by priority order
    for (const endpoint of endpoints) {
      const result = await this.checkEndpoint(endpoint, options);

      if (result.isHealthy && !firstHealthyEndpoint) {
        // Found first healthy endpoint - use it immediately
        firstHealthyEndpoint = endpoint;
        this.currentEndpoint = endpoint;
        this.setAutoDetectedEndpoint(endpoint.id);

        // Continue checking other endpoints in background for status display
        this.checkRemainingEndpointsInBackground(endpoints, endpoint.id, options.timeout);

        return endpoint;
      }
    }

    return null;
  }

  /**
   * Check remaining endpoints in background (non-blocking)
   */
  private checkRemainingEndpointsInBackground(
    allEndpoints: ApiEndpoint[],
    selectedId: string,
    timeout?: number
  ): void {
    const remaining = allEndpoints.filter(ep => ep.id !== selectedId);

    // Run in background without blocking
    Promise.all(
      remaining.map(endpoint => this.checkEndpoint(endpoint, { timeout }))
    ).catch(err => {
      console.warn('[ApiManager] Background health check failed:', err);
    });
  }

  /**
   * 手动设置端点
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

  // LocalStorage 管理方法

  private getAutoDetectedEndpoint(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_AUTO);
  }

  private setAutoDetectedEndpoint(endpointId: string): void {
    localStorage.setItem(this.STORAGE_KEY_AUTO, endpointId);
    localStorage.setItem(this.STORAGE_KEY_CURRENT, endpointId);
  }

  private getUserModifiedEndpoint(): string | null {
    return localStorage.getItem(this.STORAGE_KEY_USER);
  }

  private setUserModifiedEndpoint(endpointId: string): void {
    localStorage.setItem(this.STORAGE_KEY_USER, endpointId);
    localStorage.setItem(this.STORAGE_KEY_CURRENT, endpointId);
  }

  /**
   * 清除用户设置（恢复自动检测）
   */
  clearUserModifiedEndpoint(): void {
    localStorage.removeItem(this.STORAGE_KEY_USER);
  }

  /**
   * 重置所有设置
   */
  reset(): void {
    localStorage.removeItem(this.STORAGE_KEY_AUTO);
    localStorage.removeItem(this.STORAGE_KEY_USER);
    localStorage.removeItem(this.STORAGE_KEY_CURRENT);
    this.currentEndpoint = null;
    this.healthResults.clear();
  }
}

// 导出单例
export const apiManager = new ApiManager();
