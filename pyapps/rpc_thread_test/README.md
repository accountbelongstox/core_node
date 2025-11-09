# RPC Thread Test Application

Demonstrates how to start RPC as an independent thread with dynamic configuration.

## Overview

This application demonstrates:

1. **Configuration-based thread startup** - Load settings from JSON file
2. **Configuration overrides** - Dynamic port allocation and runtime adjustments
3. **Controller-based routing** - Clean separation of route definitions
4. **Independent thread execution** - RPC server runs in dedicated thread
5. **7 API routes** - Comprehensive route examples

## Quick Start

### Start the RPC Server

```bash
cd D:\programing\core_node
python pymain.py app=rpc_thread_test
```

**Expected Output:**
```
============================================================
 RPC Thread Test - Starting
============================================================

[Step 1] Loading configuration...
Configuration loaded successfully

[Step 2] Applying configuration overrides...
Final RPC Server Configuration:
  Host: localhost
  Port: 8765
  Debug: True

[Step 3] Creating RPC server thread...
RPC server thread created

[Step 4] Registering routes via controller...
[TestController] Registering routes...
[TestController] Registered 7 routes successfully

[Step 5] Starting RPC server thread...
✓ RPC server is running

============================================================
 Server Information
============================================================

WebSocket URL: ws://localhost:8765
Server Name: RPC Thread Test
Version: 1.0.0

Available APIs:
  - echo          : Echo back a message
  - add           : Add two numbers
  - multiply      : Multiply two numbers
  - get_info      : Get server information
  - list_apis     : List all available APIs
  - health_check  : Health check endpoint
  - calculate     : Perform dynamic calculations
```

### Test the API Routes

```bash
# In another terminal
cd D:\programing\core_node
python -m pyapps.rpc_thread_test.test_client
```

## Directory Structure

```
rpc_thread_test/
├── __init__.py                           # Package exports
├── README.md                             # This file
├── rpc_thread_test_main.py               # Main entry point
├── test_client.py                        # Test client
├── config/
│   └── launcher_config.json              # Configuration file
└── controllers/
    ├── __init__.py                       # Controller exports
    └── test_controller.py                # Route definitions
```

## Configuration

Edit `config/launcher_config.json`:

```json
{
  "rpc_server": {
    "host": "localhost",
    "port": 8765,
    "debug": true,
    "thread_name": "RpcServerThread",
    "daemon": true
  },
  "app": {
    "name": "RPC Thread Test",
    "version": "1.0.0",
    "enable_auto_port": false,
    "port_range": [8765, 8775]
  }
}
```

### Configuration Parameters

**rpc_server:**
- `host` - Server host (default: localhost)
- `port` - Server port (default: 8765)
- `debug` - Enable debug output (default: true)
- `thread_name` - Thread name (default: RpcServerThread)
- `daemon` - Daemon mode (default: true)

**app:**
- `name` - Application name
- `version` - Application version
- `enable_auto_port` - Enable dynamic port allocation (default: false)
- `port_range` - Port range for auto allocation [start, end]

### Dynamic Port Allocation

To enable automatic port allocation:

```json
{
  "app": {
    "enable_auto_port": true,
    "port_range": [8765, 8775]
  }
}
```

The application will automatically find an available port in the range.

## API Routes

### 1. Echo
```python
route: 'echo'
params: {'message': 'Hello'}
return: {
    'success': True,
    'echo': 'Hello',
    'request_count': 1,
    'timestamp': 1234567890.0
}
```

### 2. Add
```python
route: 'add'
params: {'a': 10, 'b': 20}
return: {
    'success': True,
    'operation': 'add',
    'a': 10,
    'b': 20,
    'result': 30,
    'request_count': 2
}
```

### 3. Multiply
```python
route: 'multiply'
params: {'a': 5, 'b': 6}
return: {
    'success': True,
    'operation': 'multiply',
    'a': 5,
    'b': 6,
    'result': 30,
    'request_count': 3
}
```

### 4. Get Info
```python
route: 'get_info'
params: {}
return: {
    'success': True,
    'server': {
        'host': 'localhost',
        'port': 8765,
        'name': 'RPC Thread Test Server'
    },
    'stats': {
        'request_count': 4,
        'uptime': 'N/A'
    },
    'timestamp': 1234567890.0
}
```

### 5. List APIs
```python
route: 'list_apis'
params: {}
return: {
    'success': True,
    'apis': [
        {
            'route': 'echo',
            'description': 'Echo back a message',
            'params': {'message': 'string'},
            'example': {'message': 'Hello, RPC!'}
        },
        # ... more APIs
    ],
    'total_count': 7,
    'request_count': 5
}
```

### 6. Health Check
```python
route: 'health_check'
params: {}
return: {
    'success': True,
    'status': 'healthy',
    'message': 'RPC server is running',
    'request_count': 6,
    'timestamp': 1234567890.0
}
```

### 7. Calculate
```python
route: 'calculate'
params: {
    'operation': 'add',  # add, subtract, multiply, divide, power, modulo
    'a': 10,
    'b': 5
}
return: {
    'success': True,
    'operation': 'add',
    'a': 10,
    'b': 5,
    'result': 15,
    'request_count': 7
}
```

## Architecture

### Thread Architecture

```
Main Thread
  └─> WsRpcServerThread (RpcServerThread)
       ├─> Event Loop
       ├─> WsRpcServer (port 8765)
       └─> TestController (7 routes)
```

### Configuration Flow

```
launcher_config.json
  ↓
load_config()
  ↓
apply_config_overrides()
  ├─> Dynamic port allocation
  └─> Runtime adjustments
  ↓
WsRpcServerThread(config)
  ↓
TestController.register_routes()
  ↓
server.start()
```

## Adding Custom Routes

Edit `controllers/test_controller.py`:

```python
def register_routes(self, rpc_server):
    """Register all routes to RPC server"""

    # Add your custom route
    @rpc_server.route('my_custom_route')
    async def my_custom_route(params):
        """My custom route description"""

        # Your logic here
        result = process_data(params)

        return {
            'success': True,
            'result': result
        }
```

## Testing

### Run All Tests

```bash
python -m pyapps.rpc_thread_test.test_client
```

### Manual Test with Python

```python
import asyncio
from pycore.pyutils.wsrpc import WsRpcClient

async def test():
    client = WsRpcClient({'url': 'ws://localhost:8765'})
    await client.connect()

    result = await client.call('echo', {'message': 'Hello!'})
    print(result)

    await client.disconnect()

asyncio.run(test())
```

## Troubleshooting

### Port Already in Use

Enable auto port allocation:
```json
{
  "app": {
    "enable_auto_port": true
  }
}
```

Or change the port manually:
```json
{
  "rpc_server": {
    "port": 8766
  }
}
```

### Module Import Errors

Ensure you're running from project root:
```bash
cd D:\programing\core_node
python pymain.py app=rpc_thread_test
```

### Cache Issues

Clean Python cache:
```bash
cd D:\programing\core_node
find . -name "__pycache__" -type d -exec rm -rf {} +
find . -name "*.pyc" -delete
```

## Related Documentation

- **WsRpc Threads**: `pycore/pyutils/wsrpc/threads/README.md`
- **WsRpc Framework**: `pycore/pyutils/wsrpc/README.md`
- **Development Guide**: `development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`

## Key Features

✅ **Configuration-based startup** - All settings from JSON file
✅ **Dynamic port allocation** - Automatically find available ports
✅ **Controller-based routing** - Clean, organized route definitions
✅ **Independent thread** - RPC runs in dedicated thread
✅ **7 API routes** - Comprehensive examples
✅ **Test client included** - Ready-to-use testing tool
✅ **Easy to extend** - Add custom routes easily

## License

Part of the core_node project.
