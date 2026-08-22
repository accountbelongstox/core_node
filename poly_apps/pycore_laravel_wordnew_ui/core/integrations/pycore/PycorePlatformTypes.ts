/**
 * Pycore Platform API types.
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
  // processor reads `config.subtitle_source` (default 'api_first').
  subtitle_source?: 'api_first' | 'whisper';
  // Persisted multi-language correspondence selection (the Laravel-sync
  // language multi-select); defaults to en+zh when absent.
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
// from the primary cues). Per-source outcome.
export interface SubtitleFillSourceResult {
  source: string;
  filled: Record<string, string>;  // lang -> written track path
  skipped: string[];               // langs already present
  failed: Record<string, string>;  // lang -> error
}

// The HTTP returns EITHER a single-source summary (flat fields) OR a multi-path
// aggregate (`count` + nested `results` summaries). Both shapes are unioned via
// optional fields so the FE can read whichever the backend sent.
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
// THREAD_BUS event (mirrors `video_extract_sync`).
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
