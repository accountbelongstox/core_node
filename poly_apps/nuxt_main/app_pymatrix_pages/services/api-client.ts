/**
 * PyMatrix 统一 API 客户端服务
 *
 * 职责：
 * - 管理所有API和WebSocket连接的基础URL
 * - 提供统一的URL构建方法
 * - 确保配置的正确性和一致性
 *
 * 架构原则：
 * - API中心化：所有API URL通过此服务构建
 * - 配置验证：严格验证环境配置，不提供fallback
 * - 单例模式：确保全局唯一实例
 *
 * @version 1.0.0
 * @date 2025-11-04
 */

/**
 * API客户端配置接口
 */
interface ApiClientConfig {
  baseURL: string;
  wsBaseURL: string;
}

/**
 * 统一的 API 客户端服务类
 */
export class ApiClient {
  private static instance: ApiClient | null = null;
  private baseURL: string;
  private wsBaseURL: string;
  private initialized: boolean = false;

  /**
   * 私有构造函数（单例模式）
   */
  private constructor() {
    this.baseURL = '';
    this.wsBaseURL = '';
  }

  /**
   * 获取API客户端单例实例
   */
  public static getInstance(): ApiClient {
    if (!ApiClient.instance) {
      ApiClient.instance = new ApiClient();
    }
    return ApiClient.instance;
  }

  /**
   * 初始化API客户端
   * 必须在使用前调用
   */
  public initialize(): void {
    if (this.initialized) {
      return;
    }

    const config = useRuntimeConfig();

    // 获取配置
    this.baseURL = config.public.pyMatrixAPI as string;
    this.wsBaseURL = config.public.pyMatrixWSBase as string;

    // 严格验证配置
    if (!this.baseURL) {
      throw new Error(
        '[ApiClient] NUXT_PUBLIC_PYMATRIX_API environment variable is not configured.\n' +
        'Please set it in your .env file:\n' +
        'NUXT_PUBLIC_PYMATRIX_API=http://localhost:8000'
      );
    }

    if (!this.wsBaseURL) {
      throw new Error(
        '[ApiClient] NUXT_PUBLIC_PYMATRIX_WS_BASE environment variable is not configured.\n' +
        'Please set it in your .env file:\n' +
        'NUXT_PUBLIC_PYMATRIX_WS_BASE=ws://localhost:8000'
      );
    }

    // 规范化URL（移除尾部斜杠）
    this.baseURL = this.baseURL.replace(/\/$/, '');
    this.wsBaseURL = this.wsBaseURL.replace(/\/$/, '');

    this.initialized = true;

    // 开发环境日志
    if (process.env.NODE_ENV === 'development') {
      console.info('[ApiClient] Initialized successfully:', {
        baseURL: this.baseURL,
        wsBaseURL: this.wsBaseURL,
      });
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }

  /**
   * 构建HTTP API URL
   *
   * @param path API路径 (例如: '/api/devices/list' 或 'api/devices/list')
   * @returns 完整的API URL
   *
   * @example
   * buildUrl('/api/devices/list') // => 'http://localhost:8000/api/devices/list'
   * buildUrl('api/devices/list')  // => 'http://localhost:8000/api/devices/list'
   */
  public buildUrl(path: string): string {
    this.ensureInitialized();

    // 确保path以/开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.baseURL}${normalizedPath}`;
  }

  /**
   * 构建WebSocket URL
   *
   * @param path WebSocket路径 (例如: '/ws/video/12345')
   * @returns 完整的WebSocket URL
   *
   * @example
   * buildWSUrl('/ws/video/12345') // => 'ws://localhost:8000/ws/video/12345'
   */
  public buildWSUrl(path: string): string {
    this.ensureInitialized();

    // 确保path以/开头
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.wsBaseURL}${normalizedPath}`;
  }

  /**
   * 获取HTTP基础URL
   *
   * @returns HTTP基础URL
   */
  public getBaseURL(): string {
    this.ensureInitialized();
    return this.baseURL;
  }

  /**
   * 获取WebSocket基础URL
   *
   * @returns WebSocket基础URL
   */
  public getWSBaseURL(): string {
    this.ensureInitialized();
    return this.wsBaseURL;
  }

  /**
   * 检查是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 重置实例（主要用于测试）
   */
  public static resetInstance(): void {
    ApiClient.instance = null;
  }
}

/**
 * 便捷函数 - 获取API客户端实例
 * 自动初始化
 *
 * @returns API客户端实例
 *
 * @example
 * const apiClient = useApiClient();
 * const url = apiClient.buildUrl('/api/devices/list');
 */
export function useApiClient(): ApiClient {
  const client = ApiClient.getInstance();
  if (!client.isInitialized()) {
    client.initialize();
  }
  return client;
}

/**
 * 便捷函数 - 构建API URL
 *
 * @param path API路径
 * @returns 完整的API URL
 *
 * @example
 * const url = buildApiUrl('/api/devices/list');
 */
export function buildApiUrl(path: string): string {
  return useApiClient().buildUrl(path);
}

/**
 * 便捷函数 - 构建WebSocket URL
 *
 * @param path WebSocket路径
 * @returns 完整的WebSocket URL
 *
 * @example
 * const wsUrl = buildWebSocketUrl('/ws/video/12345');
 */
export function buildWebSocketUrl(path: string): string {
  return useApiClient().buildWSUrl(path);
}
