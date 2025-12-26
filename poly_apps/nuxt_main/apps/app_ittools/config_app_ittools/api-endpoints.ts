// Unified API Endpoints Configuration
// All API endpoints centrally managed, use key reference only

export const API_ENDPOINTS = {
  // System API
  API_INFO: '/api_info',
  CSRF_TOKEN: '/csrf-token',
  API_HEADERS_CACHE_SAVE: '/api_headers_cache/save',
  API_HEADERS_CACHE_RESET: '/api_headers_cache/reset',
  API_PARAMS_CACHE_SAVE: '/api_params_cache/save',
  API_PARAMS_CACHE_LOAD: '/api_params_cache/load',

  // ITTools Crypto
  ITTOOLS_CRYPTO_BCRYPT_HASH: '/api/ittools/v1/crypto/bcrypt/hash',
  ITTOOLS_CRYPTO_BCRYPT_VERIFY: '/api/ittools/v1/crypto/bcrypt/verify',
  ITTOOLS_CRYPTO_ULID_GENERATE: '/api/ittools/v1/crypto/ulid/generate',
  ITTOOLS_CRYPTO_BIP39_GENERATE: '/api/ittools/v1/crypto/bip39/generate',

  // ITTools Converters
  ITTOOLS_CONVERTER_JSON_YAML: '/api/ittools/v1/converter/json-to-yaml',
  ITTOOLS_CONVERTER_YAML_JSON: '/api/ittools/v1/converter/yaml-to-json',

  // ITTools Formatters
  ITTOOLS_FORMAT_XML: '/api/ittools/v1/web/xml/format',
  ITTOOLS_FORMAT_YAML: '/api/ittools/v1/web/yaml/format',
  ITTOOLS_FORMAT_SQL: '/api/ittools/v1/web/sql/format',

  // ITTools Web
  ITTOOLS_WEB_MARKDOWN_HTML: '/api/ittools/v1/web/markdown/to-html',

  // ITTools Image
  ITTOOLS_IMAGE_COMPRESS: '/api/ittools/v1/advanced/image/compress',
  ITTOOLS_IMAGE_CROP: '/api/ittools/v1/advanced/image/crop',

  // ITTools PDF
  ITTOOLS_PDF_SPLIT: '/api/ittools/v1/advanced/pdf/split',

  // Clipboard
  CLIPBOARD_NAMESPACE: '/clipboard/namespace',
  CLIPBOARD_DATA: '/clipboard/data',
  CLIPBOARD_TEXT: '/clipboard/text',
  CLIPBOARD_UPLOAD: '/clipboard/upload',
  CLIPBOARD_DELETE_FILE: '/clipboard/delete-file',
  CLIPBOARD_NEW: '/clipboard/new',
  CLIPBOARD_RESTORE: '/clipboard/restore',

  // MCP Task Dispatch
  MCP_TASK_CATEGORIES_FILES: '/api/mcp/v1/task-dispatch/categories',
  MCP_TASK_QUEUE_ADD: '/api/mcp/v1/task-dispatch/queue/add-file',

  // Code Browser
  CODE_BROWSER_READ_FILE: '/code-browser/read-file',
  CODE_BROWSER_SAVE_FILE: '/code-browser/save-file',
  CODE_BROWSER_DELETE_FILE: '/code-browser/delete-file',
  CODE_BROWSER_PROMPTS_TRANSLATE_LINE: '/code-browser/prompts/translate-line',
  CODE_BROWSER_PROMPTS_TRANSLATE_NAME: '/code-browser/prompts/translate-name',
  CODE_BROWSER_PROMPTS_CREATE: '/code-browser/prompts/create',

  // Static Resources
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

  // TTS
  TTS_GENERATE: '/tts/generate',

  // Translation
  TRANSLATION_GOOGLE: '/translation/simple/google'
} as const;

export type ApiEndpointKey = keyof typeof API_ENDPOINTS;

// Helper function to build URL with params
export const buildApiUrl = (
  key: ApiEndpointKey,
  params?: Record<string, string | number>
): string => {
  let url = API_ENDPOINTS[key];

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, String(value));
    });
  }

  return url;
};
