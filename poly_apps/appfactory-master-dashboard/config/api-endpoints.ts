/**
 * API端点配置
 * 定义所有可用的后端API服务器端点
 */

export interface ApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  priority: number; // 1最高，数字越小优先级越高
  isLocal: boolean;
  description: string;
}

/**
 * 构建完整的API URL
 */
export const buildApiUrl = (endpoint: ApiEndpoint): string => {
  const { protocol, url, port } = endpoint;
  if (port) {
    return `${protocol}://${url}:${port}`;
  }
  return `${protocol}://${url}`;
};

/**
 * 根据ID获取端点
 */
export const getEndpointById = (id: string): ApiEndpoint | undefined => {
  return API_ENDPOINTS.find(ep => ep.id === id);
};

/**
 * 所有可用的API端点列表
 * 按优先级排序（priority越小优先级越高）
 */
export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'localhost',
    url: 'localhost',
    protocol: 'http',
    port: 9000,
    priority: 1,
    isLocal: true,
    description: '本地开发服务器',
  },
  {
    id: 'lan-primary',
    url: '192.168.50.3',
    protocol: 'http',
    port: 9000,
    priority: 2,
    isLocal: false,
    description: '局域网主服务器',
  },
  {
    id: 'lan-backup',
    url: '192.168.50.2',
    protocol: 'http',
    port: 9000,
    priority: 3,
    isLocal: false,
    description: '局域网备用服务器',
  },
  {
    id: 'cloud-production',
    url: 'api.si.12gm.com',
    protocol: 'https',
    port: undefined,
    priority: 4,
    isLocal: false,
    description: '云端生产服务器',
  },
].sort((a, b) => a.priority - b.priority); // 按优先级排序

