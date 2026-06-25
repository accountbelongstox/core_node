/**
 * PycoreApi — pycore service API client for the dashboard's pycore-manager end.
 *
 * Talks DIRECTLY to the pycore backend contract through the `/pyapi/*` reverse
 * proxy (Vite dev / webview — see vite.config.ts). The legacy desktop-manager
 * Node adapter (`/api/queue`, `/api/tts`, `/api/runtime` served by server.ts)
 * does NOT exist in this unified shell, so the voice-subtitle queue endpoints
 * map pycore's raw `/voice-subtitle/*` responses to the React shapes HERE
 * (mapQueueSnapshot). All paths are relative so the same code works inside a
 * webview or a plain browser.
 *
 * Self-contained: types come from `./pycoreTypes`, never the original app.
 */
import type {
  QueueItem, VideoExtractHistory, VideoExtractMode, VideoExtractOptions,
  VideoExtractCapabilities, PickPathResult, VideoExtractSegmentsResponse,
  SystemResourcesResponse, VideoExtractOpenKind, VideoExtractOpenResponse,
  CodeSyncRole, CodeSyncPeersResponse, CodeSyncCandidate,
  SyncSettings, SyncSettingsResponse, SyncLogEntry, FileTreeResponse, PeerFileTreeResponse,
  AutostartStatus, AutostartTarget, AiProbeResponse, AiProvider, AiBalance, AiBalanceResponse, AiRateLimitsResponse, AiChatMessage, AiChatResponse, AiGatewayStatus,
  AiUsageResponse,
  AiImageResponse, ImageHistoryResponse, ImageHistoryClearResponse, ImageHistoryDeleteResponse,
  AiKeysResponse, AiKeySetRequest, AiKeySetResponse, AiKeyDeleteResponse, AiKeyResetCooldownResponse,
  OcrStatus, TtsStatus, TtsSettings, TtsTestResponse, SttStatus, SttTestResponse, SpeechHistoryResponse, RevealResponse, CapabilityStatus, SystemInfo, OpenDirResponse,
  TranslationQueueResponse, TranslationQueueActionResponse,
  LocalTaskDetailResponse, PycoreGlobalTaskDetailResponse,
  AssistStatus, AssistConfigPatch, AssistConfigResponse, AssistCycleResponse,
  PosterStatus, PosterTestResponse,
  TranslateStatus, TranslateResponse, TranslateAiResponse,
  ImageSearchStatus, ImageSearchResponse, ImageSearchCompareResponse,
  ImageSearchHistoryResponse, ImageSearchHistoryDeleteResponse, ImageSearchHistoryClearResponse,
  SubtitleSearchStatus, SubtitleSearchProbe, SubtitleSearchOptions, SubtitleSearchResponse,
  SubtitleDownloadResponse, SubtitleSearchHistoryResponse,
  SubtitleSearchHistoryDeleteResponse, SubtitleSearchHistoryClearResponse,
  SubtitleProvidersResponse, SubtitleProviderProbe,
  SubtitleCacheStats, SubtitleCacheClearResponse,
  TranslateHistoryResponse, TranslateHistoryDeleteResponse, TranslateHistoryClearResponse,
  PcQueueOverview, PcCapabilitySettings, PcCapabilityKey,
  PcCapabilitySaveResponse, PcCapabilityOptions,
  PcTaskRecentResponse, PcTaskClearResponse,
} from './pycoreTypes';

import { MasterApiClient } from '../base';
import type { MasterRequestOptions } from '../base';
import { rewritePycoreEndpoint } from './pycoreTarget';

/**
 * Structural opt-in on the master API base client (core/api-libs/base) for
 * pycore's HTTP parts (the WS RPC path is untouched). PASS-THROUGH today:
 * queue DISABLED (no queueStorageKey) and ceiling 0 = wait forever, exactly
 * matching the previous plain `fetch` behavior (no timeout) — no behavior
 * change in this pass. To enable later, pass a queueStorageKey (e.g.
 * 'pycore_api_queue') and drop the ceiling override.
 */
class PycoreMasterClient extends MasterApiClient {
  /** All paths are relative (`/pyapi/*` reverse proxy) — empty base URL. */
  protected resolveBaseUrl(): string {
    return '';
  }

  /**
   * Re-point every pycore HTTP call at the selected target (pycoreTarget):
   * local leaves `/pyapi/*` untouched; a remote target rewrites it to
   * `http(s)://<host>:59000/...` so the whole pycore-manager manages that node.
   */
  async request(endpoint: string, options: MasterRequestOptions = {}): Promise<Response> {
    return super.request(rewritePycoreEndpoint(endpoint), options);
  }
}
export const pycoreMasterClient = new PycoreMasterClient({ defaultCeilingMs: 0 });

/**
 * Dead-socket ceiling for status GET reads (ms). POST writes keep the forever
 * default (0) because some legitimately run long (AI image generation, TTS
 * synth). A status GET must NEVER hang forever — without this a single stalled
 * read (e.g. pycore restarting, or a first-touch worker init that blocks on
 * DNS) sticks every panel on "Loading…" with no recovery. On abort the caller's
 * catch shows its error fallback + Refresh instead of an eternal spinner.
 */
const GET_CEILING_MS = 25_000;

async function getJSON<T>(url: string): Promise<T> {
  const r = await pycoreMasterClient.request(url, { ceilingMs: GET_CEILING_MS });
  return (await r.json()) as T;
}
async function postJSON<T>(url: string, body: unknown = {}): Promise<T> {
  const r = await pycoreMasterClient.request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await r.json()) as T;
}
async function deleteJSON<T>(url: string): Promise<T> {
  const r = await pycoreMasterClient.request(url, { method: 'DELETE' });
  return (await r.json()) as T;
}

export interface QueueResponse {
  success: boolean;
  items?: QueueItem[];
  currentIndex?: number;
  enabled?: boolean;
  error?: string;
}

export interface RuntimeInfo { wsUrl: string; apiBase: string; }

// --- voice-subtitle snapshot mapping ------------------------------------- #
// pycore freeform category string -> React QueueItem category badge.
function mapCategory(c: string): QueueItem['category'] {
  const m: Record<string, QueueItem['category']> = {
    normal: 'Voice', voice: 'Voice', text: 'Voice',
    image: 'Image', file: 'File', task: 'Task', video: 'Video', window: 'Window',
  };
  return m[(c || '').toLowerCase()] || 'Voice';
}

/**
 * Map a raw pycore queue snapshot ({queue, current_index, enabled} — the shape
 * of both GET /voice-subtitle/queue and the `voice_subtitle_queue_update` WS
 * event) to the React QueueResponse. Indices are 0-BASED to stay aligned with
 * the backend's current_index / set-index / remove-items contract.
 */
export function mapQueueSnapshot(data: any): QueueResponse {
  const raw: any[] = Array.isArray(data?.queue) ? data.queue : [];
  const items: QueueItem[] = raw.map((it: any, i: number) => ({
    id: `item_${i}`,
    index: i,
    text: it?.text || '',
    category: mapCategory(it?.category),
    playCount: it?.play_count || 0,
    created: it?.created_at || '',
    // The pipeline fills audio_path when TTS synthesis finished; until then the
    // item is still being processed (no more hardcoded "completed").
    status: it?.audio_path ? 'completed' : 'processing',
    audioUrl: it?.audio_path
      ? `/pyapi/voice-subtitle/audio?path=${encodeURIComponent(it.audio_path)}`
      : undefined,
    metadata: {
      lang: it?.lang,
      // Which AI produced this item's text (gateway attribution), if any.
      ai: it?.ai_provider
        ? `${it.ai_provider}${it.ai_model ? `/${it.ai_model}` : ''}`
        : undefined,
    },
  }));
  return {
    success: data?.success !== false,
    items,
    currentIndex: typeof data?.current_index === 'number' ? data.current_index : 0,
    enabled: data?.enabled === true,
  };
}

export interface SystemSettingsResponse {
  success: boolean;
  settings: Record<string, unknown> | null;
  error?: string;
}

// --- Books document analyze/preview (pycore /api/local/books) ------------- #
export interface BookLanguageRow { script: string; code: string; chars: number; ratio: number; }
export interface BookTopWord { word: string; count: number; }
export interface BookTextStats {
  char_count: number; char_count_no_space: number;
  word_count: number; unique_word_count: number;
  sentence_count: number; unique_sentence_count: number;
  line_count: number; paragraph_count: number;
  primary_language: string; languages: BookLanguageRow[];
  top_words: BookTopWord[]; truncated: boolean;
}
export interface BookFileEntry { path: string; rel: string; name: string; ext: string; size_bytes: number; }
export interface BooksScanResponse {
  success: boolean; root: string; mode: 'file' | 'folder' | '';
  files: BookFileEntry[]; count: number;
  formats: string[]; supported_formats: string[]; error?: string;
}
export interface BookFileAnalysis {
  path: string; rel: string; name: string; ext: string; size_bytes: number;
  stats: BookTextStats | null; preview: string; error?: string | null;
}
export interface BooksAnalyzeResponse {
  success: boolean; root: string; mode: 'file' | 'folder' | '';
  files: BookFileAnalysis[]; aggregate: BookTextStats | null;
  scanned: number; analyzed: number; truncated_files: boolean; error?: string;
}
export interface BooksSupportedFormatsResponse { success: boolean; formats: string[]; error?: string; }
export interface BooksAnalyzeOptions { formats?: string[]; language?: string; languages?: string[]; preview_chars?: number; max_files?: number; persist?: boolean; }

// --- Books chapter -> correspondence-slot tree (spec v3 §7/§9) ----------- #
// A book is rendered as Chapter[] -> Slot[]. Each slot is a single
// correspondence cell shared across the checked languages: `langs[code]` is the
// text for that language, or `null` where the book has no correspondence (the
// FE renders a blank). `grain` preserves the prior sentence typing (cue/sentence).
export interface BookChapter {
  chapter_index: number;
  sentence_count?: number;
  // Flat title (legacy) and the v3.1 per-language title map (code -> title|null).
  title?: string | null;
  titles?: Record<string, string | null>;
}
export interface BookSlot {
  corr_id: string;
  grain: 'cue' | 'sentence';
  seq: number;
  chapter_index?: number;
  primary_language?: string | null;
  langs: Record<string, string | null>;
}
export interface BookSourceState {
  path: string; mode: string; source_key: string; language?: string | null;
  submission_state: 'draft' | 'synced'; added_at?: number | null;
  analyzed_at?: number | null; synced_at?: number | null;
  summary?: { scanned: number; analyzed: number; mode: string; aggregate: BookTextStats | null; files: any[] } | null;
}
export interface BooksStateResponse { success: boolean; sources: BookSourceState[]; last_options: Record<string, unknown>; error?: string; }
export interface BookSubmitItem { path: string; files: number; sentences: number; words: number; success: boolean; errors?: string[] | null; }
export interface BooksSubmitResponse { success: boolean; items: BookSubmitItem[]; total_sentences: number; total_words: number; error?: string; }
export interface BooksListResponse {
  success: boolean; kind: string; total: number; start: number; limit: number;
  items: any[]; totals: Record<string, number>;
  // When kind === 'chapters' the items are BookChapter[]; when listing sentences
  // scoped to a chapter the items are BookSlot[] (selected_languages echoes the
  // checked language set so the tree can render every column, blank where null).
  chapters?: BookChapter[];
  selected_languages?: string[];
  error?: string;
}

// --- CoreBook portable format (pycore /api/local/corebook) ---------------- #
export interface CoreBookCompletenessLang { text: number; audio: number; }
export interface CoreBookMissing { kind: 'language' | 'audio'; language: string; count: number; }
export interface CoreBookCompleteness {
  languages: Record<string, CoreBookCompletenessLang>;
  missing: CoreBookMissing[];
}
export interface CoreBookSummary {
  source_key?: string;
  source_type: string;
  title?: string;
  language?: string;
  selected_languages: string[];
  chapter_count: number;
  slot_count: number;
  completeness: CoreBookCompleteness;
  updated_at?: number;
}
export interface CoreBookListResponse { success: boolean; items: CoreBookSummary[]; error?: string; }
export interface CoreBookConvertRequest {
  path: string; language?: string; languages?: string[]; source_type?: string; text?: string;
}
export interface CoreBookConvertResponse { success: boolean; summary?: CoreBookSummary; error?: string; }
export interface CoreBookGetResponse {
  success: boolean; summary?: CoreBookSummary;
  source: Record<string, unknown>; chapters: BookChapter[]; slots: BookSlot[];
  total_slots: number; start: number; limit: number; error?: string;
}
export interface CoreBookDeleteResponse { success: boolean; removed: boolean; error?: string; }
export interface CoreBookAddLanguageRequest {
  source_key: string; target_language: string; source_language?: string;
  provider?: string; chunk_size?: number; grain?: string;
}
export interface CoreBookFillAudioRequest {
  source_key: string; languages: string[]; rate?: string; grain?: string;
}
export interface CoreBookEnrichResponse {
  success: boolean; result: Record<string, any>; summary?: CoreBookSummary; error?: string;
}
export interface CoreBookSubmitRequest {
  source_key: string; upload_audio?: boolean; request_assist?: boolean;
  assist_items?: { request_type: string; language?: string }[];
}
export interface CoreBookSubmitResponse { success: boolean; result: Record<string, any>; error?: string; }

export const pycoreApi = {
  // --- queue (pycore /voice-subtitle, mapped via mapQueueSnapshot) --------- #
  getQueue: async (): Promise<QueueResponse> =>
    mapQueueSnapshot(await getJSON<any>('/pyapi/voice-subtitle/queue')),
  clearQueue: () =>
    postJSON<{ success: boolean; message?: string }>('/pyapi/voice-subtitle/clear', {}),
  removeQueueItems: (indices: number[]) =>
    postJSON<{ success: boolean; removed_count?: number; error?: string }>(
      '/pyapi/voice-subtitle/remove-items', { indices }),
  setQueueIndex: (index: number) =>
    postJSON<{ success: boolean; current_index?: number; error?: string }>(
      '/pyapi/voice-subtitle/set-index', { index }),
  incrementPlayCount: (index: number) =>
    postJSON<{ success: boolean }>('/pyapi/voice-subtitle/increment-play-count', { index }),

  // --- playback (backend desktop player auto-plays the queue when enabled) - #
  togglePlayback: () =>
    postJSON<{ success: boolean; enabled: boolean; message?: string }>(
      '/pyapi/voice-subtitle/toggle', {}),

  // --- AI auto-subtitle monitors ------------------------------------------- #
  // Screenshot monitor: captures the screen every N seconds, the AI describes
  // the image, and the description runs through translate→TTS into the queue.
  // The recognition/output language is the SINGLE parameter that drives the
  // whole pipeline: OCR recognition → translation → TTS subtitle.
  getScreenshotMonitorStatus: () =>
    getJSON<{ success: boolean; enabled: boolean; interval: number; lang?: string }>(
      '/pyapi/voice-subtitle/screenshot-monitor/status'),
  startScreenshotMonitor: (interval: number, lang = 'en') =>
    postJSON<{ success: boolean; message?: string }>(
      '/pyapi/voice-subtitle/screenshot-monitor/start', { interval, lang }),
  stopScreenshotMonitor: () =>
    postJSON<{ success: boolean; message?: string }>(
      '/pyapi/voice-subtitle/screenshot-monitor/stop', {}),
  // Change the recognition/output language live (applies on the next capture).
  setScreenshotLanguage: (lang: string) =>
    postJSON<{ success: boolean; lang: string }>(
      '/pyapi/voice-subtitle/screenshot-monitor/language', { lang }),
  // Clipboard monitor: copied sentences are rewritten in English by the AI and
  // enqueued the same way.
  getClipboardMonitorStatus: () =>
    getJSON<{ success: boolean; enabled: boolean }>(
      '/pyapi/voice-subtitle/clipboard-monitor/status'),
  startClipboardMonitor: () =>
    postJSON<{ success: boolean; message?: string }>(
      '/pyapi/voice-subtitle/clipboard-monitor/start', {}),
  stopClipboardMonitor: () =>
    postJSON<{ success: boolean; message?: string }>(
      '/pyapi/voice-subtitle/clipboard-monitor/stop', {}),

  // --- TTS (pycore voice-subtitle add-text pipeline) ---------------------- #
  tts: async (text: string, langs: string[] = ['en'], category = 'normal') => {
    const r = await postJSON<{ success?: boolean; task_id?: string }>(
      '/pyapi/voice-subtitle/add-text', { text, langs, category });
    return {
      success: r?.success !== false,
      queued: true,
      task_id: r?.task_id,
      message: 'Queued for pycore TTS',
    };
  },

  // --- generic pycore passthrough (video-extract/code-sync/tasks) --------- #
  pyGet: <T = any>(path: string) => getJSON<T>('/pyapi' + path),
  pyPost: <T = any>(path: string, body: unknown = {}) => postJSON<T>('/pyapi' + path, body),

  ping: () => getJSON<{ success?: boolean; status?: string }>('/pyapi/ping'),

  // --- runtime (backend WS url + api base) -------------------------------- #
  // No server round-trip: the WS connects directly to the backend port and the
  // REST base is always the /pyapi proxy (same convention as PycoreWs).
  getRuntime: (): Promise<RuntimeInfo> => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const isSandbox = location.hostname.includes('asia-southeast1.run.app') || location.hostname.includes('run.app') || location.port === '3000';
    const wsUrl = isSandbox
      ? `${proto}://${location.host}/pyapi/rpc/ws`
      : `${proto}://${location.hostname}:59000/rpc/ws`;
    return Promise.resolve({
      wsUrl,
      apiBase: '/pyapi',
    });
  },

  // --- system settings (persisted on the pycore backend) ------------------ #
  getSystemSettings: () =>
    getJSON<SystemSettingsResponse>('/pyapi/api/local/user-data/system-settings'),
  setSystemSettings: (settings: Record<string, unknown>) =>
    postJSON<{ success: boolean; error?: string }>(
      '/pyapi/api/local/user-data/system-settings', { settings }),

  // --- video extract history / options ------------------------------------ #
  getVideoExtractHistory: () =>
    getJSON<VideoExtractHistory>('/pyapi/api/local/user-data/video-extract'),
  addVideoExtractEntry: (path: string, mode: VideoExtractMode) =>
    postJSON<VideoExtractHistory>(
      '/pyapi/api/local/user-data/video-extract/add', { path, mode }),
  removeVideoExtractEntry: (path: string) =>
    postJSON<VideoExtractHistory>(
      '/pyapi/api/local/user-data/video-extract/remove', { path }),
  setVideoExtractOptions: (options: Partial<VideoExtractOptions>) =>
    postJSON<{ success: boolean; error?: string }>(
      '/pyapi/api/local/user-data/video-extract/options', { options }),

  // --- video extract capabilities ----------------------------------------- #
  getVideoExtractCapabilities: () =>
    getJSON<VideoExtractCapabilities>('/pyapi/api/local/video-extract/capabilities'),

  // --- video extract: open a path in the OS file manager ------------------ #
  openVideoExtractPath: (kind: VideoExtractOpenKind, path?: string) =>
    postJSON<VideoExtractOpenResponse>(
      '/pyapi/api/local/video-extract/open', { kind, path }),

  // --- video extract: segment ↔ subtitle map for the current file --------- #
  // `languages` (>=1 codes, includes the primary) requests the multi-language
  // correspondence slots per cue; omitted/empty → the legacy single-language map.
  getVideoExtractSegments: (path: string, languages?: string[]) =>
    postJSON<VideoExtractSegmentsResponse>(
      '/pyapi/api/local/video-extract/segments', { path, languages }),

  // --- video extract: pause / resume / cancel a running task -------------- #
  pauseVideoExtractTask: (taskId: string) =>
    postJSON<{ success: boolean; error?: string }>(
      `/pyapi/api/local/video-extract/tasks/${taskId}/pause`),
  resumeVideoExtractTask: (taskId: string) =>
    postJSON<{ success: boolean; error?: string }>(
      `/pyapi/api/local/video-extract/tasks/${taskId}/resume`),
  cancelVideoExtractTask: (taskId: string) =>
    postJSON<{ success: boolean; error?: string }>(
      `/pyapi/api/local/video-extract/tasks/${taskId}/cancel`),

  // --- live system resources (CPU / MEM / GPU) ---------------------------- #
  getSystemResources: () =>
    getJSON<SystemResourcesResponse>('/pyapi/api/local/system/resources'),

  // --- native OS folder/file picker --------------------------------------- #
  pickPath: (mode: VideoExtractMode, initial?: string) =>
    postJSON<PickPathResult>(
      '/pyapi/api/local/user-data/pick-path', { mode, initial }),

  // --- Books document analyze / preview (local, read-only; pre-sync) ------- #
  // supported-formats drives the format-filter sidebar; scan lists files fast
  // (no extraction); analyze extracts text + multi-language stats + a preview
  // for a single file or a whole folder (capped by max_files).
  getBooksSupportedFormats: () =>
    getJSON<BooksSupportedFormatsResponse>('/pyapi/api/local/books/supported-formats'),
  booksScan: (path: string, formats?: string[]) =>
    postJSON<BooksScanResponse>('/pyapi/api/local/books/scan', { path, formats }),
  booksAnalyze: (path: string, opts: BooksAnalyzeOptions = {}) =>
    postJSON<BooksAnalyzeResponse>('/pyapi/api/local/books/analyze', { path, ...opts }),
  // Persisted Books state (sources + compact analysis + submission state) — the
  // UI reloads this on mount so history survives a page switch / reopen.
  getBooksState: () => getJSON<BooksStateResponse>('/pyapi/api/local/books/state'),
  booksStateAdd: (path: string, mode: string, language?: string) =>
    postJSON<BooksStateResponse>('/pyapi/api/local/books/state/add', { path, mode, language }),
  booksStateRemove: (path: string) =>
    postJSON<BooksStateResponse>('/pyapi/api/local/books/state/remove', { path }),
  // One-shot batch submit to laravel_main (builds the model_version:3 payload
  // server-side). `languages` is the checked correspondence set (>=1, includes
  // the detected primary language) — empty slots are emitted as null per spec §5.
  // `source_type` marks the ingest's media kind (default 'book'; 'document' for
  // the Add Document flow) so the backend keys the per-language sentence rows by
  // the right source_type (spec §7). NOTE: pycore /books/submit must honor this
  // — see the backend-gap report.
  booksSubmit: (paths?: string[], language?: string, languages?: string[], source_type?: string) =>
    postJSON<BooksSubmitResponse>('/pyapi/api/local/books/submit', { paths, language, languages, source_type }),
  // Paginated drill-down into a source's lists (words/sentences/languages), plus
  // the chapter -> sentence tree: kind='chapters' lists BookChapter[]; passing a
  // chapter_index (with kind='sentences'|'cues') returns that chapter's BookSlot[]
  // carrying every selected language side by side (blank where null). Cached
  // server-side per source so paging is cheap.
  booksList: (
    path: string, kind: string, start = 0, limit = 100,
    opts: { formats?: string[]; refresh?: boolean; max_files?: number;
            chapter_index?: number; languages?: string[] } = {},
  ) => postJSON<BooksListResponse>('/pyapi/api/local/books/list', { path, kind, start, limit, ...opts }),
  // Drag-drop fallback for sandboxed browsers (no File.path): upload the bytes;
  // the backend stages them to disk and returns staged paths + analysis.
  // `languages` (>=1 codes) requests the per-language correspondence; `source_type`
  // marks the media kind staged ('book' default, 'document' for the Add Document
  // flow) so a later booksSubmit ingests it under the right source_type.
  booksAnalyzeUpload: async (
    files: File[],
    opts: { language?: string; languages?: string[]; preview_chars?: number; persist?: boolean; source_type?: string } = {},
  ): Promise<BooksAnalyzeResponse> => {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f, f.name));
    if (opts.language) fd.append('language', opts.language);
    (opts.languages || []).forEach((l) => fd.append('languages[]', l));
    if (opts.preview_chars != null) fd.append('preview_chars', String(opts.preview_chars));
    if (opts.persist) fd.append('persist', 'true');
    if (opts.source_type) fd.append('source_type', opts.source_type);
    // No explicit Content-Type — the browser sets the multipart boundary.
    const r = await pycoreMasterClient.request('/pyapi/api/local/books/analyze-upload', {
      method: 'POST', body: fd,
    });
    return (await r.json()) as BooksAnalyzeResponse;
  },

  // --- CoreBook portable format (pycore /api/local/corebook) -------------- #
  // Convert a document -> a saved CoreBook (1 book / N chapters / multi-language
  // / per-language audio), enrich it (add a language via batched AI translation;
  // fill audio locally via TTS) and submit it (whole or partial) to laravel_main.
  corebookList: () =>
    getJSON<CoreBookListResponse>('/pyapi/api/local/corebook/list'),
  corebookConvert: (req: CoreBookConvertRequest) =>
    postJSON<CoreBookConvertResponse>('/pyapi/api/local/corebook/convert', req),
  corebookGet: (source_key: string, start = 0, limit = 0) =>
    getJSON<CoreBookGetResponse>(
      `/pyapi/api/local/corebook/get?source_key=${encodeURIComponent(source_key)}`
      + `&start=${start}&limit=${limit}`),
  corebookAddLanguage: (req: CoreBookAddLanguageRequest) =>
    postJSON<CoreBookEnrichResponse>('/pyapi/api/local/corebook/add-language', req),
  corebookFillAudio: (req: CoreBookFillAudioRequest) =>
    postJSON<CoreBookEnrichResponse>('/pyapi/api/local/corebook/fill-audio', req),
  corebookSubmit: (req: CoreBookSubmitRequest) =>
    postJSON<CoreBookSubmitResponse>('/pyapi/api/local/corebook/submit', req),
  corebookDelete: async (source_key: string): Promise<CoreBookDeleteResponse> => {
    const r = await pycoreMasterClient.request(
      `/pyapi/api/local/corebook/delete?source_key=${encodeURIComponent(source_key)}`,
      { method: 'DELETE' });
    return (await r.json()) as CoreBookDeleteResponse;
  },

  // --- code sync (peer mesh: dev/client roles + peer list) ---------------- #
  getPeers: () => getJSON<CodeSyncPeersResponse>('/pyapi/code-sync/peers'),
  addPeer: (peer: { name: string; host: string; port: number; role: CodeSyncRole }) =>
    postJSON<CodeSyncPeersResponse>('/pyapi/code-sync/peers/add', peer),
  removePeer: (id: string) =>
    postJSON<CodeSyncPeersResponse>('/pyapi/code-sync/peers/remove', { id }),
  updatePeer: (patch: { id: string; name?: string; host?: string; port?: number; role?: CodeSyncRole }) =>
    postJSON<CodeSyncPeersResponse>('/pyapi/code-sync/peers/update', patch),
  setRole: (role: CodeSyncRole) =>
    postJSON<{ success: boolean; role: CodeSyncRole; error?: string }>(
      '/pyapi/code-sync/role', { role }),
  setDistribute: (enabled: boolean) =>
    postJSON<{ success: boolean; distributing: boolean; message?: string; error?: string }>(
      '/pyapi/code-sync/distribute', { enabled }),
  setSkipUpdate: (enabled: boolean) =>
    postJSON<{ success: boolean; skip_update: boolean; message?: string; error?: string }>(
      '/pyapi/code-sync/skip-update', { enabled }),
  discoverPeers: () =>
    postJSON<{ success: boolean; candidates: CodeSyncCandidate[]; error?: string }>(
      '/pyapi/code-sync/discover', {}),

  // --- code sync filter settings (presets + per-machine .data override) --- #
  getSyncSettings: () => getJSON<SyncSettingsResponse>('/pyapi/code-sync/settings'),
  setSyncSettings: (patch: Partial<SyncSettings>) =>
    postJSON<{ success: boolean; settings: SyncSettings; error?: string }>(
      '/pyapi/code-sync/settings', patch),
  resetSyncSettings: () =>
    postJSON<{ success: boolean; settings: SyncSettings; error?: string }>(
      '/pyapi/code-sync/settings/reset', {}),
  getSyncLogs: (limit = 100) =>
    getJSON<{ success: boolean; role: CodeSyncRole; logs: SyncLogEntry[] }>(
      `/pyapi/code-sync/logs?limit=${limit}`),

  // --- code sync file structure (live tree of the synced set) ------------- #
  getFileTree: () => getJSON<FileTreeResponse>('/pyapi/code-sync/file-tree'),
  // Dev-side: a specific client's received tree + drift vs this dev's synced set.
  getPeerFileTree: (peerId: string) =>
    getJSON<PeerFileTreeResponse>(`/pyapi/code-sync/peer-file-tree?peer_id=${encodeURIComponent(peerId)}`),

  // --- AI provider catalog (NO network test — cheap, never spends quota) --- #
  // Renders the grid on page load; live availability is tested on demand only.
  getAiCatalog: () => getJSON<AiProbeResponse>('/pyapi/api/local/ai/catalog'),

  // --- AI provider availability probe (live test) ------------------------- #
  // probeAi() tests ALL providers (the "Test all" button, rate-aware + cached).
  probeAi: (refresh = false) =>
    getJSON<AiProbeResponse>(`/pyapi/api/local/ai/probe${refresh ? '?refresh=1' : ''}`),

  // Test ONE provider (per-card "Test"): live, never cached, rate-aware.
  probeAiOne: (provider: string) =>
    getJSON<AiProvider>(`/pyapi/api/local/ai/probe?provider=${encodeURIComponent(provider)}`),

  // --- AI account balance / remaining credit ------------------------------- #
  // Only openrouter / deepseek / siliconflow / moonshot expose a balance API;
  // every other provider returns supported:false WITHOUT a network call
  // (billing is console-only — e.g. Gemini, OpenAI, Anthropic). Never cached.
  getAiBalances: () => getJSON<AiBalanceResponse>('/pyapi/api/local/ai/balance'),
  getAiBalanceOne: (provider: string) =>
    getJSON<AiBalance>(`/pyapi/api/local/ai/balance?provider=${encodeURIComponent(provider)}`),

  // --- AI local rate budgets (auto-reset by the pyheartbeat tick) ---------- #
  // Cheap poll: current per-minute/day/month usage vs limits + resets-in
  // countdown. No provider call; lets the UI show budgets resetting live.
  getAiRateLimits: () =>
    getJSON<AiRateLimitsResponse>('/pyapi/api/local/ai/rate-limits'),

  // --- AI chat confirm (explicit provider) --------------------------------- #
  aiChat: (provider: string, messages: AiChatMessage[], model?: string) =>
    postJSON<AiChatResponse>('/pyapi/api/local/ai/chat', { provider, messages, model }),

  // --- AI auto (unified gateway: smart dispatch + fallback) ---------------- #
  // One round trip; the backend picks the provider by tier/quota/cooldown and
  // the response says which AI handled it. `source` labels the task in the
  // gateway records.
  aiAuto: (messages: AiChatMessage[], source?: string, model?: string) =>
    postJSON<AiChatResponse>('/pyapi/api/local/ai/chat',
      { provider: 'auto', messages, model, source }),

  // --- AI gateway status (tiers, quotas, cooldowns, task records) ---------- #
  getAiGateway: () => getJSON<AiGatewayStatus>('/pyapi/api/local/ai/gateway'),

  // --- AI key management (indexed secret-store key files) ------------------ #
  // List every provider's key base + per-slot rotation status (KEY1/KEY2…),
  // plus the raw env-var names of each configured key file (for targeted
  // delete). Read-only; never returns full secrets (slots are masked).
  getAiKeys: () => getJSON<AiKeysResponse>('/pyapi/api/local/ai/keys'),
  // Write ONE indexed key file ({BASE}_{index}, or {BASE}_IMAGE_{index} when
  // image=true) then re-probe. Values are write-only — never echoed back.
  setAiKey: (body: AiKeySetRequest) =>
    postJSON<AiKeySetResponse>('/pyapi/api/local/ai/keys', body),
  // Delete one specific key file by its exact env-var name (e.g.
  // GOOGLE_API_KEY_2 or OPENAI_API_KEY_IMAGE_1).
  deleteAiKey: (keyName: string) =>
    deleteJSON<AiKeyDeleteResponse>(
      `/pyapi/api/local/ai/keys/${encodeURIComponent(keyName)}`),
  // Clear the cooldown on one rotation key so it becomes usable again. `index`
  // targets a specific slot (0-based); `image` targets the dedicated image
  // budget instead of the text keys. Omitting index clears every slot.
  resetKeyCooldown: (req: { provider: string; index?: number; image?: boolean }) =>
    postJSON<AiKeyResetCooldownResponse>('/pyapi/api/local/ai/keys/reset-cooldown', req),

  // --- AI usage (SHARED cross-runtime store — text / vision / probe) ------- #
  // The store is shared with laravel, so this returns usage from BOTH runtimes
  // (see each record's `runtime`). Image generations are NOT here — they live in
  // the image history. Wrapped into the dashboard APIResponse envelope so the
  // shared AiUsagePanel can read `res.success && res.data` uniformly.
  getAiUsage: async (limit = 150): Promise<{ success: boolean; data: AiUsageResponse | null; error: string | null }> => {
    try {
      const r = await getJSON<AiUsageResponse>(
        `/pyapi/api/local/ai/usage?limit=${encodeURIComponent(String(limit))}`);
      if (r && r.success !== false) {
        return { success: true, data: r, error: null };
      }
      return { success: false, data: null, error: r?.error ?? 'Usage history unavailable.' };
    } catch (e: any) {
      return { success: false, data: null, error: e?.message || 'pycore unreachable' };
    }
  },

  // --- AI image generation (unified IMAGE contract; auto-records history) --- #
  // The backend picks the provider/model (or honours an explicit one), returns
  // base64 bytes + mime, AND saves the result into the SHARED cross-runtime
  // history store. `source` labels the task in the records.
  generateImage: (req: { prompt: string; size?: string; model?: string; provider?: string; source?: string }) =>
    postJSON<AiImageResponse>('/pyapi/api/local/ai/image', req),

  // One-click "Test this provider": force a single image provider, ignoring the
  // cooldown/rate window. Returns the same AiImageResponse shape (base64 + mime
  // + latency) so the caller can show the image + latency in a popup.
  testImageProvider: (req: { provider: string; prompt?: string; size?: string; model?: string }) =>
    postJSON<AiImageResponse>('/pyapi/api/local/ai/image/test', req),

  // --- AI image history (SHARED store — pycore + laravel entries) ---------- #
  // Metadata only (newest-first); fetch bytes via imageHistoryFileUrl(id).
  getImageHistory: (limit = 50) =>
    getJSON<ImageHistoryResponse>(`/pyapi/api/local/ai/image/history?limit=${encodeURIComponent(String(limit))}`),
  /** Raw-bytes URL for one history entry's image (use directly in an <img src>). */
  imageHistoryFileUrl: (id: string): string =>
    `/pyapi/api/local/ai/image/history/file/${encodeURIComponent(id)}`,
  deleteImageHistory: (id: string) =>
    deleteJSON<ImageHistoryDeleteResponse>(`/pyapi/api/local/ai/image/history/${encodeURIComponent(id)}`),
  clearImageHistory: () =>
    postJSON<ImageHistoryClearResponse>('/pyapi/api/local/ai/image/history/clear', {}),
  /** Reveal a generated image's folder in the OS file manager (path resolved by id). */
  revealImage: (id: string) =>
    postJSON<RevealResponse>(`/pyapi/api/local/ai/image/history/${encodeURIComponent(id)}/reveal`, {}),

  // --- Speech (TTS/STT) clip history — audio side of the Records timeline --- #
  getSpeechHistory: (limit = 50) =>
    getJSON<SpeechHistoryResponse>(`/pyapi/api/local/speech/history?limit=${encodeURIComponent(String(limit))}`),
  /** Raw-bytes URL for one clip (use directly in an <audio src>). */
  speechHistoryFileUrl: (id: string): string =>
    `/pyapi/api/local/speech/history/file/${encodeURIComponent(id)}`,
  deleteSpeechHistory: (id: string) =>
    deleteJSON<{ success: boolean }>(`/pyapi/api/local/speech/history/${encodeURIComponent(id)}`),
  clearSpeechHistory: () =>
    postJSON<{ success: boolean; removed: number }>('/pyapi/api/local/speech/history/clear', {}),
  /** Open the clip's folder in the OS file manager (path resolved by id). */
  revealSpeech: (id: string) =>
    postJSON<RevealResponse>(`/pyapi/api/local/speech/history/${encodeURIComponent(id)}/reveal`, {}),

  // --- OCR engine availability (windows -> easyocr -> cnocr priority) ------ #
  getOcrStatus: () => getJSON<OcrStatus>('/pyapi/api/local/ocr/status'),

  // --- TTS live availability + version (edge-tts 403/region probe) --------- #
  getTtsStatus: (refresh = false) =>
    getJSON<TtsStatus>(`/pyapi/api/local/tts/status${refresh ? '?refresh=1' : ''}`),

  // --- TTS tuning: per-attempt synth timeout + edge failure cooldown ------- #
  getTtsSettings: () => getJSON<TtsSettings>('/pyapi/api/local/tts/settings'),
  setTtsSettings: (patch: { synth_timeout_s?: number; edge_cooldown_s?: number }) =>
    postJSON<TtsSettings>('/pyapi/api/local/tts/settings', patch),

  // --- TTS live per-engine synth test (actually runs the engine) ----------- #
  testTts: (req: { engine?: string; text?: string; language?: string; rate?: string }) =>
    postJSON<TtsTestResponse>('/pyapi/api/local/tts/test', req),

  // --- STT engine availability + live recognition test --------------------- #
  // faster-whisper -> whisper -> vosk -> azure (Azure exposes a free-F0 quota).
  getSttStatus: () => getJSON<SttStatus>('/pyapi/api/local/stt/status'),
  testStt: (req: { engine?: string; language?: string }) =>
    postJSON<SttTestResponse>('/pyapi/api/local/stt/test', req),

  // --- Capabilities: CUDA/compute + free-library availability -------------- #
  getCapabilities: () => getJSON<CapabilityStatus>('/pyapi/api/local/capabilities/status'),

  // --- System info: read-only constants + static dirs (one-click open) ----- #
  getSystemInfo: () => getJSON<SystemInfo>('/pyapi/api/local/capabilities/info'),
  openStaticDir: (key: string) =>
    postJSON<OpenDirResponse>('/pyapi/api/local/capabilities/open-dir', { key }),

  // --- translation queue (Laravel pending queue, steered via pycore) ------ #
  queueTranslation: (refresh = false) =>
    getJSON<TranslationQueueResponse>(
      `/pyapi/api/local/translation/queue${refresh ? '?refresh=1' : ''}`),
  setQueuePriority: (task_id: string, priority: number) =>
    postJSON<TranslationQueueActionResponse>(
      '/pyapi/api/local/translation/queue/priority', { task_id, priority }),
  stackQueue: (words: string[], language: string, target_language: string, priority?: number) =>
    postJSON<TranslationQueueActionResponse>(
      '/pyapi/api/local/translation/queue/stack',
      { words, language, target_language, ...(priority != null ? { priority } : {}) }),

  /** Full pyctl TaskManager record — Task Queue tab detail modal. */
  getLocalTaskDetail: (taskId: string) =>
    getJSON<LocalTaskDetailResponse>(
      `/pyapi/api/local/task-center/tasks/${encodeURIComponent(taskId)}`),

  /** Laravel global_tasks row — Translation Queue tab detail modal. */
  getTranslationTaskDetail: (taskId: string) =>
    getJSON<PycoreGlobalTaskDetailResponse>(
      `/pyapi/api/local/translation/queue/tasks/${encodeURIComponent(taskId)}`),

  // --- Assist Laravel (pycore drains Laravel's cover/tts/translation work) - #
  // Status includes the worker loop state, circuit breaker, counters and the
  // last observed Laravel-side queue counts. Config is a PATCH (only the
  // provided fields change). Cycle runs one claim→process→submit pass NOW and
  // returns 400 when assist is disabled.
  getAssistStatus: () =>
    getJSON<AssistStatus>('/pyapi/api/local/assist/status'),
  setAssistConfig: (config: AssistConfigPatch) =>
    postJSON<AssistConfigResponse>('/pyapi/api/local/assist/config', config),
  runAssistCycle: () =>
    postJSON<AssistCycleResponse>('/pyapi/api/local/assist/cycle', {}),

  // --- Recent tasks (unified cross-end task history: pycore + chrome) ------- #
  // Newest-first log of finished task units across both ends, with roll-up
  // stats. Optional filters (end / worker / task_type) are applied server-side;
  // the FE also filters client-side for the chip UI. Clear wipes the ring + the
  // on-disk text log.
  getRecentTasks: (params: { limit?: number; end?: string; worker?: string; task_type?: string } = {}) => {
    const q = new URLSearchParams();
    q.set('limit', String(params.limit ?? 100));
    if (params.end) q.set('end', params.end);
    if (params.worker) q.set('worker', params.worker);
    if (params.task_type) q.set('task_type', params.task_type);
    return getJSON<PcTaskRecentResponse>(`/pyapi/api/local/tasks/recent?${q.toString()}`);
  },
  clearRecentTasks: () =>
    postJSON<PcTaskClearResponse>('/pyapi/api/local/tasks/clear', {}),

  // --- Movie / TV poster (TMDB + OMDB key status + fetch toggle + lookup) -- #
  // status: masked provider keys + the ingest fetch flag (media_sync.fetch_poster).
  // config: persist that same flag. test: one poster lookup with the base64 image
  // inlined so the UI can preview it (never throws — {found:false} on a miss).
  getPosterStatus: () => getJSON<PosterStatus>('/pyapi/api/local/poster/status'),
  setPosterConfig: (enabled: boolean) =>
    postJSON<PosterStatus>('/pyapi/api/local/poster/config', { enabled }),
  testPoster: (title: string, year?: number) =>
    postJSON<PosterTestResponse>('/pyapi/api/local/poster/test',
      year != null ? { title, year } : { title }),
  /** Zero the local-reuse-vs-fetch counters; returns the fresh status. */
  resetPosterStats: () =>
    postJSON<PosterStatus>('/pyapi/api/local/poster/stats/reset', {}),

  // --- Google Translate (free googletrans + AI comparison on one input) --- #
  // status: googletrans availability/version + cache info. translate: the free
  // lib path ({error} on failure, never throws). translateAi: the SAME text
  // through the unified AI gateway so the UI can compare Google vs AI.
  getTranslateStatus: () => getJSON<TranslateStatus>('/pyapi/api/local/translate/status'),
  translate: (text: string, src = 'auto', dest = 'en', useCache = true) =>
    postJSON<TranslateResponse>('/pyapi/api/local/translate',
      { text, src, dest, use_cache: useCache }),
  translateAi: (text: string, src = 'auto', dest = 'en') =>
    postJSON<TranslateAiResponse>('/pyapi/api/local/translate/ai', { text, src, dest }),

  // --- Image search (SerpApi Google-Images + AI comparison + history) ----- #
  // status: SerpApi key present + engine + history count. search: real Google
  // images for a query (records history). searchAi: an AI render of the SAME
  // query (unified IMAGE contract). compare: both in one call + a combined
  // history record. Plus the search-history list/delete/clear. This is the same
  // SerpApi capability the poster pipeline now prefers as its first source.
  getImageSearchStatus: () => getJSON<ImageSearchStatus>('/pyapi/api/local/image-search/status'),
  searchImages: (query: string, num = 12, country?: string, record = true) =>
    postJSON<ImageSearchResponse>('/pyapi/api/local/image-search',
      { query, num, country, record }),
  searchImagesAi: (query: string, size?: string, model?: string) =>
    postJSON<AiImageResponse>('/pyapi/api/local/image-search/ai', { query, size, model }),
  compareImages: (query: string, num = 12, country?: string, size?: string, model?: string) =>
    postJSON<ImageSearchCompareResponse>('/pyapi/api/local/image-search/compare',
      { query, num, country, size, model }),
  getImageSearchHistory: (limit = 50) =>
    getJSON<ImageSearchHistoryResponse>(`/pyapi/api/local/image-search/history?limit=${encodeURIComponent(String(limit))}`),
  deleteImageSearchHistory: (id: string) =>
    deleteJSON<ImageSearchHistoryDeleteResponse>(`/pyapi/api/local/image-search/history/${encodeURIComponent(id)}`),
  clearImageSearchHistory: () =>
    postJSON<ImageSearchHistoryClearResponse>('/pyapi/api/local/image-search/history/clear', {}),

  // --- Subtitle search (OpenSubtitles search + download + history) -------- #
  // status: OpenSubtitles key present + authenticated state + history count.
  // probe: a lightweight reachability/latency check. search: subtitles for a
  // movie/TV title (records history). download: pull one result's file (inline
  // .srt content or a saved path). Plus the search-history list/delete/clear.
  getSubtitleSearchStatus: () =>
    getJSON<SubtitleSearchStatus>('/pyapi/api/local/subtitle-search/status'),
  probeSubtitleSearch: () =>
    getJSON<SubtitleSearchProbe>('/pyapi/api/local/subtitle-search/probe'),
  // Provider fallback chain (ordered) + a live per-provider probe.
  getSubtitleProviders: () =>
    getJSON<SubtitleProvidersResponse>('/pyapi/api/local/subtitle-search/providers'),
  testSubtitleProvider: (name: string) =>
    postJSON<SubtitleProviderProbe>(`/pyapi/api/local/subtitle-search/providers/${encodeURIComponent(name)}/test`, {}),
  // Download cache: cached subtitle downloads are reused so a rate/quota-limited
  // provider file is never pulled twice. Stats are local (no network); clear wipes it.
  getSubtitleCacheStats: () => getJSON<SubtitleCacheStats>('/pyapi/api/local/subtitle-search/cache'),
  clearSubtitleCache: () => postJSON<SubtitleCacheClearResponse>('/pyapi/api/local/subtitle-search/cache/clear', {}),
  searchSubtitles: (query: string, opts: SubtitleSearchOptions = {}) =>
    postJSON<SubtitleSearchResponse>('/pyapi/api/local/subtitle-search',
      { query, ...opts }),
  downloadSubtitle: (file_id: number | string, record = true) =>
    postJSON<SubtitleDownloadResponse>('/pyapi/api/local/subtitle-search/download',
      { file_id, record }),
  getSubtitleSearchHistory: (limit = 50) =>
    getJSON<SubtitleSearchHistoryResponse>(`/pyapi/api/local/subtitle-search/history?limit=${encodeURIComponent(String(limit))}`),
  deleteSubtitleSearchHistory: (id: string) =>
    deleteJSON<SubtitleSearchHistoryDeleteResponse>(`/pyapi/api/local/subtitle-search/history/${encodeURIComponent(id)}`),
  clearSubtitleSearchHistory: () =>
    postJSON<SubtitleSearchHistoryClearResponse>('/pyapi/api/local/subtitle-search/history/clear', {}),

  // --- translate history (Google / AI translate usage records) ------------ #
  getTranslateHistory: (limit = 50) =>
    getJSON<TranslateHistoryResponse>(`/pyapi/api/local/translate/history?limit=${encodeURIComponent(String(limit))}`),
  deleteTranslateHistory: (id: string) =>
    deleteJSON<TranslateHistoryDeleteResponse>(`/pyapi/api/local/translate/history/${encodeURIComponent(id)}`),
  clearTranslateHistory: () =>
    postJSON<TranslateHistoryClearResponse>('/pyapi/api/local/translate/history/clear', {}),

  // --- Queue Center: unified overview (contract A) ------------------------ #
  // pycore is the hub: it fans out to the selected Laravel endpoint for the
  // per-category counts + worker registry and merges its own engine status. All
  // 8 categories are always present (zeros when empty); laravel_reachable:false
  // means the counts are zeroed but the categories + local engines still report.
  getQueueOverview: () =>
    getJSON<PcQueueOverview>('/pyapi/api/local/queue/overview'),

  // --- Queue Center: capability settings (contract B) --------------------- #
  // Read all four capability blocks (priority + availability + options).
  getCapabilitySettings: () =>
    getJSON<PcCapabilitySettings>('/pyapi/api/local/capabilities/settings'),
  // Persist ONE capability's priority/options and live-apply; returns the
  // updated block. `priority` re-orders the engine chain (omitted engines are
  // appended in default order server-side, so a save can never silence it);
  // `options` carries the TTS tuning (synth_timeout_s / edge_cooldown_s).
  saveCapabilitySettings: (
    capability: PcCapabilityKey,
    patch: { priority?: string[]; options?: PcCapabilityOptions },
  ) =>
    postJSON<PcCapabilitySaveResponse>('/pyapi/api/local/capabilities/settings', {
      capability, ...patch,
    }),

  // --- auto-start on boot (native OS startup entry) ----------------------- #
  getAutostart: () => getJSON<AutostartStatus>('/pyapi/api/manage/control/autostart'),
  // target/mechanism are optional; the backend falls back to the persisted
  // preference, so a bare enable keeps the historical behavior.
  setAutostart: (enabled: boolean, target?: AutostartTarget, mechanism?: string) =>
    postJSON<AutostartStatus>('/pyapi/api/manage/control/autostart', { enabled, target, mechanism }),
};

export type PycoreApi = typeof pycoreApi;
