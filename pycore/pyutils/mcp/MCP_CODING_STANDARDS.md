# MCP (Model Context Protocol) Coding Standards

## 1. Overview

This document defines coding standards for all MCP-related modules in `pycore/pyutils/mcp/` and `pyapps/mcp/`. These standards ensure clean, maintainable code compatible with MCP STDIO transport.

## 2. Critical Rules for MCP Modules

### 2.1 MCP Mode Configuration

**REQUIRED: Enable MCP Mode at Server Startup**

MCP servers **MUST** call `ColorPrint.enable_mcp_mode()` at startup to ensure clean output:

```python
# At the top of your MCP server main.py, BEFORE importing other modules
from pycore.pyfoundations.color_print import ColorPrint

ColorPrint.enable_mcp_mode()  # Disables ANSI codes globally
```

**What MCP Mode Does:**
- Disables ANSI color codes system-wide (prevents `\033[94m` sequences in logs)
- Sets output stream to stderr (stdout reserved for MCP JSON-RPC)
- Optimizes ColorPrint for clean, parseable log output

### 2.2 Logging Standards

**FORBIDDEN: ColorPrint Usage in MCP Modules**
- **DO NOT** use `ColorPrint` in MCP implementation modules (`pycore/pyutils/mcp/`)
- **Reason**: MCP modules should use standard logging for consistency
- **Alternative**: Use Python's standard `logging` module
- **Note**: Other pycore modules can continue using ColorPrint (MCP mode will strip colors automatically)

**REQUIRED: Standard Python Logging**
```python
import logging

logger = logging.getLogger(__name__)

# Good - Use standard logging levels
logger.debug("Initialization complete")
logger.info("Processing file: %s", file_path)
logger.warning("Cache miss for %s", key)
logger.error("Operation failed: %s", error)

# Bad - Never use ColorPrint
# ColorPrint.blue("[Module] Initialized")  # FORBIDDEN
# ColorPrint.red("[Module] Error")         # FORBIDDEN
```

**Log Level Guidelines:**
- `DEBUG`: Internal details, verbose information (not shown in production)
- `INFO`: Normal operational events (minimized in MCP STDIO mode)
- `WARNING`: Unexpected but non-critical events
- `ERROR`: Error conditions requiring attention

### 2.2 MCP STDIO Transport Compatibility

**Output Streams:**
- **STDOUT**: Reserved for MCP JSON-RPC protocol only
- **STDERR**: For logging output only (controlled by logging level)
- **FORBIDDEN**: `print()` statements (breaks MCP protocol)
- **FORBIDDEN**: Direct writes to `sys.stdout` or `sys.stderr`

**Environment Variables:**
- `MCP_PROJECT_ROOT`: Project root directory
- `MCP_ALLOW_ALL_PATHS`: Global filesystem access flag

### 2.3 Error Handling

**REQUIRED Patterns:**
```python
# Good - Return error dictionaries
async def my_tool(file_path: str) -> Dict[str, Any]:
    try:
        result = process_file(file_path)
        return {
            'success': True,
            'data': result,
            'file_path': file_path
        }
    except Exception as e:
        logger.error("[MyController] Processing failed: %s", e)
        return {
            'success': False,
            'error': str(e),
            'file_path': file_path
        }

# Bad - Raising exceptions (breaks MCP protocol)
# def my_tool(file_path: str):
#     if not os.path.exists(file_path):
#         raise FileNotFoundError(f"File not found: {file_path}")  # FORBIDDEN
```

**Error Response Format:**
```python
{
    'success': False,
    'error': 'Human-readable error message',
    'error_type': 'FileNotFoundError',  # Optional
    'details': {...}  # Optional additional context
}
```

## 3. Module Organization

### 3.1 Architecture Layers

```
pyapps/mcp/
├── main.py                    # MCP server entry point (FastMCP integration)
└── controller/                # Thin routing layer (organizational logic only)
    ├── codebase_controller.py
    ├── database_controller.py
    └── file_info_controller.py

pycore/pyutils/mcp/
├── codebase/                  # Core implementation (tree, search, analysis)
├── database/                  # Core implementation (namespace, operations)
└── file_processing/           # Core implementation (OCR, parsing, caching)
```

**Dependency Flow:**
- `pyapps/mcp/main.py` → `pyapps/mcp/controller/`
- `pyapps/mcp/controller/` → `pycore/pyutils/mcp/`
- `pycore/pyutils/mcp/` → `pycore/pyfoundations`, `pycore/pygvar`

**FORBIDDEN:**
- Controllers implementing business logic (delegate to `pycore/pyutils/mcp/`)
- Cross-layer circular dependencies
- Direct third-party package imports (use `pycore/pyfoundations/third_party.py`)

### 3.2 Singleton Pattern

**REQUIRED for MCP Modules:**
```python
# Singleton instance (module-level)
_my_manager_singleton = None

def get_my_manager_singleton() -> MyManager:
    """Get or create singleton instance"""
    global _my_manager_singleton
    if _my_manager_singleton is None:
        _my_manager_singleton = MyManager()
    return _my_manager_singleton
```

**Rationale:**
- MCP tools are long-lived in the server process
- Singletons avoid repeated initialization overhead
- Shared state management (caches, connections, etc.)

## 4. Tool Development Standards

### 4.1 Tool Function Signature

```python
@mcp.tool()
async def my_tool_name(
    required_param: str,
    optional_param: str = "default",
    flag_param: bool = True,
    limit_param: int = 100
) -> Dict[str, Any]:
    """
    Tool description (shown to LLM).

    Args:
        required_param: Description of required parameter
        optional_param: Description with default value
        flag_param: Boolean flag (default: True)
        limit_param: Numeric limit (default: 100)

    Returns:
        Result dictionary with success flag and data
    """
    # Implementation...
```

**Guidelines:**
- Use type hints for all parameters and return values
- Provide comprehensive docstrings (LLM reads these)
- Use descriptive parameter names (avoid abbreviations)
- Return structured dictionaries with `success` field

### 4.2 Tool Response Format

**Success Response:**
```python
{
    'success': True,
    'data': {...},              # Primary result data
    'metadata': {...},          # Optional metadata
    'stats': {                  # Optional statistics
        'processing_time': 0.123,
        'items_processed': 42
    }
}
```

**Error Response:**
```python
{
    'success': False,
    'error': 'Error message',
    'error_type': 'ValueError',
    'file_path': '/path/to/file'  # Context
}
```

## 5. Performance Considerations

### 5.1 Async/Await Pattern

**REQUIRED for MCP Tools:**
- All MCP tool functions must be `async def`
- Use `await` for I/O operations (file reads, database queries)
- FastMCP handles asyncio event loop automatically

**Good:**
```python
async def my_tool(file_path: str) -> Dict[str, Any]:
    # Async I/O operations
    result = await process_file_async(file_path)
    return result
```

**Acceptable (Sync Wrappers):**
```python
async def my_tool(file_path: str) -> Dict[str, Any]:
    # Wrap sync operations if needed
    result = await asyncio.to_thread(process_file_sync, file_path)
    return result
```

### 5.2 Caching Strategy

**Recommended:**
- Use SQLite databases for persistent caching (see `file_processing/database_manager_*`)
- Implement cache invalidation strategies
- Provide cache clearing tools for users

## 6. Testing and Validation

### 6.1 Manual Testing

**Test MCP Server:**
```bash
# Start MCP server in STDIO mode
python D:/programing/core_node/pymain.py app=mcp

# Expected output (clean, minimal):
# MCP server starts silently with no banner (show_banner=False)
# Only ERROR level logs visible (log_level="ERROR")
# ColorPrint from other modules outputs plain text (no ANSI codes)

# What you should NOT see:
# ❌ ANSI codes (\033[94m, \033[0m, etc.)
# ❌ FastMCP banner (disabled)
# ❌ INFO/DEBUG logs (filtered out)
# ❌ Colored text in logs (MCP mode active)
```

### 6.2 Log Level Configuration

**Development:**
```python
logging.basicConfig(level=logging.DEBUG)  # Verbose
```

**Production (MCP STDIO):**
```python
logging.basicConfig(level=logging.WARNING)  # Minimal output
```

## 7. Migration Guide

### 7.1 Replacing ColorPrint

**Before (FORBIDDEN):**
```python
from pycore.pyfoundations.color_print import ColorPrint

class MyManager:
    def __init__(self):
        ColorPrint.blue("[MyManager] Initialized")

    def process(self, data):
        ColorPrint.green("[MyManager] Processing complete")
        ColorPrint.red("[MyManager] Error occurred")
```

**After (REQUIRED):**
```python
import logging

logger = logging.getLogger(__name__)

class MyManager:
    def __init__(self):
        logger.debug("[MyManager] Initialized")

    def process(self, data):
        logger.info("[MyManager] Processing complete")
        logger.error("[MyManager] Error occurred")
```

### 7.2 Logging Best Practices

**Good:**
```python
logger.debug("Cache hit for key: %s", cache_key)
logger.info("Processing file: %s", file_path)
logger.warning("Deprecated parameter '%s' used", param_name)
logger.error("Database query failed: %s", str(error))
```

**Bad:**
```python
logger.debug(f"Cache hit for key: {cache_key}")  # Avoid f-strings in logs
logger.info("Processing file: " + file_path)     # Avoid string concatenation
logger.warning("Something went wrong")            # Too vague
```

## 8. Checklist for MCP Module Development

**Before Committing:**
- [ ] No `ColorPrint` imports or usage
- [ ] Using `logging` module with appropriate levels
- [ ] No `print()` statements
- [ ] All tools return `Dict[str, Any]` with `success` field
- [ ] All tools are `async def` functions
- [ ] Comprehensive docstrings for all tools
- [ ] Error handling with try-except and error dictionaries
- [ ] Tested with MCP client (clean log output)
- [ ] Singleton pattern for managers
- [ ] No circular dependencies

---

**Document Version:** 1.0
**Last Updated:** 2025-11-18
**Applies To:** `pycore/pyutils/mcp/`, `pyapps/mcp/`
