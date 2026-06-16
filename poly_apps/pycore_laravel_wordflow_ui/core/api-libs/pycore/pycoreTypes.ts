/**
 * pycore API types — self-contained copy for the dashboard's pycore end.
 *
 * Ported from the original desktop-manager `src/types.ts`, trimmed to the
 * definitions the PycoreApi / PycoreWs / PycoreCache libraries actually need.
 * Kept here so the lib never imports from the original app directory.
 */

export interface QueueItem {
  id: string;
  index: number;
  text: string;
  category: 'Voice' | 'Image' | 'File' | 'Task' | 'Video' | 'Window';
  playCount: number;
  created: string;
  status: 'pending' | 'completed' | 'failed' | 'processing';
  audioUrl?: string;
  metadata?: {
    duration?: string;
    size?: string;
    fileName?: string;
    summary?: string;
    targetWindow?: string;
    lang?: string;
    /** "provider/model" when an AI produced this item's text (task attribution). */
    ai?: string;
  };
}

// --- Local cache settings snapshot --------------------------------------- #
export interface AppSettings {
  theme: 'light' | 'dark';
  [k: string]: unknown;
}

// --- Video extract ------------------------------------------------------- #
export type VideoExtractMode = 'folder' | 'file';

export interface VideoExtractEntry {
  path: string;
  mode: VideoExtractMode;
  added_at?: string;
}

export interface VideoExtractOptions {
  subtitle: boolean;
  model: string;
  formats: string[];
  lang: string;
  extensions?: string[];
}

export interface VideoExtractHistory {
  success: boolean;
  base_dir: string;
  entries: VideoExtractEntry[];
  last_options: Partial<VideoExtractOptions> | Record<string, unknown>;
  error?: string;
}

export interface WhisperLanguage {
  code: string;
  name: string;
}

export interface VideoExtractCapabilities {
  success: boolean;
  models: string[];
  all_models: string[];
  installed_models: string[];
  default_model: string;
  languages: WhisperLanguage[];
  default_lang: string;
  ffmpeg_found: boolean;
  extensions?: string[];
  default_extensions?: string[];
  error?: string;
}

// --- System resources ---------------------------------------------------- #
export interface SystemGpu {
  index: number;
  name: string;
  util_percent: number;
  mem_used_mb: number;
  mem_total_mb: number;
}

export interface SystemResources {
  cpu_percent: number;
  mem: { used_mb: number; total_mb: number; percent: number };
  gpus: SystemGpu[];
}

export interface SystemResourcesResponse extends Partial<SystemResources> {
  success?: boolean;
  error?: string;
}

// --- Video extract: segment ↔ subtitle mapping --------------------------- #
export interface VideoExtractSubtitle {
  idx: number;
  start: number;
  end: number;
  text: string;
}

export interface VideoExtractSegment {
  index: number;
  start: number;
  end: number;
  mp4: string;
  mp3: string;
  subtitle_count: number;
  subtitles: VideoExtractSubtitle[];
}

export interface VideoExtractMapping {
  video: string;
  stem: string;
  duration: number;
  max_segment_sec: number;
  segment_count: number;
  segments: VideoExtractSegment[];
}

export interface VideoExtractSegmentsResponse {
  success: boolean;
  mapping?: VideoExtractMapping;
  error?: string;
}

export type VideoExtractOpenKind =
  | 'output' | 'file' | 'file_dir' | 'file_output_dir' | 'subtitle';

export interface VideoExtractOpenResponse {
  success: boolean;
  error?: string;
}

export interface PickPathResult {
  success: boolean;
  path: string | null;
  canceled: boolean;
  error?: string;
}

// --- Code sync (peer mesh) ----------------------------------------------- #
export type CodeSyncRole = 'dev' | 'client';

export interface CodeStats {
  files: number;
  bytes: number;
  last_modified: number;
}

export interface SelfStatus {
  id: string;
  name: string;
  role: CodeSyncRole;
  hostname: string;
  lan_ip: string;
  distributing: boolean;
  config_version: number;
  skip_update?: boolean;
  code?: CodeStats;
  summary: {
    role: CodeSyncRole;
    distributing: boolean;
    skip_update?: boolean;
    code?: CodeStats;
    servers?: number;
    clients?: number;
    [k: string]: unknown;
  };
}

export interface PeerLiveStatus {
  role?: CodeSyncRole;
  distributing?: boolean;
  skip_update?: boolean;
  code?: CodeStats;
  servers?: number;
  clients?: number;
  summary?: {
    role?: CodeSyncRole;
    distributing?: boolean;
    skip_update?: boolean;
    code?: CodeStats;
    servers?: number;
    clients?: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

export interface PeerStatus {
  id: string;
  name: string;
  host: string;
  port: number;
  role: CodeSyncRole;
  reachable: boolean;
  last_seen: number | null;
  pending?: boolean;
  status?: PeerLiveStatus | null;
}

export interface CodeSyncPeersResponse {
  success: boolean;
  self: SelfStatus;
  peers: PeerStatus[];
  version: number;
  error?: string;
}

export interface CodeSyncCandidate {
  host: string;
  port: number;
  name: string;
  role: CodeSyncRole;
  id: string;
}

// --- Auto-start on boot -------------------------------------------------- #
export interface AutostartStatus {
  success?: boolean;
  enabled: boolean;
  supported: boolean;
  platform?: string;
  scope?: string;
  location?: string;
  message?: string;
  error?: string;
}

// --- AI status (provider availability probe) ----------------------------- #
/** Local rate-limit snapshot for a provider (current usage vs encoded free-tier limits). */
export interface AiProviderRate {
  provider: string;
  enforced: boolean;
  note?: string;
  limits?: {
    rpm: number | null;
    rpd: number | null;
    rps: number | null;
    rpm_month: number | null;
    note: string;
  };
  usage?: { minute: number; day: number; month: number };
  /**
   * Seconds until each budget resets: minute = sliding 60s window; day = local
   * midnight; month = the 1st. null when there is nothing to reset.
   */
  resets_in?: { minute: number | null; day: number | null; month?: number | null };
  last_updated?: string;
}

/** GET /api/local/ai/rate-limits — live local rate budgets (auto-reset by tick). */
export interface AiRateLimitsResponse {
  success: boolean;
  last_updated?: string;
  storage_path?: string;
  providers: AiProviderRate[];
}

/**
 * Per-KEY rotation status slot (gateway endpoint). Multi-key providers rotate
 * KEY1 → KEY2 → … as keys hit a 429/quota and cool down. `image_keys` use the
 * SAME shape but a SEPARATE budget (a provider may have a dedicated
 * `{BASE}_IMAGE` key whose cooldowns never block text and vice-versa).
 */
export interface AiKeySlot {
  /** 0-based position in the rotation pool (UI shows it as KEY{index+1}). */
  index: number;
  /** Display label — 'KEY1' | 'KEY2' | … */
  label: string;
  /** Masked key (first4 + … + last4); never the full secret. */
  masked: string;
  /** Seconds remaining on this key's cooldown (0 = ready/active). */
  cooldown_s: number;
  /** Total attempts counted against this key slot. */
  used: number;
  ok: number;
  failed: number;
  /** Requests by this key in the last 60s (persistent per-key rate counter). */
  minute_used?: number;
  /** Requests by this key today, UTC (persistent per-key rate counter). */
  day_used?: number;
  /** Epoch seconds of the last use, or null. */
  last_used: number | null;
  /** Last error string for this key, or null. */
  last_error: string | null;
}

/**
 * One provider row from GET /api/local/ai/keys — the key-management view of a
 * provider (NOT a live availability probe). `keys` / `image_keys` reuse the
 * AiKeySlot shape; `key_base` is the secret-store base name (e.g. GOOGLE_API_KEY)
 * the indexed slots derive from (BASE_1 … BASE_5 for text, BASE_IMAGE_1 … for the
 * dedicated image budget).
 */
export interface AiKeyProvider {
  name: string;
  /** Secret-store base name the indexed key files derive from. */
  key_base: string;
  /** True when this provider needs no API key (e.g. pollinations). */
  keyless: boolean;
  /** True when this provider only generates images (no text/chat). */
  image_only: boolean;
  /** A text key is present (or keyless) — ready for chat/text. */
  configured: boolean;
  /** An image key is present (or keyless) — ready for image generation. */
  image_ready: boolean;
  /** How many text keys are configured. */
  key_count: number;
  /** Per-text-key rotation slots (KEY1/KEY2 …). */
  keys: AiKeySlot[];
  /** Per-image-key rotation slots (separate budget). */
  image_keys: AiKeySlot[];
}

/** GET /api/local/ai/keys — key-management catalog + the raw key file names. */
export interface AiKeysResponse {
  success: boolean;
  providers: AiKeyProvider[];
  /** Exact env-var names of every configured key file (for targeted delete). */
  raw_key_files: string[];
  error?: string;
}

/** POST /api/local/ai/keys body — write one indexed key file, then re-probe. */
export interface AiKeySetRequest {
  provider?: string;
  base_name?: string;
  /** 1..5 rotation slot. */
  index?: number;
  value: string;
  /** Write {BASE}_IMAGE_{index} (dedicated image budget) instead of {BASE}_{index}. */
  image?: boolean;
}

/** POST /api/local/ai/keys response — the env-var name that was written. */
export interface AiKeySetResponse {
  success: boolean;
  key_name?: string;
  error?: string;
}

/** DELETE /api/local/ai/keys/{key_name} response. */
export interface AiKeyDeleteResponse {
  success: boolean;
  error?: string;
}

/** POST /api/local/ai/keys/reset-cooldown response. */
export interface AiKeyResetCooldownResponse {
  success: boolean;
  /** How many key slots had their cooldown cleared. */
  cleared?: number;
  error?: string;
}

export interface AiProvider {
  name: string;
  configured: boolean;
  available: boolean;
  tier?: AiTier;
  limits?: string;
  vision?: boolean;
  /** Registry capability: this provider can generate images. */
  image?: boolean;
  /** image capability AND a key is present (ready to generate, NO live call). */
  image_ready?: boolean;
  /** The image model this provider generates with (e.g. `dall-e-3`). */
  image_model?: string;
  key_masked: string | null;
  models: string[];
  error: string | null;
  latency_ms: number | null;
  /** True once a live availability test has run (catalog rows are untested). */
  tested?: boolean;
  /** True when the test was skipped because the local rate budget is exhausted. */
  rate_limited?: boolean;
  /** Current local rate-limit usage vs limits (shown on the card). */
  rate?: AiProviderRate | null;
  /** Rotation pool size — how many keys are configured (gateway-sourced). */
  key_count?: number;
  /** Per-text-key rotation status (gateway-sourced; merged onto catalog rows). */
  keys?: AiKeySlot[];
  /** Per-IMAGE-key rotation status (separate budget; gateway-sourced). */
  image_keys?: AiKeySlot[];
}

export interface AiProbeResponse {
  providers: AiProvider[];
  error?: string;
}

/**
 * GET /api/local/ai/balance[?provider=] — account credit / remaining balance.
 * Only openrouter / deepseek / siliconflow / moonshot expose a balance API;
 * any other provider returns `supported:false` with no network call.
 */
export interface AiBalance {
  name: string;
  /** This provider exposes a machine-readable balance endpoint at all. */
  supported: boolean;
  /** A key is present (balance can be fetched). */
  configured: boolean;
  /** The live balance fetch succeeded. */
  ok: boolean;
  currency: string | null;
  /** Remaining / available balance. */
  balance: number | null;
  /** Free / granted portion (deepseek / siliconflow gift). */
  granted: number | null;
  /** Paid / topped-up portion. */
  topped_up: number | null;
  /** Total credits granted (openrouter). */
  total: number | null;
  /** Total usage to date (openrouter). */
  used: number | null;
  /** Openrouter key tier flag. */
  is_free_tier: boolean | null;
  key_masked: string | null;
  /** Human one-liner, e.g. "4.20 USD remaining". */
  detail: string;
  error: string | null;
  latency_ms: number | null;
}

export interface AiBalanceResponse {
  providers: AiBalance[];
  /** Provider names that expose a balance API. */
  supported: string[];
  /** Every other registered provider (no balance endpoint). */
  unsupported: string[];
}

// --- AI image generation + shared history -------------------------------- #
/**
 * POST /api/local/ai/image — unified IMAGE contract. On success the backend ALSO
 * records the result into the shared cross-runtime history store.
 */
export interface AiImageResponse {
  success: boolean;
  provider: string;
  model: string;
  /** Base64 image bytes (NO data: prefix) — render as `data:${mime};base64,...`. */
  image_base64: string | null;
  mime: string;
  latency_ms: number | null;
  error: string | null;
  /** History id of the saved entry, when the backend echoes it. */
  id?: string;
}

/**
 * One metadata row from GET /api/local/ai/image/history (newest-first). The image
 * bytes are NEVER inlined — fetch them via imageHistoryFileUrl(id). The store is
 * SHARED with laravel, so `origin` distinguishes which runtime generated each.
 */
export interface ImageHistoryEntry {
  id: string;
  ts: number;
  iso: string;
  provider: string;
  model: string;
  prompt: string;
  size: string;
  mime: string;
  bytes: number;
  /** Relative store path (e.g. `ai_images/<id>.png`) — informational only. */
  file: string;
  latency_ms: number | null;
  source: string;
  /** Which runtime generated the entry. */
  origin: 'pycore' | 'laravel' | string;
  ok: boolean;
}

export interface ImageHistoryResponse {
  success: boolean;
  entries: ImageHistoryEntry[];
  error?: string;
}

export interface ImageHistoryClearResponse {
  success: boolean;
  removed?: number;
  error?: string;
}

export interface ImageHistoryDeleteResponse {
  success: boolean;
  error?: string;
}

// --- AI chat (provider confirm) ------------------------------------------ #
export type AiChatRole = 'system' | 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiChatResponse {
  success: boolean;
  provider: string;
  model: string;
  nickname?: string;
  text: string;
  latency_ms: number | null;
  error: string | null;
  retry_after_s?: number | null;
}

// --- AI gateway (unified exit: smart dispatch + quota + records) ---------- #
export type AiTier = 'free' | 'balance' | 'paid';

export interface AiGatewayQuota {
  kind: 'key-usage' | 'balance' | 'static' | 'none';
  is_free_tier?: boolean;
  usage?: number | null;
  limit?: number | null;
  limit_remaining?: number | null;
  rate_limit?: { requests?: number; interval?: string } | null;
  is_available?: boolean;
  balance?: string | null;
  currency?: string | null;
  note?: string;
  error?: string;
}

export interface AiGatewayProvider {
  name: string;
  tier: AiTier;
  limits?: string;
  vision: boolean;
  image?: boolean;
  configured: boolean;
  available: boolean;
  key_masked?: string | null;
  models: string[];
  quota: AiGatewayQuota;
  image_model?: string;
  calls: number;
  ok: number;
  failed: number;
  last_error: string | null;
  cooldown_s: number;
  /** Rotation pool size — how many keys are configured. */
  key_count?: number;
  /** Per-text-key rotation status (KEY1/KEY2…). */
  keys?: AiKeySlot[];
  /** Per-IMAGE-key rotation status (separate budget). */
  image_keys?: AiKeySlot[];
}

export interface AiGatewayRecord {
  ts: number;
  kind: 'text' | 'vision';
  source: string;
  provider: string;
  model: string;
  success: boolean;
  latency_ms: number | null;
  error: string | null;
}

export interface AiGatewayStatus {
  success: boolean;
  providers: AiGatewayProvider[];
  records: AiGatewayRecord[];
}

// --- AI usage (SHARED cross-runtime store — text / vision / probe) -------- #
/**
 * One shared usage record from GET /api/local/ai/usage (newest-first). The
 * store is SHARED with laravel, so `runtime` distinguishes which runtime issued
 * the call. Image generations are NOT here — they live in the image history.
 */
export interface AiUsageRecord {
  ts: number;
  iso: string;
  /** Which runtime issued the call — 'pycore' | 'laravel'. */
  runtime: 'pycore' | 'laravel' | string;
  kind: 'text' | 'vision' | 'probe';
  provider: string;
  model: string;
  source: string;
  success: boolean;
  latency_ms: number | null;
  error: string | null;
}

/** Per-kind counters for one provider in the usage rollup. */
export interface AiUsageKindStat {
  calls: number;
  ok: number;
  failed: number;
}

/** Per-provider usage rollup (kinds + last call). */
export interface AiUsageProviderStat {
  text?: AiUsageKindStat;
  vision?: AiUsageKindStat;
  probe?: AiUsageKindStat;
  last_ts?: number;
  last_model?: string;
}

/** GET /api/local/ai/usage — shared usage log + per-provider/kind rollup. */
export interface AiUsageResponse {
  success: boolean;
  storage_path: string;
  stats: Record<string, AiUsageProviderStat>;
  entries: AiUsageRecord[];
  error?: string;
}

// --- OCR engine availability --------------------------------------------- #
export interface OcrEngine {
  /** Engine id: 'windows' | 'easyocr' | 'cnocr'. */
  name: string;
  /** 1-based priority (1 = tried first). */
  priority: number;
  available: boolean;
  note: string;
}

export interface OcrStatus {
  success: boolean;
  /** Highest-priority available engine id, or null when none are installed. */
  best: string | null;
  available_count: number;
  engines: OcrEngine[];
  error?: string;
}

// --- TTS engine availability (live edge-tts probe) ----------------------- #
export interface TtsProvider {
  /** Provider id: currently 'edge'. */
  name: string;
  available: boolean;
  version: string | null;
  /** Whether an outbound proxy (EDGE_TTS_PROXY) is in effect. */
  proxy: boolean;
  error: string | null;
  /** True when the value came from the ~60s availability cache. */
  cached: boolean;
  /**
   * True when no live edge probe has run yet (the periodic status poll never
   * blocks on one — a background probe fills the cache, and `refresh=1` forces
   * a live check). `available` stays null/false until the probe completes.
   */
  pending?: boolean;
}

/**
 * One entry in the TTS fallback chain (priority order:
 * edge -> sherpa -> melotts -> gptsovits). `cooldown_remaining` is only set on
 * the 'edge' entry (seconds left on its failure cooldown; 0/absent = normal).
 */
export interface TtsEngine {
  name: string;
  /** 1-based priority (1 = tried first). */
  priority: number;
  available: boolean;
  note?: string;
  /** Seconds left on this engine's failure cooldown (edge only). */
  cooldown_remaining?: number;
}

export interface TtsStatus {
  success: boolean;
  providers: TtsProvider[];
  /** Highest-priority AVAILABLE engine (ignores cooldown), or null. */
  best?: string | null;
  /** Engine the NEXT synth would ACTUALLY use (honours cooldown), or null. */
  active?: string | null;
  /** Seconds left on the edge-tts failure cooldown; 0 = not cooling. */
  edge_cooldown_remaining?: number;
  /** Fallback chain in priority order (edge -> sherpa -> melotts -> gptsovits). */
  engines?: TtsEngine[];
  error?: string;
}

/** Settings-adjustable TTS tuning (GET/POST /api/local/tts/settings). */
export interface TtsSettings {
  success: boolean;
  /** Per-attempt edge-tts synth timeout (seconds; backend clamps 5–120). */
  synth_timeout_s: number;
  /** Edge-tts failure cooldown window (seconds; backend clamps 0–3600). */
  edge_cooldown_s: number;
}

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
  available: boolean;
  version: string | null;
  note: string;
}

export interface CapabilityStatus {
  success: boolean;
  cuda: CudaStatus;
  libraries: CapabilityLibrary[];
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
  completed: number;
  failed: number;
  total: number;
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
  /** Whether pycore's live WS bridge is connected (omitted by older backends). */
  ws_connected?: boolean;
  age_ms: number;
  error?: string;
}

export interface TranslationQueueActionResponse {
  success: boolean;
  task_id?: string;
  error?: string;
}

/** pyctl TaskManager record (GET /api/local/task-center/tasks/{id}). */
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

/** Laravel global_tasks row proxied via pycore translation queue detail. */
export interface PycoreGlobalTaskDetail {
  task_id: string;
  app_name: string;
  task_type: string;
  execution_type: string;
  status: string;
  progress: number;
  assigned_to: string | null;
  created_at: string | null;
  updated_at: string | null;
  payload?: unknown;
  result?: unknown;
  error?: string | null;
  priority?: number;
  retry_count?: number;
  max_retries?: number;
  timeout_seconds?: number;
  assigned_at?: string | null;
  timeout_at?: string | null;
  completed_at?: string | null;
}

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

// --- Assist Laravel (pycore drains Laravel's cover/tts/translation queues) - #
export interface AssistCapabilities {
  cover: boolean;
  tts: boolean;
  translation: boolean;
  /** Movie/TV poster fetch (TMDB/OMDB) for Books/Subtitles media. Optional —
   *  older backends omit it; treated as off until the field is present. */
  poster?: boolean;
}

export interface AssistConfig {
  enabled: boolean;
  capabilities: AssistCapabilities;
  poll_interval_s: number;
  batch_limit: number;
}

/** PATCH-style config update — only the provided fields change. */
export interface AssistConfigPatch {
  enabled?: boolean;
  capabilities?: Partial<AssistCapabilities>;
  poll_interval_s?: number;
  batch_limit?: number;
}

/** Per-poster_status distribution as observed Laravel-side by the assist
 *  worker (and surfaced in the assist snapshot's `poster` block). */
export interface AssistPosterCounts {
  pending: number; ready: number; failed: number; none: number;
  total: number; leased: number;
}

/** Laravel-side queue counts as last observed by the assist worker. */
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
  /** The Laravel endpoint assist targets (follows laravel_api.select); null = none. */
  endpoint: { base_url: string; label?: string } | null;
  /** Whether the assist worker loop is currently running. */
  running: boolean;
  /** Circuit breaker: open = backed off after repeated failures. */
  circuit: { open: boolean; cooldown_s: number };
  poll_interval_s: number;
  batch_limit: number;
  counters: { claimed: number; submitted: number; released: number; failures: number };
  last_error: string | null;
  last_cycle_at: string | null;
  laravel_status: AssistLaravelStatus | null;
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

// --- Movie / TV poster (pycore /api/local/poster) ------------------------- #
export interface PosterProvider {
  name: 'tmdb' | 'omdb';
  /** True when at least one key/token for the provider is configured. */
  configured: boolean;
  /** TMDB only: the v4 read-access bearer token is present. */
  has_v4_token?: boolean;
}
export interface PosterStatus {
  /** Mirrors the ingest flag user-data media_sync.fetch_poster (default ON). */
  enabled: boolean;
  providers: PosterProvider[];
  /** Masked (first6…last4) — full secrets never leave the backend. */
  keys: {
    TMDB_API_KEY: string;
    TMDB_API_READ_ACCESS_TOKEN: string;
    OMDB_API_KEY: string;
  };
}
export interface PosterMeta {
  title?: string;
  original_title?: string;
  year?: number | null;
  overview?: string;
  poster_url?: string;
}
export interface PosterTestResponse {
  found: boolean;
  provider?: 'tmdb' | 'omdb' | string;
  source_id?: string;
  mime?: string;
  meta?: PosterMeta;
  image_base64?: string;
  error?: string;
}
