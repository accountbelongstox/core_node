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

export const LOOPBACK_HOST: string = contractDocument.hosts.loopback;
export const BIND_ANY_HOST: string = contractDocument.hosts.any;
export const LARAVEL_API_BACKEND_PORT: number = contractDocument.ports.laravel_api_backend;
export const NEXUS_DASH_FRONTEND_PORT: number = contractDocument.ports.nexus_dash_frontend;
export const LARAVEL_API_BACKEND_URL = `http://${LOOPBACK_HOST}:${LARAVEL_API_BACKEND_PORT}`;
export const NEXUS_DASH_FRONTEND_URL = `http://${LOOPBACK_HOST}:${NEXUS_DASH_FRONTEND_PORT}`;
export const CORE_NODE_DATA_DIR_POSIX: string = contractDocument.paths.core_node_data_dir_posix;
export const CORE_NODE_DATA_DIR_WINDOWS_SUBPATH: string = contractDocument.paths.core_node_data_dir_windows_subpath;
export const GLOBAL_VAR_DIR_NAME: string = contractDocument.paths.global_var_dir_name;
export const FRANKENPHP_ROOT_POSIX: string = contractDocument.paths.frankenphp_root_posix;
export const UI_ALLOWED_HOSTS_FILE_NAME: string = contractDocument.files.ui_allowed_hosts;
export const UI_DOMAIN_CONFIG_FILE_NAME: string = contractDocument.files.ui_domain_config;
export const MERCURE_COOKIE_NAME: string = contractDocument.realtime.mercure_cookie;
export const MERCURE_TRANSPORT_NAME: string = contractDocument.realtime.mercure_transport;
