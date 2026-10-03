/**
 * TypeScript adapter for the canonical service contract (ports, loopback
 * host, shared external data paths, shared file names).
 *
 * Source: config/service_contract.json (repo root)
 * Aligned adapters:
 * - poly_apps/laravel_main/app/Support/ServiceContract.php
 * - scripts/shells/linux/common/service_contract_common.sh
 *
 * A port, host, shared path or shared file name must be changed in the JSON
 * source first; every end reads the same file. Plain constants only, so this
 * adapter is safe to import from both the Vite config (node) and the web app
 * (browser bundle).
 */
import contractDocument from '../../../../config/service_contract.json';

const DEFAULT_ROOT_DOMAIN = contractDocument.access.root_domains[0];
const LARAVEL_API_DOMAIN_PARTS = contractDocument.access.service_domains.laravel_api;

export const LOOPBACK_HOST: string = contractDocument.hosts.loopback;
export const BIND_ANY_HOST: string = contractDocument.hosts.any;
export const LARAVEL_API_BACKEND_PORT: number = contractDocument.ports.laravel_api_backend;
export const PYCORE_BACKEND_PORT: number = contractDocument.ports.pycore_backend;
export const NEXUS_DASH_FRONTEND_PORT: number = contractDocument.ports.nexus_dash_frontend;
export const LARAVEL_API_BACKEND_URL = `http://${LOOPBACK_HOST}:${LARAVEL_API_BACKEND_PORT}`;
export const NEXUS_DASH_FRONTEND_URL = `http://${LOOPBACK_HOST}:${NEXUS_DASH_FRONTEND_PORT}`;
export const CORE_NODE_DATA_DIR_NAME: string = contractDocument.paths.core_node_data_dir_name;
export const GLOBAL_VAR_DIR_NAME: string = contractDocument.paths.global_var_dir_name;
export const FRANKENPHP_ROOT_POSIX: string = contractDocument.paths.frankenphp_root_posix;
export const FRANKENPHP_ROOT_WINDOWS_SUBPATH: string = contractDocument.paths.frankenphp_root_windows_subpath;
export const WEB_ACCESS_CONFIG_FILE_NAME: string = contractDocument.files.web_access_config;
/** Live tailnet machine list the UI server answers same-origin (tailscale status). */
export const TAILNET_PEERS_FILE_NAME: string = contractDocument.files.tailnet_peers;
export const MERCURE_TRANSPORT_NAME: string = contractDocument.realtime.mercure_transport;
export const MERCURE_COOKIE_NAME: string = contractDocument.realtime.mercure_cookie;
export const DEFAULT_API_REGION_PREFIX: string = contractDocument.access.default_api_region_prefix;
/** <machine>.<tailnet domain> serves the UI, <api_label>.<machine>... the API (domains: MeshDomain.ts). */
export const TAILNET_API_LABEL: string = contractDocument.access.tailnet.api_label;
/** Laravel main on https://<machine>.<tailnet domain><api_path>. */
export const TAILNET_API_PATH: string = contractDocument.access.tailnet.api_path;
/** Loopback-only pycore on https://<machine>.<tailnet domain><pycore_path> (tailnet sources only). */
export const TAILNET_PYCORE_PATH: string = contractDocument.access.tailnet.pycore_path;
/** Former pycore mounts; a stored URL on one of them is read as the current mount. */
export const TAILNET_PYCORE_LEGACY_PATHS: string[] = contractDocument.access.tailnet.pycore_legacy_paths;
/** pycore publishes the live tailnet machine list here (below its tailnet mount). */
export const TAILNET_PEERS_ROUTE: string = contractDocument.access.tailnet.peers_route;
export const LAN_MACHINES_ROUTE: string = contractDocument.access.lan.machines_route;
export const LAN_MAX_SCAN_HOSTS: number = contractDocument.access.lan.max_scan_hosts;
/** Tailnet machines on these OSes (phones) never serve an API. */
export const TAILNET_CLIENT_ONLY_OS: string[] = contractDocument.access.tailnet.client_only_os.map((name) => name.toLowerCase());
export const DEFAULT_LARAVEL_API_HOST: string = [
  ...LARAVEL_API_DOMAIN_PARTS.map((part) => (
    part === '{region}' ? DEFAULT_API_REGION_PREFIX : part
  )),
  DEFAULT_ROOT_DOMAIN,
].join('.');
export const DEFAULT_LARAVEL_API_ORIGIN = `https://${DEFAULT_LARAVEL_API_HOST}`;
export const SERVICE_CONTRACT_ROOT_DOMAINS: string[] = [...contractDocument.access.root_domains];
/** URLs may hold {mesh_domain}; read them resolved through TailnetDiscovery.getServiceUrlEntries. */
export const SERVICE_CONTRACT_URL_ENTRIES: { key: string; label: string; url: string }[] = [
  ...contractDocument.access.service_url_entries,
];
export const SERVICE_CONTRACT_HOSTS: Record<string, string> = { ...contractDocument.hosts };
/** Loopback hosts a local RPC server accepts from browsers (client_key_auth.local_rpc, K7). */
export const LOCAL_RPC_LOOPBACK_HOSTS: string[] = contractDocument.client_key_auth.local_rpc.loopback_hosts
  .map((hostKey) => SERVICE_CONTRACT_HOSTS[hostKey])
  .filter((host): host is string => typeof host === 'string' && host !== '');
/** The client-key (K3) signature profile: headers, canonical fields, limits (client_key_auth). */
export const CLIENT_KEY_AUTH = contractDocument.client_key_auth;
/** The word-batch TTS engine: the one engine of tts_runtime_plan word_batch (equal in every mode). */
export const TTS_WORD_BATCH_ENGINE: string = contractDocument.tts_runtime_plan.cpu.word_batch[0];
/** Rejection codes of client-key verification (client_key_auth.error_codes). */
export const CLIENT_KEY_ERROR_CODES: string[] = [...contractDocument.client_key_auth.error_codes];
/** Rejection codes of the local RPC browser gate (client_key_auth.local_rpc.error_codes, K7). */
export const LOCAL_RPC_ERROR_CODES = { ...contractDocument.client_key_auth.local_rpc.error_codes };
export const SERVICE_CONTRACT_SERVICE_HOST_KEYS: Record<string, string[]> = Object.fromEntries(
  Object.entries(contractDocument.access.service_host_keys).map(([service, keys]) => [service, [...keys]]),
);
