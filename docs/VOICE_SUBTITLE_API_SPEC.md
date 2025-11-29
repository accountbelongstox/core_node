# Voice Subtitle Remote API Specification

## 概述

本规范定义了Voice Subtitle系统的远程API接口标准，用于支持跨网络的语音字幕服务。

**API前缀**: `/api/mcp/v1/`

**完整端点格式**: `http://{host}:{port}/api/mcp/v1/{endpoint}`

---

## 1. 核心数据模型

### 1.1 QueueItem (队列项)

```json
{
  "text": "string",              // 必填: 字幕文本（已翻译后版本）
  "audio_path": "string",        // 必填: 音频文件标识（文件名）
  "audio_url": "string",         // 必填: 可直接拉取的音频URL
  "category": "string",          // 必填: 分类 (默认: default)
  "play_count": 0,               // 必填: 播放次数
  "created_at": "2025-11-29T12:34:56Z", // 必填: 创建时间 (ISO 8601)
  "langs": ["string"],           // 必填: 目标语言列表
  "language": "string",          // 可选: 源语言
  "voice": "string"              // 可选: 使用的TTS voice
}
```

### 1.2 QueueResponse (队列响应)

```json
{
  "success": true,           // 必填: 操作是否成功
  "queue": [QueueItem],      // 必填: 队列项数组
  "current_index": 0,        // 必填: 当前播放索引
  "enabled": true            // 必填: 队列是否启用
}
```

### 1.3 OperationResponse (通用操作响应)

```json
{
  "success": true,           // 必填: 操作是否成功
  "message": "string",       // 必填: 操作结果消息
  "error": "string"          // 可选: 错误信息 (success=false时必填)
}
```

---

## 2. 必须实现的API端点

### 2.1 队列管理

#### GET /api/mcp/v1/voice-subtitle/queue
获取完整队列

**请求**: 无参数

**响应**: QueueResponse（`queue` 为完整原始数据，`items` 为标准化精简结构）
```json
{
  "success": true,
  "queue": [...],
  "items": [QueueItem],     // 追加: 适配远程前端的标准化队列
  "current_index": 0,
  "enabled": true
}
```

#### GET /api/mcp/v1/voice-subtitle/queue/latest
获取最近的队列项

**请求参数**:
- `limit` (query, int): 最大返回数量，默认300

**响应**:
```json
{
  "success": true,
  "items": [QueueItem],
  "count": 100,
  "limit": 300
}
```

#### GET /api/mcp/v1/voice-subtitle/queue/filter-by-today
获取今天创建的队列项

**响应**:
```json
{
  "success": true,
  "items": [QueueItem],
  "count": 50
}
```

#### GET /api/mcp/v1/voice-subtitle/queue/filter-by-category
按分类过滤队列

**请求参数**:
- `category` (query, string): 分类名称

**响应**:
```json
{
  "success": true,
  "category": "image",
  "items": [QueueItem],
  "count": 25
}
```

#### POST /api/mcp/v1/voice-subtitle/clear
清空队列

**响应**: OperationResponse

#### POST /api/mcp/v1/voice-subtitle/set-index
设置当前播放索引

**请求体**:
```json
{
  "index": 10
}
```

**响应**:
```json
{
  "success": true,
  "current_index": 10
}
```

#### POST /api/mcp/v1/voice-subtitle/increment-play-count
增加播放次数

**请求体**:
```json
{
  "index": 5  // 可选: 不提供则使用current_index
}
```

**响应**:
```json
{
  "success": true,
  "current_index": 5,
  "item": QueueItem
}
```

#### POST /api/mcp/v1/voice-subtitle/remove-items
删除多个队列项

**请求体**:
```json
{
  "indices": [1, 3, 5, 7]  // 要删除的索引数组
}
```

**响应**:
```json
{
  "success": true,
  "removed_count": 4,
  "queue_length": 120
}
```

---

### 2.2 内容添加

#### POST /api/mcp/v1/voice-subtitle/add-text
添加文本到队列

**请求体**:
```json
{
  "text": "Hello world",          // 必填: 文本内容
  "language": "en",               // 可选: 源语言
  "voice": "en-US-AriaNeural",    // 可选: TTS voice
  "langs": ["en"],                // 可选: 目标语言列表 (首个元素生效)
  "category": "normal"            // 可选: 分类 (默认: default)
}
```

**响应**:
```json
{
  "success": true,
  "message": "Text added to queue",
  "items_added": 1
}
```

#### POST /api/mcp/v1/voice-subtitle/add-image
添加图片到队列 (OCR + TTS)

**请求体** (至少提供一种图片来源):
```json
{
  "image_path": "/path/to/image.jpg",  // 本地路径
  "image_url": "https://...",          // 远程URL
  "image_base64": "data:image/png;base64,...",  // Base64编码
  "language": "en",
  "voice": "en-US-AriaNeural",
  "langs": ["en"],
  "category": "image"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Image processed and added to queue",
  "items_added": 1
}
```

#### POST /api/mcp/v1/voice-subtitle/add-voice
添加音频文件到队列

**请求体**:
```json
{
  "audio_path": "/path/to/audio.mp3",  // 音频文件路径 (可选)
  "audio_url": "https://...",          // 远程URL (可选)
  "audio_base64": "data:audio/mpeg;base64,...", // Base64 (可选)
  "language": "en",
  "voice": "en-US-AriaNeural",
  "langs": ["en"],
  "category": "normal"
}
```

**响应**: OperationResponse

---

### 2.3 音频服务

#### GET /api/mcp/v1/voice-subtitle/audio
获取音频文件

**请求参数**:
- `path` (query, string): 音频文件名或相对路径。与 `GET /api/mcp/v1/voice-subtitle/audio/{filename}` 等效。

**响应**:
- Content-Type: `audio/mpeg` 或对应的音频格式
- 文件流

**支持的音频格式**:
- `.mp3` → `audio/mpeg`
- `.wav` → `audio/wav`
- `.ogg` → `audio/ogg`
- `.m4a` → `audio/mp4`
- `.aac` → `audio/aac`
- `.flac` → `audio/flac`

> 兼容性：旧版 `GET /api/mcp/v1/voice-subtitle/audio/{filename}` 仍然可用，推荐使用带 `path` 查询参数的统一端点。

---

### 2.4 分类管理

#### GET /api/mcp/v1/voice-subtitle/categories
获取所有分类

**响应**:
```json
{
  "success": true,
  "categories": ["normal", "image", "file", "clipboard"]
}
```

#### POST /api/mcp/v1/voice-subtitle/change-category
修改队列项分类

**请求体**:
```json
{
  "index": 10,
  "category": "important"
}
```

**响应**: OperationResponse

---

## 3. 异步任务处理

某些耗时操作（如图片OCR、文本翻译、TTS生成）需要异步处理。

### 3.1 任务提交响应

当操作需要异步处理时，返回任务ID：

```json
{
  "success": true,
  "task_id": "task_abc123def456",
  "message": "Task submitted",
  "estimated_time": 5  // 估计完成时间(秒)，可选
}
```

### 3.2 查询任务状态

#### GET /api/mcp/v1/tasks/{task_id}
查询任务处理状态

**响应**:
```json
{
  "success": true,
  "task_id": "task_abc123def456",
  "status": "pending" | "processing" | "completed" | "failed",
  "progress": 75,  // 进度百分比 (0-100)，可选
  "result": {},    // 任务结果，status=completed时返回
  "error": "",     // 错误信息，status=failed时返回
  "created_at": "2025-11-29T12:00:00Z",
  "updated_at": "2025-11-29T12:00:05Z"
}
```

### 3.3 支持异步的端点

以下端点可能返回任务ID而非立即结果：

- `POST /api/mcp/v1/voice-subtitle/add-text` - 文本翻译+TTS生成
- `POST /api/mcp/v1/voice-subtitle/add-image` - 图片OCR+翻译+TTS

**异步响应示例**:
```json
{
  "success": true,
  "task_id": "task_image_20251129_120000",
  "message": "Image processing started",
  "estimated_time": 10
}
```

**同步响应示例** (快速处理完成):
```json
{
  "success": true,
  "message": "Text added to queue",
  "items_added": 1
}
```

---

## 4. 文件上传端点

### POST /api/mcp/v1/web/upload-file
上传文件 (用于图片/音频上传)

**请求**: multipart/form-data
- `file`: 文件内容

**响应**:
```json
{
  "success": true,
  "file_path": "/uploaded/files/abc123.jpg",
  "file_url": "http://host:port/api/mcp/v1/files/abc123.jpg"
}
```

---

## 4. 服务发现端点

### GET /api/mcp/v1/ping
健康检查和服务发现

**响应**:
```json
{
  "success": true,
  "service": "voice-subtitle",
  "version": "1.0.0",
  "host": "192.168.1.100",
  "port": 9000
}
```

---

## 5. 错误处理规范

所有错误响应必须包含:

```json
{
  "success": false,
  "error": "Error description",
  "error_code": "ERROR_CODE",  // 可选
  "details": {}                 // 可选: 错误详情
}
```

**HTTP状态码**:
- 200: 成功
- 400: 请求参数错误
- 404: 资源未找到
- 500: 服务器内部错误

---

## 6. 实现要点

### 6.1 必须支持的字段

所有API响应必须包含 `success` 字段。

QueueItem 必须包含:
- `text`
- `audio_path`
- `category`
- `play_count`
- `created_at`

### 6.2 音频路径处理

- 本地路径: 使用绝对路径
- 远程API: 返回完整URL (`http://host:port/api/mcp/v1/voice-subtitle/audio?path=...`)

### 6.3 语言覆盖规则

- `langs` / `target_language` / `target_languages` 均可用于指定目标语言数组，服务端取首个非空值。
- 若未提供，则使用用户设置中的 `target_language`。

### 6.3 时间格式

所有时间字段使用 ISO 8601 格式: `2025-11-29T12:34:56.789Z`

### 6.4 CORS支持

API必须支持CORS跨域请求:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## 7. 客户端实现指南

### 7.1 API基础URL配置

```javascript
const API_CONFIG = {
  mode: 'local',  // 'local' | 'remote'
  remoteUrl: 'http://192.168.1.100:9000',
  apiPrefix: '/api/mcp/v1'
};
```

### 7.2 请求示例

```javascript
async function getQueue() {
  const baseUrl = API_CONFIG.mode === 'local'
    ? 'http://localhost:59000'
    : API_CONFIG.remoteUrl;

  const url = `${baseUrl}${API_CONFIG.apiPrefix}/voice-subtitle/queue`;
  const response = await fetch(url);
  return await response.json();
}
```

### 7.3 音频URL处理

```javascript
function getAudioUrl(audioPath) {
  const baseUrl = API_CONFIG.mode === 'local'
    ? 'http://localhost:59000'
    : API_CONFIG.remoteUrl;

  return `${baseUrl}${API_CONFIG.apiPrefix}/voice-subtitle/audio?path=${encodeURIComponent(audioPath)}`;
}
```

---

## 8. 局域网扫描协议

### 8.1 扫描参数

- 端口: 9000
- 超时: 200ms
- 间隔: 5秒
- 端点: `/api/mcp/v1/ping`

### 8.2 扫描实现

```javascript
async function scanLAN() {
  const localIp = await getLocalIP();
  const subnet = localIp.substring(0, localIp.lastIndexOf('.'));

  for (let i = 1; i < 255; i++) {
    const ip = `${subnet}.${i}`;
    if (ip === localIp) continue;

    try {
      const response = await fetch(
        `http://${ip}:9000/api/mcp/v1/ping`,
        { timeout: 200 }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.service === 'voice-subtitle') {
          // Found a valid service
          return { ip, port: 9000, data };
        }
      }
    } catch (e) {
      // Host not reachable
    }
  }
}
```

---

## 9. 版本控制

当前版本: **v1**

API路径包含版本号 `/api/mcp/v1/`，便于未来升级。
