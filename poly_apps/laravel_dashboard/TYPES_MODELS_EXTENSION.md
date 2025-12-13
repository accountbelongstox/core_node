# TypeScript 类型模型扩展文档

## 概述

本文档详细定义了 Laravel Dashboard 缺失的 TypeScript 类型模型，包括所有新模块所需的接口、枚举和类型定义。

---

## 1. ViewType 枚举扩展

### 当前定义 (`types.ts`)
```typescript
export enum ViewType {
  DASHBOARD = 'dashboard',
  MEDIA_BROWSER = 'media',
  CODE_BROWSER = 'code',
  TOOLS = 'tools',
  API_TESTER = 'api',
  SETTINGS = 'settings'
}
```

### 需要添加
```typescript
export enum ViewType {
  DASHBOARD = 'dashboard',
  MEDIA_BROWSER = 'media',
  CODE_BROWSER = 'code',
  TOOLS = 'tools',
  API_TESTER = 'api',
  SETTINGS = 'settings',
  // ⬇️ 新增模块
  SYSTEM_INFO = 'system',
  VOCABULARY = 'vocabulary',
  MCP_MANAGER = 'mcp',
  OCTANE_TASKS = 'octane'
}
```

---

## 2. System Information 模块类型

### SystemInfo 相关接口

```typescript
// 系统信息主接口
export interface SystemInfo {
  server: ServerInfo;
  php: PhpInfo;
  laravel: LaravelInfo;
  database: DatabaseInfo;
  cache: CacheInfo;
  queue: QueueInfo;
  environment: EnvironmentInfo;
  routes: RouteInfo[];
  timestamp: string;
}

// 服务器信息
export interface ServerInfo {
  os: string;
  architecture: string;
  hostname: string;
  server_software: string;
  server_protocol: string;
  document_root: string;
  server_admin?: string;
  server_signature?: string;
}

// PHP 信息
export interface PhpInfo {
  version: string;
  extensions: string[];
  memory_limit: string;
  max_execution_time: string;
  upload_max_filesize: string;
  post_max_size: string;
  display_errors: boolean;
  error_reporting: string;
  timezone: string;
}

// Laravel 信息
export interface LaravelInfo {
  version: string;
  environment: string;
  debug_mode: boolean;
  app_url: string;
  app_name: string;
  timezone: string;
  locale: string;
  fallback_locale: string;
  config_cached: boolean;
  routes_cached: boolean;
  events_cached: boolean;
  views_cached: boolean;
}

// 数据库信息
export interface DatabaseInfo {
  default_connection: string;
  connections: DatabaseConnection[];
}

export interface DatabaseConnection {
  name: string;
  driver: string;
  host: string;
  port: number;
  database: string;
  username: string;
  prefix?: string;
  charset?: string;
  collation?: string;
  connected: boolean;
}

// 缓存信息
export interface CacheInfo {
  default_driver: string;
  stores: CacheStore[];
}

export interface CacheStore {
  name: string;
  driver: string;
  connection?: string;
  available: boolean;
}

// 队列信息
export interface QueueInfo {
  default_connection: string;
  connections: QueueConnection[];
}

export interface QueueConnection {
  name: string;
  driver: string;
  queue?: string;
  retry_after?: number;
  running: boolean;
}

// 环境变量信息
export interface EnvironmentInfo {
  app_env: string;
  app_debug: boolean;
  app_key_set: boolean;
  [key: string]: any;
}

// 路由信息
export interface RouteInfo {
  method: string;
  uri: string;
  name?: string;
  action: string;
  middleware: string[];
}
```

---

## 3. Vocabulary Learning 模块类型

### Translation 相关接口

```typescript
// 翻译请求
export interface TranslationRequest {
  text: string;
  source_language?: string;
  target_language: string;
  type?: TranslationType;
}

// 翻译类型
export type TranslationType = 'general' | 'learning' | 'technical' | 'casual';

// 翻译响应
export interface TranslationResponse {
  original_text: string;
  translated_text: string;
  source_language: string;
  target_language: string;
  detected_language?: string;
  confidence?: number;
  alternatives?: string[];
  phonetic?: string;
  provider?: string;
}

// 批量翻译请求
export interface BatchTranslationRequest {
  texts: string[];
  source_language?: string;
  target_language: string;
  type?: TranslationType;
}

// 批量翻译响应
export interface BatchTranslationResponse {
  translations: TranslationResponse[];
  total_count: number;
  success_count: number;
  failed_count: number;
}

// 语言检测响应
export interface LanguageDetectionResponse {
  detected_language: string;
  confidence: number;
  all_detections: Array<{
    language: string;
    confidence: number;
  }>;
}

// 语言信息
export interface Language {
  code: string;
  name: string;
  native_name: string;
  direction?: 'ltr' | 'rtl';
  supported?: boolean;
}

// 翻译模板
export interface TranslationTemplate {
  id: string;
  name: string;
  source_language: string;
  target_language: string;
  phrases: TranslationPhrase[];
}

export interface TranslationPhrase {
  original: string;
  translated: string;
  category?: string;
  notes?: string;
}
```

### TTS (Text-to-Speech) 相关接口

```typescript
// TTS 生成请求
export interface TTSGenerateRequest {
  text: string;
  language: string;
  voice_type?: string;
  speed?: number; // 0.5 - 2.0
  pitch?: number; // 0.5 - 2.0
  volume?: number; // 0.0 - 1.0
}

// TTS 生成响应
export interface TTSGenerateResponse {
  audio_url: string;
  duration: number; // seconds
  format: string; // mp3, wav, etc.
  file_size: number; // bytes
  text: string;
  language: string;
  voice_type: string;
  cache_hit: boolean;
}

// 批量 TTS 请求
export interface BatchTTSRequest {
  items: Array<{
    text: string;
    language: string;
    voice_type?: string;
  }>;
  speed?: number;
}

// 批量 TTS 响应
export interface BatchTTSResponse {
  results: TTSGenerateResponse[];
  total_count: number;
  success_count: number;
  failed_count: number;
}

// TTS 检查请求
export interface TTSCheckRequest {
  text: string;
  language: string;
  voice_type?: string;
}

// TTS 检查响应
export interface TTSCheckResponse {
  exists: boolean;
  audio_url?: string;
  duration?: number;
  cached_at?: string;
}

// 语音配置
export interface VoiceConfig {
  language: string;
  voice_type: string;
  name: string;
  gender?: 'male' | 'female' | 'neutral';
  locale: string;
  sample_url?: string;
}

// TTS 缓存统计
export interface TTSCacheStats {
  total_files: number;
  total_size: number; // bytes
  languages: Array<{
    language: string;
    count: number;
    size: number;
  }>;
  oldest_file?: string;
  newest_file?: string;
}
```

### Vocabulary Learning 特定类型

```typescript
// 学习任务
export interface VocabularyTask {
  id: string;
  title: string;
  description?: string;
  words: VocabularyWord[];
  status: 'pending' | 'in_progress' | 'completed';
  progress: number; // 0-100
  created_at: string;
  updated_at: string;
}

// 词汇条目
export interface VocabularyWord {
  id: string;
  word: string;
  translation: string;
  phonetic?: string;
  part_of_speech?: string;
  definition?: string;
  example_sentences?: string[];
  audio_url?: string;
  learned: boolean;
  proficiency?: number; // 0-100
}

// 学习会话
export interface LearningSession {
  id: string;
  task_id: string;
  started_at: string;
  ended_at?: string;
  words_reviewed: number;
  correct_answers: number;
  incorrect_answers: number;
  accuracy: number; // percentage
}
```

---

## 4. MCP Manager 模块类型

### Screenshot Management

```typescript
// 截图信息（已存在，需扩展）
export interface Screenshot {
  id: string;
  file_path: string;
  original_name: string;
  mime_type: string;
  description?: string;
  created_at: string;
  // ⬇️ 新增字段
  file_size?: number;
  width?: number;
  height?: number;
  thumbnail_url?: string;
  tags?: string[];
  metadata?: ScreenshotMetadata;
}

export interface ScreenshotMetadata {
  device?: string;
  browser?: string;
  viewport?: {
    width: number;
    height: number;
  };
  url?: string;
  title?: string;
  [key: string]: any;
}

// 截图上传请求
export interface ScreenshotUploadRequest {
  image: File;
  description?: string;
  tags?: string[];
  metadata?: ScreenshotMetadata;
}

// 截图上传响应
export interface ScreenshotUploadResponse {
  success: boolean;
  screenshot: Screenshot;
  message?: string;
}

// 批量上传响应
export interface BatchScreenshotUploadResponse {
  success: boolean;
  screenshots: Screenshot[];
  total_count: number;
  success_count: number;
  failed_count: number;
  errors?: Array<{
    filename: string;
    error: string;
  }>;
}

// 截图搜索请求
export interface ScreenshotSearchRequest {
  keyword?: string;
  tags?: string[];
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

// 截图搜索响应
export interface ScreenshotSearchResponse {
  screenshots: Screenshot[];
  total_count: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// 截图统计
export interface ScreenshotStats {
  total_count: number;
  total_size: number; // bytes
  today_count: number;
  week_count: number;
  month_count: number;
  by_mime_type: Array<{
    mime_type: string;
    count: number;
  }>;
  recent_uploads: Screenshot[];
}
```

### Task Dispatch System

```typescript
// 任务类别
export interface TaskCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  file_count: number;
  created_at: string;
}

// 任务分发条目
export interface DispatchTask {
  id: string;
  category_id: string;
  file_path: string;
  original_name: string;
  content?: string;
  status: TaskStatus;
  priority?: number;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  metadata?: TaskMetadata;
}

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface TaskMetadata {
  file_size?: number;
  file_type?: string;
  source?: string;
  notes?: string;
  [key: string]: any;
}

// 添加任务请求
export interface AddTaskRequest {
  category_id: string;
  content: string;
  file_name?: string;
  priority?: number;
  metadata?: TaskMetadata;
}

// 任务队列统计
export interface TaskQueueStats {
  category_id: string;
  total_tasks: number;
  pending_tasks: number;
  processing_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  average_completion_time?: number; // seconds
  oldest_pending_task?: DispatchTask;
}

// 任务搜索请求
export interface TaskSearchRequest {
  category_id?: string;
  status?: TaskStatus;
  keyword?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

// 任务搜索响应
export interface TaskSearchResponse {
  tasks: DispatchTask[];
  total_count: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// 提示词映射
export interface PromptMapping {
  category_id: string;
  prompt_file_path: string;
  prompt_content?: string;
  variables?: Array<{
    name: string;
    description?: string;
    default_value?: string;
  }>;
  created_at: string;
  updated_at: string;
}

// 更新提示词映射请求
export interface UpdatePromptMappingRequest {
  category_id: string;
  prompt_file_path: string;
  prompt_content?: string;
}
```

### Placeholder Generator

```typescript
// 占位图生成请求
export interface PlaceholderGenerateRequest {
  width: number;
  height: number;
  text?: string;
  bg_color?: string; // hex color
  text_color?: string; // hex color
  format?: 'png' | 'jpg' | 'svg' | 'webp';
  mode?: 'simple' | 'real';
}

// 占位图响应
export interface PlaceholderResponse {
  uuid: string;
  url: string;
  download_url: string;
  width: number;
  height: number;
  format: string;
  file_size: number;
  text?: string;
  created_at: string;
  expires_at?: string;
}

// 占位图列表项
export interface PlaceholderItem {
  uuid: string;
  width: number;
  height: number;
  text?: string;
  format: string;
  file_size: number;
  file_path: string;
  created_at: string;
}

// 占位图统计
export interface PlaceholderStats {
  total_count: number;
  total_size: number; // bytes
  by_format: Array<{
    format: string;
    count: number;
    size: number;
  }>;
  by_dimensions: Array<{
    dimensions: string; // e.g. "1920x1080"
    count: number;
  }>;
}

// 占位图清理响应
export interface PlaceholderCleanupResponse {
  deleted_count: number;
  freed_space: number; // bytes
  oldest_kept?: string;
}
```

### Voice Subtitle System

```typescript
// 语音字幕队列项
export interface VoiceQueueItem {
  id: string;
  type: 'text' | 'url' | 'voice';
  content: string;
  language: string;
  status: 'queued' | 'processing' | 'playing' | 'completed' | 'error';
  audio_url?: string;
  subtitle_segments?: SubtitleSegment[];
  duration?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// 字幕片段
export interface SubtitleSegment {
  id: string;
  start_time: number; // seconds
  end_time: number; // seconds
  text: string;
  translation?: string;
  active?: boolean;
}

// 当前播放信息
export interface CurrentVoiceTrack {
  queue_item: VoiceQueueItem;
  current_time: number;
  total_duration: number;
  is_playing: boolean;
  current_segment?: SubtitleSegment;
}

// 添加到语音队列请求
export interface AddVoiceQueueRequest {
  type: 'text' | 'url' | 'voice';
  content: string;
  language?: string;
  auto_play?: boolean;
}
```

---

## 5. Octane Timer Tasks 模块类型

```typescript
// Octane 任务状态
export interface OctaneTasksStatus {
  timer_enabled: boolean;
  timer_running: boolean;
  total_tasks: number;
  running_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  total_ticks: number;
  uptime: number; // seconds
  last_tick_at?: string;
  next_tick_at?: string;
}

// 单个 Octane 任务详情
export interface OctaneTask {
  name: string;
  class: string;
  status: OctaneTaskStatus;
  schedule: string; // cron expression or interval
  last_run_at?: string;
  next_run_at?: string;
  run_count: number;
  success_count: number;
  failure_count: number;
  average_duration?: number; // milliseconds
  last_duration?: number; // milliseconds
  last_error?: string;
  enabled: boolean;
  metadata?: OctaneTaskMetadata;
}

export type OctaneTaskStatus = 'idle' | 'running' | 'completed' | 'failed' | 'disabled';

export interface OctaneTaskMetadata {
  description?: string;
  priority?: number;
  timeout?: number; // seconds
  retry_on_failure?: boolean;
  max_retries?: number;
  [key: string]: any;
}

// Octane 任务运行记录
export interface OctaneTaskRun {
  id: string;
  task_name: string;
  started_at: string;
  completed_at?: string;
  duration?: number; // milliseconds
  status: 'success' | 'failure';
  output?: string;
  error?: string;
  memory_usage?: number; // bytes
  cpu_usage?: number; // percentage
}

// Octane 心跳信息
export interface OctaneHeartbeat {
  alive: boolean;
  last_beat_at: string;
  interval: number; // seconds
  missed_beats: number;
  healthy: boolean;
}

// Octane 基础对象信息
export interface OctaneBasicObjects {
  workers: number;
  max_requests: number;
  memory_limit: string;
  task_instances: Array<{
    name: string;
    initialized: boolean;
    class: string;
  }>;
}

// Octane 初始化验证
export interface OctaneInitVerification {
  initialized: boolean;
  timer_registered: boolean;
  tasks_loaded: number;
  errors: string[];
  warnings: string[];
}
```

---

## 6. Clipboard 模块类型（扩展）

```typescript
// Clipboard 数据（已存在，需扩展）
export interface ClipboardData {
  text: string;
  files: ClipboardFile[];
  updated_at: string;
  // ⬇️ 新增字段
  namespace: string;
  history?: ClipboardHistory[];
  file_count: number;
  total_size: number; // bytes
}

export interface ClipboardFile {
  id: string;
  original_name: string;
  size: number;
  // ⬇️ 新增字段
  mime_type?: string;
  file_path?: string;
  uploaded_at?: string;
  download_url?: string;
}

// Clipboard 历史记录
export interface ClipboardHistory {
  id: string;
  timestamp: string;
  text: string;
  file_count: number;
}

// 创建 Namespace 响应
export interface ClipboardNamespaceResponse {
  namespace: string;
  created_at: string;
  expires_at?: string;
}

// Clipboard 上传响应
export interface ClipboardUploadResponse {
  success: boolean;
  files: ClipboardFile[];
  message?: string;
}

// Clipboard 恢复请求
export interface ClipboardRestoreRequest {
  namespace: string;
  history_id: string;
}
```

---

## 7. 通用 API 响应类型扩展

```typescript
// API 响应（已存在，需扩展）
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
  latency?: number;
  dataSource?: 'cloud' | 'mock';
  // ⬇️ 新增字段
  message?: string;
  metadata?: ResponseMetadata;
  pagination?: PaginationInfo;
}

export interface ResponseMetadata {
  timestamp: string;
  request_id?: string;
  api_version?: string;
  [key: string]: any;
}

export interface PaginationInfo {
  current_page: number;
  per_page: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
}

// 错误响应
export interface ErrorResponse {
  success: false;
  error: string;
  error_code?: string;
  error_details?: any;
  validation_errors?: ValidationError[];
  statusCode: number;
}

export interface ValidationError {
  field: string;
  message: string;
  rule?: string;
}

// 上传进度
export interface UploadProgress {
  loaded: number; // bytes
  total: number; // bytes
  percentage: number; // 0-100
  speed?: number; // bytes per second
  remaining_time?: number; // seconds
}

// 批量操作响应基类
export interface BatchOperationResponse<T = any> {
  total_count: number;
  success_count: number;
  failed_count: number;
  results: T[];
  errors?: Array<{
    index: number;
    error: string;
  }>;
}
```

---

## 8. UI 状态管理类型

```typescript
// 加载状态
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: LoadingState;
}

// 模态框状态
export interface ModalState {
  isOpen: boolean;
  title?: string;
  content?: React.ReactNode;
  onClose?: () => void;
  onConfirm?: () => void;
}

// 通知消息
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  description?: string;
  duration?: number; // milliseconds
  closable?: boolean;
}

// 过滤器状态
export interface FilterState {
  search?: string;
  status?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  tags?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 表格列配置
export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: keyof T;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, record: T, index: number) => React.ReactNode;
}

// 表格状态
export interface TableState<T = any> {
  data: T[];
  loading: boolean;
  pagination: PaginationInfo;
  filters: FilterState;
  selectedRows: T[];
}
```

---

## 9. 工具相关类型扩展

```typescript
// 工具历史记录
export interface ToolHistory {
  id: string;
  tool_id: string;
  tool_name: string;
  timestamp: string;
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
}

// 工具收藏
export interface ToolFavorite {
  tool_id: string;
  added_at: string;
  custom_name?: string;
  notes?: string;
}

// 工具使用统计
export interface ToolUsageStats {
  tool_id: string;
  tool_name: string;
  usage_count: number;
  last_used_at?: string;
  average_execution_time?: number; // milliseconds
  success_rate?: number; // percentage
}
```

---

## 10. 完整类型导出清单

### 需要添加到 `types.ts` 的所有新类型

```typescript
// ============================================
// 文件: types.ts (新增部分)
// ============================================

// ViewType 扩展
export enum ViewType {
  // ... 现有类型
  SYSTEM_INFO = 'system',
  VOCABULARY = 'vocabulary',
  MCP_MANAGER = 'mcp',
  OCTANE_TASKS = 'octane'
}

// ========== System Information ==========
export interface SystemInfo { ... }
export interface ServerInfo { ... }
export interface PhpInfo { ... }
export interface LaravelInfo { ... }
export interface DatabaseInfo { ... }
export interface DatabaseConnection { ... }
export interface CacheInfo { ... }
export interface CacheStore { ... }
export interface QueueInfo { ... }
export interface QueueConnection { ... }
export interface EnvironmentInfo { ... }
export interface RouteInfo { ... }

// ========== Vocabulary Learning ==========
export interface TranslationRequest { ... }
export type TranslationType = 'general' | 'learning' | 'technical' | 'casual';
export interface TranslationResponse { ... }
export interface BatchTranslationRequest { ... }
export interface BatchTranslationResponse { ... }
export interface LanguageDetectionResponse { ... }
export interface Language { ... }
export interface TranslationTemplate { ... }
export interface TranslationPhrase { ... }
export interface TTSGenerateRequest { ... }
export interface TTSGenerateResponse { ... }
export interface BatchTTSRequest { ... }
export interface BatchTTSResponse { ... }
export interface TTSCheckRequest { ... }
export interface TTSCheckResponse { ... }
export interface VoiceConfig { ... }
export interface TTSCacheStats { ... }
export interface VocabularyTask { ... }
export interface VocabularyWord { ... }
export interface LearningSession { ... }

// ========== MCP Manager ==========
// Screenshot (扩展现有)
export interface Screenshot { ... }
export interface ScreenshotMetadata { ... }
export interface ScreenshotUploadRequest { ... }
export interface ScreenshotUploadResponse { ... }
export interface BatchScreenshotUploadResponse { ... }
export interface ScreenshotSearchRequest { ... }
export interface ScreenshotSearchResponse { ... }
export interface ScreenshotStats { ... }

// Task Dispatch
export interface TaskCategory { ... }
export interface DispatchTask { ... }
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
export interface TaskMetadata { ... }
export interface AddTaskRequest { ... }
export interface TaskQueueStats { ... }
export interface TaskSearchRequest { ... }
export interface TaskSearchResponse { ... }
export interface PromptMapping { ... }
export interface UpdatePromptMappingRequest { ... }

// Placeholder
export interface PlaceholderGenerateRequest { ... }
export interface PlaceholderResponse { ... }
export interface PlaceholderItem { ... }
export interface PlaceholderStats { ... }
export interface PlaceholderCleanupResponse { ... }

// Voice Subtitle
export interface VoiceQueueItem { ... }
export interface SubtitleSegment { ... }
export interface CurrentVoiceTrack { ... }
export interface AddVoiceQueueRequest { ... }

// ========== Octane Tasks ==========
export interface OctaneTasksStatus { ... }
export interface OctaneTask { ... }
export type OctaneTaskStatus = 'idle' | 'running' | 'completed' | 'failed' | 'disabled';
export interface OctaneTaskMetadata { ... }
export interface OctaneTaskRun { ... }
export interface OctaneHeartbeat { ... }
export interface OctaneBasicObjects { ... }
export interface OctaneInitVerification { ... }

// ========== Clipboard (扩展) ==========
export interface ClipboardData { ... }
export interface ClipboardFile { ... }
export interface ClipboardHistory { ... }
export interface ClipboardNamespaceResponse { ... }
export interface ClipboardUploadResponse { ... }
export interface ClipboardRestoreRequest { ... }

// ========== 通用类型扩展 ==========
export interface ApiResponse<T> { ... }
export interface ResponseMetadata { ... }
export interface PaginationInfo { ... }
export interface ErrorResponse { ... }
export interface ValidationError { ... }
export interface UploadProgress { ... }
export interface BatchOperationResponse<T> { ... }

// ========== UI 状态 ==========
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
export interface AsyncState<T> { ... }
export interface ModalState { ... }
export interface Notification { ... }
export interface FilterState { ... }
export interface TableColumn<T> { ... }
export interface TableState<T> { ... }

// ========== 工具扩展 ==========
export interface ToolHistory { ... }
export interface ToolFavorite { ... }
export interface ToolUsageStats { ... }
```

---

## 总结

本文档定义了 **100+ 新的 TypeScript 接口和类型**，涵盖：

- ✅ System Information (12 个类型)
- ✅ Vocabulary Learning (18 个类型)
- ✅ MCP Manager (30+ 个类型)
- ✅ Octane Tasks (9 个类型)
- ✅ Clipboard 扩展 (6 个类型)
- ✅ 通用 API 响应 (8 个类型)
- ✅ UI 状态管理 (7 个类型)
- ✅ 工具系统扩展 (3 个类型)

**下一步**: 查看 API 端点详细文档和 UI 组件规范文档。
