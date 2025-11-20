# PyWSRPC - Python WebSocket RPC Framework

A lightweight, bidirectional RPC framework over WebSocket for Python with advanced features.

## Features

- ✅ **Bidirectional Communication**: Server and client can call each other's functions
- ✅ **Async/Await Support**: Built on asyncio for high performance
- ✅ **Authentication & Authorization**: Token-based auth with custom handlers
- ✅ **Rate Limiting**: Prevent request flooding
- ✅ **Performance Monitoring**: Track request latency and success rates
- ✅ **Heartbeat Mechanism**: Automatic connection health monitoring
- ✅ **Middleware Support**: Request/response processing pipeline
- ✅ **Interceptors**: Modify requests and responses
- ✅ **Message Compression**: Automatic compression for large messages
- ✅ **Namespace & Rooms**: Group-based broadcasting
- ✅ **Auto Reconnection**: Built-in reconnection mechanism
- ✅ **Event System**: Pub/Sub event broadcasting

## Installation

```bash
pip install websockets
```

## Quick Start

### Server

```python
import asyncio
from pycore.pyutils.wsrpc import WsRpcServer

async def echo_handler(params, client_id, context):
    return {'message': params.get('message')}

async def main():
    server = WsRpcServer({'port': 8080})
    server.route('echo', echo_handler)
    await server.start()

    # Keep server running
    await asyncio.Future()

asyncio.run(main())
```

### Client

```python
import asyncio
from pycore.pyutils.wsrpc import WsRpcClient

async def main():
    client = WsRpcClient('ws://localhost:8080')
    await client.connect()

    result = await client.call('echo', {'message': 'Hello'})
    print(result)

asyncio.run(main())
```

## Advanced Usage

### Authentication

```python
# Server
async def auth_handler(credentials):
    if credentials['username'] == 'admin':
        return {'success': True, 'user': {'role': 'admin'}}
    return {'success': False}

server = WsRpcServer({
    'auth': {
        'enabled': True,
        'handler': auth_handler
    }
})

# Client
await client.authenticate({'username': 'admin', 'password': 'secret'})
```

### Middleware

```python
async def logging_middleware(context, next_fn):
    print(f"Request: {context['route']}")
    result = await next_fn()
    print(f"Response: {result}")
    return result

server.use(logging_middleware)
```

### Namespaces & Rooms

```python
# Server
server.create_namespace('chat')
await server.broadcast_to_room('general', message, 'chat')

# Client
client.subscribe('chat', 'general')
```

### Performance Monitoring

```python
stats = server.get_all_stats()
print(f"Success rate: {stats['performance']['success_rate']}%")
print(f"Avg latency: {stats['performance']['avg_duration']}ms")
```

## API Reference

### WsRpcServer

#### Methods

- `start()` - Start the WebSocket server
- `stop()` - Stop the server
- `route(name, handler)` - Register a route handler
- `on(event, handler)` - Register an event handler
- `use(middleware)` - Add middleware
- `call_client(route, params, client_id)` - Call client route
- `broadcast(message)` - Broadcast to all clients
- `create_namespace(name)` - Create a namespace
- `get_all_stats()` - Get server statistics

### WsRpcClient

#### Methods

- `connect()` - Connect to server
- `disconnect()` - Disconnect from server
- `authenticate(credentials)` - Authenticate with server
- `route(name, handler)` - Register a route handler
- `on(event, handler)` - Register an event handler
- `call(route, params)` - Call server route
- `emit(event, data)` - Emit event to server
- `subscribe(namespace, room)` - Subscribe to namespace/room
- `is_connected()` - Check connection status

## Examples

See the `examples/` directory for complete examples:

- `server_example.py` - Full-featured server with auth, middleware, and monitoring
- `client_example.py` - Client with authentication and event handling

## Architecture

```
pycore/pywsrpc/
├── __init__.py
├── ws_rpc_server.py       # Main server
├── ws_rpc_client.py       # Main client
├── libs/                  # Core libraries
│   ├── heartbeat_manager.py
│   ├── middleware_chain.py
│   ├── auth_manager.py
│   ├── rate_limiter.py
│   ├── performance_monitor.py
│   ├── namespace_manager.py
│   ├── message_compressor.py
│   └── interceptor_manager.py
└── examples/              # Example code
```

## License

MIT License

## Author

ncore team
