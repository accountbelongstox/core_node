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
} from './PycoreApi';

export {
  connectPycoreWs, subscribe, subscribeWs, callRpc, onWsStatus, onWsDiag,
  isWsConnected, getClientId,
} from './PycoreWs';

export {
  pycoreLaravelApi, PYCORE_LARAVEL_API_CHANGED_EVENT,
} from './PycoreLaravelApi';
export type {
  PycoreLaravelApi, LaravelApiEndpoint, LaravelApiListResponse,
  LaravelApiMutateResponse,
} from './PycoreLaravelApi';

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
} from './PycoreCapabilityStore';
export type { PycoreCapabilityState, CapabilityKey } from './PycoreCapabilityStore';

export * from './pycoreTypes';
