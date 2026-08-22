/**
 * Pycore Service API types.
 */
import type { AiGatewayStatus, AiImageResponse } from './PycoreAiTypes';
import type { OcrStatus, SttStatus, TtsStatus } from './PycoreSpeechTypes';
import type { GlobalTaskStatusRecord } from '../../contracts/QueueCenterTypes';

export type { WordAudioSource, WordAudioStatus } from '../../contracts/wordAudio';

// --- Capability status (CUDA/compute + free libraries) ------------------- #
export interface CudaStatus {
  available: boolean;
  driver_version: string | null;
  cuda_version: string | null;
  gpu_count: number;
  gpus: { name: string; mem_total_mb: number | null }[];
  torch_installed: boolean;
  onnxruntime_installed: boolean;
}

export interface CapabilityLibrary {
  name: string;
  /** 'translate' | 'tts' | 'ocr' | 'stt'. */
  category: string;
  /** 'pip' = PyPI package; 'api' = local HTTP / in-process neural engine. */
  kind?: 'pip' | 'api';
  available: boolean;
  /** Prerequisites present (pip/staging); may differ from runtime-ready ``available``. */
  installed?: boolean;
  version: string | null;
  note: string;
  /** Max model/checkpoint when CUDA is available. */
  model_gpu?: string;
  /** Max model/checkpoint on CPU tier. */
  model_cpu?: string;
  /** Model/checkpoint selected for the current host. */
  model_active?: string;
  /** Primary env var for model override. */
  env?: string;
}

export interface ModelTierRow {
  engine: string;
  gpu: string;
  cpu: string;
  env?: string;
}

export interface CapabilityStatus {
  success: boolean;
  cuda: CudaStatus;
  libraries: CapabilityLibrary[];
  model_tiers?: ModelTierRow[];
  tts?: TtsStatus;
  stt?: SttStatus;
  ocr?: OcrStatus;
  ai_gateway?: AiGatewayStatus;
  error?: string;
}

// --- System info (read-only constants + static directories) -------------- #
export interface PycoreConstant {
  key: string;
  value: string;
  note: string;
}

export interface StaticDirectory {
  /** Registry key — the only thing the open endpoint accepts (allow-listed). */
  key: string;
  label: string;
  path: string;
  exists: boolean;
  note: string;
}

export interface SystemInfo {
  success: boolean;
  constants: PycoreConstant[];
  directories: StaticDirectory[];
  error?: string;
}

export interface OpenDirResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// --- Translation queue --------------------------------------------------- #
export interface TranslationQueueSummary {
  pending: number;
  processing: number;
  leased: number;
  completed: number;
  failed: number;
  total: number;
  missing_dictionary_words?: number;
}

export interface TranslationQueueItem {
  task_id: string;
  words: string[];
  word_count: number;
  language: string;
  target_language: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  created_at: string;
  age_seconds: number;
  assigned_to: string | null;
  recently_bumped: boolean;
}

export interface TranslationQueueResponse {
  summary: TranslationQueueSummary;
  items: TranslationQueueItem[];
  laravel_reachable: boolean;
  /** Whether pycore's live HTTP event source is connected. */
  event_connected?: boolean;
  event_count?: number;
  age_ms: number;
  error?: string;
}

export interface TranslationQueueActionResponse {
  success: boolean;
  task_id?: string;
  error?: string;
}

/** Pyctl TaskManager record returned by ui/task_center/get_local_task_detail. */
export interface LocalTaskDetail {
  task_id: string;
  task_type: string;
  status: string;
  progress: number;
  input_data: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  estimated_time?: number | null;
}

/**
 * Laravel global_tasks row consumed through the browser's Laravel API client.
 *
 * Field types come from the central task model. The list-row fallback used by
 * PcTranslationQueuePage can omit detail-only fields until the HTTP response
 * arrives, hence the partial tail rather than a second hand-written interface.
 */
export type PycoreGlobalTaskDetail = Pick<
  GlobalTaskStatusRecord,
  'task_id' | 'app_name' | 'task_type' | 'execution_type' | 'status' | 'progress' |
  'assigned_to' | 'created_at' | 'updated_at'
> & Partial<Omit<GlobalTaskStatusRecord,
  'task_id' | 'app_name' | 'task_type' | 'execution_type' | 'status' | 'progress' |
  'assigned_to' | 'created_at' | 'updated_at'
>>;

export interface LocalTaskDetailResponse {
  success: boolean;
  task?: LocalTaskDetail;
  error?: string;
}

export interface PycoreGlobalTaskDetailResponse {
  success: boolean;
  task?: PycoreGlobalTaskDetail;
  error?: string;
  laravel_reachable?: boolean;
}

// --- Pycore → Laravel queue capability control plane ---------------------- #
export interface AssistCapabilities {
  cover: boolean;
  tts: boolean;
  translation: boolean;
  /** AI-translation generation (distinct from draining the translation queue). */
  ai_translate?: boolean;
  /** Word-image generation. */
  image?: boolean;
  /** Sentence-level voice synthesis. */
  sentence_audio?: boolean;
  /** Subtitle search. */
  subtitle?: boolean;
  /** Speech-to-text. */
  stt?: boolean;
  /** Movie/TV poster — delegated to apps/mcp-chrome (Google Images). Optional —
   *  older backends omit it; treated as off until the field is present. */
  poster?: boolean;
}

export interface AssistConfig {
  enabled: boolean;
  capabilities: AssistCapabilities;
}

/** PATCH-style config update — only the provided fields change. */
export interface AssistConfigPatch {
  enabled?: boolean;
  capabilities?: Partial<AssistCapabilities>;
}

/** Per-poster_status distribution as observed Laravel-side by the assist
 *  worker (and surfaced in the assist snapshot's `poster` block). */
export interface AssistPosterCounts {
  pending: number; ready: number; failed: number; none: number;
  total: number; leased: number;
}

/** Laravel-side queue counts reported by the selected backend. */
export interface AssistLaravelStatus {
  cover?: {
    pending: number; retry: number; processing: number;
    ready: number; failed: number; total: number; leased: number;
  };
  tts?: {
    pending: number; processing: number; completed: number;
    failed: number; leased: number;
  };
  /** Movie/TV poster fetch counts (optional — present once the backend ships
   *  the poster assist capability). */
  poster?: AssistPosterCounts;
  lease_minutes?: number;
}

export interface AssistStatus {
  enabled: boolean;
  capabilities: AssistCapabilities;
  /** The Laravel endpoint used by task workers after a UI endpoint notification. */
  endpoint: { base_url: string; label?: string } | null;
  /** Whether at least one canonical capability worker is active. */
  running: boolean;
  /** Whether the dispatch-driven processor accepts tasks from the UI pump. */
  processor_enabled?: boolean;
  /** Circuit breaker: open = backed off after repeated failures. */
  circuit: { open: boolean; cooldown_s: number };
  counters: { claimed: number; submitted: number; released: number; failures: number };
  last_error: string | null;
  last_cycle_at: string | null;
  laravel_status: AssistLaravelStatus | null;
  /** Cached monitor reachability — avoids blocking resolve on status polls. */
  laravel_reachable?: boolean;
  error?: string;
}

export interface AssistConfigResponse {
  ok: boolean;
  config: AssistConfig;
  error?: string;
}

export interface AssistCycleResponse {
  ok: boolean;
  processed: number;
  submitted: number;
  released: number;
  errors: string[];
  error?: string;
}

// --- Google Translate (free googletrans status + translate + AI comparison) - #
export interface TranslateStatus {
  /** True when the free googletrans library is importable. */
  available: boolean;
  library: 'googletrans' | string;
  /** Best-effort installed version, or null when unknown. */
  version: string | null;
  service_url: string;
  cache_dir: string;
  /** Number of cached translation .json files on disk. */
  cache_count: number;
  recommended_version: string;
}
export interface TranslateResponse {
  translated_text?: string;
  src?: string;
  dest?: string;
  pronunciation?: string | null;
  from_cache?: boolean;
  provider: 'google';
  error?: string;
}
export interface TranslateAiResponse {
  translated_text?: string;
  provider: 'ai';
  model?: string | null;
  error?: string;
}

// --- Image search (SerpApi Google-Images + AI comparison + history) -------- #
export interface ImageSearchStatus {
  /** True when a SerpApi key is configured. */
  available: boolean;
  provider: 'serpapi' | string;
  engine: 'google_images' | string;
  service_url: string;
  key_name: string;
  history_count: number;
  default_num: number;
  max_num: number;
}
export interface ImageSearchResult {
  /** Full-resolution image URL (use directly in <img src>). */
  url: string;
  thumbnail?: string | null;
  title?: string | null;
  source?: string | null;
  /** Page the image was found on. */
  link?: string | null;
}
export interface ImageSearchResponse {
  provider: 'serpapi' | string;
  engine?: string;
  query?: string;
  count?: number;
  results: ImageSearchResult[];
  history_id?: string | null;
  error?: string;
}
/** A combined search + AI render for one query (the "evaluate alongside AI" view). */
export interface ImageSearchCompareResponse {
  query: string;
  search: {
    provider: string;
    engine?: string;
    count: number;
    results: ImageSearchResult[];
    error?: string | null;
  };
  ai: AiImageResponse;
}
/** The base64-free AI reference stored on a history record. */
export interface ImageSearchHistoryAiRef {
  provider?: string | null;
  model?: string | null;
  mime?: string | null;
}
export interface ImageSearchHistoryEntry {
  id: string;
  ts: number;
  iso: string;
  query: string;
  engine: string;
  country?: string | null;
  result_count: number;
  results: ImageSearchResult[];
  ai?: ImageSearchHistoryAiRef | null;
  origin: string;
}
export interface ImageSearchHistoryResponse {
  success: boolean;
  entries: ImageSearchHistoryEntry[];
}
export interface ImageSearchHistoryClearResponse {
  success: boolean;
  removed: number;
}
export interface ImageSearchHistoryDeleteResponse {
  success: boolean;
}

// --- Subtitle search (OpenSubtitles search + download + history) ----------- #
export interface SubtitleSearchStatus {
  /** True when an OpenSubtitles key is configured. */
  available: boolean;
  provider: 'opensubtitles' | string;
  service_url: string;
  key_name: string;
  /** Whether the provider session is authenticated (token obtained). */
  authenticated: boolean;
  history_count: number;
  default_languages: string[];
  max_results: number;
}
/** Lightweight reachability probe (latency + language catalog size). */
export interface SubtitleSearchProbe {
  configured: boolean;
  available: boolean;
  latency_ms: number | null;
  error?: string | null;
  languages_count?: number | null;
}
export interface SubtitleResult {
  /** Download handle used by /download (numeric or string id). */
  file_id: number | string;
  subtitle_id?: string;
  title?: string | null;
  release?: string | null;
  language?: string | null;
  year?: number | null;
  season?: number | null;
  episode?: number | null;
  format?: string | null;
  downloads?: number | null;
  rating?: number | null;
  uploader?: string | null;
  hearing_impaired?: boolean | null;
  fps?: number | null;
  url?: string | null;
}
/** Optional search filters (everything but the query is optional). */
export interface SubtitleSearchOptions {
  languages?: string;
  year?: number;
  season?: number;
  episode?: number;
  moviehash?: string;
  limit?: number;
  record?: boolean;
}
export interface SubtitleSearchResponse {
  provider: 'opensubtitles' | string;
  query: string;
  count: number;
  results: SubtitleResult[];
  history_id?: string | null;
  error?: string;
}
export interface SubtitleDownloadResponse {
  success: boolean;
  file_name?: string | null;
  format?: string | null;
  language?: string | null;
  /** Inline subtitle text (offer as a .srt Blob), when the backend returns it. */
  content?: string | null;
  /** Where the backend saved the file, when it persisted it instead. */
  saved_path?: string | null;
  /** Direct download link, when the provider returns one. */
  link?: string | null;
  error?: string | null;
}
export interface SubtitleSearchHistoryEntry {
  id: string;
  ts: number;
  iso: string;
  query: string;
  languages: string[];
  year?: number | null;
  result_count: number;
  results: SubtitleResult[];
  origin: string;
}
export interface SubtitleSearchHistoryResponse {
  success: boolean;
  entries: SubtitleSearchHistoryEntry[];
}
export interface SubtitleSearchHistoryClearResponse {
  success: boolean;
  removed: number;
}
export interface SubtitleSearchHistoryDeleteResponse {
  success: boolean;
}

// --- Subtitle provider fallback chain -------------------------------------- #
// The subtitle side tries these providers IN ORDER (by `order`), then falls
// back to Whisper generation. #1 is the primary; the scraper lanes are
// best-effort/outdated (`fallback`=true).
export interface SubtitleProvider {
  /** Stable id used by the /{name}/test probe. */
  name: string;
  /** Human label, e.g. "OpenSubtitles". */
  label: string;
  /** Chain position (1=primary). */
  order: number;
  /** Usable right now. */
  available: boolean;
  /** Required key/config present. */
  configured: boolean;
  /** Install/config hint shown when not available (e.g. "pip install subliminal"). */
  needs: string;
  /** True for the outdated/best-effort scraper lanes. */
  fallback: boolean;
  /** Short description of the provider. */
  note: string;
}
export interface SubtitleProvidersResponse {
  success: boolean;
  providers: SubtitleProvider[];
}
/** Result of a live per-provider probe (may hit the network). */
export interface SubtitleProviderProbe {
  name: string;
  label?: string;
  available: boolean;
  latency_ms: number | null;
  error: string | null;
}

// --- Subtitle download cache (reuse a rate/quota-limited download) ---------- #
// GET /api/local/subtitle-search/cache — on-disk cache of already-downloaded
// subtitles so the same provider file is never pulled twice (the provider
// caps free downloads per day). `downloads` = cached files; `fetches` = keyed
// fetch entries; `bytes` = total cache size on disk. No network call.
export interface SubtitleCacheStats {
  success: boolean;
  dir: string;
  downloads: number;
  fetches: number;
  bytes: number;
  error?: string;
}
/** POST /api/local/subtitle-search/cache/clear — wipe the cache (count removed). */
export interface SubtitleCacheClearResponse {
  success: boolean;
  removed: number;
}

// --- Word audio (real pronunciation lookup + TTS fallback) ----------------- #
// GET /api/local/word-audio/status reports which real-pronunciation sources are
// wired. pycore exposes 3 (free_dictionary_api, cambridge_dictionary, forvo);
// laravel exposes 2 (no cambridge). The Forvo key is never leaked — only its
// presence is reported. `tts_fallback` is always true (TTS covers a miss).
/**
 * POST /api/local/word-audio/test — the REAL live fetch through the existing
 * pronunciation client. On a hit the raw audio bytes are base64-encoded into
 * `audio_base64` (play via new Audio('data:'+mime+';base64,'+audio_base64)).
 * On a clean miss `success` is false, `provider` is null and `message` explains
 * the TTS fallback would cover it.
 */
export interface WordAudioTestResponse {
  success: boolean;
  provider: 'free_dictionary_api' | 'cambridge_dictionary' | 'forvo' | string | null;
  mime?: string;
  audio_base64?: string;
  source_id?: string;
  meta?: Record<string, unknown>;
  bytes?: number;
  message?: string;
}

