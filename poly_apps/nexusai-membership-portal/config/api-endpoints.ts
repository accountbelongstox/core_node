export interface ApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  priority: number;
  isLocal: boolean;
  description: string;
}

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: 'local',
    url: 'localhost',
    protocol: 'http',
    port: 3000,
    priority: 1,
    isLocal: true,
    description: 'Local development server'
  },
  {
    id: 'lan-primary',
    url: '192.168.50.3',
    protocol: 'http',
    port: 3000,
    priority: 2,
    isLocal: false,
    description: 'LAN primary server'
  },
  {
    id: 'lan-backup',
    url: '192.168.50.2',
    protocol: 'http',
    port: 3000,
    priority: 3,
    isLocal: false,
    description: 'LAN backup server'
  },
  {
    id: 'production',
    url: 'api.toprouter.cn',
    protocol: 'https',
    port: 443,
    priority: 4,
    isLocal: false,
    description: 'Production server'
  }
];

export function buildApiUrl(endpoint: ApiEndpoint): string {
  const port = endpoint.port ? `:${endpoint.port}` : '';
  return `${endpoint.protocol}://${endpoint.url}${port}`;
}

export function getEndpointById(id: string): ApiEndpoint | undefined {
  return API_ENDPOINTS.find(ep => ep.id === id);
}

