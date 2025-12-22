# Concurrent Startup Fix - Issue Analysis & Solution

**Date**: 2025-12-22
**Status**: ⚠️ IN PROGRESS

---

## Problem Analysis (from logs)

### Issue 1: JAR Not Pushed
**Symptom**: All scrcpy-server processes show `[ERR] Aborted` immediately after start

**Root Cause**:
- `connection_manager.py:236-237` had jar push commented out with note: "Jar push is now handled by batch_start_streams()"
- But frontend is NOT calling `batch_start_streams()`
- Frontend is using individual WebSocket connections: `/video/yuv/device_X`
- Result: No jar on devices → scrcpy-server aborts

**Log Evidence**:
```
[ScrcpyDevice] [OK] Killed old scrcpy-server processes on 192.168.31.117:5555
[ScrcpyDevice] Starting scrcpy-server for 192.168.31.117:5555
...
[Server-192.168.31.117:5555] [ERR] Aborted
```
**NO JAR PUSH LOGS!**

### Issue 2: Serial Startup (Not Concurrent)
**Symptom**: Devices start one by one, not in parallel

**Root Cause**:
- Frontend sends individual WebSocket connections (serial)
- Each connection triggers `start_yuv_stream()` separately
- No batch processing happening

**Log Evidence**:
```
[VideoWebSocket] YUV stream connection request... device_1... port=18305
[VideoWebSocket] YUV stream connection request... device_2... port=18307
[VideoWebSocket] YUV stream connection request... device_3... port=18345
... (all separated by time, not concurrent)
```

### Issue 3: No Keyframe Cache Used
**Symptom**: KeyframeBuffer class exists but not utilized in YUV streaming

**Root Cause**:
- KeyframeBuffer only implemented for H.264 streaming
- YUV streaming uses different code path (`start_yuv_stream`)
- No keyframe cache for YUV mode

---

## Solution Implemented

### Fix 1: Restore JAR Push in ConnectionManager ✅

**File**: `pycore/pyutils/device/connection_manager.py:236-251`

**Changes**:
```python
# STEP 1: Verify and push jar (MANDATORY, IDEMPOTENT)
# Always check jar on device, push if wrong (never skip this step)
ColorPrint.blue(f"[ConnectionManager] STEP 1: Verify jar for {connection.serial}...")

jar_correct = await self.server_manager.check_jar_on_device(connection.serial)

if not jar_correct:
    ColorPrint.yellow(f"[ConnectionManager] Jar wrong/missing for {connection.serial}, pushing...")
    push_success = await self.server_manager.push_jar_to_device(connection.serial, force=True)

    if push_success:
        ColorPrint.green(f"[ConnectionManager] ✓ Jar pushed successfully for {connection.serial}")
    else:
        ColorPrint.red(f"[ConnectionManager] Failed to push jar for {connection.serial}, will try anyway")
else:
    ColorPrint.green(f"[ConnectionManager] ✓ Jar correct for {connection.serial}, verified")
```

**Idempotency**: Always checks jar, pushes only if wrong

---

## Remaining Issues

### Issue A: Frontend Not Using Batch Startup ⚠️

**Current Behavior**:
- Frontend opens individual WebSocket connections
- Each device connects separately (serial with 0-3s random delay)

**Root Cause Analysis**: See `CONCURRENT_STARTUP_ROOT_CAUSE_ANALYSIS.md`

**Frontend Call Chain**:
```
DeviceDashboard.tsx → <DeviceVideoStream> (for each device)
  ↓
DeviceVideoStream.tsx → useVideoStream hook
  ↓
useVideoStream.ts → connectInternal()
  ↓
Random 0-3s delay (line 115-119)
  ↓
new WebSocket(ws://localhost:48000/video/yuv/device_X)
  ↓
Backend: /video/yuv/{device_id} route
  ↓
start_yuv_stream() → connection_manager.connect_device() (ONE BY ONE)
```

**Expected Behavior** (from BATCH_STARTUP_KEYFRAME_CACHE_SOLUTION.md):
- Frontend calls `wsService.batchStartStreams([serial_1, ..., serial_19])`
- Backend creates 19 DeviceStreamThreads (parallel execution)
- UI listens for `device.ready` events to enable each video component

**Solution**:
**Modify Frontend** (Recommended):
- File: `poly_apps/matrixui/components/DeviceDashboard.tsx`
- Add batch start call on mount: `wsService.batchStartStreams(serials)`
- Listen for `device.ready` events to enable video streams
- Remove random delay from `useVideoStream.ts` (line 115-119)

### Issue B: Keyframe Cache Not Used in YUV Mode ⚠️

**Current State**:
- KeyframeBuffer class exists (lines 31-66 in video_stream_service.py)
- Only used in H.264 streaming (`_stream_video_loop`)
- YUV streaming uses different code path

**Required**:
- Add KeyframeBuffer to YUV streaming loop
- Cache decoded YUV frames (not raw H.264)
- Send cached frames to new clients on connection

---

## Testing Requirements

### Test 1: JAR Push Verification ✅
**Steps**:
1. Delete jar from one device: `adb -s xxx shell rm /data/local/tmp/scrcpy-server`
2. Start that device
3. Check logs for jar push

**Expected Logs**:
```
[ConnectionManager] STEP 1: Verify jar for xxx...
[ConnectionManager] Jar wrong/missing for xxx, pushing...
[ConnectionManager] ✓ Jar pushed successfully for xxx
[ConnectionManager] Starting scrcpy-server for xxx...
```

### Test 2: Concurrent Startup ⚠️ (Not Yet Implemented)
**Steps**:
1. Frontend calls `wsService.batchStartStreams([device_1, device_2, ..., device_18])`
2. Check logs for parallel execution

**Expected Logs**:
```
[VideoStreamService] Batch starting 18 devices with unified threads...
[DeviceStreamThread] [192.168.31.117:5555] Starting unified workflow...
[DeviceStreamThread] [192.168.31.116:5555] Starting unified workflow...
... (all start simultaneously)
[DeviceStreamThread] [192.168.31.117:5555] ✓ All steps completed
[DeviceStreamThread] [192.168.31.116:5555] ✓ All steps completed
```

### Test 3: Keyframe Cache ⚠️ (Not Yet Implemented)
**Steps**:
1. Start device streaming
2. Connect second client after 5 seconds
3. Check if second client receives instant video

**Expected**:
- Second client receives buffered keyframe immediately
- No 0-10s wait for next keyframe

---

## Implementation Status

| Feature | Design | Backend | Frontend | Status |
|---------|--------|---------|----------|--------|
| JAR Push Verification | ✅ | ✅ | N/A | ✅ DONE |
| Batch Startup API | ✅ | ✅ | ❌ | ⚠️ NOT CALLED |
| DeviceStreamThread | ✅ | ✅ | N/A | ✅ DONE |
| KeyframeBuffer (H.264) | ✅ | ✅ | N/A | ✅ DONE |
| KeyframeBuffer (YUV) | ✅ | ❌ | N/A | ⚠️ TODO |
| Frontend Batch Call | ✅ | N/A | ❌ | ⚠️ TODO |

---

## Next Steps

### Priority 1: Test JAR Fix
1. Restart service
2. Try to connect devices
3. Verify scrcpy-server no longer aborts

### Priority 2: Enable Frontend Batch Startup
**Options**:
- A. Modify frontend to call `batchStartStreams()`
- B. Add auto-batching to backend (detect concurrent requests)

### Priority 3: Add Keyframe Cache to YUV Streaming
- Implement KeyframeBuffer in `_stream_yuv_loop`
- Send cached YUV frames to new clients

---

## Technical Notes

### ADB Serial Command Issue
**Logs show**: `adb.exe: error: more than one device/emulator`

**Cause**: ADB commands without `-s serial` when multiple devices connected

**Workaround**: System correctly fallbacks to FORWARD mode instead of REVERSE

### Version Consistency ✅
All components now use version 3.3.4:
- `scrcpy_server_manager.py:142` → `SCRCPY_VERSION = "3.3.4"`
- `scrcpy_device.py:792` → Startup command uses `"3.3.4"`

---

## Summary

**Fixed**:
- ✅ JAR push restored in ConnectionManager (idempotent)
- ✅ Version consistency (3.3.4)

**Remaining**:
- ⚠️ Frontend not calling batch startup → devices start serially
- ⚠️ Keyframe cache not used in YUV mode → new clients wait for keyframe

**Critical Path**:
1. Test jar fix (should resolve Aborted errors)
2. Modify frontend OR backend to enable concurrent startup
3. Add keyframe cache to YUV streaming
