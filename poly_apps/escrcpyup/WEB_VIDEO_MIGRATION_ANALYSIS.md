# escrcpyup Web视频显示迁移方案分析

**日期**: 2025-12-19
**目标**: 将 escrcpyup 从 scrcpy.exe 独立窗口改造为 Web 内嵌视频显示
**参考**: Matrix 项目的 Web 视频显示成功案例

---

## 📋 目录

- [当前架构分析](#当前架构分析)
- [Matrix 成功案例](#matrix-成功案例)
- [关键差异对比](#关键差异对比)
- [5个可行方案](#5个可行方案)
- [推荐实施路径](#推荐实施路径)
- [技术要点详解](#技术要点详解)

---

## 🔍 当前架构分析

### escrcpyup 现状

**技术栈**:
- **前端**: Vue 3 + Vite + Electron
- **后端**: Electron 主进程 (Node.js)
- **视频**: scrcpy.exe 独立窗口 (SDL2 原生窗口)

**当前数据流**:
```
用户点击"镜像" → useMirrorAction.invoke()
    ↓
window.scrcpy.mirror(deviceId)  // IPC调用
    ↓
Electron主进程 spawn("scrcpy.exe --serial=xxx")
    ↓
scrcpy.exe 创建 SDL2 原生窗口（独立于 Electron）
    ↓
用户在原生窗口中看到 Android 屏幕
```

**关键文件**:
- `electron/exposes/scrcpy/index.js:105` - mirror() 函数
- `src/hooks/useMirrorAction/index.js` - Vue 镜像操作
- `electron/configs/scrcpy/index.js` - scrcpy 配置

**问题**:
- ❌ 视频显示在独立窗口，无法嵌入 Web 界面
- ❌ scrcpy.exe 是黑盒，无法获取视频流数据
- ❌ 无法在 Web 上实现自定义 UI/控制
- ❌ 多设备显示需要多个独立窗口

---

## ✅ Matrix 成功案例

### Matrix 架构详解

**技术栈**:
- **前端**: React + TypeScript + Vite
- **后端**: Python + FastAPI + WebSocket
- **视频**: Web Canvas (WebCodecs/WebGL)

**成功的数据流**:
```
Android设备
    ↓
scrcpy-server.jar (通过 ADB 推送到设备)
    ↓
Python ScrcpyDevice.read_video_frame() - 读取 H.264 NAL units
    ↓
VideoStreamService (Python后端) - 视频流管理
    ↓
WebSocket (ws://localhost:48000/video/{device_id})
    ↓
React前端组件 (DeviceH264Stream.tsx)
    ↓
WebCodecs VideoDecoder API - H.264 解码
    ↓
Canvas 2D Context - 渲染到网页
```

### Matrix 的关键成功要素

#### 1. Python 后端直接管理 scrcpy-server

**文件**: `pycore/pyutils/device/scrcpy_device.py:191-257`

```python
class ScrcpyDevice:
    def start_server(self):
        """直接启动 scrcpy-server.jar，不启动 scrcpy.exe"""
        # 推送 jar 到设备
        subprocess.run([adb, 'push', 'scrcpy-server.jar', '/data/local/tmp/'])

        # 启动服务器（监听视频流和控制端口）
        subprocess.Popen([
            adb, 'shell',
            f'CLASSPATH=/data/local/tmp/scrcpy-server.jar',
            'app_process', '/', 'com.genymobile.scrcpy.Server',
            '3.3.3',  # 版本
            ...       # 其他参数
        ])

        # 端口转发
        subprocess.run([adb, 'forward', f'tcp:{video_port}', f'localabstract:scrcpy'])

    def read_video_frame(self) -> bytes:
        """从 scrcpy-server 读取 H.264 帧"""
        # 读取协议头
        header = self.video_socket.recv(69)
        serial_len = header[0]
        pts = struct.unpack('>Q', header[1:9])[0]
        size = struct.unpack('>I', header[9:13])[0]

        # 读取 H.264 数据
        h264_data = self.video_socket.recv(size)
        return h264_data
```

**关键点**:
- ✅ 直接与 scrcpy-server 通信，绕过 scrcpy.exe
- ✅ 完全控制视频流的获取和分发
- ✅ 支持多客户端订阅同一视频流

#### 2. WebSocket 视频广播服务

**文件**: `pyapps/matrix/services/video_stream_service.py:363-425`

```python
async def force_stop_stream(self, serial: str, reason: str):
    """停止视频流并通知所有客户端"""
    # 通知所有连接的客户端
    if serial in self.stream_clients:
        error_message = {
            "type": "stream.error",
            "data": {"serial": serial, "error": reason, "fatal": True}
        }
        for ws in self.stream_clients[serial]:
            await ws.send_json(error_message)
```

**特性**:
- ✅ 单一后台任务读取视频流
- ✅ 多个 WebSocket 客户端订阅
- ✅ 配置帧缓存 (SPS/PPS) 用于新客户端快速加入
- ✅ 自动健康检查和重连

#### 3. 前端 WebCodecs 解码

**文件**: `poly_apps/matrixui/src/components/DeviceH264Stream.tsx:45-123`

```typescript
// 初始化 VideoDecoder
videoDecoder = new VideoDecoder({
  output: (frame: VideoFrame) => {
    // 在 Canvas 上渲染
    canvasCtx.drawImage(frame, 0, 0);
    frame.close();
  },
  error: (e) => console.error('Decoder error:', e)
});

// 配置解码器 (使用SPS/PPS)
videoDecoder.configure({
  codec: 'avc1.64001f',  // H.264 Baseline
  codedWidth: 720,
  codedHeight: 1280
});

// 解码 H.264 帧
const chunk = new EncodedVideoChunk({
  type: isKeyframe ? 'key' : 'delta',
  timestamp: pts,
  data: h264Data
});
videoDecoder.decode(chunk);
```

**优势**:
- ✅ 硬件加速解码 (GPU)
- ✅ 延迟极低 (<50ms)
- ✅ CPU 占用少
- ✅ 现代浏览器原生支持

#### 4. 触控控制系统

**文件**: `poly_apps/matrixui/src/components/DeviceH264Stream.tsx:213-245`

```typescript
const handleTouch = async (event: React.MouseEvent) => {
  const rect = canvasRef.current!.getBoundingClientRect();

  // 坐标转换 (Canvas → 设备分辨率)
  const x = Math.floor((event.clientX - rect.left) / rect.width * deviceWidth);
  const y = Math.floor((event.clientY - rect.top) / rect.height * deviceHeight);

  // 通过 RPC 发送触控事件
  await window.rpc.call('control.touch', {
    device_id: deviceId,
    action: 'down',
    x, y,
    pressure: 1.0
  });
};
```

---

## 📊 关键差异对比表

| 维度 | Matrix (Web显示) | escrcpyup (当前) | 差距 |
|------|-----------------|-----------------|------|
| **视频获取** | Python直接读取scrcpy-server | spawn scrcpy.exe独立窗口 | 🔴 完全不同的架构 |
| **后端服务** | FastAPI + WebSocket视频服务 | 无视频后端 | 🔴 需要新增 |
| **前端显示** | React + Canvas + WebCodecs | 无 (依赖scrcpy.exe) | 🔴 需要新增 |
| **scrcpy-server管理** | Python ScrcpyDevice直接管理 | 通过scrcpy.exe间接启动 | 🔴 需要重构 |
| **视频流控制** | 完整 (pause/resume/reconnect) | 无 (scrcpy.exe自己控制) | 🔴 需要新增 |
| **触控交互** | Web Canvas + RPC控制 | scrcpy.exe窗口原生控制 | 🔴 需要新增 |
| **多设备支持** | 单一后端 → 多设备流 → 多客户端 | 每设备一个scrcpy.exe进程 | 🟡 可改进 |
| **延迟** | <50ms (WebCodecs) | <30ms (原生SDL2) | 🟢 可接受 |
| **CPU占用** | 低 (GPU解码) | 低 (原生解码) | 🟢 相当 |

**结论**: 需要进行**重大架构改造**，核心是添加视频流处理层。

---

## 🎯 5个可行方案

### 方案1: 混合架构 - Electron + Matrix后端 ⭐⭐⭐⭐⭐ (推荐)

#### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│  escrcpyup Electron 应用                                     │
│                                                              │
│  ┌────────────────────┐        ┌──────────────────────┐    │
│  │ Vue 3 前端 (渲染进程)│  ←WS→  │ Matrix Python 后端   │    │
│  │                    │        │ (独立进程)           │    │
│  │ - 设备列表         │        │ - VideoStreamService │    │
│  │ - 设置面板         │        │ - WebSocket Server   │    │
│  │ - Web视频组件 ✨   │        │ - ScrcpyDevice       │    │
│  └────────────────────┘        └──────────────────────┘    │
│         ↑                               ↓                   │
│         │ IPC                      端口转发/ADB             │
│         ↓                               ↓                   │
│  ┌────────────────────┐        ┌──────────────────────┐    │
│  │ Electron 主进程     │  spawn  │ scrcpy-server.jar    │    │
│  │ - 进程管理         │  ────→  │ (运行在 Android 设备) │    │
│  │ - Python后端启动   │        └──────────────────────┘    │
│  └────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
```

#### 实施步骤

**Phase 1: Matrix 后端独立化** (1天)

```bash
# 1. 创建 Matrix 后端可执行文件
cd pyapps/matrix
pyinstaller matrix_main.py --onefile --name matrix_backend

# 2. 测试独立运行
./dist/matrix_backend
# 应该启动在 http://localhost:48000
```

**Phase 2: Electron 集成 Python 后端** (1天)

```javascript
// electron/services/matrixBackend.js
import { spawn } from 'child_process'
import { app } from 'electron'
import path from 'path'

export class MatrixBackendService {
  constructor() {
    this.process = null
    this.port = 48000
  }

  start() {
    const backendPath = path.join(
      app.getAppPath(),
      'resources',
      'matrix_backend.exe'
    )

    this.process = spawn(backendPath, {
      env: {
        ...process.env,
        MATRIX_PORT: this.port,
        MATRIX_HOST: '127.0.0.1'
      }
    })

    this.process.stdout.on('data', (data) => {
      console.log('[Matrix Backend]', data.toString())
    })

    this.process.on('exit', (code) => {
      console.log('[Matrix Backend] Exited with code', code)
    })
  }

  stop() {
    if (this.process) {
      this.process.kill()
    }
  }
}

// electron/main/index.js
import { MatrixBackendService } from '../services/matrixBackend'

const matrixBackend = new MatrixBackendService()

app.on('ready', () => {
  matrixBackend.start()
  // ... 其他初始化
})

app.on('before-quit', () => {
  matrixBackend.stop()
})
```

**Phase 3: Vue 视频组件移植** (2-3天)

```vue
<!-- src/components/WebVideoStream.vue -->
<template>
  <div class="video-container">
    <canvas
      ref="videoCanvas"
      :width="width"
      :height="height"
      @mousedown="handleMouseDown"
      @mousemove="handleMouseMove"
      @mouseup="handleMouseUp"
    />

    <div v-if="status === 'connecting'" class="status-overlay">
      连接中...
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  deviceId: string
  serial: string
  width?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  width: 720,
  height: 1280
})

const videoCanvas = ref<HTMLCanvasElement | null>(null)
const status = ref<'connecting' | 'connected' | 'error'>('connecting')
const ws = ref<WebSocket | null>(null)
const videoDecoder = ref<VideoDecoder | null>(null)

// WebSocket 连接
const connectWebSocket = () => {
  ws.value = new WebSocket(`ws://localhost:48000/video/${props.deviceId}`)
  ws.value.binaryType = 'arraybuffer'

  ws.value.onopen = () => {
    console.log('[WebVideoStream] Connected')
    status.value = 'connected'
  }

  ws.value.onmessage = async (event) => {
    if (typeof event.data === 'string') {
      // JSON 消息 (状态更新)
      const message = JSON.parse(event.data)
      handleStatusMessage(message)
    } else {
      // 二进制消息 (H.264 帧)
      await handleVideoFrame(event.data)
    }
  }

  ws.value.onerror = (error) => {
    console.error('[WebVideoStream] Error:', error)
    status.value = 'error'
  }

  ws.value.onclose = () => {
    console.log('[WebVideoStream] Disconnected')
    status.value = 'connecting'
    // 自动重连
    setTimeout(connectWebSocket, 2000)
  }
}

// 初始化 VideoDecoder
const initVideoDecoder = () => {
  if (!videoCanvas.value) return

  const ctx = videoCanvas.value.getContext('2d')!

  videoDecoder.value = new VideoDecoder({
    output: (frame: VideoFrame) => {
      ctx.drawImage(frame, 0, 0, props.width, props.height)
      frame.close()
    },
    error: (e) => {
      console.error('[VideoDecoder] Error:', e)
    }
  })
}

// 处理 H.264 帧
const handleVideoFrame = async (data: ArrayBuffer) => {
  if (!videoDecoder.value) return

  // 解析帧头 (参考 Matrix 实现)
  const view = new DataView(data)
  const serialLen = view.getUint8(0)
  const pts = view.getBigUint64(1, false)  // Big-endian
  const size = view.getUint32(9, false)

  // 检查是否为配置帧 (SPS/PPS)
  const isConfig = (pts & (1n << 63n)) !== 0n
  const isKeyframe = (pts & (1n << 62n)) !== 0n
  const timestamp = Number(pts & ((1n << 62n) - 1n))

  // 提取 H.264 数据
  const h264Data = data.slice(13)

  if (isConfig) {
    // 配置帧: 配置 VideoDecoder
    // (需要解析 SPS/PPS 构建 AVCC descriptor)
    configureDecoder(h264Data)
  } else {
    // 普通帧: 解码
    const chunk = new EncodedVideoChunk({
      type: isKeyframe ? 'key' : 'delta',
      timestamp,
      data: h264Data
    })
    videoDecoder.value.decode(chunk)
  }
}

// 配置解码器 (简化版)
const configureDecoder = (configData: ArrayBuffer) => {
  // TODO: 解析 SPS/PPS，构建 AVCC descriptor
  // 参考 Matrix 的 DeviceH264Stream.tsx:78-95

  videoDecoder.value?.configure({
    codec: 'avc1.64001f',  // H.264 Baseline Profile
    codedWidth: props.width,
    codedHeight: props.height
  })
}

// 处理触控事件
const handleMouseDown = async (event: MouseEvent) => {
  const rect = videoCanvas.value!.getBoundingClientRect()
  const x = Math.floor((event.clientX - rect.left) / rect.width * props.width)
  const y = Math.floor((event.clientY - rect.top) / rect.height * props.height)

  // 通过 Matrix RPC 发送触控 (需要实现 IPC 桥接)
  await window.matrixRpc.call('control.touch', {
    device_id: props.deviceId,
    action: 'down',
    x, y,
    pressure: 1.0
  })
}

// 生命周期
onMounted(() => {
  initVideoDecoder()
  connectWebSocket()
})

onUnmounted(() => {
  ws.value?.close()
  videoDecoder.value?.close()
})
</script>

<style scoped>
.video-container {
  position: relative;
  display: inline-block;
}

canvas {
  border: 1px solid #ccc;
  cursor: pointer;
}

.status-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
}
</style>
```

**Phase 4: IPC RPC 桥接** (1天)

```javascript
// electron/exposes/matrixRpc.js
import { ipcRenderer } from 'electron'

export default {
  call: async (method, params) => {
    // 转发 RPC 调用到 Matrix 后端
    const response = await fetch('http://localhost:48000/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now()
      })
    })
    const result = await response.json()
    return result.result
  }
}
```

#### 优点

- ✅ **完全复用** Matrix 的成熟视频架构
- ✅ **后端独立进程**，稳定性高，崩溃不影响 Electron
- ✅ **支持多设备**同时显示
- ✅ **前后端解耦**，易于维护和升级
- ✅ **开发效率高**，大部分代码可复用

#### 缺点

- ❌ 需要打包和分发 **Python 运行时** (~50MB)
- ❌ **架构复杂度**增加 (Electron + Python 双进程)
- ❌ 前端需要 **React → Vue 移植**或混用
- ❌ **跨进程通信**延迟 (~5-10ms)

#### 工作量估算

| 任务 | 时间 |
|------|------|
| Matrix 后端打包测试 | 0.5天 |
| Electron 集成 Python 后端 | 1天 |
| Vue 视频组件移植 | 2天 |
| IPC RPC 桥接 | 0.5天 |
| 触控控制实现 | 1天 |
| 测试和优化 | 1天 |
| **总计** | **6天** |

---

### 方案2: 纯Electron架构 - Node.js视频服务 ⭐⭐⭐⭐

#### 架构图

```
┌─────────────────────────────────────────────────────────┐
│  Electron 应用                                           │
│                                                          │
│  ┌──────────────┐        ┌───────────────────────┐     │
│  │ Vue 渲染进程  │  ←IPC→  │ 主进程 Node.js        │     │
│  │              │        │                       │     │
│  │ - WebVideoView│        │ - VideoStreamManager │     │
│  │ - Canvas解码 │        │ - scrcpy-server管理  │     │
│  │              │        │ - H.264流读取        │     │
│  └──────────────┘        └───────────────────────┘     │
│                                    ↓                    │
│                          ┌───────────────────┐          │
│                          │ child_process     │          │
│                          │                   │          │
│                          │ scrcpy-server.jar │          │
│                          │ (stdout = H.264)  │          │
│                          └───────────────────┘          │
└─────────────────────────────────────────────────────────┘
```

#### 实施步骤

**Phase 1: Node.js ScrcpyDevice 实现** (2天)

```javascript
// electron/services/scrcpyDevice.js
import { spawn } from 'child_process'
import net from 'net'

export class ScrcpyDevice {
  constructor(serial, adbPath) {
    this.serial = serial
    this.adbPath = adbPath
    this.serverProcess = null
    this.videoSocket = null
    this.controlSocket = null
  }

  async start() {
    // 1. 推送 scrcpy-server.jar
    await this.pushServer()

    // 2. 启动 scrcpy-server
    await this.startServer()

    // 3. 端口转发
    await this.forwardPorts()

    // 4. 连接视频流
    await this.connectVideoSocket()
  }

  async pushServer() {
    return new Promise((resolve, reject) => {
      const push = spawn(this.adbPath, [
        '-s', this.serial,
        'push', 'resources/scrcpy-server.jar',
        '/data/local/tmp/scrcpy-server.jar'
      ])

      push.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Push failed with code ${code}`))
      })
    })
  }

  async startServer() {
    const args = [
      '-s', this.serial,
      'shell',
      'CLASSPATH=/data/local/tmp/scrcpy-server.jar',
      'app_process', '/', 'com.genymobile.scrcpy.Server',
      '3.3.3',        // 版本
      'log_level=info',
      'max_size=720',
      'bit_rate=8000000',
      'max_fps=60',
      'tunnel_forward=true',
      'control=true'
    ]

    this.serverProcess = spawn(this.adbPath, args)

    this.serverProcess.stdout.on('data', (data) => {
      console.log('[scrcpy-server]', data.toString())
    })

    // 等待服务器就绪
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  async forwardPorts() {
    const videoPort = 27183
    const controlPort = 27184

    await this.execAdb(['forward', `tcp:${videoPort}`, 'localabstract:scrcpy'])
    await this.execAdb(['forward', `tcp:${controlPort}`, 'localabstract:scrcpy_control'])
  }

  async connectVideoSocket() {
    this.videoSocket = new net.Socket()

    return new Promise((resolve, reject) => {
      this.videoSocket.connect(27183, '127.0.0.1', () => {
        console.log('[VideoSocket] Connected')
        resolve()
      })

      this.videoSocket.on('error', reject)
    })
  }

  readVideoFrame() {
    return new Promise((resolve, reject) => {
      // 读取协议头 (69字节)
      this.videoSocket.once('data', (header) => {
        const serialLen = header[0]
        const pts = header.readBigUInt64BE(1)
        const size = header.readUInt32BE(9)

        // 读取 H.264 数据
        const chunks = []
        let received = 0

        const onData = (chunk) => {
          chunks.push(chunk)
          received += chunk.length

          if (received >= size) {
            this.videoSocket.off('data', onData)
            const h264Data = Buffer.concat(chunks, size)

            resolve({
              pts,
              isConfig: (pts & (1n << 63n)) !== 0n,
              isKeyframe: (pts & (1n << 62n)) !== 0n,
              timestamp: Number(pts & ((1n << 62n) - 1n)),
              data: h264Data
            })
          }
        }

        this.videoSocket.on('data', onData)
      })
    })
  }

  async stop() {
    this.videoSocket?.destroy()
    this.controlSocket?.destroy()
    this.serverProcess?.kill()
  }

  execAdb(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.adbPath, ['-s', this.serial, ...args])
      proc.on('exit', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ADB command failed: ${code}`))
      })
    })
  }
}
```

**Phase 2: 视频流管理器** (1天)

```javascript
// electron/services/videoStreamManager.js
import { EventEmitter } from 'events'
import { ScrcpyDevice } from './scrcpyDevice.js'

export class VideoStreamManager extends EventEmitter {
  constructor() {
    super()
    this.devices = new Map()  // serial -> ScrcpyDevice
    this.streams = new Map()  // serial -> streaming task
  }

  async startStream(serial, adbPath) {
    if (this.streams.has(serial)) {
      return  // 已经在运行
    }

    const device = new ScrcpyDevice(serial, adbPath)
    await device.start()

    this.devices.set(serial, device)

    // 启动流读取循环
    this.streams.set(serial, this.streamLoop(serial, device))
  }

  async streamLoop(serial, device) {
    try {
      while (true) {
        const frame = await device.readVideoFrame()

        // 发送到渲染进程
        this.emit('video-frame', {
          serial,
          ...frame
        })
      }
    } catch (error) {
      console.error('[Stream]', serial, error)
      this.emit('stream-error', { serial, error })
    }
  }

  async stopStream(serial) {
    const device = this.devices.get(serial)
    if (device) {
      await device.stop()
      this.devices.delete(serial)
      this.streams.delete(serial)
    }
  }
}

// electron/main/index.js
import { VideoStreamManager } from '../services/videoStreamManager.js'
import { ipcMain } from 'electron'

const streamManager = new VideoStreamManager()

// IPC 处理
ipcMain.handle('start-video-stream', async (event, { serial, adbPath }) => {
  await streamManager.startStream(serial, adbPath)
})

ipcMain.handle('stop-video-stream', async (event, { serial }) => {
  await streamManager.stopStream(serial)
})

// 转发视频帧到渲染进程
streamManager.on('video-frame', (frame) => {
  mainWindow.webContents.send('video-frame', frame)
})
```

**Phase 3: 渲染进程视频组件** (2天)

```vue
<!-- src/components/NodeVideoStream.vue -->
<template>
  <div class="video-container">
    <canvas ref="videoCanvas" :width="width" :height="height" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ipcRenderer } from 'electron'

interface Props {
  serial: string
  adbPath: string
  width?: number
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  width: 720,
  height: 1280
})

const videoCanvas = ref<HTMLCanvasElement | null>(null)
const videoDecoder = ref<VideoDecoder | null>(null)

// 初始化
onMounted(async () => {
  initVideoDecoder()

  // 启动视频流
  await ipcRenderer.invoke('start-video-stream', {
    serial: props.serial,
    adbPath: props.adbPath
  })

  // 监听视频帧
  ipcRenderer.on('video-frame', handleVideoFrame)
})

// 清理
onUnmounted(async () => {
  await ipcRenderer.invoke('stop-video-stream', {
    serial: props.serial
  })

  ipcRenderer.off('video-frame', handleVideoFrame)
  videoDecoder.value?.close()
})

// VideoDecoder 初始化
const initVideoDecoder = () => {
  const ctx = videoCanvas.value!.getContext('2d')!

  videoDecoder.value = new VideoDecoder({
    output: (frame: VideoFrame) => {
      ctx.drawImage(frame, 0, 0)
      frame.close()
    },
    error: (e) => console.error(e)
  })
}

// 处理视频帧
const handleVideoFrame = (event: any, frame: any) => {
  if (frame.serial !== props.serial) return

  if (frame.isConfig) {
    // 配置帧
    configureDecoder(frame.data)
  } else {
    // 解码帧
    const chunk = new EncodedVideoChunk({
      type: frame.isKeyframe ? 'key' : 'delta',
      timestamp: frame.timestamp,
      data: frame.data
    })
    videoDecoder.value?.decode(chunk)
  }
}

const configureDecoder = (configData: ArrayBuffer) => {
  // TODO: 解析 SPS/PPS
  videoDecoder.value?.configure({
    codec: 'avc1.64001f',
    codedWidth: props.width,
    codedHeight: props.height
  })
}
</script>
```

#### 优点

- ✅ **纯 JavaScript 栈**，无需 Python 依赖
- ✅ **与 Electron 深度集成**，单一进程管理
- ✅ **打包简单**，不需要 Python 运行时
- ✅ **可以复用** Matrix 的前端组件逻辑

#### 缺点

- ❌ 需要**从头实现** Node.js 视频服务
- ❌ scrcpy-server **协议解析较复杂**
- ❌ Node.js **处理二进制流性能**不如 Python
- ❌ **调试困难**，缺少成熟工具

#### 工作量估算

| 任务 | 时间 |
|------|------|
| Node.js ScrcpyDevice 实现 | 3天 |
| VideoStreamManager 实现 | 1天 |
| Vue 视频组件 + IPC | 2天 |
| 触控控制实现 | 1天 |
| 协议调试和优化 | 2天 |
| **总计** | **9天** |

---

### 方案3: WebView嵌入 - 最小改动 ⭐⭐⭐

#### 架构图

```
┌─────────────────────────────────────────────────────┐
│  escrcpyup Electron 应用                             │
│                                                      │
│  ┌─────────────────────┐                            │
│  │ Vue 主界面           │                            │
│  │                     │                            │
│  │ ┌─────────────────┐ │                            │
│  │ │ <iframe>        │ │                            │
│  │ │                 │ │                            │
│  │ │ Matrix Web UI   │ │                            │
│  │ │ (localhost:48000│ │                            │
│  │ │  /device?id=xxx)│ │                            │
│  │ │                 │ │                            │
│  │ └─────────────────┘ │                            │
│  └─────────────────────┘                            │
│                                                      │
│  ┌───────────────────────────────┐                  │
│  │ Matrix Python 后端             │                  │
│  │ (独立进程 - Electron启动)      │                  │
│  │                               │                  │
│  │ http://localhost:48000        │                  │
│  └───────────────────────────────┘                  │
└─────────────────────────────────────────────────────┘
```

#### 实施步骤

**Phase 1: Matrix 后端独立启动** (0.5天)

```javascript
// electron/services/matrixBackend.js (同方案1)
export class MatrixBackendService {
  // ... (代码同方案1)
}
```

**Phase 2: Vue iframe 嵌入** (0.5天)

```vue
<!-- src/pages/device/components/WebMirror.vue -->
<template>
  <div class="web-mirror">
    <iframe
      ref="matrixFrame"
      :src="matrixUrl"
      frameborder="0"
      allowfullscreen
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  deviceId: string
  serial: string
}

const props = defineProps<Props>()

const matrixUrl = computed(() => {
  return `http://localhost:48000/device?id=${props.deviceId}&serial=${props.serial}`
})
</script>

<style scoped>
.web-mirror {
  width: 100%;
  height: 100%;
}

iframe {
  width: 100%;
  height: 100%;
}
</style>
```

**Phase 3: 设备操作更新** (0.5天)

```vue
<!-- src/hooks/useMirrorAction/index.js -->
<script setup>
import { showWebMirror } from '@/utils/webMirror'

export const useMirrorAction = () => {
  const invoke = async (device) => {
    // 旧的方式: window.scrcpy.mirror(device.serial)

    // 新的方式: 打开 Web 镜像
    showWebMirror(device)
  }

  return { invoke }
}
</script>
```

#### 优点

- ✅ **工作量最小**，1-2天完成
- ✅ **完全复用** Matrix 前后端，无需重写
- ✅ **快速验证**可行性
- ✅ 可以**逐步迁移**其他功能

#### 缺点

- ❌ 依赖**外部 Python 服务**
- ❌ **iframe 通信限制**（跨域、消息传递）
- ❌ **用户体验不统一**（两套 UI）
- ❌ **不适合长期使用**（临时方案）

#### 工作量估算

| 任务 | 时间 |
|------|------|
| Matrix 后端打包启动 | 0.5天 |
| iframe 嵌入和测试 | 0.5天 |
| 设备操作更新 | 0.5天 |
| **总计** | **1.5天** |

---

### 方案4: FFmpeg + MSE ⭐⭐⭐

**简述**: 使用 FFmpeg 转码为 HLS/Dash，通过 MSE (Media Source Extensions) 播放。

**优点**: 浏览器原生API，兼容性好

**缺点**: 延迟高 (2-3秒)，不适合实时控制

**工作量**: 4-6天

**不推荐原因**: 延迟过高，Matrix 的 WebCodecs 方案已经足够好。

---

### 方案5: WebRTC ⭐⭐

**简述**: 使用 WebRTC 实时传输视频流。

**优点**: 延迟极低 (<100ms)

**缺点**: 技术复杂度最高，需要 STUN/TURN 服务器

**工作量**: 10-15天

**不推荐原因**: 过度设计，Matrix 的方案已经足够。

---

## 🎯 推荐实施路径

### 阶段1: 快速验证 (1周) - 方案3

**目标**: 验证 Web 视频显示的可行性

**步骤**:
1. 打包 Matrix 后端为可执行文件
2. Electron 启动时自动启动 Matrix 后端
3. iframe 嵌入 Matrix Web UI
4. 测试基本功能

**交付物**:
- ✅ 能在 escrcpyup 中看到 Android 屏幕
- ✅ 基本触控控制可用
- ✅ 多设备测试通过

---

### 阶段2: 生产化 (3周) - 方案1

**目标**: 完整集成，生产级质量

**Week 1: 后端集成**
- Matrix 后端打包优化
- Electron 进程管理完善
- 错误处理和日志

**Week 2: 前端移植**
- 移植 Matrix 视频组件到 Vue
- WebCodecs 解码实现
- 触控控制系统

**Week 3: 优化和测试**
- 性能优化 (CPU/内存)
- 多设备并发测试
- 自动重连机制
- 用户体验优化

**交付物**:
- ✅ 完整的 Web 视频显示功能
- ✅ 稳定的多设备支持
- ✅ 优秀的用户体验

---

### 阶段3 (可选): 纯 Electron (1-2月) - 方案2

**目标**: 摆脱 Python 依赖

**仅在以下情况考虑**:
- 用户强烈要求去除 Python
- 打包体积要求严格 (<100MB)
- 有充足的开发时间

---

## 🔧 技术要点详解

### 1. scrcpy-server 协议解析

#### H.264 帧格式

```
┌─────────────┬──────────┬─────────┬──────────┬─────────────────┐
│ serial_len  │ pts      │ size    │ reserved │ H.264 NAL Units │
│ (1 byte)    │ (8 bytes)│(4 bytes)│(56 bytes)│ (size bytes)    │
└─────────────┴──────────┴─────────┴──────────┴─────────────────┘
```

#### PTS 字段详解

```
Bit 63: is_config (1 = SPS/PPS配置帧, 0 = 普通帧)
Bit 62: is_keyframe (1 = I帧, 0 = P/B帧)
Bits 0-61: 时间戳 (微秒)
```

**Python 解析示例** (Matrix 使用):
```python
pts = struct.unpack('>Q', header[1:9])[0]
is_config = (pts >> 63) & 1
is_keyframe = (pts >> 62) & 1
timestamp = pts & 0x3FFFFFFFFFFFFFFF
```

**JavaScript 解析示例**:
```javascript
const pts = view.getBigUint64(1, false)  // Big-endian
const isConfig = (pts & (1n << 63n)) !== 0n
const isKeyframe = (pts & (1n << 62n)) !== 0n
const timestamp = Number(pts & ((1n << 62n) - 1n))
```

---

### 2. H.264 格式转换

#### Annex-B (scrcpy输出) → AVCC (WebCodecs需要)

**Annex-B** (起始码分隔):
```
00 00 00 01 [NAL Unit 1]
00 00 00 01 [NAL Unit 2]
...
```

**AVCC** (长度前缀):
```
[长度:4字节] [NAL Unit 1]
[长度:4字节] [NAL Unit 2]
...
```

**转换代码** (Matrix 实现):
```typescript
// poly_apps/matrixui/src/utils/h264Utils.ts
export function convertAnnexBToAVCC(annexBData: Uint8Array): Uint8Array {
  const result: number[] = []
  let i = 0

  while (i < annexBData.length) {
    // 查找起始码 (00 00 00 01 或 00 00 01)
    let startCodeLength = 0
    if (i + 3 < annexBData.length &&
        annexBData[i] === 0 && annexBData[i+1] === 0) {
      if (annexBData[i+2] === 0 && annexBData[i+3] === 1) {
        startCodeLength = 4
      } else if (annexBData[i+2] === 1) {
        startCodeLength = 3
      }
    }

    if (startCodeLength > 0) {
      // 找到下一个起始码
      let nextStart = i + startCodeLength
      let found = false

      for (let j = nextStart; j < annexBData.length - 3; j++) {
        if (annexBData[j] === 0 && annexBData[j+1] === 0) {
          if (annexBData[j+2] === 0 && annexBData[j+3] === 1) {
            nextStart = j
            found = true
            break
          } else if (annexBData[j+2] === 1) {
            nextStart = j
            found = true
            break
          }
        }
      }

      if (!found) {
        nextStart = annexBData.length
      }

      // NAL Unit 长度
      const nalLength = nextStart - (i + startCodeLength)

      // 写入长度 (Big-endian 4字节)
      result.push((nalLength >> 24) & 0xFF)
      result.push((nalLength >> 16) & 0xFF)
      result.push((nalLength >> 8) & 0xFF)
      result.push(nalLength & 0xFF)

      // 写入 NAL Unit 数据
      for (let j = i + startCodeLength; j < nextStart; j++) {
        result.push(annexBData[j])
      }

      i = nextStart
    } else {
      i++
    }
  }

  return new Uint8Array(result)
}
```

---

### 3. WebCodecs VideoDecoder 配置

#### 从 SPS/PPS 构建 AVCC Descriptor

```typescript
// poly_apps/matrixui/src/utils/avccDescriptor.ts
export function buildAVCCDescriptor(sps: Uint8Array, pps: Uint8Array) {
  // AVCC Descriptor 结构:
  // - configurationVersion: 1 byte
  // - AVCProfileIndication: 1 byte (从SPS)
  // - profile_compatibility: 1 byte (从SPS)
  // - AVCLevelIndication: 1 byte (从SPS)
  // - lengthSizeMinusOne: 1 byte (0x03 = 4字节长度前缀)
  // - numOfSequenceParameterSets: 1 byte (0xE1 = 1个SPS)
  // - sequenceParameterSetLength: 2 bytes (Big-endian)
  // - sequenceParameterSetNALUnit: SPS数据
  // - numOfPictureParameterSets: 1 byte
  // - pictureParameterSetLength: 2 bytes (Big-endian)
  // - pictureParameterSetNALUnit: PPS数据

  const descriptor = new Uint8Array(
    1 + 1 + 1 + 1 + 1 + 1 +
    2 + sps.length +
    1 +
    2 + pps.length
  )

  let offset = 0

  descriptor[offset++] = 0x01  // configurationVersion
  descriptor[offset++] = sps[1]  // AVCProfileIndication
  descriptor[offset++] = sps[2]  // profile_compatibility
  descriptor[offset++] = sps[3]  // AVCLevelIndication
  descriptor[offset++] = 0xFF  // lengthSizeMinusOne (4字节)

  // SPS
  descriptor[offset++] = 0xE1  // numOfSequenceParameterSets
  descriptor[offset++] = (sps.length >> 8) & 0xFF
  descriptor[offset++] = sps.length & 0xFF
  descriptor.set(sps, offset)
  offset += sps.length

  // PPS
  descriptor[offset++] = 0x01  // numOfPictureParameterSets
  descriptor[offset++] = (pps.length >> 8) & 0xFF
  descriptor[offset++] = pps.length & 0xFF
  descriptor.set(pps, offset)

  return descriptor
}

// 使用
videoDecoder.configure({
  codec: 'avc1.640020',  // H.264 High Profile Level 3.2
  codedWidth: 720,
  codedHeight: 1280,
  description: buildAVCCDescriptor(sps, pps)
})
```

---

### 4. 触控坐标转换

```typescript
// 触控事件处理
const handleTouch = async (event: React.MouseEvent) => {
  const canvas = canvasRef.current
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()

  // 屏幕坐标 → Canvas 坐标
  const canvasX = event.clientX - rect.left
  const canvasY = event.clientY - rect.top

  // Canvas 坐标 → 设备坐标
  const deviceX = Math.floor((canvasX / rect.width) * deviceWidth)
  const deviceY = Math.floor((canvasY / rect.height) * deviceHeight)

  // 发送触控事件
  await window.rpc.call('control.touch', {
    device_id: deviceId,
    action: 'down',  // down / move / up
    x: deviceX,
    y: deviceY,
    pressure: 1.0,
    buttons: event.button  // 0=left, 1=middle, 2=right
  })
}
```

---

### 5. 自动重连机制

```typescript
// Matrix 使用的指数退避重连策略
class VideoStreamReconnector {
  private retryCount = 0
  private readonly maxRetries = 10
  private readonly baseDelay = 1000  // 1秒
  private readonly maxDelay = 30000  // 30秒

  calculateDelay(): number {
    // 指数退避: 1s, 2s, 4s, 8s, 16s, 30s, 30s, ...
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount),
      this.maxDelay
    )
    this.retryCount++
    return delay
  }

  reset() {
    this.retryCount = 0
  }

  async reconnect(connectFn: () => Promise<void>) {
    while (this.retryCount < this.maxRetries) {
      const delay = this.calculateDelay()
      console.log(`Reconnecting in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`)

      await new Promise(resolve => setTimeout(resolve, delay))

      try {
        await connectFn()
        this.reset()
        return true
      } catch (error) {
        console.error('Reconnection failed:', error)
      }
    }

    console.error('Max reconnection attempts reached')
    return false
  }
}
```

---

## 📦 打包和分发

### 方案1打包 (Electron + Python)

**结构**:
```
escrcpyup/
├── electron/
├── src/
├── resources/
│   ├── matrix_backend.exe  (Python打包)
│   ├── scrcpy-server.jar
│   └── adb.exe
└── package.json
```

**electron-builder 配置**:
```json
{
  "build": {
    "extraResources": [
      {
        "from": "resources/matrix_backend.exe",
        "to": "matrix_backend.exe"
      },
      {
        "from": "resources/scrcpy-server.jar",
        "to": "scrcpy-server.jar"
      }
    ]
  }
}
```

**大小估算**:
- Electron: ~120MB
- Python 后端: ~50MB
- 总计: **~170MB**

---

### 方案2打包 (纯 Electron)

**结构**:
```
escrcpyup/
├── electron/
├── src/
├── resources/
│   ├── scrcpy-server.jar
│   └── adb.exe
└── package.json
```

**大小估算**:
- Electron: ~120MB
- 总计: **~120MB**

---

## 🎯 决策矩阵

| 因素 | 方案1 (混合) | 方案2 (纯Electron) | 方案3 (iframe) |
|------|-------------|-------------------|---------------|
| **开发时间** | 6天 | 9天 | 1.5天 |
| **技术风险** | 低 (复用成熟代码) | 中 (需从头实现) | 低 (完全复用) |
| **长期维护** | 中 (双栈) | 低 (单栈) | 高 (临时方案) |
| **打包体积** | 170MB | 120MB | 170MB |
| **性能** | 优秀 | 优秀 | 优秀 |
| **用户体验** | 原生集成 | 原生集成 | 有割裂感 |
| **适用场景** | 生产环境 | 去Python依赖 | 快速验证 |

---

## 🏁 最终建议

### 推荐路径: 方案3 → 方案1

**第1周** (方案3): 快速验证
- 打包 Matrix 后端
- iframe 嵌入测试
- 验证可行性

**第2-4周** (方案1): 生产化
- 移植 Vue 视频组件
- Electron 深度集成
- 优化和测试

**长期可选** (方案2): 纯 Electron
- 仅在明确需要去除 Python 时考虑
- 需要 2-3 周额外开发时间

---

## 📚 参考资料

1. **Matrix 项目**:
   - `pyapps/matrix/services/video_stream_service.py` - 视频流服务
   - `poly_apps/matrixui/src/components/DeviceH264Stream.tsx` - 前端解码
   - `pycore/pyutils/device/scrcpy_device.py` - scrcpy-server管理

2. **WebCodecs API**:
   - MDN: https://developer.mozilla.org/en-US/docs/Web/API/WebCodecs_API
   - VideoDecoder: https://w3c.github.io/webcodecs/#videodecoder-interface

3. **scrcpy 协议**:
   - scrcpy 源码: https://github.com/Genymobile/scrcpy
   - scrcpy-server 协议文档: `docs/developers.md`

4. **Electron + Python**:
   - PyInstaller: https://pyinstaller.org/
   - Electron 子进程: https://www.electronjs.org/docs/latest/api/child-process

---

**文档版本**: 1.0.0
**创建时间**: 2025-12-19
**最后更新**: 2025-12-19
