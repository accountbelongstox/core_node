# MCP Server Services

Services for the MCP Server application.

## Address Service

The first MCP service that discovers MCP servers on the local network and exposes them via FastMCP for AI tools.

### Features

- **Network Scanning**: Automatically scans local network for MCP servers
- **Address Mapping**: Maps discovered servers to WebSocket addresses
- **WebSocket Connection**: Connects to discovered servers via WebSocket
- **FastMCP Integration**: Exposes server information and APIs through FastMCP tools

### Architecture

```
AddressMapper (pycore/pyutils/mcp)
    ↓
    Scans network → Discovers MCP servers → Maps to WebSocket URLs
    ↓
AddressService (pyapps/mcpserver/service)
    ↓
    Uses AddressMapper → Connects via WebSocket → Exposes via FastMCP
    ↓
AI Tools (via FastMCP)
```

### Usage

The service is automatically initialized when the MCP Server application starts:

```python
from pyapps.mcpserver.service.address_service import AddressService

# Service is initialized in mcpserver_main.py
service = AddressService(debug=True)
service.start()
```

### FastMCP Tools

The service provides the following FastMCP tools for AI tools:

1. **scan_network_addresses(quick: bool = False)**
   - Scans local network and discovers MCP servers
   - Returns JSON with discovered addresses

2. **get_network_addresses()**
   - Gets all currently mapped network addresses
   - Returns JSON with all mapped addresses

3. **connect_to_server(host: str, port: int = 8767)**
   - Connects to an MCP server via WebSocket
   - Returns connection status

4. **query_server_api(host: str, port: int = 8767, query: str = "")**
   - Queries an MCP server API via WebSocket
   - Returns API response

### Example

```python
# Scan network
addresses = service.address_mapper.scan_and_map(quick=True)

# Get WebSocket URL
ws_url = service.address_mapper.get_websocket_url("192.168.1.100", 8767)

# Connect and query
result = service.query_server_api("192.168.1.100", 8767, "get_status")
```

### Dependencies

- `pycore.pyutils.mcp`: Network scanner and address mapper
- `websockets`: WebSocket client library
- `mcp.server.fastmcp`: FastMCP framework (optional, for AI tool integration)

