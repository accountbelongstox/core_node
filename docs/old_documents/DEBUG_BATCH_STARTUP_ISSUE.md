# Debug: Batch Startup Not Called

**Date**: 2025-12-22
**Issue**: Frontend not calling batch startup API, no video streams starting

---

## Symptoms

**Backend Logs Show**:
```
✅ 18 devices connected successfully (device_1 to device_18)
❌ NO batch startup logs
❌ NO DeviceStreamThread logs
❌ NO video streaming activity
❌ NO keyframe pushing
```

**Missing Logs** (should appear if batch startup was called):
```
[VideoStreamService] Batch starting 18 devices with unified threads...
[DeviceStreamThread] [192.168.31.117:5555] Starting unified workflow...
[DeviceStreamThread] [192.168.31.117:5555] STEP 1: Verify jar...
```

---

## Root Cause

**Frontend code not deployed** - DeviceDashboard.tsx modifications need to be rebuilt.

### Why This Happens

Frontend files modified:
1. `poly_apps/matrixui/components/DeviceDashboard.tsx` (line 206-262: batch startup useEffect)
2. `poly_apps/matrixui/hooks/useVideoStream.ts` (line 115-117: removed random delay)

**BUT**: Frontend is running old compiled code, not the new source code.

---

## Solution

### Option A: Rebuild Frontend (Development Mode)

```bash
# Navigate to frontend directory
cd D:\programing\core_node\poly_apps\matrixui

# Install dependencies (if needed)
npm install

# Run development server (hot reload)
npm run dev
```

**Result**: Frontend will auto-rebuild on file changes

---

### Option B: Build Frontend (Production Mode)

```bash
cd D:\programing\core_node\poly_apps\matrixui

# Build for production
npm run build

# Backend should serve the built files from dist/
```

**Note**: Check backend configuration to ensure it serves from correct `dist/` directory

---

## Verification Steps

### Step 1: Check Frontend Build Status

Look for build output:
```
vite v5.x.x building for production...
✓ built in XXXms
```

### Step 2: Open Browser DevTools

1. Navigate to frontend URL (e.g., http://localhost:48000)
2. Open DevTools Console (F12)
3. Refresh page
4. Look for logs:

**Expected Frontend Logs**:
```javascript
[DeviceDashboard] Starting batch video streams for 18 devices: ["192.168.31.117:5555", ...]
```

**If you see**:
```javascript
[useVideoStream] Delaying XXXms before connecting device_X
```
→ **Old code still running** (random delay should be removed)

---

### Step 3: Check Backend Logs

After frontend calls batch API, backend should show:
```
[VideoStreamService] Batch starting 18 devices with unified threads...
[DeviceStreamThread] [192.168.31.117:5555] Starting unified workflow...
[DeviceStreamThread] [192.168.31.117:5555] STEP 1: Verify jar...
```

---

## Alternative: Add Debug Logs to Backend

If frontend is calling API but backend not responding, add logs:

**File**: `pyapps/matrix/api/main.py:1642`

```python
async def batch_start_streams(data: Dict[str, Any], request_id: str, context: Any) -> Dict[str, Any]:
    """Start video streams for multiple devices concurrently"""

    # Add debug log at entry
    serials = data.get('serials', [])
    ColorPrint.yellow(f"[DEBUG] batch_start_streams called with {len(serials)} serials: {serials}")

    if not serials:
        ColorPrint.red(f"[DEBUG] No serials provided!")
        return {'error': {'code': 'NO_SERIALS', 'message': 'Device serials required'}}

    # ... rest of function
```

This will show if RPC is being called but failing silently.

---

## Why Keyframes Not Pushed

**Short Answer**: Video streams never started, so no keyframes to push.

**Detailed Explanation**:
```
Batch startup NOT called
  ↓
DeviceStreamThread NOT created
  ↓
No device connection
  ↓
No video streaming tasks
  ↓
No video frames received from scrcpy
  ↓
No keyframes to cache or push
```

**To Fix**:
1. Deploy frontend code (rebuild)
2. Frontend calls batchStartStreams()
3. Backend creates DeviceStreamThreads
4. Each thread connects device + starts streaming
5. Video frames flow → Keyframes cached → Pushed to clients

---

## Quick Test Without Frontend

To verify backend batch startup works without frontend:

**File**: Create `test_batch_startup.py`

```python
import asyncio
from pyapps.matrix.services.video_stream_service import VideoStreamService
from pycore.pyutils.device_manager import DeviceManager

async def test_batch():
    # Get service instances
    video_service = VideoStreamService.instance()
    device_manager = DeviceManager.instance()

    # Get all device serials
    serials = list(device_manager.devices.keys())
    print(f"Testing batch startup with {len(serials)} devices: {serials}")

    # Create mock websocket (for testing, won't actually send data)
    class MockWebSocket:
        async def send_json(self, data):
            print(f"[MockWS] Would send: {data}")

    mock_ws = MockWebSocket()

    # Call batch start
    results = await video_service.batch_start_streams(serials, mock_ws)
    print(f"Results: {results}")

if __name__ == "__main__":
    asyncio.run(test_batch())
```

Run:
```bash
python test_batch_startup.py
```

This bypasses frontend and tests backend directly.

---

## Summary

**Problem**: Frontend code modified but not deployed
**Solution**: Rebuild frontend (`npm run dev` or `npm run build`)
**Verification**: Check DevTools console for batch startup log
**Result**: Backend will start all devices concurrently, keyframes will be pushed

**Next Step**: Rebuild and test frontend
