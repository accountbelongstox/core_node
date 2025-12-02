# pyutils.wsrpc - WebSocket RPC Framework

## Overview

The `wsrpc` module provides a lightweight, bidirectional RPC framework over WebSocket for Python. It includes extensions for singleton instance detection and management.

## Module Location

```
pycore/pyutils/wsrpc/
├── __init__.py
├── ws_rpc_server.py        # WsRpcServer
├── ws_rpc_client.py        # WsRpcClient
├── singleton_backend.py    # SingletonBackendDetector
└── singleton_rpc_backend.py # SingletonRpcBackend
```

## Core Components

### WsRpcServer

WebSocket RPC server:

```python
from pycore.pyutils.wsrpc import WsRpcServer

server = WsRpcServer(
    host="0.0.0.0",
    port=58200
)

# Register handler
@server.handler("echo")
async def echo_handler(data: dict) -> dict:
    return {"echo": data}

@server.handler("add")
async def add_handler(data: dict) -> dict:
    return {"result": data["a"] + data["b"]}

# Start server
await server.start()

# Stop server
await server.stop()
```

**Methods:**

```python
class WsRpcServer:
    def handler(self, name: str) -> Callable:
        """Decorator to register RPC handler"""
    
    async def start(self):
        """Start WebSocket server"""
    
    async def stop(self):
        """Stop server"""
    
    async def broadcast(self, event: str, data: dict):
        """Broadcast message to all clients"""
    
    async def send_to(self, client_id: str, event: str, data: dict):
        """Send message to specific client"""
    
    def get_clients(self) -> List[str]:
        """Get connected client IDs"""
    
    def get_status(self) -> dict:
        """Get server status"""
```

### WsRpcClient

WebSocket RPC client:

```python
from pycore.pyutils.wsrpc import WsRpcClient

client = WsRpcClient(url="ws://localhost:58200")

# Connect
await client.connect()

# Call RPC method
result = await client.call("echo", {"message": "hello"})
print(f"Result: {result}")

# Subscribe to events
@client.on("notification")
async def on_notification(data: dict):
    print(f"Notification: {data}")

# Disconnect
await client.disconnect()
```

**Methods:**

```python
class WsRpcClient:
    async def connect(self):
        """Connect to server"""
    
    async def disconnect(self):
        """Disconnect from server"""
    
    async def call(
        self, 
        method: str, 
        data: dict = None,
        timeout: float = 30
    ) -> dict:
        """Call RPC method and wait for response"""
    
    async def send(self, event: str, data: dict):
        """Send message without waiting for response"""
    
    def on(self, event: str) -> Callable:
        """Decorator to register event handler"""
    
    def is_connected(self) -> bool:
        """Check connection status"""
```

### SingletonBackendDetector

Singleton instance detection:

```python
from pycore.pyutils.wsrpc import (
    SingletonBackendDetector,
    send_shutdown_signal,
    get_instance_status
)

detector = SingletonBackendDetector(
    app_id="my_app",
    port_start=58300,
    port_range=10
)

# Check for existing instance
result = detector.detect()

if result.found:
    print(f"Existing instance at port {result.port}")
    
    # Get status
    status = get_instance_status(result.port)
    print(f"Status: {status}")
    
    # Send shutdown
    send_shutdown_signal(result.port)
else:
    # Bind to port
    port = detector.bind()
    print(f"Bound to port {port}")
```

### SingletonRpcBackend

Combined singleton + RPC backend:

```python
from pycore.pyutils.wsrpc import SingletonRpcBackend

backend = SingletonRpcBackend(
    app_id="my_app",
    port_start=58300,
    shutdown_existing=True
)

# Register handlers
@backend.handler("status")
async def status_handler(data: dict) -> dict:
    return {"status": "running", "uptime": backend.uptime}

@backend.handler("config")
async def config_handler(data: dict) -> dict:
    return {"config": backend.config}

# Start (handles singleton detection automatically)
await backend.start()

# Access RPC server
server = backend.server

# Stop
await backend.stop()
```

## Usage Examples

### Basic Server-Client

**Server:**
```python
from pycore.pyutils.wsrpc import WsRpcServer
import asyncio

async def main():
    server = WsRpcServer(port=58200)
    
    @server.handler("greet")
    async def greet(data: dict) -> dict:
        name = data.get("name", "World")
        return {"greeting": f"Hello, {name}!"}
    
    await server.start()
    
    print("Server running on ws://localhost:58200")
    
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        await server.stop()

asyncio.run(main())
```

**Client:**
```python
from pycore.pyutils.wsrpc import WsRpcClient
import asyncio

async def main():
    client = WsRpcClient("ws://localhost:58200")
    await client.connect()
    
    result = await client.call("greet", {"name": "Alice"})
    print(result["greeting"])  # Hello, Alice!
    
    await client.disconnect()

asyncio.run(main())
```

### Broadcast Messages

```python
from pycore.pyutils.wsrpc import WsRpcServer
import asyncio

server = WsRpcServer(port=58200)

async def broadcast_time():
    while True:
        await asyncio.sleep(5)
        await server.broadcast("time", {
            "timestamp": time.time()
        })

@server.handler("subscribe")
async def subscribe(data: dict) -> dict:
    return {"subscribed": True}

async def main():
    await server.start()
    asyncio.create_task(broadcast_time())
    
    while True:
        await asyncio.sleep(1)

asyncio.run(main())
```

### Event Handling

```python
from pycore.pyutils.wsrpc import WsRpcClient
import asyncio

client = WsRpcClient("ws://localhost:58200")

@client.on("notification")
async def on_notification(data: dict):
    print(f"Notification: {data['message']}")

@client.on("time")
async def on_time(data: dict):
    print(f"Server time: {data['timestamp']}")

async def main():
    await client.connect()
    
    # Subscribe
    await client.call("subscribe", {})
    
    # Keep receiving events
    while True:
        await asyncio.sleep(1)

asyncio.run(main())
```

### Singleton Application

```python
from pycore.pyutils.wsrpc import SingletonRpcBackend
import asyncio

async def main():
    backend = SingletonRpcBackend(
        app_id="my_singleton_app",
        port_start=58300,
        shutdown_existing=True
    )
    
    @backend.handler("status")
    async def status(data: dict) -> dict:
        return {
            "status": "running",
            "uptime": backend.uptime,
            "requests": backend.request_count
        }
    
    @backend.handler("shutdown")
    async def shutdown(data: dict) -> dict:
        asyncio.create_task(backend.stop())
        return {"shutting_down": True}
    
    await backend.start()
    print(f"Backend running on port {backend.port}")
    
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        await backend.stop()

asyncio.run(main())
```

## Protocol Format

### Request

```json
{
    "jsonrpc": "2.0",
    "method": "echo",
    "params": {"message": "hello"},
    "id": "uuid-12345"
}
```

### Response

```json
{
    "jsonrpc": "2.0",
    "result": {"echo": {"message": "hello"}},
    "id": "uuid-12345"
}
```

### Error Response

```json
{
    "jsonrpc": "2.0",
    "error": {
        "code": -32600,
        "message": "Invalid Request"
    },
    "id": "uuid-12345"
}
```

### Notification (no id)

```json
{
    "jsonrpc": "2.0",
    "method": "notification",
    "params": {"event": "data"}
}
```

## Error Codes

| Code | Message |
|------|---------|
| -32700 | Parse error |
| -32600 | Invalid Request |
| -32601 | Method not found |
| -32602 | Invalid params |
| -32603 | Internal error |

## Best Practices

1. **Use Singleton for Apps**: SingletonRpcBackend ensures single instance

2. **Handle Disconnections**: Implement reconnection logic in clients

3. **Set Timeouts**: Use timeout parameter in call() method

4. **Broadcast Sparingly**: Limit broadcast frequency to avoid overhead

5. **Clean Shutdown**: Always call stop() before exit

## Related Modules

- `pycore.pyutils.rpc_v2` - HTTP+WebSocket RPC
- `pycore.pylauncher` - Singleton detection
- `pycore.pyheartbeat` - Task scheduling

## Exports

```python
__all__ = [
    'WsRpcServer',
    'WsRpcClient',
    'SingletonBackendDetector',
    'SingletonRpcBackend',
    'send_shutdown_signal',
    'get_instance_status'
]

__version__ = '1.0.1'
```





