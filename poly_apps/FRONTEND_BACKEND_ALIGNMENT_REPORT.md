# Pycore Management 前后端对齐报告

> **生成时间**: 2025-12-07
> **后端版本**: Pycore Module Caller v1.0 (Edge Computing Architecture)
> **前端版本**: Pycore Management UI v1.0

---

## 📊 执行摘要

### 当前状态
- ✅ **后端架构**: 已完成基础框架，实现了4层架构（Management, Local Processing, Upload, Client）
- ⚠️  **前端实现**: 使用Mock数据，未连接实际后端API
- ❌ **API对齐**: 存在多处不匹配，需要修改前端以对接实际后端

### 关键发现
1. **后端已实现路由**: 8个管理层路由 + 5个本地处理层路由 + 2个上传层路由 + 2个客户端层路由
2. **前端使用Mock服务**: 所有API调用都是模拟数据，未连接真实后端
3. **API端点不匹配**: 前端API路径与后端实际路径存在差异
4. **数据模型差异**: 部分响应字段名称和结构不一致

---

## 🔍 后端API实现情况分析

### ✅ 已实现的后端路由

#### 1. Management Layer (管理层) - 8个路由器
```python
pycore/callmodule/routers/management/
├── status_router.py          ✅ GET /api/manage/status
├── config_router.py          ✅ GET/POST /api/manage/config
├── control_router.py         ✅ POST /api/manage/control/{action}
├── logs_router.py            ✅ GET /api/manage/logs
├── capabilities_router.py    ✅ GET /api/manage/local/capabilities
├── local_config_router.py    ✅ GET/POST /api/manage/local/config
├── local_stats_router.py     ✅ GET /api/manage/local/stats
└── local_test_router.py      ✅ POST /api/manage/local/test
```

#### 2. Local Processing Layer (本地处理层) - 5个路由器
```python
pycore/callmodule/routers/local/
├── screenshot_router.py      ✅ POST /api/local/screenshot/capture
├── image_router.py           ✅ POST /api/local/image/ocr
├── audio_router.py           ✅ POST /api/local/audio/transcribe
├── file_router.py            ✅ POST /api/local/file/analyze
└── video_router.py           ✅ POST /api/local/video/process
```

#### 3. Upload Layer (上传层) - 2个路由器
```python
pycore/callmodule/routers/upload/
└── __init__.py               ✅ GET /api/upload/tasks
                              ✅ GET /api/upload/servers
```

#### 4. Client Layer (客户端层) - 2个路由器
```python
pycore/callmodule/routers/client/
└── __init__.py               ✅ POST /api/client/forward
                              ✅ GET /api/client/connection-status
```

### ⚠️ 后端实现但未完整的功能
1. **上传层路由**: 只实现了2个基础端点，缺少：
   - `POST /api/upload/result` - 上传处理结果
   - `POST /api/upload/batch` - 批量上传
   - `GET /api/upload/progress/{id}` - 上传进度
   - `DELETE /api/upload/cancel/{id}` - 取消上传
   - `GET /api/upload/history` - 上传历史

2. **客户端层路由**: 只实现了2个基础端点，缺少：
   - `POST /api/client/encode-request` - URL编码
   - `GET /api/client/server-config` - 服务器配置管理
   - `POST /api/client/server-config` - 添加服务器
   - `PUT /api/client/server-config/{name}` - 更新服务器
   - `DELETE /api/client/server-config/{name}` - 删除服务器
   - `POST /api/client/test-connection/{name}` - 测试连接

3. **管理层缺失**: Dashboard端点未单独实现
   - ❌ `GET /api/manage/dashboard/overview`
   - ❌ `GET /api/manage/dashboard/realtime`
   - ⚠️ 当前可以通过 `/api/manage/status` 和 `/api/manage/local/stats` 组合获取

---

## 🔌 前端API对齐问题

### 问题1: 前端使用Mock服务，未连接实际后端

**当前实现** (`poly_apps/services/api.ts`):
```typescript
// ❌ 问题：使用mockService
import * as mockService from './mockService';

export const api = {
  dashboard: {
    getOverview: mockService.getDashboardOverview,  // ❌ Mock数据
    getRealtimeMetrics: mockService.getRealtimeMetrics,  // ❌ Mock数据
  },
  // ...其他API也是Mock
};
```

**需要修改为**:
```typescript
// ✅ 使用实际HTTP客户端
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:59000';

export const api = {
  dashboard: {
    getOverview: async () => {
      const response = await fetch(`${API_BASE_URL}/api/manage/status`);
      return response.json();
    },
    // ...其他实际API调用
  },
};
```

---

### 问题2: API端点路径不匹配

| 功能 | 前端期望 | 后端实际 | 对齐方案 |
|-----|---------|---------|---------|
| **仪表板概览** | `GET /api/manage/dashboard/overview` | ❌ 不存在 | 使用 `/api/manage/status` 代替 |
| **实时指标** | `GET /api/manage/dashboard/realtime` | ❌ 不存在 | 前端本地生成或轮询status |
| **系统状态** | `GET /api/manage/status` | ✅ 存在 | ✅ 无需修改 |
| **系统配置** | `GET /api/manage/config` | ✅ 存在 | ✅ 无需修改 |
| **本地能力** | `GET /api/manage/local/capabilities` | ✅ 存在 | ✅ 无需修改 |
| **本地配置** | `GET /api/manage/local/config` | ✅ 存在 | ✅ 无需修改 |
| **本地统计** | `GET /api/manage/local/stats` | ✅ 存在 | ✅ 无需修改 |
| **上传任务** | `GET /api/upload/tasks` | ✅ 存在 | ✅ 无需修改 |
| **上传历史** | `GET /api/upload/history` | ⚠️ 未实现 | 需要后端补充实现 |
| **上传服务器** | `GET /api/upload/servers` | ✅ 存在 | ✅ 无需修改 |
| **远程服务器** | `GET /api/remote/servers` | ❌ 错误路径 | 修改为 `/api/client/connection-status` |
| **日志查询** | `GET /api/manage/logs` | ✅ 存在 | ✅ 无需修改 |
| **性能统计** | `GET /api/manage/stats/performance` | ⚠️ 未实现 | 可用 `/api/manage/status` 代替 |
| **使用趋势** | `GET /api/manage/stats/trends` | ⚠️ 未实现 | 可用 `/api/manage/local/stats` 代替 |

---

### 问题3: 数据模型字段差异

#### 3.1 SystemStatus响应差异

**前端期望** (`poly_apps/types.ts`):
```typescript
export interface SystemStatus {
  system: {
    status: 'running' | 'stopped' | 'error';
    uptime: number;
    version: string;
    pid: number;
    cpu_usage: number;         // ✅ 前端期望
    memory_usage: number;      // ✅ 前端期望
    disk_usage: { ... }        // ✅ 前端期望
  };
  services: { ... };
  local_processing: { ... };
}
```

**后端实际** (`pycore/callmodule/models/management/system_models.py`):
```python
class SystemStatus(BaseModel):
    system: dict  # ✅ 包含所有字段
    services: dict  # ✅ 匹配
    local_processing: dict  # ✅ 匹配
```

**后端服务实现** (`pycore/callmodule/services/management/system_service.py:32-89`):
```python
system_info = {
    "status": "running",
    "uptime": int(time.time() - self.start_time),
    "version": "1.0.0",
    "pid": self.pid,
    "cpu_usage": cpu_usage,           # ✅ 已包含
    "memory_usage": round(memory.used / (1024 * 1024), 2),  # ✅ 已包含
    "disk_usage": {
        "total": round(disk.total / (1024 ** 3), 2),
        "used": round(disk.used / (1024 ** 3), 2),
        "free": round(disk.free / (1024 ** 3), 2),
    }  # ✅ 已包含
}
```

✅ **结论**: 后端实际返回的数据与前端期望一致，无需修改。

---

#### 3.2 LocalCapabilities响应差异

**前端期望**:
```typescript
capabilities: {
  screenshot: { available: boolean; supported_formats: string[] };
  ocr: { available: boolean; engines: string[] };
  audio: { available: boolean; engines: string[] };
  video: { available: boolean; supported_formats: string[] };
}
```

**后端实际** (根据规范文档):
```python
capabilities: {
  screenshot: {
    available: boolean,
    supported_formats: string[],
    max_resolution: string  # ⚠️ 前端缺少
  },
  ocr: {
    available: boolean,
    engines: string[],
    languages: string[]  # ⚠️ 前端缺少
  },
  audio: {
    available: boolean,
    engines: string[],
    models: string[],  # ⚠️ 前端缺少
    supported_formats: string[]  # ⚠️ 前端缺少
  },
  video: {
    available: boolean,
    supported_formats: string[],
    reason?: string  # ⚠️ 前端缺少
  }
}
```

⚠️ **结论**: 前端类型定义不完整，需要补充字段。

---

## 📝 前端需要修改的文件清单

### 1. API服务层 - 优先级 P0 (必须修改)

#### 文件: `poly_apps/services/api.ts`

**当前问题**:
- ❌ 使用mockService，未连接实际后端
- ❌ 缺少HTTP客户端封装
- ❌ 缺少错误处理

**修改方案**:
```typescript
// ✅ 创建实际的HTTP API客户端

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:59000';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // ============ Management Layer APIs ============

  async getSystemStatus() {
    return this.request<SystemStatus>('/api/manage/status');
  }

  async getSystemConfig() {
    return this.request<SystemConfig>('/api/manage/config');
  }

  async updateSystemConfig(config: Partial<SystemConfig>) {
    return this.request('/api/manage/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async executeControlAction(action: string) {
    return this.request(`/api/manage/control/${action}`, {
      method: 'POST',
    });
  }

  async getLogs(query?: {
    lines?: number;
    level?: string;
    category?: string;
    search?: string;
  }) {
    const params = new URLSearchParams(query as any);
    return this.request(`/api/manage/logs?${params}`);
  }

  async getLocalCapabilities() {
    return this.request<LocalCapabilities>('/api/manage/local/capabilities');
  }

  async getLocalConfig() {
    return this.request<LocalProcessingConfig>('/api/manage/local/config');
  }

  async updateLocalConfig(config: Partial<LocalProcessingConfig>) {
    return this.request('/api/manage/local/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async getLocalStats(query?: {
    period?: string;
    start_date?: string;
    end_date?: string;
  }) {
    const params = new URLSearchParams(query as any);
    return this.request(`/api/manage/local/stats?${params}`);
  }

  async testLocalProcessing(request: {
    test_type: 'screenshot' | 'ocr' | 'audio' | 'video';
    test_data?: string;
  }) {
    return this.request('/api/manage/local/test', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ============ Local Processing Layer APIs ============

  async captureScreenshot(request: ScreenshotRequest) {
    return this.request('/api/local/screenshot/capture', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async performOCR(request: ImageOCRRequest) {
    return this.request('/api/local/image/ocr', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async transcribeAudio(request: AudioTranscribeRequest) {
    return this.request('/api/local/audio/transcribe', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async analyzeFile(request: FileAnalyzeRequest) {
    return this.request('/api/local/file/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async processVideo(request: VideoProcessRequest) {
    return this.request('/api/local/video/process', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ============ Upload Layer APIs ============

  async getUploadTasks(query?: { status?: string; limit?: number }) {
    const params = new URLSearchParams(query as any);
    return this.request(`/api/upload/tasks?${params}`);
  }

  async getUploadServers() {
    return this.request('/api/upload/servers');
  }

  // ============ Client Layer APIs ============

  async forwardRequest(request: {
    endpoint: string;
    method: string;
    data?: any;
  }) {
    return this.request('/api/client/forward', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getConnectionStatus() {
    return this.request('/api/client/connection-status');
  }

  // ============ Dashboard Helper APIs ============

  // 注意：后端没有单独的dashboard端点，需要组合多个API
  async getDashboardOverview(): Promise<DashboardOverview> {
    const status = await this.getSystemStatus();
    const stats = await this.getLocalStats({ period: 'today' });

    // 转换为DashboardOverview格式
    return {
      system: {
        status: status.system.status,
        uptime: status.system.uptime,
        version: status.system.version,
        pid: status.system.pid,
      },
      resources: {
        cpu_usage: status.system.cpu_usage,
        memory_usage: status.system.memory_usage,
        disk_usage: status.system.disk_usage,
      },
      today_stats: {
        processed_tasks: stats.summary?.completed || 0,
        uploaded_files: stats.upload_stats?.total_uploaded || 0,
        failed_tasks: stats.summary?.failed || 0,
        success_rate: stats.summary?.total_tasks > 0
          ? (stats.summary.completed / stats.summary.total_tasks) * 100
          : 0,
      },
    };
  }

  async getRealtimeMetrics(): Promise<RealtimeMetrics[]> {
    // 实时指标需要前端轮询 /api/manage/status
    // 或者使用WebSocket (如果后端支持)
    const status = await this.getSystemStatus();

    return [{
      timestamp: new Date().toISOString(),
      cpu_usage: status.system.cpu_usage,
      memory_usage: status.system.memory_usage,
      network_upload: 0, // 后端暂未提供
      tasks_per_minute: 0, // 需要前端计算
    }];
  }
}

export const apiClient = new ApiClient();

// 导出兼容的api对象
export const api = {
  dashboard: {
    getOverview: () => apiClient.getDashboardOverview(),
    getRealtimeMetrics: () => apiClient.getRealtimeMetrics(),
  },
  system: {
    getStatus: () => apiClient.getSystemStatus(),
    getConfig: () => apiClient.getSystemConfig(),
    updateConfig: (config: SystemConfig) => apiClient.updateSystemConfig(config),
  },
  local: {
    getCapabilities: () => apiClient.getLocalCapabilities(),
    getConfig: () => apiClient.getLocalConfig(),
    updateConfig: (config: LocalProcessingConfig) => apiClient.updateLocalConfig(config),
  },
  upload: {
    getTasks: () => apiClient.getUploadTasks(),
    getHistory: () => Promise.resolve({ total: 0, items: [] }), // ⚠️ 后端未实现
    getServers: () => apiClient.getUploadServers(),
  },
  remote: {
    getServers: () => apiClient.getConnectionStatus(), // 修正路径
  },
  logs: {
    getLogs: (query?: any) => apiClient.getLogs(query),
  },
  stats: {
    getPerformance: () => apiClient.getSystemStatus(), // 使用status代替
    getTrends: () => apiClient.getLocalStats({ period: 'week' }), // 使用local stats代替
    getResources: () => apiClient.getSystemStatus(), // 使用status代替
  },
};
```

---

### 2. 类型定义 - 优先级 P0 (必须修改)

#### 文件: `poly_apps/types.ts`

**需要补充的类型**:

```typescript
// ============ 本地处理层请求类型 ============

export interface ScreenshotRequest {
  format?: 'png' | 'jpg' | 'bmp';
  quality?: number;
  auto_ocr?: boolean;
  region?: { x: number; y: number; width: number; height: number };
  auto_upload?: boolean;
}

export interface ScreenshotResponse {
  success: boolean;
  message: string;
  screenshot_id?: string;
  file_path?: string;
  file_size?: number;
  image_data?: string;
  ocr_result?: any;
  upload_result?: any;
  execution_time: number;
  error?: string;
}

export interface ImageOCRRequest {
  image_data?: string;
  image_path?: string;
  image_url?: string;
  engine?: 'paddleocr' | 'easyocr' | 'tesseract';
  language?: string;
  confidence_threshold?: number;
  auto_upload?: boolean;
}

export interface ImageOCRResponse {
  success: boolean;
  message: string;
  ocr_id?: string;
  full_text?: string;
  text_blocks?: Array<{ text: string; confidence: number; bbox: number[] }>;
  language?: string;
  engine_used?: string;
  average_confidence?: number;
  upload_result?: any;
  execution_time: number;
  error?: string;
}

export interface AudioTranscribeRequest {
  audio_data?: string;
  audio_path?: string;
  audio_url?: string;
  engine?: 'whisper' | 'vosk';
  model?: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
  generate_subtitle?: boolean;
  subtitle_format?: 'srt' | 'vtt' | 'ass';
  auto_upload?: boolean;
}

export interface AudioTranscribeResponse {
  success: boolean;
  message: string;
  transcribe_id?: string;
  full_text?: string;
  segments?: Array<{ start: number; end: number; text: string; confidence: number }>;
  language?: string;
  engine_used?: string;
  model_used?: string;
  subtitle_path?: string;
  audio_duration?: number;
  upload_result?: any;
  execution_time: number;
  error?: string;
}

export interface FileAnalyzeRequest {
  file_data?: string;
  file_path?: string;
  file_url?: string;
  file_type?: 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'txt' | 'csv';
  extract_text?: boolean;
  extract_images?: boolean;
  extract_metadata?: boolean;
  auto_upload?: boolean;
}

export interface FileAnalyzeResponse {
  success: boolean;
  message: string;
  analyze_id?: string;
  metadata?: {
    file_name: string;
    file_size: number;
    file_type: string;
    page_count?: number;
    word_count?: number;
    author?: string;
    created_date?: string;
    modified_date?: string;
  };
  text_content?: string;
  extracted_images?: Array<{
    image_id: string;
    page_number: number;
    image_data: string;
    width: number;
    height: number;
  }>;
  page_texts?: Array<{ page: number; text: string }>;
  upload_result?: any;
  execution_time: number;
  error?: string;
}

export interface VideoProcessRequest {
  video_data?: string;
  video_path?: string;
  video_url?: string;
  extract_audio?: boolean;
  audio_format?: 'wav' | 'mp3' | 'flac';
  generate_subtitle?: boolean;
  subtitle_format?: 'srt' | 'vtt' | 'ass';
  transcribe_language?: string;
  compress_video?: boolean;
  compress_crf?: number;
  auto_upload?: boolean;
}

export interface VideoProcessResponse {
  success: boolean;
  message: string;
  process_id?: string;
  video_metadata?: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    codec: string;
    bitrate: number;
    file_size: number;
  };
  extracted_audio_path?: string;
  extracted_audio_format?: string;
  subtitle_path?: string;
  subtitle_format?: string;
  compressed_video_path?: string;
  transcription_text?: string;
  upload_result?: any;
  execution_time: number;
  error?: string;
}

// ============ 更新现有类型 ============

// 更新LocalCapabilities，添加缺失字段
export interface LocalCapabilities {
  hardware: {
    cpu: { model: string; cores: number; threads: number; available: boolean };
    gpu: { model: string; memory: number; available: boolean; cuda_version: string };
    memory: { total: number; available: number };
  };
  capabilities: {
    screenshot: {
      available: boolean;
      supported_formats: string[];
      max_resolution?: string; // ✅ 新增
    };
    ocr: {
      available: boolean;
      engines: string[];
      languages?: string[]; // ✅ 新增
    };
    audio: {
      available: boolean;
      engines: string[];
      models?: string[]; // ✅ 新增
      supported_formats?: string[]; // ✅ 新增
    };
    video: {
      available: boolean;
      supported_formats: string[];
      reason?: string; // ✅ 新增（不可用时的原因）
    };
  };
}

// 更新LocalProcessingConfig，添加upload配置
export interface LocalProcessingConfig {
  screenshot: {
    enabled: boolean;
    format: 'png' | 'jpg';
    quality?: number; // ✅ 新增
    auto_ocr: boolean;
    hotkey?: string; // ✅ 新增
  };
  ocr: {
    enabled: boolean;
    engine: string;
    language: string;
    confidence_threshold?: number; // ✅ 新增
    gpu_enabled: boolean;
  };
  audio: {
    enabled: boolean;
    engine?: string; // ✅ 新增
    model: string;
    language?: string; // ✅ 新增
    device: 'cpu' | 'cuda';
  };
  video?: { // ✅ 新增整个video配置
    enabled: boolean;
    extract_audio_format: 'wav' | 'mp3' | 'flac';
    subtitle_format: 'srt' | 'vtt' | 'ass';
    compress_before_upload: boolean;
    compress_crf: number;
  };
  upload?: { // ✅ 新增整个upload配置
    auto_upload: boolean;
    server_url: string;
    compress_before_upload: boolean;
    retry_times: number;
    retry_delay: number;
  };
}

// 更新SystemConfig，移除auto_start（后端没有）
export interface SystemConfig {
  debug: boolean;
  log_level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR';
  max_connections: number;
  // auto_start: boolean; // ❌ 移除（后端没有此字段）
}

// 新增：本地处理统计响应类型
export interface LocalProcessingStats {
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
  timeline: Array<{
    date: string;
    tasks: number;
    success: number;
    failed: number;
  }>;
}
```

---

### 3. 环境配置 - 优先级 P0 (必须修改)

#### 文件: `poly_apps/.env.local`

**当前内容**:
```env
# Empty or missing
```

**需要添加**:
```env
# Backend API Configuration
VITE_API_BASE_URL=http://localhost:59000

# WebSocket Configuration (if needed in future)
VITE_WS_BASE_URL=ws://localhost:59000

# Development Settings
VITE_API_TIMEOUT=30000
VITE_DEBUG=true
```

---

### 4. 页面组件修改 - 优先级 P1 (建议修改)

#### 4.1 Dashboard.tsx

**需要修改**:
- ✅ API调用已正确，但需要处理API返回格式差异
- ⚠️ 实时图表需要轮询或WebSocket实现

**修改建议**:
```typescript
// 添加轮询逻辑
useEffect(() => {
  const interval = setInterval(async () => {
    const metrics = await api.dashboard.getRealtimeMetrics();
    setRealtimeData((prev) => [...prev.slice(-9), metrics[0]]);
  }, 5000); // 每5秒轮询一次

  return () => clearInterval(interval);
}, []);
```

#### 4.2 SystemManagement.tsx

**需要修改**:
- ✅ API调用正确
- ⚠️ Control actions需要添加确认对话框
- ⚠️ Config更新后需要重新加载

**修改建议**:
```typescript
const handleControlAction = async (action: string) => {
  if (confirm(`确定要执行 ${action} 操作吗？`)) {
    await apiClient.executeControlAction(action);
    // 重新加载状态
    await loadStatus();
  }
};
```

#### 4.3 LocalProcessing.tsx

**需要修改**:
- ✅ Capabilities和Config API正确
- ⚠️ Statistics API需要添加时间范围选择
- ⚠️ Test功能需要添加文件上传

**修改建议**:
```typescript
// 添加时间范围状态
const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');

// 加载统计数据
const loadStats = async () => {
  const stats = await apiClient.getLocalStats({ period });
  setStats(stats);
};

// 文件上传和测试
const handleTest = async (file: File, testType: string) => {
  const base64 = await fileToBase64(file);
  const result = await apiClient.testLocalProcessing({
    test_type: testType as any,
    test_data: base64,
  });
  setTestResult(result);
};
```

#### 4.4 Tools.tsx

**需要修改**:
- ⚠️ 所有工具需要连接实际的本地处理API
- ⚠️ 需要添加文件上传和结果展示

**修改建议**:
```typescript
// 截图工具
const handleScreenshot = async () => {
  const result = await apiClient.captureScreenshot({
    format: 'png',
    auto_ocr: true,
    auto_upload: false,
  });
  setScreenshotResult(result);
};

// OCR工具
const handleOCR = async (file: File) => {
  const base64 = await fileToBase64(file);
  const result = await apiClient.performOCR({
    image_data: base64,
    engine: 'paddleocr',
    auto_upload: false,
  });
  setOCRResult(result);
};

// 音频转录工具
const handleAudioTranscribe = async (file: File) => {
  const base64 = await fileToBase64(file);
  const result = await apiClient.transcribeAudio({
    audio_data: base64,
    engine: 'whisper',
    model: 'medium',
    generate_subtitle: true,
    auto_upload: false,
  });
  setTranscribeResult(result);
};
```

---

## 🚀 实施建议

### 阶段1: 基础API对接 (1-2天)
**优先级**: P0 (必须完成)

1. ✅ 修改 `services/api.ts`，创建实际HTTP客户端
2. ✅ 更新 `.env.local`，添加API_BASE_URL配置
3. ✅ 更新 `types.ts`，补充缺失的类型定义
4. ✅ 测试所有Management Layer API调用

**验收标准**:
- [ ] 前端能成功连接到 http://localhost:59000
- [ ] `/api/manage/status` 调用成功并返回正确数据
- [ ] `/api/manage/config` GET/POST 调用成功
- [ ] `/api/manage/local/capabilities` 调用成功

---

### 阶段2: 页面功能完善 (2-3天)
**优先级**: P1 (重要)

1. ✅ 更新Dashboard页面，使用实际API
2. ✅ 更新SystemManagement页面，添加控制操作
3. ✅ 更新LocalProcessing页面，添加统计和测试
4. ✅ 更新UploadTasks页面，连接实际上传API
5. ✅ 更新Logs页面，添加实时日志

**验收标准**:
- [ ] Dashboard能显示实时系统状态
- [ ] System Management能执行控制操作
- [ ] Local Processing能查看能力和统计
- [ ] Upload Tasks能显示任务列表
- [ ] Logs能查询和过滤日志

---

### 阶段3: 工具和增强功能 (2-3天)
**优先级**: P2 (可选)

1. ✅ 实现Tools页面的实际功能（截图、OCR、音频转录等）
2. ✅ 添加RemoteServers页面
3. ✅ 添加Statistics页面（性能统计、使用趋势）
4. ✅ 添加错误处理和加载状态
5. ✅ 添加实时更新（轮询或WebSocket）

**验收标准**:
- [ ] Tools页面所有工具可用
- [ ] 错误提示友好且准确
- [ ] 加载状态正确显示
- [ ] 实时数据更新正常

---

### 阶段4: 优化和测试 (1-2天)
**优先级**: P2 (可选)

1. ✅ 性能优化（减少不必要的API调用）
2. ✅ 添加缓存机制
3. ✅ 添加单元测试
4. ✅ 集成测试
5. ✅ UI/UX优化

---

## ⚠️ 后端需要补充的功能

### 高优先级 (影响前端功能)

1. **Dashboard实时指标端点**
   ```python
   # 建议添加到 pycore/callmodule/routers/management/
   @router.get("/dashboard/realtime")
   async def get_realtime_metrics():
       # 返回实时CPU/内存/网络/任务速率
       pass
   ```

2. **上传历史端点**
   ```python
   # 建议添加到 pycore/callmodule/routers/upload/
   @router.get("/history")
   async def get_upload_history(limit: int = 50, offset: int = 0):
       # 返回上传历史记录
       pass
   ```

3. **性能统计端点**
   ```python
   # 建议添加到 pycore/callmodule/routers/management/
   @router.get("/stats/performance")
   async def get_performance_stats(period: str = "day"):
       # 返回性能统计数据
       pass
   ```

### 中优先级 (增强功能)

4. **客户端配置管理**
   ```python
   # pycore/callmodule/routers/client/
   @router.get("/server-config")
   @router.post("/server-config")
   @router.put("/server-config/{name}")
   @router.delete("/server-config/{name}")
   ```

5. **上传进度追踪**
   ```python
   # pycore/callmodule/routers/upload/
   @router.get("/progress/{upload_id}")
   @router.delete("/cancel/{upload_id}")
   ```

---

## 📊 完成度评估

### 后端实现完成度: **65%**

| 模块 | 完成度 | 说明 |
|-----|-------|------|
| Management Layer | 90% | 8个路由已实现，缺Dashboard专用端点 |
| Local Processing Layer | 100% | 5个路由全部实现 |
| Upload Layer | 40% | 仅2个基础端点，缺5个重要端点 |
| Client Layer | 40% | 仅2个基础端点，缺6个管理端点 |
| Controllers | 80% | 基础控制器已实现 |
| Services | 70% | 核心服务已实现，部分待完善 |
| Processors | 85% | 处理器基本完成，部分待测试 |
| Models | 90% | 数据模型定义完整 |

### 前端实现完成度: **50%**

| 模块 | 完成度 | 说明 |
|-----|-------|------|
| 基础框架 | 100% | React + Vite + TypeScript |
| 路由和布局 | 100% | 侧边栏、路由、布局完成 |
| API服务层 | 0% | 全部使用Mock数据 ❌ |
| 类型定义 | 60% | 基础类型已定义，缺少请求/响应类型 |
| Dashboard页面 | 80% | UI完成，需连接实际API |
| SystemManagement页面 | 80% | UI完成，需连接实际API |
| LocalProcessing页面 | 80% | UI完成，需连接实际API |
| UploadTasks页面 | 70% | UI基本完成，功能待完善 |
| Logs页面 | 70% | UI基本完成，功能待完善 |
| Tools页面 | 60% | UI完成，功能未实现 |
| RemoteServers页面 | 60% | UI完成，功能未实现 |
| Statistics页面 | 60% | UI完成，功能未实现 |
| Settings页面 | 70% | UI完成，功能基本可用 |

### 前后端对齐度: **30%**

- ❌ **API对接**: 前端使用Mock，未连接实际后端
- ⚠️ **端点匹配**: 约70%匹配，30%需要调整
- ⚠️ **数据模型**: 约80%兼容，20%需要补充
- ❌ **功能完整性**: 前端实现了后端未提供的功能（如Dashboard实时指标）

---

## 🎯 关键修改优先级总结

### 🔴 **P0 - 立即修改 (阻塞性问题)**

1. ✅ **创建实际HTTP API客户端** (`services/api.ts`)
   - 替换所有mockService调用
   - 实现错误处理和重试逻辑

2. ✅ **补充类型定义** (`types.ts`)
   - 添加所有请求/响应类型
   - 更新现有类型以匹配后端

3. ✅ **配置API端点** (`.env.local`)
   - 添加 `VITE_API_BASE_URL`
   - 添加其他环境变量

### 🟡 **P1 - 尽快修改 (影响核心功能)**

4. ✅ **更新Dashboard页面**
   - 使用 `/api/manage/status` 代替 `/api/manage/dashboard/overview`
   - 实现实时数据轮询

5. ✅ **更新页面API调用**
   - SystemManagement
   - LocalProcessing
   - UploadTasks
   - Logs

### 🟢 **P2 - 后续优化 (增强功能)**

6. ✅ **实现Tools页面功能**
7. ✅ **添加错误处理和加载状态**
8. ✅ **性能优化和缓存**
9. ✅ **单元测试和集成测试**

---

## 📚 参考资源

### 后端文档
- **API文档**: http://localhost:59000/docs (FastAPI自动生成)
- **架构设计**: `pycore/callmodule/ROUTING_ARCHITECTURE_REDESIGN.md`
- **UI规范**: `pycore/callmodule/MANAGEMENT_UI_SPECIFICATION.md`

### 前端文档
- **修改要求**: `poly_apps/FRONTEND_MODIFICATION_REQUIREMENTS.md`
- **类型定义**: `poly_apps/types.ts`
- **API服务**: `poly_apps/services/api.ts`

---

## ✅ 修改检查清单

### API服务层
- [ ] 创建HTTP客户端类
- [ ] 实现所有Management Layer API
- [ ] 实现所有Local Processing Layer API
- [ ] 实现所有Upload Layer API
- [ ] 实现所有Client Layer API
- [ ] 添加错误处理
- [ ] 添加请求重试逻辑
- [ ] 添加请求超时配置

### 类型定义
- [ ] 补充所有请求类型
- [ ] 补充所有响应类型
- [ ] 更新LocalCapabilities类型
- [ ] 更新LocalProcessingConfig类型
- [ ] 更新SystemConfig类型
- [ ] 添加LocalProcessingStats类型

### 页面组件
- [ ] Dashboard连接实际API
- [ ] SystemManagement连接实际API
- [ ] LocalProcessing连接实际API
- [ ] UploadTasks连接实际API
- [ ] RemoteServers连接实际API
- [ ] Logs连接实际API
- [ ] Tools实现实际功能
- [ ] Statistics连接实际API
- [ ] Settings保存到实际后端

### 配置和环境
- [ ] 更新.env.local
- [ ] 配置代理（如需要）
- [ ] 配置CORS（后端）

### 测试
- [ ] 手动测试所有API调用
- [ ] 验证所有页面功能
- [ ] 测试错误处理
- [ ] 测试加载状态
- [ ] 性能测试

---

**报告完成时间**: 2025-12-07
**下一步**: 按照优先级P0开始修改前端代码

