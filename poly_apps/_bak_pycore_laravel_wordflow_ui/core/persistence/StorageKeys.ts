/**
 * Centralized local persistence keys.
 *
 * NOTE: This is code (not a data directory). We keep all keys here to avoid
 * scattered string literals across the app.
 */

const PREFIX = 'nexus_' as const;

export const StorageKeys = {
  // App / UI
  APP_STATE: `${PREFIX}app_state`,
  SETTINGS: `${PREFIX}settings`,
  LANGUAGE: `${PREFIX}language`,
  THEME: `${PREFIX}theme`,

  // User
  USER: `${PREFIX}user`,

  // Server Manager (cache)
  SERVER_MANAGER_ACTIVE_TAB: `${PREFIX}servermanager_active_tab`,
  SERVER_MANAGER_NGINX_SITES: `${PREFIX}servermanager_nginx_sites`,
  SERVER_MANAGER_SSL_CERTS: `${PREFIX}servermanager_ssl_certs`,
  SERVER_MANAGER_FILE_CURRENT_PATH: `${PREFIX}servermanager_file_current_path`,
  SERVER_MANAGER_FILE_ALLOWED_PATHS: `${PREFIX}servermanager_file_allowed_paths`,
  SERVER_MANAGER_UNIFIED_APPS: `${PREFIX}servermanager_unified_apps`,
  SERVER_MANAGER_SCRIPTS: `${PREFIX}servermanager_scripts`,
  SERVER_MANAGER_CERTBOT_STATUS: `${PREFIX}servermanager_certbot_status`
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

