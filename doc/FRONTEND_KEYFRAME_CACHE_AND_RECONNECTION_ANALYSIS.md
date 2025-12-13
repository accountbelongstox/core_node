# Frontend Keyframe Cache and Reconnection Analysis

**Date**: 2025-12-13
**Status**: 🔍 ANALYSIS

## Current Frontend Status

### H.264 Stream Implementation (`DeviceH264Stream.tsx`)

**✅ 已实现**：
- WebCodecs API 解码器
- Config frame (SPS/PPS) 解析和配置
- 关键帧识别 (`is_keyframe`, `is_config`)
- 基本重连逻辑（指数退避）

**❌ 缺失功能**：
- ❌ **Config frame 本地缓存** - 每次重连都要等待新的config frame
- ❌ **主动请求关键帧** - 不能告诉后端"我需要一个I帧"
- ❌ **智能重连** - 重连后直接开始接收P帧，可能花屏

### YUV Stream Implementation (`useVideoStream.ts`)

**✅ 已实现**：
- WebGL YUV渲染
- 二进制协议解析
- 基本重连逻辑

**❌ 缺失功能**：
- ❌ **关键帧缓存** - YUV模式没有config frame概念，但仍需等待关键帧
- ❌ **重连后立即渲染** - 重连后需要等待下一个I帧

---

## Backend Status (已实现)

### ✅ Backend Features Available

**后端已实现智能丢帧优化**：
```python
# video_stream_service.py
self.client_keyframe_received: Dict[str, Dict[WebSocket, bool]] = {}

async def _broadcast_frame(self, serial: str, frame: Dict):
    if is_keyframe:
        # 关键帧：发送给所有客户端
        self.client_keyframe_received[serial][ws] = True
    elif has_keyframe:
        # P帧：只发送给已同步的客户端
        pass
    else:
        # 新客户端等待关键帧
        skipped_count += 1
```

**后端已缓存config frame**：
```python
# H.264模式
self.cached_config_frames: Dict[str, Dict] = {}

async def start_stream(self, serial: str, websocket: WebSocket):
    # 新客户端立即发送cached config frame
    if serial in self.cached_config_frames:
        config_frame = self.cached_config_frames[serial]
        payload = self._pack_frame(serial, config_frame)
        await websocket.send_bytes(payload)
```

---

## Problem Analysis

### Problem 1: 重连后等待时间长

**场景**：
```
时间线：
0s:  用户观看视频（正常）
10s: 网络中断，WebSocket断开
11s: 前端检测到断开，触发重连
12s: WebSocket重新连接成功
13s: 后端发送 P帧 → 前端跳过（等待I帧）
14s: 后端发送 P帧 → 前端跳过（等待I帧）
15s: 后端发送 P帧 → 前端跳过（等待I帧）
...
30s: 后端发送 I帧 → 前端开始解码 ✓
```

**问题**：
- 重连成功后，需要等待下一个I帧（最长2秒）
- 用户看到黑屏或冻结画面
- 体验不佳

### Problem 2: Config Frame 不缓存

**H.264模式下的问题**：
```typescript
// DeviceH264Stream.tsx:384-393
if (isConfig) {
  console.log('[H264Stream] Received config frame');
  if (!decoderRef.current) {
    initDecoder();
  }
  if (decoderRef.current) {
    configureDecoder(h264Data);  // ❌ 配置但不缓存
  }
  return;
}
```

**重连后的情况**：
```
WebSocket reconnect → 等待config frame → 等待I帧 → 开始解码
总等待时间 = config frame延迟 + I帧间隔 = 可能3-4秒
```

### Problem 3: 无主动关键帧请求机制

**当前流程**：
```
Frontend: [重连成功] → 被动等待I帧
Backend:  继续发送P帧 → 前端跳过 → 浪费带宽
```

**理想流程**：
```
Frontend: [重连成功] → 发送 "request_keyframe" 消息
Backend:  立即强制生成I帧 → 前端快速同步
```

---

## Solution Design

### Solution 1: Frontend Config Frame Cache (前端缓存Config帧)

**实现方案**：

```typescript
// DeviceH264Stream.tsx

// 添加config frame缓存
const configFrameRef = useRef<Uint8Array | null>(null);
const lastDecoderConfigRef = useRef<VideoDecoderConfig | null>(null);

function configureDecoder(data: Uint8Array) {
  // ... 现有的配置逻辑 ...

  const config: VideoDecoderConfig = {
    codec,
    description: avcc,
    hardwareAcceleration: 'no-preference'
  };

  decoderRef.current.configure(config);
  decoderConfigured.current = true;

  // ✅ 缓存config frame和配置
  configFrameRef.current = data;
  lastDecoderConfigRef.current = config;

  console.log('[H264Stream] ✓ Config frame cached for fast reconnection');
}

// 重连时快速恢复
ws.onopen = () => {
  console.log('[H264Stream] WebSocket opened');

  // ✅ 如果有缓存的config，立即重新配置解码器
  if (configFrameRef.current && lastDecoderConfigRef.current) {
    console.log('[H264Stream] Restoring decoder from cached config');
    if (!decoderRef.current) {
      initDecoder();
    }
    if (decoderRef.current) {
      decoderRef.current.configure(lastDecoderConfigRef.current);
      decoderConfigured.current = true;
      console.log('[H264Stream] ✓ Decoder restored, ready for frames');
    }
  }

  ws.send(JSON.stringify({ command: 'start_stream', device_id: deviceId }));
};
```

**优势**：
- ✅ 重连后立即恢复解码器，无需等待config frame
- ✅ 减少等待时间：3-4秒 → 0-2秒（只等I帧）
- ✅ 用户体验提升50%+

---

### Solution 2: Request Keyframe Protocol (主动请求关键帧)

#### 2.1 前端实现

```typescript
// DeviceH264Stream.tsx

ws.onopen = () => {
  console.log('[H264Stream] WebSocket opened');

  // 恢复解码器（如果有缓存）
  if (configFrameRef.current && lastDecoderConfigRef.current) {
    // ... restore decoder ...
  }

  // ✅ 主动请求关键帧，加快同步
  ws.send(JSON.stringify({
    command: 'request_keyframe',
    device_id: deviceId
  }));

  console.log('[H264Stream] Keyframe requested from backend');
};
```

#### 2.2 后端实现

```python
# video_websocket_routes.py

@router.websocket("/video/{device_id}")
async def video_websocket(websocket: WebSocket, device_id: str):
    # ... 现有连接逻辑 ...

    try:
        while True:
            data = await websocket.receive()

            if 'text' in data:
                message = json.loads(data['text'])

                if message.get('command') == 'request_keyframe':
                    # ✅ 客户端请求关键帧
                    serial = device_id_to_serial(device_id)
                    await request_keyframe_from_device(serial)

    except WebSocketDisconnect:
        # ... cleanup ...
```

#### 2.3 scrcpy设备接口

```python
# scrcpy_device.py or video_stream_service.py

async def request_keyframe_from_device(serial: str):
    """
    Force scrcpy to generate an I-frame

    Methods:
    1. Send control message to scrcpy-server (if protocol supports)
    2. Temporarily lower bitrate to trigger IDR (not ideal)
    3. Wait for natural I-frame (current behavior)
    """
    device = DeviceManager.instance().get_device(serial)

    # Option 1: 如果scrcpy协议支持，发送控制消息
    # if hasattr(device, 'request_idr_frame'):
    #     device.request_idr_frame()

    # Option 2: 标记需要I帧，在下一个I帧时优先发送
    # 这样至少保证该客户端优先收到下一个I帧
    ColorPrint.blue(f"[VideoStreamService] Keyframe requested for {serial}")

    # 标记该设备需要尽快同步所有客户端
    # 后续的I帧会强制发送给所有客户端（包括刚重连的）
```

**优势**：
- ✅ 重连后主动请求，而不是被动等待
- ✅ 减少黑屏时间
- ✅ 提升用户感知速度

---

### Solution 3: Smart Reconnection with State Persistence (智能重连+状态持久化)

```typescript
// DeviceH264Stream.tsx

// 持久化连接状态
const connectionStateRef = useRef({
  lastFrameTimestamp: 0,
  totalFramesReceived: 0,
  lastKeyframeTimestamp: 0,
  reconnectCount: 0
});

ws.onopen = () => {
  const state = connectionStateRef.current;

  console.log(`[H264Stream] Reconnection #${state.reconnectCount}`);
  console.log(`[H264Stream] Last frame was ${Date.now() - state.lastFrameTimestamp}ms ago`);

  // 策略1: 如果刚刚才断开（<5秒），使用缓存的config快速恢复
  const timeSinceLastFrame = Date.now() - state.lastFrameTimestamp;
  if (timeSinceLastFrame < 5000 && configFrameRef.current) {
    console.log('[H264Stream] Quick reconnect - restoring from cache');
    restoreDecoder();
    requestKeyframe();
  } else {
    console.log('[H264Stream] Long disconnect - waiting for fresh config');
    // 超过5秒，可能参数已改变，等待新的config frame
  }

  state.reconnectCount++;
};

function handleFrame(buffer: ArrayBuffer) {
  // ... 解码逻辑 ...

  // 更新状态
  connectionStateRef.current.lastFrameTimestamp = Date.now();
  connectionStateRef.current.totalFramesReceived++;

  if (isKeyframe) {
    connectionStateRef.current.lastKeyframeTimestamp = Date.now();
  }
}
```

**优势**：
- ✅ 短暂断线快速恢复
- ✅ 长时间断线安全重新配置
- ✅ 智能决策，不盲目缓存

---

### Solution 4: Proactive Config Frame Request (主动请求Config帧)

**后端改进** - 支持显式config frame请求：

```python
# video_websocket_routes.py

async def handle_websocket_message(websocket: WebSocket, message: dict):
    if message.get('command') == 'request_config':
        # ✅ 客户端主动请求config frame
        serial = message['device_id']

        if serial in video_service.cached_config_frames:
            config_frame = video_service.cached_config_frames[serial]
            payload = video_service._pack_frame(serial, config_frame)
            await websocket.send_bytes(payload)

            ColorPrint.green(f"[VideoWebSocket] Sent cached config frame to {websocket.client}")
        else:
            # 没有缓存，等待下一个config frame
            await websocket.send_json({
                "type": "config.not_available",
                "message": "Config frame not cached, please wait"
            })
```

**前端配合**：

```typescript
ws.onopen = () => {
  // ✅ 立即请求config frame（如果本地没有缓存）
  if (!configFrameRef.current) {
    ws.send(JSON.stringify({
      command: 'request_config',
      device_id: deviceId
    }));
    console.log('[H264Stream] Requesting config frame from backend cache');
  } else {
    // 有本地缓存，直接使用
    restoreDecoder();
  }

  // 然后请求关键帧
  ws.send(JSON.stringify({
    command: 'request_keyframe',
    device_id: deviceId
  }));
};
```

---

## Implementation Priority

### Phase 1: 快速优化（立即实现）

**前端**：
1. ✅ Config frame 本地缓存（H.264模式）
2. ✅ 重连时恢复解码器配置
3. ✅ 添加连接状态持久化

**预期收益**：
- 重连速度提升 50%
- 用户等待时间减少 2-3秒

---

### Phase 2: 中期优化（1-2天）

**前端**：
1. ✅ 实现 `request_keyframe` 消息
2. ✅ 实现 `request_config` 消息
3. ✅ 智能重连策略（短断快恢复，长断安全重配）

**后端**：
1. ✅ 处理 `request_keyframe` 命令
2. ✅ 处理 `request_config` 命令
3. ✅ 优先发送config frame给新连接的客户端

**预期收益**：
- 重连成功率提升至 99%+
- 几乎零黑屏时间

---

### Phase 3: 长期优化（可选）

**后端**：
1. 🔄 scrcpy协议层支持强制IDR帧
2. 🔄 自适应I帧间隔（根据客户端数量调整）
3. 🔄 Per-client bitrate适配

**前端**：
1. 🔄 IndexedDB持久化config frame（跨session）
2. 🔄 自动降级策略（WebCodecs失败→Canvas 2D→WebGL）
3. 🔄 前端解码错误自动恢复

---

## Testing Plan

### Test Case 1: 短暂断线恢复

```
步骤：
1. 开始播放视频
2. 断开网络5秒
3. 恢复网络

预期结果：
- ✅ 重连时间 < 1秒
- ✅ 使用缓存的config frame
- ✅ 收到I帧后立即恢复播放
- ✅ 总黑屏时间 < 2秒
```

### Test Case 2: 长时间断线恢复

```
步骤：
1. 开始播放视频
2. 断开网络60秒（超过缓存有效期）
3. 恢复网络

预期结果：
- ✅ 重连成功
- ✅ 请求新的config frame
- ✅ 请求关键帧
- ✅ 安全重新配置解码器
```

### Test Case 3: 多次快速断线重连

```
步骤：
1. 开始播放视频
2. 每5秒断开/重连一次，重复10次

预期结果：
- ✅ 每次重连都成功
- ✅ 不出现内存泄漏
- ✅ 解码器状态正确
- ✅ 无累积性能下降
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Smart Reconnection Flow                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  [网络中断]                                                   │
│      ↓                                                        │
│  [WebSocket断开]                                             │
│      ↓                                                        │
│  [前端检测断开]                                               │
│      ↓                                                        │
│  ┌──────────────────────────────────┐                       │
│  │ 检查本地缓存                      │                       │
│  └────┬─────────────────────┬───────┘                       │
│       │ 有config缓存        │ 无缓存                        │
│       ↓                     ↓                                │
│  ┌──────────────┐     ┌──────────────┐                     │
│  │ 恢复解码器   │     │ 等待config   │                     │
│  │ (< 100ms)    │     │ (1-2秒)      │                     │
│  └──────┬───────┘     └──────┬───────┘                     │
│         │                     │                              │
│         └─────────┬───────────┘                             │
│                   ↓                                          │
│         ┌──────────────────┐                                │
│         │ 发送 request_    │                                │
│         │ keyframe         │                                │
│         └────────┬─────────┘                                │
│                  ↓                                           │
│         ┌──────────────────┐                                │
│         │ 后端优先发送     │                                │
│         │ 下一个I帧       │                                │
│         └────────┬─────────┘                                │
│                  ↓                                           │
│         ┌──────────────────┐                                │
│         │ 前端开始解码     │                                │
│         │ 恢复播放 ✓      │                                │
│         └──────────────────┘                                │
│                                                               │
│  总时间:                                                     │
│  - 有缓存: 0.1s (恢复) + 0-2s (等I帧) = 0.1-2.1s           │
│  - 无缓存: 1-2s (config) + 0-2s (等I帧) = 1-4s             │
│  - 原方案: 3-4s (等config) + 0-2s (等I帧) = 3-6s           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Implementation

### Frontend - Config Frame Cache

```typescript
// DeviceH264Stream.tsx - 完整实现

import React, { useEffect, useRef, useState, useCallback } from 'react';

const DeviceH264Stream: React.FC<Props> = ({ deviceId, enabled }) => {
  // ... existing refs ...

  // ✅ NEW: Config frame cache
  const configFrameDataRef = useRef<Uint8Array | null>(null);
  const lastDecoderConfigRef = useRef<VideoDecoderConfig | null>(null);
  const configCacheTimeRef = useRef<number>(0);
  const CONFIG_CACHE_TTL = 30000; // 30秒有效期

  function configureDecoder(data: Uint8Array) {
    if (!decoderRef.current) return;

    const nalus = extractNalus(data);
    const sps = nalus.filter(n => (n[0] & 0x1f) === 7);
    const pps = nalus.filter(n => (n[0] & 0x1f) === 8);

    if (!sps.length || !pps.length) {
      console.error('[H264Stream] Missing SPS or PPS');
      return;
    }

    const avcc = buildAvcc(sps, pps);
    const codec = getCodec(sps[0]);

    const config: VideoDecoderConfig = {
      codec,
      description: avcc,
      hardwareAcceleration: 'no-preference'
    };

    decoderRef.current.configure(config);
    decoderConfigured.current = true;

    // ✅ Cache config for fast reconnection
    configFrameDataRef.current = data;
    lastDecoderConfigRef.current = config;
    configCacheTimeRef.current = Date.now();

    console.log('[H264Stream] ✓ Config cached (TTL: 30s)');
  }

  function restoreDecoderFromCache(): boolean {
    const cacheAge = Date.now() - configCacheTimeRef.current;

    if (!configFrameDataRef.current || !lastDecoderConfigRef.current) {
      console.log('[H264Stream] No cached config available');
      return false;
    }

    if (cacheAge > CONFIG_CACHE_TTL) {
      console.log(`[H264Stream] Cached config expired (${cacheAge}ms > ${CONFIG_CACHE_TTL}ms)`);
      return false;
    }

    console.log(`[H264Stream] Restoring decoder from cache (age: ${cacheAge}ms)`);

    if (!decoderRef.current) {
      initDecoder();
    }

    if (decoderRef.current) {
      decoderRef.current.configure(lastDecoderConfigRef.current);
      decoderConfigured.current = true;
      console.log('[H264Stream] ✓ Decoder restored successfully');
      return true;
    }

    return false;
  }

  const connect = useCallback(() => {
    // ... existing connection logic ...

    ws.onopen = () => {
      console.log(`[H264Stream] WebSocket opened for ${deviceId}`);

      // ✅ Try to restore from cache
      const restored = restoreDecoderFromCache();

      if (!restored) {
        console.log('[H264Stream] No valid cache, will wait for config frame');
      }

      // ✅ Request keyframe to speed up sync
      ws.send(JSON.stringify({
        command: 'request_keyframe',
        device_id: deviceId
      }));

      ws.send(JSON.stringify({ command: 'start_stream', device_id: deviceId }));

      reconnectAttemptsRef.current = 0;
      setIsReconnecting(false);
      setConnectionError(null);
    };

    // ... rest of connection logic ...
  }, [deviceId, enabled]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
};
```

---

**Implementation Status**: 📋 Planned - Ready for implementation
