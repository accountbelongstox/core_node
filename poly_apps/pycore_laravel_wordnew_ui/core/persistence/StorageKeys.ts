/**
 * Shared infrastructure persistence keys.
 *
 * Application-specific registries live under their owning apps.
 */

const PREFIX = 'nexus_' as const;

export const StorageKeys = {
  // Shared shell state.
  SHELL_DARK: 'shell_dark',
  SHELL_LANGUAGE: 'shell_lang',
  SHELL_THEME_OVERRIDE: 'shell_theme_override',
  SHELL_DOCK_Y: 'shell_dock_y',
  SHELL_DOCK_Y_LEGACY: 'wf_shell_dock_y',

  // Shared authentication state.
  AUTH_TOKEN: `${PREFIX}auth_token`,

  // Shared Laravel endpoint state (single owner: core/api-libs/laravel).
  LARAVEL_API_CURRENT_ENDPOINT: 'api_current_endpoint',
  LARAVEL_API_AUTO_DETECTED_ENDPOINT: 'api_auto_detected',
  LARAVEL_API_USER_MODIFIED_ENDPOINT: 'api_user_modified',
  LARAVEL_API_RECHECK_INTERVAL_MS: 'api_recheck_interval_ms',
  LARAVEL_API_CUSTOM_ENDPOINTS: 'api_custom_endpoints',

  // Shared Pycore transport and health state.
  PYCORE_TARGET: 'pycore_target',
  PYCORE_TARGET_RECENT: 'pycore_target_recent',
  PYCORE_HTTP_BROWSER_ID: 'pycore_http_browser_id',
  PYCORE_HTTP_CLIENT_ID: 'pycore_http_client_id',
  PYCORE_HTTP_EVENT_CURSORS: 'pycore_http_event_cursors',
  PYCORE_ROUTE_RECOVERY: 'pycore_route_recovery',
  PYCORE_HEALTH_RECHECK_INTERVAL_MS: 'pc_health_recheck_interval_ms',

} as const;

/** Public persistence accepts application-owned registries without core imports. */
export type StorageKey = string;
