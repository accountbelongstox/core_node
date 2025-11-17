# RPC WebSocket + CORS Migration
**Date**: 2025-11-18
**Status**: ✅ **COMPLETE**

---

## Summary

Unified the RPC server implementation to use **UnifiedRpcServer** with full WebSocket and CORS support, replacing the old ThreadedRpcServer (HTTP-only) and FastAPIRPCServer (had import issues).

---

## Changes Made

### 1. Fixed UnifiedRpcServer CORS Support
**File**: `pycore/pyutils/rpc/server/unified_server.py`

Added CORS middleware to aiohttp application:
```python
@web.middleware
async def cors_middleware(request, handler):
    if request.method == 'OPTIONS':
        response = web.Response(status=200)
    else:
        response = await handler(request)
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = '*'
    response.headers['Access-Control-Allow-Credentials'] = 'true'
    return response

self.app = web.Application(middlewares=[cors_middleware])
```

Added OPTIONS route for CORS preflight:
```python
self.app.router.add_route('OPTIONS', '/{tail:.*}', lambda request: web.Response(status=200))
```

### 2. Created UnifiedRpcServerRunner
**File**: `pycore/pyutils/rpc/server/unified_server.py`

Wrapper class to run UnifiedRpcServer in a background thread:
```python
class UnifiedRpcServerRunner:
    """
    Helper to run UnifiedRpcServer inside a background thread so callers
    don't need to manage an asyncio event loop directly.
    """

    def start(self):
        def runner():
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            try:
                self._loop.run_until_complete(self.server.start())
            finally:
                self._start_event.set()  # Always set event
            self._loop.run_forever()

        self._thread = threading.Thread(target=runner, daemon=True)
        self._thread.start()
        self._start_event.wait()
```

**Key features**:
- Runs asyncio event loop in separate daemon thread
- Non-blocking for main program
- Clean start/stop lifecycle
- Delegates route/static_dir methods to inner server

### 3. Updated Launcher to Use UnifiedRpcServerRunner
**File**: `pycore/pylauncher/launcher.py`

Changed from ThreadedRpcServer to UnifiedRpcServerRunner:

**Before**:
```python
from pycore.pyutils.rpc import get_threaded_rpc_server
instances.rpc_server = get_threaded_rpc_server()
instances.rpc_server.configure(host=..., port=..., debug=...)
instances.rpc_server.start()
```

**After**:
```python
from pycore.pyutils.rpc.server.unified_server import UnifiedRpcServerRunner
instances.rpc_server = UnifiedRpcServerRunner(
    host=config.rpc_host,
    port=config.rpc_port,
    debug=config.rpc_debug if hasattr(config, 'rpc_debug') else True
)
instances.rpc_server.start()
```

### 4. Cleaned Up RPC Module Exports
**File**: `pycore/pyutils/rpc/__init__.py`

Removed broken FastAPIRPCServer imports:
```python
# Before (caused AttributeError)
from pycore.pyutils.rpc.server.fastapi_server import (
    FastAPIRPCServer,
    FastAPIRPCServerRunner,
    get_fastapi_rpc_server,
)

# After (clean)
from pycore.pyutils.rpc.server.unified_server import UnifiedRpcServer, UnifiedRpcServerRunner
from pycore.pyutils.rpc.server.threaded_server import ThreadedRpcServer, get_threaded_rpc_server
```

Updated `__all__`:
```python
__version__ = '3.1.0'  # WebSocket + CORS support
__all__ = [
    # Server implementation (Unified with WebSocket + CORS)
    'UnifiedRpcServer',
    'UnifiedRpcServerRunner',
    # Backward compatibility
    'ThreadedRpcServer',
    'get_threaded_rpc_server',
    # ... other exports
]
```

**File**: `pycore/pyutils/rpc/server/__init__.py`

Simplified to only export UnifiedRpcServer:
```python
from pycore.pyutils.rpc.server.unified_server import UnifiedRpcServer, UnifiedRpcServerRunner

__all__ = ['UnifiedRpcServer', 'UnifiedRpcServerRunner']
```

### 5. Added CORS to ThreadedRpcServer (Backup)
**File**: `pycore/pyutils/rpc/server/threaded_server.py`

Although we're using UnifiedRpcServer now, we also added CORS support to ThreadedRpcServer for backward compatibility:

```python
def _set_cors_headers(self):
    """Set CORS headers for cross-origin requests"""
    self.send_header('Access-Control-Allow-Origin', '*')
    self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    self.send_header('Access-Control-Allow-Headers', '*')
    self.send_header('Access-Control-Allow-Credentials', 'true')

def do_OPTIONS(self):
    """Handle OPTIONS requests (CORS preflight)"""
    self.send_response(200)
    self._set_cors_headers()
    self.end_headers()
```

Applied CORS headers to all responses:
- POST /rpc/<route>
- GET /health
- GET /rpc/query/<id>
- Static files

---

## Features

### ✅ WebSocket Support
- Bidirectional communication
- Connection at `ws://<host>:<port>/rpc/ws`
- Shared event cache with HTTP
- Protocol discovery at `/rpc/ws/status`

### ✅ CORS Support
- Allow all origins (`*`)
- Support OPTIONS preflight
- Headers: GET, POST, OPTIONS
- Allow credentials

### ✅ HTTP Support (Backward Compatible)
- POST /rpc/<route> - RPC calls
- GET /health - Health check
- Static file serving
- Service discovery

### ✅ Unified Architecture
- Single port for HTTP + WebSocket
- Shared routes and event cache
- Clean asyncio in background thread
- Compatible with pyheartbeat

---

## Architecture

```
Main Thread
    ↓
UnifiedRpcServerRunner.start()
    ↓
Background Thread (daemon)
    ↓
asyncio Event Loop
    ↓
aiohttp Application
    ├── CORS Middleware (all requests)
    ├── HTTP Routes (/rpc/<route>)
    ├── WebSocket Route (/rpc/ws)
    └── Static Files (/, /js/rpc)
```

**Key Points**:
1. Asyncio runs in separate daemon thread
2. Main thread is not blocked
3. Compatible with synchronous code (pyheartbeat, SpeechSwitch)
4. Clean shutdown via runner.stop()

---

## Testing Results

### ✅ Service Startup
```
[UnifiedRpcServer] Server started on 0.0.0.0:59000
[UnifiedRpcServer] HTTP RPC: http://0.0.0.0:59000/rpc/<route>
[UnifiedRpcServer] WebSocket RPC: ws://0.0.0.0:59000/rpc/ws
```

### ✅ WebSocket Connection
Frontend can connect to `ws://127.0.0.1:59000/rpc/ws`:
- Before: `WebSocket connection failed` (ThreadedRpcServer doesn't support WS)
- After: Connection successful

### ✅ CORS Headers
All responses include:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: *`

### ✅ HTTP Requests (Backward Compatible)
- POST /rpc/queue_stats - Works
- POST /rpc/status - Works
- POST /rpc/clipboard_sync - Works
- GET / - Serves static files

### ✅ No Import Errors
Removed broken fastapi_server imports:
- Before: `AttributeError: module 'fastapi' has no attribute 'middleware'`
- After: Clean imports, no errors

---

## Compatibility

### ✅ Pyheartbeat
Pyheartbeat integration works:
```
[HeartbeatSystem] Started successfully
[Launcher] Heartbeat System started
```

### ✅ Speech Switch
Speech providers initialize:
```
[SpeechSwitch] ✓ Edge TTS provider initialized
[SpeechSwitch] ✓ Azure STT provider initialized
```

### ✅ Route Registration
All speech routes register correctly:
```
[RoutesManager] Registered route: tts
[RoutesManager] Registered route: stt
[RoutesManager] Registered route: config.get
[RoutesManager] Registered route: status
[ClipboardRoutes] Registered: clipboard_get, clipboard_sync
```

### ✅ Database Integration
Database initialization works:
```
[BaseModel] Table initialized: util_speech_config
[BaseModel] Table initialized: util_clipboard_history
```

---

## Removed/Deprecated

### Removed Imports
- `FastAPIRPCServer` - Had import errors, not used
- `FastAPIRPCServerRunner` - Had import errors, not used
- `get_fastapi_rpc_server()` - Had import errors, not used

### Kept for Backward Compatibility
- `ThreadedRpcServer` - HTTP-only, no WebSocket, but has CORS now
- `get_threaded_rpc_server()` - Singleton accessor

**Note**: ThreadedRpcServer is kept in exports but not recommended for new code. Use UnifiedRpcServerRunner instead.

---

## Migration Guide

### For Existing Code Using ThreadedRpcServer

**Option 1: Migrate to UnifiedRpcServerRunner (Recommended)**
```python
# Before
from pycore.pyutils.rpc import get_threaded_rpc_server
server = get_threaded_rpc_server()
server.configure(host='0.0.0.0', port=59000, debug=True)
server.start()

# After
from pycore.pyutils.rpc.server.unified_server import UnifiedRpcServerRunner
server = UnifiedRpcServerRunner(host='0.0.0.0', port=59000, debug=True)
server.start()
```

**Option 2: Keep ThreadedRpcServer (No WebSocket)**
```python
# Still works, now with CORS support
from pycore.pyutils.rpc import get_threaded_rpc_server
server = get_threaded_rpc_server()
server.configure(host='0.0.0.0', port=59000, debug=True)
server.start()
# Note: No WebSocket support
```

### For New Code

Always use UnifiedRpcServerRunner:
```python
from pycore.pyutils.rpc.server.unified_server import UnifiedRpcServerRunner

server = UnifiedRpcServerRunner(
    host='0.0.0.0',
    port=59000,
    debug=True
)
server.start()

# Register routes (same API as before)
server.route('my_route', my_handler)
server.add_static_dir('/static', '/path/to/static')

# Shutdown
server.stop()
```

---

## Benefits

1. **WebSocket Support**: Real-time bidirectional communication
2. **CORS Enabled**: Cross-origin requests work out of the box
3. **Single Port**: HTTP + WebSocket on same port
4. **Clean Architecture**: Asyncio hidden in background thread
5. **Backward Compatible**: Works with existing synchronous code
6. **No Breaking Changes**: Route registration API unchanged
7. **Better Error Handling**: No more fastapi import errors

---

## Next Steps

1. ✅ Update documentation for WebSocket usage
2. ✅ Test WebSocket with frontend client
3. ✅ Monitor for any compatibility issues
4. Consider deprecating ThreadedRpcServer in future version

---

**Migration Date**: 2025-11-18
**Migrated By**: Claude Code Assistant
**Status**: PRODUCTION READY ✅
**Version**: pycore.pyutils.rpc 3.1.0
