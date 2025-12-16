/**
 * API Endpoints Configuration
 * 定义所有可用的后端API端点
 */

export interface ApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  priority: number;
  isLocal: boolean;
  description: string;
}

export interface ApiEndpointsConfig {
  endpoints: ApiEndpoint[];
  healthCheckInterval: number;
  timeout: number;
  retryAttempts: number;
}

/**
 * 全局API端点配置
 */
export const GLOBAL_API_ENDPOINTS: ApiEndpointsConfig = {
  endpoints: [
    {
      id: 'localhost',
      url: 'localhost',
      protocol: 'http',
      port: 9000,
      priority: 1,
      isLocal: true,
      description: 'Localhost API Server'
    },
    {
      id: 'local-ip-50-3',
      url: '192.168.50.3',
      protocol: 'http',
      port: 9000,
      priority: 2,
      isLocal: true,
      description: 'Local IP 192.168.50.3'
    },
    {
      id: 'local-ip-50-2',
      url: '192.168.50.2',
      protocol: 'http',
      port: 9000,
      priority: 3,
      isLocal: true,
      description: 'Local IP 192.168.50.2'
    },
    {
      id: 'primary-remote',
      url: 'api.si.12gm.com',
      protocol: 'https',
      priority: 4,
      isLocal: false,
      description: 'Primary Remote API Server'
    }
  ],
  healthCheckInterval: 60000, // 1 minute
  timeout: 1000, // 1 second timeout
  retryAttempts: 3
};

/**
 * 构建完整的API URL
 */
export function buildApiUrl(endpoint: ApiEndpoint, path: string = ''): string {
  const port = endpoint.port ? `:${endpoint.port}` : '';
  const baseUrl = `${endpoint.protocol}://${endpoint.url}${port}`;

  if (!path) return baseUrl;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

/**
 * 根据ID获取端点
 */
export function getEndpointById(id: string): ApiEndpoint | undefined {
  return GLOBAL_API_ENDPOINTS.endpoints.find(e => e.id === id);
}

/**
 * 获取所有端点（按优先级排序）
 */
export function getAllEndpoints(): ApiEndpoint[] {
  return [...GLOBAL_API_ENDPOINTS.endpoints].sort((a, b) => a.priority - b.priority);
}
