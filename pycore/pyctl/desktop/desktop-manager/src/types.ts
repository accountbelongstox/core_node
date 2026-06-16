export type Language = 'en' | 'zh' | 'ja';

export type TabType =
  | 'voice_player'
  | 'subtitle'
  | 'queue_manager'
  | 'window_automation'
  | 'code_sync'
  | 'task_queue'
  | 'video_extract'
  | 'ai_status'
  | 'translation_queue'
  | 'settings';

export interface QueueItem {
  id: string;
  index: number;
  text: string;
  category: 'Voice' | 'Image' | 'File' | 'Task' | 'Video' | 'Window';
  playCount: number;
  created: string;
  status: 'pending' | 'completed' | 'failed' | 'processing';
  audioUrl?: string; // Cache local base64/blob audio if generated
  metadata?: {
    duration?: string;
    size?: string;
    fileName?: string;
    summary?: string;
    targetWindow?: string;
    lang?: string;
  };
}

export interface PlayerState {
  isPlaying: boolean;
  speed: number;
  volume: number;
  playCount: number;
  currentAudioFile: string;
  currentIndex: number;
}

export interface AppSettings {
  lang: Language;
  theme: 'light' | 'dark';
  isConnected: boolean;
  monitorClipboard: boolean;
  scheduledScreenshot: boolean;
  screenshotInterval: number; // in seconds
  notebooklmAutoConvert: boolean;
  glassOpacity: number; // 0 to 100 for custom styling
  blurStrength: number; // in pixels for backdrop-blur
  accentColor: 'indigo' | 'rose' | 'emerald' | 'amber' | 'cyan' | 'purple';
}

// --- Live (pycore RPC WebSocket) ----------------------------------------- #
export interface LogLine {
  message: string;
  level: string;
  color: string;
  ts: number;
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
  model: string;          // auto | tiny | base | small | medium | large-v3 | turbo
  formats: string[];      // mp3 | opus | aac | vorbis
  lang: string;           // e.g. 'auto' or 'en'
  extensions?: string[];  // selected video extension filter, e.g. ['.mp4']
}

export interface VideoExtractHistory {
  success: boolean;
  base_dir: string;
  entries: VideoExtractEntry[];
  last_options: Partial<VideoExtractOptions> | Record<string, unknown>;
  error?: string;
}

export interface WhisperLanguage {
  code: string;           // e.g. 'en'
  name: string;           // e.g. 'English'
}

export interface VideoExtractCapabilities {
  success: boolean;
  models: string[];           // 'auto' + only the models installed on the backend (back-compat)
  all_models: string[];       // full model catalog (ascending capability); non-installed render disabled
  installed_models: string[]; // installed models (without 'auto')
  default_model: string;
  languages: WhisperLanguage[]; // English first, then alphabetical
  default_lang: string;
  ffmpeg_found: boolean;
  extensions?: string[];          // all supported video extensions, e.g. '.mp4'
  default_extensions?: string[];  // extensions checked by default
  error?: string;
}

// --- Video extract: system resources & run snapshot --------------------- #
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

export interface VideoExtractCurrent {
  rel: string;
  src_size?: number;
  out_dir?: string;
  srt?: string | null;
  audios?: Array<{ path: string; size: number }>;
  mp4?: string | null;
  file_elapsed?: number;
  srt_pct?: number | null;       // live transcription % (0–100) of the current file
  segments_dir?: string | null;  // abs dir of the current file's segment/subtitle map
}

// --- Video extract: segment ↔ subtitle mapping --------------------------- #
export interface VideoExtractSubtitle {
  idx: number;
  start: number;   // seconds
  end: number;     // seconds
  text: string;
}

export interface VideoExtractSegment {
  index: number;
  start: number;            // seconds
  end: number;              // seconds
  full_mp4?: string | null; // full-resolution clip filename (relative to segments_dir)
  mp4: string;              // 2×2 (downscaled) clip filename
  mp3: string;              // audio-only filename
  subtitle_count: number;
  subtitles: VideoExtractSubtitle[];
}

// Whole-file outputs (live in the output dir = parent of segments_dir).
export interface VideoExtractFiles {
  full_mp4?: string | null;
  tiny_mp4?: string | null;
  mp3?: string | null;
  srt?: string | null;
}

export interface VideoExtractMapping {
  video: string;
  stem: string;
  duration: number;
  max_segment_sec: number;
  segment_count: number;
  segments: VideoExtractSegment[];
  files?: VideoExtractFiles;
}

export interface VideoExtractSegmentsResponse {
  success: boolean;
  mapping?: VideoExtractMapping;
  error?: string;
}

export interface VideoExtractSnapshot {
  processed?: number;
  total?: number;
  output?: string;
  root?: string;
  elapsed_total?: number;
  eta?: number;
  current?: VideoExtractCurrent | null;
  stats?: Record<string, number>;
  [k: string]: unknown;
}

export type VideoExtractOpenKind =
  | 'output' | 'file' | 'file_dir' | 'file_output_dir' | 'subtitle';

export interface VideoExtractOpenResponse {
  success: boolean;
  error?: string;
}

export interface PickPathResult {
  success: boolean;
  path: string | null;    // chosen absolute path, or null when canceled
  canceled: boolean;
  error?: string;
}

// --- Code sync (peer mesh) ----------------------------------------------- #
export type CodeSyncRole = 'dev' | 'client';

export interface CodeStats {
  files: number;
  bytes: number;
  last_modified: number; // seconds; may be 0 until the background scan finishes
}

export interface SelfStatus {
  id: string;
  name: string;
  role: CodeSyncRole;
  hostname: string;
  lan_ip: string;
  distributing: boolean;
  config_version: number;
  skip_update?: boolean; // this end is temporarily rejecting incoming code updates
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

// A peer's probed live status (may be null/partial when unreachable).
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
  // How this peer is connected: 'probe' = we reached it; 'heartbeat' = it reported
  // in to us (NAT-friendly); 'both' = both directions; null/absent = offline.
  via?: 'probe' | 'heartbeat' | 'both' | null;
  // When the peer last sent us a heartbeat (seconds/ms), independent of last_seen.
  last_checkin?: number | null;
  pending?: boolean;
  status?: PeerLiveStatus | null;
}

export interface CodeSyncSnapshot {
  self: SelfStatus | null;
  peers: PeerStatus[];
  version: number;
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
  excluded_dirs: string[];            // directory names pruned at any depth
  excluded_files: string[];           // file names excluded at any depth
  excluded_extensions: string[];      // file suffixes (".pyc", ".log", ...)
  excluded_path_substrings: string[]; // exclude any path whose relpath contains this
  apply_gitignore: boolean;           // also honour the repo root .gitignore
}

export interface SyncSettingsResponse {
  success: boolean;
  settings: SyncSettings;
  presets: SyncSettings;       // the code-frozen defaults (for "Reset")
  override_path: string;
  overridden: boolean;         // true once a per-machine override file exists
  error?: string;
}

export interface SyncLogEntry {
  action?: string;             // received | skipped | error | client | ...
  file_path?: string;
  reason?: string;
  details?: string;
  timestamp?: number | string | null;
}

// --- Code sync (legacy server/client/disabled, kept for back-compat) ------ #
export type CodeSyncMode = 'server' | 'client' | 'disabled';

export interface CodeSyncServerStatus {
  running?: boolean;
  root_dir?: string;
  scan_interval?: number;
  clients_count?: number;
  clients?: Array<Record<string, unknown>>;
  total_files?: number;
  [k: string]: unknown;
}

export interface CodeSyncClientStatus {
  running?: boolean;
  client_id?: string;
  target_dir?: string;
  server_port?: number;
  scan_interval?: number;
  enable_backup?: boolean;
  servers_count?: number;
  total_received_files?: number;
  logs?: string[];
  [k: string]: unknown;
}

export interface CodeSyncStatus {
  success: boolean;
  mode: CodeSyncMode;
  server?: CodeSyncServerStatus | null;
  client?: CodeSyncClientStatus | null;
  error?: string;
}

// --- Auto-start on boot -------------------------------------------------- #
export interface AutostartStatus {
  success?: boolean;
  enabled: boolean;
  supported: boolean;
  platform?: string;
  scope?: string;      // 'all-users' | 'current-user'
  location?: string;   // resolved shortcut / .desktop path
  message?: string;
  error?: string;
}

// --- AI status (provider availability probe) ----------------------------- #
// Mirrors the pycore GET /api/local/ai/probe contract exactly:
//   { providers: [ { name, configured, available, key_masked, models, error, latency_ms } ] }
// key_masked is already masked server-side (first4…last4).
export interface AiProvider {
  name: string;
  configured: boolean;
  available: boolean;
  key_masked: string | null;
  models: string[];
  error: string | null;
  latency_ms: number | null;
}

export interface AiProbeResponse {
  providers: AiProvider[];
  error?: string;
}

// --- AI chat (provider confirm) ------------------------------------------ #
// Mirrors the pycore POST /api/local/ai/chat contract:
//   request : { provider, message? | messages?, model? }
//   response: { success, provider, model, text, latency_ms, error }
export type AiChatRole = 'system' | 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiChatResponse {
  success: boolean;
  provider: string;
  model: string;
  text: string;
  latency_ms: number | null;
  error: string | null;
}

// --- Translation queue (Laravel pending queue, steered via pycore) -------- #
// Mirrors the pycore GET /api/local/translation/queue contract exactly:
//   { summary, items[], laravel_reachable, age_ms }
// The backend owns dedup/bump logic; `recently_bumped` flags items whose
// priority just jumped (e.g. via qyApp) so the UI can highlight them live.
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
  age_ms: number;
  error?: string;
}

// POST /api/local/translation/queue/priority and .../stack response shape.
export interface TranslationQueueActionResponse {
  success: boolean;
  task_id?: string;
  error?: string;
}

export type TranslationDictionary = Record<Language, Record<string, string>>;

// Translations live in src/i18n/translations.ts (see that file). Types only here.
