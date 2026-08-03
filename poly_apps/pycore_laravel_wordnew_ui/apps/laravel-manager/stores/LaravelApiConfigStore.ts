import { useEffect, useSyncExternalStore } from 'react';
import { getDefaultBaseURL, DEFAULT_API_PORT } from '../../../config/constants';
import { apiManager, API_HEALTH_EVENT } from '../../../core/api-libs/laravel/ApiManager';
import { buildApiUrl } from '../../../config/api-endpoints';
import { StorageManager } from '../../../core/persistence';
import { LaravelManagerStorageKeys } from '../persistence/LaravelManagerStorageKeys';

export interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  port?: number;
}

interface ApiConfigState {
  config: ApiConfig;
  liveBaseUrl: string;
}

export interface LaravelApiConfigStoreValue extends ApiConfigState {
  updateConfig: (newConfig: Partial<ApiConfig>) => void;
  resetConfig: () => void;
}

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: getDefaultBaseURL(),
  apiKey: undefined,
  port: DEFAULT_API_PORT,
};
const listeners = new Set<() => void>();
const savedConfig = StorageManager.get<Partial<ApiConfig> | null>(LaravelManagerStorageKeys.API_CONFIG, null);
const initialEndpoint = apiManager.getCurrentEndpoint();
const initialBaseUrl = initialEndpoint ? buildApiUrl(initialEndpoint) : savedConfig?.baseUrl || DEFAULT_CONFIG.baseUrl;
let state: ApiConfigState = {
  config: {
    baseUrl: savedConfig?.baseUrl || DEFAULT_CONFIG.baseUrl,
    apiKey: savedConfig?.apiKey || DEFAULT_CONFIG.apiKey,
    port: savedConfig?.port || DEFAULT_CONFIG.port,
  },
  liveBaseUrl: initialBaseUrl,
};

function readLiveBaseUrl(): string {
  const endpoint = apiManager.getCurrentEndpoint();
  return endpoint ? buildApiUrl(endpoint) : state.config.baseUrl;
}

function publish(nextState: ApiConfigState): void {
  state = nextState;
  listeners.forEach((listener) => listener());
}

function refreshLiveBaseUrl(): void {
  const liveBaseUrl = readLiveBaseUrl();
  if (liveBaseUrl !== state.liveBaseUrl) publish({ ...state, liveBaseUrl });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ApiConfigState {
  return state;
}

function updateConfig(newConfig: Partial<ApiConfig>): void {
  const config = { ...state.config, ...newConfig };
  const endpoint = apiManager.getCurrentEndpoint();
  const liveBaseUrl = endpoint ? buildApiUrl(endpoint) : config.baseUrl;
  StorageManager.set(LaravelManagerStorageKeys.API_CONFIG, config);
  publish({ config, liveBaseUrl });
}

function resetConfig(): void {
  StorageManager.remove(LaravelManagerStorageKeys.API_CONFIG);
  publish({ config: DEFAULT_CONFIG, liveBaseUrl: readLiveBaseUrl() });
}

export function useLaravelApiConfig(): LaravelApiConfigStoreValue {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    refreshLiveBaseUrl();
    window.addEventListener(API_HEALTH_EVENT, refreshLiveBaseUrl);
    return () => window.removeEventListener(API_HEALTH_EVENT, refreshLiveBaseUrl);
  }, []);

  return {
    ...snapshot,
    updateConfig,
    resetConfig,
  };
}
