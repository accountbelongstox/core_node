# 视频解码错误修复方案

## 问题诊断

### 错误现象
切换UI时出现大量解码错误：
```
[VideoDecoder] ✗ Decode error for 192.168.50.240:5555: [Errno 1094995529] Invalid data found when processing input: 'avcodec_send_packet()'
```

### 根本原因

1. **H.264解码器初始化问题**
   - YUV模式仍然需要解码H.264（后端接收H.264→解码→YUV→发送前端）
   - H.264解码器需要按顺序接收：SPS/PPS配置帧 → 关键帧(I-frame) → P/B帧
   - 如果解码器直接收到P/B帧（非关键帧），会产生 `Invalid data found` 错误

2. **新连接时的时序问题**
   - 客户端连接时，scrcpy流可能正在传输中间的P/B帧
   - 解码器来不及等待下一个关键帧就开始处理，导致连续解码失败
   - 虽然有pause/resume机制，但新连接建立时尚未生效

3. **缺少关键帧请求机制**
   - scrcpy支持强制请求关键帧（通过控制消息）
   - 但当前代码没有在新客户端连接时请求关键帧

---

## 后端修复方案

### 方案1: 在新连接时请求关键帧（推荐）

修改 `pyapps/matrix/services/video_stream_service.py`

在 `stream_yuv_to_websocket()` 方法中，解码器创建后立即请求关键帧：

```python
# Create YUV decoder
decoder_service = VideoDecoderService.instance()
try:
    decoder_service.create_decoder(serial, hwaccel=hwaccel)
    ColorPrint.green(f"[VideoStreamService] ✓ YUV decoder created for {serial}")
except Exception as e:
    # ... error handling ...
    return

# ===== 添加以下代码 =====
# Request key frame (IDR) to ensure decoder starts correctly
try:
    # Build control message to request IDR frame
    # scrcpy control protocol: TYPE_SET_SCREEN_POWER_MODE
    # We can trigger IDR by changing video settings or sending specific control message
    ColorPrint.blue(f"[VideoStreamService] Requesting key frame for {serial}...")

    # Method 1: Via device control message (if supported)
    # device.request_key_frame()  # This would need to be implemented in Device class

    # Method 2: Temporarily change bitrate to force IDR (fallback)
    # This triggers encoder to send SPS/PPS and IDR frame
    current_bitrate = device.params.bit_rate
    device.set_video_bitrate(current_bitrate)  # Resetting triggers IDR

    ColorPrint.green(f"[VideoStreamService] Key frame requested for {serial}")
except Exception as e:
    ColorPrint.yellow(f"[VideoStreamService] Could not request key frame: {e}")
# ===== 结束添加 =====

# Send init message
init_message = {
    # ... existing code ...
}
```

### 方案2: 改进解码器错误处理

修改 `pyapps/matrix/services/video_decoder_service.py`

在 `decode_frame()` 方法中添加更智能的错误处理：

```python
def decode_frame(
    self,
    serial: str,
    h264_data: bytes,
    create_if_not_exists: bool = True
) -> Optional[Dict]:
    """解码 H.264 帧到 YUV420P"""

    if serial not in self.decoders:
        if create_if_not_exists:
            self.create_decoder(serial)
        else:
            return None

    codec = self.decoders[serial]
    lock = self.decode_locks[serial]

    # ===== 添加解码器状态跟踪 =====
    # Track decoder state to suppress repeated errors
    if serial not in self.decoder_states:
        self.decoder_states[serial] = {
            'error_count': 0,
            'last_error_time': 0,
            'waiting_for_keyframe': True
        }

    state = self.decoder_states[serial]
    # ===== 结束添加 =====

    try:
        with lock:
            packets = codec.parse(h264_data)

            if not packets:
                return None

            all_frames = []
            for packet in packets:
                # ===== 添加关键帧检测 =====
                # Check if this is a key frame
                is_keyframe = packet.is_keyframe if hasattr(packet, 'is_keyframe') else False

                # If waiting for keyframe and this is not one, skip
                if state['waiting_for_keyframe'] and not is_keyframe:
                    # Suppress frequent error logging
                    import time
                    current_time = time.time()
                    if current_time - state['last_error_time'] > 1.0:  # Log once per second
                        print(f"[VideoDecoder] Waiting for key frame for {serial}, skipping P/B frame...")
                        state['last_error_time'] = current_time
                    continue
                # ===== 结束添加 =====

                frames = codec.decode(packet)
                all_frames.extend(frames)

                # ===== 更新状态 =====
                if frames:
                    state['waiting_for_keyframe'] = False
                    state['error_count'] = 0
                # ===== 结束更新 =====

            if not all_frames:
                return None

            # ... rest of the method ...

    except Exception as e:
        # ===== 改进错误日志 =====
        state['error_count'] += 1

        # Only log first error and every 10th error to avoid spam
        if state['error_count'] == 1 or state['error_count'] % 10 == 0:
            print(f"[VideoDecoder] ✗ Decode error for {serial} (count: {state['error_count']}): {e}")
            if state['error_count'] == 1:
                import traceback
                traceback.print_exc()

        # Mark as waiting for keyframe after errors
        state['waiting_for_keyframe'] = True
        # ===== 结束改进 =====

        return None
```

### 方案3: 缓存配置帧并在恢复时重发

修改 `pyapps/matrix/services/video_stream_service.py`

```python
# 在类初始化时添加
def __init__(self):
    # ... existing code ...
    self.cached_config_frames: Dict[str, bytes] = {}  # serial -> last SPS/PPS frame
    self.cached_keyframes: Dict[str, bytes] = {}  # serial -> last keyframe

# 在 stream_yuv_to_websocket() 的主循环中
async def stream_yuv_to_websocket(self, serial: str, websocket: WebSocket, hwaccel: Optional[str] = None):
    # ... existing setup code ...

    try:
        while True:
            h264_frame = await loop.run_in_executor(None, device.read_video_frame)

            if not h264_frame:
                break

            frame_count += 1

            # ===== 添加配置帧缓存 =====
            # Cache SPS/PPS and keyframes for new clients
            if h264_frame.get('is_config'):
                self.cached_config_frames[serial] = h264_frame['data']
                ColorPrint.blue(f"[VideoStreamService] Cached config frame for {serial}")
            elif h264_frame.get('is_keyframe'):
                self.cached_keyframes[serial] = h264_frame['data']
                ColorPrint.blue(f"[VideoStreamService] Cached keyframe for {serial}")
            # ===== 结束添加 =====

            # Decode H.264 to YUV420P
            try:
                yuv_frame = decoder_service.decode_frame(serial, h264_frame['data'])
                # ... rest of the loop ...
```

然后在 `resume_stream()` 中重发缓存的帧：

```python
async def resume_stream(self, serial: str, websocket: WebSocket):
    """Resume video stream for specific client"""

    # ... existing pause removal code ...

    # Flush decoder to reset state
    try:
        from pyapps.matrix.services.video_decoder_service import VideoDecoderService
        decoder_service = VideoDecoderService.instance()
        decoder_service.flush_decoder(serial)
    except Exception as e:
        ColorPrint.yellow(f"[VideoStreamService] Could not flush decoder: {e}")

    # ===== 添加缓存帧重发 =====
    # Resend cached config frame and keyframe to help decoder restart
    if serial in self.cached_config_frames:
        ColorPrint.blue(f"[VideoStreamService] Resending cached config frame to resumed client")
        config_frame = self.cached_config_frames[serial]
        yuv_frame = decoder_service.decode_frame(serial, config_frame)
        if yuv_frame:
            payload = self._pack_yuv_frame(serial, yuv_frame)
            await websocket.send_bytes(payload)

    if serial in self.cached_keyframes:
        ColorPrint.blue(f"[VideoStreamService] Resending cached keyframe to resumed client")
        keyframe = self.cached_keyframes[serial]
        yuv_frame = decoder_service.decode_frame(serial, keyframe)
        if yuv_frame:
            payload = self._pack_yuv_frame(serial, yuv_frame)
            await websocket.send_bytes(payload)
    # ===== 结束添加 =====

    # Send resume acknowledgment
    await websocket.send_json({"type": "stream.resumed", "serial": serial})

def _pack_yuv_frame(self, serial: str, yuv_frame: Dict) -> bytes:
    """Helper method to pack YUV frame into binary protocol"""
    serial_bytes = serial.encode('utf-8')[:255]

    header = bytes([len(serial_bytes)]) + serial_bytes
    header += struct.pack(
        ">QHHIII",
        yuv_frame.get('pts', 0),
        yuv_frame['width'],
        yuv_frame['height'],
        len(yuv_frame['y_plane']),
        len(yuv_frame['u_plane']),
        len(yuv_frame['v_plane'])
    )

    payload = (
        header +
        yuv_frame['y_plane'] +
        yuv_frame['u_plane'] +
        yuv_frame['v_plane']
    )

    return payload
```

---

## 前端修复方案

### 1. 确保 visibilitychange 正确触发

验证 `useVideoStream.ts` 的 visibilitychange 监听器（第475-506行）：

```typescript
// 现有代码已经正确，但需要确保 enabled 和 deviceId 依赖正确
useEffect(() => {
  if (!enabled || !wsRef.current) return;

  const handleVisibilityChange = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    if (document.hidden) {
      // Page is hidden, pause stream
      console.log(`[useVideoStream] Page hidden, pausing stream for ${deviceId}`);
      try {
        wsRef.current.send(JSON.stringify({ command: 'pause' }));
      } catch (error) {
        console.error(`[useVideoStream] Failed to send pause command for ${deviceId}:`, error);
      }
    } else {
      // Page is visible, resume stream
      console.log(`[useVideoStream] Page visible, resuming stream for ${deviceId}`);
      try {
        wsRef.current.send(JSON.stringify({ command: 'resume' }));
      } catch (error) {
        console.error(`[useVideoStream] Failed to send resume command for ${deviceId}:`, error);
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [enabled, deviceId]); // ✅ 依赖正确
```

### 2. 添加主动暂停机制

在页面切换前主动发送 pause 命令：

```typescript
// 在 DeviceDashboard.tsx 或路由切换逻辑中添加
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom'; // 如果使用 react-router

export const useVideoPauseOnNavigate = () => {
  const location = useLocation();
  const previousPath = useRef(location.pathname);

  useEffect(() => {
    // Detect route change
    if (previousPath.current !== location.pathname) {
      console.log('[VideoPause] Route changed, pausing all video streams...');

      // Get all active video WebSocket connections
      // This would require exposing wsRef from useVideoStream
      // Or maintain a global registry of active video connections

      // For now, rely on visibilitychange which should fire on route changes
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);
};
```

### 3. 改进错误恢复

在 `useVideoStream.ts` 中添加解码错误恢复机制：

```typescript
// 在 ws.onmessage 中处理错误消息
if (message.type === 'video.error') {
  const errorMsg = message.data?.error || message.message || `Video stream error for ${deviceId}`;
  const error = new Error(errorMsg);
  console.error(`[useVideoStream] ✗ Stream error for ${deviceId}:`, errorMsg);

  // ===== 添加自动恢复 =====
  // If error is decode-related, try to recover by requesting resume
  if (errorMsg.includes('decode') || errorMsg.includes('Invalid data')) {
    console.log(`[useVideoStream] Attempting to recover from decode error for ${deviceId}...`);

    // Send resume command to trigger keyframe resend
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        // First pause
        wsRef.current.send(JSON.stringify({ command: 'pause' }));

        // Then resume after a short delay
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ command: 'resume' }));
            console.log(`[useVideoStream] Recovery attempted for ${deviceId}`);
          }
        }, 100);
      } catch (e) {
        console.error(`[useVideoStream] Failed to send recovery commands for ${deviceId}:`, e);
      }
    }
  }
  // ===== 结束添加 =====

  connectionStateRef.current.isConnected = false;
  setIsConnected(false);
  onErrorRef.current?.(error);
}
```

---

## 推荐实施顺序

### 阶段1: 快速修复（立即实施）
1. ✅ **后端方案2** - 改进解码器错误处理（减少错误日志刷屏）
2. ✅ **验证前端 visibilitychange** - 确保暂停/恢复正常工作

### 阶段2: 根本修复（推荐实施）
3. ✅ **后端方案3** - 缓存配置帧和关键帧
4. ✅ **后端方案1** - 新连接时请求关键帧

### 阶段3: 优化体验（可选）
5. ⭕ **前端方案2** - 添加主动暂停机制
6. ⭕ **前端方案3** - 改进错误恢复

---

## 测试验证

### 测试场景1: 页面切换
```
操作步骤：
1. 打开有视频流的页面
2. 切换到另一个页面
3. 切换回视频流页面
4. 观察是否还有解码错误

预期结果：
- 切换走时：视频流暂停，不再发送帧
- 切换回时：视频流恢复，解码器从关键帧开始
- 无解码错误日志
```

### 测试场景2: 多设备切换
```
操作步骤：
1. 打开多设备视频流
2. 快速在不同设备间切换
3. 观察错误日志

预期结果：
- 每个设备的解码器独立管理
- 无交叉干扰
- 错误日志减少90%以上
```

### 测试场景3: 浏览器最小化
```
操作步骤：
1. 打开视频流
2. 最小化浏览器窗口
3. 等待10秒
4. 恢复浏览器窗口

预期结果：
- visibilitychange 正确触发
- 视频流自动暂停/恢复
- 无解码错误
```

---

## 监控指标

实施后需要监控以下指标：

1. **解码错误率**
   - 修复前：可能每秒10-20个错误
   - 修复后：应该低于每分钟1个错误

2. **关键帧请求响应时间**
   - 从请求到收到关键帧的延迟
   - 目标：< 100ms

3. **暂停/恢复延迟**
   - visibilitychange 触发到实际暂停的延迟
   - 目标：< 50ms

4. **解码器恢复成功率**
   - 出错后成功恢复的百分比
   - 目标：> 95%

---

## 前端需要做的工作

### 高优先级（必须）
1. ✅ **验证 visibilitychange 事件**
   - 确认事件在页面切换时正确触发
   - 检查 wsRef.current 的有效性
   - 添加更详细的调试日志

2. ✅ **添加连接状态检查**
   - 在发送 pause/resume 命令前检查 WebSocket 状态
   - 处理 WebSocket 可能为 null 的情况

### 中优先级（推荐）
3. ⭕ **实现错误恢复机制**
   - 检测解码相关错误
   - 自动发送 pause/resume 尝试恢复
   - 限制重试次数（最多3次）

4. ⭕ **添加用户提示**
   - 当视频流出现问题时显示友好的错误提示
   - 提供"重新连接"按钮
   - 显示当前连接状态（正常/暂停/错误）

### 低优先级（优化）
5. ⭕ **实现主动暂停机制**
   - 在路由切换前主动暂停视频
   - 维护全局视频连接注册表
   - 提供批量暂停/恢复API

6. ⭕ **优化重连逻辑**
   - 使用指数退避算法
   - 避免频繁重连
   - 记录重连历史用于诊断

---

## 参考资料

- PyAV Documentation: https://pyav.org/
- scrcpy Protocol: https://github.com/Genymobile/scrcpy/blob/master/PROTOCOL.md
- H.264 NAL Units: https://yumichan.net/video-processing/video-compression/introduction-to-h264-nal-unit/
- WebSocket API: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
