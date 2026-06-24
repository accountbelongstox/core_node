
import { LucideIcon } from "lucide-react";

export type Language = 'en' | 'zh';
export type Theme = 'light' | 'dark';
export type LayoutMode = 'vertical' | 'horizontal';

export enum ViewType {
  DASHBOARD = 'dashboard',
  MEDIA_BROWSER = 'media',
  CODE_BROWSER = 'code',
  TOOLS = 'tools',
  API_TESTER = 'api',
  SETTINGS = 'settings',
  SYSTEM_INFO = 'system',
  VOCABULARY = 'vocabulary',
  MCP_MANAGER = 'mcp',
  /** Unified Task Center (scheduler + queue + workers tabs). */
  TASK_CENTER = 'task_center',
  /** Legacy deep-link values — both render TaskCenter on a specific tab. */
  OCTANE_TASKS = 'octane',
  GLOBAL_TASKS = 'global_tasks',
  SERVER_MANAGER = 'server',
  AI_TOOLS = 'ai_tools',
  /** AI Management — laravel_main's unified AI gateway (provider grid, live
   *  rate/quota meters, gateway records, chat test). */
  AI_MANAGEMENT = 'ai_management',
  /** AI Dev History — extracted Claude/Codex/Gemini/Cursor prompts & sessions. */
  DEV_HISTORY = 'dev_history',
  INVITE_CODE_MANAGER = 'invite_codes',
  /** Database Viewer was merged into DATABASE_MANAGER (Tables tab); the old
   *  #/db-viewer slug deep-links there via core/routing/viewRoute.ts. */
  DATABASE_MANAGER = 'db_manager',
  /** Movies & Books was merged into the Media hub (MEDIA_BROWSER); kept only as a
   *  legacy deep-link alias (#/movies-books) — see core/routing/viewRoute.ts. */
  MOVIES_BOOKS = 'movies_books'
}

export interface NavItem {
  id: ViewType;
  icon: LucideIcon;
  labelKey: string;
}

export interface FileNode {
  id: string;
  name: string;
  // 'directory' is the live shape returned by server-manager /files/browse
  // (normalized in ServerManagerV1API.browseFiles); 'folder' is the legacy
  // static-resources tree literal.
  type: 'folder' | 'file' | 'directory';
  /** Real filesystem path from the browse payload (server-manager browsers). */
  path?: string;
  /** Raw directory flag carried through from the browse payload. */
  is_directory?: boolean;
  fileType?: 'video' | 'audio' | 'image' | 'code' | 'text' | 'pdf' | 'epub' | 'markdown' | 'doc' | 'unknown';
  size?: string | number;
  date?: string;
  children?: FileNode[];
  isOpen?: boolean;
}

export interface FileTreeResponse {
  items: FileNode[];
  path: string;
  realPath: string;
}

export interface StaticFileContent {
  content: string;
  isText: boolean;
  mimeType: string;
  extension: string;
  size: number;
  modified: string;
}

export type ToolStatus = 'available' | 'todo' | 'beta';

export interface ToolItem {
  id: string;
  name: string;
  description?: string;
  status: ToolStatus;
}

export interface ToolCategory {
  id: string;
  name: string;
  icon: LucideIcon;
  tools: ToolItem[];
}

export interface ApiParam {
  name: string;
  type: 'string' | 'integer' | 'boolean' | 'file' | 'array' | 'numeric' | 'email';
  required: boolean;
  description?: string;
  options?: string[]; // For enums
  default?: any;
  /** True when the param is a {placeholder} in the endpoint path — it must be URL-substituted, never sent as query/body. */
  path?: boolean;
}

export interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ANY';
  path: string;
  description: string;
  section?: string; // e.g. "System", "Auth", "ITTools - Crypto"
  params?: ApiParam[];
}

export interface AudioSegment {
  id: string;
  text: string;
  duration: number; // in seconds
  src?: string; // URL to audio file (optional for mock)
}

export interface TaskItem {
  id: string;
  title: string;
  size: string;
  date: string;
  status: 'idle' | 'queued' | 'processing' | 'done';
  promptText: string;
  audioSegments: AudioSegment[];
}

// Tool System Types
export type ToolExecutionMode = 'local' | 'cloud';

export interface ToolConfig {
  toolId: string;
  apiUrl: string;
  apiKey?: string;
  mode: ToolExecutionMode;
}

// Universal Tool UI Schema
export type InputType = 'text' | 'number' | 'textarea' | 'select' | 'file' | 'color' | 'checkbox' | 'datetime';

export interface ToolInput {
  id: string;
  label: string;
  type: InputType;
  placeholder?: string;
  defaultValue?: any;
  options?: { label: string; value: string }[]; // For select
  accept?: string; // For file
}

export interface ToolAction {
  id: string;
  label: string;
  icon?: any; // LucideIcon name or reference logic
  apiPath?: string;
}

export interface ToolOutput {
  id: string;
  label: string;
  type: 'text' | 'json' | 'image-preview' | 'download' | 'html' | 'markdown';
}

export interface ToolUISchema {
  id: string;
  title: string;
  description: string;
  inputs: ToolInput[];
  actions: ToolAction[];
  outputs: ToolOutput[];
}

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    statusCode?: number;
    latency?: number;
    dataSource?: 'cloud' | 'mock';
}

// --- Domain Models ---

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Screenshot {
  id: string;
  file_path: string;
  original_name: string;
  mime_type: string;
  description?: string;
  created_at: string;
}

export interface ClipboardData {
    text: string;
    files: Array<{
        id: string;
        original_name: string;
        size: number;
    }>;
    updated_at: string;
    namespace?: string;
    history?: ClipboardHistory[];
    file_count?: number;
    total_size?: number;
}

// ========== System Information Types ==========
export interface SystemInfo {
  server: ServerInfo;
  php: PhpInfo;
  laravel: LaravelInfo;
  database: DatabaseInfo;
  cache: CacheInfo;
  queue: QueueInfo;
  environment: EnvironmentInfo;
  routes: RouteInfo[];
  timestamp: string;
}

export interface ServerInfo {
  os: string;
  architecture: string;
  hostname: string;
  server_software: string;
  server_protocol: string;
  document_root: string;
  server_admin?: string;
  server_signature?: string;
}

export interface PhpInfo {
  version: string;
  extensions: string[];
  memory_limit: string;
  max_execution_time: string;
  upload_max_filesize: string;
  post_max_size: string;
  display_errors: boolean;
  error_reporting: string;
  timezone: string;
}

export interface LaravelInfo {
  version: string;
  environment: string;
  debug_mode: boolean;
  app_url: string;
  app_name: string;
  timezone: string;
  locale: string;
  fallback_locale: string;
  config_cached: boolean;
  routes_cached: boolean;
  events_cached: boolean;
  views_cached: boolean;
}

export interface DatabaseInfo {
  default_connection: string;
  connections: DatabaseConnection[];
}

export interface DatabaseConnection {
  name: string;
  driver: string;
  host: string;
  port: number;
  database: string;
  username: string;
  prefix?: string;
  charset?: string;
  collation?: string;
  connected: boolean;
}

export interface CacheInfo {
  default_driver: string;
  stores: CacheStore[];
}

export interface CacheStore {
  name: string;
  driver: string;
  connection?: string;
  available: boolean;
}

export interface QueueInfo {
  default_connection: string;
  connections: QueueConnection[];
}

export interface QueueConnection {
  name: string;
  driver: string;
  queue?: string;
  retry_after?: number;
  running: boolean;
}

export interface EnvironmentInfo {
  app_env: string;
  app_debug: boolean;
  app_key_set: boolean;
  [key: string]: any;
}

export interface RouteInfo {
  method: string;
  uri: string;
  name?: string;
  action: string;
  middleware: string[];
}

// ========== Vocabulary Learning Types ==========
export interface TranslationRequest {
  text: string;
  source_language?: string;
  target_language: string;
  type?: TranslationType;
}

export type TranslationType = 'general' | 'learning' | 'technical' | 'casual';

export interface TranslationResponse {
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  detected_language?: string;
  confidence?: number;
  alternatives?: string[];
  phonetic?: string;
  provider?: string;
}

export interface BatchTranslationRequest {
  texts: string[];
  source_language?: string;
  target_language: string;
  type?: TranslationType;
}

export interface BatchTranslationResponse {
  translations: TranslationResponse[];
  total_count: number;
  success_count: number;
  failed_count: number;
}

export interface LanguageDetectionResponse {
  detected_language: string;
  confidence: number;
  all_detections: Array<{
    language: string;
    confidence: number;
  }>;
}

export interface LanguageInfo {
  code: string;
  name: string;
  native_name: string;
  direction?: 'ltr' | 'rtl';
  supported?: boolean;
}

export interface TTSGenerateRequest {
  text: string;
  language: string;
  voice_type?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
}

export interface TTSGenerateResponse {
  audio_url: string;
  duration: number;
  format: string;
  file_size: number;
  text: string;
  language: string;
  voice_type: string;
  cache_hit: boolean;
}

export interface VocabularyTask {
  id: string;
  title: string;
  description?: string;
  words: VocabularyWord[];
  status: 'pending' | 'in_progress' | 'completed';
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface VocabularyWord {
  id: string;
  word: string;
  translation: string;
  phonetic?: string;
  part_of_speech?: string;
  definition?: string;
  example_sentences?: string[];
  audio_url?: string;
  learned: boolean;
  proficiency?: number;
}

/** Pagination object returned by vocabulary/statistics with include_words=1 */
export interface VocabularyWordsPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  has_more: boolean;
}

/** Per-language row from GET /vocabulary/statistics. Translation/validity/coverage
 *  fields are sourced from the canonical dictionary table tts_cache_{lang}. */
export interface VocabularyLanguageStat {
  language: string;
  language_code?: string;
  total_words: number;        // sum of library word counts (counts duplicates)
  libraries_count: number;
  dictionary_words?: number;  // distinct canonical words in the dictionary
  with_translation?: number;
  without_translation?: number;
  valid_words?: number;
  invalid_words?: number;      // only rows explicitly flagged invalid
  validity_checked?: number;
  validity_unchecked?: number;
  tts_percentage?: number;
  images_percentage?: number;
  review_percentage?: number;
}

/** Summary block from GET /vocabulary/statistics. */
export interface VocabularyStatisticsSummary {
  total_languages: number;
  total_libraries: number;
  total_words: number;
  total_dictionary_words?: number;
  total_with_translation?: number;
  total_without_translation?: number;
  total_valid_words?: number;
  total_invalid_words?: number;
  total_validity_checked?: number;
  tts_percentage?: number;
}

export interface VocabularyStatistics {
  summary: VocabularyStatisticsSummary;
  languages: VocabularyLanguageStat[];
}

/** Single word row from vocabulary statistics word list API */
export interface VocabularyStatisticsWordRow {
  id?: number;
  library_id?: number;
  library_name?: string;
  language?: string;
  index?: number;
  word: string;
  translations?: string[] | null;
  us_phonetic?: string | null;
  uk_phonetic?: string | null;
  [key: string]: any;
}

// ========== MCP Manager Types ==========
export interface ScreenshotMetadata {
  device?: string;
  browser?: string;
  viewport?: {
    width: number;
    height: number;
  };
  url?: string;
  title?: string;
  [key: string]: any;
}

export interface ScreenshotUploadRequest {
  image: File;
  description?: string;
  tags?: string[];
  metadata?: ScreenshotMetadata;
}

export interface ScreenshotUploadResponse {
  success: boolean;
  screenshot: Screenshot;
  message?: string;
}

export interface ScreenshotSearchRequest {
  keyword?: string;
  tags?: string[];
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface ScreenshotSearchResponse {
  screenshots: Screenshot[];
  total_count: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface ScreenshotStats {
  total_count: number;
  total_size: number;
  today_count: number;
  week_count: number;
  month_count: number;
  by_mime_type: Array<{
    mime_type: string;
    count: number;
  }>;
  recent_uploads: Screenshot[];
}

export interface TaskCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  file_count: number;
  created_at: string;
}

export interface DispatchTask {
  id: string;
  category_id: string;
  file_path: string;
  original_name: string;
  content?: string;
  status: TaskStatus;
  priority?: number;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  metadata?: TaskMetadata;
}

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface TaskMetadata {
  file_size?: number;
  file_type?: string;
  source?: string;
  notes?: string;
  [key: string]: any;
}

export interface AddTaskRequest {
  category_id: string;
  content: string;
  file_name?: string;
  priority?: number;
  metadata?: TaskMetadata;
}

export interface TaskQueueStats {
  category_id: string;
  total_tasks: number;
  pending_tasks: number;
  processing_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  average_completion_time?: number;
  oldest_pending_task?: DispatchTask;
}

export interface PlaceholderGenerateRequest {
  width: number;
  height: number;
  text?: string;
  bg_color?: string;
  text_color?: string;
  format?: 'png' | 'jpg' | 'svg' | 'webp';
  mode?: 'simple' | 'real';
}

export interface PlaceholderResponse {
  uuid: string;
  url: string;
  download_url: string;
  width: number;
  height: number;
  format: string;
  file_size: number;
  text?: string;
  created_at: string;
  expires_at?: string;
}

export interface VoiceQueueItem {
  id: string;
  type: 'text' | 'url' | 'voice';
  content: string;
  language: string;
  status: 'queued' | 'processing' | 'playing' | 'completed' | 'error';
  audio_url?: string;
  subtitle_segments?: SubtitleSegment[];
  duration?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface SubtitleSegment {
  id: string;
  start_time: number;
  end_time: number;
  text: string;
  translation?: string;
  active?: boolean;
}

// ========== Octane Tasks Types ==========
export interface OctaneTasksStatus {
  timer_enabled: boolean;
  timer_running: boolean;
  total_tasks: number;
  running_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_ticks: number;
  uptime: number;
  last_tick_at?: string;
  next_tick_at?: string;
}

export type OctaneTaskStatus = 'idle' | 'running' | 'completed' | 'failed' | 'disabled';

export interface OctaneTask {
  name: string;
  class: string;
  status: OctaneTaskStatus;
  schedule: string;
  last_run_at?: string;
  next_run_at?: string;
  run_count: number;
  success_count: number;
  failure_count: number;
  average_duration?: number;
  last_duration?: number;
  last_error?: string;
  enabled: boolean;
  metadata?: OctaneTaskMetadata;
}

export interface OctaneTaskMetadata {
  description?: string;
  priority?: number;
  timeout?: number;
  retry_on_failure?: boolean;
  max_retries?: number;
  [key: string]: any;
}

// ========== Clipboard Extended Types ==========
export interface ClipboardHistory {
  id: string;
  timestamp: string;
  text: string;
  file_count: number;
}

export interface ClipboardFile {
  id: string;
  original_name: string;
  size: number;
  mime_type?: string;
  file_path?: string;
  uploaded_at?: string;
  download_url?: string;
}

// ========== UI State Types ==========
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: LoadingState;
}

export interface PaginationInfo {
  current_page: number;
  per_page: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
}

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

export interface SystemInfo {
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
  lines: number;
  encoding: string;
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

export interface UnifiedApp {
  app_name: string;
  app_path: string;
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
  service_status?: {
    service_name: string;
    active: boolean;
    status: string;
    since?: string;
  };
  process_info?: {
    running: boolean;
    pids: string[];
    count: number;
  };
  port_info?: {
    expected_port: number;
    listening: boolean;
    port?: number;
  };
  overall_status: 'running' | 'stopped' | 'failed';
}

export interface CertbotStatus {
  installed: boolean;
  version?: string;
  path?: string;
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
