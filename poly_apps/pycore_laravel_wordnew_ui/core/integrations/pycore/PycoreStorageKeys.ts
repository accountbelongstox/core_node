import { registerLocalDataGroups } from '../../persistence/LocalDataRegistry';

export const PycoreStorageKeys = {
  TARGET: 'pycore_target',
  TARGET_RECENT: 'pycore_target_recent',
  LAN_URLS: 'pycore_lan_urls',
  HTTP_BROWSER_ID: 'pycore_http_browser_id',
  HTTP_CLIENT_IDS: 'pycore_http_client_ids',
  HTTP_EVENT_CURSORS: 'pycore_http_event_cursors',
  ROUTE_RECOVERY: 'pycore_route_recovery',
  HEALTH_RECHECK_INTERVAL_MS: 'pc_health_recheck_interval_ms',
  RELAY_STATE: 'pycore_relay_state',
  QY_ACCOUNTS: 'pycore_qy_accounts',
  QY_PENDING_LOGOUTS: 'pycore_qy_pending_logouts',
} as const;

registerLocalDataGroups([
  {
    id: 'core.pycore_connection',
    appId: 'core',
    labelKey: 'common.local_data.groups.pycore_connection',
    descriptionKey: 'common.local_data.groups.pycore_connection_desc',
    clearable: false,
    sources: [{
      kind: 'localStorage',
      keys: Object.values(PycoreStorageKeys).filter((key) => key !== PycoreStorageKeys.ROUTE_RECOVERY),
    }],
  },
  {
    id: 'core.route_recovery',
    appId: 'core',
    labelKey: 'common.local_data.groups.route_recovery',
    descriptionKey: 'common.local_data.groups.route_recovery_desc',
    clearable: true,
    sources: [{ kind: 'localStorage', keys: [PycoreStorageKeys.ROUTE_RECOVERY] }],
  },
]);
