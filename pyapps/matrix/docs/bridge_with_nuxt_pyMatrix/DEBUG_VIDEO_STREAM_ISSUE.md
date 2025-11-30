# 视频投屏不显示问题 - 诊断报告

**日期**: 2025-11-06
**问题**: 前端已识别设备连接，但屏幕投屏没有显示
**分析者**: 后端AI

---

## 1. 问题现象

- ✅ 前端能识别到设备连接
- ❌ 视频流没有显示在前端

## 2. 系统架构分析

### 2.1 前端流程 (已验证✅)

```
VideoPlayer.vue (onMounted)
  ↓
connectVideo()
  ↓
useVideoStream.ts (buildVideoWsUrl)
  ↓
WebSocket连接 -> ws://localhost:8889/ws/video/{serial}
  ↓
等待消息:
  - video.connected (JSON)
  - video.init (JSON) ← 触发MediaSource初始化
  - fMP4 init segment (Binary)
  - fMP4 media segments (Binary) ← 添加到SourceBuffer显示
```

**前端代码检查结果**:
- ✅ useVideoStream正确实现
- ✅ onMounted时调用connectVideo() (line 676)
- ✅ MediaSource API正确使用
- ✅ SourceBuffer queue处理正确

### 2.2 后端流程 (需验证⚠️)

```
FastAPI WebSocket /ws/video/{serial}
  ↓
video_stream_endpoint() (ws_routes.py:38)
  ↓
video_service.stream_to_websocket()
  ↓
创建VideoStreamHandler(device)
  ↓
await handler.start() ← 解析H264 SPS/PPS
  ↓
send video.init (JSON)
  ↓
send fMP4 init segment (Binary)
  ↓
async for fmp4_chunk in handler.stream_fmp4():
    send fMP4 media segments (Binary)
```

**后端关键依赖**:
```python
device = device_manager.get_device(serial)  # 从DeviceManager获取设备
handler = VideoStreamHandler(device)        # 创建流处理器
await handler.start()                       # 解析SPS/PPS，初始化FMP4Encoder
handler.get_init_segment()                  # 生成fMP4 init segment
handler.stream_fmp4()                       # 生成fMP4 media segments
```

## 3. 可能的故障点分析

### 🔴 故障点1: ScrcpyDevice未正确启动

**位置**: `device_manager.get_device(serial)`

**症状**: device存在但device.socket_video为None

**原因**:
```python
# DeviceManager可能返回了Device对象
# 但ScrcpyDevice.start_server()没有被调用
# 导致video socket未建立
```

**诊断命令**:
```python
print(f"Device: {device}")
print(f"Device socket_video: {device.socket_video}")
print(f"Device is_started: {device.is_started if hasattr(device, 'is_started') else 'N/A'}")
```

### 🔴 故障点2: VideoStreamHandler.start()失败

**位置**: `await handler.start()` in `video_stream_service.py:83`

**症状**:
- 无法读取SPS/PPS (超过50次尝试)
- FMP4EncoderComplete import失败

**原因**:
```python
# 1. device.read_video_frame() 返回None或阻塞
# 2. av或numpy未安装导致import失败
```

**诊断日志检查**:
```
[VideoStreamHandler] Found SPS (xx bytes)  ← 应该看到
[VideoStreamHandler] Found PPS (xx bytes)  ← 应该看到
[VideoStreamHandler] Encoder initialized: 1080x1920  ← 应该看到
[VideoStreamHandler] Started  ← 应该看到
```

### 🔴 故障点3: 设备连接状态不一致

**位置**: `device_service.is_connected(serial)` in `ws_routes.py:65`

**症状**:
- DeviceService认为设备已连接
- 但ScrcpyDevice实际未启动server

**原因**:
```python
# DeviceManager可能只track了ADB连接
# 但没有track scrcpy-server状态
```

## 4. 诊断步骤

### Step 1: 检查后端日志

启动pyMatrix后端，查看日志中是否有：

```bash
cd D:\programing\core_node\poly_apps\pyMatrix
python -m poly_apps.pyMatrix.main
```

**期望看到的日志**:
```
[VideoStreamService] Sent init segment (xxxx bytes)
[VideoStreamHandler] Found SPS (xx bytes)
[VideoStreamHandler] Found PPS (xx bytes)
[VideoStreamHandler] Encoder initialized: 1080x1920
[VideoStreamHandler] Started
```

**如果没有这些日志，说明VideoStreamHandler启动失败**

### Step 2: 检查设备scrcpy-server状态

在DeviceManager中添加诊断代码：

```python
# 在 poly_apps/pyMatrix/services/device_service.py 中添加

async def diagnose_device(self, serial: str):
    """诊断设备连接状态"""
    device = self.device_manager.get_device(serial)

    if not device:
        return {
            "connected": False,
            "error": "Device not found in DeviceManager"
        }

    return {
        "connected": True,
        "has_video_socket": device.socket_video is not None,
        "has_control_socket": device.socket_control is not None,
        "device_info": device.get_device_info() if hasattr(device, 'get_device_info') else None,
        "scrcpy_server_running": hasattr(device, 'scrcpy_process') and device.scrcpy_process is not None
    }
```

### Step 3: 检查FMP4编码器依赖

```bash
python -c "import av; import numpy; print('Dependencies OK')"
```

如果失败：
```bash
pip install av numpy
```

## 5. 修复方案

### 方案A: 确保ScrcpyDevice正确启动

**修改位置**: `poly_apps/pyMatrix/services/device_service.py`

在连接设备时，确保启动scrcpy-server:

```python
async def connect_device(self, serial: str):
    """连接设备并启动scrcpy-server"""
    device = self.device_manager.create_device(serial)

    # ⚠️ 关键：启动scrcpy-server
    if not device.is_started:
        device.start_server()  # 启动scrcpy-server
        await asyncio.sleep(1)  # 等待server启动

    # 验证video socket已建立
    if not device.socket_video:
        raise RuntimeError(f"Failed to establish video socket for {serial}")

    print(f"✓ Device {serial} connected with video socket")
    return device
```

### 方案B: 添加错误处理和详细日志

**修改位置**: `poly_apps/pyMatrix/services/video_stream_service.py`

```python
async def stream_to_websocket(self, serial: str, websocket: WebSocket):
    handler = None
    try:
        self.paused[serial] = False

        device = self.device_manager.get_device(serial)
        if not device:
            error_msg = {"type": "video.error", "timestamp": 0,
                        "data": {"error": f"Device {serial} not connected"}}
            await websocket.send_json(error_msg)
            return

        # ✅ 新增：验证video socket
        if not device.socket_video:
            error_msg = {"type": "video.error", "timestamp": 0,
                        "data": {"error": f"Device {serial} video socket not established. Please reconnect device."}}
            await websocket.send_json(error_msg)
            print(f"[VideoStreamService] ERROR: Device {serial} has no video socket")
            return

        print(f"[VideoStreamService] Starting video stream for {serial}")
        print(f"[VideoStreamService] Device info: {device.get_device_info()}")

        handler = VideoStreamHandler(device)
        self.handlers[serial] = handler

        # ✅ 新增：添加详细错误处理
        try:
            await handler.start()
            print(f"[VideoStreamService] Handler started successfully")
        except Exception as e:
            error_msg = {"type": "video.error", "timestamp": 0,
                        "data": {"error": f"Failed to start video handler: {str(e)}"}}
            await websocket.send_json(error_msg)
            print(f"[VideoStreamService] ERROR: Failed to start handler: {e}")
            import traceback
            traceback.print_exc()
            return

        # ... 其余代码保持不变
```

### 方案C: 前端添加错误提示

**修改位置**: `apps/app_pymatrix/components_app_pymatrix/VideoPlayer.vue`

在template中添加错误显示：

```vue
<template>
  <div class="relative bg-black rounded-lg overflow-hidden">
    <!-- 视频元素 -->
    <video
      ref="videoElement"
      class="w-full h-full object-contain"
      autoplay
      muted
      playsinline
    />

    <!-- ✅ 新增：错误提示 -->
    <div v-if="!videoConnected && mounted"
         class="absolute inset-0 flex items-center justify-center bg-black/80">
      <div class="text-center text-white px-4">
        <i class="fas fa-exclamation-triangle text-4xl mb-4 text-yellow-400"></i>
        <p class="text-lg font-semibold mb-2">视频流未连接</p>
        <p class="text-sm text-gray-300 mb-4">
          设备: {{ device.serial }}
        </p>
        <p class="text-xs text-gray-400">
          可能原因：<br/>
          1. Scrcpy服务未启动<br/>
          2. 网络连接问题<br/>
          3. 后端服务异常
        </p>
        <button @click="retryConnect"
                class="mt-4 px-4 py-2 bg-blue-600 rounded hover:bg-blue-700">
          重试连接
        </button>
      </div>
    </div>

    <!-- 加载中提示 -->
    <div v-if="videoConnected && !videoInfo"
         class="absolute inset-0 flex items-center justify-center bg-black/60">
      <div class="text-center text-white">
        <i class="fas fa-spinner fa-spin text-3xl mb-2"></i>
        <p>正在初始化视频流...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const mounted = ref(false);

onMounted(() => {
  mounted.value = true;
  connectVideo();
  // ...
});

function retryConnect() {
  disconnectVideo();
  setTimeout(() => {
    connectVideo();
  }, 1000);
}
</script>
```

## 6. 测试验证

### 测试1: 手动测试视频流

```python
# test_video_stream.py
import asyncio
from pycore.pyutils.device_manager import DeviceManager
from pycore.pyutils.video_stream import VideoStreamHandler

async def test_stream():
    dm = DeviceManager.instance()
    devices = dm.list_devices()

    if not devices:
        print("No devices found")
        return

    serial = devices[0].serial
    device = dm.get_device(serial)

    if not device:
        device = dm.create_device(serial)
        device.start_server()  # ← 关键

    print(f"Device: {device}")
    print(f"Video socket: {device.socket_video}")

    handler = VideoStreamHandler(device)
    await handler.start()

    print(f"Config: {handler.config}")

    init_seg = handler.get_init_segment()
    print(f"Init segment: {len(init_seg) if init_seg else 0} bytes")

    count = 0
    async for chunk in handler.stream_fmp4():
        count += 1
        print(f"Frame {count}: {len(chunk)} bytes")
        if count >= 10:
            break

    await handler.stop()

if __name__ == "__main__":
    asyncio.run(test_stream())
```

**期望输出**:
```
Device: <ScrcpyDevice serial=xxx>
Video socket: <socket object>
[VideoStreamHandler] Found SPS (xx bytes)
[VideoStreamHandler] Found PPS (xx bytes)
[VideoStreamHandler] Encoder initialized: 1080x1920
[VideoStreamHandler] Started
Config: H264Config(sps=b'...', pps=b'...', width=1080, height=1920)
Init segment: xxx bytes
Frame 1: xxx bytes
Frame 2: xxx bytes
...
```

### 测试2: 检查WebSocket连接

在浏览器控制台查看：

```javascript
// 打开 http://localhost:3000 (Nuxt前端)
// 打开浏览器DevTools -> Console

// 查看WebSocket连接
performance.getEntriesByType('resource').filter(r => r.name.includes('ws://'))

// 或直接在Network tab查看WS连接状态
```

## 7. 最终确认清单

- [ ] 后端日志显示 "[VideoStreamHandler] Started"
- [ ] 后端日志显示 "[VideoStreamService] Sent init segment"
- [ ] 前端console显示 "[useVideoStream] SourceBuffer created successfully"
- [ ] 前端console没有 "[useVideoStream] Codec not supported" 错误
- [ ] 浏览器Network tab显示WebSocket连接状态为"101 Switching Protocols"
- [ ] video元素开始播放（可以在DevTools Elements中看到currentTime在增加）

---

## 8. 下一步行动

1. **立即执行**: 启动后端查看日志
2. **如果没有日志**: 执行方案A修复设备启动
3. **如果有错误日志**: 根据错误类型执行对应方案
4. **验证修复**: 运行测试1和测试2

## 9. 联系前端

如果后端已确认正常工作，问题可能在前端：

- 检查浏览器兼容性（需Chrome 88+）
- 检查MediaSource API支持
- 检查WebSocket URL是否正确构建

**知道了** - 后端AI已完成分析
