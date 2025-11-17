# RPC Architecture Restoration Plan
**Date**: 2025-11-18
**Status**: 🔧 **IN PROGRESS**

---

## Problems Identified

### 1. WebSocket Connection Failing
```
WebSocket connection to 'ws://127.0.0.1:59000/rpc/ws' failed: (code=1006)
```

**Possible Causes**:
- WebSocket route not registered correctly
- Route ordering issue (static routes may be blocking WebSocket)
- aiohttp WebSocket handler not properly configured

### 2. Static File Serving Not Working Correctly

**ThreadedRpcServer Behavior** (from `threaded_server_DEPRECATED.py:434-435`):
```python
url_path = self.path.split('?')[0]  # Remove query string
if url_path == '/':
    url_path = '/index.html'  # Explicit rewrite
```

**Current UnifiedRpcServer Behavior**:
- Uses aiohttp's `add_static()` with `show_index=True`
- Expects aiohttp to automatically serve `index.html` for `/`
- **Problem**: May not be working as expected due to route ordering or configuration

---

## Architecture Comparison

### ThreadedRpcServer (Working)

**Route Priority**:
1. Health check: `/health`
2. Query result: `/rpc/query/{id}`
3. RPC endpoints: `/rpc/{route}` (POST)
4. Static files: `/{path}` with explicit `/` → `/index.html` rewrite

**Static File Logic**:
```python
def _serve_static_file(self) -> bool:
    url_path = self.path.split('?')[0]
    if url_path == '/':
        url_path = '/index.html'  # ← Explicit rewrite

    for url_prefix, dir_path in server_instance.static_dirs.items():
        if url_path.startswith(url_prefix):
            # Serve file
            ...
```

### UnifiedRpcServer (Current - Broken)

**Route Registration Order** (in `start()`):
1. Static routes: `app.router.add_static('/', ..., show_index=True)`
2. Discovery: `/rpc/status`, `/rpc/info`
3. OPTIONS: `/{tail:.*}`
4. Health: `/health`
5. Query: `/rpc/query/{request_id}`
6. **WebSocket**: `/rpc/ws` ← May be registered too late
7. Heartbeat: `/rpc/heartbeat`
8. Dynamic RPC: `/rpc/{route}`

**Problem**: Static route `/` may be catching all requests before WebSocket `/rpc/ws` can match.

---

## Root Cause Analysis

### Issue 1: Static Route Catching Everything

When `add_static('/', ...)` is registered first, it creates a wildcard route that matches **all paths**, including `/rpc/ws`.

**Evidence**:
- WebSocket connection fails with code 1006 (abnormal closure)
- Static files work (curl returns 200)
- RPC endpoints may not work correctly

**Solution**: Register static route **LAST**, or use a more specific prefix like `/static/`.

### Issue 2: `show_index=True` Not Working

aiohttp's `show_index=True` should automatically serve `index.html` for directory requests, but:
- It may not trigger for exact path `/`
- Route ordering may prevent it from matching

**Solution**: Add explicit root path handler or use ThreadedRpcServer's rewrite logic.

---

## Proposed Solutions

### Option 1: Fix Route Ordering (Recommended)

**Principle**: Specific routes before wildcard routes

**New Order**:
1. Discovery: `/rpc/status`, `/rpc/info`
2. Health: `/health`
3. **WebSocket**: `/rpc/ws` ← Must be before dynamic `/rpc/{route}`
4. Query: `/rpc/query/{request_id}`
5. Heartbeat: `/rpc/heartbeat`
6. Dynamic RPC: `/rpc/{route}` ← Catch remaining `/rpc/*` paths
7. **Root redirect**: `/` → `/index.html` (explicit handler)
8. **Static files**: `/static/*` or keep `/` but add index handler

**Benefits**:
- Clear route precedence
- WebSocket no longer blocked by static routes
- Explicit index.html handling

### Option 2: Use Non-Root Static Prefix

Change static directory prefix from `/` to `/static/`:

```python
# Instead of:
add_static_dir('/', web_dir)

# Use:
add_static_dir('/static', web_dir)

# Add explicit root handler:
app.router.add_get('/', serve_index_html)
```

**Benefits**:
- No route conflicts
- Clear separation of concerns

**Drawbacks**:
- Frontend paths need updating (e.g., `/index.html` → `/static/index.html`)

### Option 3: Custom Static Handler (Like ThreadedRpcServer)

Implement custom static file serving logic instead of using `add_static()`:

```python
async def serve_static(request):
    url_path = request.path.split('?')[0]
    if url_path == '/':
        url_path = '/index.html'

    # Find and serve file
    for url_prefix, dir_path in self.static_dirs.items():
        if url_path.startswith(url_prefix):
            # Serve file
            return web.FileResponse(file_path)

    return web.Response(status=404)

# Register as catch-all AFTER specific routes
app.router.add_get('/{tail:.*}', serve_static)
```

**Benefits**:
- Full control over static serving logic
- Matches ThreadedRpcServer behavior exactly

**Drawbacks**:
- More code to maintain
- Loses aiohttp's built-in static serving optimizations

---

## Recommended Implementation

**Use Option 1** (Fix Route Ordering) with explicit index handler:

```python
async def start(self):
    self.app = web.Application(middlewares=[cors_middleware])

    # 1. Protocol/Discovery (highest priority)
    self.app.router.add_get('/rpc/status', rpc_status)
    self.app.router.add_get('/rpc/info', rpc_info)

    # 2. OPTIONS (CORS preflight)
    self.app.router.add_route('OPTIONS', '/{tail:.*}', options_handler)

    # 3. Health check
    self.app.router.add_get('/health', health_check)

    # 4. WebSocket (BEFORE dynamic /rpc/{route})
    self.app.router.add_get('/rpc/ws', self.websocket_handler.handle_websocket)

    # 5. Query result
    self.app.router.add_get('/rpc/query/{request_id}', query_handler)

    # 6. Heartbeat
    self.app.router.add_get('/rpc/heartbeat', heartbeat_handler)
    self.app.router.add_post('/rpc/heartbeat', heartbeat_handler)

    # 7. Dynamic RPC routes
    self.app.router.add_post('/rpc/{route}', rpc_handler)
    self.app.router.add_get('/rpc/{route}', rpc_handler)

    # 8. Root path - explicit index.html handler
    self.app.router.add_get('/', serve_index_html)

    # 9. Static files (lowest priority, catch-all)
    if '/' in self.static_dirs:
        # Serve from root, excluding already-registered paths
        self.app.router.add_static('/', self.static_dirs['/'], show_index=True)

    # Start server
    ...
```

---

## Action Items

1. ✅ Document ThreadedRpcServer's static file logic
2. ✅ Identify route ordering issue
3. 🔧 Implement Option 1 (fix route ordering)
4. 🔧 Add explicit `/` → `/index.html` handler
5. 🔧 Ensure WebSocket route is before dynamic routes
6. 🔧 Test WebSocket connection
7. 🔧 Test static file serving
8. 🔧 Test RPC endpoints

---

**Next Steps**: Implement the recommended solution in `unified_server.py`
