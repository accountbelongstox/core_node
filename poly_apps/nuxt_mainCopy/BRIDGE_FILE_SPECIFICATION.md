# PyMatrix 桥接文件规范说明

> **创建时间**: 2025-11-10
> **最后更新**: 2025-11-10
> **版本**: 1.0.0

## 📋 目录

1. [桥接文件概述](#桥接文件概述)
2. [桥接点定义](#桥接点定义)
3. [重复定义分析](#重复定义分析)
4. [标准MSE协议方案](#标准mse协议方案)
5. [数据流规范](#数据流规范)
6. [一致性检查清单](#一致性检查清单)

---

## 📖 桥接文件概述

### 什么是桥接文件？

桥接文件是定义**前端（TypeScript/Vue）与后端（Python/FastAPI）之间数据契约**的关键文件。它确保：

- ✅ 类型安全的数据传输
- ✅ API端点的一致性
- ✅ WebSocket消息格式统一
- ✅ 前后端协同开发

### PyMatrix 桥接文件架构

```
poly_apps/nuxt_main/
├── types/
│   └── pymatrix.ts              # 🔴 核心桥接文件 - 数据类型定义
├── apps/app_pymatrix/
│   └── utils_app_pymatrix/
│       └── api-urls.ts          # 🔵 URL构建器 - 端点定义
└── services/api/pymatrix/
    ├── pymatrix-device-api.ts   # 🟢 设备HTTP API
    ├── pymatrix-config-api.ts   # 🟢 配置HTTP API
    ├── pymatrix-file-api.ts     # 🟢 文件HTTP API
    ├── pymatrix-group-api.ts    # 🟢 群控HTTP API
    ├── pymatrix-health-api.ts   # 🟢 健康检查API
    └── pymatrix-recording-api.ts # 🟢 录制API

pyapps/matrix/
├── api/
│   ├── device_routes.py         # 🟠 设备路由端点
│   ├── ws_routes.py             # 🔴 WebSocket端点
│   └── screen_routes.py         # 🟠 屏幕控制路由
└── services/
    ├── device_service.py        # 🟡 设备服务层
    └── video_stream_service.py  # 🔴 视频流服务
```

---

## 🎯 桥接点定义

### 1. HTTP REST API 桥接点

| 端点 | 前端定义 | 后端实现 | 状态 |
|------|---------|---------|------|
| `GET /api/devices/list` | pymatrix-device-api.ts | device_routes.py:31 | ✅ 一致 |
| `GET /api/devices/{serial}/info` | pymatrix-device-api.ts | device_routes.py:56 | ✅ 一致 |
| `POST /api/devices/{serial}/connect` | pymatrix-device-api.ts | device_routes.py:86 | ✅ 一致 |
| `POST /api/devices/{serial}/disconnect` | pymatrix-device-api.ts | device_routes.py:118 | ✅ 一致 |

### 2. WebSocket 桥接点

| 端点 | 前端定义 | 后端实现 | 数据格式 | 状态 |
|------|---------|---------|---------|------|
| `ws://*/ws/video/{serial}` | useVideoStream.ts | ws_routes.py:38 | ❌ **不匹配** | 🔴 需修复 |
| `ws://*/ws/control/{serial}` | useControlWS.ts | ws_routes.py:111 | ✅ JSON (WSRPC) | ✅ 一致 |
| `ws://*/ws/group` | useGroupWS.ts | ws_routes.py:227 | ✅ JSON (WSRPC) | ✅ 一致 |

### 3. 数据类型桥接点

#### Device 类型

**前端** (`types/pymatrix.ts:1-14`):
```typescript
export interface Device {
  serial: string;
  name: string;
  model: string;
  state: 'connected' | 'disconnected' | 'connecting';
  resolution: { width: number; height: number; };
  streaming: boolean;
  controllable: boolean;
  isHost?: boolean;
  tags?: string[];
}
```

**后端** (`device_routes.py:44-50`):
```python
{
    "serial": device.serial,
    "state": device.state.value,
    "model": device.model,
    "product": device.product
}
```

**差异**:
- ⚠️ 后端缺少 `streaming`, `controllable`, `isHost`, `tags` 字段
- ⚠️ 后端多出 `product` 字段
- 建议：前端适配或后端补充

#### WSRPCMessage 协议

**前端** (`types/pymatrix.ts:55-59`):
```typescript
export interface WSRPCMessage {
  type: string;           // 消息类型
  timestamp: number;      // 时间戳（毫秒）
  data: any;             // 消息数据
}
```

**后端** (`ws_routes.py:29-35`):
```python
def create_wsrpc_message(msg_type: str, data: any) -> str:
    return json.dumps({
        "type": msg_type,
        "timestamp": int(datetime.now().timestamp() * 1000),
        "data": data
    })
```

**状态**: ✅ 完全一致

---

## 🔴 重复定义分析

### 发现的重复定义

#### 1. Device 结构重复
- **位置1**: `types/pymatrix.ts` (TypeScript Interface)
- **位置2**: `device_routes.py` (Python Dict)
- **位置3**: `pymatrix-device-api.ts` (API响应映射)
- **建议**: 保留 `types/pymatrix.ts` 作为唯一真实源

#### 2. VideoInitMessage 重复
- **位置1**: `types/pymatrix.ts:61-68`
- **位置2**: `video_stream_service.py:122-134` (inline dict)
- **建议**: 后端应从配置文件导入类型定义

#### 3. URL 端点字符串重复
- **位置1**: `api-urls.ts` (前端URL构建)
- **位置2**: 各 `*-api.ts` 文件中硬编码
- **位置3**: 后端 `router.prefix` 装饰器
- **建议**: 使用 `api-urls.ts` 统一管理

### 消除重复的策略

1. **单一真实源原则**
   - 类型定义: `types/pymatrix.ts`
   - URL定义: `api-urls.ts`
   - 消息格式: `WSRPCMessage`

2. **代码生成考虑**
   - 可考虑从 TypeScript types 生成 Python Pydantic models
   - 工具: `quicktype`, `json-schema-to-typescript`

3. **运行时验证**
   - 使用 JSON Schema 验证消息格式
   - 单元测试覆盖前后端契约

---

## 🚀 标准MSE协议方案

### 问题诊断

**当前问题**:
```typescript
// 前端期望: 自定义帧格式
// [serial_length(1)][serial(N)][pts(8)][size(4)][h264_data]
function parseBinaryFrame(data: ArrayBuffer) { ... }

// 后端实际: 标准fMP4 segments
await websocket.send_bytes(fmp4_chunk)  // 无自定义帧头
```

**不匹配原因**:
- 前端试图解析不存在的自定义帧头
- 后端发送的是标准容器格式（fMP4）
- MediaSource API 期望 fMP4，不需要额外解析

### 解决方案：标准 MSE (Media Source Extensions) 协议

#### 方案架构

```
┌─────────────────────────────────────────────────────────┐
│  Android Device                                         │
│  ┌───────────────────┐                                  │
│  │ scrcpy-server     │ Raw H.264 NAL units              │
│  │ (Java)            │────────────────┐                 │
│  └───────────────────┘                │                 │
└────────────────────────────────────────┼─────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────┐
│  Python Backend (FastAPI)                               │
│  ┌─────────────────────────────────────────────┐        │
│  │ ScrcpyDevice                                │        │
│  │  - read_video_frame()                       │        │
│  │  - Returns: {data, pts, is_keyframe, ...}  │        │
│  └──────────────────┬──────────────────────────┘        │
│                     │                                    │
│                     ▼                                    │
│  ┌─────────────────────────────────────────────┐        │
│  │ VideoStreamHandler                          │        │
│  │  - Parse SPS/PPS                            │        │
│  │  - FMP4EncoderComplete                      │        │
│  └──────────────────┬──────────────────────────┘        │
│                     │                                    │
│                     ▼                                    │
│  ┌─────────────────────────────────────────────┐        │
│  │ WebSocket /ws/video/{serial}                │        │
│  │                                              │        │
│  │  1. Send: video.init (JSON)                 │        │
│  │     {codec, width, height, fps, bitrate}    │        │
│  │                                              │        │
│  │  2. Send: fMP4 init segment (Binary)        │        │
│  │     [ftyp][moov] boxes                       │        │
│  │                                              │        │
│  │  3. Stream: fMP4 media segments (Binary)    │        │
│  │     [moof][mdat] boxes                       │        │
│  │                                              │        │
│  │  4. Send: video.metadata (JSON, periodic)   │        │
│  │     {fps, latency, droppedFrames}           │        │
│  └──────────────────┬──────────────────────────┘        │
└────────────────────┼──────────────────────────────────┘
                      │
                      │ WebSocket Binary + JSON
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Vue Frontend (Browser)                                 │
│  ┌─────────────────────────────────────────────┐        │
│  │ useVideoStream.ts                           │        │
│  │                                              │        │
│  │  handleTextMessage(message: WSRPCMessage)   │        │
│  │    - video.init → initializeMediaSource()   │        │
│  │    - video.metadata → update metrics        │        │
│  │                                              │        │
│  │  handleBinaryMessage(data: ArrayBuffer)     │        │
│  │    - Push to bufferQueue                    │        │
│  │    - processBufferQueue()                   │        │
│  └──────────────────┬──────────────────────────┘        │
│                     │                                    │
│                     ▼                                    │
│  ┌─────────────────────────────────────────────┐        │
│  │ MediaSource API (Browser Native)            │        │
│  │                                              │        │
│  │  const mediaSource = new MediaSource()      │        │
│  │  videoElement.src = URL.createObjectURL(..) │        │
│  │                                              │        │
│  │  sourceBuffer = mediaSource.addSourceBuffer(│        │
│  │    'video/mp4; codecs="avc1.640028"'        │        │
│  │  )                                           │        │
│  │                                              │        │
│  │  sourceBuffer.appendBuffer(fmp4_chunk)      │        │
│  └──────────────────┬──────────────────────────┘        │
│                     │                                    │
│                     ▼                                    │
│  ┌─────────────────────────────────────────────┐        │
│  │ <video> Element                             │        │
│  │  - Decodes and renders video                │        │
│  │  - Hardware accelerated                     │        │
│  └─────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

#### 协议规范

##### 1. WebSocket 消息类型

**文本消息** (JSON - WSRPC格式):

```typescript
// 1️⃣ 连接确认 (后端 → 前端)
{
  "type": "video.connected",
  "timestamp": 1699999999999,
  "data": {
    "serial": "DEVICE123",
    "message": "Video stream connected"
  }
}

// 2️⃣ 视频初始化 (后端 → 前端)
{
  "type": "video.init",
  "timestamp": 1699999999999,
  "data": {
    "serial": "DEVICE123",
    "codec": "h264",
    "width": 1080,
    "height": 2340,
    "fps": 60,
    "bitrate": 8000000
  }
}

// 3️⃣ 视频元数据 (后端 → 前端, 每秒一次)
{
  "type": "video.metadata",
  "timestamp": 1699999999999,
  "data": {
    "fps": 59.8,
    "droppedFrames": 0,
    "latency": 45.2
  }
}

// 4️⃣ 质量控制 (前端 → 后端)
{
  "type": "video.quality",
  "timestamp": 1699999999999,
  "data": {
    "quality": "high"  // or "medium", "low"
  }
}

// 5️⃣ 流控制 (前端 → 后端)
{
  "type": "video.pause",  // or "video.resume"
  "timestamp": 1699999999999,
  "data": {}
}

// 6️⃣ 错误消息 (后端 → 前端)
{
  "type": "video.error",
  "timestamp": 1699999999999,
  "data": {
    "error": "Device disconnected",
    "code": "DEVICE_DISCONNECTED"
  }
}
```

**二进制消息** (fMP4 格式):

```
┌─────────────────────────────────────────────┐
│ First Binary Message: fMP4 Init Segment     │
│ ┌─────────────────────────────────────────┐ │
│ │ ftyp box (File Type)                    │ │
│ │  - major_brand: isom                    │ │
│ │  - compatible_brands: [isom, iso2, ...]│ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ moov box (Movie Header)                 │ │
│ │  ├─ mvhd: Movie header                  │ │
│ │  ├─ trak: Video track                   │ │
│ │  │   ├─ tkhd: Track header              │ │
│ │  │   └─ mdia: Media container           │ │
│ │  │       ├─ mdhd: Media header          │ │
│ │  │       ├─ hdlr: Handler (video)       │ │
│ │  │       └─ minf: Media info            │ │
│ │  │           ├─ vmhd: Video header      │ │
│ │  │           └─ stbl: Sample table      │ │
│ │  │               ├─ stsd: Sample desc   │ │
│ │  │               │    └─ avc1: H.264    │ │
│ │  │               │        ├─ avcC: SPS/PPS│ │
│ │  │               │        └─ ...         │ │
│ │  │               ├─ stts: Time-to-sample│ │
│ │  │               └─ ...                  │ │
│ │  └─ mvex: Movie extends (for fragments) │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
        │
        │ Send ONCE at stream start
        ▼
┌─────────────────────────────────────────────┐
│ Subsequent Binary Messages: Media Segments  │
│ ┌─────────────────────────────────────────┐ │
│ │ moof box (Movie Fragment)               │ │
│ │  ├─ mfhd: Fragment header               │ │
│ │  └─ traf: Track fragment                │ │
│ │      ├─ tfhd: Track fragment header     │ │
│ │      ├─ tfdt: Track fragment decode time│ │
│ │      └─ trun: Track fragment run        │ │
│ │          └─ Contains: sample info       │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ mdat box (Media Data)                   │ │
│ │  └─ Raw H.264 NAL unit(s)               │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
        │
        │ Send CONTINUOUSLY for each frame
        ▼
```

##### 2. MediaSource 配置

**Codec String 选择**:

根据 H.264 Profile Level，选择合适的 codec string:

```typescript
// Baseline Profile (兼容性最好)
const codec = 'video/mp4; codecs="avc1.42E01E"';

// Main Profile (推荐，平衡)
const codec = 'video/mp4; codecs="avc1.4D401F"';

// High Profile (高质量，scrcpy默认)
const codec = 'video/mp4; codecs="avc1.640028"';
//                              ^^  ^^  ^^
//                              │   │   └─ Level 4.0
//                              │   └───── Constraint flags
//                              └───────── Profile (64 = High)
```

**SourceBuffer 配置**:

```typescript
sourceBuffer.mode = 'sequence';  // 使用 sequence 模式
// 'sequence' 模式特点:
// - 忽略帧时间戳，按接收顺序播放
// - 适合实时流媒体
// - 更好的容错性
```

##### 3. 前端实现要点

**useVideoStream.ts 修改**:

```typescript
function handleBinaryMessage(data: ArrayBuffer) {
  // ❌ 删除: parseBinaryFrame() 解析
  // ❌ 删除: Serial/PTS 验证

  // ✅ 直接推送 fMP4 数据
  bufferQueue.push(data);
  processBufferQueue();
}

function processBufferQueue() {
  if (!sourceBuffer.value || isAppending || bufferQueue.length === 0) {
    return;
  }

  if (sourceBuffer.value.updating) {
    return;
  }

  const chunk = bufferQueue.shift();
  if (chunk) {
    isAppending = true;
    sourceBuffer.value.appendBuffer(chunk);  // 直接追加 fMP4
  }
}
```

##### 4. 后端实现要点

**保持当前实现** (已正确):

```python
# video_stream_service.py

# ✅ 1. 发送初始化消息
init_message = {
    "type": "video.init",
    "timestamp": 0,
    "data": {
        "serial": serial,
        "codec": "h264",
        "width": device_info.resolution.width,
        "height": device_info.resolution.height,
        "fps": 60,
        "bitrate": device.params.bit_rate
    }
}
await websocket.send_json(init_message)

# ✅ 2. 发送 fMP4 init segment
init_segment = handler.get_init_segment()
await websocket.send_bytes(init_segment)

# ✅ 3. 流式发送 fMP4 media segments
async for fmp4_chunk in handler.stream_fmp4():
    await websocket.send_bytes(fmp4_chunk)
```

---

## 📊 数据流规范

### 完整交互时序

```
前端                           后端                          设备
 │                              │                             │
 │─────WebSocket Connect────────>│                             │
 │                              │                             │
 │<────video.connected──────────│                             │
 │                              │                             │
 │                              │────start_server()───────────>│
 │                              │                             │
 │                              │<────H.264 SPS/PPS───────────│
 │                              │                             │
 │<────video.init (JSON)────────│                             │
 │                              │                             │
 │<────fMP4 init segment────────│                             │
 │  (Binary, ~1KB)              │                             │
 │                              │                             │
 │  initializeMediaSource()     │                             │
 │  create SourceBuffer         │                             │
 │  appendBuffer(init)          │                             │
 │                              │                             │
 │<────fMP4 media segment───────│<────H.264 frame─────────────│
 │  (Binary, ~5-50KB/frame)     │  (loop)                     │
 │                              │                             │
 │  appendBuffer(media)         │                             │
 │  [video renders]             │                             │
 │                              │                             │
 │<────fMP4 media segment───────│<────H.264 frame─────────────│
 │                              │                             │
 │<────video.metadata (JSON)────│  (every 60 frames)          │
 │  {fps: 60, latency: 45ms}    │                             │
 │                              │                             │
 │────video.pause (JSON)────────>│                             │
 │                              │  [pause flag set]           │
 │                              │                             │
 │────video.resume (JSON)───────>│                             │
 │                              │  [resume streaming]         │
 │                              │                             │
 │<────fMP4 media segment───────│<────H.264 frame─────────────│
 │  (continues...)              │                             │
 │                              │                             │
```

### 错误处理

```typescript
// 前端错误处理
mediaSource.addEventListener('error', (e) => {
  console.error('[useVideoStream] MediaSource error:', e);
  // 重连逻辑
});

sourceBuffer.addEventListener('error', (e) => {
  console.error('[useVideoStream] SourceBuffer error:', e);
  // 清空 buffer，重新初始化
});

// 后端错误处理
try:
    async for fmp4_chunk in handler.stream_fmp4():
        await websocket.send_bytes(fmp4_chunk)
except Exception as e:
    await websocket.send_json({
        "type": "video.error",
        "timestamp": int(time.time() * 1000),
        "data": {"error": str(e), "code": "STREAM_ERROR"}
    })
```

---

## ✅ 一致性检查清单

### 上线前必查项

- [ ] **类型一致性**
  - [ ] `WSRPCMessage` 格式在前后端完全一致
  - [ ] `VideoInitMessage` 字段匹配
  - [ ] `VideoMetadata` 字段匹配
  - [ ] 所有 HTTP API 响应结构匹配 TypeScript 接口

- [ ] **端点一致性**
  - [ ] WebSocket URL: `/ws/video/{serial}` 可访问
  - [ ] HTTP API 路径与 `api-urls.ts` 一致
  - [ ] 端点参数命名规范一致 (snake_case vs camelCase)

- [ ] **协议一致性**
  - [ ] 前端删除 `parseBinaryFrame()` 自定义解析
  - [ ] 后端发送标准 fMP4 格式
  - [ ] MediaSource codec string 正确
  - [ ] SourceBuffer mode = 'sequence'

- [ ] **错误处理一致性**
  - [ ] 所有错误消息使用 `video.error` 类型
  - [ ] 错误消息包含 `error` 和 `code` 字段
  - [ ] 前端正确显示所有错误类型

- [ ] **性能指标一致性**
  - [ ] FPS 计算方法一致
  - [ ] 延迟测量单位一致 (毫秒)
  - [ ] 元数据发送频率合理 (建议 1Hz)

### 开发时检查项

- [ ] **代码审查**
  - [ ] 无硬编码 URL
  - [ ] 使用 `api-urls.ts` 构建所有 URL
  - [ ] 类型导入自 `@/types/pymatrix`
  - [ ] 无重复的类型定义

- [ ] **单元测试**
  - [ ] WebSocket 消息序列化/反序列化测试
  - [ ] MediaSource 初始化测试
  - [ ] SourceBuffer append 测试
  - [ ] 错误场景覆盖

- [ ] **集成测试**
  - [ ] 端到端视频流测试
  - [ ] 断线重连测试
  - [ ] 多设备并发测试
  - [ ] 质量切换测试

---

## 📚 相关文档

- [scrcpy 协议文档](https://github.com/Genymobile/scrcpy/blob/master/doc/develop.md)
- [MSE (Media Source Extensions) API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API)
- [fMP4 格式规范 (ISO BMFF)](https://www.iso.org/standard/68960.html)
- [WebSocket RFC 6455](https://tools.ietf.org/html/rfc6455)

---

## 🔧 维护日志

| 日期 | 版本 | 变更内容 | 作者 |
|------|------|---------|------|
| 2025-11-10 | 1.0.0 | 初始版本，定义桥接规范和MSE协议 | AI Assistant |

