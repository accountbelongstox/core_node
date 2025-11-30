# Unified MCP Server (Independent Edition)

Completely independent MCP server without pycore dependencies.
Provides unified access to PyCore and NCore backends via HTTP proxy.

## Features

- **Zero PyCore Dependencies** - Self-contained implementation
- **Dual Backend Support** - PyCore (59000) + NCore (58000)
- **Graceful Degradation** - Starts even without backends, returns informative errors
- **Transparent Backend Access** - MCP clients don't need to know about backend architecture
- **Standard MCP Protocol** - Compatible with Claude Desktop and other MCP clients
- **HTTP Proxy Architecture** - Lightweight and scalable

## Architecture

```
┌────────────────────────────────┐
│  Claude/AI Client              │
│  (MCP Protocol)                │
└───────────┬────────────────────┘
            │
            ▼
┌────────────────────────────────┐
│  Unified MCP Server            │
│  ncore/mcpserver/unifiedmcp    │
│  ┌──────────────────────────┐  │
│  │ FastMCP Server           │  │
│  │ - mcp_server_status      │  │
│  │ - file_info_parser       │  │
│  │ - ncore_module_call      │  │
│  │ - ncore_browser_action   │  │
│  └──────────────────────────┘  │
└───────┬─────────────┬──────────┘
        │ HTTP        │ HTTP
        ▼             ▼
┌─────────────┐  ┌──────────────┐
│ PyCore      │  │ NCore        │
│ Backend     │  │ Backend      │
│ :59000/mcp  │  │ :58000       │
└─────────────┘  └──────────────┘
```

## Installation

### Prerequisites

```bash
# Required Python packages
pip install fastmcp requests

# Backend services (at least one required)
# PyCore Backend (Python)
python pycore_module_caller.py

# NCore Backend (Node.js)
node ncore/index.js
```

## Usage

### Direct Run

```bash
# Start MCP server directly
python ncore/mcpserver/unifiedmcp/main.py
```

### Via pymain.py Launcher

```bash
# Add symlink or launcher in pyapps/mcp/
python pymain.py app=mcp
```

### Claude Desktop Configuration

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "unified_mcp": {
      "command": "python",
      "args": [
        "D:/programing/core_node/ncore/mcpserver/unifiedmcp/main.py"
      ]
    }
  }
}
```

## Environment Variables

```bash
# PyCore Backend
export PYCORE_BACKEND_HOST=localhost
export PYCORE_BACKEND_PORT=59000

# NCore Backend
export NCORE_BACKEND_HOST=localhost
export NCORE_BACKEND_PORT=58000
```

## Available Tools

### System Tools

- **`mcp_server_status`** - Get server status and backend availability
  - Args: `detailed: bool` - Include detailed backend info
  - Returns: Server status with backend info

### PyCore Backend Tools

Requires PyCore backend running on port 59000.

- **`file_info_parser`** - Parse files (images, PDFs, Office docs)
  - Supports: PNG, JPG, BMP, PDF, DOCX, XLSX, PPTX
  - Features: OCR, color analysis, table extraction, metadata
  - Args:
    - `file_path: str` - Local file path
    - `use_cache: bool` - Use caching (default: True)
    - `include_pixel_matrix: bool` - Include pixel matrix
    - `ocr_model_type: str` - OCR model type
    - `num_colors: int` - Dominant colors to extract
    - `extract_images: bool` - Extract embedded images
    - `extract_tables: bool` - Extract tables
    - `extract_hyperlinks: bool` - Extract hyperlinks

### NCore Backend Tools

Requires NCore backend running on port 58000.

- **`ncore_module_call`** - Call Node.js module function
  - Args:
    - `module: str` - Module path (e.g., "ncore/utils/browser")
    - `function: str` - Function name
    - `args: list` - Positional arguments (optional)
    - `kwargs: dict` - Keyword arguments (optional)

- **`ncore_browser_action`** - Browser automation control
  - Actions: status, launch, navigate, screenshot, execute, close
  - Args:
    - `action: str` - Browser action to perform
    - `params: dict` - Action parameters (optional)

## Testing

### Check Server Status

```python
# In Claude Desktop or MCP client
result = await mcp_server_status(detailed=True)
print(result)
```

### Test File Parser (PyCore)

```python
result = await file_info_parser(
    file_path="D:/test.png",
    use_cache=True,
    ocr_model_type="general"
)
```

### Test Browser Control (NCore)

```python
# Launch browser
result = await ncore_browser_action(
    action="launch",
    params={"headless": False}
)

# Navigate to URL
result = await ncore_browser_action(
    action="navigate",
    params={"url": "https://example.com"}
)

# Take screenshot
result = await ncore_browser_action(
    action="screenshot",
    params={"path": "D:/screenshot.png"}
)
```

## Dependencies

### Python Packages

- `fastmcp` - MCP server framework
- `requests` - HTTP client for backend communication

### Backend Services

- **PyCore Backend** (optional)
  - File processing, OCR, document parsing
  - Database operations
  - Codebase analysis

- **NCore Backend** (optional)
  - Browser automation
  - Node.js module calling
  - Advanced tools

## Backend Availability & Graceful Degradation

The MCP server **always starts successfully**, regardless of backend availability:

- **No backends available**: Server starts, all tools registered as `[OFFLINE]`
- **One backend available**: Server starts, that backend's tools are `[AVAILABLE]`
- **Both backends available**: Server starts, all tools are `[AVAILABLE]`

When a tool is called but its backend is unavailable, the MCP server returns an informative error:

```json
{
  "success": false,
  "error": "PyCore backend is not available",
  "hint": "Start backend: python pycore_module_caller.py",
  "backend": "pycore",
  "url": "http://localhost:59000/mcp"
}
```

This design ensures:
1. ✅ MCP server never fails to start
2. ✅ MCP clients don't need to know about backend architecture
3. ✅ Informative error messages guide users to start backends when needed
4. ✅ Backend unavailability is transparent to the caller

## Troubleshooting

### Backend Connection Errors

If you receive backend unavailable errors when calling tools, start the required backend:

```bash
# Start PyCore backend (for file_info_parser)
python pycore_module_caller.py

# Start NCore backend (for ncore_module_call, ncore_browser_action)
node ncore/index.js
```

### Error: "Cannot connect to PyCore backend"

**Check**:
1. Is PyCore backend running?
   ```bash
   curl -X POST http://localhost:59000/mcp/backend_info -d "{}"
   ```
2. Is port 59000 in use?
3. Check firewall settings

### Error: "Cannot connect to NCore backend"

**Check**:
1. Is NCore backend running?
   ```bash
   curl http://localhost:58000/health
   ```
2. Is port 58000 in use?
3. Check Node.js service logs

## Development

### Project Structure

```
ncore/mcpserver/unifiedmcp/
├── __init__.py           # Package initialization
├── main.py               # Main MCP server implementation
├── stdio_compat.py       # STDIO compatibility utilities
└── README.md             # This file
```

### Key Components

1. **Backend Status Tracker** - Monitors backend availability
2. **HTTP Proxy Functions** - Forwards tool calls to backends
3. **FastMCP Server** - Implements MCP protocol
4. **Tool Definitions** - Wraps backend tools as MCP tools

### Adding New Tools

```python
# In main.py, add to the appropriate backend section

@mcp.tool()
async def your_new_tool(param: str) -> dict:
    """
    Tool description

    Args:
        param: Parameter description

    Returns:
        Result description
    """
    return await call_pycore_tool(
        "backend_tool_name",
        param=param
    )
```

## Architecture Benefits

### Independence
- No pycore dependencies
- Self-contained implementation
- Can run standalone

### Flexibility
- Support multiple backends
- Easy to add new backends
- Graceful degradation

### Scalability
- HTTP-based communication
- Stateless proxy design
- Horizontal scaling potential

## Related Documentation

- [MCP Unified Dual Backend Architecture](../../../MCP_UNIFIED_DUAL_BACKEND_ARCHITECTURE_2025-11-23.md)
- [PyCore Backend Refactoring](../../../MCP_UNIFIED_BACKEND_REFACTORING_2025-11-23.md)
- [FastMCP Documentation](https://github.com/jlowin/fastmcp)

## License

Same as parent project

## Author

AI Assistant (Claude) with Human Developer
Date: 2025-11-23
