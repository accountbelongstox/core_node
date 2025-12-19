# RPC v2 Module System

## Overview

The RPC v2 Module System provides a unified HTTP interface for calling pycore modules with:
- **Hardcoded module registry** - Prevents dynamic imports
- **Module preloading** - Avoids runtime initialization overhead  
- **Instance caching** - Prevents frequent third-party library initialization
- **Auto route registration** - Automatic RPC route generation
- **Homepage documentation** - Web interface showing all available routes

## Architecture

```
pycore/pyutils/rpc_v2/modules/
├── module_registry.py      # Hardcoded list of supported modules
├── module_loader.py        # Module preloading and instance caching
├── module_call_handler.py  # Unified module calling interface
├── auto_register.py        # Auto-register routes to RPC server
├── homepage_routes.py      # Homepage displaying available routes
└── examples/
    └── module_server_example.py  # Example server
```

## Currently Supported Modules

### translator (Google Translator)
**Module**: `pycore.pyutils.translator.GoogleTranslator`

**Methods**:
- `translate_single` - Translate single text
- `translate_batch` - Translate multiple texts
- `detect_language` - Detect text language

## Quick Start

### 1. Start the Example Server

```bash
cd /www/programing/core_node
python3 -m pycore.pyutils.rpc_v2.examples.module_server_example
```

### 2. Access the Homepage

Open browser: `http://localhost:58765/`

The homepage displays:
- All available modules
- Available methods for each module
- Parameter specifications
- Example requests/responses

### 3. Call Translator via HTTP

```bash
curl -X POST http://localhost:58765/rpc/translator.translate_single \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "text": "Hello world",
      "src": "en",
      "dest": "ko"
    }
  }'
```

**Response**:
```json
{
  "type": "response",
  "route": "translator.translate_single",
  "id": "...",
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

## API Endpoints

### Homepage
```
GET /
```
Returns HTML/JSON documentation of all modules and routes

### List Modules
```
GET /api/modules
```
Returns JSON list of all available modules

### Get Module Info
```
GET /api/modules/{module_name}
```
Returns detailed information about a specific module

### RPC Call
```
POST /rpc/{module}.{method}
```
Call a module method

**Request Body**:
```json
{
  "params": {
    "param1": "value1",
    "param2": "value2"
  }
}
```

### Query Result (for async routes)
```
GET /rpc/query/{request_id}
```
Query the result of an async request

## Adding New Modules

### 1. Update Module Registry

Edit `module_registry.py`:

```python
SUPPORTED_MODULES = {
    "your_module": {
        "module_path": "pycore.pyutils.your_module",
        "class_name": "YourModuleClass",
        "singleton": True,
        "preload": True,
        "description": "Your module description",
        "methods": {
            "your_method": {
                "sync": False,  # or True for sync
                "description": "Method description",
                "timeout": 30.0,
                "params": {
                    "param1": {
                        "type": "str",
                        "required": True,
                        "description": "Parameter description"
                    }
                },
                "returns": {
                    "type": "dict",
                    "description": "Return value description"
                },
                "example": {
                    "params": {"param1": "value"},
                    "result": {"output": "result"}
                }
            }
        }
    }
}
```

### 2. Restart Server

The module will be automatically:
1. Preloaded on startup
2. Cached for reuse
3. Registered as RPC routes
4. Displayed on homepage

## Key Features

### 1. Hardcoded Registry
All supported modules must be explicitly listed in `module_registry.py`.  
**Why**: Prevents unexpected module imports and provides clear documentation.

### 2. Preloading
Modules marked with `"preload": True` are loaded at server startup.  
**Why**: Avoids first-call initialization delay.

### 3. Instance Caching
Module instances are cached and reused.  
**Why**: Prevents frequent initialization of heavy third-party libraries (e.g., googletrans).

### 4. Async Context Support
For modules requiring async context managers (like `async with GoogleTranslator()`), the system automatically handles context entry/exit.

### 5. Sync/Async Route Support
- **sync=True**: Returns result immediately (blocks)
- **sync=False**: Returns ACK, client polls for result

## Example: Batch Translation

```bash
curl -X POST http://localhost:58765/rpc/translator.translate_batch \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "texts": ["Hello", "World", "Python"],
      "src": "en",
      "dest": "ko"
    }
  }'
```

## Example: Language Detection

```bash
curl -X POST http://localhost:58765/rpc/translator.detect_language \
  -H "Content-Type: application/json" \
  -d '{
    "params": {
      "text": "안녕하세요"
    }
  }'
```

**Response**:
```json
{
  "result": {
    "language": "ko",
    "confidence": 0.99,
    "text": "안녕하세요"
  }
}
```

## Integration with Existing Systems

### Use with pycore.callmodule

The module system can coexist with the existing `pycore.callmodule` service.  
They run on different ports:
- RPC v2 Module System: `58765`
- callmodule Service: `59000`

### Use with MCP Backend

Can be integrated into MCP backend by registering routes:

```python
from pycore.pyutils.rpc_v2.modules import register_module_routes

# In your RPC server setup
register_module_routes(rpc_server, debug=True)
```

## Performance Benefits

### Without Module System (Dynamic Import)
```
Request 1: Import googletrans (2s) + Translate (0.5s) = 2.5s
Request 2: Import googletrans (2s) + Translate (0.5s) = 2.5s
Request 3: Import googletrans (2s) + Translate (0.5s) = 2.5s
```

### With Module System (Preloaded & Cached)
```
Startup: Import googletrans (2s)
Request 1: Translate (0.5s) = 0.5s
Request 2: Translate (0.5s) = 0.5s  
Request 3: Translate (0.5s) = 0.5s
```

**Result**: 5x faster response time for subsequent requests!

## Troubleshooting

### Module not found error
Ensure the module is added to `SUPPORTED_MODULES` in `module_registry.py`.

### Import error on startup
Check that the module path and class name are correct in the registry.

### Method not working
Verify the method name matches exactly what's defined in the module class.

### Server won't start
Check port 58765 is not already in use:
```bash
lsof -i :58765
```

## Future Enhancements

- [ ] Add more modules (OCR, TTS, etc.)
- [ ] Add authentication/authorization
- [ ] Add rate limiting
- [ ] Add request metrics
- [ ] Add WebSocket streaming support
- [ ] Add Swagger/OpenAPI documentation
