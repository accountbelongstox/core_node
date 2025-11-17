# RPC WebSocket Fix Summary
**Date**: 2025-11-18
**Status**: ✅ **COMPLETED**

---

## Problem Overview

WebSocket connection to `ws://127.0.0.1:59000/rpc/ws` was failing with **code 1006** (abnormal closure).

### Root Cause

In `pycore/pyutils/rpc/server/unified_server.py`, static routes were registered **FIRST**, creating a wildcard route that caught all requests before specific routes like `/rpc/ws` could be matched.

---

## Solution Summary

### 1. Fixed Route Registration Order

**File**: `pycore/pyutils/rpc/server/unified_server.py`

**Changed from** (BROKEN):
```python
async def start(self):
    # ...
    # Static routes FIRST (catches everything!)
    for url_prefix, directory in self.static_dirs.items():
        self.app.router.add_static(url_prefix, directory, ...)

    # Discovery endpoints
    self.app.router.add_get('/rpc/status', rpc_status)
    # ...
    # WebSocket (blocked by static route!)
    self.app.router.add_get('/rpc/ws', self.websocket_handler.handle_websocket)
```

**Changed to** (FIXED):
```python
async def start(self):
    # ...
    # 1. Discovery endpoints (highest priority)
    self.app.router.add_get('/rpc/status', rpc_status)
    self.app.router.add_get('/rpc/info', rpc_info)

    # 2. Health check
    self.app.router.add_get('/health', health_check)

    # 3. Query result
    self.app.router.add_get('/rpc/query/{request_id}', ...)

    # 4. WebSocket (now accessible!)
    self.app.router.add_get('/rpc/ws', self.websocket_handler.handle_websocket)

    # 5. Heartbeat
    self.app.router.add_get('/rpc/heartbeat', http_heartbeat)

    # 6. Dynamic RPC routes
    self.app.router.add_post('/rpc/{route}', self.http_handler.handle_http_rpc)

    # 7. Explicit root handler (serves index.html)
    self.app.router.add_get('/', serve_index)

    # 8. Static routes LAST (lowest priority)
    for url_prefix, directory in self.static_dirs.items():
        self.app.router.add_static(url_prefix, directory, ...)
```

### 2. Added Explicit Root Path Handler

Matches ThreadedRpcServer's explicit `/` → `/index.html` rewrite logic:

```python
async def serve_index(request):
    """Serve index.html for root path (explicit rewrite like ThreadedRpcServer)"""
    if '/' in self.static_dirs:
        from pathlib import Path
        index_path = Path(self.static_dirs['/']) / 'index.html'
        if index_path.exists():
            return web.FileResponse(index_path)
    return web.Response(text="RPC Server Running - No index.html configured", status=200)

self.app.router.add_get('/', serve_index)
```

### 3. Removed rpc_v2 References

**Files Updated**:
- `pycore/pyutils/rpc/__init__.py` - Reverted to import `UnifiedRpcServer`
- `pycore/pyutils/rpc/server/__init__.py` - Reverted to export `UnifiedRpcServer`
- `pycore/pyctl/speech/launch_speech_rpc.py` - Changed `rpc_v2.FastAPIRPCServerRunner` → `rpc.UnifiedRpcServerRunner`
- `pycore/pylauncher/launcher.py` - Changed `rpc_v2.FastAPIRPCServerRunner` → `rpc.UnifiedRpcServerRunner`

---

## Files Modified

1. **pycore/pyutils/rpc/server/unified_server.py**
   - Line 353: Removed static route registration from beginning
   - Line 442-454: Added explicit root path handler
   - Line 456-464: Moved static route registration to end

2. **pycore/pyutils/rpc/__init__.py**
   - Line 21: Changed import from `rpc_v2` to `unified_server`
   - Updated `__all__` exports

3. **pycore/pyutils/rpc/server/__init__.py**
   - Line 9: Changed import from `rpc_v2` to `unified_server`

4. **pycore/pyctl/speech/launch_speech_rpc.py**
   - Line 103: Changed import from `rpc_v2` to `rpc`

5. **pycore/pylauncher/launcher.py**
   - Line 660: Changed import from `rpc_v2` to `rpc`

---

## Test Results

### WebSocket Connection ✅
```bash
$ python test_websocket.py
Connecting to ws://127.0.0.1:59000/rpc/ws...
[OK] WebSocket connected successfully!
Received: {"type": "welcome", "client_id": "faebc7fd-de58-477b-9ed7-f722af84869e", ...}
[OK] WebSocket test PASSED!
```

### HTTP Root Path ✅
```bash
$ curl http://127.0.0.1:59000/
<!DOCTYPE html>
<html lang="en-US">
<head>
    <title>Speech & Clipboard Service</title>
...
```

### Health Endpoint ✅
```bash
$ curl http://127.0.0.1:59000/health
{
    "status": "ok",
    "service": "UnifiedRpcServer",
    "routes": [
        "tts", "tts.synthesize", "stt", "stt.recognize",
        "config.get", "config.set", "config.get_all", "config.reset",
        "status", "queue_stats", "task_status",
        "clipboard_get", "clipboard_sync"
    ],
    "ws_clients": 0,
    "http_sessions": 2,
    "pending_requests": 0,
    "inventory_items": 0
}
```

### Discovery Endpoints ✅
```bash
$ curl http://127.0.0.1:59000/rpc/status
{
    "is_rpc_service": true,
    "protocol_version": "1.0"
}
```

---

## Key Principles Applied

1. **Route Ordering**: Specific routes before wildcard routes
2. **Explicit Handlers**: Add explicit handlers for critical paths like `/`
3. **Static Files Last**: Register static directories with lowest priority
4. **Reference Implementation**: Match ThreadedRpcServer's proven behavior

---

## Documentation Created

1. `RPC_ARCHITECTURE_RESTORATION_PLAN.md` - Root cause analysis
2. `RPC_ROUTE_ORDERING_FIX.md` - Detailed fix documentation
3. `RPC_WEBSOCKET_FIX_SUMMARY.md` - This summary (you are here)
4. `test_websocket.py` - WebSocket connection test script

---

## Status

✅ **All issues resolved**:
- WebSocket connection works (no more code 1006)
- HTTP root path serves index.html
- All RPC endpoints functional
- Static files served correctly
- No more rpc_v2 dependencies

The RPC server now uses `UnifiedRpcServer` with proper route ordering and full WebSocket support.
