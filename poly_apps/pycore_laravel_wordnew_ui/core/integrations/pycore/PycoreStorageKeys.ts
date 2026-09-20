export const PycoreStorageKeys = {
  TARGET: 'pycore_target',
  TARGET_RECENT: 'pycore_target_recent',
  HTTP_BROWSER_ID: 'pycore_http_browser_id',
  HTTP_CLIENT_ID: 'pycore_http_client_id',
  HTTP_EVENT_CURSORS: 'pycore_http_event_cursors',
  ROUTE_RECOVERY: 'pycore_route_recovery',
  HEALTH_RECHECK_INTERVAL_MS: 'pc_health_recheck_interval_ms',
  RELAY_STATE: 'pycore_relay_state',
  QY_ACCOUNTS: 'pycore_qy_accounts',
  QY_PENDING_LOGOUTS: 'pycore_qy_pending_logouts',
  /** One-time browser migration source from the pre-consolidation Relay UI. */
  RELAY_STATE_LEGACY: 'pycore_relay_v2_state',
} as const;
