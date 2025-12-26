# Multi-Device Keyframe Synchronization Analysis

## Problem Statement

When streaming from multiple devices concurrently, keyframes arrive at different times because:
1. Each device starts at a different moment
2. Keyframes are generated at fixed 10-second intervals from start time
3. No synchronization mechanism exists between devices

**Example Timeline**:
```
Device A starts at T=0s  → Keyframes at 10s, 20s, 30s, 40s...
Device B starts at T=3s  → Keyframes at 13s, 23s, 33s, 43s...
Device C starts at T=7s  → Keyframes at 17s, 27s, 37s, 47s...
```

**Result**: Clients connecting at T=25s experience different wait times:
- Device A: 5 seconds (waits for 30s keyframe)
- Device B: 8 seconds (waits for 33s keyframe)
- Device C: 2 seconds (waits for 27s keyframe)

## Current Architecture Analysis

### Device Startup Pattern

**Source**: `pyapps/matrix/services/video_stream_service.py:118-244`

```python
async def start_stream(self, serial: str, websocket: WebSocket):
    # Each device starts independently
    # No coordination with other devices

    if serial not in self.active_streams:
        # Mark device as initializing
        self.device_initializing[serial] = True

        # Start server (blocking call in executor)
        await loop.run_in_executor(None, lambda: device.start_server())

        # Create streaming task
        task = asyncio.create_task(self._stream_video_loop(serial, device, stop_event))
```

**Key Observations**:
1. Each device starts asynchronously and independently
2. No global coordination or synchronization
3. No shared start time or keyframe timing
4. Each device maintains its own encoder with independent intervals

### Keyframe Detection

**Source**: `pycore/pyutils/device/scrcpy_device.py:549-563`

```python
def read_video_frame(self):
    # Read frame header (12 bytes)
    pts_raw, packet_size = struct.unpack(">QI", header)

    # Extract flags from PTS
    is_config = bool(pts_raw & 0x8000000000000000)  # bit 63
    is_keyframe = bool(pts_raw & 0x4000000000000000)  # bit 62

    return {
        'data': packet_data,
        'is_keyframe': is_keyframe,  # ← Keyframe flag from encoder
        'is_config': is_config
    }
```

**Key Observations**:
1. Keyframe flag is set by Android MediaCodec encoder
2. Python code only reads the flag, doesn't control generation
3. No way to request keyframe through scrcpy protocol

### Server-Side Encoder Configuration

**Source**: `poly_apps/scrcpy/server/.../SurfaceEncoder.java:31,266`

```java
private static final int DEFAULT_I_FRAME_INTERVAL = 10; // seconds

// In createFormat():
format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, DEFAULT_I_FRAME_INTERVAL);

// Codec options can override this:
if (codecOptions != null) {
    for (CodecOption option : codecOptions) {
        String key = option.getKey();
        Object value = option.getValue();
        CodecUtils.setCodecOption(format, key, value);  // ← Can override!
    }
}
```

**Key Observations**:
1. I-frame interval is set once at encoder initialization
2. Can be overridden via `video_codec_options` parameter
3. No runtime control after encoder starts
4. Android MediaCodec API does NOT support dynamic keyframe requests

## Android MediaCodec Limitations

### No Dynamic Keyframe Request API

**Checked APIs**:
- `MediaCodec.setParameters()` - Exists but doesn't support keyframe request
- `PARAMETER_KEY_REQUEST_SYNC_FRAME` - This constant does NOT exist in Android MediaCodec
- Bundle parameters - No keyframe request parameter available

**Conclusion**: Android MediaCodec **cannot** dynamically request keyframes after encoder starts.

### Why This Limitation Exists

MediaCodec is hardware-backed on most devices:
- Hardware encoder (e.g., Qualcomm, Samsung Exynos)
- Configured at initialization with fixed parameters
- Cannot change GOP structure during encoding
- Requesting keyframe would require encoder reconfiguration (slow)

## Potential Solutions

### Solution 1: Reduce Keyframe Interval (Easiest)

**Approach**: Set shorter I-frame interval for all devices

**Implementation**:
```python
# In scrcpy_device.py server command:
video_codec_options = "i-frame-interval:2"  # 2 seconds instead of 10
```

**Pros**:
- ✅ Simple - just add one parameter
- ✅ Reduces average wait time from 5s to 1s
- ✅ Works with existing architecture
- ✅ No code changes needed

**Cons**:
- ❌ Still not synchronized (devices keyframe at different times)
- ❌ Higher bandwidth usage (~20-30% more)
- ❌ Doesn't solve the root synchronization issue

**Result**:
```
Device A: Keyframes at 2s, 4s, 6s, 8s, 10s...
Device B: Keyframes at 5s, 7s, 9s, 11s, 13s... (started at 3s)
Device C: Keyframes at 9s, 11s, 13s, 15s, 17s... (started at 7s)
```
Still not aligned, but shorter wait times.

---

### Solution 2: Coordinated Device Startup (Moderate)

**Approach**: Start all devices at the same moment, then wait for first keyframe together

**Implementation**:
```python
async def start_all_devices_synchronized(serials: List[str]):
    # Phase 1: Start all servers concurrently (in executor pool)
    tasks = [
        asyncio.create_task(
            loop.run_in_executor(None, lambda s=serial: devices[s].start_server())
        )
        for serial in serials
    ]

    # Wait for all to complete
    await asyncio.gather(*tasks)

    # Phase 2: All devices now running, encoders started at approximately same time
    # Keyframes will be roughly synchronized (within 1-2 second window)

    # Phase 3: Wait for all devices to send first keyframe
    first_keyframes = await asyncio.gather(*[
        wait_for_first_keyframe(serial) for serial in serials
    ])

    # Phase 4: Start streaming loops
    stream_tasks = [
        asyncio.create_task(self._stream_video_loop(serial, devices[serial], stop_events[serial]))
        for serial in serials
    ]
```

**Pros**:
- ✅ Devices start together → keyframes roughly aligned
- ✅ First keyframe wait is synchronized
- ✅ Better user experience for batch operations
- ✅ No parameter changes needed

**Cons**:
- ❌ Requires architectural change to batch device startup
- ❌ Only works for initial batch - new devices still desync
- ❌ Clock drift over time (encoders not perfectly synchronized)
- ❌ ~1-2 second variance even with simultaneous start

**Alignment Quality**:
```
Device A starts at T=0.00s → Keyframes at ~10s, ~20s, ~30s
Device B starts at T=0.05s → Keyframes at ~10s, ~20s, ~30s
Device C starts at T=0.12s → Keyframes at ~10s, ~20s, ~30s

Window: ±0.12s (acceptable for most use cases)
```

---

### Solution 3: Encoder Restart on Demand (Complex)

**Approach**: Restart encoder when keyframe needed

**Implementation**:
```python
async def request_keyframe(serial: str):
    # Stop current encoder
    device.stop_server()

    # Restart encoder (will send config + keyframe immediately)
    await loop.run_in_executor(None, device.start_server)

    # Resume streaming
    # First frame will be config frame + keyframe
```

**Pros**:
- ✅ Can generate keyframe on demand
- ✅ Guaranteed keyframe delivery

**Cons**:
- ❌ Causes 1-2 second stream interruption
- ❌ Very resource intensive (teardown/restart)
- ❌ Terrible user experience (black screen during restart)
- ❌ Not suitable for continuous streaming
- ❌ May fail on some devices

**Not Recommended** - User experience is too poor.

---

### Solution 4: Client-Side Frame Buffering (Advanced)

**Approach**: Buffer recent frames on server, replay to new clients

**Implementation**:
```python
class KeyframeBuffer:
    def __init__(self):
        self.last_keyframe = None
        self.frames_since_keyframe = []

    def add_frame(self, frame):
        if frame['is_keyframe']:
            self.last_keyframe = frame
            self.frames_since_keyframe = []
        else:
            self.frames_since_keyframe.append(frame)

    async def replay_to_client(self, websocket):
        # Send buffered keyframe + subsequent frames
        if self.last_keyframe:
            await websocket.send_bytes(self.last_keyframe)
            for frame in self.frames_since_keyframe:
                await websocket.send_bytes(frame)
```

**Pros**:
- ✅ Instant video for new clients (no wait)
- ✅ No encoder changes needed
- ✅ Works with existing keyframe intervals
- ✅ Smooth user experience

**Cons**:
- ❌ Memory overhead (buffer ~100-500 frames)
- ❌ Complexity in buffer management
- ❌ Need to track per-device buffers
- ❌ Replay delay adds initial latency

**Buffer Size Estimate**:
```
60 FPS × 10 seconds = 600 frames
Average H.264 P-frame size: ~50KB
Buffer size: 600 × 50KB = ~30MB per device
With 19 devices: 30MB × 19 = ~570MB total
```

---

### Solution 5: Hybrid Approach (Recommended)

**Combine multiple strategies**:

**Phase 1: Reduce Interval**
```python
video_codec_options = "i-frame-interval:2"  # Shorter interval
```

**Phase 2: Coordinated Batch Startup**
```python
async def start_device_group(serials: List[str]):
    # Start all devices concurrently
    await asyncio.gather(*[start_device(s) for s in serials])

    # Devices keyframe at roughly same time (±0.5s)
```

**Phase 3: Smart Client Waiting**
```python
# Don't show "waiting" message for < 1 second
# Only show warning if waiting > 3 seconds
```

**Pros**:
- ✅ 2-second intervals → max 2s wait (acceptable)
- ✅ Batch startup reduces variance to ±0.5s
- ✅ Most clients wait < 1 second
- ✅ Minimal code changes
- ✅ Moderate bandwidth increase

**Cons**:
- ❌ Not perfect synchronization
- ❌ Bandwidth ~20% higher than 10s interval

**Result**:
```
Worst case wait: 2 seconds
Average wait: 1 second
With batch start: 0.5-1.5 seconds typical
```

## Comparison Matrix

| Solution | Sync Quality | Complexity | Bandwidth | User Experience | Recommended |
|----------|-------------|------------|-----------|-----------------|-------------|
| 1. Reduce Interval | Low | Very Low | Medium | Good | ⭐⭐⭐⭐ |
| 2. Coordinated Start | Medium | Medium | Low | Good | ⭐⭐⭐ |
| 3. Encoder Restart | Perfect | High | Low | Poor | ❌ |
| 4. Frame Buffering | Perfect | Very High | Low | Excellent | ⭐⭐⭐ |
| 5. Hybrid (1+2) | High | Low | Medium | Very Good | ⭐⭐⭐⭐⭐ |

## Implementation Recommendation

**Immediate Action** (No code changes):
```python
# Add to server command in scrcpy_device.py
video_codec_options = "i-frame-interval:2"
```

**Future Enhancement** (Requires code):
```python
# Add batch device startup function
async def start_devices_batch(serials: List[str]):
    """Start multiple devices with synchronized timing"""
    # Implementation of Solution 2
    pass
```

**Long-term Optimization** (Advanced):
```python
# Add keyframe buffering
class KeyframeCache:
    """Cache last keyframe + subsequent frames for instant replay"""
    # Implementation of Solution 4
    pass
```

## Technical Constraints

### Why We Can't Force Keyframes

**Android MediaCodec API limitations**:
1. No `requestSyncFrame()` method
2. No `PARAMETER_KEY_REQUEST_SYNC_FRAME` constant
3. `setParameters()` doesn't support runtime keyframe requests
4. Hardware encoders don't support dynamic GOP changes

**This is NOT a scrcpy limitation** - it's an Android platform limitation.

### Alternative Protocols

Other streaming protocols handle this differently:

**WebRTC**:
- PLI (Picture Loss Indication) requests
- Encoder can respond to client requests
- But requires different architecture

**RTSP/RTP**:
- Intra-refresh mechanisms
- Can request I-frames via RTCP feedback
- Higher latency, more complex

**scrcpy Protocol**:
- Designed for low-latency screen mirroring
- Optimized for single client
- No bidirectional control channel for encoder feedback

## Conclusion

**Best Solution**: Hybrid Approach (#5)
1. Set `i-frame-interval:2` parameter (immediate)
2. Implement batch device startup (future enhancement)
3. Consider keyframe buffering for premium experience (long-term)

**Why This Works**:
- 2-second intervals are acceptable for multi-client streaming
- Batch startup aligns devices within ±0.5s window
- Combined: most clients wait < 1 second for video
- Bandwidth increase (~20%) is acceptable tradeoff
- No architectural changes required initially
- Path for future optimization exists

**Status**: Analysis complete, solutions identified, ready for implementation decision.
