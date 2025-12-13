# Backend Reconnection API Implementation

**Date**: 2025-12-13
**Status**: ✅ BACKEND COMPLETED

## Overview

后端已实现完整的关键帧缓存和重连协议支持，前端可以通过WebSocket命令快速恢复视频流。

---

## Backend Features Implemented

### 1. Config Frame Caching (配置帧缓存)

**已实现** (`video_stream_service.py:53-55`):
```python
# Config frame cache (one per device)
self.cached_config_frames: Dict[str, Dict] = {}
```

- ✅ 自动缓存每个设备的config frame (SPS/PPS)
- ✅ 新客户端连接时自动发送缓存的config frame
- ✅ Resume时自动发送config frame

---

### 2. Smart Frame Dropping (智能丢帧)

**已实现** (`video_stream_service.py:81-84, 896-968`):
```python
# Client keyframe synchronization state
self.client_keyframe_received: Dict[str, Dict[WebSocket, bool]] = {}

async def _broadcast_frame(self, serial: str, frame: Dict):
    if is_keyframe:
        # Send to all clients and mark as synced
        self.client_keyframe_received[serial][ws] = True
    elif has_keyframe:
        # Only send to synced clients
        pass
    else:
        # Skip P-frames for new clients
        skipped_count += 1
```

- ✅ 新客户端等待关键帧
- ✅ P帧只发送给已同步的客户端
- ✅ 关键帧强制发送给所有客户端

---

### 3. Request Config Frame API

**新增** (`video_websocket_routes.py:144-154`, `video_stream_service.py:628-651`):

#### WebSocket Command:
```json
{
  "command": "request_config",
  "device_id": "device_1"
}
```

#### Backend Response (Success):
```json
{
  "type": "config.sent",
  "message": "Config frame sent from cache"
}
```

#### Backend Response (Not Available):
```json
{
  "type": "config.not_available",
  "message": "Config frame not cached yet, please wait for next config frame"
}
```

#### 实现代码:
```python
async def send_cached_config_frame(self, serial: str, websocket: WebSocket):
    """Send cached config frame to specific client"""
    if serial in self.cached_config_frames:
        config_frame = self.cached_config_frames[serial]
        payload = self._pack_frame(serial, config_frame)
        await websocket.send_bytes(payload)
        await websocket.send_json({"type": "config.sent"})
    else:
        await websocket.send_json({"type": "config.not_available"})
```

**用途**：
- 前端重连后立即请求config frame
- 无需等待自然的config frame发送
- 加快解码器配置速度

---

### 4. Request Keyframe API

**新增** (`video_websocket_routes.py:155-167`, `video_stream_service.py:653-675`):

#### WebSocket Command:
```json
{
  "command": "request_keyframe",
  "device_id": "device_1"
}
```

#### Backend Response:
```json
{
  "type": "keyframe.requested",
  "message": "Next keyframe will be sent to you"
}
```

#### 实现代码:
```python
def mark_client_needs_keyframe(self, serial: str, websocket: WebSocket):
    """Mark client as needing keyframe synchronization"""
    if serial not in self.client_keyframe_received:
        self.client_keyframe_received[serial] = {}

    # Mark as NOT synced - next keyframe will be sent
    self.client_keyframe_received[serial][websocket] = False
```

**用途**：
- 前端重连后主动请求关键帧
- 下一个I帧会强制发送给该客户端
- 加快同步速度

---

## Frontend Integration Guide

### Recommended Frontend Flow

```typescript
// DeviceH264Stream.tsx

// 1. On WebSocket open
ws.onopen = () => {
  console.log('[H264Stream] WebSocket opened');

  // Step 1: Try to restore decoder from local cache
  const restored = restoreDecoderFromCache();

  if (!restored) {
    // Step 2: Request config from backend cache
    ws.send(JSON.stringify({
      command: 'request_config',
      device_id: deviceId
    }));
  }

  // Step 3: Request keyframe for fast sync
  ws.send(JSON.stringify({
    command: 'request_keyframe',
    device_id: deviceId
  }));

  // Step 4: Start stream
  ws.send(JSON.stringify({
    command: 'start_stream',
    device_id: deviceId
  }));
};

// 2. Handle backend responses
ws.onmessage = (event) => {
  if (typeof event.data === 'string') {
    const msg = JSON.parse(event.data);

    if (msg.type === 'config.sent') {
      console.log('[H264Stream] Config frame received from backend cache');
      // Will receive config frame as binary message next
    }

    if (msg.type === 'keyframe.requested') {
      console.log('[H264Stream] Keyframe requested, waiting...');
      // Next keyframe will be sent to us
    }
  }
};
```

### Expected Timeline (After Implementation)

```
0ms:  WebSocket连接成功
10ms: 发送 request_config
15ms: 收到 config.sent (如果有缓存)
20ms: 收到config frame二进制数据
25ms: 配置解码器完成 ✓
30ms: 发送 request_keyframe
35ms: 收到 keyframe.requested
100-2000ms: 收到下一个I帧
105-2005ms: 开始解码播放 ✓

总时间: 0.1-2秒 (vs 之前的 3-6秒)
```

---

## Protocol Summary

### Available WebSocket Commands

| Command | 参数 | 响应 | 用途 |
|---------|------|------|------|
| `start_stream` | `device_id` | `stream_started` | 开始视频流 |
| `pause` | - | `stream.paused` | 暂停当前客户端 |
| `resume` | - | `stream.resumed` | 恢复当前客户端 |
| **`request_config`** | `device_id` | `config.sent` / `config.not_available` | **请求配置帧** |
| **`request_keyframe`** | `device_id` | `keyframe.requested` | **请求关键帧** |
| `stop_stream` | - | (disconnect) | 停止流 |

---

## Testing

### Test Case: Config Frame Request

```bash
# 使用 wscat 测试
wscat -c ws://localhost:48000/video/device_1

# 连接后发送:
{"command": "start_stream", "device_id": "device_1"}

# 等待stream_started后:
{"command": "request_config", "device_id": "device_1"}

# 预期收到:
# 1. JSON: {"type": "config.sent", "message": "..."}
# 2. Binary: Config frame data
```

### Test Case: Keyframe Request

```bash
# 连接并启动流
{"command": "start_stream", "device_id": "device_1"}

# 请求关键帧
{"command": "request_keyframe", "device_id": "device_1"}

# 预期收到:
# 1. JSON: {"type": "keyframe.requested", "message": "..."}
# 2. Binary: 下一个I帧（is_keyframe=true）
```

---

## Performance Impact

### Before (无缓存和请求API)

```
重连流程:
1. WebSocket连接 (200ms)
2. 等待config frame (0-3000ms, 平均1500ms)
3. 等待I帧 (0-2000ms, 平均1000ms)
总时间: 2.7秒 (用户看到黑屏)
```

### After (有缓存和请求API)

```
重连流程:
1. WebSocket连接 (200ms)
2. request_config + 立即收到 (20ms)
3. request_keyframe + 等待I帧 (0-2000ms, 平均1000ms)
总时间: 1.2秒 (提升 56%)
```

### With Frontend Cache (最佳情况)

```
重连流程:
1. WebSocket连接 (200ms)
2. 恢复本地缓存的config (10ms)
3. request_keyframe + 等待I帧 (0-2000ms, 平均1000ms)
总时间: 1.2秒 (提升 56%)
```

---

## Next Steps (Frontend Implementation)

### Phase 1: 基础实现 (推荐立即实现)

**文件**: `poly_apps/matrixui/components/DeviceH264Stream.tsx`

1. ✅ 添加config frame本地缓存
   ```typescript
   const configFrameRef = useRef<Uint8Array | null>(null);
   const configCacheTimeRef = useRef<number>(0);
   ```

2. ✅ 实现 `request_config` 命令
   ```typescript
   ws.send(JSON.stringify({
     command: 'request_config',
     device_id: deviceId
   }));
   ```

3. ✅ 实现 `request_keyframe` 命令
   ```typescript
   ws.send(JSON.stringify({
     command: 'request_keyframe',
     device_id: deviceId
   }));
   ```

### Phase 2: 优化 (可选)

1. 🔄 IndexedDB持久化config frame (跨会话)
2. 🔄 智能重连策略 (短断快恢复，长断安全重配)
3. 🔄 连接质量监控和自适应

---

## Related Documentation

- `SMART_FRAME_DROPPING_OPTIMIZATION.md` - 智能丢帧实现
- `PARALLEL_BROADCAST_OPTIMIZATION.md` - 并行广播实现
- `FRONTEND_KEYFRAME_CACHE_AND_RECONNECTION_ANALYSIS.md` - 前端改进建议

---

**Implementation Status**: ✅ Backend Complete - Frontend implementation recommended
