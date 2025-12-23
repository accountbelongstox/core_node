# TTS Queue Poller - PyHeartbeat Integration

## Implementation Summary

This document describes the idempotent implementation of TTS queue polling using PyHeartbeat interceptor pattern.

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│  WEB UI (pycore-management)                                │
│  Settings Component                                         │
│  [Start TTS Polling] [Pause TTS Polling]                  │
└────────────────────────────────────────────────────────────┘
                         ↓ HTTP API
┌────────────────────────────────────────────────────────────┐
│  RPC v2 API (port 59000)                                   │
│  POST /api/heartbeat/enable/tts_queue_poller              │
│  POST /api/heartbeat/disable/tts_queue_poller             │
│  GET  /api/heartbeat/stats                                 │
│  GET  /api/heartbeat/status/tts_queue_poller              │
└────────────────────────────────────────────────────────────┘
                         ↓ Direct Call
┌────────────────────────────────────────────────────────────┐
│  PyHeartbeat System (always running)                       │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  HeartbeatPusher (1 second tick)                     │ │
│  │  ├─ Callback: 'tts_queue_poller'                     │ │
│  │  │  - enabled: True/False  ◄─ Interceptor Control   │ │
│  │  │  - interval: 60 seconds                           │ │
│  │  └─ Tick Counter: skip 59, run on 60th               │ │
│  └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
                         ↓ (when enabled=True)
┌────────────────────────────────────────────────────────────┐
│  Laravel Main (PHP)                                         │
│  GET /api/app_qy_v1/ai_tools/tts/queue/summary            │
└────────────────────────────────────────────────────────────┘
```

---

## Files Created

### 1. Service Layer

**File**: `pycore/callmodule/services/tts_queue_poller_service.py`

- **Class**: `TTSQueuePollerService` (Singleton)
- **Function**: `get_tts_queue_poller_service()` (Accessor)
- **Features**:
  - Idempotent initialization
  - Singleton pattern
  - Polls Laravel TTS queue API
  - Callback function: `poll_and_process()`

**Updated**: `pycore/callmodule/services/__init__.py`
- Exported `TTSQueuePollerService` and `get_tts_queue_poller_service`

---

### 2. Router Layer

**File**: `pycore/callmodule/routers/management/heartbeat_router.py`

- **Prefix**: `/api/heartbeat`
- **Endpoints**:
  - `POST /api/heartbeat/enable/{callback_name}` - Enable callback
  - `POST /api/heartbeat/disable/{callback_name}` - Disable callback
  - `GET /api/heartbeat/stats` - Get heartbeat statistics
  - `GET /api/heartbeat/status/{callback_name}` - Get callback status
- **Features**:
  - All endpoints are idempotent
  - Uses PyHeartbeat's `enable_callback()` and `disable_callback()`
  - Returns detailed callback status

**Updated**: `pycore/callmodule/routers/management/__init__.py`
- Exported `heartbeat_router`

---

### 3. Main Entry

**File**: `pycore/callmodule/callmodule_main.py`

**Extended Functions**:

1. **`callmodule_main_entry()`**
   - Added PyHeartbeat initialization
   - Added TTS poller registration
   - All operations are idempotent

2. **`_ensure_heartbeat_running()`** (New)
   - Checks if PyHeartbeat is running
   - Starts if not running
   - Idempotent: Does not restart if already running

3. **`_register_tts_queue_poller()`** (New)
   - Gets TTS poller service singleton
   - Registers callback with PyHeartbeat
   - Callback name: `tts_queue_poller`
   - Interval: 60 seconds
   - Initial state: disabled
   - Idempotent: Overwrites if already registered

**Updated Imports**:
- Added `heartbeat_router` to management imports

**Updated Router List**:
- Added `heartbeat_router` to `rpc_routers` list
- Updated router count: 19 → 20

---

## Idempotent Design

All operations are designed to be idempotent:

### Service Initialization
```python
# Can be called multiple times safely
service = get_tts_queue_poller_service()
# Second call returns same instance
service2 = get_tts_queue_poller_service()
assert service is service2  # True
```

### Callback Registration
```python
# Can be called multiple times safely
heartbeat.register_callback(
    name='tts_queue_poller',
    callback=poller.poll_and_process,
    interval=60,
    enabled=False
)
# Second call overwrites with same configuration
```

### Heartbeat Start
```python
# Can be called multiple times safely
if not heartbeat.is_running():
    heartbeat.start()  # Only starts if not running
```

### Enable/Disable
```python
# Can be called multiple times safely
heartbeat.enable_callback('tts_queue_poller')
# Second call has same effect as first
```

---

## API Usage

### 1. Enable TTS Queue Polling

```bash
# Start polling (interceptor allows execution)
curl -X POST http://localhost:59000/api/heartbeat/enable/tts_queue_poller
```

**Response**:
```json
{
  "success": true,
  "message": "Callback 'tts_queue_poller' enabled successfully",
  "callback_name": "tts_queue_poller",
  "enabled": true
}
```

---

### 2. Disable TTS Queue Polling

```bash
# Pause polling (interceptor blocks execution)
curl -X POST http://localhost:59000/api/heartbeat/disable/tts_queue_poller
```

**Response**:
```json
{
  "success": true,
  "message": "Callback 'tts_queue_poller' disabled successfully",
  "callback_name": "tts_queue_poller",
  "enabled": false
}
```

---

### 3. Get Heartbeat Statistics

```bash
# Get overall heartbeat stats
curl http://localhost:59000/api/heartbeat/stats
```

**Response**:
```json
{
  "success": true,
  "stats": {
    "total_ticks": 3600,
    "uptime": 3600.0,
    "callbacks": {
      "tts_queue_poller": {
        "enabled": true,
        "interval": 60,
        "run_count": 60,
        "last_run_tick": 3600,
        "ticks_until_next": 0
      }
    }
  }
}
```

---

### 4. Get Callback Status

```bash
# Get specific callback status
curl http://localhost:59000/api/heartbeat/status/tts_queue_poller
```

**Response**:
```json
{
  "success": true,
  "callback_name": "tts_queue_poller",
  "enabled": true,
  "interval": 60,
  "run_count": 60,
  "last_run_tick": 3600,
  "ticks_until_next": 0
}
```

---

## Testing

### 1. Verify Service Registration

Start callmodule and check logs:

```bash
python pycore_module_caller.py
```

Expected output:
```
[Callmodule] Main entry initialized
[Callmodule] PyHeartbeat already running
[TTSQueuePoller] Service initialized (API: http://localhost:8000)
[Callmodule] Registered TTS queue poller callback
  - Callback name: tts_queue_poller
  - Interval: 60 seconds
  - Initial state: disabled
  - Control: POST /api/heartbeat/enable/tts_queue_poller
```

---

### 2. Test Enable/Disable

```bash
# Enable polling
curl -X POST http://localhost:59000/api/heartbeat/enable/tts_queue_poller

# Wait 60 seconds, check logs for polling activity
# Should see: [TTSQueuePoller] Found X pending tasks

# Disable polling
curl -X POST http://localhost:59000/api/heartbeat/disable/tts_queue_poller

# Wait 60 seconds, no polling activity should occur
```

---

### 3. Test Idempotency

```bash
# Enable multiple times - should be safe
curl -X POST http://localhost:59000/api/heartbeat/enable/tts_queue_poller
curl -X POST http://localhost:59000/api/heartbeat/enable/tts_queue_poller
curl -X POST http://localhost:59000/api/heartbeat/enable/tts_queue_poller

# Disable multiple times - should be safe
curl -X POST http://localhost:59000/api/heartbeat/disable/tts_queue_poller
curl -X POST http://localhost:59000/api/heartbeat/disable/tts_queue_poller
curl -X POST http://localhost:59000/api/heartbeat/disable/tts_queue_poller
```

---

## Design Principles

### 1. No Patch Methods
- All code extends existing architecture
- Uses established patterns (routers, services, controllers)
- Follows existing directory structure

### 2. Idempotent Operations
- All functions can be called multiple times safely
- No side effects from repeated calls
- Singleton pattern for services

### 3. Interceptor Pattern
- PyHeartbeat always runs
- Callbacks controlled via `enabled` flag
- No start/stop of heartbeat system
- Web UI controls interceptor state

### 4. Code Organization
- Service layer: Business logic
- Router layer: API endpoints
- Main entry: Initialization
- All following existing patterns

---

## Extension Points

### 1. Add More Callbacks

```python
# In callmodule_main_entry()
def _register_another_callback():
    from pycore.pyheartbeat import get_heartbeat_system

    heartbeat = get_heartbeat_system()
    heartbeat.register_callback(
        name='another_task',
        callback=lambda: print("Another task"),
        interval=30,
        enabled=False
    )
```

### 2. Add More Endpoints

Create new router in `pycore/callmodule/routers/management/`:

```python
# example_router.py
router = APIRouter(prefix="/api/example", tags=["Example"])

@router.get("/test")
async def test_endpoint():
    return {"message": "Hello"}
```

---

## Summary

**Files Created**: 2
- `services/tts_queue_poller_service.py`
- `routers/management/heartbeat_router.py`

**Files Modified**: 3
- `services/__init__.py`
- `routers/management/__init__.py`
- `callmodule_main.py`

**Total Lines Added**: ~300
**Router Count**: 19 → 20
**Idempotent**: ✅ All operations
**No Patches**: ✅ Pure extension
**Architecture**: ✅ Follows existing patterns

---

## Next Steps

1. **Implement TTS Processing Logic**
   - Integrate Edge TTS in `_process_task()`
   - Add audio file generation
   - Update Laravel task status

2. **Add WEB UI Controls**
   - Create settings component
   - Add start/pause buttons
   - Call enable/disable APIs

3. **Add Monitoring**
   - Dashboard for callback status
   - Real-time statistics
   - Error logging

4. **Extend to Other Services**
   - Use same pattern for other periodic tasks
   - Register multiple callbacks
   - Centralized control via heartbeat API
