/** Laravel Manager-owned persistence registry. */
const PREFIX = 'nexus_' as const;

export const LaravelManagerStorageKeys = {
  API_CURRENT_ENDPOINT: 'api_current_endpoint',
  API_AUTO_DETECTED_ENDPOINT: 'api_auto_detected',
  API_USER_MODIFIED_ENDPOINT: 'api_user_modified',
  API_RECHECK_INTERVAL_MS: 'api_recheck_interval_ms',
  API_CUSTOM_ENDPOINTS: 'api_custom_endpoints',
  API_CONFIG: 'dashboard_api_config',
  APP_STATE: `${PREFIX}app_state`,
  SETTINGS: `${PREFIX}settings`,
  LANGUAGE: `${PREFIX}language`,
  THEME: `${PREFIX}theme`,
  USER: `${PREFIX}user`,
  USER_PREFERENCES: `${PREFIX}user_preferences`,
  SERVER_MANAGER_ACTIVE_TAB: `${PREFIX}servermanager_active_tab`,
  SERVER_MANAGER_NGINX_SITES: `${PREFIX}servermanager_nginx_sites`,
  SERVER_MANAGER_SSL_CERTS: `${PREFIX}servermanager_ssl_certs`,
  SERVER_MANAGER_FILE_CURRENT_PATH: `${PREFIX}servermanager_file_current_path`,
  SERVER_MANAGER_FILE_ALLOWED_PATHS: `${PREFIX}servermanager_file_allowed_paths`,
  SERVER_MANAGER_UNIFIED_APPS: `${PREFIX}servermanager_unified_apps`,
  SERVER_MANAGER_SCRIPTS: `${PREFIX}servermanager_scripts`,
  SERVER_MANAGER_CERTBOT_STATUS: `${PREFIX}servermanager_certbot_status`,
} as const;
