# pyMatrix Web 架构设计 - Nuxt.js 前端方案

## 项目概述

在 pyMatrix 核心基础上，添加 Nuxt.js Web 前端支持，实现基于浏览器的多设备投屏与群控系统。

**参考架构**：严格遵循 SmartMatrix C++ 版本的架构，将桌面端功能移植到 Web 端。

---

## 一、整体架构设计

### 1.1 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     Web Browser (Client)                     │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │           Nuxt.js Frontend (Vue 3 + TypeScript)        │ │
│  │                                                         │ │
│  │  - Device Management UI                                │ │
│  │  - Video Stream Display (Canvas/WebRTC)                │ │
│  │  - Group Control Panel                                 │ │
│  │  - Virtual Input (Mouse/Keyboard)                      │ │
│  └─────────────────────┬──────────────────────────────────┘ │
│                        │                                     │
│                        │ WebSocket + REST API                │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            Python Backend Server (FastAPI)                   │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              WebSocket Handler                         │ │
│  │  - Device events broadcast                             │ │
│  │  - Control commands relay                              │ │
│  │  - Video stream relay (optional)                       │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │              REST API                                  │ │
│  │  - Device CRUD operations                              │ │
│  │  - Configuration management                            │ │
│  │  - Group control APIs                                  │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │              Video Stream Server                       │ │
│  │  - H.264 → MSE (fragmented MP4)                       │ │
│  │  - WebRTC peer connection                              │ │
│  │  - Multi-device stream multiplexing                    │ │
│  └─────────────────────┬──────────────────────────────────┘ │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               pyMatrix Core (Python)                         │
│                                                               │
│  - ADB Communication                                         │
│  - Device Management (参考: devicemanage.cpp)                │
│  - Group Controller (参考: groupcontroller.cpp)              │
│  - Video Decoder (PyAV)                                      │
│  - Control Message Handler (参考: controlmsg.cpp)            │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Android Devices (N台)                       │
│                                                               │
│  Device 1          Device 2          Device N                │
│  [scrcpy-server]   [scrcpy-server]   [scrcpy-server]        │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、技术栈选型

### 2.1 前端技术栈

| 模块 | 技术选型 | 说明 |
|------|---------|------|
| **框架** | Nuxt 3 | Vue 3 + TypeScript + SSR |
| **UI库** | Element Plus | 组件库 |
| **视频播放** | MSE + Canvas | H.264原生播放 |
| **实时通信** | WebSocket (Socket.io-client) | 双向通信 |
| **状态管理** | Pinia | Vuex 替代品 |
| **HTTP客户端** | Axios | REST API调用 |
| **WebRTC** | simple-peer | P2P视频流 |
| **Canvas库** | Fabric.js | 触摸点绘制 |

### 2.2 后端技术栈

| 模块 | 技术选型 | 说明 |
|------|---------|------|
| **Web框架** | FastAPI | 高性能异步Web框架 |
| **WebSocket** | python-socketio | Socket.io服务端 |
| **视频处理** | PyAV + aiortc | FFmpeg + WebRTC |
| **异步IO** | asyncio + uvicorn | ASGI服务器 |
| **API文档** | Swagger/OpenAPI | 自动生成 |

### 2.3 依赖包更新

```txt
# requirements-web.txt (新增Web支持依赖)

# Web Framework
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
python-socketio>=5.10.0
python-multipart>=0.0.6

# WebRTC Support
aiortc>=1.6.0           # WebRTC implementation
aiofiles>=23.2.1        # Async file operations

# Video Streaming
websockets>=12.0        # WebSocket support
ffmpeg-python>=0.2.0    # FFmpeg wrapper

# CORS Support
fastapi-cors>=0.0.6
```

---

## 三、视频流传输方案

### 3.1 方案对比

| 方案 | 延迟 | 兼容性 | 复杂度 | 带宽 | 推荐场景 |
|-----|------|--------|--------|------|---------|
| **MSE (Media Source Extensions)** | 低 (100-300ms) | 好 (Chrome/Firefox/Edge) | 中 | 低 | 单向投屏 |
| **WebRTC** | 极低 (50-150ms) | 好 (现代浏览器) | 高 | 中 | 实时交互 |
| **WebSocket + Canvas** | 中 (200-500ms) | 最好 | 低 | 高 | 兼容性优先 |
| **HLS/DASH** | 高 (2-10s) | 最好 | 低 | 低 | 录播/点播 |

### 3.2 选定方案: MSE (主) + WebRTC (可选)

#### 3.2.1 MSE方案架构

```
Android Device (scrcpy-server)
    ↓ H.264 raw stream
Python Backend (PyAV)
    ↓ Parse H.264 packets
    ↓ Generate fragmented MP4 (fMP4)
WebSocket
    ↓ Binary chunks
Web Browser (MSE)
    ↓ Append to SourceBuffer
<video> element
```

**优势**：
- 原生H.264解码（硬件加速）
- 延迟可控（100-300ms）
- 实现相对简单

#### 3.2.2 MSE实现细节

**Python后端 - 视频流服务器**

```python
# core/web/video_stream_server.py
import asyncio
import av
from fastapi import WebSocket
from typing import Dict, List

class VideoStreamServer:
    """
    MSE视频流服务器
    参考: demuxer.cpp + decoder.cpp

    功能:
    - 接收H.264流
    - 封装为fMP4格式
    - 通过WebSocket推送到浏览器
    """

    def __init__(self):
        self._streams: Dict[str, List[WebSocket]] = {}  # serial -> [websockets]
        self._running = False

    async def add_client(self, serial: str, websocket: WebSocket):
        """添加客户端连接"""
        if serial not in self._streams:
            self._streams[serial] = []
        self._streams[serial].append(websocket)

    async def remove_client(self, serial: str, websocket: WebSocket):
        """移除客户端连接"""
        if serial in self._streams:
            self._streams[serial].remove(websocket)

    async def stream_device(self, serial: str, h264_packets):
        """
        流式传输设备视频
        参考: demuxer.cpp:43-80

        流程:
        1. 接收H.264 packets
        2. 封装为fMP4
        3. 推送到所有订阅的WebSocket客户端
        """
        # 创建fMP4封装器
        output = av.open(f'pipe:', 'w', format='mp4')
        output.flags |= av.container.Flags.FRAGMENT  # 启用分片

        stream = output.add_stream('h264')
        stream.codec_context.width = 1920
        stream.codec_context.height = 1080

        try:
            for packet in h264_packets:
                # 封装packet为fMP4
                for mp4_packet in output.mux(packet):
                    chunk = mp4_packet.to_bytes()

                    # 广播到所有客户端
                    await self._broadcast_chunk(serial, chunk)

        except Exception as e:
            print(f"Stream error: {e}")
        finally:
            output.close()

    async def _broadcast_chunk(self, serial: str, chunk: bytes):
        """广播视频分片到所有客户端"""
        if serial not in self._streams:
            return

        # 并发发送到所有连接
        tasks = []
        for ws in self._streams[serial]:
            tasks.append(ws.send_bytes(chunk))

        await asyncio.gather(*tasks, return_exceptions=True)
```

**Nuxt前端 - MSE播放器**

```typescript
// composables/useVideoPlayer.ts
import { ref, onMounted, onUnmounted } from 'vue'

interface VideoPlayerOptions {
  deviceSerial: string
  wsUrl: string
}

export function useVideoPlayer(options: VideoPlayerOptions) {
  const videoRef = ref<HTMLVideoElement>()
  const mediaSource = ref<MediaSource>()
  const sourceBuffer = ref<SourceBuffer>()
  const ws = ref<WebSocket>()

  const init = () => {
    // 1. 创建MediaSource
    mediaSource.value = new MediaSource()

    // 2. 绑定到video元素
    if (videoRef.value) {
      videoRef.value.src = URL.createObjectURL(mediaSource.value)
    }

    // 3. 等待sourceopen事件
    mediaSource.value.addEventListener('sourceopen', onSourceOpen)
  }

  const onSourceOpen = () => {
    // 创建SourceBuffer (H.264编码, fMP4容器)
    const codec = 'video/mp4; codecs="avc1.64001F"'

    if (!MediaSource.isTypeSupported(codec)) {
      console.error('Codec not supported')
      return
    }

    sourceBuffer.value = mediaSource.value!.addSourceBuffer(codec)

    // 连接WebSocket
    connectWebSocket()
  }

  const connectWebSocket = () => {
    ws.value = new WebSocket(options.wsUrl)
    ws.value.binaryType = 'arraybuffer'

    ws.value.onopen = () => {
      // 订阅设备视频流
      ws.value!.send(JSON.stringify({
        type: 'subscribe',
        serial: options.deviceSerial
      }))
    }

    ws.value.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // 接收视频数据块
        appendChunk(event.data)
      }
    }

    ws.value.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  const appendChunk = (chunk: ArrayBuffer) => {
    if (!sourceBuffer.value || sourceBuffer.value.updating) {
      // 缓冲区繁忙,稍后重试
      setTimeout(() => appendChunk(chunk), 10)
      return
    }

    try {
      sourceBuffer.value.appendBuffer(chunk)
    } catch (e) {
      console.error('Failed to append buffer:', e)
    }
  }

  const cleanup = () => {
    if (ws.value) {
      ws.value.close()
    }

    if (mediaSource.value) {
      mediaSource.value.endOfStream()
    }
  }

  onMounted(init)
  onUnmounted(cleanup)

  return {
    videoRef,
    mediaSource,
    sourceBuffer
  }
}
```

---

## 四、多设备群控 Web 实现

### 4.1 设备状态同步

```typescript
// stores/devices.ts (Pinia Store)
import { defineStore } from 'pinia'
import { io, Socket } from 'socket.io-client'

interface Device {
  serial: string
  name: string
  size: { width: number; height: number }
  state: 'connected' | 'disconnected' | 'connecting'
  isHost: boolean  // 是否为主控设备
  frameRate: number
  bitRate: number
}

interface GroupState {
  devices: Map<string, Device>
  hostSerial: string | null
  socket: Socket | null
}

export const useDeviceStore = defineStore('devices', {
  state: (): GroupState => ({
    devices: new Map(),
    hostSerial: null,
    socket: null
  }),

  actions: {
    /**
     * 初始化WebSocket连接
     * 参考: groupcontroller.cpp 观察者模式
     */
    initWebSocket(url: string) {
      this.socket = io(url, {
        transports: ['websocket']
      })

      // 监听设备事件
      this.socket.on('device:connected', (device: Device) => {
        this.devices.set(device.serial, device)
      })

      this.socket.on('device:disconnected', (serial: string) => {
        this.devices.delete(serial)
      })

      this.socket.on('device:updated', (device: Device) => {
        this.devices.set(device.serial, device)
      })

      // 监听群控事件
      this.socket.on('group:host_changed', (serial: string) => {
        this.setHost(serial)
      })
    },

    /**
     * 设置主控设备
     * 参考: groupcontroller.cpp:37-53
     */
    setHost(serial: string) {
      // 清除旧主控
      if (this.hostSerial) {
        const oldHost = this.devices.get(this.hostSerial)
        if (oldHost) {
          oldHost.isHost = false
        }
      }

      // 设置新主控
      this.hostSerial = serial
      const newHost = this.devices.get(serial)
      if (newHost) {
        newHost.isHost = true
      }

      // 通知后端
      this.socket?.emit('group:set_host', { serial })
    },

    /**
     * 添加设备到群组
     * 参考: groupcontroller.cpp:55-62
     */
    addToGroup(serial: string) {
      const device = this.devices.get(serial)
      if (!device) return

      this.socket?.emit('group:add_device', { serial })
    },

    /**
     * 广播鼠标事件到群组
     * 参考: groupcontroller.cpp:82-96
     */
    broadcastMouseEvent(event: {
      type: 'down' | 'up' | 'move'
      x: number
      y: number
      button: number
    }) {
      if (!this.hostSerial) return

      // 只有主控设备可以发起群控操作
      this.socket?.emit('control:mouse', {
        hostSerial: this.hostSerial,
        ...event
      })
    },

    /**
     * 广播按键事件到群组
     * 参考: groupcontroller.cpp:114-128
     */
    broadcastKeyEvent(event: {
      type: 'down' | 'up'
      keyCode: number
      metaState: number
    }) {
      if (!this.hostSerial) return

      this.socket?.emit('control:key', {
        hostSerial: this.hostSerial,
        ...event
      })
    }
  }
})
```

### 4.2 群控操作流程

```
用户在Web端主控设备窗口操作
        ↓
┌──────────────────────────────────────────────┐
│  Nuxt Frontend (主控设备VideoPlayer组件)       │
│  监听: @mousedown, @mousemove, @mouseup       │
└───────────────────┬──────────────────────────┘
                    ↓ Socket.io emit
                    │ control:mouse
                    │ { hostSerial, x, y, type }
                    ▼
┌──────────────────────────────────────────────┐
│  FastAPI Backend (WebSocket Handler)         │
│  - 验证主控设备                               │
│  - 获取群组设备列表                           │
│  - 坐标映射到各设备分辨率                     │
└───────────────────┬──────────────────────────┘
                    ↓
            遍历群组从属设备
                    ↓
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  Device A    │        │  Device B    │
│  pyMatrix    │        │  pyMatrix    │
│  Core        │        │  Core        │
└──────┬───────┘        └──────┬───────┘
       │                       │
       ▼                       ▼
┌──────────────┐        ┌──────────────┐
│ Controller   │        │ Controller   │
│ (坐标映射)    │        │ (坐标映射)    │
└──────┬───────┘        └──────┬───────┘
       │                       │
       ▼                       ▼
┌──────────────┐        ┌──────────────┐
│ ControlMsg   │        │ ControlMsg   │
│ (序列化)      │        │ (序列化)      │
└──────┬───────┘        └──────┬───────┘
       │                       │
       ▼                       ▼
  ControlSocket           ControlSocket
       │                       │
       ▼                       ▼
┌──────────────┐        ┌──────────────┐
│  Android A   │        │  Android B   │
│  执行触摸     │        │  执行触摸     │
└──────────────┘        └──────────────┘
```

---

## 五、FastAPI 后端实现

### 5.1 主服务器

```python
# main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import socketio
import uvicorn

from core.device.device_manager import DeviceManager
from core.group.group_controller import GroupController
from core.web.video_stream_server import VideoStreamServer
from core.web.websocket_handler import WebSocketHandler

# 创建FastAPI应用
app = FastAPI(
    title="pyMatrix Web API",
    description="Android device mirroring and group control system",
    version="1.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应限制来源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Socket.IO服务器
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'
)
socket_app = socketio.ASGIApp(sio, app)

# 全局实例
device_manager = DeviceManager.instance()
group_controller = GroupController.instance()
video_server = VideoStreamServer()
ws_handler = WebSocketHandler(device_manager, group_controller, video_server)

# ===== REST API =====

@app.get("/api/devices")
async def get_devices():
    """
    获取设备列表
    参考: devicemanage.cpp
    """
    devices = device_manager.get_all_devices()
    return {
        "success": True,
        "data": [
            {
                "serial": d.serial,
                "name": d.name,
                "size": {"width": d.width, "height": d.height},
                "state": d.state,
                "isHost": d.is_host
            }
            for d in devices
        ]
    }

@app.post("/api/devices/connect")
async def connect_device(params: dict):
    """
    连接设备
    参考: devicemanage.cpp:35-70
    """
    from core.device.device_params import ServerParams

    server_params = ServerParams(**params)
    success = await device_manager.connect_device_async(server_params)

    return {
        "success": success,
        "message": "Device connected" if success else "Connection failed"
    }

@app.post("/api/devices/disconnect")
async def disconnect_device(serial: str):
    """
    断开设备
    参考: devicemanage.cpp:72-83
    """
    success = device_manager.disconnect_device(serial)
    return {
        "success": success,
        "message": "Device disconnected" if success else "Disconnection failed"
    }

@app.post("/api/group/add")
async def add_to_group(serial: str):
    """
    添加设备到群组
    参考: groupcontroller.cpp:55-62
    """
    group_controller.add_device(serial)
    return {"success": True}

@app.post("/api/group/set_host")
async def set_host(serial: str):
    """
    设置主控设备
    参考: groupcontroller.cpp:37-53
    """
    group_controller.set_host(serial)
    return {"success": True}

# ===== WebSocket Endpoints =====

@app.websocket("/ws/video/{serial}")
async def video_stream(websocket: WebSocket, serial: str):
    """
    视频流WebSocket
    参考: videosocket.cpp
    """
    await websocket.accept()
    await video_server.add_client(serial, websocket)

    try:
        while True:
            # 保持连接
            data = await websocket.receive_text()

    except WebSocketDisconnect:
        await video_server.remove_client(serial, websocket)

# ===== Socket.IO Events =====

@sio.event
async def connect(sid, environ):
    """客户端连接"""
    print(f"Client connected: {sid}")
    await ws_handler.on_client_connect(sid)

@sio.event
async def disconnect(sid):
    """客户端断开"""
    print(f"Client disconnected: {sid}")
    await ws_handler.on_client_disconnect(sid)

@sio.event
async def control_mouse(sid, data):
    """
    鼠标控制事件
    参考: groupcontroller.cpp:82-96
    """
    await ws_handler.on_mouse_event(sid, data)

@sio.event
async def control_key(sid, data):
    """
    键盘控制事件
    参考: groupcontroller.cpp:114-128
    """
    await ws_handler.on_key_event(sid, data)

@sio.event
async def control_back(sid, data):
    """
    返回键
    参考: groupcontroller.cpp:130-143
    """
    await ws_handler.on_back_event(sid, data)

# ===== 启动服务器 =====

if __name__ == "__main__":
    uvicorn.run(
        socket_app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
```

### 5.2 WebSocket事件处理器

```python
# core/web/websocket_handler.py
import asyncio
from typing import Dict, Set

class WebSocketHandler:
    """
    WebSocket事件处理器
    参考: groupcontroller.cpp 观察者模式
    """

    def __init__(self, device_manager, group_controller, video_server):
        self.device_manager = device_manager
        self.group_controller = group_controller
        self.video_server = video_server

        # 客户端管理
        self.clients: Dict[str, Set[str]] = {}  # serial -> {sid1, sid2, ...}

    async def on_client_connect(self, sid: str):
        """客户端连接"""
        pass

    async def on_client_disconnect(self, sid: str):
        """客户端断开"""
        # 清理客户端订阅
        for serial, sids in self.clients.items():
            if sid in sids:
                sids.remove(sid)

    async def on_mouse_event(self, sid: str, data: dict):
        """
        处理鼠标事件并广播到群组
        参考: groupcontroller.cpp:82-96

        数据格式:
        {
            "hostSerial": "ABC123",
            "type": "down|up|move",
            "x": 100,
            "y": 200,
            "button": 0
        }
        """
        host_serial = data.get('hostSerial')
        if not host_serial:
            return

        # 构造Qt风格的鼠标事件
        from PyQt6.QtCore import Qt
        from PyQt6.QtGui import QMouseEvent

        event_type = {
            'down': QMouseEvent.MouseButtonPress,
            'up': QMouseEvent.MouseButtonRelease,
            'move': QMouseEvent.MouseMove
        }.get(data['type'])

        # 获取主控设备的显示尺寸
        host_device = self.device_manager.get_device(host_serial)
        if not host_device:
            return

        frame_size = host_device.get_frame_size()
        show_size = (data.get('showWidth', frame_size[0]),
                    data.get('showHeight', frame_size[1]))

        # 调用群控管理器广播
        # 注意: 需要将data转换为QMouseEvent对象
        # 这里简化处理,直接调用内部方法
        await self._broadcast_mouse_to_group(
            host_serial,
            data['type'],
            data['x'],
            data['y'],
            data.get('button', 0),
            frame_size,
            show_size
        )

    async def _broadcast_mouse_to_group(self, host_serial: str,
                                       event_type: str, x: int, y: int,
                                       button: int, frame_size: tuple,
                                       show_size: tuple):
        """
        广播鼠标事件到群组所有从属设备
        参考: groupcontroller.cpp:82-96
        """
        # 获取群组设备列表
        devices = self.group_controller.get_group_devices()

        for device_serial in devices:
            # 跳过主控设备
            if device_serial == host_serial:
                continue

            device = self.device_manager.get_device(device_serial)
            if not device:
                continue

            # 获取从属设备的分辨率
            device_frame_size = device.get_frame_size()

            # 坐标映射
            # 计算在主控设备上的相对位置
            x_ratio = x / show_size[0]
            y_ratio = y / show_size[1]

            # 映射到从属设备的实际坐标
            device_x = int(x_ratio * device_frame_size[0])
            device_y = int(y_ratio * device_frame_size[1])

            # 发送控制命令到设备
            await device.send_mouse_event(
                event_type,
                device_x,
                device_y,
                button,
                device_frame_size
            )

    async def on_key_event(self, sid: str, data: dict):
        """
        处理键盘事件并广播到群组
        参考: groupcontroller.cpp:114-128
        """
        host_serial = data.get('hostSerial')
        if not host_serial:
            return

        devices = self.group_controller.get_group_devices()

        for device_serial in devices:
            if device_serial == host_serial:
                continue

            device = self.device_manager.get_device(device_serial)
            if device:
                await device.send_key_event(
                    data['type'],
                    data['keyCode'],
                    data.get('metaState', 0)
                )

    async def on_back_event(self, sid: str, data: dict):
        """
        处理返回键并广播到群组
        参考: groupcontroller.cpp:130-143
        """
        host_serial = data.get('hostSerial')
        if not host_serial:
            return

        devices = self.group_controller.get_group_devices()

        for device_serial in devices:
            if device_serial == host_serial:
                continue

            device = self.device_manager.get_device(device_serial)
            if device:
                await device.post_go_back()
```

---

## 六、Nuxt.js 前端实现

### 6.1 项目结构

```
pyMatrix-web/
├── components/
│   ├── DeviceGrid.vue          # 设备网格布局
│   ├── VideoPlayer.vue         # 视频播放器组件
│   ├── ControlPanel.vue        # 控制面板
│   ├── DeviceList.vue          # 设备列表
│   └── GroupController.vue     # 群控面板
├── composables/
│   ├── useVideoPlayer.ts       # 视频播放器Hook
│   ├── useDeviceControl.ts     # 设备控制Hook
│   ├── useWebSocket.ts         # WebSocket Hook
│   └── useGroupControl.ts      # 群控Hook
├── stores/
│   ├── devices.ts              # 设备状态管理
│   ├── group.ts                # 群组状态管理
│   └── settings.ts             # 设置状态管理
├── pages/
│   ├── index.vue               # 首页
│   ├── devices/
│   │   ├── index.vue           # 设备管理页
│   │   └── [serial].vue        # 设备详情页
│   └── group/
│       └── control.vue         # 群控页面
├── server/
│   └── api/                    # Nuxt服务端API (可选)
├── nuxt.config.ts
├── package.json
└── tsconfig.json
```

### 6.2 核心组件实现

#### 6.2.1 VideoPlayer组件

```vue
<!-- components/VideoPlayer.vue -->
<template>
  <div class="video-player" @mousedown="handleMouseDown"
                           @mousemove="handleMouseMove"
                           @mouseup="handleMouseUp">
    <video ref="videoRef" autoplay playsinline class="video-element" />

    <!-- 触摸点显示层 -->
    <canvas ref="canvasRef" class="touch-overlay" />

    <!-- 设备信息覆盖层 -->
    <div class="info-overlay">
      <span>{{ device.name }}</span>
      <span>{{ device.size.width }}x{{ device.size.height }}</span>
      <span>{{ fps }} FPS</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useVideoPlayer } from '~/composables/useVideoPlayer'
import { useDeviceControl } from '~/composables/useDeviceControl'
import { useDeviceStore } from '~/stores/devices'

interface Props {
  deviceSerial: string
  wsUrl: string
}

const props = defineProps<Props>()

const deviceStore = useDeviceStore()

// 获取设备信息
const device = computed(() => deviceStore.devices.get(props.deviceSerial))

// 视频播放器
const { videoRef, fps } = useVideoPlayer({
  deviceSerial: props.deviceSerial,
  wsUrl: props.wsUrl
})

// 触摸点绘制Canvas
const canvasRef = ref<HTMLCanvasElement>()

// 设备控制
const { sendMouseEvent } = useDeviceControl(props.deviceSerial)

// 鼠标事件处理
const handleMouseDown = (event: MouseEvent) => {
  if (!device.value?.isHost) return

  const rect = (event.target as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  // 发送鼠标事件 (群控)
  sendMouseEvent({
    type: 'down',
    x,
    y,
    button: event.button,
    showWidth: rect.width,
    showHeight: rect.height
  })

  // 绘制触摸点
  drawTouchPoint(x, y)
}

const handleMouseMove = (event: MouseEvent) => {
  if (!device.value?.isHost || !(event.buttons & 1)) return

  const rect = (event.target as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  sendMouseEvent({
    type: 'move',
    x,
    y,
    button: event.button,
    showWidth: rect.width,
    showHeight: rect.height
  })

  drawTouchPoint(x, y)
}

const handleMouseUp = (event: MouseEvent) => {
  if (!device.value?.isHost) return

  const rect = (event.target as HTMLElement).getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  sendMouseEvent({
    type: 'up',
    x,
    y,
    button: event.button,
    showWidth: rect.width,
    showHeight: rect.height
  })

  // 清除触摸点
  clearTouchPoints()
}

// 绘制触摸点 (模拟Android show_touches)
const drawTouchPoint = (x: number, y: number) => {
  if (!canvasRef.value) return

  const ctx = canvasRef.value.getContext('2d')
  if (!ctx) return

  // 清空画布
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)

  // 绘制圆形触摸点
  ctx.beginPath()
  ctx.arc(x, y, 20, 0, 2 * Math.PI)
  ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'
  ctx.lineWidth = 2
  ctx.stroke()
}

const clearTouchPoints = () => {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height)
  }
}

onMounted(() => {
  // 设置canvas尺寸
  if (canvasRef.value && videoRef.value) {
    canvasRef.value.width = videoRef.value.clientWidth
    canvasRef.value.height = videoRef.value.clientHeight
  }
})
</script>

<style scoped>
.video-player {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
}

.video-element {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.touch-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.info-overlay {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  display: flex;
  gap: 10px;
}
</style>
```

#### 6.2.2 设备网格布局

```vue
<!-- components/DeviceGrid.vue -->
<template>
  <div class="device-grid" :class="gridClass">
    <div
      v-for="device in devices"
      :key="device.serial"
      class="device-item"
      :class="{ 'is-host': device.isHost }"
    >
      <VideoPlayer
        :device-serial="device.serial"
        :ws-url="getVideoWsUrl(device.serial)"
      />

      <!-- 主控设备标识 -->
      <div v-if="device.isHost" class="host-badge">
        <el-icon><Star /></el-icon>
        主控设备
      </div>

      <!-- 操作按钮 -->
      <div class="device-actions">
        <el-button size="small" @click="setAsHost(device.serial)">
          设为主控
        </el-button>
        <el-button size="small" @click="removeFromGroup(device.serial)">
          移出群组
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDeviceStore } from '~/stores/devices'
import { Star } from '@element-plus/icons-vue'

const deviceStore = useDeviceStore()

const devices = computed(() => Array.from(deviceStore.devices.values()))

// 动态网格布局
const gridClass = computed(() => {
  const count = devices.value.length
  if (count <= 1) return 'grid-1'
  if (count <= 4) return 'grid-2x2'
  if (count <= 9) return 'grid-3x3'
  return 'grid-4x4'
})

const getVideoWsUrl = (serial: string) => {
  return `ws://localhost:8000/ws/video/${serial}`
}

const setAsHost = (serial: string) => {
  deviceStore.setHost(serial)
}

const removeFromGroup = (serial: string) => {
  deviceStore.removeFromGroup(serial)
}
</script>

<style scoped>
.device-grid {
  display: grid;
  gap: 10px;
  padding: 10px;
  height: 100%;
}

.grid-1 {
  grid-template-columns: 1fr;
}

.grid-2x2 {
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(2, 1fr);
}

.grid-3x3 {
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 1fr;
}

.grid-4x4 {
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 1fr;
}

.device-item {
  position: relative;
  background: #1a1a1a;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: border-color 0.3s;
}

.device-item.is-host {
  border-color: #409eff;
  box-shadow: 0 0 20px rgba(64, 158, 255, 0.3);
}

.host-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #409eff;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 10;
}

.device-actions {
  position: absolute;
  bottom: 10px;
  right: 10px;
  display: flex;
  gap: 5px;
  opacity: 0;
  transition: opacity 0.3s;
  z-index: 10;
}

.device-item:hover .device-actions {
  opacity: 1;
}
</style>
```

---

## 七、性能优化策略

### 7.1 视频流优化

```python
# 1. 自适应比特率
class AdaptiveBitrateController:
    """
    根据网络状况动态调整比特率
    参考: decoder.cpp FPS计数
    """

    def __init__(self):
        self.target_fps = 60
        self.current_bitrate = 8000000
        self.min_bitrate = 1000000
        self.max_bitrate = 20000000

    def adjust_bitrate(self, actual_fps: int, packet_loss: float):
        if actual_fps < self.target_fps * 0.8:
            # 降低比特率
            self.current_bitrate = max(
                self.min_bitrate,
                int(self.current_bitrate * 0.8)
            )
        elif actual_fps >= self.target_fps and packet_loss < 0.01:
            # 提高比特率
            self.current_bitrate = min(
                self.max_bitrate,
                int(self.current_bitrate * 1.2)
            )

        return self.current_bitrate
```

### 7.2 多设备负载均衡

```python
# 2. 设备连接负载均衡
class DeviceLoadBalancer:
    """
    参考: devicemanage.cpp:110-130 端口分配策略
    """

    def __init__(self):
        self.device_ports: Dict[str, int] = {}
        self.base_port = 27183

    def allocate_port(self, serial: str) -> int:
        """为设备分配端口"""
        if serial in self.device_ports:
            return self.device_ports[serial]

        # 查找空闲端口
        for port in range(self.base_port, self.base_port + 1000):
            if port not in self.device_ports.values():
                self.device_ports[serial] = port
                return port

        raise Exception("No available ports")
```

### 7.3 前端性能优化

```typescript
// 3. 虚拟滚动 - 大量设备时只渲染可见部分
import { useVirtualList } from '@vueuse/core'

const { list, containerProps, wrapperProps } = useVirtualList(
  devices,
  { itemHeight: 300 }
)
```

---

## 八、部署方案

### 8.1 Docker部署

```dockerfile
# Dockerfile
FROM python:3.11-slim

# 安装FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装Python依赖
COPY requirements.txt requirements-web.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-web.txt

# 复制应用代码
COPY . .

# 暴露端口
EXPOSE 8000

# 启动服务
CMD ["python", "main.py"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  pymatrix-backend:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./resources:/app/resources
    environment:
      - PYTHONUNBUFFERED=1
    devices:
      - /dev/bus/usb:/dev/bus/usb  # USB设备映射

  pymatrix-frontend:
    image: node:18-alpine
    working_dir: /app
    volumes:
      - ./pyMatrix-web:/app
    ports:
      - "3000:3000"
    command: npm run dev
```

---

## 九、技术对比总结

| 维度 | 桌面端 (PyQt6) | Web端 (Nuxt.js) |
|------|----------------|-----------------|
| **部署** | 需要安装 | 浏览器即用 |
| **性能** | 最优 (原生) | 良好 (MSE硬解) |
| **延迟** | 最低 (30-70ms) | 中等 (100-300ms) |
| **兼容性** | 需匹配OS | 浏览器通用 |
| **多用户** | 单机单用户 | 多用户协作 |
| **开发效率** | 中 | 高 |
| **维护成本** | 高 (多平台编译) | 低 (一套代码) |

---

## 十、开发路线图

### Phase 1: 后端基础 (2周)
- [ ] FastAPI服务器搭建
- [ ] WebSocket事件系统
- [ ] MSE视频流服务器
- [ ] REST API实现

### Phase 2: 前端核心 (3周)
- [ ] Nuxt项目初始化
- [ ] VideoPlayer组件 (MSE)
- [ ] 设备管理UI
- [ ] Socket.io客户端集成

### Phase 3: 群控功能 (2周)
- [ ] 群控逻辑后端实现
- [ ] 群控UI前端实现
- [ ] 坐标映射与事件广播
- [ ] 多设备同步测试

### Phase 4: 优化与测试 (2周)
- [ ] 性能优化 (延迟、带宽)
- [ ] 大规模设备测试 (50+)
- [ ] 用户体验优化
- [ ] 文档完善

---

**文档版本**: 1.0
**创建时间**: 2025-10-30
**技术栈**: Nuxt 3 + FastAPI + WebSocket + MSE
**参考架构**: SmartMatrix C++ (严格遵循)
