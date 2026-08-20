export interface ApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  priority: number;
  isLocal: boolean;
  description: string;
}

export const DEFAULT_API_ENDPOINT_ID = 'production' as const;
export const DEFAULT_API_HOST = 'api.si.12gm.com' as const;
export const DEFAULT_API_BASE_URL = `https://${DEFAULT_API_HOST}` as const;

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: DEFAULT_API_ENDPOINT_ID,
    url: DEFAULT_API_HOST,
    protocol: 'https',
    priority: 1,
    isLocal: false,
    description: 'Production Cloud Server',
  },
  {
    id: 'localhost',
    url: 'localhost',
    protocol: 'http',
    port: 9000,
    priority: 2,
    isLocal: true,
    description: 'Local Development Server',
  },
  {
    id: 'remote-laravel',
    url: '43.163.112.77',
    protocol: 'http',
    port: 9000,
    priority: 3,
    isLocal: false,
    description: 'Remote Laravel Main (43.163.112.77)',
  },
  {
    id: 'lan-primary',
    url: '192.168.50.3',
    protocol: 'http',
    port: 9000,
    priority: 4,
    isLocal: true,
    description: 'LAN Primary Server',
  },
  {
    id: 'lan-backup',
    url: '192.168.50.2',
    protocol: 'http',
    port: 9000,
    priority: 5,
    isLocal: true,
    description: 'LAN Backup Server',
  },
];

export function buildApiUrl(endpoint: ApiEndpoint, path: string = ''): string {
  const port = endpoint.port ? `:${endpoint.port}` : '';
  const basePath = path.startsWith('/') ? path : `/${path}`;
  return `${endpoint.protocol}://${endpoint.url}${port}${basePath}`;
}

export function getEndpointById(id: string): ApiEndpoint | undefined {
  return API_ENDPOINTS.find((endpoint) => endpoint.id === id);
}
