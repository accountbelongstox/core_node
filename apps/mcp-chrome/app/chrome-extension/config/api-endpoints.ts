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
    id: 'localhost',
    url: 'localhost',
    protocol: 'http',
    port: 9000,
    priority: 1,
    isLocal: true,
    description: 'Local Development Server',
  },
  {
    id: 'remote-laravel',
    url: '43.163.112.77',
    protocol: 'http',
    port: 9000,
    priority: 2,
    isLocal: false,
    description: 'Remote Laravel Main (43.163.112.77)',
  },
  {
    id: 'lan-primary',
    url: '192.168.50.3',
    protocol: 'http',
    port: 9000,
    priority: 3,
    isLocal: true,
    description: 'LAN Primary Server',
  },
  {
    id: 'lan-backup',
    url: '192.168.50.2',
    protocol: 'http',
    port: 9000,
    priority: 4,
    isLocal: true,
    description: 'LAN Backup Server',
  },
  {
    id: 'production',
    url: 'api.si.12gm.com',
    protocol: 'https',
    priority: 5,
    isLocal: false,
    description: 'Production Cloud Server',
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
