# YUV Stream Frontend-Backend Consistency Analysis Report

**Date**: 2025-12-12
**Scope**: Matrix Application YUV Video Streaming
**Status**: 🔴 Critical Issues Found

---

## Executive Summary

Comprehensive analysis of YUV stream implementation reveals **6 critical consistency issues** between frontend and backend that could cause runtime failures:

| Issue ID | Severity | Component | Impact |
|----------|----------|-----------|--------|
| YUV-001 | 🔴 CRITICAL | Binary Protocol | Data corruption for large frames |
| YUV-002 | 🟠 HIGH | JSON Messages | Missing fields cause type errors |
| YUV-003 | 🟠 HIGH | Error Messages | Inconsistent error formats |
| YUV-004 | 🟡 MEDIUM | WebSocket URLs | Hardcoded localhost |
| YUV-005 | 🟡 MEDIUM | Metadata Format | Field name mismatches |
| YUV-006 | 🟢 LOW | Documentation | Protocol spec inconsistencies |

---

## Issue YUV-001: Binary Protocol Integer Type Mismatch 🔴 CRITICAL

### Backend Implementation
**File**: `pyapps/matrix/services/video_stream_service.py:764`
```python
header += struct.pack(
    ">QHHIII",  # I = unsigned int (uint32)
    yuv_frame.get('pts', 0),
    yuv_frame['width'],
    yuv_frame['height'],
    len(yuv_frame['y_plane']),      # unsigned int
    len(yuv_frame['u_plane']),      # unsigned int
    len(yuv_frame['v_plane'])       # unsigned int
)
```

### Frontend Implementation
**File**: `poly_apps/matrixui/hooks/useVideoStream.ts:221-223`
```typescript
const ySize = view.getInt32(offset); offset += 4;  // ❌ SIGNED int32
const uSize = view.getInt32(offset); offset += 4;  // ❌ SIGNED int32
const vSize = view.getInt32(offset); offset += 4;  // ❌ SIGNED int32
```

### Problem
- **Backend sends**: Unsigned 32-bit integers (range: 0 to 4,294,967,295)
- **Frontend reads**: Signed 32-bit integers (range: -2,147,483,648 to 2,147,483,647)
- **Impact**: Frames with plane sizes > 2,147,483,647 bytes will be interpreted as negative numbers
  - Example: 2,500,000,000 bytes → -1,794,967,296 (frontend)
  - Causes: Array allocation errors, frame skip, stream crash

### Frame Size Calculations
| Resolution | Y Size | U Size | V Size | Total | Issue? |
|-----------|--------|--------|--------|-------|--------|
| 720p (1280x720) | 921,600 | 230,400 | 230,400 | 1.32 MB | ✅ Safe |
| 1080p (1920x1080) | 2,073,600 | 518,400 | 518,400 | 2.97 MB | ❌ **Y plane overflow!** |
| 4K (3840x2160) | 8,294,400 | 2,073,600 | 2,073,600 | 11.89 MB | ❌ **All planes overflow!** |

**Critical**: 1080p and higher resolutions will fail!

### Fix Required
**File**: `poly_apps/matrixui/hooks/useVideoStream.ts:221-223`
```typescript
// ❌ BEFORE (Signed)
const ySize = view.getInt32(offset); offset += 4;
const uSize = view.getInt32(offset); offset += 4;
const vSize = view.getInt32(offset); offset += 4;

// ✅ AFTER (Unsigned)
const ySize = view.getUint32(offset); offset += 4;
const uSize = view.getUint32(offset); offset += 4;
const vSize = view.getUint32(offset); offset += 4;
```

---

## Issue YUV-002: JSON Message Field Mismatches 🟠 HIGH

### 1. `video.init` Message

#### Backend Sends
**File**: `pyapps/matrix/services/video_stream_service.py:702-718`
```python
{
    "type": "video.init",
    "data": {
        "serial": serial,
        "codec": "h264",
        "format": "yuv420p",
        "width": device_info.resolution.width,
        "height": device_info.resolution.height,
        "fps": device.params.max_fps,
        "hwaccel": hwaccel or "software"
    }
    # ❌ NO timestamp field
    # ❌ NO bitrate field
}
```

#### Frontend Expects
**File**: `poly_apps/matrixui/hooks/useVideoStream.ts:17-30`
```typescript
interface VideoInitMessage {
  type: 'video.init';
  timestamp: number;           // ❌ MISSING in backend
  data: {
    serial: string;
    codec: string;
    format?: string;
    width: number;
    height: number;
    fps: number;
    bitrate?: number;           // ❌ MISSING in backend
    hwaccel?: string;
  };
}
```

#### Impact
- `message.timestamp` will be `undefined` (may cause logging errors)
- `message.data.bitrate` will be `undefined` (acceptable - optional field)

#### Fix Required
**Option 1**: Add fields to backend (recommended)
```python
{
    "type": "video.init",
    "timestamp": int(time.time() * 1000),  # Add timestamp
    "data": {
        "serial": serial,
        "codec": "h264",
        "format": "yuv420p",
        "width": device_info.resolution.width,
        "height": device_info.resolution.height,
        "fps": device.params.max_fps,
        "bitrate": device.params.bit_rate,  # Add bitrate
        "hwaccel": hwaccel or "software"
    }
}
```

**Option 2**: Make fields optional in frontend
```typescript
interface VideoInitMessage {
  type: 'video.init';
  timestamp?: number;           // Optional
  data: {
    // ... same as before
    bitrate?: number;           // Already optional
  };
}
```

### 2. `video.metadata` Message

#### Backend Sends
**File**: `pyapps/matrix/services/video_stream_service.py:792-805`
```python
{
    "type": "video.metadata",
    "timestamp": int(time.time() * 1000),
    "data": {
        "fps": current_fps,
        "frames": frame_count,
        "bytes": bytes_sent,
        "mbps": round(current_mbps, 1),
        "format": "yuv420p"
    }
}
```

#### Frontend Expects
**File**: `poly_apps/matrixui/hooks/useVideoStream.ts:32-40`
```typescript
interface VideoMetadataMessage {
  type: 'video.metadata';
  timestamp: number;  // ✅ Matches
  data: {
    fps: number;      // ✅ Matches
    frames: number;   // ✅ Matches
    bytes: number;    // ✅ Matches
    mbps: number;     // ✅ Matches
    format?: string;  // ✅ Matches (optional)
  };
}
```

**Status**: ✅ Consistent (no issues)

---

## Issue YUV-003: Error Message Format Inconsistency 🟠 HIGH

### Backend Error Format
**File**: `pyapps/matrix/services/video_stream_service.py` (multiple locations)

**Pattern 1**: Direct error string
```python
await websocket.send_json({
    "error": "Failed to start video server: timeout"
})
```

**Pattern 2**: Nested error object
```python
await websocket.send_json({
    "type": "video.error",
    "data": {
        "error": "Decoder initialization failed"
    }
})
```

### Frontend Error Handling
**File**: `poly_apps/matrixui/hooks/useVideoStream.ts:353-398`
```typescript
if (message.type === 'video.error') {
  const errorMsg = message.data?.error || 'Unknown error';
  console.error(`[useVideoStream] ✗ Error:`, errorMsg);
  setHasError(true);
}
```

### Problem
Frontend only handles **Pattern 2** (nested error). **Pattern 1** (direct error) is ignored!

### Examples of Unhandled Errors
**File**: `pyapps/matrix/services/video_stream_service.py`

- Line 647: `{"error": "Device not found"}`
- Line 658: `{"error": "Device not connected"}`
- Line 678: `{"error": "Failed to start scrcpy-server"}`
- Line 681: `{"error": error_msg}` (various server errors)

### Fix Required
**Option 1**: Standardize backend to always use Pattern 2 (recommended)
```python
# ❌ BEFORE
await websocket.send_json({
    "error": "Device not found"
})

# ✅ AFTER
await websocket.send_json({
    "type": "video.error",
    "data": {
        "error": "Device not found"
    }
})
```

**Option 2**: Handle both patterns in frontend
```typescript
const handleMessage = (message: any) => {
  // Pattern 1: Direct error
  if (message.error && !message.type) {
    const errorMsg = message.error;
    console.error(`[useVideoStream] ✗ Error:`, errorMsg);
    setHasError(true);
    return;
  }

  // Pattern 2: Nested error
  if (message.type === 'video.error') {
    const errorMsg = message.data?.error || 'Unknown error';
    console.error(`[useVideoStream] ✗ Error:`, errorMsg);
    setHasError(true);
    return;
  }
};
```

---

## Issue YUV-004: Hardcoded WebSocket URLs 🟡 MEDIUM

### Frontend Implementation
**File**: `poly_apps/matrixui/hooks/useVideoStream.ts:158-161`
```typescript
wsUrl = `ws://localhost:48000/video/yuv/${encodedDeviceId}`;
if (targetHwaccel) {
  wsUrl += `?hwaccel=${targetHwaccel}`;
}
```

**File**: `poly_apps/matrixui/services/websocket.ts:49`
```typescript
baseUrl: 'http://localhost:48000',
```

### Problems
1. **Not production-ready**: Cannot connect to remote servers
2. **No environment configuration**: Hardcoded in multiple files
3. **Port conflict risk**: Assumes 48000 is always available

### Fix Required
Create centralized configuration:

**File**: `poly_apps/matrixui/config/api.ts` (NEW FILE)
```typescript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:48000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:48000';

export const API_CONFIG = {
  HTTP_BASE_URL: BACKEND_URL,
  WS_RPC_URL: `${WS_URL}/rpc/ws`,
  WS_VIDEO_YUV_URL: (deviceId: string, hwaccel?: string) => {
    let url = `${WS_URL}/video/yuv/${encodeURIComponent(deviceId)}`;
    if (hwaccel) url += `?hwaccel=${hwaccel}`;
    return url;
  },
  WS_VIDEO_H264_URL: (deviceId: string) =>
    `${WS_URL}/video/${encodeURIComponent(deviceId)}`,
} as const;
```

**File**: `.env.local`
```env
VITE_BACKEND_URL=http://localhost:48000
VITE_WS_URL=ws://localhost:48000
```

**Usage**:
```typescript
import { API_CONFIG } from '../config/api';

const wsUrl = API_CONFIG.WS_VIDEO_YUV_URL(deviceId, hwaccel);
const ws = new WebSocket(wsUrl);
```

---

## Issue YUV-005: Metadata Field Name Inconsistencies 🟡 MEDIUM

### Backend Uses
**File**: `pyapps/matrix/services/video_stream_service.py:797`
```python
"mbps": round(current_mbps, 1)  # Lowercase "mbps"
```

### Documentation Shows
**File**: `pyapps/matrix/docs/API_DOCUMENTATION.md:1822`
```json
{
  "Mbps": 25.2  // ❌ Capitalized "Mbps"
}
```

### Frontend Expects
**File**: `poly_apps/matrixui/hooks/useVideoStream.ts:38`
```typescript
mbps: number;  // ✅ Lowercase "mbps" (matches backend)
```

### Status
- ✅ Frontend and backend match (`mbps`)
- ❌ Documentation is wrong (`Mbps`)

### Fix Required
**File**: `pyapps/matrix/docs/API_DOCUMENTATION.md:1822`
```json
// ❌ BEFORE
{
  "Mbps": 25.2
}

// ✅ AFTER
{
  "mbps": 25.2
}
```

---

## Issue YUV-006: Protocol Documentation Discrepancies 🟢 LOW

### Binary Protocol Size Notation

#### Code Implementation
**File**: `pyapps/matrix/services/video_stream_service.py:764`
```python
struct.pack(
    ">QHHIII",  # Q=8 bytes, H=2 bytes, I=4 bytes
    pts,        # 8 bytes
    width,      # 2 bytes
    height,     # 2 bytes
    y_size,     # 4 bytes
    u_size,     # 4 bytes
    v_size      # 4 bytes
)
```

#### Documentation Shows
**File**: `pyapps/matrix/docs/API_DOCUMENTATION.md:1762-1771`
```
pts (8 bytes, u64 BE)    ✅ Correct
width (4 bytes, u32 BE)  ❌ Actually 2 bytes (u16)
height (4 bytes, u32 BE) ❌ Actually 2 bytes (u16)
y_size (4 bytes, u32 BE) ✅ Correct
u_size (4 bytes, u32 BE) ✅ Correct
v_size (4 bytes, u32 BE) ✅ Correct
```

### Frontend Implementation
**File**: `poly_apps/matrixui/hooks/useVideoStream.ts:217-219`
```typescript
const width = view.getUint16(offset); offset += 2;   // ✅ Matches code (2 bytes)
const height = view.getUint16(offset); offset += 2;  // ✅ Matches code (2 bytes)
```

### Status
- ✅ Frontend and backend match (width/height are 2 bytes)
- ❌ Documentation is wrong (says 4 bytes)

### Fix Required
**File**: `pyapps/matrix/docs/API_DOCUMENTATION.md:1763-1764`
```
// ❌ BEFORE
width (4 bytes, u32 BE)
height (4 bytes, u32 BE)

// ✅ AFTER
width (2 bytes, u16 BE)
height (2 bytes, u16 BE)
```

---

## Summary Table

| Issue | Component | Frontend File | Backend File | Fix Priority |
|-------|-----------|---------------|--------------|--------------|
| YUV-001 | Binary parsing | useVideoStream.ts:221-223 | video_stream_service.py:764 | 🔴 P0 |
| YUV-002 | JSON init | useVideoStream.ts:17-30 | video_stream_service.py:702-718 | 🟠 P1 |
| YUV-003 | Error format | useVideoStream.ts:353-398 | video_stream_service.py (multiple) | 🟠 P1 |
| YUV-004 | Hardcoded URLs | useVideoStream.ts:158 | - | 🟡 P2 |
| YUV-005 | Field names | - | API_DOCUMENTATION.md:1822 | 🟡 P3 |
| YUV-006 | Documentation | - | API_DOCUMENTATION.md:1763-1764 | 🟢 P3 |

---

## Recommended Action Plan

### Phase 1: Critical Fixes (Today)
1. ✅ Fix YUV-001: Change `getInt32` to `getUint32` in frontend
2. ✅ Test with 1080p+ resolutions to verify fix

### Phase 2: High Priority (This Week)
3. ✅ Fix YUV-002: Add `timestamp` field to backend `video.init` message
4. ✅ Fix YUV-003: Standardize all error messages to nested format
5. ✅ Fix YUV-004: Create centralized API configuration

### Phase 3: Documentation (Next Week)
6. ✅ Fix YUV-005: Correct `mbps` field name in documentation
7. ✅ Fix YUV-006: Update protocol spec with correct width/height sizes
8. ✅ Add comprehensive protocol test suite

---

## Testing Checklist

- [ ] Test YUV stream with 720p resolution
- [ ] Test YUV stream with 1080p resolution (verify YUV-001 fix)
- [ ] Test YUV stream with 4K resolution (if supported)
- [ ] Test error handling with various backend errors
- [ ] Test hwaccel parameter passing
- [ ] Test pause/resume commands
- [ ] Test connection recovery after network interruption
- [ ] Test multi-device streaming (2+ devices simultaneously)

---

**Report Generated**: 2025-12-12
**Next Review**: After Phase 1 fixes are deployed
