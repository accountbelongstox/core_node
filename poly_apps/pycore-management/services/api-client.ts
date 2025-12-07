/**
 * 统一 API 客户端
 * 
 * 职责：
 * - 管理所有 API 请求的基础配置
 * - 提供统一的请求/响应拦截
 * - 处理错误和重试逻辑
 * - 支持 Mock 模式切换
 * - 支持请求取消
 */

import { buildApiUrl, buildApiUrlWithParams, API_BASE_URL } from './endpoints';
import {
  createApiError,
  handleHttpError,
  handleNetworkError,
  handleTimeoutError,
  handleParseError,
  handleUnknownError,
  isRetryableError,
  logError,
  ApiError,
  ApiErrorType,
} from './error-handler';
import {
  executeRequestInterceptors,
  executeResponseInterceptors,
} from './interceptors';
import * as mockService from './mockService';

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  useMock?: boolean;
}

class ApiClient {
  private defaultTimeout: number = 30000; // 30秒
  private defaultRetries: number = 0; // 默认不重试

  /**
   * 执行 API 请求
   */
  async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      timeout = this.defaultTimeout,
      retries = this.defaultRetries,
      useMock = import.meta.env.VITE_USE_MOCK === 'true',
      ...fetchOptions
    } = options;

    // Mock 模式
    if (useMock) {
      return this.mockRequest<T>(endpoint, fetchOptions);
    }

    // 真实 API 请求
    try {
      return await this.realRequest<T>(endpoint, fetchOptions, timeout, retries);
    } catch (error) {
      // 如果真实请求失败且允许回退到 Mock，则使用 Mock
      if (import.meta.env.VITE_FALLBACK_TO_MOCK === 'true') {
        console.warn(`[API] Request failed, falling back to mock: ${endpoint}`);
        return this.mockRequest<T>(endpoint, fetchOptions);
      }
      throw error;
    }
  }

  /**
   * 执行真实 API 请求
   */
  private async realRequest<T>(
    endpoint: string,
    options: RequestInit,
    timeout: number,
    retries: number
  ): Promise<T> {
    const url = buildApiUrl(endpoint);
    let lastError: ApiError | null = null;

    // 重试逻辑
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // 执行请求拦截器
        const interceptedOptions = await executeRequestInterceptors(options, url);

        // 创建带超时的请求
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            ...interceptedOptions,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          // 执行响应拦截器
          const interceptedResponse = await executeResponseInterceptors(response);

          // 检查响应状态
          if (!interceptedResponse.ok) {
            const error = handleHttpError(interceptedResponse, endpoint);
            
            // 如果是可重试的错误且还有重试次数，继续重试
            if (isRetryableError(error) && attempt < retries) {
              lastError = error;
              await this.delay(1000 * (attempt + 1)); // 指数退避
              continue;
            }

            throw error;
          }

          // 解析响应数据
          const data = await this.parseResponse<T>(interceptedResponse, endpoint);
          return data;
        } catch (fetchError: unknown) {
          clearTimeout(timeoutId);

          if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
            const error = handleTimeoutError(endpoint);
            
            if (attempt < retries) {
              lastError = error;
              await this.delay(1000 * (attempt + 1));
              continue;
            }

            throw error;
          }

          throw fetchError;
        }
      } catch (error: unknown) {
        // 处理不同类型的错误
        if (error instanceof Error && error.name === 'AbortError') {
          const apiError = handleTimeoutError(endpoint);
          if (attempt < retries) {
            lastError = apiError;
            await this.delay(1000 * (attempt + 1));
            continue;
          }
          throw apiError;
        }

        if (error && typeof error === 'object' && 'type' in error) {
          // 已经是 ApiError
          lastError = error as ApiError;
          if (isRetryableError(lastError) && attempt < retries) {
            await this.delay(1000 * (attempt + 1));
            continue;
          }
          throw error;
        }

        // 网络错误或其他错误
        const apiError = error instanceof Error
          ? handleNetworkError(error, endpoint)
          : handleUnknownError(error, endpoint);

        if (isRetryableError(apiError) && attempt < retries) {
          lastError = apiError;
          await this.delay(1000 * (attempt + 1));
          continue;
        }

        throw apiError;
      }
    }

    // 所有重试都失败了
    if (lastError) {
      logError(lastError);
      throw lastError;
    }

    throw handleUnknownError(new Error('Request failed'), endpoint);
  }

  /**
   * 解析响应数据
   */
  private async parseResponse<T>(response: Response, endpoint: string): Promise<T> {
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      try {
        const text = await response.text();
        if (!text) {
          return {} as T;
        }
        return JSON.parse(text) as T;
      } catch (error) {
        throw handleParseError(error instanceof Error ? error : new Error('Parse error'), endpoint);
      }
    }

    // 非 JSON 响应
    return response as unknown as T;
  }

  /**
   * Mock 请求
   */
  private async mockRequest<T>(endpoint: string, options: RequestInit): Promise<T> {
    // 根据 endpoint 映射到对应的 mock 函数
    const mockFunction = this.getMockFunction(endpoint, options.method || 'GET');
    
    if (!mockFunction) {
      throw createApiError(
        ApiErrorType.UNKNOWN_ERROR,
        `No mock function found for ${endpoint}`,
        { endpoint }
      );
    }

    // 解析请求体
    let mockParams: any = {};
    if (options.body) {
      try {
        mockParams = typeof options.body === 'string' 
          ? JSON.parse(options.body) 
          : options.body;
      } catch {
        // 忽略解析错误
      }
    }

    // 调用 mock 函数
    return await mockFunction(mockParams);
  }

  /**
   * 根据端点获取对应的 Mock 函数
   */
  private getMockFunction(endpoint: string, method: string): ((params?: any) => Promise<any>) | null {
    // 端点到 Mock 函数的映射（支持新旧端点路径）
    const mockMap: Record<string, () => Promise<any>> = {
      // Dashboard (新路径)
      '/api/manage/dashboard/overview': () => mockService.getDashboardOverview(),
      '/api/manage/dashboard/realtime': (params?: { count?: number }) => 
        mockService.getRealtimeMetrics(params?.count),
      // Dashboard (旧路径兼容)
      '/api/dashboard/overview': () => mockService.getDashboardOverview(),
      '/api/dashboard/metrics': (params?: { count?: number }) => 
        mockService.getRealtimeMetrics(params?.count),
      
      // System Management (新路径)
      '/api/manage/status': () => mockService.getSystemStatus(),
      '/api/manage/config': method === 'GET' 
        ? () => mockService.getSystemConfig()
        : (params: any) => mockService.updateSystemConfig(params),
      // System Management (旧路径兼容)
      '/api/system/status': () => mockService.getSystemStatus(),
      '/api/system/config': method === 'GET' 
        ? () => mockService.getSystemConfig()
        : (params: any) => mockService.updateSystemConfig(params),
      
      // Local Processing (新路径)
      '/api/manage/local/capabilities': () => mockService.getLocalCapabilities(),
      '/api/manage/local/config': method === 'GET'
        ? () => mockService.getLocalConfig()
        : (params: any) => mockService.updateLocalConfig(params),
      '/api/manage/local/stats': () => mockService.getLocalProcessingStats(),
      '/api/manage/local/test': (params: any) => mockService.runLocalTest(params),
      // Local Processing (旧路径兼容)
      '/api/local/capabilities': () => mockService.getLocalCapabilities(),
      '/api/local/config': method === 'GET'
        ? () => mockService.getLocalConfig()
        : (params: any) => mockService.updateLocalConfig(params),
      '/api/local/stats': () => mockService.getLocalProcessingStats(),
      '/api/local/test': (params: any) => mockService.runLocalTest(params),
      
      // Tools (新路径)
      '/api/local/screenshot/capture': (params: any) => mockService.captureScreenshot(params),
      '/api/local/screenshot/ocr': (params: any) => mockService.captureScreenshot(params),
      '/api/local/image/ocr': (params: any) => mockService.performOCR(params),
      '/api/local/audio/transcribe': (params: any) => mockService.transcribeAudio(params),
      '/api/local/video/generate-subtitle': (params: any) => mockService.processVideo(params),
      '/api/local/file/analyze': (params: any) => mockService.analyzeFile(params),
      // Tools (旧路径兼容)
      '/api/tools/screenshot': (params: any) => mockService.captureScreenshot(params),
      '/api/tools/ocr': (params: any) => mockService.performOCR(params),
      '/api/tools/audio/transcribe': (params: any) => mockService.transcribeAudio(params),
      '/api/tools/video/process': (params: any) => mockService.processVideo(params),
      '/api/tools/file/analyze': (params: any) => mockService.analyzeFile(params),
      
      // Upload (路径匹配)
      '/api/upload/tasks': () => mockService.getUploadTasks(),
      '/api/upload/history': () => mockService.getUploadHistory(),
      '/api/upload/servers': () => mockService.getUploadServers(),
      
      // Remote/Client (新路径)
      '/api/client/server-config': () => mockService.getRemoteServers(),
      // Remote (旧路径兼容)
      '/api/remote/servers': () => mockService.getRemoteServers(),
      
      // Logs (新路径)
      '/api/manage/logs': () => mockService.getLogs(),
      // Logs (旧路径兼容)
      '/api/logs': () => mockService.getLogs(),
      
      // Statistics (新路径)
      '/api/manage/stats/performance': () => mockService.getPerformanceStats(),
      '/api/manage/stats/trends': () => mockService.getUsageTrends(),
      '/api/manage/stats/resources': () => mockService.getResourceStats(),
      // Statistics (旧路径兼容)
      '/api/stats/performance': () => mockService.getPerformanceStats(),
      '/api/stats/trends': () => mockService.getUsageTrends(),
      '/api/stats/resources': () => mockService.getResourceStats(),
    };

    return mockMap[endpoint] || null;
  }

  /**
   * 延迟函数（用于重试）
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET 请求
   */
  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * POST 请求
   */
  async post<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * PUT 请求
   */
  async put<T>(endpoint: string, data?: any, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * DELETE 请求
   */
  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

// 导出单例实例
export const apiClient = new ApiClient();

