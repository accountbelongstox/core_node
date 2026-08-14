/** Shared Laravel API library for every unified UI application. */
export { LARAVEL_BROWSER_EVENTS, LaravelAPI, laravelApi } from './LaravelAPI';
export { LARAVEL_REALTIME_EVENTS, laravelRealtime } from './LaravelRealtime';
export type {
  LaravelRealtimeEventName,
  LaravelRealtimeEventPayloadMap,
  LaravelWorkerPresenceEvent,
} from './LaravelRealtime';
export { API_HEALTH_EVENT, apiManager } from './ApiManager';
export type { HealthCheckResult } from './ApiManager';
export type {
  LaravelApiEndpoint,
  LaravelEndpointActionResult,
  MediaSourceListItem,
  MediaListResponse,
  MediaSentence,
  PcLaravelApi,
} from './LaravelAPI';
export type {
  AssistCategoryItemsResponse,
  AssistOverviewResponse,
  AssistQueueCategory,
  AssistQueueHandler,
  AssistQueueWorker,
  LaravelSentenceVoiceVariant,
  LaravelTranslationStackItem,
  LaravelTranslationStackResult,
  LaravelVocabTranslateRequest,
  LaravelVocabTtsGenerateRequest,
  VocabLanguageInfo,
  VocabDictionaryWordRow,
  VocabLibrary,
  VocabLibraryWordRow,
  VocabLibraryWordsResponse,
  VocabAssistCategory,
} from './LaravelTypes';

/** Transport layer (single definition site for all Laravel HTTP modules). */
export {
  BaseAPI,
  DEFAULT_REQUEST_TIMEOUT_MS,
  getSharedBaseURL,
  setSharedBaseURL,
  setSharedAuthToken,
  getSharedAuthToken,
} from './transport/BaseAPI';
export { apiCache } from './transport/APICache';
export {
  LARAVEL_API_PREFIX,
  LARAVEL_API_ROUTE,
  createLaravelModuleConfig,
} from './transport/ApiContract';
export { EndpointProbeAPI } from './transport/EndpointProbeAPI';
export { MediaQueryAPI } from './transport/MediaQueryAPI';
export { htmlErrorManager } from './transport/HtmlErrorEvents';
export type { HtmlErrorEvent } from './transport/HtmlErrorEvents';
export {
  GLOBAL_LOGIN_REQUEST_EVENT,
  requestGlobalLogin,
  subscribeGlobalLoginRequest,
} from './transport/LoginRequestBridge';
export type {
  APIResponse,
  APIRequestConfig,
  APIModuleConfig,
  CacheEntry,
} from './transport/TransportTypes';
