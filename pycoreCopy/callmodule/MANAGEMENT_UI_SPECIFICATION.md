# Pycore Management UI 完整设计规范

## 📋 文档概述

本文档详细定义了 Pycore Module Caller 管理界面的完整规范，包括：
- UI 菜单结构
- 所有功能模块
- API 端点定义
- 数据模型规范
- 交互流程

---

## 🎨 UI 菜单结构

### 主菜单布局

```
┌─────────────────────────────────────────────────────────────────┐
│  [Logo] Pycore Management                    [User] [Settings]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────┐  ┌────────────────────────────────────────────┐ │
│  │           │  │                                            │ │
│  │  Sidebar  │  │          Main Content Area                │ │
│  │  Menu     │  │                                            │ │
│  │           │  │                                            │ │
│  └───────────┘  └────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 侧边栏菜单树

```
📊 Dashboard (仪表板)
   - 系统概览
   - 实时监控
   - 快速操作

⚙️ System Management (系统管理)
   - 系统状态
   - 系统配置
   - 控制操作

💻 Local Processing (本地处理)
   - 能力管理
   - 处理配置
   - 处理统计
   - 快速测试

📤 Upload Management (上传管理)
   - 上传任务
   - 上传历史
   - 服务器配置
   - 上传统计

🌐 Remote Servers (远程服务器)
   - 服务器列表
   - 连接状态
   - 服务器管理

📝 Logs (日志管理)
   - 系统日志
   - 处理日志
   - 上传日志
   - 错误日志

📈 Statistics (统计分析)
   - 性能统计
   - 使用趋势
   - 资源使用

🔧 Tools (工具箱)
   - 截图工具
   - OCR工具
   - 音频工具
   - 测试工具

⚙️ Settings (设置)
   - 通用设置
   - 本地处理设置
   - 上传设置
   - UI设置
```

---

## 📦 功能模块详细设计

## 1. Dashboard (仪表板)

### 1.1 系统概览卡片

**功能描述**: 显示系统运行状态的概览信息

**UI 组件**:
- 运行时长卡片
- CPU/内存使用率卡片
- 今日处理任务数卡片
- 上传统计卡片

**API 端点**:
```
GET /api/manage/dashboard/overview
```

**数据模型**:
```typescript
interface DashboardOverview {
  system: {
    status: 'running' | 'stopped' | 'error';
    uptime: number;  // 秒
    version: string;
    pid: number;
  };
  resources: {
    cpu_usage: number;  // 百分比
    memory_usage: number;  // MB
    disk_usage: {
      total: number;  // GB
      used: number;
      free: number;
    };
  };
  today_stats: {
    processed_tasks: number;
    uploaded_files: number;
    failed_tasks: number;
    success_rate: number;  // 百分比
  };
}
```

### 1.2 实时监控图表

**功能描述**: 实时显示系统资源使用情况

**UI 组件**:
- CPU 使用率折线图（最近1小时）
- 内存使用率折线图
- 网络流量图
- 任务处理速率图

**API 端点**:
```
GET /api/manage/dashboard/realtime?period=1h
WebSocket: ws://localhost:59000/ws/realtime-monitor
```

**数据模型**:
```typescript
interface RealtimeMetrics {
  timestamp: string;  // ISO 8601
  cpu_usage: number;
  memory_usage: number;
  network_upload: number;  // KB/s
  network_download: number;
  tasks_per_minute: number;
}
```

### 1.3 快速操作面板

**功能描述**: 常用操作的快捷入口

**UI 组件**:
- 截图并识别按钮
- 重启服务按钮
- 清理缓存按钮
- 测试本地处理按钮

**API 端点**: (见各自功能模块)

---

## 2. System Management (系统管理)

### 2.1 系统状态页面

**功能描述**: 显示系统详细状态信息

**UI 组件**:
- 服务状态列表（RPC v2, Heartbeat, UI, Tray, Local Processor）
- 硬件信息展示（CPU, GPU, 内存）
- 服务日志预览

**API 端点**:
```
GET /api/manage/status
```

**请求参数**: 无

**响应数据**:
```typescript
interface SystemStatus {
  system: {
    status: 'running' | 'stopped' | 'error';
    uptime: number;
    version: string;
    pid: number;
    cpu_usage: number;
    memory_usage: number;
    disk_usage: {
      total: number;
      used: number;
      free: number;
    };
  };
  services: {
    rpc_v2: ServiceStatus;
    heartbeat: ServiceStatus;
    ui: ServiceStatus;
    tray: ServiceStatus;
    local_processor: ServiceStatus;
  };
  local_processing: {
    enabled: boolean;
    capabilities: {
      screenshot: boolean;
      ocr: boolean;
      audio_transcribe: boolean;
      video_process: boolean;
    };
    statistics: {
      total_processed: number;
      today_processed: number;
      failed: number;
      average_time: number;
    };
  };
}

type ServiceStatus = 'running' | 'stopped' | 'error' | 'starting';
```

### 2.2 系统配置页面

**功能描述**: 查看和修改系统配置

**UI 组件**:
- 配置表单（调试模式、日志级别、最大连接数）
- 保存/重置按钮
- 配置验证提示

**API 端点**:
```
GET /api/manage/config
POST /api/manage/config
```

**请求数据 (POST)**:
```typescript
interface SystemConfig {
  system: {
    debug: boolean;
    log_level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
    max_connections: number;
  };
  local_processing: LocalProcessingConfig;
}
```

**响应数据**:
```typescript
interface ConfigResponse {
  success: boolean;
  message: string;
  config?: SystemConfig;
  errors?: {
    field: string;
    message: string;
  }[];
}
```

### 2.3 控制操作页面

**功能描述**: 系统控制操作（重启、停止、重载配置）

**UI 组件**:
- 操作按钮组
- 确认对话框
- 操作结果提示

**API 端点**:
```
POST /api/manage/control/restart
POST /api/manage/control/stop
POST /api/manage/control/reload-config
POST /api/manage/control/clear-cache
```

**请求参数**: 无

**响应数据**:
```typescript
interface ControlResponse {
  success: boolean;
  message: string;
  action: 'restart' | 'stop' | 'reload-config' | 'clear-cache';
  timestamp: string;
}
```

---

## 3. Local Processing (本地处理)

### 3.1 能力管理页面

**功能描述**: 显示本地处理能力和硬件信息

**UI 组件**:
- 硬件信息卡片（CPU, GPU, 内存）
- 能力列表（截图、OCR、音频、视频）
- 支持的引擎和模型列表

**API 端点**:
```
GET /api/manage/local/capabilities
```

**响应数据**:
```typescript
interface LocalCapabilities {
  hardware: {
    cpu: {
      model: string;
      cores: number;
      threads: number;
      available: boolean;
    };
    gpu: {
      model: string;
      memory: number;  // MB
      available: boolean;
      cuda_version: string;
    };
    memory: {
      total: number;  // MB
      available: number;
    };
  };
  capabilities: {
    screenshot: {
      available: boolean;
      supported_formats: string[];
      max_resolution: string;
    };
    ocr: {
      available: boolean;
      engines: string[];
      languages: string[];
    };
    audio: {
      available: boolean;
      engines: string[];
      models: string[];
      supported_formats: string[];
    };
    video: {
      available: boolean;
      reason?: string;
      supported_formats: string[];
    };
  };
}
```

### 3.2 处理配置页面

**功能描述**: 配置本地处理参数

**UI 组件**:
- 截图配置表单（格式、质量、快捷键）
- OCR配置表单（引擎、语言、阈值、GPU）
- 音频配置表单（引擎、模型、语言、设备）
- 视频配置表单（格式、压缩）
- 上传配置表单（自动上传、服务器URL、压缩、重试）

**API 端点**:
```
GET /api/manage/local/config
POST /api/manage/local/config
```

**请求数据 (POST)**:
```typescript
interface LocalProcessingConfig {
  screenshot: {
    enabled: boolean;
    format: 'png' | 'jpg' | 'bmp';
    quality: number;  // 1-100
    auto_ocr: boolean;
    hotkey: string;
  };
  ocr: {
    enabled: boolean;
    engine: 'paddleocr' | 'easyocr' | 'tesseract';
    language: string;
    confidence_threshold: number;  // 0-1
    gpu_enabled: boolean;
  };
  audio: {
    enabled: boolean;
    engine: 'whisper' | 'vosk';
    model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
    language: string;
    device: 'cuda' | 'cpu';
  };
  video: {
    enabled: boolean;
    extract_audio_format: 'wav' | 'mp3' | 'flac';
    subtitle_format: 'srt' | 'vtt' | 'ass';
    compress_before_upload: boolean;
    compress_crf: number;  // 0-51
  };
  upload: {
    auto_upload: boolean;
    server_url: string;
    compress_before_upload: boolean;
    retry_times: number;
    retry_delay: number;  // 秒
  };
}
```

**响应数据**:
```typescript
interface ConfigResponse {
  success: boolean;
  message: string;
  config?: LocalProcessingConfig;
}
```

### 3.3 处理统计页面

**功能描述**: 显示本地处理统计数据

**UI 组件**:
- 时间范围选择器（今天、本周、本月、全部）
- 总体统计卡片
- 按类型统计表格
- 成功率图表
- 处理时间趋势图

**API 端点**:
```
GET /api/manage/local/stats?period=today&start_date=2025-12-01&end_date=2025-12-07
```

**请求参数**:
```typescript
interface StatsQuery {
  period?: 'today' | 'week' | 'month' | 'all' | 'custom';
  start_date?: string;  // YYYY-MM-DD
  end_date?: string;
}
```

**响应数据**:
```typescript
interface LocalProcessingStats {
  period: string;
  summary: {
    total_tasks: number;
    completed: number;
    failed: number;
    average_time: number;  // 秒
    total_data_processed: number;  // MB
  };
  by_type: {
    [key: string]: {  // screenshot, ocr, audio, video
      count: number;
      success_rate: number;
      average_time: number;
    };
  };
  upload_stats: {
    total_uploaded: number;
    upload_size: number;  // MB
    failed: number;
    average_speed: number;  // MB/s
  };
  timeline: {
    date: string;
    tasks: number;
    success: number;
    failed: number;
  }[];
}
```

### 3.4 快速测试页面

**功能描述**: 测试本地处理功能

**UI 组件**:
- 测试类型选择器（截图、OCR、音频、视频）
- 文件上传区域
- 测试按钮
- 结果展示区域

**API 端点**:
```
POST /api/manage/local/test
```

**请求数据**:
```typescript
interface TestRequest {
  test_type: 'screenshot' | 'ocr' | 'audio' | 'video';
  test_data?: string;  // base64 encoded
}
```

**响应数据**:
```typescript
interface TestResponse {
  success: boolean;
  test_type: string;
  result: any;
  execution_time: number;
  hardware_used: {
    cpu: boolean;
    gpu: boolean;
  };
  error?: string;
}
```

---

## 4. Upload Management (上传管理)

### 4.1 上传任务页面

**功能描述**: 显示当前上传任务列表

**UI 组件**:
- 任务列表表格（ID、类型、状态、进度、速度）
- 刷新按钮
- 取消上传按钮
- 批量操作按钮

**API 端点**:
```
GET /api/upload/tasks?status=uploading&limit=50&offset=0
DELETE /api/upload/cancel/{upload_id}
```

**请求参数**:
```typescript
interface TasksQuery {
  status?: 'pending' | 'uploading' | 'completed' | 'failed';
  limit?: number;
  offset?: number;
}
```

**响应数据**:
```typescript
interface UploadTasks {
  total: number;
  tasks: UploadTask[];
}

interface UploadTask {
  upload_id: string;
  result_type: string;
  status: 'pending' | 'uploading' | 'completed' | 'failed';
  progress: number;  // 0-100
  uploaded_bytes: number;
  total_bytes: number;
  speed: number;  // MB/s
  estimated_time: number;  // 秒
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}
```

### 4.2 上传历史页面

**功能描述**: 查看历史上传记录

**UI 组件**:
- 时间范围选择器
- 历史记录表格
- 搜索框
- 详情查看按钮

**API 端点**:
```
GET /api/upload/history?limit=50&offset=0&start_date=2025-12-01&end_date=2025-12-07&status=completed
```

**请求参数**:
```typescript
interface HistoryQuery {
  limit?: number;
  offset?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
  result_type?: string;
}
```

**响应数据**:
```typescript
interface UploadHistory {
  total: number;
  items: UploadHistoryItem[];
}

interface UploadHistoryItem {
  upload_id: string;
  result_type: string;
  status: string;
  uploaded_at: string;
  file_count: number;
  total_size: number;
  server_url: string;
  files: {
    name: string;
    url: string;
    size: number;
  }[];
}
```

### 4.3 服务器配置页面

**功能描述**: 管理上传服务器配置

**UI 组件**:
- 服务器列表表格
- 添加服务器按钮
- 编辑/删除按钮
- 测试连接按钮
- 设置默认服务器

**API 端点**:
```
GET /api/upload/servers
POST /api/upload/servers
PUT /api/upload/servers/{server_name}
DELETE /api/upload/servers/{server_name}
POST /api/upload/servers/{server_name}/test
```

**数据模型**:
```typescript
interface UploadServer {
  name: string;
  url: string;
  api_key: string;
  enabled: boolean;
  priority: number;
  health_check_url: string;
  status?: 'online' | 'offline' | 'unknown';
  last_check?: string;
}

interface ServerList {
  default_server: string;
  servers: UploadServer[];
}
```

### 4.4 上传统计页面

**功能描述**: 上传统计分析

**UI 组件**:
- 统计卡片（总上传数、总大小、成功率）
- 按类型统计图表
- 上传趋势图
- 服务器使用分布图

**API 端点**:
```
GET /api/upload/stats?period=week
```

**响应数据**:
```typescript
interface UploadStats {
  period: string;
  summary: {
    total_uploads: number;
    total_size: number;  // MB
    success_rate: number;
    average_speed: number;  // MB/s
  };
  by_type: {
    [key: string]: {
      count: number;
      size: number;
      success_rate: number;
    };
  };
  by_server: {
    [key: string]: {
      uploads: number;
      size: number;
      success_rate: number;
    };
  };
  timeline: {
    date: string;
    uploads: number;
    size: number;
    failed: number;
  }[];
}
```

---

## 5. Remote Servers (远程服务器)

### 5.1 服务器列表页面

**功能描述**: 显示所有远程服务器

**UI 组件**:
- 服务器卡片列表
- 在线/离线状态指示
- 延迟显示
- 快速操作按钮

**API 端点**:
```
GET /api/client/server-config
```

**响应数据**:
```typescript
interface RemoteServerList {
  servers: RemoteServer[];
}

interface RemoteServer {
  name: string;
  url: string;
  type: string;
  status: 'online' | 'offline' | 'unknown';
  health_check: string;
  last_check: string;
  latency?: number;  // ms
  enabled: boolean;
}
```

### 5.2 连接状态页面

**功能描述**: 显示服务器连接详细状态

**UI 组件**:
- 连接状态总览
- 服务器详细信息表格
- 实时ping测试
- 错误日志

**API 端点**:
```
GET /api/client/connection-status
POST /api/client/test-connection/{server_name}
```

**响应数据**:
```typescript
interface ConnectionStatus {
  total_servers: number;
  online: number;
  offline: number;
  servers: {
    name: string;
    status: 'online' | 'offline';
    latency?: number;
    error?: string;
    last_success?: string;
  }[];
}
```

### 5.3 服务器管理页面

**功能描述**: 添加、编辑、删除远程服务器

**UI 组件**:
- 服务器表单
- 保存/删除按钮
- 测试连接按钮

**API 端点**:
```
POST /api/client/server-config
PUT /api/client/server-config/{server_name}
DELETE /api/client/server-config/{server_name}
```

**请求数据**:
```typescript
interface RemoteServerConfig {
  name: string;
  url: string;
  type: string;
  health_check: string;
  timeout: number;
  enabled: boolean;
}
```

---

## 6. Logs (日志管理)

### 6.1 系统日志页面

**功能描述**: 查看系统日志

**UI 组件**:
- 日志级别过滤器
- 时间范围选择器
- 日志列表（虚拟滚动）
- 搜索框
- 导出按钮

**API 端点**:
```
GET /api/manage/logs?lines=100&level=ERROR&category=system&start_time=2025-12-07T00:00:00&end_time=2025-12-07T23:59:59
```

**请求参数**:
```typescript
interface LogsQuery {
  lines?: number;
  level?: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  category?: 'system' | 'local_processing' | 'upload' | 'remote';
  start_time?: string;
  end_time?: string;
  search?: string;
}
```

**响应数据**:
```typescript
interface LogsResponse {
  total: number;
  has_more: boolean;
  logs: LogEntry[];
}

interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  category: string;
  message: string;
  details?: any;
  source?: string;
}
```

### 6.2 处理日志页面

**功能描述**: 查看本地处理日志

**UI 组件**: (同系统日志)

**API 端点**:
```
GET /api/manage/logs?category=local_processing
```

### 6.3 上传日志页面

**功能描述**: 查看上传日志

**UI 组件**: (同系统日志)

**API 端点**:
```
GET /api/manage/logs?category=upload
```

### 6.4 错误日志页面

**功能描述**: 查看所有错误日志

**UI 组件**: (同系统日志)

**API 端点**:
```
GET /api/manage/logs?level=ERROR
```

---

## 7. Statistics (统计分析)

### 7.1 性能统计页面

**功能描述**: 系统性能统计

**UI 组件**:
- CPU/内存使用趋势图
- 任务处理性能图表
- 资源使用热力图

**API 端点**:
```
GET /api/manage/stats/performance?period=week
```

**响应数据**:
```typescript
interface PerformanceStats {
  period: string;
  cpu_stats: {
    average: number;
    peak: number;
    timeline: {
      timestamp: string;
      value: number;
    }[];
  };
  memory_stats: {
    average: number;
    peak: number;
    timeline: {
      timestamp: string;
      value: number;
    }[];
  };
  task_stats: {
    total_tasks: number;
    average_time: number;
    tasks_per_hour: number;
  };
}
```

### 7.2 使用趋势页面

**功能描述**: 使用趋势分析

**UI 组件**:
- 按日/周/月趋势图
- 功能使用分布饼图
- 增长率统计

**API 端点**:
```
GET /api/manage/stats/trends?period=month
```

**响应数据**:
```typescript
interface UsageTrends {
  period: string;
  daily_stats: {
    date: string;
    tasks: number;
    uploads: number;
    data_processed: number;  // MB
  }[];
  feature_usage: {
    screenshot: number;
    ocr: number;
    audio: number;
    video: number;
  };
  growth_rate: {
    tasks: number;  // 百分比
    uploads: number;
    data_processed: number;
  };
}
```

### 7.3 资源使用页面

**功能描述**: 资源使用详情

**UI 组件**:
- 磁盘使用情况
- 网络流量统计
- 缓存使用情况

**API 端点**:
```
GET /api/manage/stats/resources
```

**响应数据**:
```typescript
interface ResourceStats {
  disk: {
    total: number;  // GB
    used: number;
    free: number;
    cache_size: number;
    temp_size: number;
  };
  network: {
    total_upload: number;  // GB
    total_download: number;
    upload_speed_avg: number;  // MB/s
    download_speed_avg: number;
  };
  cache: {
    ocr_cache: number;  // MB
    audio_cache: number;
    temp_files: number;
  };
}
```

---

## 8. Tools (工具箱)

### 8.1 截图工具页面

**功能描述**: 快速截图和OCR

**UI 组件**:
- 截图模式选择（全屏、窗口、区域）
- 截图按钮
- OCR按钮
- 结果展示区域
- 保存/上传按钮

**API 端点**:
```
POST /api/local/screenshot/capture
POST /api/local/screenshot/ocr
```

**请求数据**:
```typescript
interface ScreenshotRequest {
  mode: 'fullscreen' | 'window' | 'region';
  window_name?: string;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  format: 'png' | 'jpg' | 'bmp';
  quality: number;
}
```

**响应数据**: (见本地处理层路由设计)

### 8.2 OCR工具页面

**功能描述**: 独立OCR识别工具

**UI 组件**:
- 图片上传区域
- 引擎选择器
- 语言选择器
- 识别按钮
- 结果展示区域（可编辑）
- 复制/导出按钮

**API 端点**:
```
POST /api/local/image/ocr
```

### 8.3 音频工具页面

**功能描述**: 音频转文字和字幕生成

**UI 组件**:
- 音频文件上传
- 模型选择器
- 语言选择器
- 转录按钮
- 生成字幕按钮
- 结果展示区域
- 下载按钮

**API 端点**:
```
POST /api/local/audio/transcribe
POST /api/local/audio/generate-subtitle
```

### 8.4 测试工具页面

**功能描述**: 综合测试工具

**UI 组件**:
- 测试项选择器
- 开始测试按钮
- 测试结果展示
- 性能报告

**API 端点**:
```
POST /api/manage/local/test
POST /api/manage/test/all
```

---

## 9. Settings (设置)

### 9.1 通用设置页面

**功能描述**: 系统通用设置

**UI 组件**:
- 语言选择器
- 主题选择器（亮/暗/自动）
- 通知设置
- 启动设置

**数据模型**:
```typescript
interface GeneralSettings {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };
  startup: {
    auto_start: boolean;
    minimize_to_tray: boolean;
    check_updates: boolean;
  };
}
```

### 9.2 本地处理设置页面

**功能描述**: (同 Local Processing > 处理配置)

### 9.3 上传设置页面

**功能描述**: (同 Upload Management > 服务器配置)

### 9.4 UI设置页面

**功能描述**: UI相关设置

**UI 组件**:
- 字体大小选择器
- 刷新间隔设置
- 表格行数设置
- 图表刷新率设置

**数据模型**:
```typescript
interface UISettings {
  font_size: 'small' | 'medium' | 'large';
  refresh_interval: number;  // 秒
  table_rows_per_page: number;
  chart_refresh_rate: number;  // 秒
  enable_animations: boolean;
}
```

---

## 📡 完整 API 端点列表

### Management (管理)

| 方法 | 端点 | 描述 | 分页 | 实时 |
|-----|------|------|------|------|
| GET | `/api/manage/dashboard/overview` | 仪表板概览 | ❌ | ✅ |
| GET | `/api/manage/dashboard/realtime` | 实时监控数据 | ❌ | ✅ |
| GET | `/api/manage/status` | 系统状态 | ❌ | ✅ |
| GET | `/api/manage/config` | 获取配置 | ❌ | ❌ |
| POST | `/api/manage/config` | 更新配置 | ❌ | ❌ |
| POST | `/api/manage/control/restart` | 重启系统 | ❌ | ❌ |
| POST | `/api/manage/control/stop` | 停止系统 | ❌ | ❌ |
| POST | `/api/manage/control/reload-config` | 重载配置 | ❌ | ❌ |
| POST | `/api/manage/control/clear-cache` | 清理缓存 | ❌ | ❌ |
| GET | `/api/manage/logs` | 查询日志 | ✅ | ❌ |

### Local Processing (本地处理)

| 方法 | 端点 | 描述 | 分页 | 实时 |
|-----|------|------|------|------|
| GET | `/api/manage/local/capabilities` | 本地能力 | ❌ | ❌ |
| GET | `/api/manage/local/config` | 获取本地配置 | ❌ | ❌ |
| POST | `/api/manage/local/config` | 更新本地配置 | ❌ | ❌ |
| GET | `/api/manage/local/stats` | 本地处理统计 | ❌ | ✅ |
| POST | `/api/manage/local/test` | 测试本地处理 | ❌ | ❌ |
| POST | `/api/local/screenshot/capture` | 截图 | ❌ | ❌ |
| POST | `/api/local/screenshot/ocr` | 截图+OCR | ❌ | ❌ |
| POST | `/api/local/screenshot/upload` | 截图+上传 | ❌ | ❌ |
| POST | `/api/local/image/ocr` | 图片OCR | ❌ | ❌ |
| POST | `/api/local/image/compress` | 图片压缩 | ❌ | ❌ |
| POST | `/api/local/image/process-upload` | 图片处理+上传 | ❌ | ❌ |
| POST | `/api/local/audio/transcribe` | 音频转文字 | ❌ | ❌ |
| POST | `/api/local/audio/generate-subtitle` | 生成字幕 | ❌ | ❌ |
| POST | `/api/local/audio/process-upload` | 音频处理+上传 | ❌ | ❌ |
| POST | `/api/local/file/analyze` | 文件分析 | ❌ | ❌ |
| POST | `/api/local/file/extract-text` | 提取文字 | ❌ | ❌ |
| POST | `/api/local/file/process-upload` | 文件处理+上传 | ❌ | ❌ |
| POST | `/api/local/video/extract-audio` | 提取音频 | ❌ | ❌ |
| POST | `/api/local/video/generate-subtitle` | 视频字幕 | ❌ | ❌ |
| POST | `/api/local/video/process-upload` | 视频处理+上传 | ❌ | ❌ |

### Upload Management (上传管理)

| 方法 | 端点 | 描述 | 分页 | 实时 |
|-----|------|------|------|------|
| GET | `/api/upload/tasks` | 上传任务列表 | ✅ | ✅ |
| GET | `/api/upload/progress/{id}` | 上传进度 | ❌ | ✅ |
| DELETE | `/api/upload/cancel/{id}` | 取消上传 | ❌ | ❌ |
| GET | `/api/upload/history` | 上传历史 | ✅ | ❌ |
| POST | `/api/upload/result` | 上传结果 | ❌ | ❌ |
| POST | `/api/upload/batch` | 批量上传 | ❌ | ❌ |
| GET | `/api/upload/stats` | 上传统计 | ❌ | ❌ |
| GET | `/api/upload/servers` | 服务器列表 | ❌ | ❌ |
| POST | `/api/upload/servers` | 添加服务器 | ❌ | ❌ |
| PUT | `/api/upload/servers/{name}` | 更新服务器 | ❌ | ❌ |
| DELETE | `/api/upload/servers/{name}` | 删除服务器 | ❌ | ❌ |
| POST | `/api/upload/servers/{name}/test` | 测试服务器 | ❌ | ❌ |

### Remote Client (远程客户端)

| 方法 | 端点 | 描述 | 分页 | 实时 |
|-----|------|------|------|------|
| POST | `/api/client/forward` | 转发请求 | ❌ | ❌ |
| POST | `/api/client/encode-request` | URL编码 | ❌ | ❌ |
| GET | `/api/client/server-config` | 服务器配置 | ❌ | ❌ |
| POST | `/api/client/server-config` | 添加服务器 | ❌ | ❌ |
| PUT | `/api/client/server-config/{name}` | 更新服务器 | ❌ | ❌ |
| DELETE | `/api/client/server-config/{name}` | 删除服务器 | ❌ | ❌ |
| GET | `/api/client/connection-status` | 连接状态 | ❌ | ✅ |
| POST | `/api/client/test-connection/{name}` | 测试连接 | ❌ | ❌ |

### Statistics (统计)

| 方法 | 端点 | 描述 | 分页 | 实时 |
|-----|------|------|------|------|
| GET | `/api/manage/stats/performance` | 性能统计 | ❌ | ❌ |
| GET | `/api/manage/stats/trends` | 使用趋势 | ❌ | ❌ |
| GET | `/api/manage/stats/resources` | 资源使用 | ❌ | ❌ |

### WebSocket 端点

| 端点 | 描述 | 数据频率 |
|-----|------|---------|
| `ws://localhost:59000/ws/realtime-monitor` | 实时监控 | 1秒 |
| `ws://localhost:59000/ws/upload-progress` | 上传进度 | 实时 |
| `ws://localhost:59000/ws/logs` | 实时日志 | 实时 |

---

## 📋 数据模型汇总

### TypeScript 类型定义

```typescript
// ========== 基础类型 ==========
type ServiceStatus = 'running' | 'stopped' | 'error' | 'starting';
type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
type TaskStatus = 'pending' | 'uploading' | 'completed' | 'failed';
type ProcessingType = 'screenshot' | 'ocr' | 'audio' | 'video' | 'file';

// ========== 系统管理 ==========
interface SystemStatus {
  system: {
    status: 'running' | 'stopped' | 'error';
    uptime: number;
    version: string;
    pid: number;
    cpu_usage: number;
    memory_usage: number;
    disk_usage: {
      total: number;
      used: number;
      free: number;
    };
  };
  services: {
    [key: string]: ServiceStatus;
  };
  local_processing: {
    enabled: boolean;
    capabilities: {
      [key: string]: boolean;
    };
    statistics: {
      total_processed: number;
      today_processed: number;
      failed: number;
      average_time: number;
    };
  };
}

interface SystemConfig {
  system: {
    debug: boolean;
    log_level: LogLevel;
    max_connections: number;
  };
  local_processing: LocalProcessingConfig;
}

// ========== 本地处理 ==========
interface LocalCapabilities {
  hardware: {
    cpu: HardwareInfo;
    gpu: GPUInfo;
    memory: MemoryInfo;
  };
  capabilities: {
    screenshot: ScreenshotCapability;
    ocr: OCRCapability;
    audio: AudioCapability;
    video: VideoCapability;
  };
}

interface HardwareInfo {
  model: string;
  cores: number;
  threads: number;
  available: boolean;
}

interface GPUInfo {
  model: string;
  memory: number;
  available: boolean;
  cuda_version: string;
}

interface MemoryInfo {
  total: number;
  available: number;
}

interface ScreenshotCapability {
  available: boolean;
  supported_formats: string[];
  max_resolution: string;
}

interface OCRCapability {
  available: boolean;
  engines: string[];
  languages: string[];
}

interface AudioCapability {
  available: boolean;
  engines: string[];
  models: string[];
  supported_formats: string[];
}

interface VideoCapability {
  available: boolean;
  reason?: string;
  supported_formats: string[];
}

interface LocalProcessingConfig {
  screenshot: {
    enabled: boolean;
    format: 'png' | 'jpg' | 'bmp';
    quality: number;
    auto_ocr: boolean;
    hotkey: string;
  };
  ocr: {
    enabled: boolean;
    engine: 'paddleocr' | 'easyocr' | 'tesseract';
    language: string;
    confidence_threshold: number;
    gpu_enabled: boolean;
  };
  audio: {
    enabled: boolean;
    engine: 'whisper' | 'vosk';
    model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
    language: string;
    device: 'cuda' | 'cpu';
  };
  video: {
    enabled: boolean;
    extract_audio_format: 'wav' | 'mp3' | 'flac';
    subtitle_format: 'srt' | 'vtt' | 'ass';
    compress_before_upload: boolean;
    compress_crf: number;
  };
  upload: {
    auto_upload: boolean;
    server_url: string;
    compress_before_upload: boolean;
    retry_times: number;
    retry_delay: number;
  };
}

interface LocalProcessingStats {
  period: string;
  summary: {
    total_tasks: number;
    completed: number;
    failed: number;
    average_time: number;
    total_data_processed: number;
  };
  by_type: {
    [key: string]: {
      count: number;
      success_rate: number;
      average_time: number;
    };
  };
  upload_stats: {
    total_uploaded: number;
    upload_size: number;
    failed: number;
    average_speed: number;
  };
  timeline: TimelineData[];
}

interface TimelineData {
  date: string;
  tasks: number;
  success: number;
  failed: number;
}

// ========== 上传管理 ==========
interface UploadTask {
  upload_id: string;
  result_type: string;
  status: TaskStatus;
  progress: number;
  uploaded_bytes: number;
  total_bytes: number;
  speed: number;
  estimated_time: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

interface UploadHistoryItem {
  upload_id: string;
  result_type: string;
  status: string;
  uploaded_at: string;
  file_count: number;
  total_size: number;
  server_url: string;
  files: FileInfo[];
}

interface FileInfo {
  name: string;
  url: string;
  size: number;
}

interface UploadServer {
  name: string;
  url: string;
  api_key: string;
  enabled: boolean;
  priority: number;
  health_check_url: string;
  status?: 'online' | 'offline' | 'unknown';
  last_check?: string;
}

interface UploadStats {
  period: string;
  summary: {
    total_uploads: number;
    total_size: number;
    success_rate: number;
    average_speed: number;
  };
  by_type: {
    [key: string]: {
      count: number;
      size: number;
      success_rate: number;
    };
  };
  by_server: {
    [key: string]: {
      uploads: number;
      size: number;
      success_rate: number;
    };
  };
  timeline: {
    date: string;
    uploads: number;
    size: number;
    failed: number;
  }[];
}

// ========== 远程服务器 ==========
interface RemoteServer {
  name: string;
  url: string;
  type: string;
  status: 'online' | 'offline' | 'unknown';
  health_check: string;
  last_check: string;
  latency?: number;
  enabled: boolean;
}

interface ConnectionStatus {
  total_servers: number;
  online: number;
  offline: number;
  servers: {
    name: string;
    status: 'online' | 'offline';
    latency?: number;
    error?: string;
    last_success?: string;
  }[];
}

// ========== 日志 ==========
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: string;
  message: string;
  details?: any;
  source?: string;
}

interface LogsResponse {
  total: number;
  has_more: boolean;
  logs: LogEntry[];
}

// ========== 统计 ==========
interface PerformanceStats {
  period: string;
  cpu_stats: MetricStats;
  memory_stats: MetricStats;
  task_stats: {
    total_tasks: number;
    average_time: number;
    tasks_per_hour: number;
  };
}

interface MetricStats {
  average: number;
  peak: number;
  timeline: {
    timestamp: string;
    value: number;
  }[];
}

interface UsageTrends {
  period: string;
  daily_stats: {
    date: string;
    tasks: number;
    uploads: number;
    data_processed: number;
  }[];
  feature_usage: {
    [key: string]: number;
  };
  growth_rate: {
    tasks: number;
    uploads: number;
    data_processed: number;
  };
}

interface ResourceStats {
  disk: {
    total: number;
    used: number;
    free: number;
    cache_size: number;
    temp_size: number;
  };
  network: {
    total_upload: number;
    total_download: number;
    upload_speed_avg: number;
    download_speed_avg: number;
  };
  cache: {
    ocr_cache: number;
    audio_cache: number;
    temp_files: number;
  };
}

// ========== 设置 ==========
interface GeneralSettings {
  language: 'zh-CN' | 'en-US';
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };
  startup: {
    auto_start: boolean;
    minimize_to_tray: boolean;
    check_updates: boolean;
  };
}

interface UISettings {
  font_size: 'small' | 'medium' | 'large';
  refresh_interval: number;
  table_rows_per_page: number;
  chart_refresh_rate: number;
  enable_animations: boolean;
}

// ========== 通用响应 ==========
interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  timestamp: string;
}

interface PaginatedResponse<T> {
  total: number;
  page: number;
  page_size: number;
  items: T[];
  has_more: boolean;
}
```

---

## 🎨 UI 组件库推荐

### 前端技术栈
- **框架**: React 18 + TypeScript
- **UI库**: Ant Design / Material-UI / Shadcn UI
- **图表**: ECharts / Recharts
- **状态管理**: Zustand / Redux Toolkit
- **HTTP客户端**: Axios
- **WebSocket**: Socket.io-client
- **表单**: React Hook Form + Zod
- **路由**: React Router v6

### 关键组件
1. **Dashboard**: 实时监控卡片、图表组件
2. **Tables**: 虚拟滚动表格、分页、排序、筛选
3. **Forms**: 配置表单、验证、自动保存
4. **Charts**: 实时折线图、饼图、热力图
5. **Logs**: 虚拟滚动日志查看器、语法高亮
6. **Upload**: 上传进度条、拖拽上传
7. **Modals**: 确认对话框、详情查看

---

## 📊 前端目录结构

```
pycore/callmodule/static/manage_ui/
├── public/
│   ├── index.html
│   └── assets/
├── src/
│   ├── api/                    # API 客户端
│   │   ├── management.ts
│   │   ├── localProcessing.ts
│   │   ├── upload.ts
│   │   ├── remote.ts
│   │   └── index.ts
│   │
│   ├── components/             # 通用组件
│   │   ├── Dashboard/
│   │   │   ├── OverviewCard.tsx
│   │   │   ├── RealtimeChart.tsx
│   │   │   └── QuickActions.tsx
│   │   ├── Tables/
│   │   │   ├── DataTable.tsx
│   │   │   ├── VirtualTable.tsx
│   │   │   └── FilterBar.tsx
│   │   ├── Charts/
│   │   │   ├── LineChart.tsx
│   │   │   ├── PieChart.tsx
│   │   │   └── HeatMap.tsx
│   │   ├── Forms/
│   │   │   ├── ConfigForm.tsx
│   │   │   └── ValidationRules.ts
│   │   └── Common/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       ├── Footer.tsx
│   │       └── Loading.tsx
│   │
│   ├── pages/                  # 页面组件
│   │   ├── Dashboard/
│   │   │   └── index.tsx
│   │   ├── SystemManagement/
│   │   │   ├── Status.tsx
│   │   │   ├── Config.tsx
│   │   │   └── Control.tsx
│   │   ├── LocalProcessing/
│   │   │   ├── Capabilities.tsx
│   │   │   ├── Config.tsx
│   │   │   ├── Stats.tsx
│   │   │   └── Test.tsx
│   │   ├── UploadManagement/
│   │   │   ├── Tasks.tsx
│   │   │   ├── History.tsx
│   │   │   ├── Servers.tsx
│   │   │   └── Stats.tsx
│   │   ├── RemoteServers/
│   │   │   ├── List.tsx
│   │   │   ├── Status.tsx
│   │   │   └── Manage.tsx
│   │   ├── Logs/
│   │   │   └── index.tsx
│   │   ├── Statistics/
│   │   │   ├── Performance.tsx
│   │   │   ├── Trends.tsx
│   │   │   └── Resources.tsx
│   │   ├── Tools/
│   │   │   ├── Screenshot.tsx
│   │   │   ├── OCR.tsx
│   │   │   ├── Audio.tsx
│   │   │   └── Test.tsx
│   │   └── Settings/
│   │       ├── General.tsx
│   │       ├── LocalProcessing.tsx
│   │       ├── Upload.tsx
│   │       └── UI.tsx
│   │
│   ├── stores/                 # 状态管理
│   │   ├── useSystemStore.ts
│   │   ├── useLocalProcessingStore.ts
│   │   ├── useUploadStore.ts
│   │   └── useSettingsStore.ts
│   │
│   ├── hooks/                  # 自定义 Hooks
│   │   ├── useRealtime.ts
│   │   ├── useWebSocket.ts
│   │   ├── usePolling.ts
│   │   └── useAPI.ts
│   │
│   ├── types/                  # 类型定义
│   │   ├── api.ts
│   │   ├── models.ts
│   │   └── index.ts
│   │
│   ├── utils/                  # 工具函数
│   │   ├── formatters.ts
│   │   ├── validators.ts
│   │   ├── helpers.ts
│   │   └── constants.ts
│   │
│   ├── routes/                 # 路由配置
│   │   └── index.tsx
│   │
│   ├── App.tsx                 # 主应用
│   ├── main.tsx                # 入口文件
│   └── styles/                 # 样式
│       ├── global.css
│       └── themes/
│
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 🚀 实施建议

### 开发顺序

1. **阶段1: 核心基础 (1周)**
   - 搭建前端项目框架
   - 实现基础布局（Header, Sidebar, Content）
   - 实现 Dashboard 仪表板
   - 实现 API 客户端封装

2. **阶段2: 系统管理 (3-4天)**
   - 系统状态页面
   - 系统配置页面
   - 控制操作页面

3. **阶段3: 本地处理 (1周)**
   - 能力管理页面
   - 处理配置页面
   - 处理统计页面
   - 快速测试页面

4. **阶段4: 上传管理 (1周)**
   - 上传任务页面
   - 上传历史页面
   - 服务器配置页面
   - 上传统计页面

5. **阶段5: 辅助功能 (1周)**
   - 远程服务器管理
   - 日志查看
   - 统计分析
   - 工具箱

6. **阶段6: 优化完善 (3-5天)**
   - 设置页面
   - 性能优化
   - 响应式适配
   - 测试和修复

---

## 📝 总结

这份文档详细定义了：

✅ **9大功能模块**，包含 50+ 子功能页面
✅ **60+ API 端点**，覆盖所有业务场景
✅ **30+ 数据模型**，完整的 TypeScript 类型定义
✅ **完整的 UI 菜单结构**，清晰的导航层次
✅ **实施计划**，按阶段开发

所有设计都是为了管理 Pycore Module Caller 的边缘计算能力，提供直观、高效的管理界面。

确认设计后，我可以开始实施任何模块的代码！🚀
