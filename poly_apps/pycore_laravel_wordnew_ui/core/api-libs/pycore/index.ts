/**
 * PycoreApi library barrel — the pycore-manager end's self-contained API surface.
 * Re-exports HTTP transport, cache helpers, and shared types.
 */
export { pycoreApi, mapQueueSnapshot } from './PycoreApi';
export { PYCORE_HTTP_ROUTES, VORTEX_PYCORE_HTTP_ROUTES } from './PycoreHttpRoutes';
export type { PycoreHttpRoute } from './PycoreHttpRoutes';
export {
  PYCORE_BROWSER_EVENTS,
  PYCORE_EVENT_TOPICS,
  VORTEX_PYCORE_EVENT_TOPICS,
} from './PycoreEventTopics';
export type { PycoreEventTopic } from './PycoreEventTopics';
export type {
  PycoreApi, QueueResponse, RuntimeInfo, SystemSettingsResponse,
  BookLanguageRow, BookTopWord, BookTextStats, BookFileEntry,
  BooksScanResponse, BookFileAnalysis, BooksAnalyzeResponse,
  BooksSupportedFormatsResponse, BooksAnalyzeOptions,
  BookSourceState, BooksStateResponse, BookSubmitItem, BooksSubmitResponse,
  BooksListResponse, BookChapter, BookSlot,
  CoreBookCompletenessLang, CoreBookMissing, CoreBookCompleteness,
  CoreBookSummary, CoreBookListResponse, CoreBookConvertRequest, CoreBookConvertResponse,
  CoreBookGetResponse, CoreBookDeleteResponse, CoreBookAddLanguageRequest,
  CoreBookFillAudioRequest, CoreBookEnrichResponse, CoreBookSubmitRequest, CoreBookSubmitResponse,
} from './PycoreApi';

export {
  connectPycoreHttp, subscribe, subscribeHttpEvent, requestPycoreHttp, onHttpStatus, onHttpDiag,
  isHttpConnected, getClientId, getBrowserId, setPycoreActive,
} from './PycoreHttp';

export {
  getPycoreTarget, isPycoreRemote, pycoreTargetHost,
  getPycoreTargetRecent, getPycoreTargetPresets, normalizePycoreHost, setPycoreTarget,
  localPycoreHost, localPycoreOrigin, pycoreEffectiveHost,
  isPycoreSecureContext, pnaBlockedReason, isViteDevShell,
  isLoopbackPage, directPycoreHost, pycoreLocalConnectionHint,
  rewritePycoreEndpoint,
} from './pycoreTarget';
export type { PycoreTarget, PycorePresetHost } from './pycoreTarget';

export {
  PYCORE_PORT, PycorePaths,
  normalizePycorePath, buildPycoreHttpUrl,
} from './pycoreEndpoints';

export {
  pycoreLaravelApi,
} from './PycoreLaravelApi';
export type {
  PycoreLaravelApi, LaravelApiEndpoint, LaravelApiListResponse,
  LaravelApiMutateResponse, LaravelApiListOptions,
} from './PycoreLaravelApi';

export {
  LARAVEL_API_PORT, PC_LARAVEL_PREPARED_HOSTS,
  normalizeLaravelApiUrl, buildPcPreparedLaravelEndpoints,
  buildPcPreparedLaravelEndpointUrls,
} from './pcLaravelPreparedEndpoints';

export {
  loadSettings, saveSettings,
  loadQueueCache, saveQueueCache, queueCacheAgeMs,
} from './PycoreCache';

export {
  PYCORE_HEALTH_EVENT, PYCORE_HEALTH_DEFAULTS,
  getPycoreHealth, checkPycoreNow, recheckPycoreNow,
  getPycoreRecheckIntervalMs, setPycoreRecheckIntervalMs,
  syncPycoreOfflineRecheckLoop, stopPycoreOfflineRecheckLoop,
} from './PycoreHealth';
export type { PycoreHealthState } from './PycoreHealth';

export {
  PYCORE_CAPABILITY_EVENT,
  getPycoreCapabilityState,
  subscribePycoreCapability,
  refreshPycoreCapabilities,
  startPycoreCapabilityPoll,
  stopPycoreCapabilityPoll,
  usePycoreCapability,
} from './PycoreCapabilityStore';
export type { PycoreCapabilityState, CapabilityKey, PycoreCapabilityHook } from './PycoreCapabilityStore';

export {
  PYCORE_ENGINE_LOAD_EVENT,
  getPycoreEngineLoadState,
  subscribePycoreEngineLoad,
  usePcEngineLoadStatus,
} from './PycoreEngineLoadStore';
export type { PycoreEngineLoadState, PycoreEngineLoadHook } from './PycoreEngineLoadStore';

export * from './pycoreTypes';
export * from './QueueCenterContract';
export * from './ttsEngineState';
export * from './PycoreVocabTypes';
