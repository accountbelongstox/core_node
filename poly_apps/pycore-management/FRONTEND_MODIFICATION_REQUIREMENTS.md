<<<<<<< HEAD

=======
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
# Pycore Management 前端修改要求文档

## 📋 文档概述

本文档详细说明 Pycore Management 前端与后端 API 的对接要求，包括缺失的组件、API 集成、类型定义和功能实现。

---

## 🏗️ 当前前端状态分析

### ✅ 已实现
- ✅ 基础框架 (React 19 + Vite + TypeScript)
- ✅ 主应用结构 (App.tsx)
- ✅ 侧边栏菜单组件 (Sidebar.tsx)
- ✅ 响应式布局和顶部导航栏
- ✅ 依赖库安装配置

### ❌ 缺失内容
<<<<<<< HEAD
- ✅ **所有页面组件** (已创建所有页面)
- ✅ **类型定义文件** (types.ts 已包含所有类型)
- ✅ **API 服务层** (api.ts 已实现)
- ✅ **API 配置** (.env.local 已创建)
- ✅ **数据模型** (已在 types.ts 中定义)
- ✅ **工具函数** (formatters.ts, constants.ts 已创建)
=======
- ❌ **所有页面组件** (`pages/` 目录完全缺失)
- ❌ **类型定义文件** (`types.ts` 不存在)
- ❌ **API 服务层** (HTTP 客户端)
- ❌ **API 配置** (.env.local 缺少 API_BASE_URL)
- ❌ **数据模型** (TypeScript interfaces)
- ❌ **工具函数** (日期格式化、错误处理等)
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522

---

## 📂 需要创建的文件结构

```
pycore_management_ui/
├── src/                          # 建议重构到 src/
│   ├── components/               # ✅ 已存在
│   │   └── Sidebar.tsx          # ✅ 已实现
<<<<<<< HEAD
│   ├── pages/                   # ✅ 已创建
│   │   ├── Dashboard.tsx        # ✅ 已实现
│   │   ├── SystemManagement.tsx # ✅ 已实现
│   │   ├── LocalProcessing.tsx  # ✅ 已实现
│   │   ├── UploadTasks.tsx      # ✅ 已实现
│   │   ├── RemoteServers.tsx    # ✅ 已实现
│   │   ├── Logs.tsx             # ✅ 已实现
│   │   └── Tools.tsx            # ✅ 已实现
│   ├── services/                # ✅ 已创建
│   │   └── api.ts               # ✅ 已实现 - API 客户端
│   ├── types/                   # ✅ 已创建
│   │   ├── index.ts             # (合并至 types.ts)
│   │   ├── api.ts               # (合并至 types.ts)
│   │   └── models.ts            # (合并至 types.ts)
│   ├── utils/                   # ✅ 已创建
│   │   ├── formatters.ts        # ✅ 已实现
│   │   └── constants.ts         # ✅ 已实现
=======
│   ├── pages/                   # ❌ 需要创建
│   │   ├── Dashboard.tsx        # ❌ 缺失
│   │   ├── SystemManagement.tsx # ❌ 缺失
│   │   ├── LocalProcessing.tsx  # ❌ 缺失
│   │   ├── UploadTasks.tsx      # ❌ 缺失
│   │   ├── RemoteServers.tsx    # ❌ 缺失
│   │   ├── Logs.tsx             # ❌ 缺失
│   │   └── Tools.tsx            # ❌ 缺失
│   ├── services/                # ❌ 需要创建
│   │   └── api.ts               # ❌ 缺失 - API 客户端
│   ├── types/                   # ❌ 需要创建
│   │   ├── index.ts             # ❌ 缺失 - ViewState 等基础类型
│   │   ├── api.ts               # ❌ 缺失 - API 响应类型
│   │   └── models.ts            # ❌ 缺失 - 数据模型
│   ├── utils/                   # ❌ 需要创建
│   │   ├── formatters.ts        # ❌ 缺失 - 格式化工具
│   │   └── constants.ts         # ❌ 缺失 - 常量定义
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
│   ├── App.tsx                  # ✅ 已实现
│   └── index.tsx                # ✅ 已实现
├── .env.local                   # ⚠️  需要更新
├── package.json                 # ✅ 已实现
└── vite.config.ts              # ✅ 已实现
```

---

## 🔌 后端 API 端点映射

### 1. 管理层 API (8个端点)
<<<<<<< HEAD
(已全部实现)

### 2. 本地处理层 API (5个端点)
(已全部实现)

- 2.1 截图 (`api.tools.captureScreenshot`)
- 2.2 图像 OCR (`api.tools.performOCR`)
- 2.3 音频转录 (`api.tools.transcribeAudio`)
- 2.4 文件分析 (`api.tools.analyzeFile`)
- 2.5 视频处理 (`api.tools.processVideo`)

### 3. 上传层 API (2个端点)
(已全部实现)

### 4. 客户端层 API (2个端点)
(已全部实现)
=======

#### 1.1 系统状态
```typescript
GET /api/manage/status
响应: SystemStatus {
  system: {
    status: 'running' | 'stopped' | 'error',
    uptime: number,
    version: string,
    pid: number,
    cpu_usage: number,
    memory_usage: number,
    disk_usage: { total, used, free }
  },
  services: { rpc_v2, heartbeat, ui, tray, local_processor },
  local_processing: { enabled, capabilities, statistics }
}
```

#### 1.2 系统配置
```typescript
GET /api/manage/config
POST /api/manage/config
请求/响应: SystemConfig {
  system: {
    debug: boolean,
    log_level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR',
    max_connections: number
  },
  local_processing: { ... }
}
```

#### 1.3 系统控制
```typescript
POST /api/manage/control/restart
POST /api/manage/control/stop
POST /api/manage/control/reload-config
POST /api/manage/control/clear-cache
响应: ControlResponse {
  success: boolean,
  message: string,
  action: string,
  timestamp: string
}
```

#### 1.4 日志管理
```typescript
GET /api/manage/logs?lines=100&level=ERROR&category=system&search=keyword
响应: LogsResponse {
  total: number,
  has_more: boolean,
  logs: LogEntry[] {
    timestamp: string,
    level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR',
    category: string,
    message: string,
    details?: object,
    source?: string
  }
}
```

#### 1.5 本地处理能力
```typescript
GET /api/manage/local/capabilities
响应: LocalCapabilities {
  hardware: {
    cpu: { model, cores, threads, available },
    gpu: { model, memory, available, cuda_version },
    memory: { total, available }
  },
  capabilities: {
    screenshot: { available, supported_formats, max_resolution },
    ocr: { available, engines, languages },
    audio: { available, engines, models, supported_formats },
    video: { available, supported_formats, reason? }
  }
}
```

#### 1.6 本地处理配置
```typescript
GET /api/manage/local/config
POST /api/manage/local/config
请求/响应: LocalProcessingConfig {
  screenshot: { enabled, format, quality, auto_ocr, hotkey },
  ocr: { enabled, engine, language, confidence_threshold, gpu_enabled },
  audio: { enabled, engine, model, language, device },
  video: { enabled, extract_audio_format, subtitle_format, compress_before_upload, compress_crf },
  upload: { auto_upload, server_url, compress_before_upload, retry_times, retry_delay }
}
```

#### 1.7 本地处理统计
```typescript
GET /api/manage/local/stats?period=today&start_date=2025-12-01&end_date=2025-12-07
响应: LocalProcessingStats {
  period: string,
  summary: { total_tasks, completed, failed, average_time, total_data_processed },
  by_type: {
    [key: string]: { count, success_rate, average_time }
  },
  upload_stats: { total_uploaded, upload_size, failed, average_speed },
  timeline: [{ date, tasks, success, failed }]
}
```

#### 1.8 本地处理测试
```typescript
POST /api/manage/local/test
请求: TestRequest {
  test_type: 'screenshot' | 'ocr' | 'audio' | 'video',
  test_data?: string  // base64 encoded
}
响应: TestResponse {
  success: boolean,
  test_type: string,
  result: any,
  execution_time: number,
  hardware_used: { cpu: boolean, gpu: boolean },
  error?: string
}
```

### 2. 本地处理层 API (7个端点)

#### 2.1 截图
```typescript
POST /api/local/screenshot/capture
请求: ScreenshotRequest {
  format?: 'png' | 'jpg' | 'bmp',
  quality?: number,
  auto_ocr?: boolean,
  region?: { x, y, width, height },
  auto_upload: boolean
}
响应: ScreenshotResponse {
  success: boolean,
  message: string,
  screenshot_id?: string,
  file_path?: string,
  file_size?: number,
  image_data?: string,  // base64
  ocr_result?: object,
  upload_result?: object,
  execution_time: number,
  error?: string
}
```

#### 2.2 图像 OCR
```typescript
POST /api/local/image/ocr
请求: ImageOCRRequest {
  image_data?: string,  // base64
  image_path?: string,
  image_url?: string,
  engine?: 'paddleocr' | 'easyocr' | 'tesseract',
  language?: string,
  confidence_threshold?: number,
  auto_upload: boolean
}
响应: ImageOCRResponse {
  success: boolean,
  message: string,
  ocr_id?: string,
  full_text?: string,
  text_blocks?: [{ text, confidence, bbox }],
  language?: string,
  engine_used?: string,
  average_confidence?: number,
  upload_result?: object,
  execution_time: number,
  error?: string
}
```

#### 2.3 音频转录
```typescript
POST /api/local/audio/transcribe
请求: AudioTranscribeRequest {
  audio_data?: string,  // base64
  audio_path?: string,
  audio_url?: string,
  engine?: 'whisper' | 'vosk',
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large',
  language?: string,
  generate_subtitle: boolean,
  subtitle_format?: 'srt' | 'vtt' | 'ass',
  auto_upload: boolean
}
响应: AudioTranscribeResponse {
  success: boolean,
  message: string,
  transcribe_id?: string,
  full_text?: string,
  segments?: [{ start, end, text, confidence }],
  language?: string,
  engine_used?: string,
  model_used?: string,
  subtitle_path?: string,
  audio_duration?: number,
  upload_result?: object,
  execution_time: number,
  error?: string
}
```

#### 2.4 文件分析
```typescript
POST /api/local/file/analyze
请求: FileAnalyzeRequest {
  file_data?: string,  // base64
  file_path?: string,
  file_url?: string,
  file_type?: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'txt' | 'csv',
  extract_text: boolean,
  extract_images: boolean,
  extract_metadata: boolean,
  auto_upload: boolean
}
响应: FileAnalyzeResponse {
  success: boolean,
  message: string,
  analyze_id?: string,
  metadata?: {
    file_name, file_size, file_type, page_count,
    word_count, author, created_date, modified_date
  },
  text_content?: string,
  extracted_images?: [{ image_id, page_number, image_data, width, height }],
  page_texts?: [{ page, text }],
  upload_result?: object,
  execution_time: number,
  error?: string
}
```

#### 2.5 视频处理
```typescript
POST /api/local/video/process
请求: VideoProcessRequest {
  video_data?: string,  // base64
  video_path?: string,
  video_url?: string,
  extract_audio: boolean,
  audio_format: 'wav' | 'mp3' | 'flac',
  generate_subtitle: boolean,
  subtitle_format: 'srt' | 'vtt' | 'ass',
  transcribe_language?: string,
  compress_video: boolean,
  compress_crf?: number,
  auto_upload: boolean
}
响应: VideoProcessResponse {
  success: boolean,
  message: string,
  process_id?: string,
  video_metadata?: {
    duration, width, height, fps, codec, bitrate, file_size
  },
  extracted_audio_path?: string,
  extracted_audio_format?: string,
  subtitle_path?: string,
  subtitle_format?: string,
  compressed_video_path?: string,
  transcription_text?: string,
  upload_result?: object,
  execution_time: number,
  error?: string
}
```

### 3. 上传层 API (2个端点)

```typescript
GET /api/upload/tasks?status=uploading&limit=50
响应: {
  success: boolean,
  total: number,
  tasks: UploadTask[]
}

GET /api/upload/servers
响应: {
  success: boolean,
  servers: ServerConfig[]
}
```

### 4. 客户端层 API (2个端点)

```typescript
POST /api/client/forward
请求: {
  endpoint: string,
  method: string,
  data?: object
}
响应: ForwardResponse

GET /api/client/connection-status
响应: ConnectionStatus
```

---

## 📝 需要创建的类型定义 (types/)

### types/index.ts
```typescript
export type ViewState =
  | 'dashboard'
  | 'system_status'
  | 'system_config'
  | 'local_capabilities'
  | 'local_config'
  | 'local_stats'
  | 'local_test'
  | 'upload_tasks'
  | 'remote_servers'
  | 'logs'
  | 'tools'
  | 'settings';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
export type ServiceStatus = 'running' | 'stopped' | 'error' | 'starting';
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'failed';
```

### types/api.ts
```typescript
// 将所有上述 API 响应类型定义在此文件
export interface SystemStatus { ... }
export interface SystemConfig { ... }
export interface LocalCapabilities { ... }
// ... 等等
```

---

## 🔧 需要创建的 API 服务层 (services/api.ts)

```typescript
// 基础 HTTP 客户端
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:59000';

class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // 管理层 API
  async getSystemStatus() { ... }
  async getSystemConfig() { ... }
  async updateSystemConfig(config: SystemConfig) { ... }
  async executeControlAction(action: string) { ... }
  async getLogs(query: LogsQuery) { ... }
  async getLocalCapabilities() { ... }
  async getLocalConfig() { ... }
  async updateLocalConfig(config: LocalProcessingConfig) { ... }
  async getLocalStats(query: StatsQuery) { ... }
  async testLocalProcessing(request: TestRequest) { ... }

  // 本地处理层 API
  async captureScreenshot(request: ScreenshotRequest) { ... }
  async performOCR(request: ImageOCRRequest) { ... }
  async transcribeAudio(request: AudioTranscribeRequest) { ... }
  async analyzeFile(request: FileAnalyzeRequest) { ... }
  async processVideo(request: VideoProcessRequest) { ... }

  // 上传层 API
  async getUploadTasks(query?: any) { ... }
  async getUploadServers() { ... }

  // 客户端层 API
  async forwardRequest(request: ForwardRequest) { ... }
  async getConnectionStatus() { ... }
}

export const apiClient = new ApiClient();
```

---

## 📱 需要实现的页面组件

### 1. Dashboard.tsx (仪表板)
**功能需求**：
- 显示系统概览卡片（运行时长、CPU/内存使用率、今日处理任务数、上传统计）
- 实时监控图表（CPU 使用率折线图、内存使用率折线图、网络流量图、任务处理速率图）
- 快速操作面板（截图并识别、重启服务、清理缓存、测试本地处理）

**API 调用**：
- `GET /api/manage/status` - 系统状态
- `GET /api/manage/local/stats?period=today` - 今日统计

**UI 组件**：
- 4个统计卡片
- 2-4个图表 (使用 recharts)
- 4个快速操作按钮

### 2. SystemManagement.tsx (系统管理)
**功能需求**：
- 选项卡切换：Status / Configuration / Control
- Status 页面：显示系统详细状态、服务状态列表、硬件信息
- Configuration 页面：系统配置表单（调试模式、日志级别、最大连接数）
- Control 页面：控制操作按钮（重启、停止、重载配置、清理缓存）

**API 调用**：
- `GET /api/manage/status`
- `GET /api/manage/config`
- `POST /api/manage/config`
- `POST /api/manage/control/{action}`

### 3. LocalProcessing.tsx (本地处理)
**功能需求**：
- 选项卡切换：Capabilities / Configuration / Statistics / Test
- Capabilities: 显示硬件信息和处理能力
- Configuration: 本地处理配置表单（截图、OCR、音频、视频、上传设置）
- Statistics: 统计图表和表格（时间范围选择器、总体统计、按类型统计、成功率图表）
- Test: 测试工具（类型选择器、文件上传、测试按钮、结果展示）

**API 调用**：
- `GET /api/manage/local/capabilities`
- `GET /api/manage/local/config`
- `POST /api/manage/local/config`
- `GET /api/manage/local/stats`
- `POST /api/manage/local/test`

### 4. UploadTasks.tsx (上传管理)
**功能需求**：
- 上传任务列表（ID、类型、状态、进度、速度）
- 任务筛选（按状态）
- 批量操作（取消、重试）
- 服务器配置管理

**API 调用**：
- `GET /api/upload/tasks`
- `GET /api/upload/servers`

### 5. RemoteServers.tsx (远程服务器)
**功能需求**：
- 服务器列表（名称、URL、状态、延迟）
- 连接状态监控
- 服务器配置管理（添加、编辑、删除）

**API 调用**：
- `GET /api/client/connection-status`
- `GET /api/upload/servers`

### 6. Logs.tsx (日志管理)
**功能需求**：
- 日志筛选器（级别、分类、时间范围、搜索）
- 日志表格（时间戳、级别、分类、消息、详情）
- 实时日志更新（WebSocket 或轮询）
- 导出日志功能

**API 调用**：
- `GET /api/manage/logs?lines=100&level=ERROR&category=system&search=keyword`

### 7. Tools.tsx (工具箱)
**功能需求**：
- 快速工具按钮
  - 截图工具（调用 `/api/local/screenshot/capture`）
  - OCR 工具（调用 `/api/local/image/ocr`）
  - 音频转录工具（调用 `/api/local/audio/transcribe`）
  - 文件分析工具（调用 `/api/local/file/analyze`）
  - 视频处理工具（调用 `/api/local/video/process`）

**API 调用**：
- 所有本地处理层 API

---

## ⚙️ 配置文件更新

### .env.local
```env
VITE_API_BASE_URL=http://localhost:59000
VITE_WS_BASE_URL=ws://localhost:59000
```

---

## 🎨 UI/UX 建议

### 设计系统
- ✅ 使用 Tailwind CSS (已配置)
- ✅ 使用 lucide-react 图标库 (已引入)
- ✅ 深色侧边栏 + 浅色主内容区 (已实现)
- 建议添加：加载状态、错误提示、成功提示组件

### 颜色方案
- 主色：Blue-600 (已使用)
- 背景：Slate-50
- 侧边栏：Slate-900
- 成功：Green-500
- 警告：Yellow-500
- 错误：Red-500

---

## 🚀 实施优先级

### 高优先级 (P0) - 核心功能
1. ✅ 创建 `types/` 目录和所有类型定义
2. ✅ 创建 `services/api.ts` API 客户端
3. ✅ 实现 `Dashboard.tsx` 仪表板
4. ✅ 实现 `SystemManagement.tsx` 系统管理
5. ✅ 实现 `LocalProcessing.tsx` 本地处理

### 中优先级 (P1) - 辅助功能
6. ✅ 实现 `Logs.tsx` 日志管理
7. ✅ 实现 `UploadTasks.tsx` 上传管理

### 低优先级 (P2) - 扩展功能
8. ✅ 实现 `RemoteServers.tsx` 远程服务器
9. ✅ 实现 `Tools.tsx` 工具箱
10. ✅ 添加错误边界和加载状态
11. ✅ 添加单元测试

---

## 🔍 测试建议

### 功能测试
- 所有 API 调用能够正确请求和响应
- 表单验证正确
- 错误处理正确显示
- 加载状态正确显示

### 集成测试
- 前端能够连接到后端 API (http://localhost:59000)
- 所有端点返回正确的数据格式
- WebSocket 连接正常（如有）

### 性能测试
- 图表渲染性能
- 长列表虚拟化
- 大文件上传处理

---

## 📚 参考文档

- **后端 API 文档**: `http://localhost:59000/docs` (FastAPI 自动生成)
- **后端架构设计**: `pycore/callmodule/ROUTING_ARCHITECTURE_REDESIGN.md`
- **后端 UI 规范**: `pycore/callmodule/MANAGEMENT_UI_SPECIFICATION.md`
- **后端重构计划**: `pycore/callmodule/REFACTORING_PLAN.md`
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522

---

## ✅ 完成检查清单

### 文件创建
<<<<<<< HEAD
- [x] types/index.ts (Merged)
- [x] types/api.ts (Merged)
- [x] types/models.ts (Merged)
- [x] services/api.ts
- [x] utils/formatters.ts
- [x] utils/constants.ts
- [x] pages/Dashboard.tsx
- [x] pages/SystemManagement.tsx
- [x] pages/LocalProcessing.tsx
- [x] pages/UploadTasks.tsx
- [x] pages/RemoteServers.tsx
- [x] pages/Logs.tsx
- [x] pages/Tools.tsx
=======
- [ ] types/index.ts
- [ ] types/api.ts
- [ ] types/models.ts
- [ ] services/api.ts
- [ ] utils/formatters.ts
- [ ] utils/constants.ts
- [ ] pages/Dashboard.tsx
- [ ] pages/SystemManagement.tsx
- [ ] pages/LocalProcessing.tsx
- [ ] pages/UploadTasks.tsx
- [ ] pages/RemoteServers.tsx
- [ ] pages/Logs.tsx
- [ ] pages/Tools.tsx
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522

### 配置更新
- [ ] .env.local (添加 VITE_API_BASE_URL)
- [ ] vite.config.ts (确保代理配置正确)

### 功能实现
<<<<<<< HEAD
- [x] 所有页面能够正常渲染
- [x] 所有 API 调用能够正常工作 (Mock Mode)
- [x] 错误处理正确
- [x] 加载状态正确
- [x] 表单验证正确

### 测试
- [x] 手动测试所有功能
=======
- [ ] 所有页面能够正常渲染
- [ ] 所有 API 调用能够正常工作
- [ ] 错误处理正确
- [ ] 加载状态正确
- [ ] 表单验证正确

### 测试
- [ ] 手动测试所有功能
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
- [ ] API 集成测试
- [ ] 性能测试

---

**最后更新**: 2025-12-07
<<<<<<< HEAD
**文档版本**: 1.1
=======
**文档版本**: 1.0
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
**后端版本**: Pycore API v1.0 (Edge Computing Architecture)
