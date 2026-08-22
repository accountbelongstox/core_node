/**
 * chrome.storage key registry — the SINGLE home for every raw chrome.storage
 * (local / session) key + related alarm name the extension writes. Consumers
 * import `STORAGE_KEYS.X` instead of repeating a literal, so a key can never be
 * mistyped or renamed at one site and silently orphan its persisted data.
 *
 * Values are frozen because changing one would abandon existing persisted data.
 * Compatibility modules may re-export these values, but must not redefine them.
 */

export const STORAGE_KEYS = {
  APP_SETTINGS: 'appSettings',
  API_SETTINGS: 'api_settings',
  EXTENSION_CONFIGS: 'extensionConfigs',
  SERVER_STATUS: 'serverStatus',
  NATIVE_SERVER_PORT: 'nativeServerPort',
  USER_LANGUAGE: 'userLanguage',
  POPUP_THEME: 'popup_theme',
  GLOBAL_LOGS: 'mcp_global_logs',

  SEMANTIC_MODEL: 'selectedModel',
  SEMANTIC_MODEL_VERSION: 'selectedVersion',
  SEMANTIC_MODEL_STATE: 'modelState',
  SEMANTIC_ENGINE_STATE: 'semanticEngineState',
  AUDIO_RECORDING_CONFIG: 'audioRecordingConfig',

  AI_WEB_PROVIDER: 'aiWebProvider',
  AI_VALIDITY_PROVIDER: 'aiValidityProvider',
  VALIDITY_LANGUAGE: 'validityLanguage',
  VALIDITY_LANGUAGES: 'validityLanguages',
  LARAVEL_API_BASE: 'laravelApiBase',
  API_BASE_URL: 'apiBaseUrl',
  MCP_SERVER_URL: 'mcpServerUrl',

  USER_PREFERENCES: 'userPreferences',
  VECTOR_INDEX: 'vectorIndex',

  // Task Center popup composable (useTaskCenter.ts).
  TASK_CENTER_CONFIG: 'task_center_config',

  // Background run-intent — authoritative assist allowlist (run-intent.ts).
  TC_RUN_INTENT: 'tc_run_intent',
  TASK_CENTER_RUNTIME: 'task_center_runtime',
  TASK_CENTER_WATCHDOG_ALARM: 'task-center-watchdog',

  // Durable write-retry queue (outbox/submit-outbox.ts).
  SUBMIT_OUTBOX: 'submit_outbox_v1',

  BACKEND_TIMEOUT: 'backendTimeoutMs',

  // DeepSeek task queue (utils/deepseek-task-queue.ts).
  DEEPSEEK_TASKS: 'deepseek_tasks',
  DEEPSEEK_CONFIG: 'deepseek_config',

  // Bing dictionary worker runtime (session) + watchdog alarm name
  // (bing-worker-lifecycle.ts).
  BING_WORKER_RUNTIME: 'bing_worker_runtime',
  BING_WATCHDOG_ALARM: 'bing-translation-worker-watchdog',

  // Bing dictionary popup composables
  // (useBingDictionary.ts / useBingDictionaryClient.ts).
  BING_DICTIONARY_HISTORY: 'bing_dictionary_history',
  BING_DICTIONARY_CLIENT_MODE: 'bing_dictionary_client_mode',
  BING_DICTIONARY_CLIENT_CONFIG: 'bing_dictionary_client_config',

  BING_ACTIVATE_PER_WORD: 'bingActivatePerWord',
  HOW_TO_PRONOUNCE_ENABLED: 'howtopronounceEnabled',

  DUOREADER_IMPORT_PROGRESS: 'duoreader_importer_progress',
  DUOREADER_IMPORT_STATE: 'duoreader_importer_state',
  DUOREADER_IMPORT_SESSION: 'duoreader_importer_session',

  WEB_SEARCH_PROGRESS: 'web_search_progress',
  WEB_SEARCH_COVER_MANIFESTS: 'web_search_cover_manifests',
  WEB_SEARCH_ENGINE_CIRCUITS: 'web_search_engine_circuits',
  QWEN_TTS_PROGRESS: 'qwenTtsProgress',
} as const;

export const UI_STORAGE_PREFIX = 'ui:' as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
