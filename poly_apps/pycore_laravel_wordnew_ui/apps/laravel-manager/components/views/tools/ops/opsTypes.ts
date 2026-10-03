/** Backend payload shapes read by the ops workbenches (verified against the Laravel controllers). */

export interface TranslationLanguage {
  code: string;
  name: string;
  native_name: string;
}

/** AppQyV1TranslationController::translate: `data` of the success envelope. */
export interface TranslateData {
  success?: boolean;
  error?: string;
  translation?: string;
  translated_text?: string;
  source_text?: string;
  provider?: string;
  model?: string;
  cached?: boolean;
}

/** AppQyV1TTSController::getOptions. */
export interface TtsOptionsData {
  languages: string[];
  voices: Record<string, string>;
  speed?: { min: number; max: number; step: number; default: number; unit: string };
}

/** AppQyV1TTSController::generate: a ready file or a queued task. */
export interface TtsGenerateData {
  cached?: boolean;
  queued?: boolean;
  audio_url?: string;
  audio_path?: string | null;
  task_id?: number | string | null;
  status?: string;
  message?: string;
}

/** McpV1OCRCtl::getEngines (OcrRecognizeTask::describe). */
export interface OcrEnginesData {
  model_types?: string[];
  image_max_bytes?: number | null;
  required_compute?: string | null;
}

/** OCR answer: the pycore recognize payload once completed, else a queued task view. */
export interface OcrRecognizeData {
  success?: boolean;
  error?: string;
  text?: string;
  engine?: string;
  latency_ms?: number;
  model_type?: string;
  task_id?: string;
  pycore_task?: { task_id: string; status: string };
}

export interface PromptMappingsData {
  mappings: Record<string, unknown>;
  total: number;
}

export interface TaskCategory {
  id: string;
  name?: string;
}

export interface AiProviderRow {
  name: string;
  configured: boolean;
  available: boolean;
  image: boolean;
  image_ready?: boolean;
  image_model?: string;
}

export interface AiCatalogData {
  providers?: AiProviderRow[];
}

export interface AiImageData {
  success: boolean;
  provider: string;
  model: string;
  image_base64: string;
  mime: string;
  latency_ms: number | null;
  error: string | null;
}

export interface LibraryRow {
  id: number;
  name: string;
  description?: string | null;
  word_count: number;
  language?: string | null;
  difficulty?: string;
  category?: string;
  image_url?: string | null;
  cover_url?: string | null;
  cover_status?: string;
  is_recommended?: boolean;
  tags?: string[];
}

export interface Pagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
  has_more: boolean;
}

export interface LibrariesData {
  libraries: LibraryRow[];
  pagination: Pagination;
}

export interface LibraryWord {
  index: number;
  word: string;
  md5?: string;
  translations?: unknown;
  phonetic?: string | null;
  us_phonetic?: string | null;
  uk_phonetic?: string | null;
  audio_url?: string | null;
  has_translation?: boolean;
  has_audio?: boolean;
  has_image?: boolean;
  is_valid?: boolean;
}

export interface LibraryWordsData {
  library: { id: number; name: string; total_words: number; language?: string | null };
  words: LibraryWord[];
  stats: { total: number; translated: number; with_audio: number; with_image: number; invalid: number };
  pagination: Pagination;
}

export interface TtsFileRef {
  url?: string;
  path?: string;
}

/** AppQyV1LearningController::getWordCards: one card per learning-progress row. */
export interface LearningCard {
  id: number;
  word: string;
  word_md5: string;
  learning_status?: string | null;
  familiarity_level?: number | null;
  review_count?: number | null;
  correct_count?: number | null;
  wrong_count?: number | null;
  native_translation?: unknown;
  translations?: unknown;
  phonetic?: string | null;
  us_phonetic?: string | null;
  uk_phonetic?: string | null;
  tts_files?: TtsFileRef[];
  next_review_at?: string | null;
}

export interface LearningWordsData {
  words: LearningCard[];
  total: number;
  lang_code: string;
  message?: string;
}

export interface SystemInfoData {
  basic_info?: { hostname?: string; operating_system?: string; php_version?: string; laravel_version?: string; server_time?: string; timezone?: string; uptime?: string };
  laravel_info?: {
    environment?: string;
    debug_mode?: boolean;
    app_url?: string;
    app_name?: string;
    locale?: string;
    cache_info?: { config_cached?: boolean; routes_cached?: boolean; events_cached?: boolean; views_cached?: boolean };
  };
  php_config?: {
    version?: string;
    memory_limit?: string;
    max_execution_time?: string;
    upload_max_filesize?: string;
    post_max_size?: string;
    timezone?: string;
    extensions?: string[];
  };
  hardware_info?: {
    cpu_info?: { model?: string; cores?: number };
    memory_info?: { total?: number; free?: number; available?: number; used?: number };
    load_average?: number[];
  };
  network_info?: { interfaces?: string[]; hostname?: string; dns_servers?: string[] };
  directory_status?: Record<string, { path: string; exists: boolean; readable: boolean; writable: boolean; size: number }>;
  service_status?: Record<string, { name: string; active?: boolean; enabled?: boolean; installed?: boolean; version?: string }>;
}

export interface StorageData {
  disk_usage?: Array<{ filesystem: string; size: string; used: string; available: string; use_percent: string; mounted_on: string }>;
}

export interface ServiceRow {
  name: string;
  active: boolean;
  enabled: boolean;
  status?: string;
  pid?: number | null;
  memory?: string | null;
  uptime?: string | null;
}

export interface ServicesData {
  system_services?: Record<string, ServiceRow>;
  octane_services?: Record<string, ServiceRow>;
  application_services?: Record<string, ServiceRow>;
  summary?: {
    system_running: number;
    system_total: number;
    octane_running: number;
    octane_total: number;
    apps_running: number;
    apps_total: number;
  };
}

export interface ProcessRow {
  user: string;
  pid: number;
  cpu: number;
  memory: number;
  command: string;
}

export interface ProcessesData {
  processes: ProcessRow[];
  total_count: number;
}

export interface NginxSiteRow {
  site_name: string;
  domain: string;
  site_type: string;
  www_dir: string;
  config_path: string;
  listen_ports?: string[];
  server_names?: string[];
  ssl_enabled: boolean;
  enabled: boolean;
  proxy_pass?: string | null;
  modified_human?: string;
  cert_expiry?: { expires_at: string; days_left: number } | null;
}

export interface NginxSitesData {
  sites: NginxSiteRow[];
  total_sites: number;
  enabled_sites: number;
  disabled_sites: number;
}

export interface NginxConfigData {
  site_name: string;
  enabled: boolean;
  config_file: string;
  content: string;
  size: number;
  lines: number;
  modified_human?: string;
}

export interface NginxTestData {
  valid: boolean;
  output: string;
  error: string;
  exit_code: number;
}

export interface NginxReloadData {
  reloaded: boolean;
  output: string;
  error: string;
  test_output: string;
}

export interface CertificateRow {
  name: string;
  domain: string;
  domains: string[];
  expiry_date?: string | null;
  days_until_expiry: number;
  status: 'ok' | 'warning' | 'critical';
  issuer?: string | null;
  certificate_path?: string;
  manager?: string;
}

export interface CertificatesData {
  certificates: CertificateRow[];
  total_certificates: number;
  manager?: string;
  error?: string;
}

export interface CertEnsureData {
  status?: string;
  request_id?: string;
  command?: string;
  cert_exists?: boolean;
  output_lines?: string[];
  manager?: string;
}

export interface CertProgressData {
  status: string;
  command?: string;
  output_lines?: string[];
}

export interface ScriptRow {
  id: number;
  name: string;
  category: string;
  description: string;
  command: string;
  timeout: number;
  requires_sudo: boolean;
}

export interface ScriptsData {
  scripts: ScriptRow[];
  total_scripts: number;
}

export interface ScriptRunData {
  execution_id: string;
  script_id: number;
  script_name: string;
  command: string;
  success: boolean;
  output: string;
  error_output: string;
  exit_code: number;
  execution_time: number;
  timeout_reached?: boolean;
  started_at: string;
  completed_at: string;
}

export interface VoiceTtsFile {
  file_path?: string;
  text?: string;
  language?: string;
  voice?: string;
}

/** SubtitleQueueManager item as the queue and current routes return it. */
export interface VoiceQueueItem {
  id: string;
  type: string;
  original_text?: string;
  translated_text?: string;
  language?: string;
  voice?: string;
  group?: string;
  target_language?: string;
  play_count?: number;
  added_at?: string;
  created_at?: string;
  tts_files?: VoiceTtsFile[];
}

export interface VoiceQueueData {
  all_queue: VoiceQueueItem[];
  queue_length: number;
  total_length: number;
  current_index: number;
  play_mode?: string;
}

export interface VoiceCurrentData {
  current: VoiceQueueItem | null;
  current_index?: number;
}

export interface VoiceTaskStep {
  label?: string;
  status: string;
  message?: string | null;
}

export interface VoiceTask {
  id: string;
  status: string;
  progress?: number;
  error?: string | null;
  steps?: Record<string, VoiceTaskStep>;
  payload?: { input_reference?: string | null };
  result?: { item?: VoiceQueueItem | null } | null;
  created_at?: string;
}

export interface VoiceTaskData {
  task: VoiceTask;
}

export interface VoiceTasksData {
  tasks: VoiceTask[];
}

export interface VoiceLanguage {
  code: string;
  name: string;
  native_name: string;
  voice_id: string;
}

export interface VoiceLanguagesData {
  languages: VoiceLanguage[];
}

export interface VoiceGroupsData {
  groups: string[];
}

export interface VoiceAddData {
  task_id: string;
  task: VoiceTask;
  queue_length: number;
}
