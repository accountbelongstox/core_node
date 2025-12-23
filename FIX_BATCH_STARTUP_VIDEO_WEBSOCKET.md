# Fixed: Batch Startup Video Frame Routing Issue

**Date**: 2025-12-22 (continued session)
**Status**: ✅ FIXED - Ready for testing

---

## Problem Summary

After implementing concurrent batch startup, two critical issues were discovered:

### Issue 1: Video Frames on Wrong WebSocket ❌
- **Symptom**: Frontend receiving binary video data on RPC WebSocket (`/rpc/ws`)
- **Error**: `SyntaxError: Unexpected token 'o', "[object Blob]" is not valid JSON`
- **Root Cause**: Batch startup was subscribing the RPC WebSocket to receive video frames
- **Impact**: Frontend RPC client tried to parse binary Blob data as JSON

### Issue 2: Empty JAR Push Error Messages ❌
- **Symptom**: "Jar push failed:" with no details (6 devices failing on second batch startup)
- **Root Cause**: Error handling only captured `stderr`, which was empty
- **Impact**: Impossible to diagnose why JAR push failed

---

## Solution Implemented

### Fix 1: Separate Video WebSocket from RPC WebSocket ✅

**Architecture Change**:
```
BEFORE (Wrong):
Frontend → RPC WebSocket → batch_start → Subscribe RPC WS to frames
         → Video frames sent to RPC WebSocket → JSON parse error

AFTER (Correct):
Frontend → RPC WebSocket → batch_start → Initialize devices only
        → Separate Video WebSocket → /video/{device_id} → Receive frames
```

**Files Modified**:

#### 1. `pyapps/matrix/services/video_stream_service.py`

**Line 92**: Made websocket parameter optional in DeviceStreamThread
```python
# BEFORE:
websocket: WebSocket,

# AFTER:
websocket: Optional[WebSocket],
```

**Lines 298-305**: Only subscribe websocket if provided
```python
# BEFORE:
if self.serial not in self.video_service.stream_clients:
    self.video_service.stream_clients[self.serial] = set()
self.video_service.stream_clients[self.serial].add(self.websocket)

# AFTER:
if self.websocket:
    if self.serial not in self.video_service.stream_clients:
        self.video_service.stream_clients[self.serial] = set()
    self.video_service.stream_clients[self.serial].add(self.websocket)
    ColorPrint.green(f"[DeviceStreamThread] [{self.serial}] ✓ Keyframe buffer ready, client subscribed")
else:
    ColorPrint.green(f"[DeviceStreamThread] [{self.serial}] ✓ Keyframe buffer ready (no client subscription)")
```

**Line 479**: Made websocket parameter optional with default None
```python
# BEFORE:
async def batch_start_streams(
    self,
    serials: list[str],
    websocket: WebSocket
) -> Dict[str, bool]:

# AFTER:
async def batch_start_streams(
    self,
    serials: list[str],
    websocket: Optional[WebSocket] = None
) -> Dict[str, bool]:
```

#### 2. `pyapps/matrix/api/main.py`

**Lines 1668-1673**: Removed RPC WebSocket from batch_start_streams call
```python
# BEFORE:
websocket = context.get('websocket')
if not websocket:
    return {'error': {'code': 'NO_WEBSOCKET', 'message': 'WebSocket context required'}}
results = await video_service.batch_start_streams(serials, websocket)

# AFTER:
# Start all devices concurrently (no websocket subscription - clients connect separately)
# Frontend should connect to ws://localhost:48000/video/{device_id} to receive frames
results = await video_service.batch_start_streams(serials, websocket=None)
```

---

### Fix 2: Improved JAR Push Error Handling ✅

**File Modified**: `pyapps/matrix/services/video_stream_service.py`

**Lines 236-238**: Capture stdout, stderr, and returncode
```python
# BEFORE:
if push_result.returncode != 0:
    raise RuntimeError(f"Jar push failed: {push_result.stderr}")

# AFTER:
if push_result.returncode != 0:
    error_msg = push_result.stderr.strip() or push_result.stdout.strip() or f"returncode={push_result.returncode}"
    raise RuntimeError(f"Jar push failed: {error_msg}")
```

**Impact**: Now shows actual error messages when JAR push fails (ADB offline, permission denied, etc.)

---

## Expected Behavior After Fix

### Backend Logs (Batch Startup)
```
[VideoStreamService] Batch starting 18 devices with unified threads...
[DeviceStreamThread] [192.168.31.117:5555] Starting unified workflow...
[DeviceStreamThread] [192.168.31.117:5555] STEP 3: Setup keyframe buffer...
[DeviceStreamThread] [192.168.31.117:5555] ✓ Keyframe buffer ready (no client subscription)  ← NEW
[DeviceStreamThread] [192.168.31.117:5555] STEP 4: Schedule stream task...
[DeviceStreamThread] [192.168.31.117:5555] ✓ All steps completed
[VideoStreamService] Batch start completed: 18 succeeded, 0 failed
```

**Key Difference**: "no client subscription" instead of "client subscribed"

### Frontend Logs (Should NOT Show Binary Data Errors)
```
✅ NO MORE: [RPC] Invalid message SyntaxError: Unexpected token 'o', "[object Blob]" is not valid JSON
```

### JAR Push Failures (If Any)
```
# Before (empty message):
[DeviceStreamThread] [192.168.31.117:5555] Workflow failed: Jar push failed:

# After (detailed message):
[DeviceStreamThread] [192.168.31.117:5555] Workflow failed: Jar push failed: adb: error: failed to stat local file '/path/to/jar': No such file or directory
```

---

## Frontend Changes Required (Important!)

The frontend needs to be updated to connect to dedicated video WebSockets **after** batch startup completes.

### Current Frontend Behavior
```typescript
// DeviceDashboard.tsx - Batch startup useEffect
useEffect(() => {
  const startBatchStreams = async () => {
    const serials = mappedDevices.map(d => d.serial);

    // Call batch start RPC (only initializes devices, doesn't stream frames)
    const result = await wsService.batchStartStreams(serials);

    // ⚠️ PROBLEM: No code to connect to video WebSockets!
  };

  startBatchStreams();
}, [mappedDevices]);
```

### Required Change
```typescript
// DeviceDashboard.tsx - Batch startup useEffect
useEffect(() => {
  const startBatchStreams = async () => {
    const serials = mappedDevices.map(d => d.serial);

    // Step 1: Initialize all devices (push JAR, connect, start streaming tasks)
    const result = await wsService.batchStartStreams(serials);

    // Step 2: Connect to dedicated video WebSockets for each device
    for (const device of mappedDevices) {
      // Create video WebSocket connection for each device
      const videoWs = new WebSocket(`ws://localhost:48000/video/${device.deviceId}`);

      videoWs.onopen = () => {
        // Request stream start (required by video WebSocket protocol)
        videoWs.send(JSON.stringify({
          command: 'start_stream',
          device_id: device.deviceId
        }));
      };

      videoWs.onmessage = (event) => {
        // Handle video frames (binary H.264 data) or JSON messages
        if (event.data instanceof Blob) {
          // Binary video frame - pass to video decoder
          handleVideoFrame(device.deviceId, event.data);
        } else {
          // JSON message (stream_started, video.init, etc.)
          const message = JSON.parse(event.data);
          console.log(`[VideoWS] ${device.deviceId}:`, message);
        }
      };
    }
  };

  startBatchStreams();
}, [mappedDevices]);
```

**OR** Use existing video WebSocket service if available:
```typescript
// If wsService has a connectVideoWebSocket method
for (const device of mappedDevices) {
  await wsService.connectVideoWebSocket(device.deviceId);
}
```

---

## Testing Procedure

### Step 1: Restart Backend
```bash
cd D:\programing\core_node
python .\pymain.py app=matrix
```

### Step 2: Wait for Devices to Connect
Backend should show:
```
[ADB] 18 devices connected
[Matrix] Batch startup triggered (from heartbeat or manual call)
[VideoStreamService] Batch starting 18 devices...
[DeviceStreamThread] [device_X] ✓ Keyframe buffer ready (no client subscription)  ← Check this line
[VideoStreamService] Batch start completed: 18 succeeded, 0 failed
```

### Step 3: Open Browser DevTools (F12)
Navigate to `http://localhost:48000` and check console:

**Expected**:
- ✅ NO binary data errors on RPC WebSocket
- ✅ Batch startup RPC completes successfully
- ⚠️ No video frames displayed yet (need to connect video WebSockets)

**If you see**:
```
[RPC] Invalid message SyntaxError: Unexpected token 'o', "[object Blob]" is not valid JSON
```
→ Fix didn't work, check if code was deployed correctly

### Step 4: Connect Video WebSockets (Manual Test)
Open browser console and test video WebSocket manually:
```javascript
const ws = new WebSocket('ws://localhost:48000/video/device_1');

ws.onopen = () => {
  console.log('[VideoWS] Connected');
  ws.send(JSON.stringify({
    command: 'start_stream',
    device_id: 'device_1'
  }));
};

ws.onmessage = (event) => {
  if (event.data instanceof Blob) {
    console.log('[VideoWS] Received video frame:', event.data.size, 'bytes');
  } else {
    console.log('[VideoWS] Message:', JSON.parse(event.data));
  }
};
```

**Expected Output**:
```
[VideoWS] Connected
[VideoWS] Message: {type: "stream_started", serial: "192.168.31.117:5555"}
[VideoWS] Received video frame: 1234 bytes
[VideoWS] Received video frame: 5678 bytes
...
```

---

## Next Steps

1. ✅ **Backend fixes applied** - Ready for testing
2. ⚠️ **Frontend needs update** - Add video WebSocket connections after batch startup
3. 📝 **Test with 18 devices** - Verify no RPC WebSocket binary errors
4. 📝 **Test JAR push failures** - Verify detailed error messages

---

## Rollback Plan

If issues occur, revert these changes:
```bash
git checkout pyapps/matrix/services/video_stream_service.py
git checkout pyapps/matrix/api/main.py
```

---

## Summary

**Root Cause**: Batch startup was using the RPC WebSocket for video frame broadcasting
**Solution**:
- Batch startup now only initializes devices (no WebSocket subscription)
- Clients must connect to dedicated `/video/{device_id}` WebSockets to receive frames
- Improved JAR push error messages (capture stdout + returncode)

**Status**: ✅ Backend fixes complete, frontend integration required
