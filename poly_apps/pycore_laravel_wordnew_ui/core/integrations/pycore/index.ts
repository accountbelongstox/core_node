/** Shared Pycore integration boundary for every unified UI application. */
export { pycoreApi, mapQueueSnapshot } from './PycoreApi';
export { PYCORE_HTTP_ROUTES } from './PycoreHttpRoutes';
export type { PycoreHttpRoute } from './PycoreHttpRoutes';
export { PycoreHttpError, PycoreMasterClient, pycoreMasterClient } from './PycoreClient';
export { pycoreRouteRecoveryStore } from './PycoreRouteRecoveryStore';
export type { PycoreRouteRecoveryEntry } from './PycoreRouteRecoveryStore';
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
export type {
  TerminalActionResult,
  TerminalDraftResult,
  TerminalLogEntry,
  TerminalSnapshot,
  TerminalViewResult,
  TerminalWindowInfo,
  TerminalWindowPoint,
  TerminalWindowRect,
  TerminalWindowScreenshot,
} from './PycoreApiTerminal';

export {
  connectPycoreHttp, subscribe, subscribeHttpEvent, requestPycoreHttp, requestPycoreHttpGet,
  requestPycoreHttpText, requestPycoreStatus, onHttpStatus, onHttpDiag,
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
  PYCORE_HEALTH_EVENT, PYCORE_HEALTH_DEFAULTS,
  getPycoreHealth, checkPycoreNow, recheckPycoreNow,
  getPycoreRecheckIntervalMs, setPycoreRecheckIntervalMs,
  syncPycoreOfflineRecheckLoop, stopPycoreOfflineRecheckLoop,
} from './PycoreHealth';
export type { PycoreHealthState } from './PycoreHealth';

export * from './pycoreTypes';
export * from '../../contracts/QueueCenterContract';
export * from './ttsEngineState';
