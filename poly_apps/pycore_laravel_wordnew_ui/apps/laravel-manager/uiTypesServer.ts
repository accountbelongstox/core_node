// ========== ServerManager Types ==========
export interface NginxSite {
  site_name: string;
  domain: string;
  enabled: boolean;
  site_type: 'laravel' | 'static' | 'proxy' | 'nuxt';
  www_dir: string;
  php_mode: 'fpm' | 'swoole';
  swoole_port?: number;
  ssl_enabled: boolean;
  ssl_certificate?: string;
  ssl_certificate_key?: string;
  config_path: string;
  created_at: string;
  updated_at: string;
  listen_ports?: number[];
  server_names?: string[];
  config_type?: string;
  modified_human?: string;
  cert_expiry?: { expires_at: string; days_left: number } | null;
}

export interface NginxSiteConfig {
  site_name: string;
  config: string;
  path: string;
  /** Some backend versions return the file body as `content` instead of `config`. */
  content?: string;
}

export interface FrankenPhpSite {
  site_name: string;
  domain: string;
  hosts: string[];
  upstreams: string[];
  upstream?: string | null;
  certificate_domain?: string | null;
  enabled: boolean;
  managed_by: string;
  config_path: string;
  content: string;
  size: number;
  updated_at?: string | null;
}

export interface FrankenPhpSiteRequest {
  site_name: string;
  hosts: string[];
  upstream: string;
  certificate_domain: string;
  enabled?: boolean;
  site_config?: string;
}

export interface FrankenPhpStatusOverview {
  installed: boolean;
  binary: string | null;
  version: string | null;
  embedded_php: string | null;
  running: boolean;
  runtime: {
    service: string;
    active_state: string;
    sub_state: string;
    main_pid: number;
    running: boolean;
  };
  sites: { directory: string; total: number; enabled: number };
  dns01: {
    manager: string;
    module: boolean;
    token_configured: boolean;
    ready: boolean;
  };
  certificate_manager: CertbotStatus;
  caddyfile: { path: string; exists: boolean; canonical: boolean };
  mercure: {
    publisher_key_provisioned: boolean;
    subscriber_key_provisioned: boolean;
    trusted_issuers_provisioned: boolean;
    hub_path: string;
  };
}

export interface NginxSiteCreateRequest {
  site_name: string;
  domain: string;
  site_type: 'laravel' | 'static' | 'proxy' | 'swoole';
  config?: {
    www_dir: string;
    php_version?: string;
    php_mode?: 'php-fpm' | 'swoole' | 'none';
    swoole_port?: number;
    proxy_target?: string;
  };
  ssl_enabled?: boolean;
  auto_ssl?: boolean;
  dns_provider?: 'dnspod' | 'cloudflare' | 'none';
}

export interface NginxSiteUpdateRequest {
  site_config: string;
}

export interface NginxTestResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface NginxReloadResponse {
  success: boolean;
  message: string;
}

export type NginxServiceAction = 'start' | 'stop' | 'restart' | 'reload';

export interface NginxStatusOverview {
  installed: boolean;
  binary: string | null;
  version: string | null;
  running: boolean;
  process_count: number;
  service_manager: 'systemctl' | 'service' | null;
  config_test: { valid: boolean; output: string } | null;
  sites: { total: number; enabled: number; disabled: number };
  paths: { config_path: string; enabled_path: string; backup_path: string };
  install_hint: string | null;
}

export interface NginxServiceResult {
  action: NginxServiceAction;
  executed_via: string;
  success: boolean;
  output: string;
  error: string | null;
}

export interface NginxLogsResponse {
  type: 'access' | 'error';
  file: string;
  exists: boolean;
  lines: string[];
  size_bytes: number;
  /** Present when a keyword filter was applied server-side. */
  filter?: string | null;
  /** How many raw lines were scanned to produce the filtered result. */
  scanned_lines?: number;
}

export interface NginxInstallResult {
  installed: boolean;
  already_installed: boolean;
  version: string | null;
  output?: string;
  exit_code?: number;
}

export interface NginxBackup {
  file: string;
  site: string;
  type: 'update' | 'delete';
  size_bytes: number;
  created_at: string;
}

export interface NginxBackupRestoreResult {
  restored: boolean | string;
  site: string;
  config_file: string;
  previous_backup: string | null;
  config_test: { valid: boolean; output: string } | null;
}

export interface NginxMainConfig {
  file: string;
  exists: boolean;
  content: string;
  truncated: boolean;
  conf_d: { file: string; size_bytes: number }[];
  parsed: {
    worker_processes: string | number | null;
    worker_connections: string | number | null;
    includes: string[];
  };
}

export interface NginxPortCheck {
  port: number;
  in_use: boolean;
  holder: string | null;
  is_nginx: boolean;
}

export interface NginxMetrics {
  available: boolean;
  stub_status: {
    active_connections: number;
    accepts: number;
    handled: number;
    requests: number;
    reading: number;
    writing: number;
    waiting: number;
  } | null;
  hint?: string | null;
  processes: { pid: number; rss_kb: number; cpu: number }[];
  totals: { memory_kb: number; cpu_percent: number };
}

export type NginxBatchAction = 'enable' | 'disable' | 'test';

export interface NginxBatchResult {
  action: NginxBatchAction;
  results: { site: string; success: boolean; message: string }[];
  succeeded: number;
  failed: number;
}

export interface SSLCertificate {
  domain: string;
  expiry_date: string;
  days_until_expiry: number;
  status: 'ok' | 'warning' | 'critical';
  certificate_path?: string;
  key_path?: string;
  /** Full SAN list covered by this certificate. */
  domains?: string[];
}

export interface DnsProviderStatus {
  provider: string;
  manager?: 'certbot' | 'acme.sh';
  configured: boolean;
  email?: string | null;
  api_id?: string | null;
  token_configured: boolean;
}

export interface SSLCertificateGenerateRequest {
  domain: string;
  provider?: 'dnspod' | 'cloudflare';
  staging?: boolean;
}

export interface SystemServiceStatus {
  name: string;
  status: 'running' | 'stopped' | 'failed';
  active: boolean;
  enabled?: boolean;
  since?: string;
  status_output?: string;
}

export interface ServerRuntimeSystemInfo {
  cpu: {
    usage: number;
    cores: number;
    model: string;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    percentage: number;
  };
  services: SystemServiceStatus[];
}

export interface SystemProcess {
  pid: string;
  user: string;
  cpu: number;
  memory: number;
  command: string;
}

export interface SystemStorage {
  filesystem: string;
  size: string;
  used: string;
  available: string;
  use_percent: string;
  mounted_on: string;
}

export interface StaticResourceTypeBucket {
  count: number;
  size_bytes: number;
  size_human: string;
}

export interface StaticResourceSubdir {
  path: string;
  label: string;
  exists: boolean;
  files: number;
  size_bytes: number;
  size_human: string;
}

export interface DataDirBreakdownItem {
  key: string;
  label: string;
  path: string;
  exists: boolean;
  size_bytes: number;
  size_human: string;
}

export interface StaticResourceFileEntry {
  name: string;
  path: string;
  size_bytes: number;
  size_human: string;
  modified: string;
  extension: string;
}

export interface StaticResourceFileList {
  path: string;
  exists: boolean;
  total: number;
  page: number;
  per_page: number;
  total_pages?: number;
  sort: string;
  order: string;
  q: string;
  files: StaticResourceFileEntry[];
}

export interface StaticResourcesSummary {
  base_path: string;
  exists: boolean;
  total_size_bytes: number;
  total_size_human: string;
  total_files: number;
  total_directories: number;
  truncated?: boolean;
  by_type: Record<string, StaticResourceTypeBucket>;
  by_subdirectory: StaticResourceSubdir[];
  laravel_data_dir: string;
  laravel_data_dir_size_bytes: number;
  laravel_data_dir_size_human: string;
  static_percent_of_data_dir: number;
  data_dir_breakdown?: DataDirBreakdownItem[];
  data_dir_accounted_bytes?: number;
  data_dir_accounted_human?: string;
  data_dir_unaccounted_bytes?: number;
  data_dir_unaccounted_human?: string;
  disk_usage?: SystemStorage[];
}

export interface SystemStorageAnalysis {
  disk_usage: SystemStorage[];
  directory_sizes?: Record<string, { path: string; size_bytes: number; size_human: string }>;
  database_info?: Record<string, unknown>;
  log_sizes?: Record<string, unknown>;
}

export interface ServerFileNode {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  permissions?: string;
  modified?: string;
  path: string;
}

export interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  permissions: string;
  modified: string;
  owner: string;
  group: string;
}

export interface FilePreview {
  content: string;
  lines?: number;
  encoding?: string;
  truncated?: boolean;
  is_binary?: boolean;
}

export interface PredefinedScript {
  id: number;
  name: string;
  category: string;
  description?: string;
  command: string;
  timeout: number;
  requires_sudo: boolean;
}

export interface ScriptExecution {
  execution_id: string;
  script_name: string;
  output: string;
  execution_time: number;
  exit_code: number;
  started_at: string;
  completed_at?: string;
}

export interface ScriptExecutionRequest {
  script_id: number;
}

export type UnifiedAppType = 'ncoreApp' | 'pycoreApp' | 'polyApp';

export interface UnifiedApp {
  app_name: string;
  app_path: string;
  /** Backend scan category — required for /unified/status, start, stop, restart */
  type?: UnifiedAppType;
  service_name?: string;
  port?: number;
  status?: 'running' | 'stopped' | 'failed';
  nginx_proxy?: {
    configured: boolean;
    enabled: boolean;
    domains: string[];
    config_file?: string;
    proxy_target?: string;
  };
  service_status?: {
    installed: boolean;
    service_name: string;
    status: string; // running, stopped, failed, not_installed
    enabled: boolean;
    launcher_exists: boolean;
    launcher_path?: string;
    pid?: number;
    uptime?: string;
    memory?: string;
    cpu_usage?: string;
  };
}

export interface UnifiedAppDeployRequest {
  app_name: string;
  action: 'deploy' | 'start' | 'stop' | 'restart';
}

export interface UnifiedAppStatus {
  app_name: string;
  app_type?: UnifiedAppType;
  service_name?: string;
  service_status?: {
    installed?: boolean;
    status: string;
    enabled?: boolean;
    launcher_exists?: boolean;
    launcher_path?: string | null;
    pid?: number | null;
    uptime?: string | null;
  };
}

export interface CertbotStatus {
  installed: boolean;
  version?: string;
  path?: string;
  manager?: 'certbot' | 'acme.sh';
  timer?: {
    unit: string;
    active: boolean;
    enabled: boolean;
  };
}

export interface ApiInfoEndpoint {
  path: string;
  feature: string;
}

export interface ApiInfoParsedEndpoint {
  id: string;
  path: string;
  method: string;
  authType: string;
  description: string;
  controller?: string;
  params?: ApiInfoParam[];
  headers?: ApiInfoHeader[];
  response?: ApiInfoResponse[];
  tags?: string[];
}

export interface ApiInfoParam {
  name: string;
  type: string;
  requirement: 'required' | 'optional';
  example?: string;
}

export interface ApiInfoHeader {
  name: string;
  description?: string;
}

export interface ApiInfoResponse {
  name: string;
  type: string;
  description?: string;
}

export interface ApiInfo {
  app_name: string;
  api_version: string;
  app_description: string;
  base_url: string;
  api_prefix: string;
  endpoints: ApiInfoEndpoint[];
  cli_commands?: any[];
  supported_headers?: string[];
  authentication?: any;
}

export interface FullApiInfo {
  public_info: {
    framework: string;
    version: string;
    environment: string;
    [key: string]: any;
  };
  api_reference: {
    [appName: string]: ApiInfo;
  };
}

