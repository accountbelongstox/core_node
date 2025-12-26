# MCP Network Discovery Task

## Overview

Implement service auto-discovery functionality. First get the local domain IP network segment. Ensure access to .1 IP, e.g., 192.168.xx.1, which indicates the network segment is correct.

## Service Discovery Logic

### Laravel Service Discovery

First discover Laravel service as default backend. This is an MCP service that does not need to be provided to AI tools, and AI tools do not need to know. Port is 9000, default is 192.168.50.2:9000. If network segment is incorrect, perform network discovery. If network segment is correct, it means backend is under maintenance.

### PyCore/NCore Service Discovery

PyCore and NCore services access localhost, but if localhost is not started, also perform network discovery on the same port. Finally give discovery results (0.5 second timeout).

- **Laravel**: Static discovery at startup
- **PyCore/NCore**: Retry discovery when inaccessible, continuously discover services between localhost and local network

## Documentation Update

This MCP service is independently developed, does not depend on PyCore basic service. But will call PyCore, NCore, Laravel through HTTP.

## Reference Implementation

Reference original `pycore\pyctl\mcpctl` for all MCP functionality. Complete integration. Note: MCP client is the current endpoint, proxy endpoint completes interface (but do not let AI tools know this), then complete all other functions on PyCore side.

Although interaction is through HTTP, PyCore can also access local folders and files, so unified logic is fine. Now `pycore_module_caller.py` call interface provides `mcp/` prefix calls, and abstracts `pycore\pyctl` to integrate with `pycore_module_caller`.

At the same time, abstract frontend in `pycore\pyctl` to `D:/programing/core_node/ncore/mcp_server/unifiedmcp/main.py`. After that, web and routing functions in `pyctl` are no longer needed, taken over by `pycore_module_caller.py`.

## Database Migration

Put database migration in `php artisan sys:init`, register as MCP init method.

## Placeholder Image Generator

Scan original functionality in `pycore\pyctl` and `ncore\mcp_server\placeholder_image_generator`. Add placeholder generator to Laravel MCP. Receive size, text, whether to generate real image, then immediately generate a downloadable image. When image is downloaded, delete temporary file. Note: Use file system map system, and can record in MCP internally whether it has been downloaded. Images older than 1 day are automatically deleted.

## Web UI Extension

In web UI functionality, extend to view placeholder image generation status. `http://192.168.50.2:9000/#` MCP Manager reuses previous logic, code centralization.

## Architecture Verification

- ✅ MCP Frontend (`ncore/mcp_server/unifiedmcp/main.py`): 20 tools registered
- ✅ HTTP Proxy Layer (`call_pycore_tool()`): Parameters completely passed
- ✅ PyCore Router (`pycore/callmodule/routers/mcp_router.py`): 19 routes registered
- ✅ Handler Layer (`pycore/pyctl/mcpctl/backend/handlers/`): Business logic complete
- ✅ Controller Layer (`pyapps/mcp/controller`): File, database, code repository controllers

## Current Issue

Python 3.13 compatibility issue (fastapi/pydantic) prevents PyCore backend from starting.

## Solution

Downgrade to Python 3.11 to run normally. Architecture and logic chain are completely aligned, code reuse is reasonable, conforms to specifications.

## Code Location

Do not put code in vendor. Should put in same directory as current: `http://192.168.50.2:9000/debug-assets/css/ittools-layout.css`

