# Smart Frame Dropping Optimization (智能丢帧优化)

**Date**: 2025-12-13
**Status**: ✅ COMPLETED

## User Requirement

**原始需求**：
> "但要注意客户端先后，随机连接，每次只保证关键帧发送，然后丢掉不能同步的帧。直接同步最新的帧。"

**关键点**：
1. **客户端随机连接** - 新客户端可能在视频流中途加入
2. **只保证关键帧发送** - I帧（关键帧）必须送达
3. **丢掉不能同步的帧** - 慢客户端跳过P帧，不阻塞其他客户端
4. **同步最新的帧** - 始终保持实时性，不堆积旧帧

---

## Problem Analysis

### Video Frame Types

**H.264 帧类型**：
- **I-frame (Intra-frame, 关键帧)**: 完整图像，独立解码，体积大
- **P-frame (Predicted frame, 预测帧)**: 依赖前面的帧，体积小
- **Config frame (SPS/PPS)**: 解码器配置信息

### Issues with Previous Implementation

**问题 1: 新客户端中途加入**
```
Stream:  I  P  P  P  I  P  P  P
Client1: ✓  ✓  ✓  ✓  ✓  ✓  ✓  ✓  (从头开始)
Client2:          ✗  ✗  ✓  ✓  ✓  (中途加入，收到P帧无法解码，花屏)
```
- 新客户端可能在P帧时加入，没有I帧无法解码
- 导致花屏、解码错误

**问题 2: 慢客户端阻塞其他客户端**
```
Fast Client:  等待 Slow Client...  (被阻塞)
Slow Client:  发送中... 缓冲区满... (阻塞整个广播)
```
- WebSocket发送缓冲区满时会阻塞
- 一个慢客户端影响所有其他客户端

**问题 3: 延迟累积导致不实时**
```
时刻 0: 生成帧 #100
时刻 1: 发送给慢客户端 (阻塞 100ms)
时刻 2: 生成帧 #101, #102, #103 (堆积在队列)
时刻 3: 慢客户端终于收完 #100 (已经延迟3帧)
```
- 为了保证所有帧都送达，导致延迟累积
- 失去实时性

---

## Solution: Smart Frame Dropping

### Strategy

**核心原则**：
- **关键帧优先** - I帧必须送达所有客户端
- **新客户端等待** - 中途加入的客户端等待下一个I帧
- **P帧可丢弃** - 已同步的客户端才接收P帧
- **并行广播** - 所有客户端同时发送，互不阻塞

### Implementation Logic

```python
for each frame:
    if frame.is_keyframe:
        # I帧：强制发送给所有客户端
        send_to_all_clients(frame)
        mark_all_clients_as_synced()
    else:
        # P帧：只发送给已同步的客户端
        for client in clients:
            if client.has_received_keyframe:
                send_to_client(frame)
            else:
                skip(client)  # 新客户端等待下一个I帧
```

---

## Code Changes

### 1. Added Client Keyframe Tracking

**File**: `pyapps/matrix/services/video_stream_service.py:81-84`

```python
# Client keyframe synchronization state (智能丢帧优化)
# Tracks which clients have received a keyframe and are ready for P-frames
# Format: {serial: {websocket: bool}}
self.client_keyframe_received: Dict[str, Dict[WebSocket, bool]] = {}
```

**用途**：
- 追踪每个客户端是否已收到关键帧
- `True` = 已同步，可以接收P帧
- `False` = 未同步，等待I帧

---

### 2. Modified H.264 Broadcast with Smart Dropping

**File**: `pyapps/matrix/services/video_stream_service.py:896-968`

**核心逻辑**：
```python
async def _broadcast_frame(self, serial: str, frame: Dict):
    """Broadcast with smart dropping"""

    is_keyframe = frame.get('is_keyframe', False)
    is_config = frame.get('is_config', False)

    tasks = []
    skipped_count = 0

    for ws in clients:
        has_keyframe = self.client_keyframe_received[serial].get(ws, False)

        if is_config:
            # Config frames: always send
            tasks.append(ws.send_bytes(payload))
        elif is_keyframe:
            # I-frame: send to all clients and mark synced
            tasks.append(ws.send_bytes(payload))
            self.client_keyframe_received[serial][ws] = True
        elif has_keyframe:
            # P-frame: only send to synced clients
            tasks.append(ws.send_bytes(payload))
        else:
            # New client waiting for I-frame, skip P-frames
            skipped_count += 1

    # Parallel send
    await asyncio.gather(*tasks, return_exceptions=True)
```

**优势**：
- ✅ 新客户端等待I帧，避免花屏
- ✅ P帧可跳过未同步的客户端，不阻塞
- ✅ I帧强制同步所有客户端

---

### 3. Modified YUV Broadcast with Smart Dropping

**File**: `pyapps/matrix/services/video_stream_service.py:1025-1101`

**YUV模式特殊处理**：
```python
# YUV模式中，h264_frame包含关键帧信息
h264_frame = device.read_video_frame()
yuv_frame = decoder.decode_frame(h264_frame['data'])

# 传递关键帧信息给广播函数
is_keyframe = h264_frame.get('is_keyframe', False)
await self._broadcast_yuv_frame(serial, yuv_frame, is_keyframe)
```

**智能丢帧逻辑**：
```python
async def _broadcast_yuv_frame(self, serial: str, yuv_frame: Dict, is_keyframe: bool):
    for ws in clients:
        has_keyframe = self.client_keyframe_received[serial].get(ws, False)

        if is_keyframe:
            # 关键帧：发送给所有客户端
            tasks.append(ws.send_bytes(payload))
            self.client_keyframe_received[serial][ws] = True
        elif has_keyframe:
            # P帧：只发送给已同步的客户端
            tasks.append(ws.send_bytes(payload))
        else:
            # 新客户端等待关键帧
            skipped_count += 1
```

---

### 4. Client Cleanup on Disconnect

**Files**:
- `stop_stream()`: line 273-300
- `stop_yuv_stream()`: line 516-543

**清理逻辑**：
```python
async def stop_stream(self, serial: str, websocket: WebSocket):
    # Remove client from subscription
    self.stream_clients[serial].discard(websocket)

    # Clean up keyframe tracking for this client
    if serial in self.client_keyframe_received:
        if websocket in self.client_keyframe_received[serial]:
            del self.client_keyframe_received[serial][websocket]

    # If no more clients, clean up all keyframe tracking
    if len(self.stream_clients[serial]) == 0:
        if serial in self.client_keyframe_received:
            del self.client_keyframe_received[serial]
```

---

## Behavior Examples

### Example 1: New Client Joins Mid-Stream

```
时间线：
0s:  [I帧 #0] → Client1 ✓, Client2 ✓
0.5s: [P帧 #1] → Client1 ✓, Client2 ✓
1s:  [P帧 #2] → Client1 ✓, Client2 ✓
1.5s: Client3 连接 (中途加入)
2s:  [P帧 #3] → Client1 ✓, Client2 ✓, Client3 ✗ (等待I帧)
2.5s: [P帧 #4] → Client1 ✓, Client2 ✓, Client3 ✗ (等待I帧)
3s:  [I帧 #5] → Client1 ✓, Client2 ✓, Client3 ✓ (同步！)
3.5s: [P帧 #6] → Client1 ✓, Client2 ✓, Client3 ✓ (全部同步)
```

**日志输出**：
```
[SmartDrop] 192.168.50.142:5555: 1 clients waiting for keyframe
[SmartDrop] 192.168.50.142:5555: 1 clients waiting for keyframe
[SmartDrop] All clients synchronized on keyframe
```

---

### Example 2: Slow Client with Full Buffer

```
假设 Client2 的 WebSocket 发送缓冲区满：

[I帧 #0] → Client1 ✓ (16ms), Client2 ✓ (100ms blocked)
  - 并行发送，不互相阻塞
  - Client2 慢但不影响 Client1

[P帧 #1] → Client1 ✓ (16ms), Client2 发送失败 (buffer full)
  - Client2 发送失败，标记为未同步
  - 后续P帧跳过 Client2

[P帧 #2] → Client1 ✓, Client2 ✗ (跳过)
[P帧 #3] → Client1 ✓, Client2 ✗ (跳过)

[I帧 #4] → Client1 ✓, Client2 ✓ (重新同步)
  - I帧强制发送给所有客户端
  - Client2 重新同步
```

**发送失败处理**：
```python
if isinstance(result, Exception):
    # Reset keyframe state for failed client
    self.client_keyframe_received[serial][ws] = False
```

---

## Performance Impact

### Before Optimization

**新客户端中途加入**：
- 立即开始接收P帧 → 无法解码 → 花屏/解码错误

**慢客户端影响**：
- 串行发送 → 慢客户端阻塞所有客户端 → 延迟累积

### After Optimization

**新客户端中途加入**：
- 等待I帧 → 正确解码 → 画面正常
- 最多等待 1 个 GOP (Group of Pictures) 时间
- 典型等待时间: 1-2秒 (60fps, I帧间隔2秒)

**慢客户端隔离**：
- 并行发送 → 慢客户端不影响其他客户端
- P帧可跳过 → 保持实时性
- I帧强制同步 → 保证画面质量

---

## GOP (Group of Pictures) Configuration

**scrcpy默认配置**：
- I帧间隔: 通常 1-2 秒
- 60fps × 2s = 120帧一个GOP
- 意味着最多跳过 119 个P帧

**优化建议**：
- 可以调整scrcpy的I帧间隔参数
- 更短的GOP → 新客户端等待时间更短
- 更长的GOP → 更高的压缩效率

---

## Testing Scenarios

### Test 1: New Client Joins Mid-Stream
1. Start streaming to Client1
2. Wait 5 seconds (多个P帧)
3. Connect Client2
4. **Expected**: Client2 waits for next I-frame before displaying
5. **Log**: `[SmartDrop] ... clients waiting for keyframe`

### Test 2: Slow Client Isolation
1. Connect Client1 (fast network)
2. Connect Client2 (simulated slow network, throttle bandwidth)
3. **Expected**: Client1 continues at 60fps, Client2 may skip frames
4. **Log**: Client2 send failures, then skipped until next I-frame

### Test 3: Multiple Clients Synchronization
1. Connect 3 clients at different times
2. **Expected**: All clients synchronized on I-frames
3. **Expected**: All clients receive P-frames after synchronization

---

## Monitoring and Debugging

### Key Log Messages

```
[SmartDrop] 192.168.50.142:5555: 2 clients waiting for keyframe
```
- 表示有2个客户端在等待I帧
- 正常行为，会在下一个I帧时同步

```
[SmartDrop YUV] 192.168.50.142:5555: 1 clients waiting for keyframe
```
- YUV模式的智能丢帧日志
- 同样的等待I帧逻辑

```
[VideoStreamService] Failed to send frame to client: ...
```
- 客户端发送失败（通常是断线或缓冲区满）
- 该客户端会被标记为未同步，等待下一个I帧

### Performance Metrics

**关键指标**：
- **I帧到达率**: 应该100%（所有客户端必须收到）
- **P帧到达率**: 已同步客户端应接近100%，新客户端为0%（等待I帧）
- **新客户端等待时间**: 1个GOP时间（通常1-2秒）
- **延迟**: 应保持稳定，不随客户端数量增加

---

## Related Optimizations

### Already Implemented
1. ✅ Parallel broadcasting (asyncio.gather)
2. ✅ Single frame packing (pack once, send to all)
3. ✅ Smart frame dropping (keyframe synchronization)
4. ✅ Disabled debug logging
5. ✅ Disabled access logs

### Future Optimizations
- [ ] Adaptive GOP size based on client count
- [ ] Per-client bitrate adaptation
- [ ] Explicit frame drop notification to clients
- [ ] Client-side decode error recovery

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                  Smart Frame Dropping Flow                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Device Stream:   I  P  P  P  I  P  P  P  I  P  P  P         │
│                   ↓                                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Is Keyframe?                                         │   │
│  └────┬────────────────────────────────────────┬────────┘   │
│       │ YES (I-frame)                           │ NO (P-frame)│
│       ↓                                         ↓            │
│  ┌──────────────────────┐          ┌─────────────────────┐  │
│  │ Send to ALL clients  │          │ Check client state  │  │
│  │ Mark as synced       │          └──────┬──────────────┘  │
│  └──────────────────────┘                 │                 │
│                                   ┌────────┴────────┐        │
│                                   │ Has keyframe?   │        │
│                                   └────┬──────┬─────┘        │
│                                 YES    │      │  NO          │
│                                   ┌────↓      ↓────┐         │
│                                   │ Send   Skip    │         │
│                                   │ frame  frame   │         │
│                                   └────────────────┘         │
│                                                               │
│  Client States:                                              │
│  ┌─────────┐  Wait for I-frame  ┌─────────┐                 │
│  │  New    │ ──────────────────→ │ Synced  │                 │
│  │ Client  │                     │ Client  │                 │
│  └─────────┘                     └─────────┘                 │
│       ↑                                │                     │
│       │  Send failure                  │                     │
│       └────────────────────────────────┘                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

**Implementation Status**: ✅ Complete - H.264 and YUV modes both support smart frame dropping
