/**
 * PycoreApi — pycore service API client for the dashboard's pycore-manager end.
 *
 * Talks DIRECTLY to the pycore backend on `<host>:59000`. Paths are rewritten
 * by rewritePycoreEndpoint() for the selected pycore target (local or remote).
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
  OcrStatus, OcrTestResponse, TtsStatus, TtsSettings, TtsServerActionResponse, TtsTestResponse, SttStatus, SttTestResponse, EnginesLoadStatusResponse, SpeechHistoryResponse, RevealResponse, CapabilityStatus, SystemInfo, OpenDirResponse,
  LlmStatus, LlmTestResponse, LlmServerActionResponse,
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
  WordAudioStatus, WordAudioTestResponse,
  TranslateHistoryResponse, TranslateHistoryDeleteResponse, TranslateHistoryClearResponse,
  AgentHistoryIndexResponse, AgentHistoryPromptsResponse, AgentHistorySessionResponse,
  AgentHistoryArticleRecordsResponse,
  PcQueueOverview, PcCapabilitySettings, PcCapabilityKey,
  PcTaskCenterResponse, QueueCenterSnapshot, QueueCenterControlName,
  PcCapabilitySaveResponse, PcCapabilityOptions,
  PcTaskRecentResponse, PcTaskClearResponse, PcCompletedTaskArchiveResponse,
  PcCompletedTaskSyncResponse,
  DictionaryStatus, DictionaryEntry, SentenceAudioAutoStatus, SentenceAudioQueueSnapshot,
  SentenceVoiceVariant,
  QueueBumpsSnapshot, WordTtsAutoStatus,
  HeartbeatWorkersStatus,
  PcVersionInfo,
} from './pycoreTypes';

import { MasterApiClient, isNetworkLevelFailure } from '../base';
import type { MasterRequestOptions } from '../base';
import { buildPycoreHttpUrl, buildPycoreWsUrl, normalizePycorePath } from './pycoreEndpoints';
import { rewritePycoreEndpoint, pycoreWsUrlOverride, directPycoreHost } from './pycoreTarget';
import { callRpc, isWsConnected } from './PycoreWs';
import { appendHttpDebug, summarizeHttpParams } from './pycoreHttpLog';
import {
  buildVocabQuery,
  type VocabLanguagesResponse,
  type VocabTranslateRequest, type VocabTranslateResponse,
  type VocabTtsGenerateRequest, type VocabTtsGenerateResponse,
  type VocabDictionaryWordsResponse, type VocabDictionaryWordRow,
  type VocabLibrariesResponse, type VocabLibrary,
  type VocabLibraryWordsResponse,
  type VocabStatisticsResponse, type VocabLanguageBreakdownResponse,
  type VocabTtsQueueStats, type VocabTtsQueueItemsResponse,
  type VocabAssistOverviewResponse,
  type VocabProxyEnvelope,
} from './PycoreVocabTypes';

/**
 * Structural opt-in on the master API base client (core/api-libs/base) for
 * pycore's HTTP parts (the WS RPC path is untouched). PASS-THROUGH today:
 * queue DISABLED (no queueStorageKey) and ceiling 0 = wait forever, exactly
 * matching the previous plain `fetch` behavior (no timeout) — no behavior
 * change in this pass. To enable later, pass a queueStorageKey (e.g.
 * 'pycore_api_queue') and drop the ceiling override.
 */
class PycoreMasterClient extends MasterApiClient {
  /** Paths rewritten to direct :59000 URLs — empty base URL. */
  protected resolveBaseUrl(): string {
    return '';
  }

  /** Re-point every pycore HTTP call via rewritePycoreEndpoint (direct :59000),
   *  and record the outcome for the PcHttpDebugger (FE->pycore HTTP path). */
  async request(endpoint: string, options: MasterRequestOptions = {}): Promise<Response> {
    const nowFn = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const started = nowFn();
    const method = (options.method || 'GET').toUpperCase();
    const paramsSummary = summarizeHttpParams(options.body);
    try {
      const r = await super.request(rewritePycoreEndpoint(endpoint), options);
      appendHttpDebug({
        direction: 'pycore', method, path: endpoint, fullUrl: endpoint,
        paramsSummary, status: r.status, ms: nowFn() - started, error: null,
      });
      return r;
    } catch (e: any) {
      appendHttpDebug({
        direction: 'pycore', method, path: endpoint, fullUrl: endpoint,
        paramsSummary, status: 0, ms: nowFn() - started, error: e?.message || String(e),
      });
      throw e;
    }
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
const GET_CEILING_MS = 12_000;
const WS_GET_TIMEOUT_MS = 8_000;
/** Max raw upload bytes to send base64-over-WS (base64 inflates ~33%; stays under
 *  the 10MB WS frame). Larger uploads fall back to HTTP multipart. */
const WS_UPLOAD_MAX_RAW_BYTES = 7 * 1024 * 1024;

/** Encode a File to base64, chunked so String.fromCharCode never stack-overflows
 *  on a large binary (used for base64-over-WS uploads). */
async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const CHUNK = 0x8000; // 32KB
  for (let i = 0; i < buf.length; i += CHUNK) {
    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function localApiPathFromUrl(url: string): string {
  const rewritten = rewritePycoreEndpoint(url);
  if (/^https?:\/\//i.test(rewritten)) {
    try {
      const u = new URL(rewritten);
      return `${u.pathname}${u.search}`;
    } catch {
      return normalizePycorePath(url);
    }
  }
  return normalizePycorePath(rewritten);
}

async function getJSONViaWs<T>(url: string, timeoutMs: number = WS_GET_TIMEOUT_MS): Promise<T> {
  const path = localApiPathFromUrl(url);
  // timeout_s tells the backend loopback how long to wait (its own default is 5s);
  // the WS call gets a small buffer over that so the backend's timeout/error frame
  // arrives before the FE gives up. Keeps large reads (books/vocab) from a spurious
  // WS-timeout that HTTP's 12s ceiling would not have hit.
  const body = await callRpc('local_http.get', { path, timeout_s: timeoutMs / 1000 }, timeoutMs + 2000);
  if (body && body.success === false && body.error) {
    throw new Error(String(body.error));
  }
  return body as T;
}

/** Like getJSON but keeps `{ success:false, error, laravel_reachable }` envelopes (Laravel proxies). */
async function getJSONEnvelopeViaWs<T>(url: string, timeoutMs: number = WS_GET_TIMEOUT_MS): Promise<T> {
  const path = localApiPathFromUrl(url);
  return callRpc('local_http.get', { path, timeout_s: timeoutMs / 1000 }, timeoutMs + 2000) as Promise<T>;
}

async function getJSONEnvelope<T>(url: string): Promise<T> {
  // WS-PRIMARY: this helper PRESERVES the {success:false, laravel_reachable} envelope
  // (Laravel proxies) rather than throwing, so read it over WS first when connected.
  if (isWsConnected()) {
    try {
      return await getJSONEnvelopeViaWs<T>(url, GET_CEILING_MS);
    } catch {
      // WS failed — fall through to HTTP.
    }
  }
  try {
    const r = await pycoreMasterClient.request(url, { ceilingMs: GET_CEILING_MS });
    let body: unknown;
    try {
      body = await r.json();
    } catch {
      throw new Error(`Invalid JSON from pycore (HTTP ${r.status})`);
    }
    if (!r.ok) {
      const errBody = body as { error?: string };
      throw new Error(errBody?.error || `pycore HTTP ${r.status}`);
    }
    return body as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const tryWs = isWsConnected() && (
      isNetworkLevelFailure(e)
      || /pycore HTTP|offline|unavailable|Failed to fetch/i.test(msg)
    );
    if (tryWs) {
      return getJSONEnvelopeViaWs<T>(url);
    }
    throw e;
  }
}

async function parseGetResponse<T>(r: Response): Promise<T> {
  let body: any;
  try {
    body = await r.json();
  } catch {
    throw new Error(`Invalid JSON from pycore (HTTP ${r.status})`);
  }
  if (!r.ok) {
    throw new Error(body?.error || `pycore HTTP ${r.status}`);
  }
  if (body && body.success === false && body.error) {
    throw new Error(String(body.error));
  }
  return body as T;
}

async function getJSON<T>(url: string): Promise<T> {
  // Prefer WS for status routes (avoids private-network-access issues).
  const barePath = localApiPathFromUrl(url).split('?', 1)[0];
  const directStatusRoute = WS_DIRECT_STATUS_ROUTES[barePath];
  if (directStatusRoute && isWsConnected()) {
    try {
      const qs = localApiPathFromUrl(url).split('?', 1)[1] || '';
      const refresh = qs.includes('refresh=1') ? 1 : 0;
      return await callRpc(directStatusRoute, { refresh }, WS_GET_TIMEOUT_MS) as T;
    } catch {
      // Fall through to HTTP below.
    }
  }
  // WS-PRIMARY: ride the local_http.get bridge first when the bus is connected
  // (browser HTTP to loopback :59000 is blocked by Private Network Access; WS is
  // not). GET is idempotent, so a WS error safely falls through to HTTP. A small
  // opt-out set keeps deliberately-HTTP-first routes (tts/status) on HTTP.
  if (isWsConnected() && !WS_HTTP_PREFERRED_ROUTES.has(barePath)) {
    try {
      return await getJSONViaWs<T>(url, GET_CEILING_MS);
    } catch {
      // WS failed (bus may have just dropped, or a business error) — fall through
      // to HTTP, which re-derives the same result for an idempotent read.
    }
  }
  try {
    const r = await pycoreMasterClient.request(url, { ceilingMs: GET_CEILING_MS });
    return await parseGetResponse<T>(r);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const tryWs = isWsConnected() && (
      isNetworkLevelFailure(e)
      || /pycore HTTP|offline|unavailable|Failed to fetch/i.test(msg)
    );
    if (tryWs) {
      return getJSONViaWs<T>(url);
    }
    throw e;
  }
}
const POST_CEILING_MS = 120_000;
/** Live engine tests (TTS/STT/OCR) — model cold-start can exceed 2 minutes. */
const LIVE_TEST_RPC_TIMEOUT_MS = 600_000;

/** Direct WS RPC routes for long-running live engine tests (no loopback HTTP).
 *  These are the ONLY path now — HTTP fallback is removed for tests.
 *  Status routes are added so status polls also prefer WS. */
const WS_DIRECT_LIVE_TEST_ROUTES: Record<string, string> = {
  '/api/local/tts/test': 'local.tts.test',
  '/api/local/stt/test': 'local.stt.test',
  '/api/local/ocr/test': 'local.ocr.test',
};
// Dedicated WS status routes (thin {refresh} payload). Everything else JSON rides
// the generic local_http.get bridge — ALL over WS.
const WS_DIRECT_STATUS_ROUTES: Record<string, string> = {
  '/api/local/stt/status': 'local.stt.status',
  '/api/local/ocr/status': 'local.ocr.status',
  '/api/local/ai/gateway': 'local.ai.status',
};

// HTTP-first opt-out — now EMPTY. The old /api/local/tts/status exception (HTTP
// first to avoid an 8s WS-timeout spinner) is obsolete: the backend bridge is a
// fast native in-process ASGI dispatch, so WS is no slower than HTTP. Everything
// is WS-primary now.
const WS_HTTP_PREFERRED_ROUTES: Set<string> = new Set<string>([
]);

async function parsePostResponse<T>(r: Response, softFail = false): Promise<T> {
  let body: any;
  try {
    body = await r.json();
  } catch {
    throw new Error(`Invalid JSON from pycore (HTTP ${r.status})`);
  }
  if (!r.ok) {
    const detail = body?.error ?? body?.detail;
    throw new Error(typeof detail === 'string' ? detail : `pycore HTTP ${r.status}`);
  }
  // Live engine tests return {success:false, error, latency_ms, ...} as a normal
  // 200 body — callers need the full payload, not an exception.
  if (!softFail && body && body.success === false && body.error) {
    throw new Error(String(body.error));
  }
  return body as T;
}

async function postJSONViaWs<T>(
  url: string,
  payload: unknown,
  softFail = false,
  timeoutMs: number = WS_GET_TIMEOUT_MS,
): Promise<T> {
  const path = localApiPathFromUrl(url);
  const barePath = path.split('?', 1)[0];
  const directRoute = WS_DIRECT_LIVE_TEST_ROUTES[barePath];
  const body = directRoute
    ? await callRpc(directRoute, payload ?? {}, timeoutMs)
    : await callRpc(
        'local_http.post',
        { path, body: payload, timeout_s: timeoutMs / 1000 },
        timeoutMs,
      );
  if (!softFail && body && body.success === false && body.error) {
    throw new Error(String(body.error));
  }
  return body as T;
}

async function postJSON<T>(
  url: string,
  body: unknown = {},
  ceilingMs: number = POST_CEILING_MS,
  softFail = false,
): Promise<T> {
  const barePath = localApiPathFromUrl(url).split('?', 1)[0];
  const wsTimeout = ceilingMs > 0 ? ceilingMs : LIVE_TEST_RPC_TIMEOUT_MS;
  // WS-PRIMARY: when the bus is connected, a POST rides WS EXCLUSIVELY (no HTTP
  // retry). A POST is not idempotent — retrying it on the other transport could
  // double-execute (double enqueue/generate). postJSONViaWs already routes direct
  // live-test routes to their dedicated RPC and everything else to local_http.post.
  if (isWsConnected() && !WS_HTTP_PREFERRED_ROUTES.has(barePath)) {
    return postJSONViaWs<T>(url, body, softFail, wsTimeout);
  }
  try {
    const r = await pycoreMasterClient.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      ceilingMs,
    });
    return await parsePostResponse<T>(r, softFail);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    const tryWs = isWsConnected() && (
      isNetworkLevelFailure(e)
      || /pycore HTTP|offline|unavailable|Failed to fetch/i.test(msg)
    );
    if (tryWs) {
      return postJSONViaWs<T>(url, body, softFail, wsTimeout);
    }
    throw e;
  }
}
async function deleteJSONViaWs<T>(url: string): Promise<T> {
  // DELETE args ride the query string (preserved by the backend bridge). Returns
  // the raw envelope (no throw on success:false) to mirror the HTTP deleteJSON,
  // whose callers inspect the { success } flag themselves.
  const path = localApiPathFromUrl(url);
  return callRpc(
    'local_http.delete',
    { path, timeout_s: WS_GET_TIMEOUT_MS / 1000 },
    WS_GET_TIMEOUT_MS + 2000,
  ) as Promise<T>;
}

async function deleteJSON<T>(url: string): Promise<T> {
  // WS-PRIMARY when connected (DELETE is idempotent — a specific resource is gone
  // either way, so no double-execution hazard); HTTP otherwise.
  if (isWsConnected()) {
    return deleteJSONViaWs<T>(url);
  }
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
      ? rewritePycoreEndpoint(`/voice-subtitle/audio?path=${encodeURIComponent(it.audio_path)}`)
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
    mapQueueSnapshot(await getJSON<any>('/voice-subtitle/queue')),
  clearQueue: () =>
    postJSON<{ success: boolean; message?: string }>('/voice-subtitle/clear', {}),
  removeQueueItems: (indices: number[]) =>
    postJSON<{ success: boolean; removed_count?: number; error?: string }>(
      '/voice-subtitle/remove-items', { indices }),
  setQueueIndex: (index: number) =>
    postJSON<{ success: boolean; current_index?: number; error?: string }>(
      '/voice-subtitle/set-index', { index }),
  incrementPlayCount: (index: number) =>
    postJSON<{ success: boolean }>('/voice-subtitle/increment-play-count', { index }),

  // --- playback (backend desktop player auto-plays the queue when enabled) - #
  togglePlayback: () =>
    postJSON<{ success: boolean; enabled: boolean; message?: string }>(
      '/voice-subtitle/toggle', {}),

  // --- AI auto-subtitle monitors ------------------------------------------- #
  // Screenshot monitor: captures the screen every N seconds, the AI describes
  // the image, and the description runs through translate→TTS into the queue.
  // The recognition/output language is the SINGLE parameter that drives the
  // whole pipeline: OCR recognition → translation → TTS subtitle.
  getScreenshotMonitorStatus: () =>
    getJSON<{ success: boolean; enabled: boolean; interval: number; lang?: string }>(
      '/voice-subtitle/screenshot-monitor/status'),
  startScreenshotMonitor: (interval: number, lang = 'en') =>
    postJSON<{ success: boolean; message?: string }>(
      '/voice-subtitle/screenshot-monitor/start', { interval, lang }),
  stopScreenshotMonitor: () =>
    postJSON<{ success: boolean; message?: string }>(
      '/voice-subtitle/screenshot-monitor/stop', {}),
  // Change the recognition/output language live (applies on the next capture).
  setScreenshotLanguage: (lang: string) =>
    postJSON<{ success: boolean; lang: string }>(
      '/voice-subtitle/screenshot-monitor/language', { lang }),
  // Clipboard monitor: copied sentences are rewritten in English by the AI and
  // enqueued the same way.
  getClipboardMonitorStatus: () =>
    getJSON<{ success: boolean; enabled: boolean }>(
      '/voice-subtitle/clipboard-monitor/status'),
  startClipboardMonitor: () =>
    postJSON<{ success: boolean; message?: string }>(
      '/voice-subtitle/clipboard-monitor/start', {}),
  stopClipboardMonitor: () =>
    postJSON<{ success: boolean; message?: string }>(
      '/voice-subtitle/clipboard-monitor/stop', {}),

  // --- TTS (pycore voice-subtitle add-text pipeline) ---------------------- #
  tts: async (text: string, langs: string[] = ['en'], category = 'normal') => {
    const r = await postJSON<{ success?: boolean; task_id?: string }>(
      '/voice-subtitle/add-text', { text, langs, category });
    return {
      success: r?.success !== false,
      queued: true,
      task_id: r?.task_id,
      message: 'Queued for pycore TTS',
    };
  },

  // --- generic pycore passthrough (video-extract/code-sync/tasks) --------- #
  pyGet: <T = any>(path: string) => getJSON<T>(path.startsWith('/') ? path : `/${path}`),
  pyPost: <T = any>(path: string, body: unknown = {}, ceilingMs: number = 0) =>
    postJSON<T>(path.startsWith('/') ? path : `/${path}`, body, ceilingMs),

  ping: () => getJSON<{ success?: boolean; status?: string }>('/ping'),

  getRuntime: (): Promise<RuntimeInfo> => {
    const host = directPycoreHost();
    const wsUrl = pycoreWsUrlOverride() ?? buildPycoreWsUrl(host);
    const apiBase = buildPycoreHttpUrl(host, '/').replace(/\/$/, '');
    return Promise.resolve({ wsUrl, apiBase });
  },

  // --- system settings (persisted on the pycore backend) ------------------ #
  getSystemSettings: () =>
    getJSON<SystemSettingsResponse>('/api/local/user-data/system-settings'),
  setSystemSettings: (settings: Record<string, unknown>) =>
    postJSON<{ success: boolean; error?: string }>(
      '/api/local/user-data/system-settings', { settings }),

  // --- video extract history / options ------------------------------------ #
  getVideoExtractHistory: () =>
    getJSON<VideoExtractHistory>('/api/local/user-data/video-extract'),
  addVideoExtractEntry: (path: string, mode: VideoExtractMode) =>
    postJSON<VideoExtractHistory>(
      '/api/local/user-data/video-extract/add', { path, mode }),
  removeVideoExtractEntry: (path: string) =>
    postJSON<VideoExtractHistory>(
      '/api/local/user-data/video-extract/remove', { path }),
  setVideoExtractOptions: (options: Partial<VideoExtractOptions>) =>
    postJSON<{ success: boolean; error?: string }>(
      '/api/local/user-data/video-extract/options', { options }),

  // --- video extract capabilities ----------------------------------------- #
  getVideoExtractCapabilities: () =>
    getJSON<VideoExtractCapabilities>('/api/local/video-extract/capabilities'),

  // --- video extract: open a path in the OS file manager ------------------ #
  openVideoExtractPath: (kind: VideoExtractOpenKind, path?: string) =>
    postJSON<VideoExtractOpenResponse>(
      '/api/local/video-extract/open', { kind, path }),

  // --- video extract: segment ↔ subtitle map for the current file --------- #
  // `languages` (>=1 codes, includes the primary) requests the multi-language
  // correspondence slots per cue; omitted/empty → the legacy single-language map.
  getVideoExtractSegments: (path: string, languages?: string[]) =>
    postJSON<VideoExtractSegmentsResponse>(
      '/api/local/video-extract/segments', { path, languages }),

  // --- video extract: pause / resume / cancel a running task -------------- #
  pauseVideoExtractTask: (taskId: string) =>
    postJSON<{ success: boolean; error?: string }>(
      `/api/local/video-extract/tasks/${taskId}/pause`),
  resumeVideoExtractTask: (taskId: string) =>
    postJSON<{ success: boolean; error?: string }>(
      `/api/local/video-extract/tasks/${taskId}/resume`),
  cancelVideoExtractTask: (taskId: string) =>
    postJSON<{ success: boolean; error?: string }>(
      `/api/local/video-extract/tasks/${taskId}/cancel`),

  // --- live system resources (CPU / MEM / GPU) ---------------------------- #
  getSystemResources: () =>
    getJSON<SystemResourcesResponse>('/api/local/system/resources'),

  // --- native OS folder/file picker --------------------------------------- #
  pickPath: (mode: VideoExtractMode, initial?: string) =>
    postJSON<PickPathResult>(
      '/api/local/user-data/pick-path', { mode, initial }),

  // --- Books document analyze / preview (local, read-only; pre-sync) ------- #
  // supported-formats drives the format-filter sidebar; scan lists files fast
  // (no extraction); analyze extracts text + multi-language stats + a preview
  // for a single file or a whole folder (capped by max_files).
  getBooksSupportedFormats: () =>
    getJSON<BooksSupportedFormatsResponse>('/api/local/books/supported-formats'),
  booksScan: (path: string, formats?: string[]) =>
    postJSON<BooksScanResponse>('/api/local/books/scan', { path, formats }),
  booksAnalyze: (path: string, opts: BooksAnalyzeOptions = {}) =>
    postJSON<BooksAnalyzeResponse>('/api/local/books/analyze', { path, ...opts }),
  // Persisted Books state (sources + compact analysis + submission state) — the
  // UI reloads this on mount so history survives a page switch / reopen.
  getBooksState: () => getJSON<BooksStateResponse>('/api/local/books/state'),
  booksStateAdd: (path: string, mode: string, language?: string) =>
    postJSON<BooksStateResponse>('/api/local/books/state/add', { path, mode, language }),
  booksStateRemove: (path: string) =>
    postJSON<BooksStateResponse>('/api/local/books/state/remove', { path }),
  // One-shot batch submit to laravel_main (builds the model_version:3 payload
  // server-side). `languages` is the checked correspondence set (>=1, includes
  // the detected primary language) — empty slots are emitted as null per spec §5.
  // `source_type` marks the ingest's media kind (default 'book'; 'document' for
  // the Add Document flow) so the backend keys the per-language sentence rows by
  // the right source_type (spec §7). NOTE: pycore /books/submit must honor this
  // — see the backend-gap report.
  booksSubmit: (paths?: string[], language?: string, languages?: string[], source_type?: string) =>
    postJSON<BooksSubmitResponse>('/api/local/books/submit', { paths, language, languages, source_type }),
  // Paginated drill-down into a source's lists (words/sentences/languages), plus
  // the chapter -> sentence tree: kind='chapters' lists BookChapter[]; passing a
  // chapter_index (with kind='sentences'|'cues') returns that chapter's BookSlot[]
  // carrying every selected language side by side (blank where null). Cached
  // server-side per source so paging is cheap.
  booksList: (
    path: string, kind: string, start = 0, limit = 100,
    opts: { formats?: string[]; refresh?: boolean; max_files?: number;
            chapter_index?: number; languages?: string[]; grain?: string;
            sort_order?: 'asc' | 'desc'; query?: string; view_language?: string } = {},
  ) => postJSON<BooksListResponse>('/api/local/books/list', { path, kind, start, limit, ...opts }),
  // Drag-drop fallback for sandboxed browsers (no File.path): upload the bytes;
  // the backend stages them to disk and returns staged paths + analysis.
  // `languages` (>=1 codes) requests the per-language correspondence; `source_type`
  // marks the media kind staged ('book' default, 'document' for the Add Document
  // flow) so a later booksSubmit ingests it under the right source_type.
  booksAnalyzeUpload: async (
    files: File[],
    opts: { language?: string; languages?: string[]; preview_chars?: number; persist?: boolean; source_type?: string } = {},
  ): Promise<BooksAnalyzeResponse> => {
    // WS-PRIMARY: for reasonably-sized uploads, send the files base64-over-WS
    // (local_http.post bridge) so drag-drop upload rides the WS bus. Larger
    // uploads (over the WS frame budget) fall back to HTTP multipart.
    const totalRaw = files.reduce((s, f) => s + (f.size || 0), 0);
    if (isWsConnected() && totalRaw <= WS_UPLOAD_MAX_RAW_BYTES) {
      const b64Files = await Promise.all(
        files.map(async (f) => ({ name: f.name, data_b64: await fileToBase64(f) })),
      );
      return postJSON<BooksAnalyzeResponse>(
        '/api/local/books/analyze-upload-b64',
        {
          files: b64Files,
          language: opts.language,
          languages: opts.languages || [],
          preview_chars: opts.preview_chars,
          persist: !!opts.persist,
          source_type: opts.source_type || 'book',
        },
        POST_CEILING_MS,
        true, // softFail: return the envelope (matches the multipart r.json() path)
      );
    }
    // HTTP multipart fallback (oversized upload / WS not connected).
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f, f.name));
    if (opts.language) fd.append('language', opts.language);
    (opts.languages || []).forEach((l) => fd.append('languages', l));
    if (opts.preview_chars != null) fd.append('preview_chars', String(opts.preview_chars));
    if (opts.persist) fd.append('persist', 'true');
    if (opts.source_type) fd.append('source_type', opts.source_type);
    // No explicit Content-Type — the browser sets the multipart boundary.
    const r = await pycoreMasterClient.request('/api/local/books/analyze-upload', {
      method: 'POST', body: fd,
    });
    return (await r.json()) as BooksAnalyzeResponse;
  },

  // --- CoreBook portable format (pycore /api/local/corebook) -------------- #
  // Convert a document -> a saved CoreBook (1 book / N chapters / multi-language
  // / per-language audio), enrich it (add a language via batched AI translation;
  // fill audio locally via TTS) and submit it (whole or partial) to laravel_main.
  corebookList: () =>
    getJSON<CoreBookListResponse>('/api/local/corebook/list'),
  corebookConvert: (req: CoreBookConvertRequest) =>
    postJSON<CoreBookConvertResponse>('/api/local/corebook/convert', req),
  corebookGet: (source_key: string, start = 0, limit = 0) =>
    getJSON<CoreBookGetResponse>(
      `/api/local/corebook/get?source_key=${encodeURIComponent(source_key)}`
      + `&start=${start}&limit=${limit}`),
  corebookAddLanguage: (req: CoreBookAddLanguageRequest) =>
    postJSON<CoreBookEnrichResponse>('/api/local/corebook/add-language', req),
  corebookFillAudio: (req: CoreBookFillAudioRequest) =>
    postJSON<CoreBookEnrichResponse>('/api/local/corebook/fill-audio', req),
  corebookSubmit: (req: CoreBookSubmitRequest) =>
    postJSON<CoreBookSubmitResponse>('/api/local/corebook/submit', req),
  corebookDelete: (source_key: string): Promise<CoreBookDeleteResponse> =>
    // WS-primary (inherits deleteJSON's transport choice); query preserved by the bridge.
    deleteJSON<CoreBookDeleteResponse>(
      `/api/local/corebook/delete?source_key=${encodeURIComponent(source_key)}`),

  // --- code sync (peer mesh: dev/client roles + peer list) ---------------- #
  getPeers: () => getJSON<CodeSyncPeersResponse>('/code-sync/peers'),
  addPeer: (peer: { name: string; host: string; port: number; role: CodeSyncRole }) =>
    postJSON<CodeSyncPeersResponse>('/code-sync/peers/add', peer),
  removePeer: (id: string) =>
    postJSON<CodeSyncPeersResponse>('/code-sync/peers/remove', { id }),
  updatePeer: (patch: { id: string; name?: string; host?: string; port?: number; role?: CodeSyncRole }) =>
    postJSON<CodeSyncPeersResponse>('/code-sync/peers/update', patch),
  setRole: (role: CodeSyncRole) =>
    postJSON<CodeSyncPeersResponse & { role: CodeSyncRole }>(
      '/code-sync/role', { role }),
  setDistribute: (enabled: boolean) =>
    postJSON<{ success: boolean; distributing: boolean; message?: string; error?: string }>(
      '/code-sync/distribute', { enabled }),
  setSkipUpdate: (enabled: boolean) =>
    postJSON<{ success: boolean; skip_update: boolean; message?: string; error?: string }>(
      '/code-sync/skip-update', { enabled }),
  discoverPeers: () =>
    postJSON<{ success: boolean; candidates: CodeSyncCandidate[]; message?: string; error?: string }>(
      '/code-sync/discover', {}),

  // --- code sync filter settings (presets + per-machine .data override) --- #
  getSyncSettings: () => getJSON<SyncSettingsResponse>('/code-sync/settings'),
  setSyncSettings: (patch: Partial<SyncSettings>) =>
    postJSON<{ success: boolean; settings: SyncSettings; error?: string }>(
      '/code-sync/settings', patch),
  resetSyncSettings: () =>
    postJSON<{ success: boolean; settings: SyncSettings; error?: string }>(
      '/code-sync/settings/reset', {}),
  getSyncLogs: (limit = 100) =>
    getJSON<{ success: boolean; role: CodeSyncRole; logs: SyncLogEntry[] }>(
      `/code-sync/logs?limit=${limit}`),

  // --- code sync file structure (live tree of the synced set) ------------- #
  getFileTree: () => getJSON<FileTreeResponse>('/code-sync/file-tree'),
  // Dev-side: a specific client's received tree + drift vs this dev's synced set.
  getPeerFileTree: (peerId: string) =>
    getJSON<PeerFileTreeResponse>(`/code-sync/peer-file-tree?peer_id=${encodeURIComponent(peerId)}`),

  // --- AI provider catalog (NO network test — cheap, never spends quota) --- #
  // Renders the grid on page load; live availability is tested on demand only.
  getAiCatalog: () => getJSON<AiProbeResponse>('/api/local/ai/catalog'),

  // --- AI provider availability probe (live test) ------------------------- #
  // probeAi() tests ALL providers (the "Test all" button, rate-aware + cached).
  probeAi: (refresh = false) =>
    getJSON<AiProbeResponse>(`/api/local/ai/probe${refresh ? '?refresh=1' : ''}`),

  // Test ONE provider (per-card "Test"): live, never cached, rate-aware.
  probeAiOne: (provider: string) =>
    getJSON<AiProvider>(`/api/local/ai/probe?provider=${encodeURIComponent(provider)}`),

  // --- AI account balance / remaining credit ------------------------------- #
  // Only openrouter / deepseek / siliconflow / moonshot expose a balance API;
  // every other provider returns supported:false WITHOUT a network call
  // (billing is console-only — e.g. Gemini, OpenAI, Anthropic). Never cached.
  getAiBalances: () => getJSON<AiBalanceResponse>('/api/local/ai/balance'),
  getAiBalanceOne: (provider: string) =>
    getJSON<AiBalance>(`/api/local/ai/balance?provider=${encodeURIComponent(provider)}`),

  // --- AI local rate budgets (auto-reset by the pyheartbeat tick) ---------- #
  // Cheap poll: current per-minute/day/month usage vs limits + resets-in
  // countdown. No provider call; lets the UI show budgets resetting live.
  getAiRateLimits: () =>
    getJSON<AiRateLimitsResponse>('/api/local/ai/rate-limits'),

  // --- AI chat confirm (explicit provider) --------------------------------- #
  aiChat: (provider: string, messages: AiChatMessage[], model?: string) =>
    postJSON<AiChatResponse>('/api/local/ai/chat', { provider, messages, model }, 0),

  // --- AI auto (unified gateway: smart dispatch + fallback) ---------------- #
  // One round trip; the backend picks the provider by tier/quota/cooldown and
  // the response says which AI handled it. `source` labels the task in the
  // gateway records.
  aiAuto: (messages: AiChatMessage[], source?: string, model?: string) =>
    postJSON<AiChatResponse>('/api/local/ai/chat',
      { provider: 'auto', messages, model, source }, 0),

  // --- AI gateway status (tiers, quotas, cooldowns, task records) ---------- #
  getAiGateway: () => getJSON<AiGatewayStatus>('/api/local/ai/gateway'),

  // --- AI key management (indexed secret-store key files) ------------------ #
  // List every provider's key base + per-slot rotation status (KEY1/KEY2…),
  // plus the raw env-var names of each configured key file (for targeted
  // delete). Read-only; never returns full secrets (slots are masked).
  getAiKeys: () => getJSON<AiKeysResponse>('/api/local/ai/keys'),
  // Write ONE indexed key file ({BASE}_{index}, or {BASE}_IMAGE_{index} when
  // image=true) then re-probe. Values are write-only — never echoed back.
  setAiKey: (body: AiKeySetRequest) =>
    postJSON<AiKeySetResponse>('/api/local/ai/keys', body),
  // Delete one specific key file by its exact env-var name (e.g.
  // GOOGLE_API_KEY_2 or OPENAI_API_KEY_IMAGE_1).
  deleteAiKey: (keyName: string) =>
    deleteJSON<AiKeyDeleteResponse>(
      `/api/local/ai/keys/${encodeURIComponent(keyName)}`),
  // Clear the cooldown on one rotation key so it becomes usable again. `index`
  // targets a specific slot (0-based); `image` targets the dedicated image
  // budget instead of the text keys. Omitting index clears every slot.
  resetKeyCooldown: (req: { provider: string; index?: number; image?: boolean }) =>
    postJSON<AiKeyResetCooldownResponse>('/api/local/ai/keys/reset-cooldown', req),

  // --- AI usage (SHARED cross-runtime store — text / vision / probe) ------- #
  // The store is shared with laravel, so this returns usage from BOTH runtimes
  // (see each record's `runtime`). Image generations are NOT here — they live in
  // the image history. Wrapped into the dashboard APIResponse envelope so the
  // shared AiUsagePanel can read `res.success && res.data` uniformly.
  getAiUsage: async (limit = 150): Promise<{ success: boolean; data: AiUsageResponse | null; error: string | null }> => {
    try {
      const r = await getJSON<AiUsageResponse>(
        `/api/local/ai/usage?limit=${encodeURIComponent(String(limit))}`);
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
    postJSON<AiImageResponse>('/api/local/ai/image', req, 0),

  // One-click "Test this provider": force a single image provider, ignoring the
  // cooldown/rate window. Returns the same AiImageResponse shape (base64 + mime
  // + latency) so the caller can show the image + latency in a popup.
  testImageProvider: (req: { provider: string; prompt?: string; size?: string; model?: string }) =>
    postJSON<AiImageResponse>('/api/local/ai/image/test', req, 0),

  // --- AI image history (SHARED store — pycore + laravel entries) ---------- #
  // Metadata only (newest-first); fetch bytes via imageHistoryFileUrl(id).
  getImageHistory: (limit = 50) =>
    getJSON<ImageHistoryResponse>(`/api/local/ai/image/history?limit=${encodeURIComponent(String(limit))}`),
  /** Raw-bytes URL for one history entry's image (use directly in an <img src>). */
  imageHistoryFileUrl: (id: string): string =>
    `/api/local/ai/image/history/file/${encodeURIComponent(id)}`,
  deleteImageHistory: (id: string) =>
    deleteJSON<ImageHistoryDeleteResponse>(`/api/local/ai/image/history/${encodeURIComponent(id)}`),
  clearImageHistory: () =>
    postJSON<ImageHistoryClearResponse>('/api/local/ai/image/history/clear', {}),
  /** Reveal a generated image's folder in the OS file manager (path resolved by id). */
  revealImage: (id: string) =>
    postJSON<RevealResponse>(`/api/local/ai/image/history/${encodeURIComponent(id)}/reveal`, {}),

  // --- Speech (TTS/STT) clip history — audio side of the Records timeline --- #
  getSpeechHistory: (limit = 50) =>
    getJSON<SpeechHistoryResponse>(`/api/local/speech/history?limit=${encodeURIComponent(String(limit))}`),
  /** Raw-bytes URL for one clip (use directly in an <audio src>). */
  speechHistoryFileUrl: (id: string): string =>
    `/api/local/speech/history/file/${encodeURIComponent(id)}`,
  deleteSpeechHistory: (id: string) =>
    deleteJSON<{ success: boolean }>(`/api/local/speech/history/${encodeURIComponent(id)}`),
  clearSpeechHistory: () =>
    postJSON<{ success: boolean; removed: number }>('/api/local/speech/history/clear', {}),
  /** Open the clip's folder in the OS file manager (path resolved by id). */
  revealSpeech: (id: string) =>
    postJSON<RevealResponse>(`/api/local/speech/history/${encodeURIComponent(id)}/reveal`, {}),

  // --- OCR engine availability (windows -> easyocr -> cnocr priority) ------ #
  getOcrStatus: () => getJSON<OcrStatus>('/api/local/ocr/status'),

  // --- TTS live availability + version (edge-tts 403/region probe) --------- #
  getTtsStatus: (refresh = false) =>
    getJSON<TtsStatus>(`/api/local/tts/status${refresh ? '?refresh=1' : ''}`),

  // --- TTS tuning: per-attempt synth timeout + edge failure cooldown ------- #
  getTtsSettings: () => getJSON<TtsSettings>('/api/local/tts/settings'),
  setTtsSettings: (patch: {
    synth_timeout_s?: number;
    edge_cooldown_s?: number;
    server_auto_manage?: boolean;
    server_single_active?: boolean;
    server_idle_shutdown_s?: number;
    server_enabled?: Record<string, boolean>;
  }) =>
    postJSON<TtsSettings>('/api/local/tts/settings', patch),

  postTtsServer: (req: { engine: string; enabled?: boolean; start?: boolean }) =>
    postJSON<TtsServerActionResponse>('/api/local/tts/server', req, 0),

  // --- Local LLM engines (article pipeline): status / test / server control -- #
  getLlmStatus: () => getJSON<LlmStatus>('/api/local/llm/status'),

  testLlmEngine: (req: { engine?: string }) =>
    postJSON<LlmTestResponse>('/api/local/llm/test', req, 0, true),

  controlLlmServer: (req: { engine: string; enabled?: boolean; start?: boolean }) =>
    postJSON<LlmServerActionResponse>('/api/local/llm/server', req, 0),

  // --- TTS live per-engine synth test (actually runs the engine) ----------- #
  // Always over WS (no HTTP fallback). Accepts per-engine extra params
  // (speaker, instruct, gender, voice, description, cfg_value, timesteps,
  // speaker_id, prompt_text, prompt_lang, speed) — ignored by engines that
  // don't use them.
  testTts: (req: Record<string, unknown>) => {
    if (!isWsConnected()) throw new Error('pycore WebSocket not connected — test requires WS');
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return callRpc('local.tts.test', params, LIVE_TEST_RPC_TIMEOUT_MS) as Promise<TtsTestResponse>;
  },

  // --- STT engine availability + live recognition test --------------------- #
  getSttStatus: () => getJSON<SttStatus>('/api/local/stt/status'),
  testStt: (req: { engine?: string; language?: string; text?: string; model?: string }) => {
    if (!isWsConnected()) throw new Error('pycore WebSocket not connected — test requires WS');
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return callRpc('local.stt.test', params, LIVE_TEST_RPC_TIMEOUT_MS) as Promise<SttTestResponse>;
  },

  // --- OCR live per-engine recognition test -------------------------------- #
  testOcr: (req: { engine?: string; image_data?: string; image_path?: string; lang?: string; model_type?: string; languages?: string[] }) => {
    if (!isWsConnected()) throw new Error('pycore WebSocket not connected — test requires WS');
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '' && v !== null) params[k] = v; }
    return callRpc('local.ocr.test', params, LIVE_TEST_RPC_TIMEOUT_MS) as Promise<OcrTestResponse>;
  },

  // --- AI chat test (one turn through gateway or explicit provider) --------- #
  testAiChat: (req: { provider: string; messages?: AiChatMessage[]; message?: string; model?: string; source?: string }) => {
    if (!isWsConnected()) throw new Error('pycore WebSocket not connected — test requires WS');
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return callRpc('local.ai.chat', params, LIVE_TEST_RPC_TIMEOUT_MS) as Promise<AiChatResponse>;
  },

  // --- AI image test (one provider, inline base64 result) ------------------- #
  testAiImage: (req: { provider: string; prompt?: string; size?: string; model?: string }) => {
    if (!isWsConnected()) throw new Error('pycore WebSocket not connected — test requires WS');
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(req)) { if (v !== undefined && v !== '') params[k] = v; }
    return callRpc('local.ai.image.test', params, LIVE_TEST_RPC_TIMEOUT_MS) as Promise<AiImageResponse>;
  },

  // --- Engine model-load progress (class-B models + class-C servers) ------- #
  // Live per-engine load state (idle|loading|loaded|error) + elapsed + a tail of
  // the startup/load log, for TTS and STT alike. The authoritative snapshot; the
  // rpc_v2 'engine_load_status_update' WS event pushes per-engine deltas between polls.
  getEnginesLoadStatus: () =>
    getJSON<EnginesLoadStatusResponse>('/api/local/engines/load-status'),

  // --- Capabilities: CUDA/compute + free-library availability -------------- #
  getCapabilities: () => getJSON<CapabilityStatus>('/api/local/capabilities/status'),

  // --- Code version: pycore's own + the pointed-to laravel backend's -------- #
  // UI -> pycore -> laravel: pycore reports its own newest-source mtime AND
  // proxies the laravel /api/dashboard/code-last-modified probe. Inherits WS via
  // getJSON (the /api/local/ bridge). TTL-cached backend-side.
  getVersion: () => getJSON<PcVersionInfo>('/api/local/version'),

  // --- System info: read-only constants + static dirs (one-click open) ----- #
  getSystemInfo: () => getJSON<SystemInfo>('/api/local/capabilities/info'),
  openStaticDir: (key: string) =>
    postJSON<OpenDirResponse>('/api/local/capabilities/open-dir', { key }),

  // --- translation queue (Laravel pending queue, steered via pycore) ------ #
  queueTranslation: (refresh = false) =>
    getJSON<TranslationQueueResponse>(
      `/api/local/translation/queue${refresh ? '?refresh=1' : ''}`),
  setQueuePriority: (task_id: string, priority: number) =>
    postJSON<TranslationQueueActionResponse>(
      '/api/local/translation/queue/priority', { task_id, priority }),
  stackQueue: (words: string[], language: string, target_language: string, priority?: number) =>
    postJSON<TranslationQueueActionResponse>(
      '/api/local/translation/queue/stack',
      { words, language, target_language, ...(priority != null ? { priority } : {}) }),

  /** Full pyctl TaskManager record — Task Queue tab detail modal. */
  getLocalTaskDetail: (taskId: string) =>
    getJSON<LocalTaskDetailResponse>(
      `/api/local/task-center/tasks/${encodeURIComponent(taskId)}`),

  /** Laravel global_tasks row — proxied via QueueMonitorService (UI-selected Laravel base). */
  getTranslationTaskDetail: (taskId: string) =>
    getJSONEnvelope<PycoreGlobalTaskDetailResponse>(
      `/api/local/translation/queue/tasks/${encodeURIComponent(taskId)}`),

  /** Richer Laravel bundle (task + events + phase) — task-center detail proxy. */
  getRemoteGlobalTaskDetail: (taskId: string) =>
    getJSONEnvelope<PycoreGlobalTaskDetailResponse>(
      `/api/local/task-center/tasks/${encodeURIComponent(taskId)}/detail`),

  // --- Assist Laravel (pycore drains Laravel's cover/tts/translation work) - #
  // Status includes the worker loop state, circuit breaker, counters and the
  // last observed Laravel-side queue counts. Config is a PATCH (only the
  // provided fields change). Cycle runs one claim→process→submit pass NOW and
  // returns 400 when assist is disabled.
  getAssistStatus: () =>
    getJSON<AssistStatus>('/api/local/assist/status'),
  setAssistConfig: (config: AssistConfigPatch) =>
    postJSON<AssistConfigResponse>('/api/local/assist/config', config),
  runAssistCycle: () =>
    postJSON<AssistCycleResponse>('/api/local/assist/cycle', {}),

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
    return getJSON<PcTaskRecentResponse>(`/api/local/tasks/recent?${q.toString()}`);
  },
  clearRecentTasks: () =>
    postJSON<PcTaskClearResponse>('/api/local/tasks/clear', {}),
  getCompletedTasks: (params: { limit?: number; offset?: number; task_type?: string } = {}) => {
    const q = new URLSearchParams();
    q.set('limit', String(params.limit ?? 200));
    q.set('offset', String(params.offset ?? 0));
    if (params.task_type) q.set('task_type', params.task_type);
    return getJSON<PcCompletedTaskArchiveResponse>(`/api/local/tasks/completed?${q.toString()}`);
  },
  syncCompletedTasks: () =>
    postJSON<PcCompletedTaskSyncResponse>(
      '/api/local/tasks/completed/sync', {}, LIVE_TEST_RPC_TIMEOUT_MS,
    ),
  completedTaskResourceUrl: (cacheKey: string) =>
    rewritePycoreEndpoint(`/api/local/tasks/completed/resources/${encodeURIComponent(cacheKey)}`),

  // --- Movie / TV poster (TMDB + OMDB key status + fetch toggle + lookup) -- #
  // status: masked provider keys + the ingest fetch flag (media_sync.fetch_poster).
  // config: persist that same flag. test: one poster lookup with the base64 image
  // inlined so the UI can preview it (never throws — {found:false} on a miss).
  getPosterStatus: () => getJSON<PosterStatus>('/api/local/poster/status'),
  setPosterConfig: (enabled: boolean) =>
    postJSON<PosterStatus>('/api/local/poster/config', { enabled }),
  testPoster: (title: string, year?: number) =>
    postJSON<PosterTestResponse>('/api/local/poster/test',
      year != null ? { title, year } : { title }),
  /** Zero the local-reuse-vs-fetch counters; returns the fresh status. */
  resetPosterStats: () =>
    postJSON<PosterStatus>('/api/local/poster/stats/reset', {}),

  // --- Google Translate (free googletrans + AI comparison on one input) --- #
  // status: googletrans availability/version + cache info. translate: the free
  // lib path ({error} on failure, never throws). translateAi: the SAME text
  // through the unified AI gateway so the UI can compare Google vs AI.
  getTranslateStatus: () => getJSON<TranslateStatus>('/api/local/translate/status'),
  translate: (text: string, src = 'auto', dest = 'en', useCache = true) =>
    postJSON<TranslateResponse>('/api/local/translate',
      { text, src, dest, use_cache: useCache }),
  translateAi: (text: string, src = 'auto', dest = 'en') =>
    postJSON<TranslateAiResponse>('/api/local/translate/ai', { text, src, dest }),

  // --- Image search (SerpApi Google-Images + AI comparison + history) ----- #
  // status: SerpApi key present + engine + history count. search: real Google
  // images for a query (records history). searchAi: an AI render of the SAME
  // query (unified IMAGE contract). compare: both in one call + a combined
  // history record. Plus the search-history list/delete/clear. This is the same
  // SerpApi capability the poster pipeline now prefers as its first source.
  getImageSearchStatus: () => getJSON<ImageSearchStatus>('/api/local/image-search/status'),
  searchImages: (query: string, num = 12, country?: string, record = true) =>
    postJSON<ImageSearchResponse>('/api/local/image-search',
      { query, num, country, record }),
  searchImagesAi: (query: string, size?: string, model?: string) =>
    postJSON<AiImageResponse>('/api/local/image-search/ai', { query, size, model }),
  compareImages: (query: string, num = 12, country?: string, size?: string, model?: string) =>
    postJSON<ImageSearchCompareResponse>('/api/local/image-search/compare',
      { query, num, country, size, model }),
  getImageSearchHistory: (limit = 50) =>
    getJSON<ImageSearchHistoryResponse>(`/api/local/image-search/history?limit=${encodeURIComponent(String(limit))}`),
  deleteImageSearchHistory: (id: string) =>
    deleteJSON<ImageSearchHistoryDeleteResponse>(`/api/local/image-search/history/${encodeURIComponent(id)}`),
  clearImageSearchHistory: () =>
    postJSON<ImageSearchHistoryClearResponse>('/api/local/image-search/history/clear', {}),

  // --- Subtitle search (OpenSubtitles search + download + history) -------- #
  // status: OpenSubtitles key present + authenticated state + history count.
  // probe: a lightweight reachability/latency check. search: subtitles for a
  // movie/TV title (records history). download: pull one result's file (inline
  // .srt content or a saved path). Plus the search-history list/delete/clear.
  getSubtitleSearchStatus: () =>
    getJSON<SubtitleSearchStatus>('/api/local/subtitle-search/status'),
  probeSubtitleSearch: () =>
    getJSON<SubtitleSearchProbe>('/api/local/subtitle-search/probe'),
  // Provider fallback chain (ordered) + a live per-provider probe.
  getSubtitleProviders: () =>
    getJSON<SubtitleProvidersResponse>('/api/local/subtitle-search/providers'),
  testSubtitleProvider: (name: string) =>
    postJSON<SubtitleProviderProbe>(`/api/local/subtitle-search/providers/${encodeURIComponent(name)}/test`, {}),
  // Download cache: cached subtitle downloads are reused so a rate/quota-limited
  // provider file is never pulled twice. Stats are local (no network); clear wipes it.
  getSubtitleCacheStats: () => getJSON<SubtitleCacheStats>('/api/local/subtitle-search/cache'),
  clearSubtitleCache: () => postJSON<SubtitleCacheClearResponse>('/api/local/subtitle-search/cache/clear', {}),
  searchSubtitles: (query: string, opts: SubtitleSearchOptions = {}) =>
    postJSON<SubtitleSearchResponse>('/api/local/subtitle-search',
      { query, ...opts }),
  downloadSubtitle: (file_id: number | string, record = true) =>
    postJSON<SubtitleDownloadResponse>('/api/local/subtitle-search/download',
      { file_id, record }),
  getSubtitleSearchHistory: (limit = 50) =>
    getJSON<SubtitleSearchHistoryResponse>(`/api/local/subtitle-search/history?limit=${encodeURIComponent(String(limit))}`),
  deleteSubtitleSearchHistory: (id: string) =>
    deleteJSON<SubtitleSearchHistoryDeleteResponse>(`/api/local/subtitle-search/history/${encodeURIComponent(id)}`),
  clearSubtitleSearchHistory: () =>
    postJSON<SubtitleSearchHistoryClearResponse>('/api/local/subtitle-search/history/clear', {}),

  // --- Word audio (real pronunciation lookup + TTS fallback) -------------- #
  // status: which real-pronunciation sources are wired (pycore reports 3:
  // free_dictionary_api / cambridge_dictionary / forvo — the last key-gated),
  // whether the Forvo key is present (never the value), and that TTS covers a
  // miss. test: a REAL live fetch through the existing client; on a hit the raw
  // audio bytes come back base64-encoded (play as a data: URI), on a clean miss
  // {success:false, provider:null, message}.
  getWordAudioStatus: () =>
    getJSON<WordAudioStatus>('/api/local/word-audio/status'),
  testWordAudio: (word: string, lang = 'en') =>
    postJSON<WordAudioTestResponse>('/api/local/word-audio/test', { word, lang }),

  // --- Puter.js word-audio batch (browser-side synth -> laravel upload) ---- #
  // Fetch up to `limit` missing-audio words (is_valid=true only) for the
  // Queue Center persistent batch bar. pycore proxies laravel.
  getWordAudioMissingBatch: (limit = 1000, language = 'en') =>
    getJSON<{ success: boolean; language?: string; count?: number; words?: { word: string; md5: string; language: string }[]; error?: string }>(
      `/api/local/word-audio/missing-batch?limit=${encodeURIComponent(String(limit))}&language=${encodeURIComponent(language)}`,
    ),
  // Upload one synthesized clip (base64 mp3) -> laravel store (fill-missing).
  // `cleaned_word` notifies laravel the spoken text was cleaned (HTML entities
  // -> '-') so the backend can fix the dictionary row content.
  uploadWordAudio: (payload: { md5: string; lang: string; audio_base64: string; provider?: string; accent?: 'us' | 'uk' | null; cleaned_word?: string }) =>
    postJSON<{ success: boolean; data?: { stored: boolean; md5: string; language: string }; error?: string }>(
      '/api/local/word-audio/upload', payload,
    ),
  // Fetch audio from the Youdao (Longman CDN) via pycore proxy (avoids CORS).
  // type=1 -> UK, type=2 -> US. Returns base64 mp3 on success.
  fetchYoudaoAudio: (word: string, type: 1 | 2 = 2) =>
    getJSON<{ success: boolean; audio_base64?: string; mime?: string; bytes?: number; error?: string }>(
      `/api/local/word-audio/youdao?word=${encodeURIComponent(word)}&type=${type}`,
    ),
  synthesizeWordEdgeTts: (word: string, lang = 'en', accent = 'us') =>
    postJSON<{ success: boolean; audio_base64?: string; accent?: string; bytes?: number; mime?: string; error?: string }>(
      '/api/local/word-audio/edge-synth', { word, lang, accent },
    ),
  // Write back the cleaned word text to the laravel dictionary row (garbled
  // text / HTML markup -> '-' replacement detected during browser-side batch).
  fixWordText: (payload: { md5: string; lang: string; cleaned_word: string }) =>
    postJSON<{ success: boolean; updated?: number; error?: string }>(
      '/api/local/word-audio/fix-word', payload,
    ),
  // Move a word to the front of the audio generation queue. Broadcasts
  // 'word_audio_priority_boost' on the pycore WS bus so the pycore-manager
  // Queue Center batch bar re-orders its in-flight pending list immediately.
  boostWordAudioPriority: (md5: string, lang: string) =>
    postJSON<{ success: boolean; laravel_updated?: boolean; error?: string }>(
      '/api/local/word-audio/boost-priority', { md5, lang },
    ),
  boostWordAudioPriorities: (items: Array<{ md5: string; lang: string }>) =>
    postJSON<{ success: boolean; count: number; results?: Array<Record<string, unknown>>; error?: string }>(
      '/api/local/word-audio/boost-priority/batch', { items },
    ),

  // --- translate history (Google / AI translate usage records) ------------ #
  getTranslateHistory: (limit = 50) =>
    getJSON<TranslateHistoryResponse>(`/api/local/translate/history?limit=${encodeURIComponent(String(limit))}`),
  deleteTranslateHistory: (id: string) =>
    deleteJSON<TranslateHistoryDeleteResponse>(`/api/local/translate/history/${encodeURIComponent(id)}`),
  clearTranslateHistory: () =>
    postJSON<TranslateHistoryClearResponse>('/api/local/translate/history/clear', {}),

  // --- Agent history (local Claude/Codex/Cursor/Gemini txt store) ---------- #
  getAgentHistoryIndex: () =>
    getJSON<AgentHistoryIndexResponse>('/api/local/agent-history/index'),
  getAgentHistoryPrompts: (params?: {
    tool?: string; user?: string; q?: string; lang?: string;
    limit?: number; offset?: number; page?: number; pageSize?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.tool) qs.set('tool', params.tool);
    if (params?.user) qs.set('user', params.user);
    if (params?.q) qs.set('q', params.q);
    if (params?.lang) qs.set('lang', params.lang);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.offset != null) qs.set('offset', String(params.offset));
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize));
    const tail = qs.toString();
    return getJSON<AgentHistoryPromptsResponse>(`/api/local/agent-history/prompts${tail ? `?${tail}` : ''}`);
  },
  getAgentHistorySession: (id: string) =>
    getJSON<AgentHistorySessionResponse>(`/api/local/agent-history/sessions/${encodeURIComponent(id)}`),
  refreshAgentHistory: () =>
    postJSON<{ success: boolean; data?: Record<string, unknown>; error?: string | null }>(
      '/api/local/agent-history/refresh', {},
    ),
  updateAgentHistoryPrompt: (id: string, text: string) =>
    postJSON<{ success: boolean; data?: { id: string; text: string; edited: boolean }; error?: string | null }>(
      '/api/local/agent-history/prompts/update', { id, text },
    ),
  getAgentHistoryArticleConfig: () =>
    getJSON<{ success: boolean; data?: Record<string, unknown>; error?: string | null }>(
      '/api/local/agent-history/article/config',
    ),
  saveAgentHistoryArticleConfig: (body: Record<string, unknown>) =>
    postJSON<{ success: boolean; data?: Record<string, unknown>; error?: string | null }>(
      '/api/local/agent-history/article/config', body,
    ),
  startAgentHistoryArticlePipeline: () =>
    postJSON<{ success: boolean; data?: Record<string, unknown>; error?: string | null }>(
      '/api/local/agent-history/article/start', {},
    ),
  getAgentHistoryArticles: (limit = 50) =>
    getJSON<{ success: boolean; data?: { items: Record<string, unknown>[] }; error?: string | null }>(
      `/api/local/agent-history/articles?limit=${encodeURIComponent(String(limit))}`,
    ),
  getAgentHistoryArticleLogs: () =>
    getJSON<{ success: boolean; data?: Record<string, unknown>; error?: string | null }>(
      '/api/local/agent-history/article/logs',
    ),
  getAgentHistoryArticleRecords: (limit = 100) =>
    getJSON<AgentHistoryArticleRecordsResponse>(
      `/api/local/agent-history/article/records?limit=${encodeURIComponent(String(limit))}`,
    ),
  // Absolute audio/mpeg URL on the active pycore target (for <audio src>).
  getAgentHistoryArticleAudioUrl: (recordId: string | number): string =>
    rewritePycoreEndpoint(`/api/local/agent-history/article/audio/${encodeURIComponent(String(recordId))}`),

  // --- Queue Center: unified overview (contract A) ------------------------ #
  // pycore is the hub: it fans out to the selected Laravel endpoint for the
  // per-category counts + worker registry and merges its own engine status. All
  // 8 categories are always present (zeros when empty); laravel_reachable:false
  // means the counts are zeroed but the categories + local engines still report.
  getQueueOverview: () =>
    getJSON<PcQueueOverview>('/api/local/queue/overview'),

  // --- Sentence-audio auto-start (Queue Center strip) --------------------- #
  getSentenceAudioAutoStatus: () =>
    getJSON<SentenceAudioAutoStatus>('/api/local/sentence-audio/status'),
  setSentenceAudioAutoConfig: (autoStart: boolean) =>
    postJSON<SentenceAudioAutoStatus>('/api/local/sentence-audio/config', { auto_start: autoStart }),
  // Backend config model requires auto_start, so the current value goes along.
  setSentenceAudioConcurrency: (concurrency: number, autoStart: boolean) =>
    postJSON<SentenceAudioAutoStatus>('/api/local/sentence-audio/config', { auto_start: autoStart, concurrency }),
  runSentenceAudioOnce: () =>
    postJSON<{ ok: boolean; error?: string }>('/api/local/sentence-audio/run-once', {}),
  getSentenceAudioQueue: () =>
    getJSON<SentenceAudioQueueSnapshot>('/api/local/sentence-audio/queue'),

  // --- Sentence-audio voice variants (per-language accent/gender specs) ----- #
  // pycore proxies laravel: GET returns the variant specs for a language; POST
  // replaces the full spec list for that language; DELETE removes one variant.
  getSentenceVoiceVariants: async (lang: string): Promise<SentenceVoiceVariant[]> => {
    const r = await getJSON<{ success: boolean; specs: SentenceVoiceVariant[] }>(
      `/api/local/sentence-audio/variants?lang=${encodeURIComponent(lang)}`);
    return r?.specs ?? [];
  },
  saveSentenceVoiceVariants: (
    lang: string,
    specs: Array<{ variant_key: string; accent: string | null; gender: string; is_primary: boolean }>,
  ) =>
    postJSON<{ success: boolean; specs: SentenceVoiceVariant[] }>(
      '/api/local/sentence-audio/variants', { lang, specs }),
  deleteSentenceVoiceVariant: (lang: string, variant_key: string) =>
    deleteJSON<{ success: boolean }>(
      `/api/local/sentence-audio/variants?lang=${encodeURIComponent(lang)}&variant_key=${encodeURIComponent(variant_key)}`),
  getQueueBumps: (limit = 30) =>
    getJSON<QueueBumpsSnapshot & { success?: boolean }>(`/api/local/queue/bumps?limit=${limit}`),

  getTaskCapabilityChains: () =>
    getJSON<{ success?: boolean; chains?: { translation: string[]; voice_tts: string[] } }>(
      '/api/local/task-settings/chains',
    ),
  saveTaskCapabilityChain: (taskType: string, priority: string[]) =>
    postJSON<{ success?: boolean; chains?: { translation: string[]; voice_tts: string[] } }>(
      '/api/local/task-settings/chains',
      { task_type: taskType, priority },
    ),
  searchTaskHistory: (params: {
    q?: string; date_from?: string; date_to?: string; task_type?: string; worker?: string; limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.date_from) qs.set('date_from', params.date_from);
    if (params.date_to) qs.set('date_to', params.date_to);
    if (params.task_type) qs.set('task_type', params.task_type);
    if (params.worker) qs.set('worker', params.worker);
    if (params.limit) qs.set('limit', String(params.limit));
    const tail = qs.toString() ? `?${qs.toString()}` : '';
    return getJSON<{ success?: boolean; entries?: any[]; total?: number; stored?: number }>(
      `/api/local/tasks/search${tail}`,
    );
  },

  // --- Word-dictionary TTS auto-start (Queue Center strip) ---------------- #
  getWordTtsAutoStatus: () =>
    getJSON<WordTtsAutoStatus>('/api/local/word-tts/status'),
  setWordTtsAutoConfig: (autoStart: boolean) =>
    postJSON<WordTtsAutoStatus>('/api/local/word-tts/config', { auto_start: autoStart }),
  // Backend config model requires auto_start, so the current value goes along.
  setWordTtsConcurrency: (concurrency: number, autoStart: boolean) =>
    postJSON<WordTtsAutoStatus>('/api/local/word-tts/config', { auto_start: autoStart, concurrency }),
  runWordTtsOnce: () =>
    postJSON<{ ok: boolean; error?: string }>('/api/local/word-tts/run-once', {}),

  // --- Heartbeat workers overview (Queue Center worker strip) ------------- #
  getHeartbeatWorkersStatus: () =>
    getJSON<HeartbeatWorkersStatus>('/api/local/heartbeat-workers/status'),
  setHeartbeatWorkerConfig: (callbackName: string, enabled: boolean) =>
    postJSON<{ success: boolean; ok?: boolean; error?: string }>(
      '/api/local/heartbeat-workers/config',
      { callback_name: callbackName, enabled },
    ),
  getTaskCenter: () =>
    getJSON<PcTaskCenterResponse>('/api/local/task-center'),
  getQueueCenterSnapshot: () =>
    getJSON<QueueCenterSnapshot>('/api/local/task-center/snapshot'),
  setQueueCenterControl: (control: QueueCenterControlName, enabled: boolean) =>
    postJSON<{ success: boolean; control: QueueCenterControlName; enabled: boolean; error?: string }>(
      `/api/local/task-center/controls/${encodeURIComponent(control)}`,
      { enabled },
    ),
  wordAudioMediaUrl: (word: string, language = 'en') =>
    rewritePycoreEndpoint(`/api/local/word-audio/media?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`),

  // --- Queue Center: capability settings (contract B) --------------------- #
  // Read all four capability blocks (priority + availability + options).
  getCapabilitySettings: () =>
    getJSON<PcCapabilitySettings>('/api/local/capabilities/settings'),
  // Persist ONE capability's priority/options and live-apply; returns the
  // updated block. `priority` re-orders the engine chain (omitted engines are
  // appended in default order server-side, so a save can never silence it);
  // `options` carries the TTS tuning (synth_timeout_s / edge_cooldown_s).
  saveCapabilitySettings: (
    capability: PcCapabilityKey,
    patch: { priority?: string[]; options?: PcCapabilityOptions },
  ) =>
    postJSON<PcCapabilitySaveResponse>('/api/local/capabilities/settings', {
      capability, ...patch,
    }, 30_000),

  // --- Offline dictionary (ECDICT + WordNet) ------------------------------ #
  // Free, offline word translation served alongside Google/AI. status reports
  // whether the data is installed (run 107_install_dictionaries.sh).
  getDictionaryStatus: () =>
    getJSON<DictionaryStatus>('/api/local/dictionary/status'),
  getDictionaryLookup: (word: string, target = 'zh') =>
    getJSON<DictionaryEntry>(
      `/api/local/dictionary/lookup?word=${encodeURIComponent(word)}&target=${encodeURIComponent(target)}`),

  // --- auto-start on boot (native OS startup entry) ----------------------- #
  getAutostart: () => getJSON<AutostartStatus>('/api/manage/control/autostart'),
  // target/mechanism are optional; the backend falls back to the persisted
  // preference, so a bare enable keeps the historical behavior.
  setAutostart: (enabled: boolean, target?: AutostartTarget, mechanism?: string) =>
    postJSON<AutostartStatus>('/api/manage/control/autostart', { enabled, target, mechanism }),

  // --- Vocabulary (pycore proxies laravel_main #/vocabulary) -------------- #
  // The laravel-manager vocabulary surface, re-exposed through pycore so the
  // pycore-manager Vocabulary page talks only to pycore (UI -> pycore ->
  // laravel). Pure passthrough: responses are laravel's native JSON shapes.
  // GETs forward query params via buildVocabQuery; POSTs forward the body.
  getVocabTranslationLanguages: () =>
    getJSON<VocabLanguagesResponse>('/api/local/vocabulary/translation/languages'),
  translateVocab: (payload: VocabTranslateRequest) =>
    postJSON<VocabTranslateResponse>('/api/local/vocabulary/translation/translate', payload),
  queueVocabTranslationBatch: (payload: Record<string, unknown>) =>
    postJSON<VocabProxyEnvelope>('/api/local/vocabulary/translation/queue/batch/add', payload),
  generateVocabTts: (payload: VocabTtsGenerateRequest) =>
    postJSON<VocabTtsGenerateResponse>('/api/local/vocabulary/tts/generate', payload),
  queueVocabTtsBatchQuery: (items: Record<string, unknown>[]) =>
    postJSON<VocabProxyEnvelope>('/api/local/vocabulary/tts/queue/batch/query', items),
  getVocabSentenceAudio: (params: Record<string, unknown>) =>
    getJSON<VocabProxyEnvelope>(buildVocabQuery('/api/local/vocabulary/tts/sentence-audio', params)),
  getVocabTtsQueueStats: () =>
    getJSON<VocabTtsQueueStats>('/api/local/vocabulary/tts-queue/stats'),
  getVocabTtsQueueItems: (params: Record<string, unknown>) =>
    getJSON<VocabTtsQueueItemsResponse>(buildVocabQuery('/api/local/vocabulary/tts-queue/items', params)),
  getVocabAssistOverview: () =>
    getJSON<VocabAssistOverviewResponse>('/api/local/vocabulary/assist/overview'),
  getVocabAssistOverviewItems: (params: Record<string, unknown>) =>
    getJSON<VocabProxyEnvelope>(buildVocabQuery('/api/local/vocabulary/assist/overview/items', params)),
  retryVocabCover: (payload: Record<string, unknown>) =>
    postJSON<VocabProxyEnvelope>('/api/local/vocabulary/cover/retry', payload),
  getVocabLibraries: (params: Record<string, unknown>) =>
    getJSON<VocabLibrariesResponse>(buildVocabQuery('/api/local/vocabulary/libraries', params)),
  getVocabLibraryWords: (libraryId: number, params: Record<string, unknown>) =>
    getJSON<VocabLibraryWordsResponse>(
      buildVocabQuery(`/api/local/vocabulary/libraries/${encodeURIComponent(libraryId)}/words`, params)),
  deleteVocabLibrary: (libraryId: number) =>
    deleteJSON<VocabProxyEnvelope>(`/api/local/vocabulary/libraries/${encodeURIComponent(libraryId)}`),
  getVocabStatistics: (params: Record<string, unknown>) =>
    getJSON<VocabStatisticsResponse>(buildVocabQuery('/api/local/vocabulary/statistics', params)),
  getVocabLanguageBreakdown: (params: Record<string, unknown>) =>
    getJSON<VocabLanguageBreakdownResponse>(buildVocabQuery('/api/local/vocabulary/language-breakdown', params)),
  getVocabDictionaryWords: (params: Record<string, unknown>) =>
    getJSON<VocabDictionaryWordsResponse>(buildVocabQuery('/api/local/vocabulary/dictionary/words', params)),
  createVocabDictionaryWord: (payload: Record<string, unknown>) =>
    postJSON<VocabProxyEnvelope>('/api/local/vocabulary/dictionary/words', payload),
  // Update is POST here (proxied as PUT to laravel) so the FE keeps the WS
  // fallback - the local_http loopback proxy is GET/POST-only.
  updateVocabDictionaryWord: (md5: string, payload: Record<string, unknown>) =>
    postJSON<VocabProxyEnvelope>(
      `/api/local/vocabulary/dictionary/words/${encodeURIComponent(md5)}`, payload),
  deleteVocabDictionaryWord: (md5: string, params: Record<string, unknown>) =>
    deleteJSON<VocabProxyEnvelope>(
      buildVocabQuery(`/api/local/vocabulary/dictionary/words/${encodeURIComponent(md5)}`, params)),
  batchVocabDictionaryWords: (payload: Record<string, unknown>) =>
    postJSON<VocabProxyEnvelope>('/api/local/vocabulary/dictionary/words/batch', payload),
  getVocabDictionarySentences: (params: Record<string, unknown>) =>
    getJSON<VocabProxyEnvelope>(buildVocabQuery('/api/local/vocabulary/dictionary/sentences', params)),
  reportVocabValidity: (payload: Record<string, unknown>) =>
    postJSON<VocabProxyEnvelope>('/api/local/vocabulary/validity/report', payload),
  getVocabStorageSummary: () =>
    getJSON<VocabProxyEnvelope>('/api/local/vocabulary/storage-summary'),
};

export type PycoreApi = typeof pycoreApi;
