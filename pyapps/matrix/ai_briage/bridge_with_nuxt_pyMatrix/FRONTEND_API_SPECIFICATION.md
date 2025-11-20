# PyMatrix Frontend API Specification
## 前端 API 端点规范

**文档版本**: v1.0
**创建时间**: 2025-11-10
**作者**: Frontend AI
**目的**: 定义 app_pymatrix 前端应用与 Python 后端之间的 API 契约

---

## 目录

1. [概述](#概述)
2. [基础架构](#基础架构)
3. [HTTP API 端点](#http-api-端点)
4. [WebSocket 协议](#websocket-协议)
5. [数据类型定义](#数据类型定义)
6. [错误处理](#错误处理)
7. [实现参考](#实现参考)

---

## 概述

### 技术栈
- **前端**: Nuxt 3 + TypeScript + Vue 3
- **后端**: Python 3 + aiohttp + Scrcpy
- **通信**: HTTP REST API + WebSocket (Binary + JSON)
- **视频编码**: H.264 (via Scrcpy)

### 核心功能
1. 设备发现与管理（ADB 设备扫描）
2. 视频流传输（H.264 over WebSocket）
3. 设备控制（触摸、按键、截图）
4. 录制功能（FFmpeg MP4）

---

## 基础架构

### 端口配置

| 服务 | 默认端口 | 协议 | 用途 |
|------|---------|------|------|
| HTTP API | 8000 | HTTP | RESTful API |
| WebSocket | 8000 | WS | 视频流 + 控制 |
| scrcpy_web_test | 27880 | HTTP/WS | 参考实现 |

### URL 结构

```typescript
// HTTP API Base URL
const HTTP_BASE = "http://localhost:8000";

// WebSocket Base URL
const WS_BASE = "ws://localhost:8000";

// 命名空间标识
const APP_NAMESPACE = "pymatrix";
```

---

## HTTP API 端点

### 1. 获取设备列表

**基于 scrcpy_web_test 的正确实现方式**

```http
GET /api/devices
```

#### 请求头
```json
{
  "X-App-Namespace": "pymatrix",
  "Content-Type": "application/json"
}
```

#### 响应格式
```typescript
{
  "devices": [
    {
      "serial": "R4RCHEKBRWFEEYB6",           // 设备序列号
      "model": "PEAT00",                      // 设备型号
      "manufacturer": "OPPO",                 // 制造商
      "android_version": "12",                // Android 版本
      "status": "device"                      // 设备状态
    }
  ],
  "count": 1                                  // 设备数量
}
```

#### 设备状态枚举
```typescript
type DeviceStatus =
  | "device"        // 已连接且授权
  | "offline"       // 离线
  | "unauthorized"  // 未授权
  | "no permissions"; // 无权限
```

#### 前端实现参考
```typescript
// services/api/pymatrix/pymatrix-device-api.ts
async getDeviceList(): Promise<DeviceListResponse> {
  const response = await $fetch<{ devices: any[] }>(
    `${this.baseUrl}/api/devices`,
    {
      method: 'GET',
      headers: {
        'X-App-Namespace': 'pymatrix',
        'Content-Type': 'application/json'
      }
    }
  );

  return {
    devices: response.devices,
    count: response.devices.length
  };
}
```

### 2. 获取设备详细信息

```http
GET /api/devices/{serial}/info
```

#### 响应格式
```typescript
{
  "device": {
    "serial": "R4RCHEKBRWFEEYB6",
    "model": "PEAT00",
    "manufacturer": "OPPO",
    "android_version": "12",
    "sdk_version": 31,
    "resolution": {
      "width": 1080,
      "height": 2340
    },
    "dpi": 480,
    "battery": {
      "level": 85,
      "status": "charging"
    }
  }
}
```

### 3. 其他设备操作端点

#### 剪贴板操作
```http
GET  /api/devices/{serial}/clipboard      # 获取剪贴板
POST /api/devices/{serial}/clipboard      # 设置剪贴板
```

#### 屏幕控制
```http
POST /api/devices/{serial}/screen/power       # 屏幕电源
POST /api/devices/{serial}/screen/brightness  # 亮度
POST /api/devices/{serial}/screen/rotation    # 旋转
```

---

## WebSocket 协议

### 连接端点

**基于 scrcpy_web_test 的正确实现**

```
ws://localhost:8000/ws
```

**关键特性**:
- ✅ **单一端点**: 所有操作通过一个 WebSocket 连接
- ✅ **命令驱动**: 使用 JSON 命令区分不同操作
- ✅ **二进制流**: 视频数据使用 Binary Frame 传输
- ✅ **多设备支持**: 一个连接可管理多个设备

### 连接配置

```typescript
// composables/useWSRPC.ts
const ws = new WebSocket('ws://localhost:8000/ws');
ws.binaryType = 'arraybuffer';  // 重要：接收二进制数据
```

---

## WebSocket 命令协议

### 1. 启动视频流

#### 请求
```typescript
{
  "command": "start_stream",
  "serial": "R4RCHEKBRWFEEYB6",
  "enable_recording": false  // 可选：是否启用 MP4 录制
}
```

#### 响应 - 新启动流
```typescript
{
  "type": "stream_started",
  "serial": "R4RCHEKBRWFEEYB6",
  "info": {
    "serial": "R4RCHEKBRWFEEYB6",
    "model": "PEAT00",
    "resolution": {
      "width": 720,        // scrcpy max_size 后的分辨率
      "height": 1280
    },
    "dpi": 480,
    "android_version": "12",
    "sdk_version": 31
  }
}
```

#### 响应 - 附加到已存在流
```typescript
{
  "type": "stream_attached",
  "serial": "R4RCHEKBRWFEEYB6",
  "info": { /* 同上 */ }
}
```

#### 错误响应
```typescript
{
  "type": "stream_error",
  "serial": "R4RCHEKBRWFEEYB6",
  "message": "Failed to start stream for R4RCHEKBRWFEEYB6"
}
```

### 2. 停止视频流

#### 请求
```typescript
{
  "command": "stop_stream",
  "serial": "R4RCHEKBRWFEEYB6"
}
```

#### 响应 - 完全停止
```typescript
{
  "type": "stream_stopped",
  "serial": "R4RCHEKBRWFEEYB6"
}
```

#### 响应 - 仅断开当前客户端
```typescript
{
  "type": "stream_detached",
  "serial": "R4RCHEKBRWFEEYB6"
}
```

### 3. 触摸事件

#### 请求格式
```typescript
{
  "command": "touch_event",
  "serial": "R4RCHEKBRWFEEYB6",
  "action": "down" | "move" | "up" | "double_tap",
  "x": 540,           // 设备坐标系 x (0 ~ width-1)
  "y": 960,           // 设备坐标系 y (0 ~ height-1)
  "pressure": 1.0,    // 压力值 0.0 ~ 1.0
  "pointerId": 0      // 多点触控 ID
}
```

#### 触摸动作类型
```typescript
type TouchAction =
  | "down"        // 按下
  | "move"        // 移动
  | "up"          // 抬起
  | "double_tap"; // 双击（自动处理）
```

#### 错误响应
```typescript
{
  "type": "error",
  "serial": "R4RCHEKBRWFEEYB6",
  "message": "Invalid touch payload" | "Device is not streaming"
}
```

### 4. 截图推送（服务器主动推送）

**服务器每 1 秒自动推送一次截图**

```typescript
{
  "type": "screenshot",
  "serial": "R4RCHEKBRWFEEYB6",
  "data": "iVBORw0KGgoAAAANS..." // PNG 格式的 base64 字符串
}
```

---

## 视频流二进制协议

### 帧格式

**参考 scrcpy_web_test/server.py 的 `_broadcast_frame` 方法**

```
+-------------------+------------------+------------------+------------------+------------------+
| Serial Length (1) | Serial (N bytes) | PTS (8 bytes)    | Size (4 bytes)   | H.264 Data (N)   |
+-------------------+------------------+------------------+------------------+------------------+
```

#### 字段说明

| 字段 | 类型 | 字节数 | 说明 |
|------|------|--------|------|
| Serial Length | uint8 | 1 | 设备序列号长度（最大 255） |
| Serial | string | N | 设备序列号（UTF-8） |
| PTS | uint64 | 8 | 显示时间戳（Big Endian） |
| Size | uint32 | 4 | H.264 数据大小（Big Endian） |
| H.264 Data | bytes | N | 原始 H.264 视频数据 |

#### PTS 标志位

```typescript
const PTS_MASK           = 0x3FFFFFFFFFFFFFFF; // 低 62 位
const FLAG_CONFIG_FRAME  = 0x8000000000000000; // 第 63 位：配置帧（SPS/PPS）
const FLAG_KEY_FRAME     = 0x4000000000000000; // 第 62 位：关键帧（I-frame）

// 解析 PTS
const pts = parsedPts & PTS_MASK;
const isConfigFrame = !!(parsedPts & FLAG_CONFIG_FRAME);
const isKeyFrame = !!(parsedPts & FLAG_KEY_FRAME);
```

### 前端解析实现

```typescript
// composables/useWSRPC.ts
ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    const view = new DataView(event.data);
    let offset = 0;

    // 1. 读取序列号长度
    const serialLength = view.getUint8(offset);
    offset += 1;

    // 2. 读取序列号
    const serialBytes = new Uint8Array(event.data, offset, serialLength);
    const serial = new TextDecoder('utf-8').decode(serialBytes);
    offset += serialLength;

    // 3. 读取 PTS（Big Endian）
    const ptsHigh = view.getUint32(offset, false);
    const ptsLow = view.getUint32(offset + 4, false);
    const pts = (BigInt(ptsHigh) << 32n) | BigInt(ptsLow);
    const isConfigFrame = !!(pts & 0x8000000000000000n);
    const isKeyFrame = !!(pts & 0x4000000000000000n);
    offset += 8;

    // 4. 读取数据大小
    const size = view.getUint32(offset, false);
    offset += 4;

    // 5. 提取 H.264 数据
    const h264Data = event.data.slice(offset, offset + size);

    // 6. 传递给 MediaSource/WebCodecs
    processVideoFrame(serial, h264Data, {
      pts: pts & 0x3FFFFFFFFFFFFFFFn,
      isConfigFrame,
      isKeyFrame
    });
  }
};
```

---

## 数据类型定义

### TypeScript 类型定义

```typescript
// types/pymatrix.ts

/**
 * 设备信息
 */
export interface Device {
  serial: string;
  name: string;
  model: string;
  manufacturer?: string;
  android_version?: string;
  sdk_version?: number;
  state: 'connected' | 'disconnected' | 'connecting';
  resolution: {
    width: number;
    height: number;
  };
  dpi?: number;
  streaming: boolean;
  controllable: boolean;
  isHost: boolean;
}

/**
 * WebSocket 消息
 */
export interface WSRPCMessage {
  type: string;
  timestamp?: number;
  data?: any;
  serial?: string;
}

/**
 * 视频流信息
 */
export interface VideoStreamInfo {
  serial: string;
  model: string;
  resolution: {
    width: number;
    height: number;
  };
  dpi: number;
  android_version: string;
  sdk_version: number;
}

/**
 * 视频帧元数据
 */
export interface VideoFrameMetadata {
  pts: bigint;
  size: number;
  isConfigFrame: boolean;
  isKeyFrame: boolean;
}

/**
 * 触摸事件
 */
export interface TouchEventData {
  action: 'down' | 'move' | 'up' | 'double_tap';
  x: number;
  y: number;
  pressure: number;
  pointerId: number;
}
```

---

## 错误处理

### 错误代码

| 代码 | 消息 | 说明 |
|------|------|------|
| `DEVICE_NOT_FOUND` | Device not found | 设备未连接或不存在 |
| `STREAM_START_FAILED` | Failed to start stream | 无法启动视频流 |
| `DEVICE_NOT_STREAMING` | Device is not streaming | 设备未在流式传输 |
| `INVALID_COMMAND` | Invalid command | 无效的 WebSocket 命令 |
| `TOUCH_EVENT_REJECTED` | Touch event rejected | 触摸事件被拒绝 |
| `CLIENT_NOT_ATTACHED` | Client is not attached to this stream | 客户端未附加到流 |

### 错误响应格式

```typescript
{
  "type": "error",
  "serial"?: "R4RCHEKBRWFEEYB6",  // 可选
  "message": "Error description",
  "code"?: "ERROR_CODE"            // 可选
}
```

---

## 实现参考

### 参考项目
**scrcpy_web_test** (`D:/programing/core_node/pyapps/scrcpy_web_test`)

#### 关键文件
1. **server.py** - Python 后端实现
   - `DeviceScanner` - ADB 设备扫描
   - `VideoStreamManager` - 视频流管理
   - `handle_websocket` - WebSocket 处理
   - `_broadcast_frame` - 帧广播逻辑

2. **index.html** - 前端实现
   - WebSocket 连接管理
   - 二进制帧解析
   - 触摸事件发送

3. **VIDEO_STREAMING_EXPLAINED.md** - 技术说明
   - H.264 视频流原理
   - FFmpeg 录制实现
   - 浏览器解码方案

### 测试命令

```bash
# 启动参考服务器
cd D:/programing/core_node/pyapps/scrcpy_web_test
python server.py

# 访问测试页面
http://localhost:27880

# 查看 API
http://localhost:27880/api/devices
```

---

## 后端实现要求

### 必须实现的端点

#### HTTP API
- ✅ `GET /api/devices` - 设备列表（ADB 扫描）
- ✅ `GET /api/devices/{serial}/info` - 设备详情

#### WebSocket 命令
- ✅ `start_stream` - 启动视频流
- ✅ `stop_stream` - 停止视频流
- ✅ `touch_event` - 触摸事件注入

#### WebSocket 推送
- ✅ 二进制帧（H.264 视频数据）
- ✅ `screenshot` - 截图推送（每秒）
- ✅ `stream_started/attached` - 流启动确认
- ✅ `stream_stopped/detached` - 流停止确认
- ✅ `error` - 错误消息

### 技术要求

1. **ADB 设备扫描**
   ```python
   subprocess.run(["adb", "devices", "-l"])
   subprocess.run(["adb", "-s", serial, "shell", "getprop", prop])
   ```

2. **Scrcpy 集成**
   ```python
   from pyfoundations.device.scrcpy_device import ScrcpyDevice
   device = ScrcpyDevice(serial, ServerParams(...))
   device.start_server()
   frame = device.read_video_frame()  # 返回 { 'data': bytes, 'pts': int, 'size': int, 'is_keyframe': bool }
   ```

3. **WebSocket 广播**
   - 支持多客户端订阅同一设备流
   - 客户端断开时自动清理
   - 无客户端时自动停止流

4. **二进制帧格式**（参考 server.py:388-390）
   ```python
   header = struct.pack(">QI", pts, size)
   prefix = bytes([len(serial_bytes)]) + serial_bytes + header
   payload = prefix + frame['data']
   await ws.send_bytes(payload)
   ```

---

## 前端实现指南

### 1. WebSocket 连接管理

```typescript
// composables/useWSRPC.ts
const ws = new WebSocket('ws://localhost:8000/ws');
ws.binaryType = 'arraybuffer';

ws.onopen = () => {
  // 发送启动流命令
  ws.send(JSON.stringify({
    command: 'start_stream',
    serial: 'R4RCHEKBRWFEEYB6'
  }));
};

ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    // 处理二进制帧（视频数据）
    handleBinaryFrame(event.data);
  } else {
    // 处理 JSON 消息
    const message = JSON.parse(event.data);
    handleTextMessage(message);
  }
};
```

### 2. 视频播放（MediaSource API）

```typescript
// composables/useVideoStream.ts
const mediaSource = new MediaSource();
videoElement.src = URL.createObjectURL(mediaSource);

mediaSource.addEventListener('sourceopen', () => {
  const codec = 'video/mp4; codecs="avc1.64001F"';
  const sourceBuffer = mediaSource.addSourceBuffer(codec);
  sourceBuffer.mode = 'sequence';

  // 接收 H.264 数据后追加到 buffer
  sourceBuffer.appendBuffer(h264Data);
});
```

### 3. 触摸控制

```typescript
// composables/useDeviceControl.ts
function sendTouchEvent(action: string, x: number, y: number) {
  ws.send(JSON.stringify({
    command: 'touch_event',
    serial: deviceSerial,
    action: action,
    x: x,
    y: y,
    pressure: 1.0,
    pointerId: 0
  }));
}

// Canvas 触摸事件
canvas.addEventListener('mousedown', (e) => {
  const { x, y } = canvasToDeviceCoords(e.offsetX, e.offsetY);
  sendTouchEvent('down', x, y);
});
```

---

## 性能优化建议

### 1. 视频流优化
- 使用 `sourceBuffer.mode = 'sequence'` 简化 PTS 处理
- 实现缓冲队列，避免 `appendBuffer` 调用冲突
- 监控 `sourceBuffer.buffered` 范围，防止内存溢出

### 2. 连接管理
- 实现自动重连机制（指数退避）
- 心跳检测（WebSocket ping/pong）
- 超时处理（30 秒无数据则断开）

### 3. 错误恢复
- 视频流中断自动重启
- MediaSource 错误后重新初始化
- 网络错误后提示用户

---

## 测试清单

### HTTP API 测试
- [ ] `GET /api/devices` 返回正确的设备列表
- [ ] 设备属性完整（serial, model, manufacturer, android_version）
- [ ] 错误处理（无设备时返回空列表）

### WebSocket 测试
- [ ] 连接成功后能发送命令
- [ ] `start_stream` 收到 `stream_started` 响应
- [ ] 接收到二进制视频帧
- [ ] `stop_stream` 收到 `stream_stopped` 响应
- [ ] 触摸事件成功注入到设备
- [ ] 收到截图推送（每秒一次）

### 视频播放测试
- [ ] MediaSource 成功初始化
- [ ] SourceBuffer 正常追加数据
- [ ] 视频正常播放，无卡顿
- [ ] 延迟 < 200ms
- [ ] 多设备同时播放正常

---

## 版本历史

| 版本 | 日期 | 作者 | 说明 |
|------|------|------|------|
| v1.0 | 2025-11-10 | Frontend AI | 初始版本，基于 scrcpy_web_test 实现 |

---

## 联系方式

**前端 AI**: 负责 Nuxt app_pymatrix 前端实现
**后端 AI**: 负责 Python pyMatrix 后端实现
**桥接文件**: `D:/programing/core_node/pyapps/matrix/ai_briage/AI_COLLABORATION_BRIDGE.json`

---

**注意事项**:
1. ⚠️ 本规范基于 `scrcpy_web_test` 的正确实现方式
2. ⚠️ 后端必须严格遵循此规范实现 API
3. ⚠️ 前端已按此规范实现，后端应适配前端需求
4. ⚠️ WebSocket 使用单一端点 `/ws`，通过命令区分操作
5. ⚠️ 视频数据使用二进制帧传输，格式见上文详细说明
