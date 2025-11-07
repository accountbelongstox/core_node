# pyMatrix Web 端通信规范文档

> **统一的前后端通信协议 - 解决文档冲突，建立标准规范**
>
> 适用于：pyMatrix Web 端（Python 后端 + Nuxt 前端）

---

## 📋 冲突分析与方案选择

### 问题背景

现有文档由不同 AI 编写，存在以下通信方案冲突：

| 冲突点 | 方案 A | 方案 B | 选择结果 |
|--------|--------|--------|----------|
| **WebSocket 实现** | Socket.io (python-socketio) | 原生 WebSocket (websockets) | ✅ **原生 WebSocket** |
| **视频流方案** | MSE + WebRTC | 仅 MSE | ✅ **MSE** |
| **控制消息** | Socket.io events | WebSocket JSON | ✅ **WebSocket JSON** |
| **REST API** | FastAPI | FastAPI | ✅ **FastAPI** (统一) |

### 选择理由

#### 为什么选择原生 WebSocket？

**Socket.io 的问题**：
- 需要额外依赖 `python-socketio` + `socket.io-client`
- 协议复杂（包含握手、心跳、重连等封装层）
- 增加调试难度
- 与 FastAPI 集成需要额外配置

**原生 WebSocket 的优势**：
- FastAPI 原生支持（`from fastapi import WebSocket`）
- 浏览器原生支持（`new WebSocket(...)`）
- 协议简单，易于调试
- 性能更好（无额外协议开销）

#### 为什么选择 MSE 而非 WebRTC？

**MSE 优势**：
- 实现简单（H.264 → fMP4 → MSE）
- 浏览器兼容性好
- 延迟可控（100-300ms 满足需求）
- 单向流适合投屏场景

**WebRTC 问题**：
- 实现复杂（需要 STUN/TURN 服务器）
- 调试困难
- 过度设计（双向通信不是必需）

---

## 🏗️ 统一架构设计

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      Web Browser Client                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │             Nuxt 3 Frontend Application                    │ │
│  │                                                             │ │
│  │  ┌─────────────────┐        ┌──────────────────┐          │ │
│  │  │  HTTP Client    │        │  WebSocket Pool  │          │ │
│  │  │  (axios/$fetch) │        │  (100 connections)│          │ │
│  │  └────────┬────────┘        └─────────┬────────┘          │ │
│  │           │ REST API                   │ WS Binary         │ │
│  │           │ (JSON)                     │ (Video + Control) │ │
│  └───────────┼────────────────────────────┼──────────────────┘ │
└───────────────┼────────────────────────────┼────────────────────┘
                │                            │
                ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              Python Backend Server (FastAPI + Uvicorn)          │
│                                                                  │
│  ┌────────────────────────┐    ┌────────────────────────────┐  │
│  │   REST API Endpoints   │    │   WebSocket Endpoints      │  │
│  │   (HTTP + JSON)        │    │   (Binary + JSON)          │  │
│  │                        │    │                            │  │
│  │  GET  /api/devices     │    │  /ws/video/{serial}       │  │
│  │  POST /api/connect     │    │  /ws/control/{serial}     │  │
│  │  POST /api/control     │    │  /ws/group                │  │
│  └────────┬───────────────┘    └─────────┬──────────────────┘  │
│           │                               │                     │
│           └───────────┬───────────────────┘                     │
│                       │                                         │
│  ┌────────────────────▼───────────────────────────────────────┐│
│  │                 Business Logic Layer                       ││
│  │  - DeviceManager: 设备管理                                 ││
│  │  - StreamManager: 视频流管理                               ││
│  │  - ControlManager: 控制消息处理                            ││
│  │  - GroupController: 群控逻辑                               ││
│  └────────────────────┬───────────────────────────────────────┘│
│                       │                                         │
└───────────────────────┼─────────────────────────────────────────┘
                        │
                        │ ADB Protocol
                        ▼
            ┌──────────────────────┐
            │   Android Devices    │
            │  (100台移动设备)      │
            └──────────────────────┘
```

---

## 📡 通信协议详细规范

### 1. REST API 通信规范

#### 1.1 基础配置

**Base URL**: `http://localhost:8000/api`

**请求格式**: JSON
```http
Content-Type: application/json
```

**响应格式**: JSON
```typescript
interface APIResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: {
    code: string
    detail: string
  }
  timestamp: string
}
```

#### 1.2 设备管理 API

##### GET /api/devices - 获取设备列表

**请求**：
```http
GET /api/devices HTTP/1.1
Host: localhost:8000
```

**响应**：
```json
{
  "success": true,
  "data": [
    {
      "serial": "ABC123DEF456",
      "name": "Pixel 6 Pro",
      "model": "Pixel 6 Pro",
      "state": "connected",
      "resolution": {
        "width": 1440,
        "height": 3120
      },
      "streaming": false,
      "controllable": false
    }
  ],
  "timestamp": "2025-10-30T10:30:00Z"
}
```

##### POST /api/devices/connect - 连接设备

**请求**：
```json
{
  "serial": "ABC123DEF456",
  "maxSize": 720,
  "bitRate": 8000000,
  "maxFps": 60,
  "control": true
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "serial": "ABC123DEF456",
    "videoPort": 27183,
    "controlPort": 27184,
    "wsUrl": "ws://localhost:8000/ws/video/ABC123DEF456"
  },
  "message": "Device connected successfully",
  "timestamp": "2025-10-30T10:31:00Z"
}
```

##### POST /api/devices/disconnect - 断开设备

**请求**：
```json
{
  "serial": "ABC123DEF456"
}
```

**响应**：
```json
{
  "success": true,
  "message": "Device disconnected",
  "timestamp": "2025-10-30T10:32:00Z"
}
```

---

### 2. WebSocket 通信规范

#### 2.1 连接规范

##### 视频流 WebSocket

**连接 URL**：
```
ws://localhost:8000/ws/video/{serial}
```

**示例**：
```typescript
const ws = new WebSocket('ws://localhost:8000/ws/video/ABC123DEF456')
ws.binaryType = 'arraybuffer'
```

##### 控制 WebSocket

**连接 URL**：
```
ws://localhost:8000/ws/control/{serial}
```

##### 群控 WebSocket

**连接 URL**：
```
ws://localhost:8000/ws/group
```

#### 2.2 消息格式规范

WebSocket 消息分为两种类型：

1. **二进制消息**（视频流数据）
2. **文本消息**（控制指令，JSON 格式）

##### 文本消息统一格式

```typescript
interface WSMessage {
  type: string           // 消息类型
  timestamp: number      // Unix 时间戳（毫秒）
  data: any             // 消息数据
}
```

---

### 3. 视频流通信规范

#### 3.1 视频流传输流程

```
Android Device (H.264)
    ↓ (scrcpy-server)
Python Backend (PyAV)
    ↓ 1. 解析 H.264 packets
    ↓ 2. 封装为 fMP4 (fragmented MP4)
    ↓ 3. 分片传输
WebSocket Binary
    ↓ (arraybuffer)
Browser (MSE API)
    ↓ appendBuffer()
<video> element
```

#### 3.2 视频 WebSocket 消息类型

##### 服务端 → 客户端

**消息类型 1: 初始化信息（文本 JSON）**

首次连接时发送：
```json
{
  "type": "init",
  "timestamp": 1698765432000,
  "data": {
    "serial": "ABC123DEF456",
    "codec": "video/mp4; codecs=\"avc1.64001F\"",
    "width": 1440,
    "height": 3120,
    "fps": 60,
    "bitrate": 8000000
  }
}
```

**消息类型 2: 视频数据块（二进制）**

持续发送：
```
Binary ArrayBuffer:
[fMP4 fragment chunk data]
```

**消息类型 3: 元数据更新（文本 JSON）**

```json
{
  "type": "metadata",
  "timestamp": 1698765433000,
  "data": {
    "fps": 58,
    "droppedFrames": 2,
    "latency": 120
  }
}
```

##### 客户端 → 服务端

**消息类型 1: 订阅/取消订阅**

```json
{
  "type": "subscribe",
  "timestamp": 1698765432000,
  "data": {
    "quality": "high"  // high | medium | low
  }
}
```

```json
{
  "type": "unsubscribe",
  "timestamp": 1698765432000,
  "data": {}
}
```

**消息类型 2: 质量切换**

```json
{
  "type": "changeQuality",
  "timestamp": 1698765433000,
  "data": {
    "quality": "medium",
    "fps": 30,
    "bitrate": 4000000
  }
}
```

#### 3.3 质量配置

```typescript
interface VideoQuality {
  name: 'high' | 'medium' | 'low'
  fps: number
  bitrate: number
  resolution: {
    width: number
    height: number
  }
}

const QualityPresets: Record<string, VideoQuality> = {
  high: {
    name: 'high',
    fps: 60,
    bitrate: 8000000,
    resolution: { width: 1440, height: 3120 }
  },
  medium: {
    name: 'medium',
    fps: 30,
    bitrate: 4000000,
    resolution: { width: 720, height: 1560 }
  },
  low: {
    name: 'low',
    fps: 15,
    bitrate: 2000000,
    resolution: { width: 540, height: 1170 }
  }
}
```

---

### 4. 单机控制通信规范

#### 4.1 控制流程

```
用户操作 (Nuxt UI)
    ↓ Mouse/Keyboard Event
Event Handler
    ↓ 转换为控制消息
WebSocket (ws://localhost:8000/ws/control/{serial})
    ↓ JSON 格式
Python Backend
    ↓ 解析消息
ControlMsg (序列化为二进制)
    ↓ scrcpy 协议
ADB Socket
    ↓
Android Device 执行
```

#### 4.2 控制 WebSocket 消息类型

##### 客户端 → 服务端

**消息类型 1: 触摸事件**

```json
{
  "type": "touch",
  "timestamp": 1698765432000,
  "data": {
    "action": "down",  // down | up | move
    "pointerId": 0,
    "x": 500,
    "y": 1000,
    "pressure": 1.0,
    "screenWidth": 1440,
    "screenHeight": 3120
  }
}
```

**消息类型 2: 按键事件**

```json
{
  "type": "key",
  "timestamp": 1698765432000,
  "data": {
    "action": "down",  // down | up
    "keyCode": 4,      // Android KeyCode (4 = BACK)
    "metaState": 0
  }
}
```

**消息类型 3: 文本输入**

```json
{
  "type": "text",
  "timestamp": 1698765432000,
  "data": {
    "text": "Hello World"
  }
}
```

**消息类型 4: 滚动事件**

```json
{
  "type": "scroll",
  "timestamp": 1698765432000,
  "data": {
    "x": 500,
    "y": 1000,
    "hScroll": 0,
    "vScroll": -10,  // 负数向上滚动
    "screenWidth": 1440,
    "screenHeight": 3120
  }
}
```

**消息类型 5: 系统按键**

```json
{
  "type": "system",
  "timestamp": 1698765432000,
  "data": {
    "action": "home"  // home | back | recent | power | volume_up | volume_down
  }
}
```

##### 服务端 → 客户端

**消息类型 1: 确认**

```json
{
  "type": "ack",
  "timestamp": 1698765432001,
  "data": {
    "messageId": "xxx",
    "success": true
  }
}
```

**消息类型 2: 错误**

```json
{
  "type": "error",
  "timestamp": 1698765432001,
  "data": {
    "code": "INVALID_COORDINATES",
    "message": "Touch coordinates out of bounds"
  }
}
```

#### 4.3 坐标映射规范

**问题**：前端显示尺寸与设备真实分辨率不同

**解决**：客户端发送时附带屏幕尺寸，服务端进行映射

```python
# Python 服务端
def map_coordinates(x: int, y: int,
                   from_width: int, from_height: int,
                   to_width: int, to_height: int) -> tuple[int, int]:
    """
    坐标映射
    from: 前端显示尺寸
    to: 设备真实分辨率
    """
    mapped_x = int(x * to_width / from_width)
    mapped_y = int(y * to_height / from_height)
    return mapped_x, mapped_y
```

```typescript
// Nuxt 前端
function sendTouch(event: MouseEvent) {
  const rect = videoElement.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  ws.send(JSON.stringify({
    type: 'touch',
    timestamp: Date.now(),
    data: {
      action: 'down',
      pointerId: 0,
      x: x,
      y: y,
      pressure: 1.0,
      screenWidth: rect.width,   // 前端显示宽度
      screenHeight: rect.height  // 前端显示高度
    }
  }))
}
```

---

### 5. 群控通信规范

#### 5.1 群控流程

```
用户操作主控设备 (Nuxt UI)
    ↓ Mouse/Touch Event
Event Handler
    ↓ 标记为群控事件
WebSocket (ws://localhost:8000/ws/group)
    ↓ JSON 消息
Python Backend (GroupController)
    ↓ 广播到群组所有设备
    ├─→ Device A WebSocket (坐标映射)
    ├─→ Device B WebSocket (坐标映射)
    └─→ Device C WebSocket (坐标映射)
```

#### 5.2 群控 WebSocket 消息类型

##### 客户端 → 服务端

**消息类型 1: 加入群组**

```json
{
  "type": "group.join",
  "timestamp": 1698765432000,
  "data": {
    "serial": "ABC123DEF456",
    "role": "host"  // host | slave
  }
}
```

**消息类型 2: 退出群组**

```json
{
  "type": "group.leave",
  "timestamp": 1698765432000,
  "data": {
    "serial": "ABC123DEF456"
  }
}
```

**消息类型 3: 群控操作**

```json
{
  "type": "group.control",
  "timestamp": 1698765432000,
  "data": {
    "hostSerial": "ABC123DEF456",
    "action": {
      "type": "touch",
      "action": "down",
      "x": 500,
      "y": 1000,
      "screenWidth": 1440,
      "screenHeight": 3120
    }
  }
}
```

##### 服务端 → 客户端

**消息类型 1: 群组状态更新**

```json
{
  "type": "group.status",
  "timestamp": 1698765432001,
  "data": {
    "groupId": "group-001",
    "hostSerial": "ABC123DEF456",
    "slaves": [
      {
        "serial": "GHI789JKL012",
        "name": "Pixel 7",
        "resolution": { "width": 1080, "height": 2400 }
      },
      {
        "serial": "MNO345PQR678",
        "name": "Pixel 8",
        "resolution": { "width": 1080, "height": 2400 }
      }
    ],
    "totalDevices": 3
  }
}
```

**消息类型 2: 群控执行结果**

```json
{
  "type": "group.result",
  "timestamp": 1698765432002,
  "data": {
    "hostSerial": "ABC123DEF456",
    "results": [
      { "serial": "GHI789JKL012", "success": true },
      { "serial": "MNO345PQR678", "success": false, "error": "Device offline" }
    ]
  }
}
```

#### 5.3 群控坐标映射

**关键技术**：主控设备和从属设备分辨率可能不同，需要坐标映射

```python
# Python 服务端
class GroupController:
    def broadcast_touch(self, host_serial: str, touch_data: dict):
        """广播触摸事件到群组所有从属设备"""
        host_device = self.get_device(host_serial)
        host_resolution = host_device.get_resolution()

        # 计算相对位置
        x_ratio = touch_data['x'] / touch_data['screenWidth']
        y_ratio = touch_data['y'] / touch_data['screenHeight']

        # 广播到所有从属设备
        for slave_serial in self.get_slaves(host_serial):
            slave_device = self.get_device(slave_serial)
            slave_resolution = slave_device.get_resolution()

            # 映射到从属设备的坐标
            mapped_x = int(x_ratio * slave_resolution['width'])
            mapped_y = int(y_ratio * slave_resolution['height'])

            # 发送控制消息
            await slave_device.send_touch({
                'action': touch_data['action'],
                'x': mapped_x,
                'y': mapped_y,
                'pressure': touch_data['pressure']
            })
```

---

## 🔧 实现示例

### Python 后端实现

#### video_stream_server.py

```python
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List
import asyncio
import av

class VideoStreamServer:
    """视频流服务器"""

    def __init__(self):
        self._streams: Dict[str, List[WebSocket]] = {}

    async def handle_video_client(self, websocket: WebSocket, serial: str):
        """处理视频流客户端连接"""
        await websocket.accept()

        # 添加到订阅列表
        if serial not in self._streams:
            self._streams[serial] = []
        self._streams[serial].append(websocket)

        # 发送初始化信息
        device = DeviceManager.instance().get_device(serial)
        init_msg = {
            "type": "init",
            "timestamp": int(time.time() * 1000),
            "data": {
                "serial": serial,
                "codec": "video/mp4; codecs=\"avc1.64001F\"",
                "width": device.width,
                "height": device.height,
                "fps": device.fps,
                "bitrate": device.bitrate
            }
        }
        await websocket.send_text(json.dumps(init_msg))

        try:
            # 保持连接，等待客户端消息
            while True:
                data = await websocket.receive_text()
                msg = json.loads(data)

                if msg['type'] == 'changeQuality':
                    await self._change_quality(serial, msg['data'])

        except WebSocketDisconnect:
            # 移除订阅
            self._streams[serial].remove(websocket)

    async def broadcast_video_chunk(self, serial: str, chunk: bytes):
        """广播视频数据块到所有订阅的客户端"""
        if serial not in self._streams:
            return

        # 并发发送到所有客户端
        tasks = []
        for ws in self._streams[serial]:
            tasks.append(ws.send_bytes(chunk))

        await asyncio.gather(*tasks, return_exceptions=True)
```

#### control_websocket.py

```python
from fastapi import WebSocket
import json

class ControlWebSocketHandler:
    """控制 WebSocket 处理器"""

    async def handle_control_client(self, websocket: WebSocket, serial: str):
        """处理控制客户端连接"""
        await websocket.accept()

        device = DeviceManager.instance().get_device(serial)

        try:
            while True:
                data = await websocket.receive_text()
                msg = json.loads(data)

                # 根据消息类型分发处理
                if msg['type'] == 'touch':
                    await self._handle_touch(device, msg['data'])
                elif msg['type'] == 'key':
                    await self._handle_key(device, msg['data'])
                elif msg['type'] == 'text':
                    await self._handle_text(device, msg['data'])
                elif msg['type'] == 'scroll':
                    await self._handle_scroll(device, msg['data'])
                elif msg['type'] == 'system':
                    await self._handle_system(device, msg['data'])

                # 发送确认
                ack = {
                    "type": "ack",
                    "timestamp": int(time.time() * 1000),
                    "data": {"success": True}
                }
                await websocket.send_text(json.dumps(ack))

        except WebSocketDisconnect:
            pass

    async def _handle_touch(self, device, data: dict):
        """处理触摸事件"""
        # 坐标映射
        mapped_x, mapped_y = self._map_coordinates(
            data['x'], data['y'],
            data['screenWidth'], data['screenHeight'],
            device.width, device.height
        )

        # 发送触摸消息到设备
        control_msg = ControlMsg(ControlMsgType.INJECT_TOUCH)
        control_msg.set_touch_data(
            action=data['action'],
            x=mapped_x,
            y=mapped_y,
            pressure=data['pressure']
        )

        await device.send_control_msg(control_msg)

    def _map_coordinates(self, x: int, y: int,
                        from_w: int, from_h: int,
                        to_w: int, to_h: int) -> tuple[int, int]:
        """坐标映射"""
        mapped_x = int(x * to_w / from_w)
        mapped_y = int(y * to_h / from_h)
        return mapped_x, mapped_y
```

---

### Nuxt 前端实现

#### useVideoStream.ts

```typescript
// composables/useVideoStream.ts
import { ref, onMounted, onUnmounted } from 'vue'

export function useVideoStream(deviceSerial: string) {
  const videoElement = ref<HTMLVideoElement>()
  const mediaSource = ref<MediaSource>()
  const sourceBuffer = ref<SourceBuffer>()
  const ws = ref<WebSocket>()
  const connected = ref(false)
  const metrics = ref({
    fps: 0,
    droppedFrames: 0,
    latency: 0
  })

  const connect = async () => {
    // 1. 创建 MediaSource
    mediaSource.value = new MediaSource()
    videoElement.value!.src = URL.createObjectURL(mediaSource.value)

    // 2. 等待 sourceopen
    await new Promise(resolve => {
      mediaSource.value!.addEventListener('sourceopen', resolve, { once: true })
    })

    // 3. 连接 WebSocket
    ws.value = new WebSocket(`ws://localhost:8000/ws/video/${deviceSerial}`)
    ws.value.binaryType = 'arraybuffer'

    ws.value.onopen = () => {
      connected.value = true
    }

    ws.value.onmessage = (event) => {
      if (typeof event.data === 'string') {
        // JSON 消息
        const msg = JSON.parse(event.data)
        handleTextMessage(msg)
      } else {
        // 二进制视频数据
        appendVideoChunk(event.data)
      }
    }

    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error)
      connected.value = false
    }

    ws.value.onclose = () => {
      connected.value = false
    }
  }

  const handleTextMessage = (msg: any) => {
    if (msg.type === 'init') {
      // 创建 SourceBuffer
      sourceBuffer.value = mediaSource.value!.addSourceBuffer(msg.data.codec)
    } else if (msg.type === 'metadata') {
      metrics.value = msg.data
    }
  }

  const appendVideoChunk = (chunk: ArrayBuffer) => {
    if (!sourceBuffer.value || sourceBuffer.value.updating) {
      return
    }

    try {
      sourceBuffer.value.appendBuffer(chunk)
    } catch (e) {
      console.error('Failed to append buffer:', e)
    }
  }

  const changeQuality = (quality: 'high' | 'medium' | 'low') => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      return
    }

    ws.value.send(JSON.stringify({
      type: 'changeQuality',
      timestamp: Date.now(),
      data: { quality }
    }))
  }

  const disconnect = () => {
    if (ws.value) {
      ws.value.close()
    }
    if (mediaSource.value) {
      mediaSource.value.endOfStream()
    }
  }

  return {
    videoElement,
    connected,
    metrics,
    connect,
    disconnect,
    changeQuality
  }
}
```

#### useDeviceControl.ts

```typescript
// composables/useDeviceControl.ts
import { ref } from 'vue'

export function useDeviceControl(deviceSerial: string) {
  const ws = ref<WebSocket>()
  const connected = ref(false)

  const connect = () => {
    ws.value = new WebSocket(`ws://localhost:8000/ws/control/${deviceSerial}`)

    ws.value.onopen = () => {
      connected.value = true
    }

    ws.value.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'error') {
        console.error('Control error:', msg.data.message)
      }
    }

    ws.value.onerror = (error) => {
      console.error('Control WebSocket error:', error)
      connected.value = false
    }

    ws.value.onclose = () => {
      connected.value = false
    }
  }

  const sendTouch = (action: 'down' | 'up' | 'move', x: number, y: number, screenWidth: number, screenHeight: number) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      return
    }

    ws.value.send(JSON.stringify({
      type: 'touch',
      timestamp: Date.now(),
      data: {
        action,
        pointerId: 0,
        x,
        y,
        pressure: 1.0,
        screenWidth,
        screenHeight
      }
    }))
  }

  const sendKey = (action: 'down' | 'up', keyCode: number) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      return
    }

    ws.value.send(JSON.stringify({
      type: 'key',
      timestamp: Date.now(),
      data: {
        action,
        keyCode,
        metaState: 0
      }
    }))
  }

  const sendText = (text: string) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      return
    }

    ws.value.send(JSON.stringify({
      type: 'text',
      timestamp: Date.now(),
      data: { text }
    }))
  }

  const sendSystemKey = (action: string) => {
    if (!ws.value || ws.value.readyState !== WebSocket.OPEN) {
      return
    }

    ws.value.send(JSON.stringify({
      type: 'system',
      timestamp: Date.now(),
      data: { action }
    }))
  }

  const disconnect = () => {
    if (ws.value) {
      ws.value.close()
    }
  }

  return {
    connected,
    connect,
    disconnect,
    sendTouch,
    sendKey,
    sendText,
    sendSystemKey
  }
}
```

---

## 📊 性能指标

| 指标 | 目标值 | 测量方法 |
|------|--------|----------|
| 视频延迟 | < 300ms | 时间戳对比 |
| 控制延迟 | < 100ms | 时间戳对比 |
| 丢帧率 | < 5% | FPS 计数 |
| WebSocket 重连时间 | < 2s | 连接时间戳 |
| 坐标精度 | ±5px | 触摸点对比 |

---

## 🔒 安全考虑

### 1. WebSocket 认证

```typescript
// 添加 token 认证
ws = new WebSocket('ws://localhost:8000/ws/video/ABC123?token=xxx')
```

### 2. 消息验证

```python
# Python 服务端验证
def validate_control_message(msg: dict) -> bool:
    if 'type' not in msg or 'timestamp' not in msg:
        return False

    # 验证时间戳（防止重放攻击）
    now = time.time() * 1000
    if abs(now - msg['timestamp']) > 5000:  # 5秒内有效
        return False

    return True
```

---

## 📝 总结

### 统一的技术选型

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| **REST API** | FastAPI | 高性能、易用 |
| **WebSocket** | 原生 WebSocket | 简单、高效 |
| **视频流** | MSE (H.264 → fMP4) | 兼容性好、延迟可控 |
| **控制协议** | JSON over WebSocket | 易于调试、扩展性好 |
| **坐标映射** | 服务端处理 | 统一逻辑、减少客户端复杂度 |

### 通信流程总结

```
前端操作 → WebSocket (JSON) → Python 后端 → ADB → Android 设备
              ↑                     ↓
              └─── Video Stream ────┘
                   (Binary fMP4)
```

---

**文档版本**: 1.0
**创建时间**: 2025-10-30
**适用范围**: pyMatrix Web 端
**技术栈**: FastAPI + WebSocket + MSE
