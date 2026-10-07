import { requestPycoreHttp, PYCORE_HTTP_ROUTES } from './PycoreApiTransport';

/** The CLI run behind start/stop/restart waits for the service; allow longer than the default HTTP deadline. */
const NETWORK_ROUTER_ACTION_TIMEOUT_MS = 120_000;

export type NetworkRouterAction = 'start' | 'stop' | 'restart';
export type NetworkRouterPlatform = 'linux' | 'windows' | 'other';

export interface NetworkRouterService {
  name: string;
  /** `running`, `stopped` or `absent`. */
  state: string;
  enabled: boolean | null;
}

export interface NetworkRouterConfig {
  ROUTE_MODE?: string;
  WAN_SELECT?: string;
  LAN_MODE?: string;
  LAN_PORTS?: string;
  PAIRS?: string;
  LAN_MAP?: string;
  SYSTEM_WAN?: string;
  LAN_ADDRESS?: string;
  DHCP_ENABLED?: string;
}

export interface NetworkRouterLink {
  bridge: string;
  uplink: string;
  address: string;
  relay: string[];
  state: 'active' | 'hold';
  host_uplink: boolean;
  dhcp_running: boolean;
}

export interface NetworkRouterInterface {
  name: string;
  kind: 'onboard' | 'usb';
  media: 'wired' | 'wifi';
  link_up: boolean;
  ipv4: string[];
  role: '' | 'uplink' | 'relay';
  bridge: string;
}

export interface NetworkRouterLease {
  bridge: string;
  expires: string;
  mac: string;
  ip: string;
  host: string;
}

/** Settings of one relay port scope (yes/no flags, rates in Mbit with 0 = unshaped, connection limit 0 = off). */
export interface NetworkRouterLanSettings {
  FAIR_SHARE: string;
  BANDWIDTH_DOWN: string;
  BANDWIDTH_UP: string;
  HOST_CONN_LIMIT: string;
  AUTO_BIND: string;
}

export interface NetworkRouterBinding {
  mac: string;
  ip: string;
  host: string;
  /** Unix seconds. */
  bound_at: string;
  source: 'auto' | 'manual';
}

/** Settings namespace of a relay port: its LAN name (else the port name). */
export interface NetworkRouterLanScope {
  scope: string;
  port: string;
  settings: NetworkRouterLanSettings;
  bindings: NetworkRouterBinding[];
}

/** Router state of the pycore machine; the fields after `leases` exist only while the matching platform reports them. */
export interface NetworkRouterStatus {
  success: boolean;
  error_code?: string | null;
  detail?: string | null;
  platform: NetworkRouterPlatform;
  supported: boolean;
  unsupported_code: string;
  /** INSTALL_NETWORK_ROUTER of the install menu. */
  install_flag: boolean;
  installed: boolean;
  install_command: string;
  service: NetworkRouterService;
  diag_service: NetworkRouterService | null;
  config_file: string;
  config: NetworkRouterConfig | null;
  forwarding: boolean | null;
  dhcp_running: boolean | null;
  links: NetworkRouterLink[];
  interfaces: NetworkRouterInterface[];
  leases: NetworkRouterLease[];
  lan_scopes: NetworkRouterLanScope[];
  report?: string;
  report_error_code?: string;
}

export interface NetworkRouterActionResult {
  success: boolean;
  error_code?: string | null;
  detail?: string | null;
  action?: NetworkRouterAction;
  output?: string;
  state?: NetworkRouterStatus;
}

export interface NetworkRouterLogs {
  success: boolean;
  error_code?: string | null;
  detail?: string | null;
  lines?: string[];
}

export const pycoreApiNetworkRouter = {
  getNetworkRouterStatus: (report = false) => requestPycoreHttp(PYCORE_HTTP_ROUTES.networkRouterStatus, {
    report: report ? '1' : undefined,
  }) as Promise<NetworkRouterStatus>,
  getNetworkRouterLogs: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.networkRouterLogs, {}) as Promise<NetworkRouterLogs>,
  controlNetworkRouter: (action: NetworkRouterAction) => requestPycoreHttp(
    PYCORE_HTTP_ROUTES.networkRouterAction,
    { action },
    NETWORK_ROUTER_ACTION_TIMEOUT_MS,
  ) as Promise<NetworkRouterActionResult>,
};
