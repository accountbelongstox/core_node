# Concurrent Startup Root Cause Analysis

**Date**: 2025-12-22
**Status**: ⚠️ IDENTIFIED - Frontend Not Using Batch API

---

## Executive Summary

**Problem**: Devices start serially (one by one) instead of concurrently, taking ~60+ seconds for 19 devices instead of ~5 seconds.

**Root Cause**: Frontend opens individual WebSocket connections with random 0-3s stagger delays, bypassing the concurrent batch startup infrastructure.

**Solution**: Modify frontend to call `wsService.batchStartStreams()` RPC method instead of individual WebSocket connections.

---

## Complete Call Chain Analysis

### Entry Point: `pymain.py`

```
python .\pymain.py app=matrix
  ↓
AppLauncher.start()
  ↓
matrix_main.py → main()
  ↓
rpc_init_callback() → Registers all routes
  ↓
├─ RPC routes (pyapps/matrix/api/main.py)
│  └─ video.batch_start → batch_start_streams() [✅ EXISTS, ❌ NOT CALLED]
│
└─ WebSocket routes (pyapps/matrix/api/video_websocket_routes.py)
   └─ /video/yuv/{device_id} → yuv_video_stream() [✅ CALLED BY FRONTEND]
```

### Frontend Flow (Current - Serial)

**File**: `poly_apps/matrixui/components/DeviceDashboard.tsx`

```
DeviceDashboard.tsx (line 117-146)
  ↓ Fetches devices via RPC
  wsService.callRpc('adb.device.list', {})
  ↓ Returns: [{ deviceId: 'device_1', serial: '192.168.31.117:5555', ... }, ...]
  ↓
  Renders grid of devices
  ↓
  For EACH device:
    <DeviceVideoStream
      key={device.deviceId}
      deviceId={device.deviceId}
      enabled={true}
    />
```

**File**: `poly_apps/matrixui/components/DeviceVideoStream.tsx`

```
DeviceVideoStream (line 64-71)
  ↓ Uses hook
  useVideoStream({
    deviceId,
    enabled: enabled && globalConfig?.video_stream_mode === 'yuv',
    streamType: 'yuv',
    hwaccel: globalConfig?.hwaccel,
  })
```

**File**: `poly_apps/matrixui/hooks/useVideoStream.ts`

```
useVideoStream (line 638-668)
  ↓ Auto-connect on mount
  useEffect(() => {
    if (enabled && !isConnecting && !isConnected) {
      connect(); // Line 654
    }
  }, [enabled, deviceId, streamType, hwaccel])
  ↓
connectInternal() (line 106-509)
  ↓
  // STEP 1: Random delay to avoid "thundering herd"
  const delay = Math.random() * 3000; // 0-3 seconds
  await new Promise(resolve => setTimeout(resolve, delay));
  ↓
  // STEP 2: Build WebSocket URL
  wsUrl = API_CONFIG.WS_VIDEO_YUV_URL(deviceId, hwaccel);
  // Result: ws://localhost:48000/video/yuv/device_1
  ↓
  // STEP 3: Open individual WebSocket
  const ws = new WebSocket(wsUrl); // Line 199
```

### Backend Handling (Current - Individual)

**File**: `pyapps/matrix/api/video_websocket_routes.py:190-252`

```
@router.websocket("/video/yuv/{device_id}")
async def yuv_video_stream(websocket: WebSocket, device_id: str, ...):
  ↓
  serial = device_id_manager.get_serial(device_id) or device_id
  ↓
  await websocket.accept()
  ↓
  success = await video_service.start_yuv_stream(serial, websocket, hwaccel=hwaccel)
```

**File**: `pyapps/matrix/services/video_stream_service.py:550-XXX`

```
async def start_yuv_stream(self, serial: str, websocket: WebSocket, ...):
  ↓
  connection = await self.connection_manager.connect_device(serial, params)
  ↓ (Calls JAR push, device connection, etc. - ONE BY ONE)
```

**Result**: Each device connects individually, no parallel execution.

---

## The Unused Concurrent Infrastructure

### Backend RPC Route (Exists But Not Called)

**File**: `pyapps/matrix/api/main.py:1642-1671`

```python
async def batch_start_streams(data: Dict[str, Any], request_id: str, context: Any):
    """Start video streams for multiple devices concurrently"""
    serials = data.get('serials', [])
    websocket = context.get('websocket')

    video_service = VideoStreamService.instance()
    results = await video_service.batch_start_streams(serials, websocket)

    # Send events for each device
    for serial, success in results.items():
        if success:
            await rpc_server.send_event('device.ready', {'serial': serial})
        else:
            await rpc_server.send_event('device.failed', {'serial': serial})

    return {'success': True, 'results': results}

rpc_server.route('video.batch_start', batch_start_streams, sync=False)
```

### Backend Batch Method (Exists But Not Called)

**File**: `pyapps/matrix/services/video_stream_service.py:473-547`

```python
async def batch_start_streams(self, serials: list[str], websocket: WebSocket):
    """Start multiple devices concurrently using unified threads"""

    main_loop = asyncio.get_event_loop()
    params = ServerParams(max_size=720, codec=VideoCodec.H264)

    # Create threads for ALL devices (PARALLEL)
    threads = []
    for serial in serials:
        thread = DeviceStreamThread(serial, websocket, self, params, main_loop)
        threads.append(thread)
        thread.start()  # All start immediately

    # Wait for all to complete
    for thread in threads:
        thread.join(timeout=60)

    return {t.serial: t.success for t in threads}
```

### DeviceStreamThread (Exists But Not Called)

**File**: `pyapps/matrix/services/video_stream_service.py:69-372`

```python
class DeviceStreamThread(threading.Thread):
    """
    Unified thread for complete device streaming lifecycle

    Steps (all mandatory, idempotent):
    - STEP 1: Verify and push scrcpy-server.jar (parallel)
    - STEP 2: Connect device (parallel)
    - STEP 3: Setup keyframe buffer (parallel)
    - STEP 4: Register streaming callback (parallel)
    """
```

### Frontend Method (Exists But Not Called)

**File**: `poly_apps/matrixui/services/websocket.ts:329-340`

```typescript
public async batchStartStreams(serials: string[]): Promise<any> {
    /**
     * Start multiple video streams concurrently
     * Events emitted for each device:
     * - 'device.ready': Device stream started successfully
     * - 'device.failed': Device stream failed to start
     */
    return this.callRpcV2('video.batch_start', { serials });
}

public onDeviceReady(callback: (event: any) => void) {
    this.onRpcEvent('device.ready', callback);
}

public onDeviceFailed(callback: (event: any) => void) {
    this.onRpcEvent('device.failed', callback);
}
```

---

## Why It's Not Working

### Timeline of Events (Current Serial Behavior)

```
T=0s:    DeviceDashboard renders
T=0s:    device_1 → random delay 2.1s
T=0s:    device_2 → random delay 0.8s
T=0s:    device_3 → random delay 2.9s
...
T=0.8s:  device_2 opens WebSocket → backend starts device_2
T=2.1s:  device_1 opens WebSocket → backend starts device_1
T=2.9s:  device_3 opens WebSocket → backend starts device_3
...
T=60s+:  All 19 devices finally connected (serial!)
```

### What Should Happen (Concurrent Behavior)

```
T=0s:    DeviceDashboard calls wsService.batchStartStreams([device_1, ..., device_19])
T=0s:    Backend creates 19 DeviceStreamThreads
T=0s:    All 19 threads start in parallel:
           - Thread 1: JAR push for device_1
           - Thread 2: JAR push for device_2
           - Thread 3: JAR push for device_3
           ...
T=3s:    All JAR pushes complete (parallel)
T=5s:    All devices connected (parallel)
T=5s:    Backend sends 'device.ready' events for all
T=5s:    Frontend receives events, enables video components
```

---

## Performance Comparison

### Current (Serial with Random Delays)

- Device 1: 0-3s delay + 3s connection = 3-6s
- Device 2: 0-3s delay + 3s connection = 3-6s (serial)
- Device 3: 0-3s delay + 3s connection = 3-6s (serial)
- ...
- **Total for 19 devices**: 60-120 seconds

### Expected (Concurrent)

- All 19 devices start simultaneously
- JAR push: ~3s (parallel)
- Device connection: ~2s (parallel)
- **Total**: ~5 seconds

**Speedup**: 12-24x faster

---

## Solution Options

### Option A: Modify Frontend (Recommended)

**Change**: Modify `DeviceDashboard.tsx` to call batch API on mount

**Implementation**:

```typescript
// In DeviceDashboard.tsx

useEffect(() => {
  const startAllStreams = async () => {
    // Get all device serials
    const serials = mappedDevices.map(d => d.serial);

    // Call batch start RPC
    await wsService.batchStartStreams(serials);

    // Listen for device.ready events
    wsService.onDeviceReady((event) => {
      const { serial } = event.data;
      // Enable video component for this device
      videoStreamEnabledRef.current.set(serial, true);
      setDeviceStreamStates(prev => new Map(prev).set(serial, true));
    });

    wsService.onDeviceFailed((event) => {
      const { serial } = event.data;
      console.error(`[DeviceDashboard] Device ${serial} failed to start`);
    });
  };

  if (mappedDevices.length > 0) {
    startAllStreams();
  }
}, [mappedDevices]);

// Render video components with enabled state from map
<DeviceVideoStream
  deviceId={device.deviceId}
  enabled={deviceStreamStates.get(device.serial) || false}
/>
```

**Pros**:
- ✅ Uses existing batch infrastructure
- ✅ True concurrent startup
- ✅ Clean separation of concerns

**Cons**:
- ⚠️ Requires frontend modification
- ⚠️ Changes user experience (all start together)

---

### Option B: Backend Auto-Batching (Alternative)

**Change**: Detect multiple concurrent WebSocket connections and auto-batch them

**Implementation**:

```python
# In video_stream_service.py

class VideoStreamService:
    def __init__(self):
        self.pending_connections = {}
        self.batch_timeout = 2.0  # seconds

    async def start_yuv_stream(self, serial: str, websocket: WebSocket, ...):
        # Add to pending connections
        self.pending_connections[serial] = (websocket, hwaccel)

        # Start timer if first connection
        if len(self.pending_connections) == 1:
            asyncio.create_task(self._process_batch_after_delay())

        # Wait for batch processing
        ...

    async def _process_batch_after_delay(self):
        await asyncio.sleep(self.batch_timeout)

        # Get all pending connections
        pending = self.pending_connections.copy()
        self.pending_connections.clear()

        # Process as batch
        serials = list(pending.keys())
        await self.batch_start_streams(serials, ...)
```

**Pros**:
- ✅ No frontend changes needed
- ✅ Backward compatible

**Cons**:
- ❌ Complex state management
- ❌ Timing-dependent (what if connections come 3s apart?)
- ❌ Not recommended

---

## Recommended Action

**Priority 1**: Test JAR push fix (already implemented in connection_manager.py)
- This should resolve the `[ERR] Aborted` errors
- Verify with service restart

**Priority 2**: Modify frontend to use batch API
- Change `DeviceDashboard.tsx` to call `wsService.batchStartStreams()`
- Listen for `device.ready` events to enable video components
- Remove random delays from `useVideoStream.ts`

**Priority 3**: Add keyframe cache to YUV mode (separate task)
- Implement `KeyframeBuffer` in YUV streaming loop
- Send cached frames to new clients

---

## Files That Need Modification (Option A)

| File | Change | Lines |
|------|--------|-------|
| `DeviceDashboard.tsx` | Add batch start call on mount | ~30 new lines |
| `DeviceDashboard.tsx` | Add state to track enabled devices | ~5 lines |
| `DeviceDashboard.tsx` | Pass enabled state to DeviceVideoStream | 1 line change |
| `useVideoStream.ts` | Remove random delay (line 115-119) | Delete 5 lines |

**Total Impact**: ~40 lines modified/added

---

## Expected Results After Fix

### First Run (Wrong JARs)
```
[DeviceDashboard] Starting batch stream for 19 devices...
[DeviceStreamThread] [device_1] Starting unified workflow...
[DeviceStreamThread] [device_2] Starting unified workflow...
... (all 19 start simultaneously)
[DeviceStreamThread] [device_1] Jar wrong, pushing...
[DeviceStreamThread] [device_2] Jar wrong, pushing...
... (all push in parallel)
[DeviceStreamThread] [device_1] ✓ All steps completed (5s)
[DeviceStreamThread] [device_2] ✓ All steps completed (5s)
... (all complete within 5-6s)
[DeviceDashboard] ✓ All 19 devices ready
```

### Subsequent Runs (Correct JARs)
```
[DeviceDashboard] Starting batch stream for 19 devices...
[DeviceStreamThread] [device_1] Jar hash correct, verified
[DeviceStreamThread] [device_2] Jar hash correct, verified
... (all verify in parallel, no push needed)
[DeviceStreamThread] [device_1] ✓ All steps completed (0.5s)
[DeviceStreamThread] [device_2] ✓ All steps completed (0.5s)
... (all complete within 0.5s)
[DeviceDashboard] ✓ All 19 devices ready
```

---

## Summary

**Current State**:
- ✅ JAR push fix implemented (connection_manager.py)
- ✅ Batch concurrent infrastructure complete (backend + frontend)
- ❌ Frontend not calling batch API
- ❌ Devices start serially with random delays

**Required Fix**:
- Modify `DeviceDashboard.tsx` to call `wsService.batchStartStreams()`
- Remove random delays from `useVideoStream.ts`
- Listen for `device.ready` events

**Expected Outcome**:
- 12-24x faster startup (5s vs 60-120s for 19 devices)
- True parallel execution
- All idempotency guarantees maintained
