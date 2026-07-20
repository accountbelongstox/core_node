/**
 * PycoreApi library barrel — the pycore-manager end's self-contained API surface.
 * Re-exports the singleton client, WS helpers, cache helpers and shared types.
 */
export { pycoreApi, mapQueueSnapshot } from './PycoreApi';
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
  connectPycoreWs, subscribe, subscribeWs, callRpc, onWsStatus, onWsDiag,
  isWsConnected, getClientId, setPycoreActive,
} from './PycoreWs';

export { connectPycoreSse, isSseConnected, setPycoreSseActive } from './PycoreSse';

export {
  getPycoreTarget, isPycoreRemote, pycoreTargetHost,
  getPycoreTargetRecent, getPycoreTargetPresets, normalizePycoreHost, setPycoreTarget,
  localPycoreHost, localPycoreOrigin, pycoreEffectiveHost,
  isPycoreSecureContext, pnaBlockedReason, isViteDevShell,
  isLoopbackPage, directPycoreHost, pycoreLocalConnectionHint,
  rewritePycoreEndpoint, pycoreWsUrlOverride, pycoreSseUrlOverride,
} from './pycoreTarget';
export type { PycoreTarget, PycorePresetHost } from './pycoreTarget';

export {
  PYCORE_PORT, PycorePaths,
  normalizePycorePath, buildPycoreHttpUrl, buildPycoreWsUrl, buildPycoreSseBaseUrl,
} from './pycoreEndpoints';

export {
  pycoreLaravelApi, PYCORE_LARAVEL_API_CHANGED_EVENT,
} from './PycoreLaravelApi';
export type {
  PycoreLaravelApi, LaravelApiEndpoint, LaravelApiListResponse,
  LaravelApiMutateResponse,
} from './PycoreLaravelApi';

export {
  LARAVEL_API_PORT, PC_LARAVEL_PREPARED_HOSTS,
  normalizeLaravelApiUrl, buildPcPreparedLaravelEndpoints,
} from './pcLaravelPreparedEndpoints';

export {
  loadSettings, saveSettings,
  loadQueueCache, saveQueueCache, queueCacheAgeMs,
  loadOverviewCache, saveOverviewCache, overviewCacheAgeMs,
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
export * from './ttsEngineState';
export * from './PycoreVocabTypes';
