# Pycore Module Caller - FastAPI Service

Dynamic HTTP API service for calling pycore modules with direct utility endpoints.

## Quick Start

### Start Service

```bash
# Via systemd
systemctl start pycore-module-caller

# Or manually
python3 /www/programing/core_node/run_callmodule_service.py

# Or as module
cd /www/programing/core_node
python3 -m pycore.callmodule
```

### Access API

- **API Docs:** http://127.0.0.1:59000/docs
- **Health:** http://127.0.0.1:59000/health
- **Status:** http://127.0.0.1:59000/api/status

## Architecture

```
callmodule/
├── routers/           # API route definitions
│   ├── health_router.py
│   ├── module_call_router.py
│   └── ocr_router.py
├── controllers/       # Request/response logic
├── services/          # Business logic
├── models/            # Pydantic models
└── core/              # Module loading
```

## API Usage

### Generic Module Call

```bash
curl -X POST http://127.0.0.1:59000/api/call \
  -H "Content-Type: application/json" \
  -d '{
    "module": "pycore.pyutils.ocr.ocr_manager",
    "function": "ocr_manager.get_available_models",
    "args": [],
    "kwargs": {}
  }'
```

### Direct OCR Endpoints (Simpler!)

```bash
# Get all OCR models
curl http://127.0.0.1:59000/ocr/models

# Get specific model info
curl http://127.0.0.1:59000/ocr/models/scene

# Check if model is loaded
curl http://127.0.0.1:59000/ocr/models/scene/loaded

# Get OCR status
curl http://127.0.0.1:59000/ocr/status
```

## Unified Utils Import

All pyutils utilities are exported from `pycore.pyutils` with availability flags:

```python
from pycore.pyutils import ocr_manager, OCR_AVAILABLE
from pycore.pyutils import edge_tts_manager, EDGE_TTS_AVAILABLE
from pycore.pyutils import get_available_utilities

# Check what's available
utils = get_available_utilities()
# {'ocr': True, 'edge_tts': False, 'device_control': True, ...}

# Use with availability check
if OCR_AVAILABLE:
    models = ocr_manager.get_available_models()
```

## Available Utilities

✓ **Available:**
- `ocr_manager` - OCR functionality
- `device_manager` - Device management
- `device_control` - ADB, Touch, Key events
- `group_control` - Group device control
- `video_stream` - H264, FMP4 encoding/decoding
- `media_compressor` - Media compression
- `codesync` - Code Sync mesh (role-based dev→client distribution; stdlib-only)

✗ **Optional (may not be available):**
- `edge_tts_manager` - Edge TTS
- `azure_speech_manager` - Azure Speech
- `browser_manager` - Browser automation
- `yolo_manager` - YOLO detection
- `mcp_server_manager` - MCP server
- `rpc_manager`, `wsrpc_manager` - RPC services

## Adding Direct Endpoints

### 1. Create Router

```python
# callmodule/routers/yourutil_router.py
from fastapi import APIRouter, HTTPException
from pycore.pyutils import your_utility, YOUR_UTIL_AVAILABLE

yourutil_router = APIRouter(prefix="/yourutil", tags=["YourUtil"])

@yourutil_router.get("/endpoint")
async def your_endpoint():
    if not YOUR_UTIL_AVAILABLE:
        raise HTTPException(status_code=503, detail="Service not available")
    result = your_utility.do_something()
    return {"success": True, "result": result}
```

### 2. Register Router

```python
# callmodule/routers/__init__.py
from .yourutil_router import yourutil_router
__all__ = [..., 'yourutil_router']

# callmodule/app.py
from .routers import ..., yourutil_router
app.include_router(yourutil_router)
```

## Testing

```bash
cd /www/programing/core_node/pycore/test_pycore

# Run all tests
bash run_all_tests.sh

# Or individual tests
python3 test_health.py
python3 test_ocr_api.py
python3 test_module_call.py
```

## Service Management

```bash
# Status
systemctl status pycore-module-caller

# Start/Stop/Restart
systemctl start pycore-module-caller
systemctl stop pycore-module-caller
systemctl restart pycore-module-caller

# Logs
journalctl -u pycore-module-caller -f
```

## Configuration

Service config: `/etc/systemd/system/pycore-module-caller.service`

- **Port:** 59000 (default)
- **CPU Limit:** 20%
- **Memory Limit:** 500M
- **Entry:** `/www/programing/core_node/run_callmodule_service.py`

## Development

### Local Development

```bash
# Start with auto-reload
cd /www/programing/core_node
python3 -m pycore.callmodule --reload --debug
```

### Module Security

Configure in `global_config.py`:
- `allowed_modules` - Whitelist (empty = allow all)
- `blocked_modules` - Blacklist specific modules

By default, all modules are allowed.

## Notes

- **No GUI Dependencies:** Service runs without X display by using standalone entry point
- **Safe Imports:** All utilities use try-except with availability flags
- **FastAPI Docs:** Auto-generated at `/docs` endpoint
- **Version:** 1.0.0 (FastAPI-based)
