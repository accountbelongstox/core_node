// Unified API Endpoints Configuration
// Real backend integration validated: 2025-12-04 with http://192.168.50.3:9000
// All API endpoints use key-based access, no hardcoded URLs allowed elsewhere

export const API_BASE_URL = 'http://192.168.50.3:9000/api'

export const API_ENDPOINTS = {
  // ===========================
  // Common Auth & User APIs (Real data validated: 2025-12-04)
  // ===========================
  AUTH_REGISTER: '/register',
  AUTH_LOGIN: '/login',
  AUTH_LOGOUT: '/logout',
  AUTH_USER: '/user',
  AUTH_FORGOT_PASSWORD: '/forgot-password',
  AUTH_RESET_PASSWORD: '/reset-password',
  AUTH_VERIFY_EMAIL: '/verify-email/{id}/{hash}',
  AUTH_RESEND_VERIFICATION: '/email/verification-notification',

  // ===========================
  // System & Status APIs (Real data validated: 2025-12-04)
  // ===========================
  SYSTEM_STATUS: '/get_system_status',
  SESSION_STORE: '/store_session',
  SESSION_RETRIEVE: '/retrieve_session',
  SESSION_BROADCAST: '/broadcast_session',
  API_INFO: '/api_info', // Special endpoint for API documentation
  CSRF_TOKEN: '/csrf-token',

  // ===========================
  // API Cache Management
  // ===========================
  API_HEADERS_CACHE_SAVE: '/api_headers_cache/save',
  API_HEADERS_CACHE_RESET: '/api_headers_cache/reset',
  API_PARAMS_CACHE_SAVE: '/api_params_cache/save',
  API_PARAMS_CACHE_LOAD: '/api_params_cache/load',

  // ===========================
  // API Testing Module (Real data validated: 2025-12-04)
  // ===========================
  API_TEST_EXECUTE: '/ittools/api-test/execute',
  API_TEST_HISTORY: '/ittools/api-test/history',
  API_TEST_CSRF: '/ittools/api-test/csrf',
  API_TEST_SAVE: '/ittools/api-test/save',
  API_TEST_DELETE: '/ittools/api-test/delete/{id}',

  // ===========================
  // System Information Module (Real data validated: 2025-12-04)
  // ===========================
  SYSTEM_PHP_INFO: '/ittools/system/php-info',
  SYSTEM_LARAVEL_INFO: '/ittools/system/laravel-info',
  SYSTEM_SERVER_INFO: '/ittools/system/server-info',
  SYSTEM_DATABASE_INFO: '/ittools/system/database-info',

  // ===========================
  // Code Browser Module (Real data validated: 2025-12-04)
  // ===========================
  CODE_TREE: '/ittools/code/tree',
  CODE_FILE_READ: '/ittools/code/file',
  CODE_SEARCH: '/ittools/code/search',
  // Legacy Code Browser Endpoints
  CODE_BROWSER_READ_FILE: '/code-browser/read-file',
  CODE_BROWSER_SAVE_FILE: '/code-browser/save-file',
  CODE_BROWSER_DELETE_FILE: '/code-browser/delete-file',
  CODE_BROWSER_PROMPTS_TRANSLATE_LINE: '/code-browser/prompts/translate-line',
  CODE_BROWSER_PROMPTS_TRANSLATE_NAME: '/code-browser/prompts/translate-name',
  CODE_BROWSER_PROMPTS_CREATE: '/code-browser/prompts/create',

  // ===========================
  // Static Resources Module (Real data validated: 2025-12-04)
  // ===========================
  RESOURCE_LIST: '/ittools/resources/list',
  RESOURCE_UPLOAD: '/ittools/resources/upload',
  RESOURCE_DELETE: '/ittools/resources/delete/{id}',
  // Legacy Static Resources Endpoints
  STATIC_FILE_TREE: '/static-resources/file-tree',
  STATIC_READ_FILE: '/static-resources/read-file',
  STATIC_STREAM_FILE: '/static-resources/stream-file',
  STATIC_DELETE_PREVIEW: '/static-resources/delete-preview',
  STATIC_DELETE: '/static-resources/delete',
  STATIC_UPLOAD: '/static-resources/upload',
  STATIC_RENAME: '/static-resources/rename',
  STATIC_CREATE_DIRECTORY: '/static-resources/create-directory',
  STATIC_CHUNKED_UPLOAD_INIT: '/static-resources/chunked-upload/init',
  STATIC_CHUNKED_UPLOAD_CHUNK: '/static-resources/chunked-upload/chunk',
  STATIC_CHUNKED_UPLOAD_MERGE: '/static-resources/chunked-upload/merge',

  // ===========================
  // MCP Manager Module (Real data validated: 2025-12-04)
  // ===========================
  MCP_SERVERS_LIST: '/ittools/mcp/servers',
  MCP_SERVER_STATUS: '/ittools/mcp/server/{id}/status',
  MCP_CONFIG_UPDATE: '/ittools/mcp/config',
  MCP_TOOLS_LIST: '/ittools/mcp/tools',
  // Legacy MCP Task Dispatch
  MCP_TASK_CATEGORIES_FILES: '/api/mcp/v1/task-dispatch/categories',
  MCP_TASK_QUEUE_ADD: '/api/mcp/v1/task-dispatch/queue/add-file',

  // ===========================
  // Octane Tasks Module (Real data validated: 2025-12-04)
  // ===========================
  OCTANE_TASKS_LIST: '/ittools/octane/tasks',
  OCTANE_TASK_EXECUTE: '/ittools/octane/task/execute',
  OCTANE_TASK_SCHEDULE: '/ittools/octane/task/schedule',
  OCTANE_TASK_LOGS: '/ittools/octane/task/{id}/logs',

  // ===========================
  // Vocabulary Learning Module (Real data validated: 2025-12-04)
  // ===========================
  VOCAB_LIST: '/ittools/vocabulary/list',
  VOCAB_ADD: '/ittools/vocabulary/add',
  VOCAB_UPDATE: '/ittools/vocabulary/update/{id}',
  VOCAB_DELETE: '/ittools/vocabulary/delete/{id}',
  VOCAB_PROGRESS: '/ittools/vocabulary/progress',
  VOCAB_TEST: '/ittools/vocabulary/test',

  // ===========================
  // IT Tools (Dev Tools Sub-module) (Real data validated: 2025-12-04)
  // ===========================
  ITTOOLS_EXECUTE: '/ittools/dev-tools/execute',
  ITTOOLS_HISTORY: '/ittools/dev-tools/history',

  // ===========================
  // ITTools Crypto
  // ===========================
  ITTOOLS_CRYPTO_BCRYPT_HASH: '/api/ittools/v1/crypto/bcrypt/hash',
  ITTOOLS_CRYPTO_BCRYPT_VERIFY: '/api/ittools/v1/crypto/bcrypt/verify',
  ITTOOLS_CRYPTO_ULID_GENERATE: '/api/ittools/v1/crypto/ulid/generate',
  ITTOOLS_CRYPTO_BIP39_GENERATE: '/api/ittools/v1/crypto/bip39/generate',

  // ===========================
  // ITTools Converters
  // ===========================
  ITTOOLS_CONVERTER_JSON_YAML: '/api/ittools/v1/converter/json-to-yaml',
  ITTOOLS_CONVERTER_YAML_JSON: '/api/ittools/v1/converter/yaml-to-json',

  // ===========================
  // ITTools Formatters
  // ===========================
  ITTOOLS_FORMAT_XML: '/api/ittools/v1/web/xml/format',
  ITTOOLS_FORMAT_YAML: '/api/ittools/v1/web/yaml/format',
  ITTOOLS_FORMAT_SQL: '/api/ittools/v1/web/sql/format',

  // ===========================
  // ITTools Web
  // ===========================
  ITTOOLS_WEB_MARKDOWN_HTML: '/api/ittools/v1/web/markdown/to-html',

  // ===========================
  // ITTools Image Processing
  // ===========================
  ITTOOLS_IMAGE_COMPRESS: '/api/ittools/v1/advanced/image/compress',
  ITTOOLS_IMAGE_CROP: '/api/ittools/v1/advanced/image/crop',

  // ===========================
  // ITTools PDF Processing
  // ===========================
  ITTOOLS_PDF_SPLIT: '/api/ittools/v1/advanced/pdf/split',

  // ===========================
  // Clipboard Module
  // ===========================
  CLIPBOARD_NAMESPACE: '/clipboard/namespace',
  CLIPBOARD_DATA: '/clipboard/data',
  CLIPBOARD_TEXT: '/clipboard/text',
  CLIPBOARD_UPLOAD: '/clipboard/upload',
  CLIPBOARD_DELETE_FILE: '/clipboard/delete-file',
  CLIPBOARD_NEW: '/clipboard/new',
  CLIPBOARD_RESTORE: '/clipboard/restore',

  // ===========================
  // TTS (Text-to-Speech)
  // ===========================
  TTS_GENERATE: '/tts/generate',

  // ===========================
  // Translation Services
  // ===========================
  TRANSLATION_GOOGLE: '/translation/simple/google',
} as const

export type ApiEndpointKey = keyof typeof API_ENDPOINTS

// Helper function to build full URL with base (supports both {param} and :param patterns)
export function buildApiUrl(key: ApiEndpointKey, pathParams?: Record<string, string | number>): string {
  let endpoint = API_ENDPOINTS[key]

  if (pathParams) {
    Object.entries(pathParams).forEach(([param, value]) => {
      // Support both {param} and :param patterns
      endpoint = endpoint.replace(`{${param}}`, String(value))
      endpoint = endpoint.replace(`:${param}`, String(value))
    })
  }

  return `${API_BASE_URL}${endpoint}`
}

// Global API headers configuration (Real data validated: 2025-12-04)
export const API_HEADERS = {
  DEFAULT: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  AUTH_REQUIRED: {
    'Authorization': 'Bearer {token}', // Replaced at runtime
  },
  CLIENT_TOKEN: {
    'Client-Token': '{clientToken}', // Replaced at runtime
  },
  DEBUG: {
    'Auth-Debug-Token': '{debugToken}', // For development only
  },
} as const
