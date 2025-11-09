# RPC Thread Test - Complete Usage Guide

## Quick Start (3 Ways)

### Method 1: Using Toolkit (Recommended)

```bash
cd D:\programing\core_node\pyapps\rpc_thread_test
python tools.py
```

Interactive menu will appear:
```
Available Commands:
  1. start          - Start RPC server
  2. test           - Run test client
  3. monitor        - Monitor server status
  4. config         - Manage configurations
  5. info           - Show server information
  6. help           - Show detailed help
  0. exit           - Exit toolkit
```

### Method 2: Using Batch Scripts (Windows)

**Start Server:**
```bash
cd D:\programing\core_node\pyapps\rpc_thread_test
start_server.bat
```

**Start Test Client:**
```bash
cd D:\programing\core_node\pyapps\rpc_thread_test
start_client.bat
```

### Method 3: Using pymain.py

```bash
cd D:\programing\core_node
python pymain.py app=rpc_thread_test
```

## Complete Toolkit Commands

### 1. Start Server

```bash
# Using toolkit
python tools.py start

# Direct command
python pymain.py app=rpc_thread_test

# Windows batch
start_server.bat
```

### 2. Test Client

```bash
# Using toolkit
python tools.py test

# Direct command
python -m pyapps.rpc_thread_test.test_client

# Windows batch
start_client.bat
```

### 3. Monitor Server

```bash
# Using toolkit
python tools.py monitor

# Direct command with options
python -m pyapps.rpc_thread_test.monitor --host localhost --port 8765 --interval 2
```

**Monitor Output:**
```
============================================================
 RPC Server Monitor
============================================================

Server Connection:
  URL: ws://localhost:8765

Health Status:
  Status: HEALTHY
  Response Time: 15.23 ms

Server Information:
  Name: RPC Thread Test
  Host: localhost
  Port: 8765
  Server Requests: 42

Monitor Statistics:
  Total Checks: 10
  Successful: 10
  Failed: 0

Response Times:
  Average: 15.45 ms
  Min: 12.34 ms
  Max: 18.90 ms

Success Rate:
  100.0%
```

### 4. Configuration Management

```bash
# Using toolkit
python tools.py config

# Direct commands
python switch_config.py list                          # List all configs
python switch_config.py show                          # Show current config
python switch_config.py switch launcher_config_auto_port   # Switch config
python switch_config.py create production             # Create new config
```

**Available Configurations:**
- `launcher_config.json` - Default configuration (fixed port)
- `launcher_config_auto_port.json` - Auto port allocation

### 5. Server Information

```bash
python tools.py info
```

Shows:
- Server configuration
- Available API routes
- Configuration files
- Documentation links

## Configuration Guide

### Default Configuration

File: `config/launcher_config.json`

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

### Auto Port Configuration

File: `config/launcher_config_auto_port.json`

```json
{
  "rpc_server": {
    "host": "localhost",
    "port": 8765,
    "debug": true
  },
  "app": {
    "enable_auto_port": true,
    "port_range": [8765, 8775]
  }
}
```

### Switch Configuration

```bash
# Switch to auto port mode
python switch_config.py switch launcher_config_auto_port

# Verify switch
python switch_config.py show
```

### Create Custom Configuration

```bash
# Create new config template
python switch_config.py create production

# Edit the new file
# config/launcher_config_production.json

# Switch to it
python switch_config.py switch launcher_config_production
```

## API Testing

### Test All Routes

```bash
python -m pyapps.rpc_thread_test.test_client
```

**Test Output:**
```
============================================================
Test 1: Health Check
============================================================
Status: healthy
Message: RPC server is running
Request Count: 1

============================================================
Test 2: List Available APIs
============================================================
Total APIs: 7
  - echo: Echo back a message
  - add: Add two numbers
  - multiply: Multiply two numbers
  ...

============================================================
Test 6: Calculate (Dynamic Operations)
============================================================
  10 add 5 = 15
  10 subtract 5 = 5
  10 multiply 5 = 50
  10 divide 5 = 2
  2 power 8 = 256
  10 modulo 3 = 1
```

### Manual API Testing

```python
import asyncio
from pycore.pyutils.wsrpc import WsRpcClient

async def test_api():
    # Connect
    client = WsRpcClient({'url': 'ws://localhost:8765'})
    await client.connect()

    # Test echo
    result = await client.call('echo', {'message': 'Hello!'})
    print(result)
    # {'success': True, 'echo': 'Hello!', 'request_count': 1, 'timestamp': ...}

    # Test add
    result = await client.call('add', {'a': 10, 'b': 20})
    print(result)
    # {'success': True, 'operation': 'add', 'a': 10, 'b': 20, 'result': 30, ...}

    # Test calculate
    result = await client.call('calculate', {
        'operation': 'power',
        'a': 2,
        'b': 10
    })
    print(result)
    # {'success': True, 'operation': 'power', 'a': 2, 'b': 10, 'result': 1024, ...}

    # Disconnect
    await client.disconnect()

asyncio.run(test_api())
```

## Advanced Usage

### Multiple Instances

**Terminal 1 - Start with default port:**
```bash
python pymain.py app=rpc_thread_test
```

**Terminal 2 - Start with auto port:**
```bash
python switch_config.py switch launcher_config_auto_port
python pymain.py app=rpc_thread_test
```

**Terminal 3 - Test both servers:**
```bash
# Test server 1 (port 8765)
python -m pyapps.rpc_thread_test.test_client

# Test server 2 (auto port - check output for actual port)
```

### Monitoring Multiple Servers

```bash
# Monitor default server
python -m pyapps.rpc_thread_test.monitor

# Monitor custom port
python -m pyapps.rpc_thread_test.monitor --port 8766
```

### Custom Controller

Edit `controllers/test_controller.py`:

```python
def register_routes(self, rpc_server):
    """Register all routes to RPC server"""

    # ... existing routes ...

    # Add custom route
    @rpc_server.route('my_custom_api')
    async def my_custom_api(params):
        """My custom API endpoint"""
        data = params.get('data', {})

        # Your custom logic here
        result = process_custom_data(data)

        return {
            'success': True,
            'result': result,
            'timestamp': time.time()
        }
```

Restart server to apply changes:
```bash
# Stop current server (Ctrl+C)
# Start again
python pymain.py app=rpc_thread_test
```

Test new API:
```python
result = await client.call('my_custom_api', {'data': {...}})
```

## Troubleshooting

### Port Already in Use

**Solution 1 - Use auto port:**
```bash
python switch_config.py switch launcher_config_auto_port
python pymain.py app=rpc_thread_test
```

**Solution 2 - Change port manually:**
Edit `config/launcher_config.json`:
```json
{
  "rpc_server": {
    "port": 8766
  }
}
```

**Solution 3 - Kill existing process:**
```bash
# Windows
netstat -ano | findstr :8765
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:8765 | xargs kill -9
```

### Connection Refused

**Check server is running:**
```bash
python tools.py monitor
```

If fails:
```bash
# Start server first
python pymain.py app=rpc_thread_test
```

### Module Import Errors

**Ensure running from project root:**
```bash
cd D:\programing\core_node
python pymain.py app=rpc_thread_test
```

**Clean Python cache:**
```bash
cd D:\programing\core_node
find . -name "__pycache__" -type d -exec rm -rf {} +
find . -name "*.pyc" -delete
```

### Monitor Shows Errors

**Check server logs:**
- Server should show connection messages
- Check firewall settings
- Verify correct host/port in config

## File Structure Reference

```
rpc_thread_test/
├── tools.py                              # Main toolkit (interactive)
├── monitor.py                            # Server monitoring tool
├── switch_config.py                      # Configuration switcher
├── start_server.bat                      # Quick start server (Windows)
├── start_client.bat                      # Quick start client (Windows)
├── rpc_thread_test_main.py               # Main entry point
├── test_client.py                        # Test client
├── README.md                             # Complete documentation
├── USAGE_GUIDE.md                        # This file
├── config/
│   ├── launcher_config.json              # Default config
│   └── launcher_config_auto_port.json    # Auto port config
└── controllers/
    └── test_controller.py                # 7 API routes
```

## Common Workflows

### Development Workflow

```bash
# 1. Start server with auto port
python switch_config.py switch launcher_config_auto_port
python pymain.py app=rpc_thread_test

# 2. Monitor in another terminal
python -m pyapps.rpc_thread_test.monitor

# 3. Test in another terminal
python -m pyapps.rpc_thread_test.test_client
```

### Testing Workflow

```bash
# 1. Start server
python tools.py start

# 2. Run tests (another terminal)
python tools.py test

# 3. Check results
```

### Production Workflow

```bash
# 1. Create production config
python switch_config.py create production

# 2. Edit config (disable debug, etc.)
# Edit config/launcher_config_production.json

# 3. Switch to production config
python switch_config.py switch launcher_config_production

# 4. Start server
python pymain.py app=rpc_thread_test
```

## Tips

1. **Use toolkit for convenience:**
   ```bash
   python tools.py
   ```

2. **Monitor server health:**
   ```bash
   python tools.py monitor
   ```

3. **Manage configs easily:**
   ```bash
   python tools.py config
   ```

4. **Test all APIs quickly:**
   ```bash
   python tools.py test
   ```

5. **Get server info:**
   ```bash
   python tools.py info
   ```

## Next Steps

1. **Customize routes** - Edit `controllers/test_controller.py`
2. **Add configurations** - Create new config files
3. **Extend monitoring** - Modify `monitor.py`
4. **Build your app** - Use this as a template

## Support

For issues or questions:
- Check README.md for detailed documentation
- Review configuration files
- Test with monitor.py
- Check server logs

Enjoy building with RPC Thread Test!
