# 前端API端点修正清单

> **修正文件**: `services/endpoints.ts`
> **问题**: 前端定义的API端点路径与后端实际路径不匹配

## 🔧 需要修改的端点

### 修改 `services/endpoints.ts`:

```typescript
export const API_ENDPOINTS = {
  // ===========================
  // Dashboard API
  // ===========================
  // ❌ DASHBOARD_OVERVIEW: '/api/dashboard/overview',
  // ❌ DASHBOARD_METRICS: '/api/dashboard/metrics',
  ✅ DASHBOARD_OVERVIEW: '/api/manage/status',        // 改用系统状态
  ✅ DASHBOARD_METRICS: '/api/manage/status',         // 前端轮询或后端实现

  // ===========================
  // System Management API
  // ===========================
  // ❌ SYSTEM_STATUS: '/api/system/status',
  // ❌ SYSTEM_CONFIG: '/api/system/config',
  // ❌ SYSTEM_CONFIG_UPDATE: '/api/system/config',
  ✅ SYSTEM_STATUS: '/api/manage/status',
  ✅ SYSTEM_CONFIG: '/api/manage/config',
  ✅ SYSTEM_CONFIG_UPDATE: '/api/manage/config',

  // ===========================
  // Local Processing API
  // ===========================
  // ❌ LOCAL_CAPABILITIES: '/api/local/capabilities',
  // ❌ LOCAL_CONFIG: '/api/local/config',
  // ❌ LOCAL_CONFIG_UPDATE: '/api/local/config',
  // ❌ LOCAL_STATS: '/api/local/stats',
  // ❌ LOCAL_TEST: '/api/local/test',
  ✅ LOCAL_CAPABILITIES: '/api/manage/local/capabilities',
  ✅ LOCAL_CONFIG: '/api/manage/local/config',
  ✅ LOCAL_CONFIG_UPDATE: '/api/manage/local/config',
  ✅ LOCAL_STATS: '/api/manage/local/stats',
  ✅ LOCAL_TEST: '/api/manage/local/test',

  // ===========================
  // Tools API
  // ===========================
  // ❌ TOOL_SCREENSHOT: '/api/tools/screenshot',
  // ❌ TOOL_OCR: '/api/tools/ocr',
  ✅ TOOL_SCREENSHOT: '/api/local/screenshot/capture',
  ✅ TOOL_OCR: '/api/local/image/ocr',
  TOOL_AUDIO_TRANSCRIBE: '/api/local/audio/transcribe',  // ✅ 已正确
  TOOL_VIDEO_PROCESS: '/api/local/video/process',        // ✅ 已正确
  TOOL_FILE_ANALYZE: '/api/local/file/analyze',          // ✅ 已正确

  // ===========================
  // Upload API
  // ===========================
  UPLOAD_TASKS: '/api/upload/tasks',      // ✅ 已正确
  UPLOAD_HISTORY: '/api/upload/history',  // ⚠️ 后端未实现
  UPLOAD_SERVERS: '/api/upload/servers',  // ✅ 已正确

  // ===========================
  // Remote Servers API
  // ===========================
  // ❌ REMOTE_SERVERS: '/api/remote/servers',
  ✅ REMOTE_SERVERS: '/api/client/connection-status',

  // ===========================
  // Logs API
  // ===========================
  // ❌ LOGS: '/api/logs',
  ✅ LOGS: '/api/manage/logs',

  // ===========================
  // Statistics API (⚠️ 后端未实现)
  // ===========================
  // ⚠️ STATS_PERFORMANCE: '/api/stats/performance',
  // ⚠️ STATS_TRENDS: '/api/stats/trends',
  // ⚠️ STATS_RESOURCES: '/api/stats/resources',
  // 临时方案：使用现有端点代替
  ✅ STATS_PERFORMANCE: '/api/manage/status',
  ✅ STATS_TRENDS: '/api/manage/local/stats',
  ✅ STATS_RESOURCES: '/api/manage/status',
};
```

## 📋 修改后的完整文件

```typescript
export const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL as string) || 'http://localhost:59000';

export const API_ENDPOINTS = {
  // Dashboard
  DASHBOARD_OVERVIEW: '/api/manage/status',
  DASHBOARD_METRICS: '/api/manage/status',

  // System Management
  SYSTEM_STATUS: '/api/manage/status',
  SYSTEM_CONFIG: '/api/manage/config',
  SYSTEM_CONFIG_UPDATE: '/api/manage/config',

  // Local Processing
  LOCAL_CAPABILITIES: '/api/manage/local/capabilities',
  LOCAL_CONFIG: '/api/manage/local/config',
  LOCAL_CONFIG_UPDATE: '/api/manage/local/config',
  LOCAL_STATS: '/api/manage/local/stats',
  LOCAL_TEST: '/api/manage/local/test',

  // Tools
  TOOL_SCREENSHOT: '/api/local/screenshot/capture',
  TOOL_OCR: '/api/local/image/ocr',
  TOOL_AUDIO_TRANSCRIBE: '/api/local/audio/transcribe',
  TOOL_VIDEO_PROCESS: '/api/local/video/process',
  TOOL_FILE_ANALYZE: '/api/local/file/analyze',

  // Upload
  UPLOAD_TASKS: '/api/upload/tasks',
  UPLOAD_HISTORY: '/api/upload/history',  // ⚠️ 后端需实现
  UPLOAD_SERVERS: '/api/upload/servers',

  // Remote
  REMOTE_SERVERS: '/api/client/connection-status',

  // Logs
  LOGS: '/api/manage/logs',

  // Statistics (使用现有端点代替)
  STATS_PERFORMANCE: '/api/manage/status',
  STATS_TRENDS: '/api/manage/local/stats',
  STATS_RESOURCES: '/api/manage/status',
};
```

## ✅ 修改后立即可用

修改此文件后，前端应该可以正常连接后端API。

## ⚠️ 后端需要补充的端点

1. `/api/upload/history` - 上传历史记录
2. `/api/manage/dashboard/*` - Dashboard专用端点（可选，当前用status代替）
3. `/api/stats/*` - 统计专用端点（可选，当前用现有端点代替）
