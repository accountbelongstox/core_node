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

  // Shared Pycore transport and health state.
  PYCORE_TARGET: 'pycore_target',
  PYCORE_TARGET_RECENT: 'pycore_target_recent',
  PYCORE_HTTP_BROWSER_ID: 'pycore_http_browser_id',
  PYCORE_HTTP_TAB_ID: 'pycore_http_tab_id',
  PYCORE_HEALTH_RECHECK_INTERVAL_MS: 'pc_health_recheck_interval_ms',

} as const;

/** Public persistence accepts application-owned registries without core imports. */
export type StorageKey = string;

