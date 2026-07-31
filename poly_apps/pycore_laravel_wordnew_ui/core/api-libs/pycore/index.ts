/**
 * Shared Pycore runtime primitives. Applications must consume these through
 * their own app-local adapter instead of importing this implementation path.
 */
export { pycoreApi, mapQueueSnapshot } from './PycoreApi';
export { PYCORE_HTTP_ROUTES, VORTEX_PYCORE_HTTP_ROUTES } from './PycoreHttpRoutes';
export type { PycoreHttpRoute } from './PycoreHttpRoutes';
export { PycoreHttpError, PycoreMasterClient, pycoreMasterClient } from './PycoreClient';
export { PycoreEventBus, pycoreEventBus } from './PycoreEventBus';
export type {
  PycoreEventHandler,
  PycoreSubscribeOptions,
  Unsubscribe,
} from './PycoreEventBus';
export {
  PYCORE_HTTP_PORT,
  PYCORE_HTTP_PATHS,
  PYCORE_HTTP_DEFAULTS,
  PYCORE_HTTP_HEADER_NAMES,
  PYCORE_HTTP_JSON_CONTENT_TYPE,
  PYCORE_SSE_EVENTS,
} from './PycoreNetwork';
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
  connectPycoreHttp, subscribe, subscribeHttpEvent, requestPycoreHttp, requestPycoreStatus, onHttpStatus, onHttpDiag,
  reportHttpDiag,
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
  PYCORE_HEALTH_EVENT, PYCORE_HEALTH_DEFAULTS,
  getPycoreHealth, checkPycoreNow, recheckPycoreNow,
  getPycoreRecheckIntervalMs, setPycoreRecheckIntervalMs,
  syncPycoreOfflineRecheckLoop, stopPycoreOfflineRecheckLoop,
} from './PycoreHealth';
export type { PycoreHealthState } from './PycoreHealth';

export * from './pycoreTypes';
export * from './QueueCenterContract';
export * from './ttsEngineState';
export * from './PycoreVocabTypes';
