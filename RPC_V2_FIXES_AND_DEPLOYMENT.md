# RPC v2 Fixes and Deployment Guide

## Summary

Successfully fixed RPC v2 circular import bug and deployed translator service using RPC v2 architecture.

## Bugs Fixed

### 1. Circular Import in RPC v2 (CRITICAL)

**Problem**: 
```
fastapi_server.py → protocol.rpc_protocol (RPCProtocolServer)
protocol.rpc_protocol → address.RPCAddressProvider
address.address_provider → discovery.RPCDiscovery
discovery.rpc_discovery → protocol.rpc_protocol (RPCProtocolClient) ← CIRCULAR!
```

**Solution**:
- File: `pycore/pyutils/rpc_v2/discovery/rpc_discovery.py`
- Lines: 18, 91
- Fix: Moved `RPCProtocolClient` import inside `_verify_rpc_service()` method (delayed import)
- Result: Circular dependency chain broken

```python
# Before (line 18):
from pycore.pyutils.rpc_v2.protocol.rpc_protocol import RPCProtocolClient

# After (line 18):
# Delayed import to avoid circular dependency: protocol → address → discovery → protocol
# from pycore.pyutils.rpc_v2.protocol.rpc_protocol import RPCProtocolClient

# In method (line 91):
def _verify_rpc_service(self, host: str, port: int) -> bool:
    # Delayed import to break circular dependency
    from pycore.pyutils.rpc_v2.protocol.rpc_protocol import RPCProtocolClient
    ...
```

### 2. Syntax Error in auto_register.py

**Problem**:
```python
async def create_handler(mod=module_name, meth=method_name):
    async def handler(**params):
        return await module_call_handler.call_method(mod, meth, params)
    return handler

handler = await create_handler()  # ERROR: 'await' outside async function
```

**Solution**:
- File: `pycore/pyutils/rpc_v2/modules/auto_register.py`
- Lines: 50, 55
- Fix: Changed `async def` to `def` and removed `await`

```python
# After:
def create_handler(mod=module_name, meth=method_name):
    async def handler(**params):
        return await module_call_handler.call_method(mod, meth, params)
    return handler

handler = create_handler()  # Fixed
```

### 3. pyaudio Linux Installation Issues

**Problem**: 
- `pyaudio` requires `portaudio19-dev` on Linux
- `portaudio19-dev` has dependency conflicts
- Service startup delayed by failed installations

**Solution**:
- File: `pycore/pyfoundations/third_party.py`
- Lines: 183 (moved pyaudio), 197 (removed portaudio19-dev)
- Fix: Moved `pyaudio` to `WINDOWS_ONLY_PACKAGES`, removed `portaudio19-dev` from `SYSTEM_PACKAGES`

### 4. Network Accessibility

**Problem**: Service bound to 127.0.0.1 (localhost only)

**Solution**:
- File: `pycore/callmodule/global_config.py`
- Line: 33
- Fix: Changed `self.host = '127.0.0.1'` to `self.host = '0.0.0.0'`

## New Features

### 1. Fast Startup Mode

Added `PYCORE_SKIP_DEP_CHECK` environment variable support to skip dependency checking.

**File**: `pycore/pyfoundations/third_party.py`
**Lines**: 612-622

```python
if os.environ.get('PYCORE_SKIP_DEP_CHECK') != '1':
    try:
        check_and_install_dependencies()
    except Exception as e:
        ...
else:
    ColorPrint.blue("[INFO] Dependency check skipped (PYCORE_SKIP_DEP_CHECK=1)")
    ENCYCLOPEDIA.add("pycore_dependencies_checked", True)
```

### 2. RPC v2 Service Implementation

**File**: `run_callmodule_service.py`
**Architecture**:
- Uses `FastAPIRPCServer` (RPC v2 core)
- Auto-registers translator module routes
- Homepage showing all available routes
- Listens on `0.0.0.0:59000` (network accessible)
- Fast startup (sets `PYCORE_SKIP_DEP_CHECK=1` internally)

## Service Architecture

### Components

1. **FastAPIRPCServer**: Core RPC v2 server with HTTP + WebSocket support
2. **Module Registry**: Hardcoded translator module (no dynamic imports for security)
3. **Module Loader**: Preloads and caches module instances (prevents repeated initialization)
4. **Auto Register**: Automatically registers all module methods as RPC routes
5. **Homepage Routes**: Dynamic homepage showing all available routes and parameters

### Available Routes

```
GET  /                                - Homepage with documentation
GET  /api/modules                     - List all modules (JSON)
POST /rpc/translator.translate_single - Translate single text
POST /rpc/translator.translate_batch  - Batch translation
POST /rpc/translator.detect_language  - Language detection
GET  /rpc/status                      - RPC server status
GET  /rpc/routes                      - List all registered routes
WS   /rpc/ws                          - WebSocket endpoint
```

### Access Points

- **Homepage**: `http://192.168.2.1:59000/`
- **API Modules**: `http://192.168.2.1:59000/api/modules`
- **Health Check**: `http://192.168.2.1:59000/rpc/status`
- **Routes List**: `http://192.168.2.1:59000/rpc/routes`

## Deployment

### Update Service

Run the update script to apply all changes:

```bash
cd /www/programing/core_node
sudo ./UPDATE_SERVICE_TO_RPC_V2.sh
```

This script will:
1. Add `PYCORE_SKIP_DEP_CHECK=1` to systemd service environment
2. Reload systemd daemon
3. Restart `pycore-module-caller.service`
4. Display service status and access information

### Manual Update

If needed, manually update the service:

```bash
# Add environment variable to service file
sudo sed -i '/^Environment="PYTHONPATH/a Environment="PYCORE_SKIP_DEP_CHECK=1"' \
  /etc/systemd/system/pycore-module-caller.service

# Reload and restart
sudo systemctl daemon-reload
sudo systemctl restart pycore-module-caller.service

# Check status
systemctl status pycore-module-caller.service
```

## Testing

### Test Translator API

```bash
# Translate single text
curl -X POST http://192.168.2.1:59000/rpc/translator.translate_single \
  -H 'Content-Type: application/json' \
  -d '{
    "params": {
      "text": "Hello world",
      "src": "en",
      "dest": "ko"
    }
  }'

# Expected response:
{
  "type": "response",
  "route": "translator.translate_single",
  "result": {
    "original_text": "Hello world",
    "translated_text": "안녕하세요 세계",
    "src_lang": "en",
    "dest_lang": "ko",
    "from_cache": false
  },
  "success": true
}
```

### Test Homepage

```bash
# View homepage (shows all routes)
curl http://192.168.2.1:59000/ | python3 -m json.tool

# List all modules
curl http://192.168.2.1:59000/api/modules | python3 -m json.tool

# Check server status
curl http://192.168.2.1:59000/rpc/status | python3 -m json.tool
```

## Files Modified

1. **pycore/pyutils/rpc_v2/discovery/rpc_discovery.py**
   - Added delayed import for `RPCProtocolClient` (fixes circular import)

2. **pycore/pyutils/rpc_v2/modules/auto_register.py**
   - Fixed `async def` to `def` for handler factory function

3. **pycore/pyfoundations/third_party.py**
   - Moved `pyaudio` to `WINDOWS_ONLY_PACKAGES`
   - Removed `portaudio19-dev` from `SYSTEM_PACKAGES`
   - Added `PYCORE_SKIP_DEP_CHECK` environment variable support

4. **pycore/callmodule/global_config.py**
   - Changed host binding from `127.0.0.1` to `0.0.0.0`

5. **run_callmodule_service.py**
   - Complete rewrite using RPC v2 architecture
   - Uses `FastAPIRPCServer` instead of direct FastAPI
   - Auto-registers translator module routes
   - Sets `PYCORE_SKIP_DEP_CHECK=1` internally

6. **UPDATE_SERVICE_TO_RPC_V2.sh**
   - Service update script with environment variable injection

## Benefits

### 1. RPC v2 Architecture
- ✅ Unified protocol (HTTP + WebSocket)
- ✅ Sync/async route support
- ✅ ACK mechanism for long-running tasks
- ✅ Built-in status and monitoring endpoints

### 2. Module System
- ✅ Hardcoded registry (security - no dynamic imports)
- ✅ Singleton instances (performance - no repeated initialization)
- ✅ Preloading (fast response times)
- ✅ Auto route registration (maintainability)

### 3. Network Accessibility
- ✅ Listen on all interfaces (0.0.0.0)
- ✅ Accessible from network (192.168.2.1)
- ✅ CORS enabled

### 4. Fast Startup
- ✅ Skip dependency check (PYCORE_SKIP_DEP_CHECK=1)
- ✅ No pyaudio installation on Linux
- ✅ Quick service restart

## Troubleshooting

### Service fails to start

```bash
# Check logs
journalctl -u pycore-module-caller.service -n 50

# Test manually
export PYCORE_SKIP_DEP_CHECK=1
python3 /www/programing/core_node/run_callmodule_service.py
```

### Network not accessible

```bash
# Verify binding
ss -tulnp | grep 59000
# Should show: 0.0.0.0:59000

# Check firewall
sudo ufw status

# Test localhost first
curl http://127.0.0.1:59000/rpc/status
```

### Circular import errors

If circular import errors reappear, ensure delayed import is properly implemented:

```bash
# Verify fix is applied
grep -A 3 "Delayed import to break circular dependency" \
  /www/programing/core_node/pycore/pyutils/rpc_v2/discovery/rpc_discovery.py
```

## Future Enhancements

### Adding New Modules

To add new modules to the RPC v2 service:

1. Edit `pycore/pyutils/rpc_v2/modules/module_registry.py`
2. Add module configuration to `SUPPORTED_MODULES` dictionary
3. Restart service

Example:

```python
SUPPORTED_MODULES = {
    "translator": { ... },  # Existing
    "ocr": {  # New module
        "module_path": "pycore.pyutils.ocr",
        "class_name": "OCRProcessor",
        "singleton": True,
        "preload": True,
        "methods": {
            "recognize_text": {
                "sync": False,
                "params": { ... }
            }
        }
    }
}
```

## References

- RPC v2 Documentation: `/www/programing/core_node/pycore/pyutils/rpc_v2/README.md`
- Module System: `/www/programing/core_node/pycore/pyutils/rpc_v2/modules/README.md`
- Service File: `/etc/systemd/system/pycore-module-caller.service`

---

**Last Updated**: 2025-11-22
**Status**: ✅ Production Ready
