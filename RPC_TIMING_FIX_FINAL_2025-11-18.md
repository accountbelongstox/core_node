# RPC Timing Fix - Static Directory Configuration
**Date**: 2025-11-18
**Status**: ✅ **RESOLVED**

---

## Problem

访问 `http://127.0.0.1:59000/` 仍然返回 **405: Method Not Allowed** 错误，即使已经：
1. ✅ 添加了 `show_index=True` 参数到 `add_static()`
2. ✅ 移除了 ThreadedRpcServer
3. ✅ 使用 UnifiedRpcServer（WebSocket + CORS）

---

## Root Cause: Timing Issue

**核心问题**：在 aiohttp 中，静态路由必须在服务器启动（`start()`）**之前**添加。

### 问题代码流程（launch_speech_rpc.py）

```python
# Step 2: Launch services via pylauncher
instances = launch_services(config)  # ← RPC 服务器在这里启动

# Step 3: Register static web directory
instances.rpc_server.add_static_dir('/', str(web_dir))  # ← 太晚了！服务器已经启动
```

**日志证据**：
```
[UnifiedRpcServer] Server started on 0.0.0.0:59000  ← 服务器启动
=== All Services Launched ===
[UnifiedRpcServer] Added static directory: /        ← 之后才添加（无效）
```

### Why It Fails

在 aiohttp 中：
1. `app.router.add_static()` 必须在 `app.run()` 或 `web.run_app()` **之前**调用
2. 一旦服务器启动，路由表已经固化，无法动态添加路由
3. 后续的 `add_static_dir()` 调用虽然更新了 `self.static_dirs` 字典，但不会影响已启动的 aiohttp 应用

---

## Solution

### 修改 `launch_speech_rpc.py` 的执行顺序

**核心思路**：在启动服务器**之前**配置静态目录

#### 新流程

```python
# Step 2: Prepare static web directory path (BEFORE launching services)
from pathlib import Path
web_dir = Path(__file__).parent / 'rpc' / 'web'

# Step 3: Create RPC server and configure static directories BEFORE starting
from pycore.pyutils.rpc.server.unified_server import UnifiedRpcServerRunner
rpc_server = UnifiedRpcServerRunner(
    host=config.rpc_host,
    port=config.rpc_port,
    debug=debug
)

# Add static directory BEFORE starting server
if web_dir.exists():
    rpc_server.add_static_dir('/', str(web_dir))
    ColorPrint.blue(f"[SpeechRPC] Configured static web directory: / -> {web_dir}")

# Step 4: Launch other services (Heartbeat, SpeechSwitch) WITHOUT RPC server
config.enable_rpc = False  # We'll manage RPC server manually
instances = launch_services(config)

# Step 5: Start RPC server (static directories already configured)
rpc_server.start()
instances.rpc_server = rpc_server  # Store in instances
```

#### 关键变化

1. **Step 3**: 创建 RPC 服务器实例（但不启动）
2. **Step 3**: 配置静态目录到 `self.static_dirs`
3. **Step 4**: 启动其他服务（Heartbeat, SpeechSwitch），禁用 RPC（`config.enable_rpc = False`）
4. **Step 5**: 启动 RPC 服务器（此时 `self.static_dirs` 已配置好，会在 `start()` 中被添加到路由表）

---

## Verification

### Test 1: Startup Log

```bash
python ./pymain.py app=spee
```

**Output**:
```
[SpeechRPC] Configured static web directory: / -> D:\programing\core_node\pycore\pyctl\speech\rpc\web  ← 先配置
[UnifiedRpcServer] Server started on 0.0.0.0:59000                                                    ← 后启动
[SpeechRPC] RPC Server started on 0.0.0.0:59000
```

✅ **Timing Correct**: 静态目录在服务器启动前配置

### Test 2: HTTP Access

```bash
curl -s -o /dev/null -w "HTTP Status: %{http_code}\n" http://127.0.0.1:59000/
```

**Output**: `HTTP Status: 200`

✅ **Fixed**: 根路径现在返回 200 OK，不再是 405 错误

### Test 3: WebSocket Connection

前端可以成功连接到 `ws://127.0.0.1:59000/rpc/ws`

✅ **Working**: WebSocket 连接正常

---

## Technical Details

### aiohttp Static Route Registration

在 `UnifiedRpcServer.start()` 中：

```python
async def start(self):
    # Create aiohttp app
    self.app = web.Application(middlewares=[cors_middleware])

    # Add static directories (must be added BEFORE starting server)
    for url_prefix, directory in self.static_dirs.items():
        self.app.router.add_static(
            url_prefix,
            directory,
            show_index=True,      # ← Automatically serve index.html
            follow_symlinks=True  # ← Allow symlinks
        )

    # ... other routes ...

    # Start server
    self.runner = web.AppRunner(self.app)
    await self.runner.setup()
    self.site = web.TCPSite(self.runner, self.host, self.port)
    await self.site.start()  # ← Routes fixed at this point
```

**Key Point**: `self.static_dirs` is populated **before** `start()` is called, so routes are added correctly.

---

## Code Changes

### Modified Files

1. `pycore/pyctl/speech/launch_speech_rpc.py:98-130`
   - Refactored initialization order
   - Create RPC server before `launch_services()`
   - Configure static directories before starting server
   - Disable `config.enable_rpc` to avoid duplicate RPC server creation

### No Changes Needed

- `pycore/pyutils/rpc/server/unified_server.py` - Already correct
- `pycore/pylauncher/launcher.py` - No changes needed

---

## Architecture Change

### Before (Incorrect)

```
launch_services(config)
    └─> Start RPC Server ← Routes fixed here
         └─> UnifiedRpcServer.start()

add_static_dir('/', web_dir)  ← Too late! Routes already fixed
```

### After (Correct)

```
Create UnifiedRpcServerRunner()
    └─> self.static_dirs = {}

add_static_dir('/', web_dir)
    └─> self.static_dirs['/'] = web_dir  ← Configured before start

launch_services(config with enable_rpc=False)
    └─> Start other services only

rpc_server.start()
    └─> UnifiedRpcServer.start()
         └─> for prefix, dir in self.static_dirs.items():
              └─> app.router.add_static(prefix, dir)  ← Routes added correctly
```

---

## Lessons Learned

### 1. Async Framework Constraints

**aiohttp Constraint**: Routes must be configured before starting the server.

**Implication**: Static directories, API routes, and WebSocket endpoints must be registered during application setup, not after startup.

### 2. Initialization Order Matters

**Critical Sequence**:
1. Create server instance
2. Configure routes/static dirs
3. Start server

**Wrong Sequence** (our original bug):
1. Start server ← Routes fixed
2. Configure routes/static dirs ← Ignored

### 3. Launcher Integration

When using a launcher pattern (like `launch_services()`), ensure:
- Services can be created without immediately starting
- Configuration can be applied before startup
- Startup happens explicitly and controllably

---

## Related Issues

### Issue 1: 405 Error
- **Status**: ✅ Fixed
- **Cause**: Static route added after server start
- **Solution**: Reorder initialization

### Issue 2: WebSocket Support
- **Status**: ✅ Working
- **Details**: UnifiedRpcServer provides WebSocket by default

### Issue 3: ThreadedRpcServer Removal
- **Status**: ✅ Complete
- **Details**: Deprecated and moved to `threaded_server_DEPRECATED.py`

---

## Testing Checklist

- [x] Static files served at `/` (index.html)
- [x] HTTP Status 200 (not 405)
- [x] WebSocket connection at `/rpc/ws`
- [x] CORS headers present
- [x] All speech routes registered
- [x] Pyheartbeat integration works
- [x] SpeechSwitch integration works
- [x] Service starts in correct order
- [x] No timing-related errors

---

## Future Improvements

### 1. Add Configuration Validation

Add check to ensure static directories are configured before server start:

```python
def start(self):
    if not self._validated_static_dirs:
        ColorPrint.yellow("[Warning] Static directories should be configured before starting server")
    # ... rest of start logic
```

### 2. Support Dynamic Route Addition (Advanced)

For advanced use cases, implement route reloading:

```python
async def add_route_dynamically(self, route):
    # Stop server
    await self.site.stop()
    # Add route
    self.app.router.add_route(...)
    # Restart
    await self.site.start()
```

**Note**: Not recommended for production due to downtime.

### 3. ServiceConfig Enhancement

Add `rpc_static_dirs` to ServiceConfig for centralized configuration:

```python
@dataclass
class ServiceConfig:
    ...
    rpc_static_dirs: Dict[str, str] = field(default_factory=dict)
```

---

## Related Documentation

- `RPC_WEBSOCKET_CORS_MIGRATION_2025-11-18.md` - WebSocket migration
- `RPC_STATIC_FILES_FIX_2025-11-18.md` - Static file configuration
- `THREADED_RPC_REMOVAL_2025-11-18.md` - ThreadedRpc removal

---

**Fixed By**: Claude Code Assistant
**Final Test**: HTTP Status 200 ✅
**WebSocket**: Working ✅
**Date**: 2025-11-18
**Version**: pycore.pyutils.rpc 3.2.0
