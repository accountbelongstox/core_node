# RPC Route Ordering Fix - COMPLETED
**Date**: 2025-11-18
**Status**: ✅ **FIXED**

---

## Problem

WebSocket connection to `ws://127.0.0.1:59000/rpc/ws` was failing with code 1006 (abnormal closure).

### Root Cause

In `pycore/pyutils/rpc/server/unified_server.py`, static routes were registered **FIRST** in the `start()` method:

```python
# OLD (BROKEN) Order:
1. Static directories: add_static('/', ...)  ← PROBLEM: Catches all paths!
2. Discovery endpoints
3. Health check
4. Query result
5. WebSocket: /rpc/ws  ← Blocked by static route!
6. Heartbeat
7. Dynamic RPC routes
```

When `add_static('/', ...)` is registered first, it creates a wildcard route that matches **all paths**, including `/rpc/ws`, preventing the WebSocket route from ever being reached.

---

## Solution

Reorganized route registration to follow **specific-before-wildcard** principle:

```python
# NEW (FIXED) Order:
1. Discovery endpoints (/rpc/status, /rpc/info, OPTIONS)  ← Most specific
2. Health check (/health)
3. Query result (/rpc/query/{request_id})
4. WebSocket (/rpc/ws)  ← Now accessible!
5. Heartbeat (/rpc/heartbeat)
6. Dynamic RPC routes (/rpc/{route})  ← Catch remaining /rpc/* paths
7. Explicit root handler (/)  ← Serves index.html directly
8. Static directories (add_static)  ← LAST (lowest priority)
```

### Key Changes

**File**: `pycore/pyutils/rpc/server/unified_server.py`

1. **Moved static route registration to END** (line 459-464):
   ```python
   # ✅ Add static directories LAST (lowest priority)
   for url_prefix, directory in self.static_dirs.items():
       self.app.router.add_static(url_prefix, directory, show_index=True, follow_symlinks=True)
   ```

2. **Added explicit root path handler** (line 442-454):
   ```python
   # ✅ Explicit '/' -> '/index.html' rewrite (like ThreadedRpcServer)
   async def serve_index(request):
       if '/' in self.static_dirs:
           index_path = Path(self.static_dirs['/']) / 'index.html'
           if index_path.exists():
               return web.FileResponse(index_path)
       return web.Response(text="RPC Server Running - No index.html configured", status=200)

   self.app.router.add_get('/', serve_index)
   ```

3. **Ensured WebSocket route priority** (line 398):
   ```python
   # ✅ WebSocket route registered BEFORE dynamic routes and static files
   self.app.router.add_get(WS_PATH, self.websocket_handler.handle_websocket)
   ```

---

## Verification

The route registration order now follows aiohttp best practices:
- ✅ Specific routes (e.g., `/rpc/ws`) are registered before wildcards
- ✅ WebSocket endpoint is no longer blocked by static routes
- ✅ Explicit root handler serves `index.html` (matching ThreadedRpcServer behavior)
- ✅ Static files are served as fallback (lowest priority)

---

## Testing Checklist

- [x] WebSocket connection to `ws://127.0.0.1:59000/rpc/ws` succeeds ✅
- [x] HTTP GET `http://127.0.0.1:59000/` serves index.html ✅
- [x] Static files (JS, CSS) are served correctly ✅
- [x] RPC endpoints (`/rpc/status`, etc.) work correctly ✅
- [x] Health check `/health` returns status ✅
- [x] Discovery endpoints `/rpc/status`, `/rpc/info` work ✅

### Test Results (2025-11-18)

```
# WebSocket Test
Connecting to ws://127.0.0.1:59000/rpc/ws...
[OK] WebSocket connected successfully!
Received: {"type": "welcome", "client_id": "faebc7fd-de58-477b-9ed7-f722af84869e", ...}
[OK] WebSocket test PASSED!

# HTTP Root Test
$ curl http://127.0.0.1:59000/
<!DOCTYPE html>
<html lang="en-US">
<head>
    <title>Speech & Clipboard Service</title>
...

# Health Check Test
$ curl http://127.0.0.1:59000/health
{
    "status": "ok",
    "service": "UnifiedRpcServer",
    "routes": [...],
    "ws_clients": 0
}

# Discovery Test
$ curl http://127.0.0.1:59000/rpc/status
{
    "is_rpc_service": true,
    "protocol_version": "1.0"
}
```

---

## References

- **Analysis Document**: `RPC_ARCHITECTURE_RESTORATION_PLAN.md`
- **Reference Implementation**: `pycore/pyutils/rpc/server/threaded_server_DEPRECATED.py:434-435`
- **aiohttp Route Ordering**: Specific routes must be registered before wildcard routes
