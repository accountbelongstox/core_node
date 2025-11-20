# WsRpc Threading Package

Native `threading.Thread` implementation of WebSocket RPC framework

## Overview

Native thread-based WebSocket RPC implementation based on `SeleniumThread` pattern, providing:

- **WsRpcServerThread** - RPC server thread
- **WsRpcClientThread** - RPC client thread
- **SingletonRpcBackendThread** - Singleton RPC backend thread

## Features

### ✅ Native Thread Mode
- Inherits `threading.Thread`
- Call `thread.start()` to start
- Built-in asyncio event loop management

### ✅ Parameterized Configuration
- All parameters passed through `__init__`
- Support custom thread name, daemon mode
- Flexible port and host configuration

### ✅ Graceful Lifecycle Management
- `start()` - Start thread
- `stop()` - Graceful stop
- `is_running()` - Status query

### ✅ Thread-Safe RPC Calls
- Blocking `call()` method
- Automatic cross-thread communication handling
- Timeout control

## Quick Start

### 1. Basic Server-Client

```python
from pycore.pyutils.wsrpc.threads import WsRpcServerThread, WsRpcClientThread
import time

# Create server thread
server = WsRpcServerThread(
    host='localhost',
    port=8765,
    thread_name='RpcServer'
)

# Register routes (before starting)
@server.route('echo')
async def echo(params):
    return {'message': params.get('text')}

# Start server
server.start()

# Create client thread
client = WsRpcClientThread(
    url='ws://localhost:8765',
    auto_connect=True,
    thread_name='RpcClient'
)

# Start client
client.start()

# Wait for connection
time.sleep(1)

# Call RPC method (blocking, thread-safe)
result = client.call('echo', {'text': 'hello'}, timeout=5.0)
print(result)  # {'message': 'hello'}

# Stop
client.stop()
server.stop()
```

### 2. Singleton Backend Mode

```python
from pycore.pyutils.wsrpc.threads import SingletonRpcBackendThread

# Create singleton backend
backend = SingletonRpcBackendThread(
    singleton_port=19999,  # Instance detection port
    rpc_port=8765,         # RPC communication port
    thread_name='Backend'
)

# Register routes (only valid for primary instance)
@backend.route('process')
async def process(params):
    return {'result': 'processed'}

# Start
backend.start()

# Check instance type
if backend.is_primary():
    print("Primary instance - Running RPC server")
else:
    print("Secondary instance - Connecting to existing server")

# Call RPC (all instances can call)
result = backend.call('process', {'data': 'test'})

# Stop
backend.stop()
```

## API Reference

### WsRpcServerThread

#### Constructor

```python
WsRpcServerThread(
    host: str = 'localhost',
    port: int = 8765,
    options: Optional[Dict] = None,
    debug: bool = False,
    thread_name: str = 'WsRpcServerThread',
    daemon: bool = True
)
```

**Parameters:**
- `host` - Server address
- `port` - Server port
- `options` - Additional configuration (passed to WsRpcServer)
- `debug` - Debug mode
- `thread_name` - Thread name
- `daemon` - Daemon thread mode

#### Methods

**`start()`**
Start server thread.

**`stop(timeout: float = 5.0)`**
Gracefully stop server.

**`route(path: str)`**
Register RPC route (decorator).

```python
@server.route('echo')
async def echo(params):
    return {'message': params.get('text')}
```

**`on(event: str)`**
Register event handler (decorator).

```python
@server.on('client_connected')
async def on_connected(data):
    print(f"Client connected: {data}")
```

**`broadcast(event: str, data: Any)`**
Broadcast event to all clients.

**`is_running() -> bool`**
Check if server is running.

**`get_status() -> Dict`**
Get server status.

### WsRpcClientThread

#### Constructor

```python
WsRpcClientThread(
    url: str = 'ws://localhost:8765',
    options: Optional[Dict] = None,
    auto_connect: bool = True,
    auto_reconnect: bool = True,
    debug: bool = False,
    thread_name: str = 'WsRpcClientThread',
    daemon: bool = True
)
```

**Parameters:**
- `url` - WebSocket server URL
- `options` - Additional configuration
- `auto_connect` - Auto-connect on start
- `auto_reconnect` - Auto-reconnect
- `debug` - Debug mode
- `thread_name` - Thread name
- `daemon` - Daemon thread mode

#### Methods

**`start()`**
Start client thread.

**`stop(timeout: float = 5.0)`**
Gracefully stop client.

**`call(route: str, params: Optional[Dict] = None, timeout: float = 10.0) -> Any`**
Call RPC method (blocking, thread-safe).

```python
result = client.call('echo', {'text': 'hello'}, timeout=5.0)
```

**`emit(event: str, data: Any)`**
Send event to server (non-blocking).

**`on(event: str)`**
Register event handler (decorator).

```python
@client.on('connected')
async def on_connected(data):
    print("Connected!")
```

**`connect(timeout: float = 10.0)`**
Manually connect to server (blocking).

**`disconnect(timeout: float = 5.0)`**
Disconnect (blocking).

**`is_running() -> bool`**
Check if client is running.

**`is_connected() -> bool`**
Check if connected.

**`get_status() -> Dict`**
Get client status.

### SingletonRpcBackendThread

#### Constructor

```python
SingletonRpcBackendThread(
    singleton_host: str = 'localhost',
    singleton_port: int = 19999,
    rpc_host: str = 'localhost',
    rpc_port: int = 8765,
    debug: bool = False,
    thread_name: str = 'SingletonRpcBackend',
    daemon: bool = True
)
```

**Parameters:**
- `singleton_host` - Singleton detection host
- `singleton_port` - Singleton detection port
- `rpc_host` - RPC server host
- `rpc_port` - RPC server port
- `debug` - Debug mode
- `thread_name` - Thread name
- `daemon` - Daemon thread mode

#### Methods

**`start()`**
Start backend thread (automatically detect primary/secondary instance).

**`stop(timeout: float = 5.0)`**
Gracefully stop backend.

**`route(path: str)`**
Register RPC route (only valid for primary instance).

**`call(route: str, params: Optional[Dict] = None, timeout: float = 10.0) -> Any`**
Call RPC method (all instances can call).

**`emit(event: str, data: Any)`**
Send event.

**`broadcast(event: str, data: Any)`**
Broadcast event (only valid for primary instance).

**`is_primary() -> bool`**
Check if primary instance.

**`is_running() -> bool`**
Check if running.

**`get_status() -> Dict`**
Get backend status.

## Usage Examples

### Example 1: Basic Communication

```bash
cd D:\programing\core_node
python -m pycore.pyutils.wsrpc.threads.example_basic
```

### Example 2: Singleton Mode

```bash
# Terminal 1 - Start primary instance
python -m pycore.pyutils.wsrpc.threads.example_singleton

# Terminal 2 - Start secondary instance
python -m pycore.pyutils.wsrpc.threads.example_singleton
```

## Design Pattern

### Native Thread Inheritance Pattern (SeleniumThread Style)

```python
class WsRpcServerThread(threading.Thread):
    def __init__(self, host, port, thread_name, daemon):
        # Initialize threading.Thread
        threading.Thread.__init__(self, name=thread_name, daemon=daemon)

        # Store parameters
        self.host = host
        self.port = port

    def run(self):
        """Thread entry point - automatically called"""
        # Create event loop
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)

        # Run server
        self._loop.run_until_complete(self._run_server())
```

### Startup Method

```python
# Create thread instance
thread = WsRpcServerThread(host='localhost', port=8765)

# Register routes (optional)
@thread.route('echo')
async def echo(params):
    return params

# Start thread (non-blocking)
thread.start()

# Wait for completion or manually stop
thread.join()  # or
thread.stop()
```

## Comparison with Original wsrpc

### Original Version (Non-Thread)

```python
# Need to manually manage event loop
loop = asyncio.get_event_loop()
server = WsRpcServer({'port': 8765})
loop.run_until_complete(server.start())
```

### Thread Version (Native Thread)

```python
# Thread automatically manages event loop
server = WsRpcServerThread(port=8765)
server.start()  # Automatically runs in independent thread
```

## Notes

1. **Route Registration Timing**
   - Must register routes before `start()`
   - Routes registered after startup are invalid

2. **Thread Safety**
   - `call()` method is thread-safe (blocking)
   - `emit()` and `broadcast()` are non-blocking

3. **Event Loop**
   - Each thread has independent asyncio event loop
   - Do not access thread's internal event loop from outside

4. **Graceful Stop**
   - Always call `stop()` instead of force termination
   - Set appropriate timeout parameter

5. **Singleton Mode**
   - Singleton detection based on port binding
   - Ensure singleton_port is unique

## Version Information

- Version: 1.0.0
- Based on: SeleniumThread pattern
- Compatible: Python 3.7+
