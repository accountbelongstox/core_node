# MCP Proxy-Backend Architecture

## Overview

MCP service is split into two components:
- **Backend (Singleton)**: Real MCP server with all tools and operations
- **Proxy (Multi-Instance)**: Lightweight forwarder that connects clients to backend

## Architecture Diagram

```
┌─────────────┐
│ MCP Client  │ (Claude Desktop, Cursor, etc.)
└──────┬──────┘
       │ STDIO (JSON-RPC)
       ▼
┌──────────────┐
│  MCP Proxy   │ pyapps/mcp/mcp_proxy.py (Multi-Instance)
└──────┬───────┘
       │ HTTP (localhost)
       ▼
┌──────────────┐
│ MCP Backend  │ pycore/pyctl/mcpctl/mcp_backend.py (SINGLETON)
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ MCP Tools    │ File Processing, Database, Codebase
└──────────────┘
```

## Components

### Backend (pycore/pyctl/mcpctl/)
- **File**: `mcp_backend.py`
- **Mode**: SINGLETON (only one instance)
- **Ports**:
  - Singleton Detection: 58000-58099
  - HTTP Service: 58100-58199
- **Features**:
  - Uses pylauncher for singleton detection
  - Runs actual FastMCP server
  - Handles all tool operations
  - Can shutdown existing instance

### Proxy (pyapps/mcp/)
- **File**: `mcp_proxy.py`
- **Mode**: MULTI-INSTANCE (many proxies allowed)
- **Protocol**: STDIO (MCP JSON-RPC)
- **Features**:
  - Lightweight forwarder
  - Connects to backend via HTTP
  - No singleton restriction
  - Auto-discovers backend port

## Startup Flow

### Backend Startup
1. Check singleton via port 58000-58099
2. If existing instance found:
   - Option A: Send SHUTDOWN and replace
   - Option B: Exit (existing running)
3. Become PRIMARY instance
4. Start HTTP service on port 58100-58199
5. Start heartbeat thread
6. Register all MCP tools

### Proxy Startup
1. No singleton check (multi-instance OK)
2. Discover backend port (try 58100-58199)
3. Connect to backend via HTTP
4. Start STDIO listener (MCP protocol)
5. Forward all tool calls to backend

## Port Configuration

| Component | Purpose | Port Range | Singleton |
|-----------|---------|------------|-----------|
| Backend Singleton | Detection | 58000-58099 | Yes |
| Backend HTTP | Service | 58100-58199 | Yes |
| Proxy STDIO | MCP Protocol | N/A (stdin/stdout) | No |

## Usage

### Start Backend (Singleton)
```bash
# Standalone
python pycore/pyctl/mcpctl/mcp_backend_main.py

# With debug
set MCP_BACKEND_DEBUG=1
set SINGLETON_DEBUG=1
python pycore/pyctl/mcpctl/mcp_backend_main.py
```

### Start Proxy (Multi-Instance)
```bash
# Via pymain.py
python pymain.py app=mcp

# Multiple proxies (different terminals)
python pymain.py app=mcp  # Terminal 1
python pymain.py app=mcp  # Terminal 2
python pymain.py app=mcp  # Terminal 3
```

## Debug Flags

| Variable | Component | Purpose |
|----------|-----------|---------|
| `MCP_BACKEND_DEBUG=1` | Backend | Enable backend debug output |
| `MCP_PROXY_DEBUG=1` | Proxy | Enable proxy debug output |
| `SINGLETON_DEBUG=1` | Backend | Enable singleton detection debug |

## Benefits

1. **Resource Efficiency**: Only one backend instance handles all operations
2. **Multi-Client Support**: Multiple proxies can connect to same backend
3. **Singleton Management**: Backend ensures no duplicate services
4. **Clean Separation**: Proxy handles protocol, backend handles logic
5. **Easy Deployment**: Clients only need proxy, backend runs independently

## File Structure

```
pycore/pyctl/mcpctl/
├── __init__.py
├── mcp_launcher.py          # Legacy launcher (deprecated)
├── mcp_backend.py           # NEW: Backend server (singleton)
├── mcp_backend_main.py      # NEW: Backend entry point
└── ARCHITECTURE.md          # This file

pyapps/mcp/
├── mcp_main.py              # Proxy entry point (via pymain.py app=mcp)
├── mcp_proxy.py             # NEW: Proxy implementation
├── controller/              # Controllers (used by backend)
└── ...
```

## Migration Path

1. **Phase 1** (Current): Create file structure ✓
2. **Phase 2**: Implement backend with singleton
3. **Phase 3**: Implement proxy with HTTP forwarding
4. **Phase 4**: Update mcp_main.py to use proxy
5. **Phase 5**: Test multi-client scenarios
6. **Phase 6**: Deprecate old direct MCP launch
