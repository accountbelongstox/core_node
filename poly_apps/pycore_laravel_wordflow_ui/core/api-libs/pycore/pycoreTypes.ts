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

// --- Subtitle language fill (video_extract.fill_languages RPC) ----------- #
// Ensures every requested language has a `<stem>.<lang>.srt` sibling track
// (OpenSubtitles when strategy='api_first' + credentialed, else AI-translated
// from the primary cues). Per-source outcome.  // 每个源的填充结果
export interface SubtitleFillSourceResult {
  source: string;
  filled: Record<string, string>;  // lang -> written track path
  skipped: string[];               // langs already present
  failed: Record<string, string>;  // lang -> error
}

// The RPC returns EITHER a single-source summary (flat fields) OR a multi-path
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

// Live WS-push phase: idle | scanning | pushing | receiving (+ file count).
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

export interface FileTreeResponse {
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
  tree?: FileTreeResponse;   // the client's actual received tree
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
  /** Fallback chain in priority order (edge -> sherpa -> melotts -> gptsovits -> azure). */
  engines?: TtsEngine[];
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
  quota?: SttQuota;
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
  /** Id of the persisted speech-history record (for the Records timeline). */
  record_id?: string;
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
  /** How posters were obtained at ingest: local reuse of the extract poster.jpg
   *  vs a fresh TMDB/OMDB fetch (cumulative since the last reset). */
  stats?: { reused: number; fetched: number };
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
export interface WordAudioSource {
  /** Stable id, e.g. "free_dictionary_api" | "cambridge_dictionary" | "forvo". */
  key: string;
  /** Human label, e.g. "Free Dictionary API". */
  label: string;
  /** Usable right now (a key-gated source is false until its key is present). */
  available: boolean;
  /** True when this source needs an API key (only Forvo today). */
  requires_key: boolean;
  /** Short description / constraint hint. */
  note: string;
}
export interface WordAudioStatus {
  backend: 'pycore' | 'laravel' | string;
  sources: WordAudioSource[];
  /** Whether FORVO_API_KEY is configured (the key value is never returned). */
  forvo_key_present: boolean;
  /** Always true — TTS synthesis handles a clean miss. */
  tts_fallback: boolean;
}
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

// --- Queue Center: unified overview (contract A) --------------------------- #
// GET /api/local/queue/overview. pycore is the hub: it fans out to Laravel for
// the per-category counts + worker registry, and merges its own local engine
// status. Eight categories are ALWAYS present (zeros when empty), even when
// laravel_reachable is false.

/** Who actually processes a queue category's work. */
export type PcQueueHandler = 'chrome' | 'pycore' | 'ai';

/** One sample row for a category (loose — only a few fields are present). */
export interface PcQueueSample {
  word?: string;
  language?: string;
  source_key?: string;
  title?: string;
  id?: string | number;
  [k: string]: unknown;
}

/** One queue category card. `by_language` / `sample` are optional. */
export interface PcQueueCategory {
  key: string;
  label: string;
  handler: PcQueueHandler;
  pending: number;
  processing: number;
  leased: number;
  total: number;
  /** Per-language pending breakdown (lang code -> count), when reported. */
  by_language?: Record<string, number>;
  /** A few sample rows (preview of what is waiting), when reported. */
  sample?: PcQueueSample[];
}

/** A registered worker (chrome/pycore) draining one or more categories. */
export interface PcQueueWorker {
  id: string;
  kind: 'chrome' | 'pycore' | string;
  processor_types: string[];
  online: boolean;
  last_seen: string | null;
  claimed: number;
}

/** pycore-local engine status per capability (always reported). */
export interface PcQueueEngines {
  tts?: { active?: string | null; priority: string[] };
  stt?: { priority: string[] };
  image?: { priority: string[] };
  translation?: { priority: string[] };
}

export interface PcQueueOverview {
  success: boolean;
  generated_at?: string;
  laravel_reachable: boolean;
  categories: PcQueueCategory[];
  workers: PcQueueWorker[];
  engines: PcQueueEngines;
  error?: string;
}

// --- Queue Center: capability settings (contract B) ------------------------ #
// GET/POST /api/local/capabilities/settings. Each capability block carries the
// engine PRIORITY chain (re-orderable), an availability map, and its options
// (TTS has synth_timeout_s + edge_cooldown_s; the others are typically empty).

export interface PcCapabilityOptions {
  synth_timeout_s?: number;
  edge_cooldown_s?: number;
  [k: string]: unknown;
}

/** One capability's settings block. */
export interface PcCapabilityBlock {
  /** Ordered engine chain (index 0 = tried first). */
  priority: string[];
  /** Per-engine availability (engine id -> ready). */
  available: Record<string, boolean>;
  /** Tuning options (TTS: synth_timeout_s / edge_cooldown_s). */
  options: PcCapabilityOptions;
}

/** GET /api/local/capabilities/settings — all four capability blocks. */
export interface PcCapabilitySettings {
  success: boolean;
  stt: PcCapabilityBlock;
  tts: PcCapabilityBlock;
  image: PcCapabilityBlock;
  translation: PcCapabilityBlock;
  error?: string;
}

/** The four capability ids the drawer manages. */
export type PcCapabilityKey = 'stt' | 'tts' | 'image' | 'translation';

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
// GET /api/local/tasks/recent — a unified, newest-first log of finished task
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

/** GET /api/local/tasks/recent — recent task history + roll-up stats. */
export interface PcTaskRecentResponse {
  success: boolean;
  records: PcTaskRecord[];
  count: number;
  stats: PcTaskRecentStats;
  error?: string;
}

/** POST /api/local/tasks/clear — wipe history + truncate the text log. */
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
