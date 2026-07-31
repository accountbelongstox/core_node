/**
 * PycoreApi — shared Pycore service API client.
 *
 * Talks to the selected pycore target through shared HTTP controllers.
 * Binary assets are returned as data URLs.
 *
 * Domain methods live in PycoreApiAi / PycoreApiSpeech / PycoreApiLocal;
 * transport helpers in PycoreApiTransport; book types in PycoreApiBooksTypes.
 */
import type {
  VideoExtractMode, VideoExtractOptions,
  VideoExtractOpenKind,
  CodeSyncRole, SyncSettings,
} from './pycoreTypes';

import {
  requestPycoreHttp, requestPycoreStatus, PYCORE_HTTP_ROUTES,
  directPycoreHost, buildPycoreHttpUrl,
  fileToBase64,
} from './PycoreApiTransport';
import {
  mapQueueSnapshot,
  type QueueResponse,
  type RuntimeInfo,
  type SystemSettingsResponse,
  type BookLanguageRow, type BookTopWord, type BookTextStats, type BookFileEntry,
  type BooksScanResponse, type BookFileAnalysis, type BooksAnalyzeResponse,
  type BooksSupportedFormatsResponse, type BooksAnalyzeOptions,
  type BookSourceState, type BooksStateResponse, type BookSubmitItem, type BooksSubmitResponse,
  type BooksListResponse, type BookChapter, type BookSlot,
  type CoreBookCompletenessLang, type CoreBookMissing, type CoreBookCompleteness,
  type CoreBookSummary, type CoreBookListResponse, type CoreBookConvertRequest, type CoreBookConvertResponse,
  type CoreBookGetResponse, type CoreBookDeleteResponse, type CoreBookAddLanguageRequest,
  type CoreBookFillAudioRequest, type CoreBookEnrichResponse, type CoreBookSubmitRequest, type CoreBookSubmitResponse,
} from './PycoreApiBooksTypes';
import { pycoreApiAi } from './PycoreApiAi';
import { pycoreApiSpeech } from './PycoreApiSpeech';
import { pycoreApiLocal } from './PycoreApiLocal';
import { PycorePaths } from './pycoreEndpoints';

export type {
  QueueResponse, RuntimeInfo, SystemSettingsResponse,
  BookLanguageRow, BookTopWord, BookTextStats, BookFileEntry,
  BooksScanResponse, BookFileAnalysis, BooksAnalyzeResponse,
  BooksSupportedFormatsResponse, BooksAnalyzeOptions,
  BookSourceState, BooksStateResponse, BookSubmitItem, BooksSubmitResponse,
  BooksListResponse, BookChapter, BookSlot,
  CoreBookCompletenessLang, CoreBookMissing, CoreBookCompleteness,
  CoreBookSummary, CoreBookListResponse, CoreBookConvertRequest, CoreBookConvertResponse,
  CoreBookGetResponse, CoreBookDeleteResponse, CoreBookAddLanguageRequest,
  CoreBookFillAudioRequest, CoreBookEnrichResponse, CoreBookSubmitRequest, CoreBookSubmitResponse,
} from './PycoreApiBooksTypes';

export { mapQueueSnapshot } from './PycoreApiBooksTypes';

export const pycoreApi = {
  // --- queue (pycore /voice-subtitle, mapped via mapQueueSnapshot) --------- #
  getQueue: async (): Promise<QueueResponse> =>
    mapQueueSnapshot(await requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleGetQueue, {})),
  clearQueue: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleClearQueue, {}),
  removeQueueItems: (indices: number[]) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleRemoveMultipleItems, { indices }),
  setQueueIndex: (index: number) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleSetCurrentIndex, { index }),
  incrementPlayCount: (index: number) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleIncrementPlayCount, { index }),

  // --- playback (backend desktop player auto-plays the queue when enabled) - #
  togglePlayback: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleToggleEnabled, {}),

  // --- AI auto-subtitle monitors ------------------------------------------- #
  // Screenshot monitor: captures the screen every N seconds, the AI describes
  // the image, and the description runs through translate→TTS into the queue.
  // The recognition/output language is the SINGLE parameter that drives the
  // whole pipeline: OCR recognition → translation → TTS subtitle.
  getScreenshotMonitorStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleGetScreenshotMonitorStatus, {}),
  startScreenshotMonitor: (interval: number, lang = 'en') =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleStartScreenshotMonitor, { interval, lang }),
  stopScreenshotMonitor: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleStopScreenshotMonitor, {}),
  // Change the recognition/output language live (applies on the next capture).
  setScreenshotLanguage: (lang: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleSetScreenshotLanguage, { lang }),
  // Clipboard monitor: copied sentences are rewritten in English by the AI and
  // enqueued the same way.
  getClipboardMonitorStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleGetClipboardMonitorStatus, {}),
  startClipboardMonitor: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleStartClipboardMonitor, {}),
  stopClipboardMonitor: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleStopClipboardMonitor, {}),

  // --- TTS (pycore voice-subtitle add-text pipeline) ---------------------- #
  tts: async (text: string, langs: string[] = ['en'], category = 'normal') => {
    const r = await requestPycoreHttp(PYCORE_HTTP_ROUTES.voiceSubtitleAddText, { text, langs, category });
    return {
      success: r?.success !== false,
      queued: true,
      task_id: r?.task_id,
      message: 'Queued for pycore TTS',
    };
  },

  // --- generic passthrough removed: use named PYCORE_HTTP_ROUTES via requestPycoreHttp --- #

  ping: () => requestPycoreStatus(),

  getRuntime: (): Promise<RuntimeInfo> => {
    const host = directPycoreHost();
    const apiBase = buildPycoreHttpUrl(host, '/').replace(/\/$/, '');
    const eventUrl = buildPycoreHttpUrl(host, PycorePaths.events);
    return Promise.resolve({ eventUrl, apiBase });
  },

  // --- system settings (persisted on the pycore backend) ------------------ #
  getSystemSettings: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.userDataGetSystemSettings, {}),
  setSystemSettings: (settings: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.userDataSetSystemSettings, { settings }),

  // --- video extract history / options ------------------------------------ #
  getVideoExtractHistory: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.userDataGetVideoHistory, {}),
  addVideoExtractEntry: (path: string, mode: VideoExtractMode) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.userDataAddVideoHistory, { path, mode }),
  removeVideoExtractEntry: (path: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.userDataRemoveVideoHistory, { path }),
  setVideoExtractOptions: (options: Partial<VideoExtractOptions>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.userDataSetVideoOptions, { options }),

  // --- video extract capabilities ----------------------------------------- #
  getVideoExtractCapabilities: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractCapabilities, {}),

  // --- video extract: open a path in the OS file manager ------------------ #
  openVideoExtractPath: (kind: VideoExtractOpenKind, path?: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractOpen, { kind, path }),

  // --- video extract: segment ↔ subtitle map for the current file --------- #
  // `languages` (>=1 codes, includes the primary) requests the multi-language
  // correspondence slots per cue; omitted/empty → the legacy single-language map.
  getVideoExtractSegments: (path: string, languages?: string[]) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractSegments, { path, languages }),

  // --- video extract: pause / resume / cancel a running task -------------- #
  pauseVideoExtractTask: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractPauseTask, { task_id: taskId }) as Promise<
      { success: boolean; error?: string }
    >,
  resumeVideoExtractTask: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractResumeTask, { task_id: taskId }) as Promise<
      { success: boolean; error?: string }
    >,
  cancelVideoExtractTask: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.videoExtractCancelTask, { task_id: taskId }) as Promise<
      { success: boolean; error?: string }
    >,

  // --- live system resources (CPU / MEM / GPU) ---------------------------- #
  getSystemResources: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.systemResourcesSystemResources, {}),

  // --- native OS folder/file picker --------------------------------------- #
  pickPath: (mode: VideoExtractMode, initial?: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.userDataPickPath, { mode, initial }),

  // --- Books document analyze / preview (local, read-only; pre-sync) ------- #
  // supported-formats drives the format-filter sidebar; scan lists files fast
  // (no extraction); analyze extracts text + multi-language stats + a preview
  // for a single file or a whole folder (capped by max_files).
  getBooksSupportedFormats: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.booksSupportedFormats, {}),
  booksScan: (path: string, formats?: string[]) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.booksScan, { path, formats }),
  booksAnalyze: (path: string, opts: BooksAnalyzeOptions = {}) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.booksAnalyze, { path, ...opts }),
  // Persisted Books state (sources + compact analysis + submission state) — the
  // UI reloads this on mount so history survives a page switch / reopen.
  getBooksState: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.booksState, {}),
  booksStateAdd: (path: string, mode: string, language?: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.booksStateAdd, { path, mode, language }),
  booksStateRemove: (path: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.booksStateRemove, { path }),
  // One-shot batch submit to laravel_main (builds the model_version:3 payload
  // server-side). `languages` is the checked correspondence set (>=1, includes
  // the detected primary language) — empty slots are emitted as null per spec §5.
  // `source_type` marks the ingest's media kind (default 'book'; 'document' for
  // the Add Document flow) so the backend keys the per-language sentence rows by
  // the right source_type (spec §7). NOTE: pycore /books/submit must honor this
  // — see the backend-gap report.
  booksSubmit: (paths?: string[], language?: string, languages?: string[], source_type?: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.booksSubmit, { paths, language, languages, source_type }),
  // Paginated drill-down into a source's lists (words/sentences/languages), plus
  // the chapter -> sentence tree: kind='chapters' lists BookChapter[]; passing a
  // chapter_index (with kind='sentences'|'cues') returns that chapter's BookSlot[]
  // carrying every selected language side by side (blank where null). Cached
  // server-side per source so paging is cheap.
  booksList: (
    path: string, kind: string, start = 0, limit = 100,
    opts: {
      formats?: string[]; refresh?: boolean; max_files?: number;
      chapter_index?: number; languages?: string[]; grain?: string;
      sort_order?: 'asc' | 'desc'; query?: string; view_language?: string
    } = {},
  ) => requestPycoreHttp(PYCORE_HTTP_ROUTES.booksList, { path, kind, start, limit, ...opts }),
  // Drag-drop fallback for sandboxed browsers (no File.path): upload the bytes;
  // the backend stages them to disk and returns staged paths + analysis.
  // `languages` (>=1 codes) requests the per-language correspondence; `source_type`
  // marks the media kind staged ('book' default, 'document' for the Add Document
  // flow) so a later booksSubmit ingests it under the right source_type.
  booksAnalyzeUpload: async (
    files: File[],
    opts: { language?: string; languages?: string[]; preview_chars?: number; persist?: boolean; source_type?: string } = {},
  ): Promise<BooksAnalyzeResponse> => {
    const b64Files = await Promise.all(
      files.map(async (f) => ({ name: f.name, data_b64: await fileToBase64(f) })),
    );
    return requestPycoreHttp(PYCORE_HTTP_ROUTES.booksAnalyzeUpload, {
      files: b64Files,
      language: opts.language,
      languages: opts.languages || [],
      preview_chars: opts.preview_chars,
      persist: !!opts.persist,
      source_type: opts.source_type || 'book',
    });
  },

  // --- CoreBook portable format (pycore /api/local/corebook) -------------- #
  // Convert a document -> a saved CoreBook (1 book / N chapters / multi-language
  // / per-language audio), enrich it (add a language via batched AI translation;
  // fill audio locally via TTS) and submit it (whole or partial) to laravel_main.
  corebookList: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.corebookList, {}),
  corebookConvert: (req: CoreBookConvertRequest) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.corebookConvert, req),
  corebookGet: (source_key: string, start = 0, limit = 0) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.corebookGet, { source_key, start, limit }),
  corebookAddLanguage: (req: CoreBookAddLanguageRequest) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.corebookAddLanguage, req),
  corebookFillAudio: (req: CoreBookFillAudioRequest) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.corebookFillAudio, req),
  corebookSubmit: (req: CoreBookSubmitRequest) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.corebookSubmit, req),
  corebookDelete: (source_key: string): Promise<CoreBookDeleteResponse> =>
    // HTTP controller path; query data is preserved by the compatibility bridge.
    requestPycoreHttp(PYCORE_HTTP_ROUTES.corebookDelete, { source_key }),

  // --- code sync (peer mesh: dev/client roles + peer list) ---------------- #
  getPeers: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncGetPeers, {}),
  addPeer: (peer: { name: string; host: string; port: number; role: CodeSyncRole }) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncAddPeer, peer),
  removePeer: (id: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncRemovePeer, { id }),
  updatePeer: (patch: { id: string; name?: string; host?: string; port?: number; role?: CodeSyncRole }) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncUpdatePeer, patch),
  setRole: (role: CodeSyncRole) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncSetRole, { role }),
  setDistribute: (enabled: boolean) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncSetDistribute, { enabled }),
  setSkipUpdate: (enabled: boolean) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncSetSkipUpdate, { enabled }),
  discoverPeers: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncDiscover, {}),

  // --- code sync filter settings (presets + per-machine .data override) --- #
  getSyncSettings: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncGetSyncSettings, {}),
  setSyncSettings: (patch: Partial<SyncSettings>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncSetSyncSettings, patch),
  resetSyncSettings: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncResetSyncSettings, {}),
  getSyncLogs: (limit = 100) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncGetSyncLogs, { limit }),

  // --- code sync file structure (live tree of the synced set) ------------- #
  getFileTree: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncGetFileTree, {}),
  // Dev-side: a specific client's received tree + drift vs this dev's synced set.
  getPeerFileTree: (peerId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.codeSyncGetPeerFileTree, { peer_id: peerId }),


  ...pycoreApiAi,
  ...pycoreApiSpeech,
  ...pycoreApiLocal,
};

export type PycoreApi = typeof pycoreApi;
