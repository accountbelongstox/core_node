# Quick Reference - Python MCP Server

## Start Server

```bash
# Method 1: Via main.py (recommended)
python main.py --app=mcpserver

# Method 2: Direct
python pyapps/mcpserver/mcpserver_main.py

# Method 3: Interactive selection
python main.py
```

## Test Server

```bash
python pyapps/mcpserver/test_mcp_client.py
```

## File Locations

```
core_node/
├── main.py                                  # Root entry point
├── pyapps/mcpserver/
│   ├── mcpserver_main.py                   # MCP server
│   ├── test_mcp_client.py                  # Test client
│   └── README.md                            # Full docs
└── ncore/mcp_server/
    └── codebase_scanner_service.py          # Service adapter
```

## Available Services

### System
- `system.health` - Server health
- `system.list_services` - List all services
- `system.get_info` - Server info

### Codebase Scanner
- `codebase.generate_tree` - Directory tree
- `codebase.find_file` - Find files
- `codebase.search_content` - Search in files
- `codebase.get_stats` - Statistics

## Quick Examples

### Python Client

```python
from pycore.pyutils.wsrpc import WsRpcClient

client = WsRpcClient('ws://localhost:8767')
await client.connect()

# Generate tree
result = await client.call('codebase.generate_tree', {
    'target_path': 'pycore',
    'max_depth': 3
})

# Find files
result = await client.call('codebase.find_file', {
    'filename': '*.py'
})

await client.disconnect()
```

### Check Status

```python
result = await client.call('system.health', {})
print(f"Status: {result['status']}")
print(f"Clients: {result['clients_connected']}")
```

## Ports

- Singleton Detection: `19997`
- WebSocket RPC: `8767`

## Architecture

```
Primary Instance:
  ├─ WebSocket RPC Server (8767)
  └─ All MCP Services

Secondary Instances:
  └─ Connect to Primary (8767)
```

## Add New Service

1. Create `ncore/mcp_server/your_service_service.py`
2. Add routes in `mcpserver_main.py`
3. Done!

## Troubleshooting

**Port in use?**
```bash
netstat -ano | findstr :8767
```

**Can't connect?**
- Check server is running
- Try `127.0.0.1` instead of `localhost`
- Check firewall

**Service not found?**
- Check route is registered
- Verify service adapter exists
- Check imports

## Documentation

- Full docs: `pyapps/mcpserver/README.md`
- Summary: `PYTHON_MCP_REFACTORING_SUMMARY.md`
- This guide: `QUICK_REFERENCE.md`

---

**Status**: ✅ Production Ready
**Version**: 1.0.0
