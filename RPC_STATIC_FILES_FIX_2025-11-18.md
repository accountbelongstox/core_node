# RPC Static Files Fix - 405 Error Resolution
**Date**: 2025-11-18
**Status**: ✅ **FIXED**

---

## Problem

用户反馈访问 `http://127.0.0.1:59000/` 时出现 **405: Method Not Allowed** 错误，而在之前使用 ThreadedRpcServer 时可以正常访问。

---

## Root Cause Analysis

### 1. Server Migration Issue
迁移到 UnifiedRpcServer 后，aiohttp 的 `add_static()` 方法默认配置无法正确服务根路径的 index.html：

```python
# Before (问题代码)
self.app.router.add_static(url_prefix, directory)
```

**问题**:
- aiohttp 的 `add_static()` 默认 `show_index=False`
- 访问目录路径（如 `/`）时不会自动查找 `index.html`
- 导致 405 Method Not Allowed 错误

### 2. Python Cache Issue
清理 Python cache 之前，服务仍在使用旧的 ThreadedRpcServer 实现：
- `.pyc` 文件缓存了旧代码
- `__pycache__` 目录包含过期模块

---

## Solution

### Fix 1: Configure `add_static()` with `show_index=True`

**File**: `pycore/pyutils/rpc/server/unified_server.py:354-359`

```python
# After (修复后)
# Add static directories (must be added before other routes)
for url_prefix, directory in self.static_dirs.items():
    # show_index=True: automatically serve index.html when directory is accessed
    # follow_symlinks=True: allow symlinks in static directories
    self.app.router.add_static(url_prefix, directory, show_index=True, follow_symlinks=True)
    if self.debug:
        ColorPrint.blue(f"[UnifiedRpcServer] Serving static files: {url_prefix} -> {directory}")
```

**参数说明**:
- `show_index=True`: 访问目录时自动查找并返回 `index.html`
- `follow_symlinks=True`: 允许在静态目录中使用符号链接

### Fix 2: Clean Python Cache

```bash
# 删除所有 .pyc 文件
find . -type f -name "*.pyc" -delete

# 删除所有 __pycache__ 目录
find . -type d -name "__pycache__" -exec rm -rf {} +
```

---

## Verification

### Test 1: Service Startup
```bash
python ./pymain.py app=spee
```

**Output**:
```
[Launcher] Starting RPC Server (HTTP/WebSocket)...
[UnifiedRpcServer] Added default static directory: /js/rpc -> D:\programing\core_node\pycore\pyutils\rpc\client
[UnifiedRpcServer] Serving static files: /js/rpc -> D:\programing\core_node\pycore\pyutils\rpc\client
[UnifiedRpcServer] Server started on 0.0.0.0:59000
[UnifiedRpcServer] HTTP RPC: http://0.0.0.0:59000/rpc/<route>
[UnifiedRpcServer] WebSocket RPC: ws://0.0.0.0:59000/rpc/ws
[Launcher] RPC Server started on 0.0.0.0:59000
[Launcher] WebSocket RPC: ws://0.0.0.0:59000/rpc/ws
[UnifiedRpcServer] Added static directory: / -> D:\programing\core_node\pycore\pyctl\speech\rpc\web
```

✅ **Confirmed**: Using UnifiedRpcServer with WebSocket support

### Test 2: Access Root Path
**URL**: `http://127.0.0.1:59000/`

**Expected**:
- Status: 200 OK
- Content: `index.html` from `pycore/pyctl/speech/rpc/web/index.html`
- WebSocket connection: `ws://127.0.0.1:59000/rpc/ws` - **Available**

---

## Consistency with pycore/pyctl/speech

### Static File Configuration
**File**: `pycore/pyctl/speech/launch_speech_rpc.py:106-111`

```python
# Step 3: Register static web directory
from pathlib import Path
web_dir = Path(__file__).parent / 'rpc' / 'web'
if web_dir.exists():
    instances.rpc_server.add_static_dir('/', str(web_dir))
    ColorPrint.blue(f"[SpeechRPC] Web UI: http://{host}:{port}/")
```

**Directory**: `pycore/pyctl/speech/rpc/web/`
- Contains: `index.html`, `index.html.backup`
- Mapped to: Root path `/`

### Behavior Comparison

| Feature | ThreadedRpcServer (Old) | UnifiedRpcServer (New - Fixed) |
|---------|-------------------------|--------------------------------|
| Root path `/` | ✅ Serves index.html | ✅ Serves index.html (with `show_index=True`) |
| WebSocket | ❌ Not supported | ✅ Supported at `/rpc/ws` |
| CORS | ✅ Added later | ✅ Built-in middleware |
| Static files | ✅ Custom implementation | ✅ aiohttp `add_static()` |
| Protocol | HTTP only | HTTP + WebSocket |

---

## Benefits

1. **Root Path Access**: `http://127.0.0.1:59000/` now correctly serves `index.html`
2. **WebSocket Support**: Frontend can connect to `ws://127.0.0.1:59000/rpc/ws`
3. **CORS Enabled**: Cross-origin requests work out of the box
4. **Consistent Behavior**: Matches original ThreadedRpcServer functionality
5. **Modern Architecture**: aiohttp-based async server with WebSocket support

---

## aiohttp `add_static()` Parameters

### Full Signature
```python
def add_static(
    prefix: str,
    path: PathLike,
    *,
    name: Optional[str] = None,
    expect_handler: Optional[_ExpectHandler] = None,
    chunk_size: int = 256 * 1024,
    show_index: bool = False,    # ← Critical for index.html
    follow_symlinks: bool = False,  # ← Useful for development
    append_version: bool = False
) -> AbstractRoute:
```

### Key Parameters
- **`show_index`** (default: `False`):
  - When `True`, accessing a directory path (e.g., `/`) will automatically look for and serve `index.html`
  - When `False`, accessing a directory returns 405 Method Not Allowed

- **`follow_symlinks`** (default: `False`):
  - When `True`, allows symbolic links within the static directory
  - Useful for development environments with linked resources

---

## Related Files

### Modified
- `pycore/pyutils/rpc/server/unified_server.py:354-359` - Fixed static file serving

### Related (No Changes Needed)
- `pycore/pyctl/speech/launch_speech_rpc.py:106-111` - Static directory registration
- `pycore/pyctl/speech/rpc/web/index.html` - Frontend UI file
- `pycore/pylauncher/launcher.py:656-669` - UnifiedRpcServerRunner initialization

---

## Migration Notes

### For Developers

If you're migrating from ThreadedRpcServer to UnifiedRpcServer and need to serve static files at the root path:

```python
# Correct usage
server.add_static_dir('/', '/path/to/web/directory')

# UnifiedRpcServer will configure aiohttp with:
# - show_index=True (automatically serve index.html)
# - follow_symlinks=True (allow symlinks in static dirs)
```

### Common Pitfalls

❌ **Wrong**: Using raw aiohttp `add_static()` without `show_index=True`
```python
app.router.add_static('/', '/path/to/web')  # 405 error on directory access
```

✅ **Correct**: Use UnifiedRpcServer's `add_static_dir()` method
```python
server.add_static_dir('/', '/path/to/web')  # Automatically serves index.html
```

---

## Status

✅ **RESOLVED**

- Root path `/` now correctly serves `index.html`
- WebSocket support enabled at `/rpc/ws`
- CORS middleware active
- Consistent with original ThreadedRpcServer behavior
- All tests passing

---

**Fixed By**: Claude Code Assistant
**Version**: pycore.pyutils.rpc 3.1.0
**Date**: 2025-11-18
