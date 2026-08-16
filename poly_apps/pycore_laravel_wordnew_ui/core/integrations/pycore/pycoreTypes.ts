/**
 * pycore API types — self-contained copy for the dashboard's pycore end.
 *
 * Ported from the original desktop-manager `src/types.ts`, trimmed to the
 * definitions the PycoreApi, PycoreHttp, and PycoreCache libraries need.
 * Kept here so the lib never imports from the original app directory.
 */

import type {
  GlobalTaskCapability,
  GlobalTaskExecutionType,
  GlobalTaskStatusRecord,
  PcQueueOverview,
  QueueCenterControlName,
  QueueCenterControlState,
  QueueCenterSectionContract,
  QueueCenterScope,
} from '../../contracts/QueueCenterContract';
import type { AiUsageProviderStat } from '../../contracts/ai';

export type {
  AiChatMessage,
  AiChatRole,
  AiUsageKindStat,
  AiUsageProviderStat,
} from '../../contracts/ai';

export type { WordAudioSource, WordAudioStatus } from '../../contracts/wordAudio';

export type {
  GlobalTaskCapability,
  GlobalTaskDetailRecord,
  GlobalTaskEventRecord,
  GlobalTaskExecutionType,
  GlobalTaskPayload,
  GlobalTaskResult,
  GlobalTaskStatus,
  GlobalTaskStatusRecord,
  GlobalTaskSummary,
  GlobalTaskTypeDefinition,
  GlobalTaskWorkerRecord,
  PcQueueCategory,
  PcQueueEngines,
  PcQueueHandler,
  PcQueueOverview,
  PcQueueSample,
  PcQueueWorker,
  QueueCenterControlMetrics,
  QueueCenterControlName,
  QueueCenterControlResponse,
  QueueCenterControlState,
  QueueCenterErrorState,
  QueueCenterOverviewResponse,
  QueueCenterScope,
  QueueCenterSectionContract,
  QueueCenterSectionLifecycle,
  QueueCenterToggleEnvelope,
  QueueCenterWorkerMetrics,
} from '../../contracts/QueueCenterContract';

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
export interface PycoreAppSettings {
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
  // Primary subtitle track source for a run: 'api_first' tries OpenSubtitles
  // then falls back to Whisper; 'whisper' always transcribes locally. The
  // processor reads `config.subtitle_source` (default 'api_first').  // 字幕来源
  subtitle_source?: 'api_first' | 'whisper';
  // Persisted multi-language correspondence selection (the Laravel-sync
  // language multi-select); defaults to en+zh when absent.  // 目标语言集合
  target_languages?: string[];
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
// A subtitle cue. `text` is the legacy single-language cue text; the v3
// multi-language model adds a correspondence slot (BookSlot-shaped, spec §12/§7):
// `langs[code]` is that language's text or `null` (empty correspondence → the FE
// renders a blank), shared across the checked languages via `corr_id`. `grain`
// keeps the cue/sentence typing. Older backends send only `text`; readers fall
// back to it under the primary language column.
export interface VideoExtractSubtitle {
  idx: number;
  start: number;
  end: number;
  text: string;
  corr_id?: string;
  grain?: 'cue' | 'sentence';
  seq?: number;
  primary_language?: string | null;
  langs?: Record<string, string | null>;
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

// --- Subtitle language fill (video_extract.fill_languages HTTP) ----------- #
// Ensures every requested language has a `<stem>.<lang>.srt` sibling track
// (OpenSubtitles when strategy='api_first' + credentialed, else AI-translated
// from the primary cues). Per-source outcome.  // 每个源的填充结果
export interface SubtitleFillSourceResult {
  source: string;
  filled: Record<string, string>;  // lang -> written track path
  skipped: string[];               // langs already present
  failed: Record<string, string>;  // lang -> error
}

// The HTTP returns EITHER a single-source summary (flat fields) OR a multi-path
// aggregate (`count` + nested `results` summaries). Both shapes are unioned via
// optional fields so the FE can read whichever the backend sent.  // 填充响应
export interface SubtitleFillResponse {
  success: boolean;
  // single-source summary fields
  base_dir?: string | null;
  sources?: number;
  filled?: number;
  skipped?: number;
  failed?: number;
  results?: SubtitleFillSourceResult[] | SubtitleFillResponse[];
  errors?: string[];
  // multi-path aggregate field
  count?: number;
}

// Live progress for the fill, streamed over the `subtitle_language_fill`
// THREAD_BUS event (mirrors `video_extract_sync`).  // 字幕填充进度
export interface SubtitleFillProgress {
  stage: string;
  done: number;
  total: number;
  detail: string;
  summary?: Record<string, unknown>;
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
  light?: boolean;                     // start-time RECEIVE-ONLY light mode (read-only indicator)
  code?: CodeStats;
  watch_root?: string;                 // client write root (pushed files land here)
  watch_dirs?: string[];               // dev's effective watched dirs (empty list = root)
  sync_phase?: SyncPhase;              // live push/receive phase
  summary: {
    role: CodeSyncRole;
    distributing: boolean;
    skip_update?: boolean;
    light?: boolean;
    code?: CodeStats;
    servers?: number;
    clients?: number;
    [k: string]: unknown;
  };
}

// Live HTTP event phase: idle | scanning | pushing | receiving (+ file count).
// `channels` carries a per-peer breakdown keyed by peer id (this device's
// push/receive state toward each individual client); optional/back-compat.
export interface SyncPhaseChannel {
  phase: string;
  count: number;
  name?: string;
  direction?: 'push' | 'receive' | string;
  ts?: number;
}

export interface SyncPhase {
  phase: 'idle' | 'scanning' | 'pushing' | 'receiving' | string;
  count: number;
  channels?: Record<string, SyncPhaseChannel>;
}

export interface PeerLiveStatus {
  role?: CodeSyncRole;
  distributing?: boolean;
  skip_update?: boolean;
  light?: boolean;          // peer's start-time RECEIVE-ONLY light mode (read-only)
  code?: CodeStats;
  servers?: number;
  clients?: number;
  sync_phase?: SyncPhase;   // aggregate live phase reported by the peer
  summary?: {
    role?: CodeSyncRole;
    distributing?: boolean;
    skip_update?: boolean;
    light?: boolean;
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
  // How this peer is connected: 'probe' = we reached it; 'heartbeat' = it reported
  // in to us (NAT-friendly); 'both' = both directions; null/absent = offline.
  via?: 'probe' | 'heartbeat' | 'both' | null;
  last_checkin?: number | null;
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

// Filter settings: which paths are excluded from the synced/scanned tree.
export interface SyncSettings {
  excluded_dirs: string[];
  excluded_files: string[];
  excluded_extensions: string[];
  excluded_path_substrings: string[];
  apply_gitignore: boolean;
  watch_dirs: string[];   // dirs the dev watches/pushes; empty = project root
  scan_lan: boolean;      // opt-in LAN discovery (default off)
}

export interface SyncSettingsResponse {
  success: boolean;
  settings: SyncSettings;
  presets: SyncSettings;
  override_path: string;
  overridden: boolean;
  error?: string;
}

export interface SyncLogEntry {
  action?: string;
  file_path?: string;
  reason?: string;
  details?: string;
  size?: number;   // bytes of the new file (0 if n/a)
  diff?: number;   // signed byte delta vs previous version (new-old); 0 if new/unknown
  timestamp?: number | string | null;
  peer?: string;        // peer name/id this entry relates to (backend-set)
  direction?: string;   // 'push' / 'receive' / etc. (backend-set)
}

// --- Synced file tree (for the file-structure panel) --------------------- #
export interface FileTreeNode {
  name: string;
  path: string;            // posix path relative to the sync root
  type: 'dir' | 'file';
  size: number;            // bytes (rolled up for dirs)
  mtime?: number;          // files only
  hash?: string;           // files only: canonical (LF) content hash, for drift diff
  count?: number;          // dirs only: descendant file count
  children?: FileTreeNode[];
}

export interface PycoreFileTreeResponse {
  success: boolean;
  role: CodeSyncRole;
  roots: string[];         // the effective watch dirs (one or more)
  children: FileTreeNode[];
  count: number;           // total files
  size: number;            // total bytes
  truncated: boolean;      // hit the max-files cap
  scanning?: boolean;      // first index scan still running (tree may be partial)
  error?: string;
}

// Dev-side drift view of one client's received tree vs this dev's synced set.
export interface DriftSummary {
  dev_count: number;
  client_count: number;
  in_sync: number;
  missing: { path: string; size: number }[];                       // on dev, absent on client
  extra: { path: string; size: number }[];                         // on client, not on dev
  changed: { path: string; size_dev: number; size_client: number }[]; // hash differs
}

export interface PeerFileTreeResponse {
  success: boolean;
  peer: { id: string; name: string; host: string; port: number };
  tree?: PycoreFileTreeResponse;   // the client's actual received tree
  drift?: DriftSummary;
  scanning?: boolean;        // dev and/or client index still scanning -> drift provisional
  error?: string;
}

// --- Auto-start on boot -------------------------------------------------- #
/** What an autostart entry launches at boot. */
export type AutostartTarget = 'pyservice' | 'launcher' | 'both';

export interface AutostartStatus {
  success?: boolean;
  enabled: boolean;
  supported: boolean;
  platform?: string;
  scope?: string;
  location?: string;
  message?: string;
  error?: string;
  /** Current launch target: pyservice (full stack), launcher (terminals), both. */
  target?: AutostartTarget;
  /** Valid targets advertised by the backend (for the UI selector). */
  targets?: AutostartTarget[];
  /** Linux mechanism backing the entry: 'xdg' (.desktop) or 'systemd' (--user unit). */
  mechanism?: string;
  mechanisms?: string[];
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

/** GET /api/local/ai/usage — shared usage log + per-provider/kind rollup. */
export interface AiUsageResponse {
  success: boolean;
  storage_path: string;
  stats: Record<string, AiUsageProviderStat>;
  source_stats?: Record<string, Record<string, unknown>>;
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
  /** Installed PyPI package version, when applicable. */
  version?: string | null;
}

export interface OcrStatus {
  success: boolean;
  /** Highest-priority available engine id, or null when none are installed. */
  best: string | null;
  available_count: number;
  engines: OcrEngine[];
  error?: string;
}

/** Live per-engine recognition test (POST /api/local/ocr/test). */
export interface OcrTestResponse {
  success: boolean;
  /** Engine that ran (null when no engine is available). */
  engine: string | null;
  /** Recognized text (empty on failure). */
  text: string;
  latency_ms: number;
  error: string | null;
  /** Model type used (cnocr: "general"|"scene"|"doc"|"number"|"english"|"chinese_traditional"). */
  model_type?: string;
  /** Language list used (easyocr). */
  languages?: string[];
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

export interface QwenTtsQueueJob {
  job_id: string;
  client_job_id?: string | null;
  text_summary?: string;
  language?: string;
  speaker?: string | null;
  format?: 'mp3' | 'wav' | string;
  priority?: number;
  submitted_at?: string;
  finished_at?: string | null;
  status: 'pending' | 'running' | 'done' | 'failed' | 'cancelled' | string;
  elapsed_ms?: number | null;
  error?: string | null;
  result_url?: string | null;
}

export interface QwenTtsQueueStatus {
  seq: number;
  queue_max: number;
  counts: Record<string, number>;
  jobs: QwenTtsQueueJob[];
  synthesized_count?: number;
  average_elapsed_ms?: number;
}

/**
 * One entry in the TTS fallback chain (priority order:
 * chattts -> cosyvoice -> fishspeech -> qwen3tts -> bark -> parler -> voxcpm2 -> kokoro -> …). `cooldown_remaining` is only set on
 * the 'edge' entry (seconds left on its failure cooldown; 0/absent = normal).
 */
export interface TtsEngine {
  name: string;
  /** 1-based priority (1 = tried first). */
  priority: number;
  /** Runtime-ready — can synthesize now. */
  available: boolean;
  /** Prerequisites installed (pip / staging / models); may still need server or config. */
  installed?: boolean;
  note?: string;
  /** Installed PyPI package version (edge version comes from live probe). */
  version?: string | null;
  /** Why this engine is off (e.g. missing STREAMELEMENTS_API_KEY). */
  disabled_reason?: string;
  /** Seconds left on this engine's failure cooldown (edge / streamelements). */
  cooldown_remaining?: number;
  /** edge only: live synth probe result (may differ from package installed). */
  live_available?: boolean | null;
  /** edge only: EDGE_TTS_PROXY in effect. */
  proxy?: boolean;
  /** edge only: last live-probe error (e.g. HTTP 403). */
  probe_error?: string | null;
  /** edge only: live probe still running. */
  probe_pending?: boolean;
  /** edge only: live probe came from cache. */
  probe_cached?: boolean;
  /** Configured model/checkpoint tier (see tts_model_tiers.py). */
  model?: string | null;
  /** Local HTTP server engine (chattts/cosyvoice/…). */
  server_engine?: boolean;
  server_running?: boolean;
  server_managed?: boolean;
  server_enabled?: boolean;
  server_idle_remaining_s?: number | null;
  /** Bound local Web console URL reported after the server socket is ready. */
  server_url?: string | null;
  /** Qwen3-TTS only: authoritative in-memory queue snapshot. */
  queue?: QwenTtsQueueStatus;
  /** In-process model engine (sherpa/kokoro/bark/…): weights resident in memory. Class-C server engines like qwen3tts report server_* instead. */
  model_loaded?: boolean;
  /** Seconds until idle-unload for an in-process model (null when not loaded). */
  model_idle_remaining_s?: number | null;
  /** Parallel-safety annotation: 'serial' (edge lock) | 'cloud' | 'in_process' | 'server'. */
  concurrency?: string;
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
  /** Whether STREAMELEMENTS_API_KEY exists in .secret_keys (value never returned). */
  streamelements_key_present?: boolean;
  /** Fallback chain in priority order (chattts -> cosyvoice -> fishspeech -> qwen3tts -> bark -> parler -> … -> azure). */
  engines?: TtsEngine[];
  /** Effective sentence and word profiles used by their queue workers. */
  sentence_priority?: string[];
  word_priority?: string[];
  error?: string;
}

/** Live per-engine synth test (POST /api/local/tts/test). */
export interface TtsTestResponse {
  success: boolean;
  engine: string | null;
  latency_ms: number;
  /** Size of the produced mp3 (0 on failure). */
  bytes: number;
  error: string | null;
  /** The text that was synthesized. */
  text?: string;
  /** Recognition / synth language used. */
  language?: string;
  /** On-disk path of the produced clip (informational). */
  path?: string;
  /** Id of the persisted speech-history record - play via speechHistoryFileUrl(id). */
  record_id?: string;
  /** Accent ACTUALLY produced ("us"|"uk"|"unknown"). */
  accent?: string | null;
  /** Gender used (edge: "female"|"male"). */
  gender?: string;
  /** Speaker name used (qwen3tts, cosyvoice). */
  speaker?: string;
  /** Voice style instruction used (qwen3tts, cosyvoice). */
  instruct?: string;
  /** Voice description used (parler). */
  description?: string;
}

// --- STT (speech-to-text) engine availability + live test ---------------- #
/** Quota/balance for a cloud STT engine (only Azure Speech has one). */
export interface SttQuota {
  /** 'free-tier'. */
  kind: string;
  note: string;
  /** True when the free quota is exhausted (HTTP 429 seen). */
  blocked: boolean;
  error?: string | null;
}

/**
 * One entry in the STT fallback chain (priority order:
 * faster-whisper -> whisper -> vosk -> azure). `quota` is only set on cloud
 * engines that expose one (azure).
 */
export interface SttEngine {
  name: string;
  /** 1-based priority (1 = tried first). */
  priority: number;
  available: boolean;
  note?: string;
  /** Installed PyPI package version, when applicable. */
  version?: string | null;
  /** Active model/checkpoint tier (STT whisper / faster-whisper). */
  model?: string | null;
  quota?: SttQuota;
  /** Local STT model resident in memory (faster-whisper/whisper/vosk). */
  model_loaded?: boolean;
  /** Seconds until idle-unload (null when not loaded). */
  model_idle_remaining_s?: number | null;
}

export interface SttStatus {
  success: boolean;
  /** Highest-priority available engine id, or null when none are ready. */
  best: string | null;
  active: string | null;
  available_count: number;
  engines: SttEngine[];
  error?: string;
}

/** Live recognition round-trip test (POST /api/local/stt/test). */
export interface SttTestResponse {
  success: boolean;
  engine: string | null;
  /** Recognized text from the generated sample clip. */
  text: string;
  latency_ms: number;
  error: string | null;
  /** The phrase that was synthesized then recognized. */
  phrase?: string;
  /** Language used for synthesis + recognition. */
  language?: string;
  /** On-disk path of the synthesized sample clip. */
  path?: string;
  /** Model used (faster-whisper / whisper override). */
  model?: string;
  /** Id of the persisted speech-history record (for the Records timeline). */
  record_id?: string;
  /** Echo of the backend route that handled this test. */
  route?: string;
}

// --- Engine model-load progress (GET /api/local/engines/load-status) ------- #
/** Load state of a single speech engine (TTS/STT), server or in-process model. */
export type EngineLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * One engine's live model-load progress. Populated for class-B in-process models
 * and class-C HTTP servers as they load; class-A cloud/CLI engines never appear.
 * `log_tail` is the last lines of the engine's startup/load output (bounded).
 */
export interface EngineLoadStatusEntry {
  name: string;
  state: EngineLoadState;
  message: string;
  device: string;
  /** Epoch seconds when the current load started (null when idle). */
  started_at: number | null;
  /** Epoch seconds of the last state change. */
  updated_at: number | null;
  /** Milliseconds elapsed since the load started (ticks while loading). */
  elapsed_ms: number;
  /** Bounded tail of recent load/startup log lines. */
  log_tail: string[];
}

/** GET /api/local/engines/load-status — name -> live load-progress entry. */
export interface EnginesLoadStatusResponse {
  success: boolean;
  engines: Record<string, EngineLoadStatusEntry>;
  error?: string;
}

// --- Speech (TTS/STT) clip history — the audio side of the Records timeline - #
export interface SpeechRecord {
  id: string;
  ts: number;
  iso: string;
  kind: 'tts' | 'stt';
  /** Engine that produced/recognized the clip (edge/sherpa/whisper/azure…). */
  engine: string;
  /** TTS: the synthesized text; STT: the recognized transcript. */
  text: string;
  language: string;
  mime: string;
  bytes: number;
  /** Relative store path (informational). */
  file: string;
  /** Absolute path on disk — for "show actual location" / Open location. */
  path?: string;
  latency_ms: number | null;
  source: string;
  origin: 'pycore' | string;
  ok: boolean;
}

export interface SpeechHistoryResponse {
  success: boolean;
  entries: SpeechRecord[];
  error?: string;
}

/** Local AI agent history — Claude/Codex/Cursor/Gemini txt store (/api/local/agent-history). */
export interface AgentHistorySessionSummary {
  id: string;
  raw_id?: string;
  tool: string;
  os_user: string;
  project: string;
  title: string;
  started_at: string;
  ended_at: string;
  started_ts: number;
  prompt_count: number;
  message_count: number;
  has_subagent: boolean;
  models?: string[];
  bytes?: number;
  file?: string;
}

export interface AgentHistoryTurn {
  ts: number;
  time: string;
  role: 'user' | 'assistant' | 'thinking' | 'tool_use' | 'tool_result' | 'system';
  is_subagent: boolean;
  model?: string | null;
  name?: string | null;
  text: string;
}

export interface AgentHistorySessionDetail extends AgentHistorySessionSummary {
  prompts: Array<{ id: string; ts: number; text: string; edited?: boolean }>;
  turns: AgentHistoryTurn[];
}

export interface AgentHistoryIndex {
  is_dev_machine: boolean;
  generated_at: string;
  tools: string[];
  users: string[];
  langs?: string[];
  sessions: AgentHistorySessionSummary[];
  counts?: Record<string, number>;
}

export interface AgentHistoryPrompt {
  id: string;
  tool: string;
  os_user: string;
  project: string;
  session_id: string;
  ts: number;
  time: string;
  text: string;
  lang?: string;
  edited?: boolean;
}

export interface AgentHistoryPromptsResponse {
  success: boolean;
  data: { items: AgentHistoryPrompt[]; total: number; limit?: number; offset?: number } | null;
  error: string | null;
}

export interface AgentHistoryIndexResponse {
  success: boolean;
  data: AgentHistoryIndex | null;
  error: string | null;
}

export interface AgentHistorySessionResponse {
  success: boolean;
  data: AgentHistorySessionDetail | null;
  error: string | null;
}

// --- DIFF read surface (ID page tables + lazy per-page materialization) ---- #
// ID pages carry IDs + status metadata only and are aligned by `revision`;
// full rows are materialized lazily for the visible page. No full loads.
export interface AgentHistoryIdPage<T> {
  revision: string;
  /** True when `since_revision` matched — reuse the locally cached page table. */
  unchanged?: boolean;
  total: number;
  page: number;
  page_count: number;
  items?: T[];
}

export interface AgentHistorySessionIdItem {
  id: string;
  tool: string;
  os_user: string;
  started_ts: number;
  prompt_count: number;
  has_subagent: boolean;
}

export type AgentHistoryPromptIdItem = Omit<AgentHistoryPrompt, 'text'>;

export type AgentHistoryArticleRecordMetadata = Omit<AgentHistoryArticleRecord, 'article_en' | 'reference_cn'>;

export interface AgentHistorySessionIdPagesResponse {
  success: boolean;
  data: (AgentHistoryIdPage<AgentHistorySessionIdItem> & {
    is_dev_machine?: boolean;
    generated_at?: string;
    tools?: string[];
    users?: string[];
    langs?: string[];
    counts?: Record<string, number>;
  }) | null;
  error: string | null;
}

export interface AgentHistoryPromptIdPagesResponse {
  success: boolean;
  data: (AgentHistoryIdPage<AgentHistoryPromptIdItem> & {
    generated_at?: string;
    tools?: string[];
    users?: string[];
    counts?: Record<string, number>;
  }) | null;
  error: string | null;
}

export interface AgentHistoryArticleRecordIdPagesResponse {
  success: boolean;
  data: AgentHistoryIdPage<AgentHistoryArticleRecordMetadata> | null;
  error: string | null;
}

export interface AgentHistorySessionPageResponse {
  success: boolean;
  data: { items: AgentHistorySessionSummary[]; total: number } | null;
  error: string | null;
}

export interface AgentHistoryPromptPageResponse {
  success: boolean;
  data: { items: AgentHistoryPrompt[]; total: number } | null;
  error: string | null;
}

export interface AgentHistoryArticleRecordPageResponse {
  success: boolean;
  data: { items: AgentHistoryArticleRecord[]; total: number } | null;
  error: string | null;
}

/** One generated article row from GET …/agent-history/article/records. */
export interface AgentHistoryArticleRecord {
  id: string;
  created_at: string;
  title_cn: string;
  title_en: string;
  reference_cn?: string;
  article_en?: string;
  word_count: number;
  openrouter_model?: string;
  translation_engine?: string;
  /** Audio generation source reported by the TTS backend at synthesis time. */
  tts_engine?: string;
  tts_model?: string;
  /** Multi-sentence synthesis marker (single-version pipeline): true = the
   *  audio was generated by the sentence-chunk pipeline. A missing marker
   *  marks the record as a rebuild candidate (engine-agnostic rule) for the
   *  piggyback lane that re-generates it and replaces it on Laravel. */
  tts_chunked?: boolean;
  rebuild_attempts?: number;
  audio_rebuilt_at?: string | null;
  audio_available: boolean;
  audio_url?: string | null;
  audio_status?: string | null;
  laravel_article_id?: string | null;
  uploaded: boolean;
  uploaded_at?: string | null;
}

export interface AgentHistoryTestExtractResponse {
  success?: boolean;
  data?: {
    ok: boolean;
    empty?: boolean;
    tool: string;
    sources?: number;
    error?: string;
    prompt?: { ts: number; text: string };
  };
  error?: string | null;
}

export interface AgentHistoryToolStatistics {
  tool: string;
  sessions: number;
  history_records: number;
  processed: number;
  pending: number;
  prompts: number;
  replies: number;
  generated_at: string;
  source_modified_ts: number;
}

export interface AgentHistoryStatusResponse {
  success: boolean;
  data?: {
    tick?: Record<string, unknown>;
    store?: Record<string, unknown>;
    article?: Record<string, unknown>;
    tool_history?: AgentHistoryToolStatistics;
    tool_histories?: AgentHistoryToolStatistics[];
  };
  error?: string | null;
}

export interface AgentHistoryArticleRecordsResponse {
  success?: boolean;
  records?: AgentHistoryArticleRecord[];
  data?: { records?: AgentHistoryArticleRecord[] };
  error?: string | null;
}

/** POST …/reveal — opened the file's folder in the OS file manager. */
export interface RevealResponse {
  success: boolean;
  /** Absolute path that was revealed. */
  path?: string;
  error?: string;
}

/** Settings-adjustable TTS tuning (GET/POST /api/local/tts/settings). */
export interface TtsSettings {
  success: boolean;
  /** Per-attempt edge-tts synth timeout (seconds; backend clamps 5–120). */
  synth_timeout_s: number;
  /** Edge-tts failure cooldown window (seconds; backend clamps 0–3600). */
  edge_cooldown_s: number;
  server_auto_manage?: boolean;
  server_single_active?: boolean;
  server_idle_shutdown_s?: number;
  server_enabled?: Record<string, boolean>;
}

export interface TtsServerActionResponse {
  success: boolean;
  engine?: string;
  enabled?: boolean;
  running?: boolean;
  managed?: boolean;
  error?: string;
  note?: string;
}

// --- Local LLM engines (article pipeline) — mirrors the TTS status shape --- #
/** One local LLM engine row (priority order; e.g. ollama -> lmstudio -> llamacpp). */
export interface LlmEngine {
  name: string;
  /** 1-based priority (1 = tried first). */
  priority: number;
  /** Runtime-ready — reachable + has a usable model now. */
  available: boolean;
  /** Prerequisites installed (binary/server present); may still need a running server. */
  installed: boolean;
  note?: string;
  base_url?: string;
  default_model?: string;
  /** Managed local HTTP server engine (ollama is startable via /api/local/llm/server). */
  server_engine?: boolean;
  server_running?: boolean;
  /** Why this engine is off (e.g. not installed / server down). */
  disabled_reason?: string | null;
}

export interface LlmStatus {
  success: boolean;
  /** Highest-priority AVAILABLE engine, or null. */
  best?: string | null;
  /** Engine the next generation would actually use, or null (falls back to OpenRouter). */
  active?: string | null;
  available_count: number;
  engines: LlmEngine[];
  auto_manage: boolean;
  single_active: boolean;
  idle_shutdown_s: number;
}

/** Live per-engine generation test (POST /api/local/llm/test). */
export interface LlmTestResponse {
  success: boolean;
  engine?: string | null;
  model?: string | null;
  text?: string;
  error?: string;
}

export interface LlmServerActionResponse {
  success: boolean;
  engine?: string;
  enabled?: boolean;
  running?: boolean;
  error?: string;
  note?: string;
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

// Queue Center category, worker, control, and section types are defined in
// core/contracts/QueueCenterContract.ts, which reads the shared JSON contract
// used by Python and Laravel. Raw Task Center slice types remain below.

/** One in-flight sentence-audio task (sentence worker get_status). */
export interface SentenceWorkerTask {
  task_id?: number;
  content_id?: string;
  language?: string;
  priority?: number;
  content?: string;
  variant_count?: number;
  current_variant_index?: number;
  current_variant_key?: string;
  current_provider?: string;
  stage?: string;
  progress?: number;
  progress_total?: number;
  elapsed_seconds?: number;
  speaker?: string;
  backend_uploaded?: boolean;
  backend_result_accepted?: boolean;
}

/** HTTP API sentence-audio status — auto-start, worker, and Laravel counts. */
export interface SentenceAudioAutoStatus {
  auto_start: boolean;
  /** Effective worker concurrency + recommended value for the current engine. */
  concurrency?: number;
  concurrency_recommended?: number;
  concurrency_limit?: number;
  concurrency_class?: string | null;
  selected_speaker?: string;
  supported_speakers?: string[];
  heartbeat_enabled: boolean;
  /** Canonical dispatch-driven processor state; heartbeat_enabled is legacy. */
  processor_enabled?: boolean;
  sentence_audio_capability: boolean;
  required_engine?: string;
  laravel?: {
    pending?: number;
    leased?: number;
    observed_at?: string | null;
    age_s?: number | null;
    stale?: boolean;
  };
  worker?: {
    worker_id?: string;
    worker_name?: string;
    processor_types?: GlobalTaskExecutionType[];
    capabilities?: GlobalTaskCapability[];
    queued?: number;
    leased?: number;
    processing?: number | string | null;
    enabled?: boolean;
    cycle_running?: boolean;
    total_claimed?: number;
    total_succeeded?: number;
    total_failed?: number;
    queue_progress?: {
      completed?: number;
      total?: number;
      pending?: number;
      assigned?: number;
      processing?: number;
      failed?: number;
    };
    last_cycle?: Record<string, unknown>;
    /** Legacy worker flag retained for older queue snapshots. */
    heartbeat_enabled?: boolean;
    /** Single task before the concurrent worker; a list of in-flight tasks after. */
    current_task?: SentenceWorkerTask | SentenceWorkerTask[] | null;
    /** "lang:content_id" keys of the in-flight tasks (queue-row spinner marker). */
    current_keys?: string[];
    events?: Array<{
      at?: number;
      kind?: string;
      detail?: string;
      text_preview?: string;
      language?: string;
      priority?: number;
      elapsed_seconds?: number;
      backend_uploaded?: boolean;
      backend_result_accepted?: boolean;
    }>;
  };
}

export interface SentenceQueueRow {
  task_id?: string;
  content_id: string;
  text?: string;
  language: string;
  queue_position?: number;
  tts_status?: string;
  progress?: number;
  stage?: string;
  backend_uploaded?: boolean;
  assigned_at?: string | null;
  updated_at?: string | null;
  tts_locked_by?: string | null;
  occurrence_count?: number;
  /** Flagged by the queue endpoint when this row is mid-synthesis in the worker. */
  processing?: boolean;
}

export interface SentenceAudioQueueSnapshot {
  success?: boolean;
  worker?: SentenceAudioAutoStatus['worker'];
  queue?: {
    items?: SentenceQueueRow[];
    total?: number;
    laravel_reachable?: boolean;
    snapshot_age_s?: number;
    summary?: {
      languages?: Record<string, number>;
      reconciled?: number;
    };
  };
}

/** One voice variant spec for sentence-audio (GET/POST/DELETE /api/local/sentence-audio/variants).
 *  `accent` is 'us'|'uk'|null; `gender` is 'female'|'male'; exactly one spec per
 *  lang has `is_primary` true. */
export interface SentenceVoiceVariant {
  lang: string;
  variant_key: string;
  accent: string | null;
  gender: string;
  is_primary: boolean;
}

export interface QueueBumpEvent {
  lane: string;
  item_id: string;
  label: string;
  old_priority: number | string;
  new_priority: number | string;
  at?: number;
  recently_bumped?: boolean;
  meta?: Record<string, unknown>;
}

export interface QueueBumpsSnapshot {
  events: QueueBumpEvent[];
  active_bumps?: string[];
  ttl_seconds?: number;
}

/** Word-dictionary TTS worker auto-start strip (tts_queue_poller). */
export interface WordTtsWorkerTask {
  task_id?: number | string;
  task_display_id?: string;
  content_id?: string;
  word?: string;
  text?: string;
  language?: string;
  queue_position?: number;
  current_provider?: string;
  stage?: string;
  progress?: number;
  progress_total?: number;
  elapsed_seconds?: number;
  backend_uploaded?: boolean;
  backend_result_accepted?: boolean;
}

export interface WordTtsAutoStatus {
  auto_start: boolean;
  /** Effective worker concurrency + recommended value for the current engine. */
  concurrency?: number;
  concurrency_recommended?: number;
  heartbeat_enabled: boolean;
  /** Canonical dispatch-driven processor state; heartbeat_enabled is legacy. */
  processor_enabled?: boolean;
  laravel?: {
    pending?: number;
    leased?: number;
    observed_at?: string | null;
    age_s?: number | null;
    stale?: boolean;
  };
  worker?: {
    batch_running?: boolean;
    enabled?: boolean;
    total_claimed?: number;
    total_succeeded?: number;
    total_failed?: number;
    last_tick?: Record<string, unknown>;
    /** Legacy worker flag retained for older queue snapshots. */
    heartbeat_enabled?: boolean;
    processing?: number;
    current_task?: WordTtsWorkerTask | null;
    current_tasks?: WordTtsWorkerTask[];
    backend_progress?: {
      current?: number;
      completed?: number;
      pending?: number;
      processing?: number;
      failed?: number;
      total?: number;
      observed_at?: number;
      refreshed_at?: number;
      source?: string;
    };
    queue_progress?: {
      completed?: number;
      total?: number;
      pending?: number;
      assigned?: number;
      processing?: number;
      failed?: number;
    };
    /** Recent processing records ({at, kind, detail, ...}), same shape as the sentence worker's. */
    events?: Array<{
      at?: number;
      kind?: string;
      detail?: string;
      task_id?: number | string;
      task_display_id?: string;
      text_preview?: string;
      language?: string;
      stage?: string;
      progress?: number;
      progress_total?: number;
      backend_progress_current?: number;
      backend_progress_total?: number;
      current_provider?: string;
    }>;
  };
}

// --- Code version indicator ------------------------------------------------ #
export interface PcCodeVersion {
  last_modified_unix: number;
  last_modified_at: string;
  latest_file: string;
  scan_ms?: number;
}
export interface PcVersionInfo {
  success: boolean;
  pycore: PcCodeVersion;
}

// --- Queue Center: capability settings (contract B) ------------------------ #
// GET/POST /api/local/capabilities/settings. Each capability block carries the
// engine PRIORITY chain (re-orderable), an availability map, and its options
// (TTS has synth_timeout_s + edge_cooldown_s; the others are typically empty).

export interface PcCapabilityOptions {
  synth_timeout_s?: number;
  edge_cooldown_s?: number;
  server_auto_manage?: boolean;
  server_single_active?: boolean;
  server_idle_shutdown_s?: number;
  server_enabled?: Record<string, boolean>;
  [k: string]: unknown;
}

/** One capability's settings block. */
export interface PcCapabilityBlock {
  /** Ordered engine chain (index 0 = tried first). */
  priority: string[];
  /** Per-engine runtime-ready (engine id -> can use now). */
  available: Record<string, boolean>;
  /** Per-engine prerequisites installed (engine id -> pip/staging present). */
  installed?: Record<string, boolean>;
  /** Per-engine setup hint when installed but not ready. */
  setup_reasons?: Record<string, string>;
  /** Tuning options (TTS: synth_timeout_s / edge_cooldown_s). */
  options: PcCapabilityOptions;
}

/** GET /api/local/capabilities/settings — capability blocks (stt/tts/image/translation + sentence_tts/word_tts profiles). */
export interface PcCapabilitySettings {
  success: boolean;
  stt: PcCapabilityBlock;
  tts: PcCapabilityBlock;
  image: PcCapabilityBlock;
  translation: PcCapabilityBlock;
  /** Sentence-level TTS variant chain (optional - older backends omit it). */
  sentence_tts?: PcCapabilityBlock;
  /** Word-level TTS variant chain (optional - older backends omit it). */
  word_tts?: PcCapabilityBlock;
  error?: string;
}

/** The capability ids the drawer manages (sentence_tts/word_tts are TTS profiles). */
export type PcCapabilityKey = 'stt' | 'tts' | 'image' | 'translation' | 'sentence_tts' | 'word_tts';

/** POST /api/local/capabilities/settings response — the updated block. */
export interface PcCapabilitySaveResponse extends Partial<PcCapabilityBlock> {
  success: boolean;
  capability?: PcCapabilityKey;
  error?: string;
}

// --- Offline dictionary (ECDICT + WordNet) --------------------------------- #
/** GET /api/local/dictionary/status — which offline dicts are installed. */
export interface DictionaryStatus {
  success: boolean;
  ecdict: { available: boolean; db_path: string; entries: number };
  wordnet: { available: boolean };
  error?: string;
}

/** GET /api/local/dictionary/lookup?word=&target= — a rich offline word entry. */
export interface DictionaryEntry {
  success: boolean;
  found: boolean;
  word: string;
  /** Full ECDICT Chinese translation (newline senses collapsed to '; '). */
  translation: string;
  /** English definition (ECDICT, else WordNet gloss). */
  definition: string;
  phonetic: string;
  pos: string;
  /** Exam tags: zk gk cet4 cet6 ky toefl ielts gre. */
  tags: string[];
  collins: number;
  oxford: boolean;
  bnc: number;
  frq: number;
  exchange: string;
  wordnet_definition: string;
  synonyms: string[];
  source: string;
  target: string;
  /** Single-language answer for the requested target ('zh'|'en'); null on miss. */
  target_translation: string | null;
  error?: string;
}

// --- Recent tasks (cross-end task history: pycore + chrome) ---------------- #
// ui/task_history/get_recent_local_tasks returns Pycore-local finished tasks
// units across both ends (pycore workers + the chrome MCP host). Each record is
// a single processed item (a word, a TTS synth, an image fetch, a translation
// batch, …). `detail` is free-form per task_type; the common keys are typed but
// any extra keys may appear.

/** One word entry inside a batch task's detail (per-word audio/engine info). */
export interface PcTaskDetailWord {
  word: string;
  audio_bytes?: number;
  engine?: string;
  [k: string]: unknown;
}

/** One translation pair inside a batch task's detail. */
export interface PcTaskDetailTranslation {
  word: string;
  translation: string;
  [k: string]: unknown;
}

/** A result resource copied into pycore's persistent completed-task cache. */
export interface PcTaskCachedResource {
  source: string;
  cache_key?: string;
  local_url?: string;
  mime?: string;
  size?: number;
  cached: boolean;
  error?: string;
}

/** Free-form per-task detail. Common keys typed; extras allowed. */
export interface PcTaskDetail {
  text?: string;
  translation?: string;
  provider?: string;
  model?: string;
  engine?: string;
  voice?: string;
  /** The produced audio file address (path or URL). */
  audio_path?: string;
  /** Human-readable synth invocation (engine-specific). */
  synth_command?: string;
  audio_bytes?: number;
  image_bytes?: number;
  mime?: string;
  size?: string;
  word_count?: number;
  /** word_translation: count translated this batch (NOT a boolean). */
  translated?: number;
  /** word_translation: count skipped (already-done) this batch. */
  skipped?: number;
  /** word_audio: count of words whose audio synthesized OK. */
  audio_ok?: number;
  /** word_audio: count of words whose audio synthesis failed. */
  audio_failed?: number;
  words?: PcTaskDetailWord[];
  translations?: PcTaskDetailTranslation[];
  failed_words?: string[];
  media_type?: string;
  year?: number | null;
  filename?: string;
  [k: string]: unknown;
}

/** A single finished task unit (newest-first in the recent log). */
export interface PcTaskRecord {
  ts: string;
  seq: number;
  /** Which end ran it. */
  end: 'pycore' | 'chrome' | string;
  worker: string;
  task_type: string;
  task_id: string;
  /** Base URL of the API the task came from. */
  source_api: string;
  /** The word / text / title the task was about. */
  title: string;
  language: string;
  /** submitted | already_done | completed | skipped | released | failed | … */
  status: string;
  success: boolean;
  /** Whether the result was returned to the originating API. */
  posted_back: boolean;
  latency_ms: number | null;
  error: string | null;
  detail: PcTaskDetail;
  execution_type?: string;
  capability?: string;
  archive_id?: string | number;
  resources?: PcTaskCachedResource[];
  is_local?: boolean;
  source?: string;
  updated_at?: string;
  last_error?: string | null;
}

/** Roll-up stats for the recent-task ring. */
export interface PcTaskRecentStats {
  total: number;
  success: number;
  failed: number;
  posted_back: number;
  /** Ring buffer capacity. */
  ring_max: number;
  /** Path of the on-disk text log. */
  log_path: string;
}

/** HTTP API recent task history plus roll-up stats. */
export interface PcTaskRecentResponse {
  success: boolean;
  records: PcTaskRecord[];
  count: number;
  stats: PcTaskRecentStats;
  types?: Record<string, number>;
  resource_count?: number;
  last_sync_at?: string | null;
  error?: string;
}

/** HTTP API command to wipe history and truncate the text log. */
export interface PcTaskClearResponse {
  ok: boolean;
  error?: string;
}

// --- Translate history (Google / AI translate usage records) --------------- #
export interface TranslateHistoryEntry {
  id: string;
  ts: number;
  iso: string;
  source: string;
  target: string;
  text: string;
  engine: 'google' | 'ai' | string;
  result: string;
  origin: string;
}
export interface TranslateHistoryResponse {
  success: boolean;
  entries: TranslateHistoryEntry[];
}
export interface TranslateHistoryClearResponse {
  success: boolean;
  removed: number;
}
export interface TranslateHistoryDeleteResponse {
  success: boolean;
}
