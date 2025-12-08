/**
 * 统一 API 端点配置中心
 * 
 * 职责：
 * - 管理所有 API 端点路径
 * - 确保端点路径的一致性
 * - 支持环境变量配置
 * 
 * 使用原则：
 * - 所有 API 端点必须通过此文件定义
 * - 禁止在代码中硬编码端点路径
 * - 端点路径遵循 RESTful 规范
 */

// API 基础 URL，从环境变量读取，默认使用本地开发地址
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:59000';

/**
 * API 端点配置
 * 按照功能模块分组，便于管理和维护
 */
export const API_ENDPOINTS = {
  // ===========================
  // Dashboard API (Management)
  // ===========================
  DASHBOARD_OVERVIEW: '/api/manage/dashboard/overview',
  DASHBOARD_METRICS: '/api/manage/dashboard/realtime',

  // ===========================
  // System Management API
  // ===========================
  SYSTEM_STATUS: '/api/manage/status',
  SYSTEM_CONFIG: '/api/manage/config',
  SYSTEM_CONFIG_UPDATE: '/api/manage/config',
  SYSTEM_CONTROL_RESTART: '/api/manage/control/restart',
  SYSTEM_CONTROL_STOP: '/api/manage/control/stop',
  SYSTEM_CONTROL_RELOAD: '/api/manage/control/reload-config',
  SYSTEM_CONTROL_CLEAR_CACHE: '/api/manage/control/clear-cache',

  // ===========================
  // Local Processing API
  // ===========================
  LOCAL_CAPABILITIES: '/api/manage/local/capabilities',
  LOCAL_CONFIG: '/api/manage/local/config',
  LOCAL_CONFIG_UPDATE: '/api/manage/local/config',
  LOCAL_STATS: '/api/manage/local/stats',
  LOCAL_TEST: '/api/manage/local/test',

  // ===========================
  // Tools API (Local Processing)
  // ===========================
  // Screenshot
  TOOL_SCREENSHOT: '/api/local/screenshot/capture',
  TOOL_SCREENSHOT_OCR: '/api/local/screenshot/ocr',
  TOOL_SCREENSHOT_UPLOAD: '/api/local/screenshot/upload',
  
  // Image Processing
  TOOL_IMAGE_OCR: '/api/local/image/ocr',
  TOOL_IMAGE_COMPRESS: '/api/local/image/compress',
  TOOL_IMAGE_PROCESS_UPLOAD: '/api/local/image/process-upload',
  
  // Audio Processing
  TOOL_AUDIO_TRANSCRIBE: '/api/local/audio/transcribe',
  TOOL_AUDIO_SUBTITLE: '/api/local/audio/generate-subtitle',
  TOOL_AUDIO_PROCESS_UPLOAD: '/api/local/audio/process-upload',
  
  // Video Processing
  TOOL_VIDEO_EXTRACT_AUDIO: '/api/local/video/extract-audio',
  TOOL_VIDEO_SUBTITLE: '/api/local/video/generate-subtitle',
  TOOL_VIDEO_PROCESS_UPLOAD: '/api/local/video/process-upload',
  
  // File Processing
  TOOL_FILE_ANALYZE: '/api/local/file/analyze',
  TOOL_FILE_EXTRACT_TEXT: '/api/local/file/extract-text',
  TOOL_FILE_PROCESS_UPLOAD: '/api/local/file/process-upload',

  // ===========================
  // Upload Management API
  // ===========================
  UPLOAD_TASKS: '/api/upload/tasks',
  UPLOAD_PROGRESS: '/api/upload/progress', // {id} 需要动态替换
  UPLOAD_CANCEL: '/api/upload/cancel', // {id} 需要动态替换
  UPLOAD_HISTORY: '/api/upload/history',
  UPLOAD_RESULT: '/api/upload/result',
  UPLOAD_BATCH: '/api/upload/batch',
  UPLOAD_STATS: '/api/upload/stats',
  UPLOAD_SERVERS: '/api/upload/servers',
  UPLOAD_SERVER_ADD: '/api/upload/servers',
  UPLOAD_SERVER_UPDATE: '/api/upload/servers', // {name} 需要动态替换
  UPLOAD_SERVER_DELETE: '/api/upload/servers', // {name} 需要动态替换
  UPLOAD_SERVER_TEST: '/api/upload/servers', // {name}/test 需要动态替换

  // ===========================
  // Remote Client API
  // ===========================
  CLIENT_FORWARD: '/api/client/forward',
  CLIENT_ENCODE_REQUEST: '/api/client/encode-request',
  CLIENT_SERVER_CONFIG: '/api/client/server-config',
  CLIENT_SERVER_CONFIG_ADD: '/api/client/server-config',
  CLIENT_SERVER_CONFIG_UPDATE: '/api/client/server-config', // {name} 需要动态替换
  CLIENT_SERVER_CONFIG_DELETE: '/api/client/server-config', // {name} 需要动态替换
  CLIENT_CONNECTION_STATUS: '/api/client/connection-status',
  CLIENT_TEST_CONNECTION: '/api/client/test-connection', // {name} 需要动态替换

  // ===========================
  // Logs API
  // ===========================
  LOGS: '/api/manage/logs',

  // ===========================
  // Statistics API
  // ===========================
  STATS_PERFORMANCE: '/api/manage/stats/performance',
  STATS_TRENDS: '/api/manage/stats/trends',
  STATS_RESOURCES: '/api/manage/stats/resources',
} as const;

/**
 * 构建完整的 API URL
 * @param endpoint 端点路径
 * @returns 完整的 API URL
 */
export function buildApiUrl(endpoint: string): string {
  return `${API_BASE_URL}${endpoint}`;
}

/**
 * 构建带查询参数的 API URL
 * @param endpoint 端点路径
 * @param params 查询参数对象
 * @returns 完整的 API URL（带查询参数）
 */
export function buildApiUrlWithParams(endpoint: string, params: Record<string, string | number | boolean>): string {
  const url = buildApiUrl(endpoint);
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${url}?${queryString}` : url;
}

