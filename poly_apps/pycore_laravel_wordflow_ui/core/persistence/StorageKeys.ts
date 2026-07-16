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
  SERVER_MANAGER_CERTBOT_STATUS: `${PREFIX}servermanager_certbot_status`,

  // WordNew (/wordnew) app settings + profile (one consolidated WfNewSettings object).
  WORDNEW_SETTINGS: `${PREFIX}wordnew_settings`,
  /** Fallback guest client id when fingerprint + localStorage are unavailable. */
  WORDNEW_CLIENT_ID: `${PREFIX}wordnew_client_id`,
  // WordNew (/wordnew) social caches (partners / posts / chats).
  WORDNEW_SOCIAL: `${PREFIX}wordnew_social`,
  // WordNew (/wordnew) mock account registry (one object keyed by lowercased email).
  WORDNEW_ACCOUNTS: `${PREFIX}wordnew_accounts`,
  // WordNew (/wordnew) backend endpoint manager.
  // Consolidated store (current): one key holds the whole WfNewEndpointPrefs object.
  WORDNEW_API_PREFS: `${PREFIX}wordnew_api_prefs`,
  // Legacy split keys (pre-consolidation) — kept only so WfNewEndpointStore can
  // one-time migrate existing installs into WORDNEW_API_PREFS, then remove them.
  WORDNEW_API_CUSTOM_ENDPOINTS: `${PREFIX}wordnew_api_custom_endpoints`,
  WORDNEW_API_USER_ENDPOINT: `${PREFIX}wordnew_api_user_endpoint`,
  WORDNEW_API_AUTO_ENDPOINT: `${PREFIX}wordnew_api_auto_endpoint`,
  WORDNEW_API_CURRENT: `${PREFIX}wordnew_api_current`,
  WORDNEW_API_RECHECK_INTERVAL_MS: `${PREFIX}wordnew_api_recheck_interval_ms`
} as const;

export type StorageKey = (typeof StorageKeys)[keyof typeof StorageKeys];

