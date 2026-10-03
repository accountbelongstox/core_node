/** Shared Pycore integration boundary for every unified UI application. */
export { pycoreApi, mapQueueSnapshot } from './PycoreApi';
export { pycoreConsoleLogStore } from './PycoreConsoleLogStore';
export type { ConsoleLogLine, ConsoleLogNoteKey, ConsoleLogViewState } from './PycoreConsoleLogStore';
export type { ConsoleLogEntry, ConsoleLogHistory } from './PycoreConsoleLogTypes';
export { PYCORE_HTTP_ROUTES, isPycoreRouteServed } from './PycoreHttpRoutes';
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
  PYCORE_HTTP_PATHS,
  PYCORE_HTTP_DEFAULTS,
  PYCORE_HTTP_HEADER_NAMES,
  PYCORE_HTTP_JSON_CONTENT_TYPE,
  PYCORE_PRESENCE_LEASES,
} from './PycoreNetwork';
export type { PycorePresenceLease } from './PycoreNetwork';
export {
  PYCORE_BROWSER_EVENTS,
  PYCORE_EVENT_TOPICS,
} from './PycoreEventTopics';
export type { PycoreEventTopic } from './PycoreEventTopics';
export type {
  PycoreApi, QueueResponse, SystemSettingsResponse,
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
  MachineClipboardEntry, MachineSendClipboardResult, MachineSendFileResult, MachineSendResult, MachineSendTextResult,
} from './PycoreApiMachineSend';
export { TERMINAL_BACKUP_DELETE_CONFIRM, TERMINAL_BACKUP_PAGE_SIZE } from './PycoreApiTerminal';
export { createPycoreApiTerminal, type PycoreTerminalApi } from './PycoreApiTerminal';
export { pycoreNodeClient, pycoreNodeTerminalApi, type PycoreNodeClient } from './PycoreNodeClients';
export type { GitSyncControl, GitSyncState } from './PycoreApiGitSync';
export { createPycoreApiMachineSend, type PycoreMachineSendApi } from './PycoreApiMachineSend';
export { type PycoreHttpApi } from './PycoreHttp';
export type {
  TerminalActionResult,
  TerminalBackupDeleteResult,
  TerminalBackupState,
  TerminalSpecialEntry,
  TerminalSpecialState,
  TerminalBackupItem,
  TerminalBackupKind,
  TerminalBackupListParams,
  TerminalBackupListResult,
  TerminalBackupMatch,
  TerminalBackupOpenResult,
  TerminalBackupReadResult,
  TerminalBackupTerminal,
  TerminalCaptureResult,
  TerminalImageUploadOptions,
  TerminalImageUploadResult,
  TerminalCapability,
  TerminalCapabilityName,
  TerminalControlMode,
  TerminalDesktopIntegrationAction,
  TerminalKeyAction,
  TerminalRenameResult,
  TerminalQuickCommand,
  TerminalShellOs,
  TerminalQuickCommands,
  TerminalDesktopIntegrationResult,
  TerminalPlatformProfile,
  TerminalDraftResult,
  TerminalLogEntry,
  TerminalLogSource,
  TerminalScheduleClearResult,
  TerminalScheduleDefinition,
  TerminalScheduleEntry,
  TerminalScheduleMode,
  TerminalScheduleSyncResult,
  TerminalSnapshot,
  TerminalScreenshotResourceMeta,
  TerminalViewResult,
  TerminalWindowInfo,
  TerminalWindowPoint,
  TerminalWindowRect,
} from './PycoreApiTerminal';

export {
  requestPycoreHttp, pycoreDirectRequest, requestPycoreHttpText, requestPycoreStatus, getClientId, getBrowserId,
} from './PycoreHttp';
export { createPycoreLiveSource, type PycoreLiveSource, type PycoreLiveSourceOptions } from './PycoreLiveSource';
export {
  connectPycoreHttp, subscribe, subscribeHttpEvent, onHttpStatus, onHttpDiag,
  reportHttpDiag, isHttpConnected, setPycoreActive, holdPycoreLease,
} from './PycoreEventClient';
export {
  AGENT_HISTORY_FEED_TOPICS,
  useAgentHistoryPromptFeed,
  type AgentHistoryPromptFeedOptions,
} from './useAgentHistoryPromptFeed';

export {
  getPycoreTarget, isPycoreRemote, isPycoreDefaultTarget, pycoreTargetHost,
  getPycoreTargetRecent, forgetPycoreTargetRecent, rememberPycoreTarget, listPycoreEndpoints, setPycoreTarget,
  getPycoreSelectedTarget,
  setPycoreSessionTarget, getPycoreSessionTarget, isPrivateLanHost,
  setPycoreLanRoute, getPycoreLanRoute, setPycoreLanEndpoints, rememberPycoreLanUrls,
  localPycoreHost, localPycoreOrigin, pycoreEffectiveHost,
  isViteDevShell,
  isLoopbackPage, isNativeAppShell, directPycoreHost,
  isPycoreLoopbackHost, isPycoreDirectAccessAllowed,
  isPycoreDashboardOrigin, pycoreDashboardOriginPorts,
  rewritePycoreEndpoint, tailnetDomainOf, classifyPycoreBackendUrl,
  isPycoreRelayMode, isPycoreProxyMode, subscribePycoreTarget, pycoreTargetBackendUrl, normalizePycoreBackendUrl,
} from './pycoreTarget';
export type {
  PycoreTarget, PycoreEndpoint, PycoreEndpointKind, PycoreEndpointSource, SetPycoreTargetOptions,
} from './pycoreTarget';
export {
  getPycoreProbe, probePycoreEndpoint, probePycoreEndpoints, switchPycoreTarget,
  recordPycoreProbe, subscribePycoreProbes,
} from './PycoreEndpointProbe';
export type { PycoreProbeResult, PycoreProbeState, PycoreSwitchResult } from './PycoreEndpointProbe';
export { lanScanHosts, scanLanPycore } from './PycoreLanScanner';
export { isPycoreLanUrl, pycoreLanSignHeaders } from './pycoreLanAuth';
export type { LanScanOptions, LanScanResult, LanScanState } from './PycoreLanScanner';
export { pycoreLink } from './PycoreServiceLink';
export {
  getTailnetPeers, refreshTailnetPeers, subscribeTailnetPeers, addTailnetDiscoveryOrigins,
} from '../../network/TailnetDiscovery';
export { classifyPycoreAccess, type PycoreAccess } from './pycoreAccess';
export { deliverThroughRelay, relayPycoreFetch, relayPycoreOrigin } from './RelayDelivery';
export {
  designateLaravelRelayDevice, clearLaravelRelayDevice, laravelRelayDeviceId,
  subscribeLaravelRelayDevice, isLaravelRelayReady,
} from './RelayPairing';
export { isPycoreRelayError } from './PycoreRelayError';
export type {
  PycoreRelayError,
  PycoreRelayErrorKind,
} from './PycoreRelayError';

export {
  PYCORE_BACKEND_PORT, PycorePaths,
  normalizePycorePath, buildPycoreHttpUrl,
} from './pycoreEndpoints';

export {
  PYCORE_HEALTH_EVENT, PYCORE_HEALTH_DEFAULTS,
  getPycoreHealth, checkPycoreNow, recheckPycoreNow,
  getPycoreRecheckIntervalMs, setPycoreRecheckIntervalMs,
  syncPycoreOfflineRecheckLoop, stopPycoreOfflineRecheckLoop,
} from './PycoreHealth';
export type { PycoreHealthState } from './PycoreHealth';

export type * from './PycorePlatformTypes';
export type * from './PycoreAiTypes';
export type * from './PycoreAiHubTypes';
export { aiHubData, aiHubEntryKey, aiHubFailureCode } from './PycoreApiAiHub';
export type * from './PycoreApiOrchestration';
export type * from './PycoreApiOrchestrationVideo';
export type * from './PycoreApiOrchestrationFiles';
export type * from './PycoreApiOrchestrationResources';
export { ORCH_RESOURCE_LOOKUP_MAX_ITEMS, ORCH_RESOURCE_BUNDLE_MAX_ITEMS, parseOrchResourceBundle } from './PycoreApiOrchestrationResources';
export { ORCH_FILE_MAX_BUFFER_BYTES, ORCH_FILE_TOO_LARGE_CODE, ORCH_FILE_ABORTED_CODE } from './PycoreApiOrchestrationFiles';
export type * from './PycoreSpeechTypes';
export type * from './PycoreServiceTypes';
export type * from './PycoreQueueTypes';
export * from '../../contracts/QueueCenterContract';
export * from './ttsEngineState';
