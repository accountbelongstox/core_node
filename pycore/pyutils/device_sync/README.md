# Device Sync - Independent File Synchronization Module

Independent device synchronization module without dependencies on other pycore.pyutils modules.

## Features

- **Primary/Secondary Architecture**: One device serves files, others sync from it
- **Auto-Discovery**: Automatically find primary device on local network
- **Incremental Sync**: Only transfer changed files
- **Single Instance**: Only one instance runs per machine
- **System Tray UI**: Tkinter-based tray menu for control
- **Remote Control**: Control via IPC socket (restart, shutdown, mode switch)

## Architecture

```
┌─────────────────┐         ┌─────────────────┐
│  Primary Device │◄────────┤Secondary Device │
│  (File Server)  │         │  (File Client)  │
│  Port: 45679    │         │  Auto-discover  │
└─────────────────┘         └─────────────────┘
        │                            │
        │                            │
        ▼                            ▼
  Files cached                   Syncs every 5s
  Serves updates                (when enabled)
```

## Components

### 1. IPC Server (`ipc_server.py`)
- Single instance enforcement
- Remote command handling
- Port: 45678

**Commands**:
- `restart`: Restart service
- `shutdown`: Shutdown application
- `set_primary`: Switch to primary mode
- `set_secondary`: Switch to secondary mode
- `enable_sync`: Enable sync (secondary only)
- `disable_sync`: Disable sync (secondary only)

### 2. Device Discovery (`discovery.py`)
- Auto-discover primary devices on LAN
- Network segment detection
- Parallel IP scanning
- Primary device caching

### 3. File Sync Server (`sync_server.py`)
- Serves file metadata and content
- File change detection (mtime, size, hash)
- Incremental updates
- Port: 45679

**Endpoints**:
- `DISCOVER`: Discovery handshake
- `PING`: Health check
- `GET /list`: Get file list
- `GET /file/<path>`: Download file

### 4. File Sync Client (`sync_client.py`)
- Connects to primary device
- Auto-sync every 5 seconds
- Incremental downloads
- Sync statistics tracking

### 5. Tray Menu (`tray_menu.py`)
- System tray icon
- Mode selection (Primary/Secondary)
- Sync control
- Status display

## Installation

### Required Dependencies

```bash
# System tray support (optional but recommended)
pip install pystray pillow
```

### Optional: For launcher.py integration

No additional dependencies required - uses only Python standard library + tkinter.

## Usage

### Standalone Usage

```python
from pycore.pyutils.launcher.device_sync import DeviceSyncTrayMenu

# Create tray menu
menu = DeviceSyncTrayMenu(root_dir='D:/programing/core_node')

# Run (shows mode selection dialog)
menu.run()
```

### Command Line Usage

```bash
# Run with default directory
python -m pycore.pyutils.launcher.device_sync.tray_menu

# Run with custom directory
python -m pycore.pyutils.launcher.device_sync.tray_menu D:/my/project
```

### Programmatic Control

```python
from pycore.pyutils.launcher.device_sync import (
    FileSyncServer,
    FileSyncClient,
    DeviceDiscovery,
    IPCServer
)

# Primary device
server = FileSyncServer(root_dir='D:/programing/core_node', port=45679)
server.start()

# Secondary device
client = FileSyncClient(target_dir='D:/programing/core_node')
client.discover_primary()
client.enable_sync()
client.start_auto_sync()

# Send commands to running instance
from pycore.pyutils.launcher.device_sync.ipc_server import send_restart_command
send_restart_command()
```

## Integration with launcher.py

Add to launcher.py:

```python
from pycore.pyutils.launcher.device_sync import DeviceSyncTrayMenu

def launch_device_sync():
    """Launch device sync tray menu."""
    import threading

    menu = DeviceSyncTrayMenu(root_dir='D:/programing/core_node')

    # Run in separate thread
    sync_thread = threading.Thread(target=menu.run, daemon=False)
    sync_thread.start()

# Add to main() function
launch_device_sync()
```

## Configuration

### Ports

- **IPC Port**: 45678 (single instance control)
- **Sync Port**: 45679 (file synchronization)

Change ports:

```python
from pycore.pyutils.launcher.device_sync import (
    DeviceSyncTrayMenu,
    DEFAULT_IPC_PORT,
    DEFAULT_SYNC_PORT
)

# Custom ports
menu = DeviceSyncTrayMenu(root_dir='D:/programing/core_node')
menu.ipc_server.port = 45680
menu.sync_server.port = 45681
```

### Sync Interval

Default: 5 seconds

Change interval:

```python
from pycore.pyutils.launcher.device_sync.sync_client import SYNC_INTERVAL

# Modify before creating client
import pycore.pyutils.launcher.device_sync.sync_client as sync_client_module
sync_client_module.SYNC_INTERVAL = 10  # 10 seconds
```

## File Exclusions

Excluded directories (not synced):
- `__pycache__`
- `.git`
- `node_modules`
- `.vscode`
- `dist`
- `build`
- `.cache`
- `.pytest_cache`
- `venv`
- `env`

## Troubleshooting

### "Application already running"

Another instance is running. Check system tray or use:

```python
from pycore.pyutils.launcher.device_sync import IPCServer
from pycore.pyutils.launcher.device_sync.ipc_server import send_shutdown_command

# Shutdown running instance
send_shutdown_command()
```

### "Failed to discover primary device"

1. Ensure primary device is running
2. Check both devices on same network
3. Check firewall allows port 45679
4. Manually set primary:

```python
client.set_primary('192.168.1.100', 45679)
```

### "Port already in use"

Another application using port 45678 or 45679.

Change ports in code or stop conflicting application.

## API Reference

### DeviceSyncTrayMenu

```python
menu = DeviceSyncTrayMenu(root_dir: str)

menu.run()                    # Start application
menu.set_as_primary()         # Switch to primary mode
menu.set_as_secondary()       # Switch to secondary mode
menu.enable_sync()            # Enable sync (secondary only)
menu.disable_sync()           # Disable sync
menu.restart_service()        # Restart sync service
menu.shutdown()               # Shutdown application
```

### FileSyncServer

```python
server = FileSyncServer(root_dir: str, port: int = 45679)

server.start()                # Start server
server.stop()                 # Stop server
server.get_cache_stats()      # Get cache statistics
```

### FileSyncClient

```python
client = FileSyncClient(target_dir: str, primary_host: str = None, port: int = 45679)

client.discover_primary()     # Auto-discover primary
client.set_primary(host, port) # Set primary manually
client.enable_sync()          # Enable auto sync
client.disable_sync()         # Disable auto sync
client.start_auto_sync()      # Start sync loop
client.stop_auto_sync()       # Stop sync loop
client.sync_now()             # Immediate sync
client.get_sync_stats()       # Get sync statistics
```

### DeviceDiscovery

```python
discovery = DeviceDiscovery(sync_port: int = 45679)

primary = discovery.find_primary_device(use_cache: bool = True)
cached = discovery.get_cached_primary()
discovery.clear_cache()
```

### IPCServer

```python
ipc = IPCServer(port: int = 45678)

ipc.is_already_running()      # Check if instance running
ipc.send_command(cmd, data)   # Send command to running instance
ipc.register_handler(cmd, fn) # Register command handler
ipc.start()                   # Start IPC server
ipc.stop()                    # Stop IPC server
```

## License

Part of pycore utilities.
