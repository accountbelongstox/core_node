# pyutils.rpc_v2 - FastAPI-based RPC Stack

## Overview

The `rpc_v2` module provides a FastAPI-based RPC stack with service discovery, protocol negotiation, address management, and shared state tables. It mirrors the public API of the original `rpc` module for seamless migration.

## Module Location

```
pycore/pyutils/rpc_v2/
├── __init__.py
├── config.py                   # RPCConfig, RPC_CONSTANTS
├── common/
│   ├── event_cache.py          # EventCache
│   ├── request_manager.py      # RequestManager
│   ├── inventory_table.py      # InventoryTable
│   └── request_event_table.py  # RequestEventTable
├── server/
│   └── fastapi_server.py       # FastAPIRPCServer
├── address.py                  # RPCAddressProvider
├── discovery.py                # RPCDiscovery, NetworkScanner
└── protocol.py                 # Protocol definitions
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    RPC v2 Architecture                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FastAPIRPCServer                        │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐ │   │
│  │  │  HTTP    │ │WebSocket │ │     Routes           │ │   │
│  │  │  Routes  │ │  Handler │ │  (custom handlers)   │ │   │
│  │  └──────────┘ └──────────┘ └──────────────────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Shared State Tables                     │   │
│  │  ┌────────────┐ ┌─────────────┐ ┌────────────────┐  │   │
│  │  │ EventCache │ │RequestEvent │ │InventoryTable │  │   │
│  │  │            │ │   Table     │ │               │  │   │
│  │  └────────────┘ └─────────────┘ └────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                            │                                │
│                            ▼                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Discovery & Protocol                    │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌───────────────┐  │   │
│  │  │RPCDiscovery │ │NetworkScanner│ │RPCAddressProvid│  │   │
│  │  └─────────────┘ └─────────────┘ └───────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### RPCConfig

Configuration management:

```python
from pycore.pyutils.rpc_v2 import RPCConfig, get_rpc_config, RPC_CONSTANTS

# Get default config
config = get_rpc_config()

# Custom config
config = RPCConfig(
    host="0.0.0.0",
    port=58100,
    enable_discovery=True,
    enable_websocket=True,
    cors_origins=["*"],
    max_connections=100,
    request_timeout=30
)

# Constants
print(RPC_CONSTANTS.DEFAULT_PORT)  # 58100
print(RPC_CONSTANTS.DISCOVERY_PORT)  # 58101
```

### FastAPIRPCServer

Main RPC server:

```python
from pycore.pyutils.rpc_v2 import FastAPIRPCServer, FastAPIRPCServerRunner

# Create server
server = FastAPIRPCServer(
    host="0.0.0.0",
    port=58100,
    enable_discovery=True
)

# Add route (sync handler)
@server.route("echo")
def echo_handler(data: dict) -> dict:
    return {"echo": data}

# Add route (async handler)
@server.route("async_echo")
async def async_echo_handler(data: dict) -> dict:
    await asyncio.sleep(0.1)
    return {"echo": data}

# Add route with options
server.route("protected", auth_required=True)(protected_handler)

# Start server
await server.start()

# Or use runner for blocking start
runner = FastAPIRPCServerRunner(server)
runner.run()  # Blocks until stopped
```

**Server Methods:**

```python
class FastAPIRPCServer:
    def route(
        self,
        name: str,
        sync: bool = True,
        auth_required: bool = False
    ) -> Callable:
        """Decorator to register route handler"""
    
    async def start(self):
        """Start server (non-blocking)"""
    
    async def stop(self):
        """Stop server"""
    
    def get_routes(self) -> List[str]:
        """Get registered routes"""
    
    def get_status(self) -> dict:
        """Get server status"""
```

### EventCache

Event caching:

```python
from pycore.pyutils.rpc_v2 import EventCache, default_event_cache

# Get default cache
cache = default_event_cache

# Or create new
cache = EventCache(max_size=1000, ttl=3600)

# Store event
cache.set("event_id", {"type": "click", "x": 100, "y": 200})

# Get event
event = cache.get("event_id")

# Check existence
exists = cache.exists("event_id")

# Delete event
cache.delete("event_id")

# Clear all
cache.clear()

# Get stats
stats = cache.get_stats()
```

### RequestManager

Request tracking:

```python
from pycore.pyutils.rpc_v2 import RequestManager, default_request_manager

manager = default_request_manager

# Create request
request_id = manager.create_request(
    route="echo",
    data={"message": "hello"},
    timeout=30
)

# Get request status
status = manager.get_status(request_id)

# Wait for response
response = await manager.wait_for_response(request_id, timeout=30)

# Complete request
manager.complete_request(request_id, result={"success": True})

# Fail request
manager.fail_request(request_id, error="Timeout")

# Cancel request
manager.cancel_request(request_id)
```

### InventoryTable

Service inventory:

```python
from pycore.pyutils.rpc_v2 import InventoryTable, InventoryItem, default_inventory_table

table = default_inventory_table

# Register service
item = InventoryItem(
    service_id="service_001",
    name="my_service",
    host="192.168.1.100",
    port=58100,
    routes=["echo", "status"],
    metadata={"version": "1.0"}
)
table.register(item)

# Get service
service = table.get("service_001")

# Find by name
services = table.find_by_name("my_service")

# List all services
all_services = table.list_all()

# Unregister
table.unregister("service_001")

# Heartbeat update
table.heartbeat("service_001")
```

### RequestEventTable

Request event tracking:

```python
from pycore.pyutils.rpc_v2 import (
    RequestEventTable, 
    RequestEvent, 
    RequestStatus,
    default_request_event_table
)

table = default_request_event_table

# Create event
event = RequestEvent(
    request_id="req_001",
    route="echo",
    status=RequestStatus.PENDING,
    created_at=time.time()
)
table.add(event)

# Update status
table.update_status("req_001", RequestStatus.COMPLETED)

# Get event
event = table.get("req_001")

# Get pending events
pending = table.get_by_status(RequestStatus.PENDING)

# Clean old events
table.cleanup(max_age=3600)
```

### RPCDiscovery

Service discovery:

```python
from pycore.pyutils.rpc_v2 import (
    RPCDiscovery,
    DiscoveredRPCService,
    get_local_lan_ip
)

discovery = RPCDiscovery(
    port=58101,
    broadcast_interval=5
)

# Start discovery service
await discovery.start()

# Discover services
services = await discovery.discover(timeout=5)
for service in services:
    print(f"Found: {service.name} at {service.host}:{service.port}")

# Register self
await discovery.register_self(
    name="my_service",
    port=58100,
    routes=["echo", "status"]
)

# Stop
await discovery.stop()

# Get local IP
local_ip = get_local_lan_ip()
print(f"Local IP: {local_ip}")
```

### NetworkScanner

Network scanning:

```python
from pycore.pyutils.rpc_v2 import NetworkScanner, NetworkHost

scanner = NetworkScanner()

# Scan network
hosts = await scanner.scan_network(
    ip_range="192.168.1.0/24",
    port=58100,
    timeout=2
)

for host in hosts:
    print(f"Host: {host.ip}:{host.port} - {host.name}")

# Check single host
is_alive = await scanner.check_host("192.168.1.100", port=58100)
```

### RPCAddressProvider

Address management:

```python
from pycore.pyutils.rpc_v2 import RPCAddressProvider, RPCAddress

provider = RPCAddressProvider()

# Register address
provider.register(RPCAddress(
    name="main_server",
    host="192.168.1.100",
    port=58100,
    protocol="http"
))

# Get address
addr = provider.get("main_server")
print(f"URL: {addr.url}")

# Get all addresses
addresses = provider.get_all()

# Remove address
provider.remove("main_server")
```

### Protocol Client

RPC protocol client:

```python
from pycore.pyutils.rpc_v2 import RPCProtocolClient

client = RPCProtocolClient(
    base_url="http://192.168.1.100:58100"
)

# Call RPC method
result = await client.call("echo", {"message": "hello"})

# Get service status
status = await client.get_status()

# Get service info
info = await client.get_info()

# Sync protocol version
await client.sync_protocol()
```

## Usage Examples

### Basic Server

```python
from pycore.pyutils.rpc_v2 import FastAPIRPCServer
import asyncio

async def main():
    server = FastAPIRPCServer(port=58100)
    
    @server.route("echo")
    def echo(data: dict) -> dict:
        return {"echo": data}
    
    @server.route("add")
    def add(data: dict) -> dict:
        a = data.get("a", 0)
        b = data.get("b", 0)
        return {"result": a + b}
    
    await server.start()
    
    # Keep running
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        await server.stop()

asyncio.run(main())
```

### With Discovery

```python
from pycore.pyutils.rpc_v2 import FastAPIRPCServer, RPCDiscovery
import asyncio

async def main():
    # Start server
    server = FastAPIRPCServer(port=58100)
    
    @server.route("status")
    def status(data: dict) -> dict:
        return {"status": "ok"}
    
    await server.start()
    
    # Start discovery
    discovery = RPCDiscovery()
    await discovery.start()
    await discovery.register_self(
        name="my_service",
        port=58100,
        routes=["status"]
    )
    
    # Wait
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        await discovery.stop()
        await server.stop()

asyncio.run(main())
```

### Client Usage

```python
from pycore.pyutils.rpc_v2 import RPCProtocolClient
import asyncio

async def main():
    client = RPCProtocolClient("http://localhost:58100")
    
    # Call echo
    result = await client.call("echo", {"message": "hello"})
    print(f"Echo: {result}")
    
    # Call add
    result = await client.call("add", {"a": 5, "b": 3})
    print(f"Add: {result}")

asyncio.run(main())
```

## Protocol Paths

```python
RPC_PROTOCOL_VERSION = "2.0"
RPC_STATUS_PATH = "/_rpc/status"
RPC_INFO_PATH = "/_rpc/info"
RPC_ADDRESSES_PATH = "/_rpc/addresses"
RPC_PROTOCOL_SYNC_PATH = "/_rpc/protocol/sync"
```

## Best Practices

1. **Use Discovery**: Enable discovery for dynamic service registration

2. **Set Timeouts**: Configure appropriate request timeouts

3. **Handle Errors**: Implement error handlers for failed requests

4. **Monitor Status**: Use status endpoints for health checks

5. **Clean Up**: Call stop() on shutdown

## Related Modules

- `pycore.pyutils.rpc` - Original RPC implementation
- `pycore.pyutils.wsrpc` - WebSocket RPC
- `pycore.pylauncher` - Service launcher

## Exports

```python
__all__ = [
    # Config
    "RPC_CONSTANTS", "RPCConfig", "get_rpc_config",
    
    # Common tables
    "EventCache", "default_event_cache",
    "RequestManager", "default_request_manager",
    "InventoryTable", "InventoryItem", "default_inventory_table",
    "RequestEventTable", "RequestEvent", "RequestStatus", 
    "default_request_event_table",
    
    # Server
    "FastAPIRPCServer", "FastAPIRPCServerRunner",
    
    # Discovery
    "RPCDiscovery", "DiscoveredRPCService",
    "NetworkScanner", "NetworkHost",
    "get_local_lan_ip", "confirm_local_lan_ip",
    "RPCAddressProvider", "RPCAddress",
    
    # Protocol
    "RPC_PROTOCOL_VERSION", "RPC_STATUS_PATH", "RPC_INFO_PATH",
    "RPC_ADDRESSES_PATH", "RPC_PROTOCOL_SYNC_PATH",
    "RPCServiceInfo", "RPCAddressResponse",
    "RPCProtocolClient", "RPCProtocolServer",
]
```



