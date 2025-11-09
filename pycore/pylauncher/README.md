# Unified Launcher (pylauncher)

Unified Launcher - Framework for starting and managing multiple services

## Overview

Unified Launcher is a unified service startup and management framework that supports multi-threaded startup and lifecycle management of the following services:

1. **Web Service (WS/HTTPS)** - FastAPI + WebSocket service
2. **MCP Service** - Model Context Protocol server
3. **UI Service** - Native UI Framework (Tkinter)
4. **Selenium Service** - Browser Automation (PyBrowser)

## Architecture

```
UnifiedLauncher
├── Web Service Thread
│   ├── HTTP Server (FastAPI)
│   └── WebSocket Server
├── MCP Service Thread
│   ├── Singleton Detection
│   └── RPC Communication
├── UI Service Thread
│   ├── Tkinter Main Loop
│   ├── Custom Title Bar
│   └── WebView Integration (Optional)
└── Selenium Service Thread
    ├── Spider Engine
    ├── Session Manager
    └── Browser Pool
```

Each service runs in an independent thread with unified configuration and lifecycle management.

## Quick Start

### Basic Usage

```python
from pycore.pylauncher import UnifiedLauncher, LauncherConfig

# Create default configuration
config = LauncherConfig()

# Create launcher
launcher = UnifiedLauncher(config)

# Start all services
launcher.start_all()

# Wait for services to run
launcher.wait()
```

### Custom Configuration

```python
from pycore.pylauncher import (
    UnifiedLauncher,
    LauncherConfig,
    WebServiceConfig,
    MCPServiceConfig,
    UIServiceConfig,
    SeleniumServiceConfig
)

# Create custom configuration
config = LauncherConfig(
    web_service=WebServiceConfig(
        host="0.0.0.0",
        http_port=8000,
        ws_port=8001,
        enabled=True
    ),
    mcp_service=MCPServiceConfig(
        singleton_port=19997,
        rpc_port=8767,
        enabled=True
    ),
    ui_service=UIServiceConfig(
        app_name="My Application",
        window_size=(1280, 800),
        frameless=True,
        enabled=True
    ),
    selenium_service=SeleniumServiceConfig(
        browser_type="chrome",
        headless=False,
        enabled=True
    )
)

launcher = UnifiedLauncher(config)
launcher.start_all()
launcher.wait()
```

## Configuration Parameters

### LauncherConfig

Main configuration class containing all service configurations.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `web_service` | WebServiceConfig | - | Web service configuration |
| `mcp_service` | MCPServiceConfig | - | MCP service configuration |
| `ui_service` | UIServiceConfig | - | UI service configuration |
| `selenium_service` | SeleniumServiceConfig | - | Selenium service configuration |
| `auto_start_all` | bool | True | Auto-start all services |
| `startup_delay` | float | 0.5 | Service startup interval (seconds) |
| `graceful_shutdown_timeout` | int | 10 | Graceful shutdown timeout (seconds) |

### WebServiceConfig

Web/WebSocket service configuration.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `host` | str | "localhost" | Server address |
| `http_port` | int | 8000 | HTTP port |
| `ws_port` | int | 8001 | WebSocket port |
| `enable_https` | bool | False | Enable HTTPS |
| `ssl_cert_path` | str | None | SSL certificate path |
| `ssl_key_path` | str | None | SSL key path |
| `workers` | int | 1 | Worker processes |
| `reload` | bool | False | Auto-reload |
| `enable_cors` | bool | True | Enable CORS |
| `enabled` | bool | True | Enable this service |

### MCPServiceConfig

MCP (Model Context Protocol) service configuration.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `singleton_port` | int | 19997 | Singleton detection port |
| `rpc_port` | int | 8767 | RPC communication port |
| `host` | str | "localhost" | Server address |
| `debug` | bool | True | Debug mode |
| `auto_load_services` | bool | True | Auto-load services |
| `enabled` | bool | True | Enable this service |

### UIServiceConfig

Native UI service configuration.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `app_name` | str | "Unified Application" | Application name |
| `window_size` | tuple | (1280, 800) | Window size |
| `min_window_size` | tuple | (800, 600) | Minimum window size |
| `frameless` | bool | True | Frameless window |
| `show_on_start` | bool | True | Show on start |
| `resizable` | bool | True | Resizable |
| `ui_source` | str | None | UI content source (URL or HTML file) |
| `theme` | str | "default" | Theme |
| `debug` | bool | False | Debug mode |
| `enabled` | bool | True | Enable this service |

### SeleniumServiceConfig

Selenium browser automation service configuration.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `browser_type` | str | "chrome" | Browser type (chrome/edge/firefox) |
| `headless` | bool | False | Headless mode |
| `disable_gpu` | bool | True | Disable GPU |
| `no_sandbox` | bool | True | Disable sandbox |
| `driver_path` | str | None | WebDriver path |
| `binary_path` | str | None | Browser binary path |
| `max_sessions` | int | 5 | Maximum sessions |
| `session_timeout` | int | 3600 | Session timeout (seconds) |
| `pool_size` | int | 3 | Resource pool size |
| `debug` | bool | False | Debug mode |
| `enabled` | bool | True | Enable this service |

## Usage Examples

### Example 1: Start Only Web and MCP Services

```python
config = LauncherConfig(
    web_service=WebServiceConfig(enabled=True),
    mcp_service=MCPServiceConfig(enabled=True),
    ui_service=UIServiceConfig(enabled=False),
    selenium_service=SeleniumServiceConfig(enabled=False)
)

launcher = UnifiedLauncher(config)
launcher.start_all()
launcher.wait()
```

### Example 2: Manual Service Control

```python
config = LauncherConfig(auto_start_all=False)
launcher = UnifiedLauncher(config)

# Manually start individual service
launcher.start_service('web_service')
time.sleep(2)
launcher.start_service('mcp_service')

# Get status
status = launcher.get_status()
print(status)

# Restart service
launcher.restart_service('web_service')

# Stop service
launcher.stop_service('mcp_service')
```

### Example 3: UI + WebView Integration

```python
config = LauncherConfig(
    web_service=WebServiceConfig(
        http_port=8000,
        enabled=True
    ),
    ui_service=UIServiceConfig(
        app_name="Web Application",
        ui_source="http://localhost:8000",  # Point to Web service
        enabled=True
    )
)

launcher = UnifiedLauncher(config)
launcher.start_all()
launcher.wait()
```

### Example 4: Custom Ports and Configuration

```python
config = LauncherConfig(
    web_service=WebServiceConfig(
        host="0.0.0.0",  # Listen on all interfaces
        http_port=9000,
        ws_port=9001,
        enable_cors=True,
        cors_origins=["http://localhost:3000"],
        enabled=True
    ),
    mcp_service=MCPServiceConfig(
        singleton_port=20000,
        rpc_port=9767,
        debug=True,
        enabled=True
    ),
    ui_service=UIServiceConfig(
        app_name="Custom App",
        window_size=(1920, 1080),
        frameless=False,  # Use system window frame
        enabled=True
    ),
    selenium_service=SeleniumServiceConfig(
        browser_type="edge",
        headless=True,
        max_sessions=10,
        enabled=True
    )
)
```

## Running Examples

```bash
# Run example program
cd D:\programing\core_node
python -m pycore.pylauncher.example

# Or run directly
python pycore/pylauncher/example.py
```

## API Reference

### UnifiedLauncher

#### Methods

**`start_all()`**
Start all enabled services.

**`stop_all()`**
Stop all running services.

**`start_service(service_name: str)`**
Start specified service.
- `service_name`: 'web_service', 'mcp_service', 'ui_service', 'selenium_service'

**`stop_service(service_name: str)`**
Stop specified service.

**`restart_service(service_name: str)`**
Restart specified service.

**`wait()`**
Wait for all services to run (blocking call).

**`get_status() -> Dict[str, Any]`**
Get status of all services.

Return format:
```python
{
    'running': True,
    'services': {
        'web_service': {
            'name': 'web_service',
            'started': True,
            'running': True,
            'alive': True,
            'error': None
        },
        # ... other services
    }
}
```

## Lifecycle Management

### Graceful Shutdown

```python
launcher = UnifiedLauncher(config)
launcher.start_all()

try:
    launcher.wait()
except KeyboardInterrupt:
    print("Shutting down...")
    launcher.stop_all()
```

### Signal Handling

The launcher automatically handles SIGINT and SIGTERM signals for graceful shutdown.

## Notes

1. **Port Conflicts**: Ensure configured ports are not in use
2. **Startup Order**: Recommend starting Web and MCP services first, then UI service
3. **UI Service**: UI service runs in Tkinter mainloop on main thread
4. **Selenium**: Need to install WebDriver for corresponding browser
5. **Logging**: All service logs output to console via ColorPrint

## Dependencies

- pycore.pyfoundations.color_print
- pycore.pyutils.web
- pycore.pyutils.wsrpc
- pycore.pyutils.native_ui
- pycore.pyutils.pybrowser
- pyapps.mcpserver

## Version

Current version: 1.0.0

## License

MIT License
