/**
 * Local bridge / queue / translate / subtitle / vocab HTTP surface for pycoreApi.
 */
import type {
  LocalTaskDetailResponse, PycoreGlobalTaskDetailResponse,
  AssistConfigPatch,
  TranslateStatus, TranslateResponse, TranslateAiResponse,
  SubtitleSearchStatus, SubtitleSearchProbe, SubtitleSearchOptions, SubtitleSearchResponse,
  SubtitleDownloadResponse, SubtitleSearchHistoryResponse,
  SubtitleSearchHistoryDeleteResponse, SubtitleSearchHistoryClearResponse,
  SubtitleProvidersResponse, SubtitleProviderProbe,
  SubtitleCacheStats, SubtitleCacheClearResponse,
  WordAudioStatus, WordAudioTestResponse,
  TranslateHistoryResponse, TranslateHistoryDeleteResponse, TranslateHistoryClearResponse,
  AgentHistoryIndexResponse, AgentHistoryPromptsResponse, AgentHistorySessionResponse,
  AgentHistoryArticleRecordsResponse,
  AgentHistoryTestExtractResponse,
  PcQueueOverview, PcCapabilitySettings, PcCapabilityKey,
  PcTaskCenterResponse, QueueCenterControlName, QueueCenterControlResponse,
  QueueCenterSnapshot,
  PcCapabilitySaveResponse, PcCapabilityOptions,
  PcTaskRecentResponse, PcTaskClearResponse, PcCompletedTaskArchiveResponse,
  PcCompletedTaskSyncResponse,
  SentenceVoiceVariant,
  AutostartStatus, AutostartTarget,
} from './pycoreTypes';
import type {
  VocabTranslateRequest,
  VocabTtsGenerateRequest,
} from './PycoreVocabTypes';
import {
  requestPycoreHttp, PYCORE_HTTP_ROUTES,
} from './PycoreApiTransport';
import { GLOBAL_TASK_LIMITS } from './QueueCenterContract';

export const pycoreApiLocal = {
  // --- translation queue (Laravel pending queue, steered via pycore) ------ #
  queueTranslation: (refresh = false) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.translationQueueSnapshot, { refresh: refresh ? 1 : 0 }),
  setQueuePriority: (task_id: string, priority: number) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.translationQueueSetPriority, { task_id, priority }),
  stackQueue: (words: string[], language: string, target_language: string, priority?: number) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.translationQueueStack,
      { words, language, target_language, ...(priority != null ? { priority } : {}) }),

  /** Full pyctl TaskManager record — Task Queue tab detail modal. */
  getLocalTaskDetail: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskCenterGetLocalTaskDetail, { task_id: taskId }) as Promise<LocalTaskDetailResponse>,

  /** Laravel global_tasks row — proxied via QueueMonitorService (UI-selected Laravel base). */
  getTranslationTaskDetail: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.translationQueueGetTaskDetail, { task_id: taskId }),

  /** Richer Laravel bundle (task + events + phase) — task-center detail proxy. */
  getRemoteGlobalTaskDetail: (taskId: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskCenterGetRemoteTaskDetail, { task_id: taskId }) as Promise<PycoreGlobalTaskDetailResponse>,

  // --- Pycore → Laravel queue capability control plane ------------------- #
  // Status includes the worker loop state, circuit breaker, counters and the
  // last observed Laravel-side queue counts. Config updates are partial (only
  // the provided fields change). Cycle runs one claim→process→submit pass now.
  getAssistStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.assistAssistStatus, {}),
  setAssistConfig: (config: AssistConfigPatch) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.assistAssistConfig, config),
  runAssistCycle: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.assistAssistCycle, {}),

  // --- Recent tasks (unified cross-end task history: pycore + chrome) ------- #
  // Newest-first log of finished task units across both ends, with roll-up
  // stats. Optional filters (end / worker / task_type) are applied server-side;
  // the FE also filters client-side for the chip UI. Clear wipes the ring + the
  // on-disk text log.
  getRecentTasks: (params: { limit?: number; end?: string; worker?: string; task_type?: string } = {}) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskHistoryGetRecentTasks, {
      limit: params.limit ?? GLOBAL_TASK_LIMITS.history_records,
      end: params.end,
      worker: params.worker,
      task_type: params.task_type,
    }) as Promise<PcTaskRecentResponse>,
  clearRecentTasks: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskHistoryClearRecentTasks, {}) as Promise<PcTaskClearResponse>,
  getCompletedTasks: (params: { limit?: number; offset?: number; task_type?: string } = {}) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskHistoryGetCompletedArchive, {
      limit: params.limit ?? GLOBAL_TASK_LIMITS.completed,
      offset: params.offset ?? 0,
      task_type: params.task_type,
    }) as Promise<PcCompletedTaskArchiveResponse>,
  syncCompletedTasks: (params: { limit?: number; cursor_id?: number; task_type?: string } = {}) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskHistorySyncCompletedArchive, {
      limit: params.limit ?? GLOBAL_TASK_LIMITS.history_records,
      cursor_id: params.cursor_id ?? 0,
      task_type: params.task_type,
    }) as Promise<PcCompletedTaskSyncResponse>,
  getCompletedTaskResourceDataUrl: async (cacheKey: string): Promise<string> => {
    const response = await requestPycoreHttp(PYCORE_HTTP_ROUTES.taskHistoryCompletedArchiveResource, {
      cache_key: cacheKey,
    }) as { success?: boolean; mime?: string; content_base64?: string; error?: string };
    if (!response?.success || !response.content_base64) {
      throw new Error(response?.error || 'Cached resource not found');
    }
    return `data:${response.mime || 'application/octet-stream'};base64,${response.content_base64}`;
  },

  // --- Google Translate (free googletrans + AI comparison on one input) --- #
  // status: googletrans availability/version + cache info. translate: the free
  // lib path ({error} on failure, never throws). translateAi: the SAME text
  // through the unified AI gateway so the UI can compare Google vs AI.
  getTranslateStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.translateStatus, {}) as Promise<TranslateStatus>,
  translate: (text: string, src = 'auto', dest = 'en', useCache = true) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.translateTranslate, {
      text, src, dest, use_cache: useCache,
    }) as Promise<TranslateResponse>,
  translateAi: (text: string, src = 'auto', dest = 'en') =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.translateAi, { text, src, dest }) as Promise<TranslateAiResponse>,

  // --- Image search (SerpApi Google-Images + AI comparison + history) ----- #
  // status: SerpApi key present + engine + history count. search: real Google
  // images for a query (records history). searchAi: an AI render of the SAME
  // query (unified IMAGE contract). compare: both in one call + a combined
  // history record. Plus the search-history list/delete/clear. This is the same
  // SerpApi capability the poster pipeline now prefers as its first source.
  getImageSearchStatus: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.imageSearchStatus, {}),
  searchImages: (query: string, num = 12, country?: string, record = true) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.imageSearchSearch, { query, num, country, record }),
  searchImagesAi: (query: string, size?: string, model?: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.imageSearchSearchAi, { query, size, model }),
  compareImages: (query: string, num = 12, country?: string, size?: string, model?: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.imageSearchCompare, { query, num, country, size, model }),
  getImageSearchResourceDataUrl: async (url: string): Promise<string> => {
    const response = await requestPycoreHttp(PYCORE_HTTP_ROUTES.imageSearchResource, { url }) as {
      success?: boolean; image_base64?: string; mime?: string;
    };
    return response?.success && response.image_base64
      ? `data:${response.mime || 'image/jpeg'};base64,${response.image_base64}`
      : '';
  },
  getImageSearchHistory: (limit = 50) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.imageSearchHistory, { limit }),
  deleteImageSearchHistory: (id: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.imageSearchDeleteHistory, { entry_id: id }),
  clearImageSearchHistory: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.imageSearchClearHistory, {}),

  // --- Subtitle search (OpenSubtitles search + download + history) -------- #
  // status: OpenSubtitles key present + authenticated state + history count.
  // probe: a lightweight reachability/latency check. search: subtitles for a
  // movie/TV title (records history). download: pull one result's file (inline
  // .srt content or a saved path). Plus the search-history list/delete/clear.
  getSubtitleSearchStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchStatus, {}) as Promise<SubtitleSearchStatus>,
  probeSubtitleSearch: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchProbe, {}) as Promise<SubtitleSearchProbe>,
  // Provider fallback chain (ordered) + a live per-provider probe.
  getSubtitleProviders: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchProviders, {}) as Promise<SubtitleProvidersResponse>,
  testSubtitleProvider: (name: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchProviderTest, { name }) as Promise<SubtitleProviderProbe>,
  // Download cache: cached subtitle downloads are reused so a rate/quota-limited
  // provider file is never pulled twice. Stats are local (no network); clear wipes it.
  getSubtitleCacheStats: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchCache, {}) as Promise<SubtitleCacheStats>,
  clearSubtitleCache: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchCacheClear, {}) as Promise<SubtitleCacheClearResponse>,
  searchSubtitles: (query: string, opts: SubtitleSearchOptions = {}) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchSearch, { query, ...opts }) as Promise<SubtitleSearchResponse>,
  downloadSubtitle: (file_id: number | string, record = true) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchDownload, {
      file_id, record,
    }) as Promise<SubtitleDownloadResponse>,
  getSubtitleSearchHistory: (limit = 50) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchHistory, { limit }) as Promise<SubtitleSearchHistoryResponse>,
  deleteSubtitleSearchHistory: (id: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchHistoryDelete, { id }) as Promise<SubtitleSearchHistoryDeleteResponse>,
  clearSubtitleSearchHistory: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.subtitleSearchHistoryClear, {}) as Promise<SubtitleSearchHistoryClearResponse>,

  // --- Word audio (real pronunciation lookup + TTS fallback) -------------- #
  // status: which real-pronunciation sources are wired (pycore reports 3:
  // free_dictionary_api / cambridge_dictionary / forvo — the last key-gated),
  // whether the Forvo key is present (never the value), and that TTS covers a
  // miss. test: a REAL live fetch through the existing client; on a hit the raw
  // audio bytes come back base64-encoded (play as a data: URI), on a clean miss
  // {success:false, provider:null, message}.
  getWordAudioStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.wordAudioStatus, {}) as Promise<WordAudioStatus>,
  testWordAudio: (word: string, lang = 'en') =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.wordAudioTest, { word, lang }) as Promise<WordAudioTestResponse>,

  // Move a word to the front of Laravel's canonical audio queue and wake the
  // dedicated Pycore word-audio worker.
  boostWordAudioPriority: (md5: string, lang: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.wordAudioBoostPriority, { md5, lang }) as Promise<
      { success: boolean; laravel_updated?: boolean; error?: string }
    >,
  boostWordAudioPriorities: (items: Array<{ md5: string; lang: string }>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.wordAudioBoostPriorityBatch, { items }) as Promise<
      { success: boolean; count: number; results?: Array<Record<string, unknown>>; error?: string }
    >,
  prioritizeWordImages: (items: Array<{ word: string; language: string }>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.queuePriorityPrioritizeWordImages, { items }) as Promise<
      { success: boolean; count?: number; error?: string }
    >,
  prioritizeCovers: (ids: number[], all = false) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.queuePriorityPrioritizeCovers, { ids, all }) as Promise<
      { success: boolean; reset?: number; priority?: number; error?: string }
    >,
  prioritizePosters: (items: Array<{ media_type: 'book' | 'subtitle'; id: number }>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.queuePriorityPrioritizePosters, { items }) as Promise<
      { success: boolean; promoted?: number; error?: string }
    >,

  // --- translate history (Google / AI translate usage records) ------------ #
  getTranslateHistory: (limit = 50) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.translateHistory, { limit }) as Promise<TranslateHistoryResponse>,
  deleteTranslateHistory: (id: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.translateHistoryDelete, { id }) as Promise<TranslateHistoryDeleteResponse>,
  clearTranslateHistory: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.translateHistoryClear, {}) as Promise<TranslateHistoryClearResponse>,

  // --- Agent history (local Claude/Codex/Cursor/Gemini txt store) ---------- #
  // Native HTTP API routes — do NOT use getJSON/postJSON → router.invoke.
  getAgentHistoryIndex: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryIndex, {}) as Promise<AgentHistoryIndexResponse>,
  getAgentHistoryPrompts: (params?: {
    tool?: string; user?: string; q?: string; lang?: string;
    tools?: string[];
    limit?: number; offset?: number; page?: number; pageSize?: number;
  }) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryPrompts, params ?? {}) as Promise<AgentHistoryPromptsResponse>,
  getAgentHistorySession: (id: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistorySessionDetail, { session_id: id, id }) as Promise<AgentHistorySessionResponse>,
  refreshAgentHistory: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryRefresh, {}) as Promise<
      { success: boolean; data?: Record<string, unknown>; error?: string | null }
    >,
  updateAgentHistoryPrompt: (id: string, text: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryUpdatePrompt, { id, text }) as Promise<
      { success: boolean; data?: { id: string; text: string; edited: boolean }; error?: string | null }
    >,
  getAgentHistoryArticleConfig: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryArticleConfigGet, {}) as Promise<
      { success: boolean; data?: Record<string, unknown>; error?: string | null }
    >,
  saveAgentHistoryArticleConfig: (body: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryArticleConfigPost, body) as Promise<
      { success: boolean; data?: Record<string, unknown>; error?: string | null }
    >,
  startAgentHistoryArticlePipeline: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryArticleStart, {}) as Promise<
      { success: boolean; data?: Record<string, unknown>; error?: string | null }
    >,
  getAgentHistoryArticles: (limit = 50) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryArticleList, { limit }) as Promise<
      { success: boolean; data?: { items: Record<string, unknown>[] }; error?: string | null }
    >,
  getAgentHistoryArticleLogs: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryArticleLogs, {}) as Promise<
      { success: boolean; data?: Record<string, unknown>; error?: string | null }
    >,
  getAgentHistoryArticleRecords: (limit = 100) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryArticleRecords, { limit }) as Promise<AgentHistoryArticleRecordsResponse>,
  /** Probe one tool: parse its newest history source and return the latest prompt. */
  testAgentHistoryToolExtract: (tool: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryTestExtract, { tool }) as Promise<AgentHistoryTestExtractResponse>,
  /** Fetch article audio as a data: URL via HTTP (base64 + MIME). */
  getAgentHistoryArticleAudioDataUrl: async (recordId: string | number): Promise<string> => {
    const res = await requestPycoreHttp(PYCORE_HTTP_ROUTES.agentHistoryArticleAudio, {
      record_id: String(recordId),
      id: String(recordId),
    }) as { success?: boolean; data?: { mime?: string; audio_base64?: string }; error?: string };
    if (!res?.success || !res.data?.audio_base64) {
      throw new Error(res?.error || 'Audio not found');
    }
    const mime = res.data.mime || 'audio/mpeg';
    return `data:${mime};base64,${res.data.audio_base64}`;
  },
  // --- Queue Center: unified overview (contract A) ------------------------ #
  // pycore is the hub: it fans out to the selected Laravel endpoint for the
  // per-category counts + worker registry and merges its own engine status. All
  // Every category in config/queue_center_contract.json is always present;
  // laravel_reachable:false
  // means the counts are zeroed but the categories + local engines still report.
  getQueueOverview: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.queueOverviewGetQueueOverview, {}) as Promise<PcQueueOverview>,

  // --- Sentence-audio auto-start (Queue Center strip) --------------------- #
  getSentenceAudioAutoStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.sentenceAudioStatus, {}),
  setSentenceAudioAutoConfig: (autoStart: boolean) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.sentenceAudioConfig, { auto_start: autoStart }),
  // Backend config model requires auto_start, so the current value goes along.
  setSentenceAudioConcurrency: (concurrency: number, autoStart: boolean) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.sentenceAudioConfig, { auto_start: autoStart, concurrency }),
  runSentenceAudioOnce: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.sentenceAudioRunOnce, {}),
  getSentenceAudioQueue: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.sentenceAudioQueueSnapshot, {}),

  // --- Sentence-audio voice variants (per-language accent/gender specs) ----- #
  // The UI calls pycore through HTTP API. Pycore may use Laravel HTTP internally
  // to read, replace, or remove variant specs.
  getSentenceVoiceVariants: async (lang: string): Promise<SentenceVoiceVariant[]> => {
    const r = await requestPycoreHttp(PYCORE_HTTP_ROUTES.sentenceAudioVariantsIndex, { lang }) as {
      success: boolean; specs: SentenceVoiceVariant[];
    };
    return r?.specs ?? [];
  },
  saveSentenceVoiceVariants: (
    lang: string,
    specs: Array<{ variant_key: string; accent: string | null; gender: string; is_primary: boolean }>,
  ) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.sentenceAudioVariantsStore, { lang, specs }) as Promise<
      { success: boolean; specs: SentenceVoiceVariant[] }
    >,
  deleteSentenceVoiceVariant: (lang: string, variant_key: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.sentenceAudioVariantsDestroy, { lang, variant_key }) as Promise<
      { success: boolean }
    >,
  getQueueBumps: (limit = 30) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.queueBumpsListBumps, { limit }),

  getTaskCapabilityChains: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskSettingsChains, {}),
  saveTaskCapabilityChain: (taskType: string, priority: string[]) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskSettingsUpdateChain, { task_type: taskType, priority }),
  searchTaskHistory: (params: {
    q?: string; date_from?: string; date_to?: string; task_type?: string; worker?: string; limit?: number;
  }) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskHistorySearchTasks, {
      q: params.q,
      date_from: params.date_from,
      date_to: params.date_to,
      task_type: params.task_type,
      worker: params.worker,
      limit: params.limit ?? GLOBAL_TASK_LIMITS.history_records,
    }) as Promise<{ success?: boolean; entries?: any[]; total?: number; stored?: number }>,

  // --- Word-dictionary TTS auto-start (Queue Center strip) ---------------- #
  getWordTtsAutoStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.wordTtsStatus, {}),
  setWordTtsAutoConfig: (autoStart: boolean) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.wordTtsConfig, { auto_start: autoStart }),
  // Backend config model requires auto_start, so the current value goes along.
  setWordTtsConcurrency: (concurrency: number, autoStart: boolean) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.wordTtsConfig, { auto_start: autoStart, concurrency }),
  runWordTtsOnce: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.wordTtsRunOnce, {}),

  // --- Heartbeat workers overview (Queue Center worker strip) ------------- #
  getHeartbeatWorkersStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.heartbeatWorkersStatus, {}),
  setHeartbeatWorkerConfig: (callbackName: string, enabled: boolean) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.heartbeatWorkersConfig, { callback_name: callbackName, enabled }),
  getTaskCenter: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskCenterGet, {}) as Promise<PcTaskCenterResponse>,
  getQueueCenterSnapshot: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskCenterGetQueueCenterSnapshot, {}) as Promise<QueueCenterSnapshot>,
  setQueueCenterControl: (
    control: QueueCenterControlName,
    enabled: boolean,
    options?: {
      requested_by?: string | null;
      reason?: string | null;
      graceful_stop?: boolean;
      /** Dedicated short timeout for toggles (default 8s). */
      timeoutMs?: number;
    },
  ): Promise<QueueCenterControlResponse> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.taskCenterSetQueueCenterControl, {
      control_name: control,
      enabled,
      requested_by: options?.requested_by ?? null,
      reason: options?.reason ?? null,
      graceful_stop: options?.graceful_stop ?? false,
    }, options?.timeoutMs ?? 8_000) as Promise<QueueCenterControlResponse>,
  getWordAudioMediaDataUrl: async (word: string, language = 'en'): Promise<string> => {
    const response = await requestPycoreHttp(PYCORE_HTTP_ROUTES.wordAudioWordAudioMedia, {
      word,
      language,
    }) as { success?: boolean; media_type?: string; content_base64?: string; error?: string };
    if (!response?.success || !response.content_base64) {
      throw new Error(response?.error || 'Word audio not found');
    }
    return `data:${response.media_type || 'audio/mpeg'};base64,${response.content_base64}`;
  },

  // --- Queue Center: capability settings (contract B) --------------------- #
  // Read all four capability blocks (priority + availability + options).
  getCapabilitySettings: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.capabilityStatusGetCapabilitySettings, {}) as Promise<PcCapabilitySettings>,
  // Persist ONE capability's priority/options and live-apply; returns the
  // updated block. `priority` re-orders the engine chain (omitted engines are
  // appended in default order server-side, so a save can never silence it);
  // `options` carries the TTS tuning (synth_timeout_s / edge_cooldown_s).
  saveCapabilitySettings: (
    capability: PcCapabilityKey,
    patch: { priority?: string[]; options?: PcCapabilityOptions },
  ) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.capabilityStatusPostCapabilitySettings, {
      capability, ...patch,
    }) as Promise<PcCapabilitySaveResponse>,

  // --- Offline dictionary (ECDICT + WordNet) ------------------------------ #
  // Free, offline word translation served alongside Google/AI. status reports
  // whether the data is installed (run 107_install_dictionaries.sh).
  getDictionaryStatus: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.dictionaryDictionaryStatus, {}),
  getDictionaryLookup: (word: string, target = 'zh') =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.dictionaryDictionaryLookup, { word, target }),

  // --- auto-start on boot (native OS startup entry) ----------------------- #
  getAutostart: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.controlGetAutostart, {}) as Promise<AutostartStatus>,
  // target/mechanism are optional; the backend falls back to the persisted
  // preference, so a bare enable keeps the historical behavior.
  setAutostart: (enabled: boolean, target?: AutostartTarget, mechanism?: string) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.controlSetAutostart, { enabled, target, mechanism }) as Promise<AutostartStatus>,

  // --- Vocabulary service proxy ------------------------------------------- #
  // Pure passthrough for the shared backend vocabulary contract.
  getVocabTranslationLanguages: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabTranslationLanguages, {}),
  translateVocab: (payload: VocabTranslateRequest) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabTranslationTranslate, payload),
  queueVocabTranslationBatch: (payload: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabTranslationQueueBatchAdd, payload),
  generateVocabTts: (payload: VocabTtsGenerateRequest) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabTtsGenerate, payload),
  queueVocabTtsBatchQuery: (items: Record<string, unknown>[]) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabTtsQueueBatchQuery, { items }),
  getVocabSentenceAudio: (params: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabTtsSentenceAudio, params),
  getVocabTtsQueueStats: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabTtsQueueStats, {}),
  getVocabTtsQueueItems: (params: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabTtsQueueItems, params),
  getVocabAssistOverview: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabAssistOverview, {}),
  getVocabAssistOverviewItems: (params: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabAssistOverviewItems, params),
  retryVocabCover: (payload: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabCoverRetry, payload),
  getVocabLibraries: (params: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabLibraries, params),
  getVocabResourceDataUrl: async (url: string): Promise<string> => {
    const response = await requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyResource, { url }) as {
      success?: boolean; content_base64?: string; mime?: string;
    };
    return response?.success && response.content_base64
      ? `data:${response.mime || 'application/octet-stream'};base64,${response.content_base64}`
      : '';
  },
  getVocabLibraryWords: (libraryId: number, params: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabLibraryWords, { library_id: libraryId, ...params }),
  deleteVocabLibrary: (libraryId: number) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabDeleteLibrary, { library_id: libraryId }),
  getVocabStatistics: (params: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabStatistics, params),
  getVocabLanguageBreakdown: (params: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabLanguageBreakdown, params),
  getVocabDictionaryWords: (params: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabDictionaryWords, params),
  createVocabDictionaryWord: (payload: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabCreateDictionaryWord, payload),
  // Updates remain HTTP API; pycore chooses the required Laravel HTTP verb.
  updateVocabDictionaryWord: (md5: string, payload: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabUpdateDictionaryWord, { md5, ...payload }),
  deleteVocabDictionaryWord: (md5: string, params: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabDeleteDictionaryWord, { md5, ...params }),
  batchVocabDictionaryWords: (payload: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabBatchDictionaryWords, payload),
  getVocabDictionarySentences: (params: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabDictionarySentences, params),
  reportVocabValidity: (payload: Record<string, unknown>) =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabValidityReport, payload),
  getVocabStorageSummary: () =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.vocabularyVocabStorageSummary, {}),

};
