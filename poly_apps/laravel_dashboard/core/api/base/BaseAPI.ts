import { APIResponse, APIRequestConfig, APIModuleConfig } from '../../types';
import { apiCache } from './APICache';

/**
 * BaseAPI - 所有API模块的基类
 */
export class BaseAPI {
  protected baseURL: string;
  protected prefix: string;
  protected headers: Record<string, string>;
  protected timeout: number;
  protected retryConfig: { count: number; delay: number };

  constructor(config: APIModuleConfig) {
    this.baseURL = config.baseURL;
    this.prefix = config.prefix || '';
    this.headers = config.headers || {};
    this.timeout = config.timeout || 30000;
    this.retryConfig = config.retry || { count: 3, delay: 1000 };
  }

  /**
   * GET请求
   */
  async get<T>(url: string, params?: Record<string, any>, cache: boolean = false, cacheTTL: number = 300000): Promise<APIResponse<T>> {
    const cacheKey = cache ? this.getCacheKey('GET', url, params) : null;

    // 检查缓存
    if (cacheKey) {
      const cached = apiCache.get<T>(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          error: null,
          status: 200,
          message: 'From cache'
        };
      }
    }

    const response = await this.request<T>({
      url,
      method: 'GET',
      params,
      cache,
      cacheTTL
    });

    // 存缓存
    if (cacheKey && response.success && response.data) {
      apiCache.set(cacheKey, response.data, cacheTTL);
    }

    return response;
  }

  /**
   * POST请求
   */
  async post<T>(url: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>({
      url,
      method: 'POST',
      data
    });
  }

  /**
   * PUT请求
   */
  async put<T>(url: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>({
      url,
      method: 'PUT',
      data
    });
  }

  /**
   * DELETE请求
   */
  async delete<T>(url: string): Promise<APIResponse<T>> {
    return this.request<T>({
      url,
      method: 'DELETE'
    });
  }

  /**
   * PATCH请求
   */
  async patch<T>(url: string, data?: any): Promise<APIResponse<T>> {
    return this.request<T>({
      url,
      method: 'PATCH',
      data
    });
  }

  /**
   * 核心请求方法
   */
  protected async request<T>(config: APIRequestConfig, retryCount: number = 0): Promise<APIResponse<T>> {
    const fullURL = this.buildURL(config.url);
    const requestConfig: RequestInit = {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...this.headers,
        ...config.headers
      },
      signal: AbortSignal.timeout(config.timeout || this.timeout)
    };

    // 添加query参数
    const url = config.params ? this.addQueryParams(fullURL, config.params) : fullURL;

    // 添加body
    if (config.data) {
      requestConfig.body = JSON.stringify(config.data);
    }

    try {
      const response = await fetch(url, requestConfig);

      // Check content type
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');

      if (!isJson) {
        // Not JSON response - likely HTML error page
        const text = await response.text();
        return {
          success: false,
          data: null,
          error: `Invalid response format. Expected JSON but got: ${contentType || 'unknown'}. Response preview: ${text.slice(0, 200)}`,
          status: response.status
        };
      }

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: data.data || data,
          error: null,
          status: response.status,
          message: data.message
        };
      } else {
        return {
          success: false,
          data: null,
          error: data.error || data.message || 'Request failed',
          status: response.status
        };
      }
    } catch (error: any) {
      // 重试逻辑
      if (retryCount < this.retryConfig.count && this.shouldRetry(error)) {
        await this.delay(this.retryConfig.delay * (retryCount + 1));
        return this.request<T>(config, retryCount + 1);
      }

      return {
        success: false,
        data: null,
        error: error.message || 'Network error',
        status: 0
      };
    }
  }

  /**
   * 批量请求
   */
  async batch<T>(configs: APIRequestConfig[]): Promise<APIResponse<T>[]> {
    return Promise.all(configs.map(config => this.request<T>(config)));
  }

  /**
   * 构建完整URL
   */
  protected buildURL(path: string): string {
    // 如果path已经是完整URL（以http://或https://开头），直接返回
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const cleanPrefix = this.prefix ? (this.prefix.endsWith('/') ? this.prefix.slice(0, -1) : this.prefix) : '';
    return `${this.baseURL}${cleanPrefix}/${cleanPath}`;
  }

  /**
   * 添加query参数
   */
  protected addQueryParams(url: string, params: Record<string, any>): string {
    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');

    return queryString ? `${url}?${queryString}` : url;
  }

  /**
   * 生成缓存key
   */
  protected getCacheKey(method: string, url: string, params?: Record<string, any>): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${method}:${url}:${paramStr}`;
  }

  /**
   * 是否应该重试
   */
  protected shouldRetry(error: any): boolean {
    // 网络错误或超时重试
    return error.name === 'TypeError' || error.name === 'AbortError';
  }

  /**
   * 延迟
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 设置header
   */
  setHeader(key: string, value: string): void {
    this.headers[key] = value;
  }

  /**
   * 移除header
   */
  removeHeader(key: string): void {
    delete this.headers[key];
  }

  /**
   * 清除所有自定义headers
   */
  clearHeaders(): void {
    this.headers = {};
  }
}
