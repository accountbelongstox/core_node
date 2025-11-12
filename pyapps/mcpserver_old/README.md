# Unified MCP Server - Singleton Pattern + WebSocket RPC

## Overview

Refactored MCP (Model Context Protocol) server using singleton pattern with WebSocket RPC architecture. All MCP services are integrated into a single backend that multiple clients can connect to.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Python Application Entry                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  main.py (Root Entry Point)                                  │
│    │                                                          │
│    ├──→ Discovers apps in pyapps/                           │
│    ├──→ Prompts user if no --app specified                  │
│    └──→ Loads pyapps/{appname}/{appname}_main.py           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              pyapps/mcpserver/mcpserver_main.py              │
│                  (Unified MCP Server)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Singleton Backend (Primary Instance Only)             │ │
│  │  ─────────────────────────────────────────────────     │ │
│  │                                                          │ │
│  │  • WebSocket RPC Server (port 8767)                    │ │
│  │  • All MCP Services Integrated:                        │ │
│  │    - codebase.* (Scanner)                              │ │
│  │    - file.* (Processor)                                │ │
│  │    - image.* (Placeholder Generator)                   │ │
│  │    - db.* (Database Operations)                        │ │
│  │    - ai.* (AI Collaboration)                           │ │
│  │    - system.* (System Info)                            │ │
│  │                                                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Client Communication (All Instances)                  │ │
│  │  ────────────────────────────────────────────────      │ │
│  │                                                          │ │
│  │  • Connects to backend via WebSocket RPC              │ │
│  │  • Can make requests to any service                    │ │
│  │  • Multiple clients share same backend                 │ │
│  │                                                          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
core_node/
├── main.py                                    # Root entry point (like main.js)
├── main.js                                    # Node.js entry point (existing)
│
├── pyapps/                                    # Python apps directory
│   └── mcpserver/                             # MCP server app
│       ├── mcpserver_main.py                 # MCP server entry point
│       ├── test_mcp_client.py                # Test client
│       └── README.md                          # This file
│
├── pycore/                                    # Python core libraries
│   └── pyutils/
│       └── wsrpc/                             # WebSocket RPC framework
│           ├── singleton_backend.py
│           ├── singleton_rpc_example.py
│           └── ws_rpc_server.py
│
└── ncore/                                     # Core services
    └── mcp_server/                            # Original MCP servers
        ├── codebase-scanner/
        ├── file_processor/
        ├── placeholder_image_generator/
        ├── mcp-alchemy/
        ├── ai_collaboration/
        └── codebase_scanner_service.py        # Service adapter
```

## Key Features

### 1. Unified Entry Point
- `main.py` works like `main.js`
- Auto-discovers apps in `pyapps/`
- Prompts for app selection if not specified
- Follows pattern: `pyapps/{appname}/{appname}_main.py`

### 2. Singleton Pattern
- Only one backend instance runs
- Multiple clients share the same backend
- Reduces resource consumption
- Faster startup for secondary instances

### 3. WebSocket RPC Communication
- No heavy frameworks (FastMCP, Flask, FastAPI removed)
- Uses lightweight WebSocket RPC
- Pure Python stdlib + websockets
- Bidirectional communication

### 4. All MCP Services Integrated
- All services accessible via single endpoint
- Consistent RPC interface
- Easy to add new services
- Centralized management

## Usage

### Start MCP Server

```bash
# Method 1: Using main.py (recommended)
python main.py --app=mcpserver

# Method 2: Direct execution
python pyapps/mcpserver/mcpserver_main.py

# Method 3: If no --app specified, you'll be prompted to select
python main.py
```

### First Instance (Primary)
```
✓ Started as PRIMARY instance (running MCP backend)

Role: PRIMARY (Backend Running)
RPC Server: ws://localhost:8767
Singleton Detection: localhost:19997
```

### Second Instance (Secondary)
```
✓ Started as SECONDARY instance (reusing MCP backend)

Role: SECONDARY (Client Only)
Connected to: ws://localhost:8767
```

### Test the Server

```bash
# Run test client
python pyapps/mcpserver/test_mcp_client.py
```

## Available Services

### System Services
- `system.health` - Get server health status
- `system.list_services` - List all available services
- `system.get_info` - Get server information

### Codebase Scanner
- `codebase.generate_tree` - Generate directory tree
- `codebase.find_file` - Find files by name/pattern
- `codebase.search_content` - Search content in files
- `codebase.get_stats` - Get codebase statistics

### File Processor
- `file.parse_document` - Parse various document formats
- `file.convert_document` - Convert between formats
- `file.ocr_recognize` - OCR recognition

### Image Generator
- `image.generate_placeholder` - Generate placeholder images
- `image.replace_placeholder` - Replace images
- `image.scan_directory` - Scan for placeholders

### Database Operations
- `db.execute_query` - Execute SQL query
- `db.list_tables` - List database tables
- `db.get_schema` - Get table schema

### AI Collaboration
- `ai.register_role` - Register AI role
- `ai.write_log` - Write work log
- `ai.ask_question` - Ask question to AI

## Example: Using from Python

```python
import asyncio
from pycore.pyutils.wsrpc import WsRpcClient

async def use_mcp():
    # Connect to MCP server
    client = WsRpcClient('ws://localhost:8767')
    await client.connect()

    # Generate directory tree
    result = await client.call('codebase.generate_tree', {
        'target_path': 'pycore',
        'max_depth': 3,
        'output_format': 'text'
    })

    print(result['tree_text'])

    # Find files
    result = await client.call('codebase.find_file', {
        'filename': '*.py',
        'max_results': 10
    })

    for file in result['results']:
        print(f"Found: {file['name']}")

    await client.disconnect()

asyncio.run(use_mcp())
```

## Configuration

### Ports
- Singleton Detection: `19997` (default)
- WebSocket RPC: `8767` (default)

### Change Ports
Edit `pyapps/mcpserver/mcpserver_main.py`:

```python
SINGLETON_PORT = 19997  # Change this
RPC_PORT = 8767         # Change this
```

## Adding New Services

### Step 1: Create Service Adapter

Create `ncore/mcp_server/your_service_service.py`:

```python
class YourServiceService:
    async def your_method(self, params: dict) -> dict:
        # Your implementation
        return {
            'success': True,
            'result': 'data'
        }
```

### Step 2: Register Routes

Edit `pyapps/mcpserver/mcpserver_main.py`, add routes in `_register_backend_routes()`:

```python
@self.rpc_server.route('yourservice.method')
async def yourservice_method(params):
    return await self._call_your_service('method', params)
```

### Step 3: Add Handler

Add handler method in `UnifiedMCPServer`:

```python
async def _call_your_service(self, method: str, params: dict) -> dict:
    # Load and call your service
    ...
```

That's it! Your service is now integrated.

## Benefits

### Resource Efficiency
| Metric | Traditional | Unified Singleton |
|--------|-------------|-------------------|
| Startup Time | 5s per instance | First: 5s, Others: 1s |
| Memory | 100MB per instance | First: 100MB, Others: 20MB |
| Processes | N instances | 1 backend + N clients |

### Development
- Single codebase for all MCP services
- Consistent API across services
- Easy testing and debugging
- Centralized logging

### Deployment
- One backend to manage
- Multiple clients can connect
- Easy to scale horizontally
- Simplified monitoring

## Comparison with Original

### Original Architecture
```
Each MCP Service:
- Separate process
- FastMCP framework
- Individual stdio communication
- Heavy dependencies (Flask, FastAPI, etc.)
- No resource sharing
```

### New Architecture
```
Unified MCP Server:
- Single backend process (singleton)
- WebSocket RPC communication
- Pure Python stdlib + websockets
- Resource sharing among clients
- Lightweight and efficient
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
netstat -ano | findstr :8767

# Or change port in mcpserver_main.py
RPC_PORT = 8768  # Use different port
```

### Connection Refused

1. Ensure server is running:
   ```bash
   python main.py --app=mcpserver
   ```

2. Check firewall settings

3. Try `127.0.0.1` instead of `localhost`

### Service Not Found

1. Check service is registered in `_register_backend_routes()`
2. Verify service adapter exists
3. Check imports in `mcpserver_main.py`

## Development

### Debug Mode

Enable debug output:

```python
# In mcpserver_main.py
DEBUG = True  # Already enabled by default
```

### Logs

Server logs are written to stderr and visible in console.

### Testing

Run comprehensive tests:

```bash
python pyapps/mcpserver/test_mcp_client.py
```

## Roadmap

### Phase 1 (Complete)
- ✅ Singleton pattern implementation
- ✅ WebSocket RPC integration
- ✅ Codebase scanner service
- ✅ Unified entry point (main.py)

### Phase 2 (In Progress)
- 🔄 File processor service
- 🔄 Image generator service
- 🔄 Database operations
- 🔄 AI collaboration service

### Phase 3 (Planned)
- 📋 Service auto-discovery
- 📋 Hot reload support
- 📋 Plugin system
- 📋 Web-based admin panel

## License

Same as parent project.

## Contributing

To add a new MCP service:

1. Create service adapter in `ncore/mcp_server/`
2. Register routes in `mcpserver_main.py`
3. Add tests in `test_mcp_client.py`
4. Update this README

---

**Status**: ✅ Phase 1 Complete
**Version**: 1.0.0
**Last Updated**: 2025-11-07
