import serviceContract from '../../../../../config/service_contract.json';
import { getMessage } from '@/utils/i18n';

export interface ApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  priority: number;
  isLocal: boolean;
  /** _locales message key of a built-in endpoint's label. */
  labelKey?: string;
  /** Stored label of a user-added endpoint. */
  description?: string;
}

export const DEFAULT_API_ENDPOINT_ID = 'production' as const;
const DEFAULT_ROOT_DOMAIN = serviceContract.access.root_domains[0];
const DEFAULT_REGION = serviceContract.access.default_api_region_prefix;
const LARAVEL_API_LABELS = serviceContract.access.service_domains.laravel_api;
const LARAVEL_API_HOST_KEYS = serviceContract.access.service_host_keys.laravelApi;
const LARAVEL_API_PORT = serviceContract.ports.laravel_api_backend;
const LOCAL_HOST_KEYS = new Set(['localhost', 'loopback', 'lan_50_2', 'lan_50_3']);
const ENDPOINT_IDS: Record<string, string> = {
  localhost: 'localhost',
  loopback: 'loopback',
  lan_50_2: 'lan-backup',
  lan_50_3: 'lan-primary',
  cloud: 'remote-laravel',
  tailnet_nuul: 'tailnet-nuul',
  tailnet_api: 'tailnet-api',
};
const PRODUCTION_ENDPOINT_LABEL_KEY = 'apiEndpointProduction';
const ENDPOINT_LABEL_KEYS: Record<string, string> = {
  localhost: 'apiEndpointLocalhost',
  loopback: 'apiEndpointLoopback',
  lan_50_2: 'apiEndpointLanBackup',
  lan_50_3: 'apiEndpointLanPrimary',
  cloud: 'apiEndpointRemoteLaravel',
  tailnet_nuul: 'apiEndpointTailnetNuul',
  tailnet_api: 'apiEndpointTailnetApi',
};

export const DEFAULT_API_HOST = [...LARAVEL_API_LABELS.map((label) => label === '{region}' ? DEFAULT_REGION : label), DEFAULT_ROOT_DOMAIN].join('.');

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    id: DEFAULT_API_ENDPOINT_ID,
    url: DEFAULT_API_HOST,
    protocol: 'https',
    priority: 1,
    isLocal: false,
    labelKey: PRODUCTION_ENDPOINT_LABEL_KEY,
  },
  ...LARAVEL_API_HOST_KEYS.map((hostKey, index) => ({
    id: ENDPOINT_IDS[hostKey] || hostKey,
    url: serviceContract.hosts[hostKey as keyof typeof serviceContract.hosts],
    protocol: 'http' as const,
    port: LARAVEL_API_PORT,
    priority: index + 2,
    isLocal: LOCAL_HOST_KEYS.has(hostKey),
    labelKey: ENDPOINT_LABEL_KEYS[hostKey],
  })),
];

export function buildApiUrl(endpoint: ApiEndpoint, path: string = ''): string {
  const port = endpoint.port ? `:${endpoint.port}` : '';
  const basePath = path.startsWith('/') ? path : `/${path}`;
  return `${endpoint.protocol}://${endpoint.url}${port}${basePath}`;
}

/** Display label: the localized built-in label, a custom endpoint's stored label, or its host. */
export function getEndpointLabel(endpoint: ApiEndpoint): string {
  if (endpoint.labelKey) return getMessage(endpoint.labelKey);
  return endpoint.description || endpoint.url;
}

export function getEndpointById(id: string): ApiEndpoint | undefined {
  return API_ENDPOINTS.find((endpoint) => endpoint.id === id);
}
