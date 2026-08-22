/**
 * Shared Laravel API boundary for the unified UI.
 *
 * Laravel-owned data travels directly from the browser to Octane. Pycore is
 * used only for Python runtime capabilities and worker controls.
 */

import { BaseAPI, getSharedBaseURL, setSharedBaseURL } from './transport/BaseAPI';
import { MediaQueryAPI } from './transport/MediaQueryAPI';
import { createLaravelModuleConfig, LARAVEL_API_PREFIX } from './transport/ApiContract';
import { unwrapLaravelData } from './transport/LaravelEnvelope';
import { APPQYV1_API_BASE, APPQYV1_AI_TOOLS_ROUTES } from '../../contracts/AppQyV1AiToolsContract';
import type { BackendApiEndpoint } from '@/core/integrations/laravel/LaravelEndpoints';
import {
  addCustomEndpoint,
  buildApiUrl,
  getAllEndpoints,
  isCustomEndpoint,
  removeCustomEndpoint,
} from '@/core/integrations/laravel/LaravelEndpoints';
import { API_HEALTH_EVENT, apiManager } from './ApiManager';
import {
  QUEUE_CENTER_CONTRACT,
  QUEUE_CENTER_DIFF_DELIVERY,
  queueCenterEndpoint,
} from '../../contracts/QueueCenterContract';
import type {
  GlobalTaskWorkerRegistration,
  QueueCenterIdPagesResponse,
  QueueCenterOverviewResponse,
  QueueCenterPageDataResponse,
  QueueCenterRealtimeReplay,
  QueueCenterReceiptsResponse,
} from '../../contracts/QueueCenterContract';
import type {
  AssistCategoryItemsResponse,
  AssistOverviewResponse,
  LaravelSentenceVoiceVariant,
  LaravelTranslationStackResult,
  LaravelVocabTranslateRequest,
  LaravelVocabTtsGenerateRequest,
  RelayMachinesResponse,
  RelayHubToken,
  RelayPairResponse,
  RelayRequestFrame,
  RelayRequestResponse,
  RelayStoredResponse,
} from './LaravelTypes';
export type {
  MediaSourceListItem,
  MediaListResponse,
  MediaSentence,
} from './transport/MediaQueryAPI';

type LaravelMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** Shared raw transport (root prefix) — follows the shared base URL in lock-step. */
const laravelHttp = new BaseAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.root));
/** Shared media browser transport (/api/app_qy_v1/media prefix). */
const laravelMediaQuery = new MediaQueryAPI(createLaravelModuleConfig(LARAVEL_API_PREFIX.appQyV1Media));

export const LARAVEL_BROWSER_EVENTS = {
  selectionChanged: 'laravel-api-selection-changed',
} as const;

export interface LaravelApiEndpoint {
  id: string;
  url: string;
  healthy: boolean | null;
  latency_ms?: number | null;
  last_checked?: number | null;
  status?: number | null;
  error?: string | null;
  custom?: boolean;
}

export interface LaravelEndpointActionResult {
  ok: boolean;
  error?: string;
}

function normalizeEndpointUrl(url: string): string {
  return String(url || '').trim().replace(/\/+$/, '');
}

function toEndpointRow(endpoint: BackendApiEndpoint): LaravelApiEndpoint {
  const health = apiManager.getHealthResult(endpoint.id);
  return {
    id: endpoint.id,
    url: buildApiUrl(endpoint),
    healthy: health ? health.isHealthy : null,
    latency_ms: health?.responseTime ?? null,
    last_checked: health?.timestamp ?? null,
    error: health?.error ?? null,
    custom: isCustomEndpoint(endpoint.id),
  };
}

const ROUTES = {
  translationLanguages: APPQYV1_API_BASE + APPQYV1_AI_TOOLS_ROUTES.translationLanguages,
  translationTranslate: APPQYV1_API_BASE + APPQYV1_AI_TOOLS_ROUTES.translationTranslate,
  translationBatchAdd: APPQYV1_API_BASE + APPQYV1_AI_TOOLS_ROUTES.translationBatchAdd,
  translationQueueList: APPQYV1_API_BASE + APPQYV1_AI_TOOLS_ROUTES.translationQueueList,
  translationQueuePriority: '/api/app_qy_v1/ai_tools/translation/queue/priority',
  translationQueueStack: '/api/app_qy_v1/ai_tools/translation/queue/stack',
  ttsGenerate: APPQYV1_API_BASE + APPQYV1_AI_TOOLS_ROUTES.ttsGenerate,
  ttsQueueBatchQuery: '/api/app_qy_v1/ai_tools/tts/queue/batch/query',
  ttsSentenceAudio: APPQYV1_API_BASE + APPQYV1_AI_TOOLS_ROUTES.ttsSentenceAudio,
  ttsQueueStats: APPQYV1_API_BASE + APPQYV1_AI_TOOLS_ROUTES.ttsQueueStats,
  ttsQueueItems: APPQYV1_API_BASE + APPQYV1_AI_TOOLS_ROUTES.ttsQueueItems,
  sentenceMissing: '/api/app_qy_v1/ai_tools/tts/sentence/missing',
  queueCenterOverview: queueCenterEndpoint('queue_center_overview'),
  queueCenterEvents: queueCenterEndpoint('queue_center_events'),
  queueCenterReceipts: queueCenterEndpoint('queue_center_receipts'),
  // Relay plane (pycore UI <-> machine relay through the central server).
  relayMachines: queueCenterEndpoint('relay_machines'),
  relayHubAuth: queueCenterEndpoint('relay_hub_auth'),
  relayPair: (machineId: string): string =>
    queueCenterEndpoint('relay_pair_announce', { machine_id: machineId }),
  relayRequest: (machineId: string): string =>
    queueCenterEndpoint('relay_request', { machine_id: machineId }),
  relayResponse: (machineId: string, requestId: string): string =>
    queueCenterEndpoint('relay_response_fetch', { machine_id: machineId, request_id: requestId }),
  relayResponsePost: (machineId: string): string =>
    queueCenterEndpoint('relay_response', { machine_id: machineId }),
  relayBlobCreate: (machineId: string): string =>
    queueCenterEndpoint('relay_blob_create', { machine_id: machineId }),
  relayBlobFetch: (machineId: string, blobId: string): string =>
    queueCenterEndpoint('relay_blob_fetch', { machine_id: machineId, blob_id: blobId }),
  // Queue Center pump read/claim surface (diff delivery over global_tasks).
  queueCenterIdPages: (queue: string): string =>
    queueCenterEndpoint('queue_center_queue_id_pages', { queue }),
  queueCenterPageData: (queue: string): string =>
    queueCenterEndpoint('queue_center_queue_page_data', { queue }),
  workerTaskAccept: (taskType: string): string =>
    queueCenterEndpoint('worker_task_accept', { task_type: taskType }),
  workerRegister: queueCenterEndpoint('worker_register'),
  sentenceVariants: '/api/app_qy_v1/ai_tools/tts/variant-specs',
  assistOverview: '/api/app_qy_v1/assist/overview',
  assistOverviewItems: '/api/app_qy_v1/assist/overview/items',
  assistCoverRetry: '/api/app_qy_v1/assist/cover/retry',
  assistPosterPriority: '/api/app_qy_v1/assist/poster/priority',
  libraries: '/api/app_qy_v1/vocabulary/libraries',
  library: (id: number): string => `/api/app_qy_v1/learning/libraries/${encodeURIComponent(id)}`,
  libraryWords: (id: number): string => `/api/app_qy_v1/vocabulary/libraries/${encodeURIComponent(id)}/words`,
  statistics: '/api/app_qy_v1/vocabulary/statistics',
  languageBreakdown: '/api/app_qy_v1/vocabulary/language-breakdown',
  dictionaryWords: '/api/app_qy_v1/dictionary/words',
  dictionaryWord: (md5: string): string => `/api/app_qy_v1/dictionary/words/${encodeURIComponent(md5)}`,
  dictionaryWordsBatch: '/api/app_qy_v1/dictionary/words/batch',
  dictionarySentences: '/api/app_qy_v1/dictionary/sentences',
  validityReport: '/api/app_qy_v1/vocabulary/validity/report',
  storageSummary: '/api/servermanager/v1/system/static-resources',
  wordAudio: (language: string, word: string): string =>
    `/api/app_qy_v1/word/${encodeURIComponent(language)}/${encodeURIComponent(word)}/audio`,
  wordAudioHead: '/api/app_qy_v1/word/audio/head',
  mediaEnrich: '/api/app_qy_v1/media/enrich',
  completedTasks: '/api/task-center/completed',
  codeLastModified: '/api/dashboard/code-last-modified',
} as const;

function withQuery(path: string, params: Record<string, unknown> = {}): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(`${key}[]`, String(item)));
      return;
    }
    query.set(key, String(value));
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function requestLaravel<T>(
  method: LaravelMethod,
  path: string,
  payload?: unknown,
): Promise<T> {
  // Central transport invariant: every Laravel route, including assist
  // overview, follows the endpoint persisted by ApiManager. This defensive
  // synchronization also repairs stale module state after Vite HMR.
  const selectedEndpoint = apiManager.getCurrentEndpoint() ?? apiManager.preselectEndpointSync();
  if (selectedEndpoint) {
    const selectedBaseURL = buildApiUrl(selectedEndpoint);
    if (getSharedBaseURL() !== selectedBaseURL) setSharedBaseURL(selectedBaseURL);
  }
  const hasBody = method !== 'GET' && payload !== undefined;
  const requestPath = method === 'GET'
    ? withQuery(path, (payload || {}) as Record<string, unknown>)
    : path;
  const response = await laravelHttp.rawRequest(requestPath, {
    method,
    headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
    body: hasBody ? JSON.stringify(payload) : undefined,
  });
  const body = await response.json();
  if (!response.ok) {
    const error = new Error(`LARAVEL_HTTP_${response.status}`);
    Object.assign(error, { status: response.status, payload: body });
    throw error;
  }
  return body as T;
}

function unwrapData<T>(payload: any): T {
  return unwrapLaravelData<T>(payload);
}

function completedTaskTitle(record: Record<string, any>): string {
  const payload = record.payload && typeof record.payload === 'object' ? record.payload : {};
  const keys = ['word', 'title', 'text', 'content', 'source_key', 'query'];
  for (const key of keys) {
    if (typeof payload[key] === 'string' && payload[key].trim()) return payload[key].trim();
  }
  return String(record.task_id || '');
}

function normalizeCompletedTask(
  record: Record<string, any>,
  sequence: number,
  sourceApi: string,
): Record<string, any> {
  const payload = record.payload && typeof record.payload === 'object' ? record.payload : {};
  const result = record.result && typeof record.result === 'object' ? record.result : {};
  const status = String(record.status || 'completed');
  const success = status === 'completed' || status === 'completed_demo';
  const title = completedTaskTitle(record);
  return {
    archive_id: `laravel:${record.source_id}`,
    ts: record.completed_at || record.updated_at || record.created_at || '',
    seq: sequence,
    end: 'laravel',
    worker: record.worker || 'laravel',
    task_type: String(record.task_type || 'assist'),
    task_id: String(record.task_id || ''),
    source_api: sourceApi,
    title,
    content: title,
    language: payload.language || payload.target_language || '',
    status,
    success,
    posted_back: success,
    latency_ms: null,
    error: record.error || null,
    detail: { ...payload, ...result },
    execution_type: record.execution_type,
    capability: record.capability,
    resources: [],
    is_local: false,
    source: 'laravel',
    updated_at: record.updated_at,
    last_error: record.last_error || record.error || null,
  };
}

async function resourceDataUrl(url: string): Promise<string> {
  const response = await laravelHttp.rawRequest(url, { method: 'GET' });
  if (!response.ok) return '';
  const blob = await response.blob();
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

/** Resolve a Laravel-hosted resource path against the active endpoint (no base64 round-trip). */
function resourceUrl(value: string): string {
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || /^(data|blob):/i.test(value)) return value;
  const base = laravelHttp.getBaseURL().replace(/\/+$/, '');
  return value.startsWith('/') ? `${base}${value}` : `${base}/${value}`;
}

const laravelMethods = {
  getCodeVersion: async () => {
    const payload = await requestLaravel<any>('GET', ROUTES.codeLastModified);
    return unwrapData<any>(payload);
  },
  getCompletedTaskHistory: async (params: Record<string, unknown> = {}) => {
    const payload = await requestLaravel<any>('GET', ROUTES.completedTasks, params);
    const data = unwrapData<any>(payload);
    const sourceApi = laravelHttp.getBaseURL();
    const records = Array.isArray(data.records)
      ? data.records.map((record: Record<string, any>, sequence: number) => (
          normalizeCompletedTask(record, sequence, sourceApi)
        ))
      : [];
    return {
      success: true,
      partial: false,
      synced: records.length,
      records,
      count: records.length,
      types: data.types && typeof data.types === 'object' ? data.types : {},
      resource_count: 0,
      last_sync_at: new Date().toISOString(),
      next_cursor_id: data.next_cursor_id ?? null,
    };
  },
  getTranslationQueue: async () => {
    const payload = await requestLaravel<any>('GET', ROUTES.translationQueueList, { status: 'pending', limit: 100 });
    const data = unwrapData<any>(payload);
    return { ...data, laravel_reachable: true, event_connected: false, age_ms: 0 };
  },
  setQueuePriority: (taskId: string, priority: number) =>
    requestLaravel<any>('POST', ROUTES.translationQueuePriority, { task_id: taskId, priority }),
  stackQueue: async (
    words: string[],
    language: string,
    targetLanguage: string,
    priority?: number,
  ): Promise<LaravelTranslationStackResult> => {
    const payload = await requestLaravel<any>('POST', ROUTES.translationQueueStack, {
      words,
      language,
      target_language: targetLanguage,
      ...(priority === undefined ? {} : { priority }),
    });
    return unwrapData<LaravelTranslationStackResult>(payload);
  },
  getTranslationTaskDetail: async (taskId: string) => {
    const payload = await requestLaravel<any>('GET', `/api/task/${encodeURIComponent(taskId)}/detail`);
    const data = unwrapData<any>(payload);
    return { success: true, task: data.task, bundle: data, laravel_reachable: true };
  },

  getSentenceAudioQueue: async () => {
    const payload = await requestLaravel<any>('GET', ROUTES.sentenceMissing, {
      page: 1,
      per_page: QUEUE_CENTER_CONTRACT.task_contract.limits.monitor,
    });
    const queue = unwrapData<any>(payload);
    return {
      success: true,
      queue: { ...queue, laravel_reachable: true, snapshot_age_s: 0 },
    };
  },
  getQueueCenterOverview: async (): Promise<QueueCenterOverviewResponse> => {
    const payload = await requestLaravel<any>('GET', ROUTES.queueCenterOverview);
    return unwrapData<QueueCenterOverviewResponse>(payload);
  },

  getRelayMachines: async (): Promise<RelayMachinesResponse> => {
    const payload = await requestLaravel<any>('GET', ROUTES.relayMachines);
    return unwrapData<RelayMachinesResponse>(payload);
  },
  relayHubAuth: async (machineId?: string): Promise<RelayHubToken> => {
    const payload = await requestLaravel<any>('POST', ROUTES.relayHubAuth, {
      mode: 'session',
      ...(machineId ? { machine_id: machineId } : {}),
    });
    return unwrapData<RelayHubToken>(payload);
  },
  relayPair: async (machineId: string): Promise<RelayPairResponse> => {
    const payload = await requestLaravel<any>('POST', ROUTES.relayPair(machineId));
    return unwrapData<RelayPairResponse>(payload);
  },
  relayRequest: async (
    machineId: string,
    frame: RelayRequestFrame,
  ): Promise<RelayRequestResponse> => {
    const payload = await requestLaravel<any>('POST', ROUTES.relayRequest(machineId), frame);
    return unwrapData<RelayRequestResponse>(payload);
  },
  relayResponse: async (
    machineId: string,
    requestId: string,
    wait = false,
    signal?: AbortSignal,
  ): Promise<RelayStoredResponse | null> => {
    // A caller-provided signal owns the deadline - the shared transport's
    // default ceiling (15 s) is shorter than the server long-poll bound
    // (~25 s), so the wait=1 poll MUST bypass it.
    const response = await laravelHttp.rawRequest(
      ROUTES.relayResponse(machineId, requestId) + (wait ? '?wait=1' : ''),
      { method: 'GET', credentials: 'include', ...(signal ? { signal } : {}) },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`LARAVEL_HTTP_${response.status}`);
    const data = unwrapData<{ response: RelayStoredResponse }>(await response.json());
    return data.response ?? null;
  },
  /**
   * Blob upload (relay plane): one raw-bytes chunk per call. Query params
   * carry the continuation contract (blob_id reuse, chunk index, last
   * flag); the server reassembles + enforces the chunk/total caps.
   */
  relayBlobCreate: async (
    machineId: string,
    blobId: string | null,
    chunkIndex: number,
    last: boolean,
    bytes: ArrayBuffer | Uint8Array,
  ): Promise<{ blob_id: string; chunks: number; received_bytes: number; complete: boolean }> => {
    const query = new URLSearchParams({
      chunk_index: String(chunkIndex),
      chunk_last: last ? '1' : '0',
      ...(blobId ? { blob_id: blobId } : {}),
    });
    const response = await laravelHttp.rawRequest(
      `${ROUTES.relayBlobCreate(machineId)}?${query.toString()}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes instanceof Uint8Array ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes,
        credentials: 'include',
      },
    );
    if (!response.ok) throw new Error(`LARAVEL_HTTP_${response.status}`);
    return unwrapData<{ blob: { blob_id: string; chunks: number; received_bytes: number; complete: boolean } }>(
      await response.json(),
    ).blob;
  },
  /** Blob download (relay plane): reassembled bytes for a body ref. */
  relayBlobFetch: async (machineId: string, blobId: string): Promise<Uint8Array> => {
    const response = await laravelHttp.rawRequest(
      ROUTES.relayBlobFetch(machineId, blobId),
      { method: 'GET', credentials: 'include' },
    );
    if (!response.ok) throw new Error(`LARAVEL_HTTP_${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  },
  /**
   * Rich aggregate snapshot for the Queue Center strip. This endpoint is now
   * consumed directly by the browser instead of being mirrored through pycore,
   * removing the pycore<->Laravel HTTP contention that caused timeouts.
   */
  getAssistOverview: async (): Promise<AssistOverviewResponse> => {
    const payload = await requestLaravel<any>('GET', ROUTES.assistOverview);
    return unwrapData<AssistOverviewResponse>(payload);
  },
  getQueueCenterEvents: async (cursor: number): Promise<QueueCenterRealtimeReplay> => {
    const payload = await requestLaravel<any>('GET', ROUTES.queueCenterEvents, {
      cursor,
      limit: QUEUE_CENTER_CONTRACT.task_contract.limits.event_batch,
    });
    return unwrapData<QueueCenterRealtimeReplay>(payload);
  },
  getQueueCenterReceipts: async (taskIds: string[]): Promise<QueueCenterReceiptsResponse> => {
    const ids = Array.from(new Set(taskIds.map((taskId) => taskId.trim()).filter(Boolean)))
      .slice(0, QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit);
    const payload = await requestLaravel<any>('GET', ROUTES.queueCenterReceipts, { task_ids: ids });
    return unwrapData<QueueCenterReceiptsResponse>(payload);
  },
  /**
   * Pump read/claim endpoints (Queue Center diff delivery).
   *
   * id-pages: `cursor` is the numeric high-water `global_tasks.id` stored by
   * the frontend page table (0 = full realign); the response carries the
   * realtime broadcast `revision` (alignment marker), the new high-water
   * `cursor`, priority-promoted `head_ids`, and ID pages chunked by the
   * contract id_limit/id_page_limit (entries: task_id + status metadata).
   *
   * page-data: lazily materialized rows for one requested ID page, bounded by
   * the contract data_segment_limit; Laravel expects repeated `ids[]` query
   * params and answers with worker_pull wire-shape items (payload included).
   *
   * accept: per-task claim guard against multi-instance double-processing.
   * Idempotent for the owner, atomic when pending, HTTP 409 for a foreign
   * owner — callers skip those IDs (processed elsewhere).
   */
  getQueueCenterIdPages: async (
    queue: string,
    params: { cursor?: number; pages?: number } = {},
  ): Promise<QueueCenterIdPagesResponse> => {
    const payload = await requestLaravel<any>('GET', ROUTES.queueCenterIdPages(queue), params);
    return unwrapData<QueueCenterIdPagesResponse>(payload);
  },
  getQueueCenterPageData: async (
    queue: string,
    ids: string[],
  ): Promise<QueueCenterPageDataResponse> => {
    const segment = ids.slice(0, QUEUE_CENTER_DIFF_DELIVERY.data_segment_limit);
    const payload = await requestLaravel<any>('GET', ROUTES.queueCenterPageData(queue), { ids: segment });
    return unwrapData<QueueCenterPageDataResponse>(payload);
  },
  acceptWorkerTask: (taskType: string, taskId: string, workerId: string) =>
    requestLaravel<any>('POST', ROUTES.workerTaskAccept(taskType), { task_id: taskId, worker_id: workerId }),
  registerQueueWorker: (worker: GlobalTaskWorkerRegistration) =>
    requestLaravel<any>('POST', ROUTES.workerRegister, worker),
  getSentenceVoiceVariants: async (lang: string): Promise<LaravelSentenceVoiceVariant[]> => {
    const payload = await requestLaravel<any>('GET', ROUTES.sentenceVariants, { lang });
    return unwrapData<{ specs?: LaravelSentenceVoiceVariant[] }>(payload).specs ?? payload?.specs ?? [];
  },
  saveSentenceVoiceVariants: (
    lang: string,
    specs: Array<{ variant_key: string; accent: string | null; gender: string; is_primary: boolean }>,
  ) => requestLaravel<any>('POST', ROUTES.sentenceVariants, { lang, specs }),
  deleteSentenceVoiceVariant: (lang: string, variantKey: string) =>
    requestLaravel<any>('DELETE', withQuery(ROUTES.sentenceVariants, { lang, variant_key: variantKey })),

  getWordAudioMediaDataUrl: async (word: string, language = 'en'): Promise<string> => {
    const payload = await requestLaravel<any>('GET', ROUTES.wordAudio(language, word));
    const data = unwrapData<any>(payload);
    return data.audio_url ? resourceDataUrl(data.audio_url) : '';
  },
  moveWordAudioToHead: (words: string[], language: string) =>
    requestLaravel<any>('POST', ROUTES.wordAudioHead, { words, language }),
  prioritizeCovers: (ids: number[], all = false) =>
    requestLaravel<any>('POST', ROUTES.assistCoverRetry, { ids, all }),
  prioritizePosters: (items: Array<{ media_type: 'book' | 'subtitle'; id: number }>) =>
    requestLaravel<any>('POST', ROUTES.assistPosterPriority, { items }),

  getVocabTranslationLanguages: () => requestLaravel<any>('GET', ROUTES.translationLanguages),
  translateVocab: (payload: LaravelVocabTranslateRequest) => requestLaravel<any>('POST', ROUTES.translationTranslate, payload),
  queueVocabTranslationBatch: (payload: Record<string, unknown>) =>
    requestLaravel<any>('POST', ROUTES.translationBatchAdd, payload),
  generateVocabTts: (payload: LaravelVocabTtsGenerateRequest) => requestLaravel<any>('POST', ROUTES.ttsGenerate, payload),
  queueVocabTtsBatchQuery: (items: Record<string, unknown>[]) =>
    requestLaravel<any>('POST', ROUTES.ttsQueueBatchQuery, items),
  getVocabSentenceAudio: (params: Record<string, unknown>) => requestLaravel<any>('GET', ROUTES.ttsSentenceAudio, params),
  getVocabTtsQueueStats: () => requestLaravel<any>('GET', ROUTES.ttsQueueStats),
  getVocabTtsQueueItems: (params: Record<string, unknown>) => requestLaravel<any>('GET', ROUTES.ttsQueueItems, params),
  getQueueOverview: (): Promise<AssistOverviewResponse> =>
    requestLaravel<AssistOverviewResponse>('GET', ROUTES.assistOverview),
  getQueueOverviewItems: (params: Record<string, unknown>): Promise<AssistCategoryItemsResponse> =>
    requestLaravel<AssistCategoryItemsResponse>('GET', ROUTES.assistOverviewItems, params),
  retryVocabCover: (payload: Record<string, unknown>) => requestLaravel<any>('POST', ROUTES.assistCoverRetry, payload),
  getVocabLibraries: (params: Record<string, unknown>) => requestLaravel<any>('GET', ROUTES.libraries, params),
  getVocabResourceUrl: resourceUrl,
  getVocabLibraryWords: (libraryId: number, params: Record<string, unknown>) =>
    requestLaravel<any>('GET', ROUTES.libraryWords(libraryId), params),
  deleteVocabLibrary: (libraryId: number) => requestLaravel<any>('DELETE', ROUTES.library(libraryId)),
  getVocabStatistics: (params: Record<string, unknown>) => requestLaravel<any>('GET', ROUTES.statistics, params),
  getVocabLanguageBreakdown: (params: Record<string, unknown>) =>
    requestLaravel<any>('GET', ROUTES.languageBreakdown, params),
  getVocabDictionaryWords: (params: Record<string, unknown>) =>
    requestLaravel<any>('GET', ROUTES.dictionaryWords, params),
  createVocabDictionaryWord: (payload: Record<string, unknown>) =>
    requestLaravel<any>('POST', ROUTES.dictionaryWords, payload),
  updateVocabDictionaryWord: (md5: string, payload: Record<string, unknown>) =>
    requestLaravel<any>('PUT', ROUTES.dictionaryWord(md5), payload),
  deleteVocabDictionaryWord: (md5: string, params: Record<string, unknown>) =>
    requestLaravel<any>('DELETE', withQuery(ROUTES.dictionaryWord(md5), params)),
  batchVocabDictionaryWords: (payload: Record<string, unknown>) =>
    requestLaravel<any>('POST', ROUTES.dictionaryWordsBatch, payload),
  getVocabDictionarySentences: (params: Record<string, unknown>) =>
    requestLaravel<any>('GET', ROUTES.dictionarySentences, params),
  reportVocabValidity: (payload: Record<string, unknown>) => requestLaravel<any>('POST', ROUTES.validityReport, payload),
  getVocabStorageSummary: () => requestLaravel<any>('GET', ROUTES.storageSummary),
  enrichMedia: (limit: number) => requestLaravel<any>('POST', ROUTES.mediaEnrich, { limit }),
  listMedia: async (kind: 'movie' | 'book', perPage = 8) => {
    const response = kind === 'book'
      ? await laravelMediaQuery.listBooks({ page: 1, per_page: perPage })
      : await laravelMediaQuery.listSubtitles({ page: 1, per_page: perPage });
    if (!response.success || !response.data) throw new Error('LARAVEL_MEDIA_LIST_FAILED');
    return response.data;
  },
  getMediaDetail: async (kind: 'movie' | 'book', sourceKey: string) => {
    const response = kind === 'book'
      ? await laravelMediaQuery.getBook(sourceKey)
      : await laravelMediaQuery.getSubtitle(sourceKey, 'sentence');
    if (!response.success || !response.data) throw new Error('LARAVEL_MEDIA_DETAIL_FAILED');
    return response.data;
  },
};

type LaravelMethods = typeof laravelMethods;

export interface LaravelAPI extends LaravelMethods {}

export class LaravelAPI {
  readonly events = {
    healthChanged: API_HEALTH_EVENT,
    endpointsChanged: 'api-endpoints-changed',
    selectionChanged: LARAVEL_BROWSER_EVENTS.selectionChanged,
  } as const;

  private dispatch(eventName: string, detail?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(eventName, detail ? { detail } : undefined));
  }

  listEndpoints(): LaravelApiEndpoint[] {
    return getAllEndpoints().map(toEndpointRow);
  }

  currentEndpointUrl(): string {
    // UI reads must restore the localStorage selection synchronously. Falling
    // back to the first list row here caused endpoint chips to change during
    // isolated mounts and Vite HMR before the application init effect ran.
    const selected = apiManager.getCurrentEndpoint() ?? apiManager.preselectEndpointSync();
    return selected ? buildApiUrl(selected) : this.listEndpoints()[0]?.url || '';
  }

  async switchEndpoint(url: string): Promise<LaravelEndpointActionResult> {
    const normalized = normalizeEndpointUrl(url);
    const endpoint = getAllEndpoints().find(
      (item) => normalizeEndpointUrl(buildApiUrl(item)) === normalized,
    );
    if (!endpoint) return { ok: false, error: 'LARAVEL_ENDPOINT_NOT_FOUND' };
    const result = await apiManager.switchEndpoint(endpoint.id);
    if (!result.ok) {
      return { ok: false, error: result.result?.error || 'LARAVEL_ENDPOINT_UNAVAILABLE' };
    }
    this.dispatch(this.events.selectionChanged, { url: normalized });
    return { ok: true };
  }

  addEndpoint(url: string): LaravelEndpointActionResult {
    const result = addCustomEndpoint({ url });
    if (!result.ok) return { ok: false, error: 'LARAVEL_ENDPOINT_ADD_REJECTED' };
    this.dispatch(this.events.endpointsChanged);
    return { ok: true };
  }

  removeEndpoint(url: string): LaravelEndpointActionResult {
    const normalized = normalizeEndpointUrl(url);
    const endpoint = getAllEndpoints().find(
      (item) => normalizeEndpointUrl(buildApiUrl(item)) === normalized,
    );
    if (!endpoint || !isCustomEndpoint(endpoint.id)) {
      return { ok: false, error: 'LARAVEL_ENDPOINT_REMOVE_REJECTED' };
    }
    if (normalized === normalizeEndpointUrl(this.currentEndpointUrl())) {
      return { ok: false, error: 'LARAVEL_ENDPOINT_REMOVE_REJECTED' };
    }
    if (!removeCustomEndpoint(endpoint.id)) {
      return { ok: false, error: 'LARAVEL_ENDPOINT_REMOVE_FAILED' };
    }
    this.dispatch(this.events.endpointsChanged);
    return { ok: true };
  }

  async probeEndpoints(): Promise<void> {
    await apiManager.checkAllEndpoints();
  }
}

Object.assign(LaravelAPI.prototype, laravelMethods);

export const laravelApi = new LaravelAPI();
export type PcLaravelApi = LaravelAPI;
