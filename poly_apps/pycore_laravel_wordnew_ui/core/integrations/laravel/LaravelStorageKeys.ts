import { registerLocalDataGroups } from '../../persistence/LocalDataRegistry';

export const LaravelStorageKeys = {
  CURRENT_ENDPOINT: 'api_current_endpoint',
  CLIENT_KEY_MACHINE_ID: 'api_client_key_machine_id',
  CLIENT_KEY_ROUTES: 'api_client_key_routes',
  AUTO_DETECTED_ENDPOINT: 'api_auto_detected',
  USER_MODIFIED_ENDPOINT: 'api_user_modified',
  RECHECK_INTERVAL_MS: 'api_recheck_interval_ms',
  CUSTOM_ENDPOINTS: 'api_custom_endpoints',
  API_CACHE_PREFIX: 'api_cache_',
} as const;

registerLocalDataGroups([
  {
    id: 'core.laravel_connection',
    appId: 'core',
    labelKey: 'common.local_data.groups.api_connection',
    descriptionKey: 'common.local_data.groups.api_connection_desc',
    clearable: false,
    sources: [{
      kind: 'localStorage',
      prefixes: [
        LaravelStorageKeys.CURRENT_ENDPOINT,
        LaravelStorageKeys.AUTO_DETECTED_ENDPOINT,
        LaravelStorageKeys.USER_MODIFIED_ENDPOINT,
        LaravelStorageKeys.CUSTOM_ENDPOINTS,
        LaravelStorageKeys.CLIENT_KEY_MACHINE_ID,
        LaravelStorageKeys.CLIENT_KEY_ROUTES,
        LaravelStorageKeys.RECHECK_INTERVAL_MS,
      ],
    }],
  },
  {
    id: 'core.api_cache',
    appId: 'core',
    labelKey: 'common.local_data.groups.api_cache',
    descriptionKey: 'common.local_data.groups.api_cache_desc',
    clearable: true,
    sources: [{ kind: 'localStorage', prefixes: [LaravelStorageKeys.API_CACHE_PREFIX] }],
  },
]);
