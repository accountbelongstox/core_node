/**
 * API管理器
 * 负责多端点自动探测、切换和管理
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

  /**
   * 初始化API管理器
   */
  async initialize(options: ApiManagerOptions = {}): Promise<void> {
    const {
      autoDetect = true,
      timeout = 1000,
      testPath = '/',
    } = options;

    // 1. 检查用户手动选择的端点（优先级最高）
    const userSelectedId = storageService.get<string>(STORAGE_KEYS.API_USER_SELECTED);
    if (userSelectedId) {
      const endpoint = getEndpointById(userSelectedId);
      if (endpoint) {
        const isAvailable = await this.checkEndpoint(endpoint, timeout, testPath);
        if (isAvailable) {
          this.currentEndpoint = endpoint;
          this.isInitialized = true;
          return;
        }
      }
    }

    // 2. 检查自动检测的结果
    const autoDetectedId = storageService.get<string>(STORAGE_KEYS.API_AUTO_DETECTED);
    if (autoDetectedId && autoDetectedId !== userSelectedId) {
      const endpoint = getEndpointById(autoDetectedId);
      if (endpoint) {
        const isAvailable = await this.checkEndpoint(endpoint, timeout, testPath);
        if (isAvailable) {
          this.currentEndpoint = endpoint;
          this.isInitialized = true;
          return;
        }
      }
    }

    // 3. 执行自动检测
    if (autoDetect) {
      const detectedEndpoint = await this.autoDetectEndpoint(timeout, testPath);
      if (detectedEndpoint) {
        this.currentEndpoint = detectedEndpoint;
        storageService.set(STORAGE_KEYS.API_AUTO_DETECTED, detectedEndpoint.id);
        this.isInitialized = true;
        return;
      }
    }

    // 4. 如果都不可用，使用优先级最高的端点（即使不可用）
    if (API_ENDPOINTS.length > 0) {
      this.currentEndpoint = API_ENDPOINTS[0];
      this.isInitialized = true;
    }
  }

  /**
   * 检查端点连通性
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

      // HTTP 2xx-4xx 都认为端点可用（能访问就算健康）
      const isAvailable = response.status >= 200 && response.status < 500;

      // 更新状态
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
   * 自动检测最佳可用端点
   */
  async autoDetectEndpoint(
    timeout: number = 1000,
    testPath: string = '/'
  ): Promise<ApiEndpoint | null> {
    // 按优先级顺序测试
    for (const endpoint of API_ENDPOINTS) {
      const isAvailable = await this.checkEndpoint(endpoint, timeout, testPath);
      if (isAvailable) {
        return endpoint;
      }
    }
    return null;
  }

  /**
   * 手动设置端点
   */
  setEndpoint(endpointId: string): boolean {
    const endpoint = getEndpointById(endpointId);
    if (!endpoint) {
      return false;
    }

    this.currentEndpoint = endpoint;
    storageService.set(STORAGE_KEYS.API_USER_SELECTED, endpointId);
    return true;
  }

  /**
   * 清除用户手动选择的端点
   */
  clearUserSelection(): void {
    storageService.remove(STORAGE_KEYS.API_USER_SELECTED);
    // 重新初始化，使用自动检测结果
    this.initialize({ autoDetect: true });
  }

  /**
   * 获取当前端点的base URL
   */
  getCurrentBaseUrl(): string {
    if (!this.currentEndpoint) {
      // 如果没有当前端点，返回优先级最高的端点URL
      if (API_ENDPOINTS.length > 0) {
        return buildApiUrl(API_ENDPOINTS[0]);
      }
      return '';
    }
    return buildApiUrl(this.currentEndpoint);
  }

  /**
   * 获取当前端点信息
   */
  getCurrentEndpoint(): ApiEndpoint | null {
    return this.currentEndpoint;
  }

  /**
   * 获取所有端点状态
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
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 后台定期检查端点健康状态
   */
  startHealthCheck(interval: number = 60000): void {
    setInterval(async () => {
      if (this.currentEndpoint) {
        const isAvailable = await this.checkEndpoint(this.currentEndpoint);
        if (!isAvailable) {
          // 当前端点不可用，尝试自动检测新的端点
          const newEndpoint = await this.autoDetectEndpoint();
          if (newEndpoint) {
            this.currentEndpoint = newEndpoint;
            storageService.set(STORAGE_KEYS.API_AUTO_DETECTED, newEndpoint.id);
          }
        }
      }
    }, interval);
  }
}

// 导出单例
export const apiManager = new ApiManager();

