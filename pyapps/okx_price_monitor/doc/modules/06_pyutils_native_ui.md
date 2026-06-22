# pyutils.native_ui - Native UI Framework

## Overview

The `native_ui` module provides utilities for building native desktop applications with support for PySide6 and Tkinter frameworks. It includes a simplified application launcher, timer management, internationalization, shutdown management, and system tray integration.

## Module Location

```
pycore/pyutils/native_ui/
├── __init__.py
├── step0_i18n/                    # Internationalization
├── step1_config/                  # Configuration
│   ├── app_config.py              # NativeUIConfig
│   └── config.py                  # Legacy UIConfig
├── step2_port_url/                # Port and URL handling
│   ├── port_allocator.py
│   ├── url_handler.py
│   └── server_manager.py
├── step3_launcher/                # Application launchers
│   ├── launch_native_app.py       # Simplified launcher
│   └── launcher_with_startup.py   # With startup window
├── step4_startup/                 # Startup window
│   ├── startup_window.py
│   └── startup_window_thread.py
├── step5_main_ui/                 # UI frameworks
│   ├── tkinter/
│   └── pyside6/
├── step7_managers/                # Managers
│   ├── timer_manager.py
│   ├── shutdown_manager.py
│   ├── callback_manager.py
│   └── thread_bus_manager.py
└── step8_utils/                   # Utilities
    └── signals.py
```

## Recommended Usage

### Simplified Launcher API

```python
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

def main_app_entry(framework):
    """Main application entry point"""
    # Initialize your app here
    pass

config = NativeUIConfig(
    app_id="matrix",
    app_name="Matrix Application",
    main_entry=main_app_entry,
    url="http://localhost:3000",
    enable_timer=True,
    enable_tray=True
)

launch_native_app(config)
```

## Core Components

### NativeUIConfig

Configuration class for native UI applications:

```python
from pycore.pyutils.native_ui import NativeUIConfig, TrayMenuItemDict

config = NativeUIConfig(
    # Required
    app_id="my_app",
    app_name="My Application",
    main_entry=main_function,
    
    # URL/Server
    url="http://localhost:3000",
    port=3000,
    
    # Features
    enable_timer=True,
    enable_tray=True,
    enable_i18n=True,
    
    # Window
    window_width=1280,
    window_height=720,
    window_title="My App",
    resizable=True,
    
    # System Tray
    tray_icon="path/to/icon.png",
    tray_menu=[
        {"label": "Show", "callback": show_window},
        {"label": "Exit", "callback": exit_app}
    ]
)
```

**Configuration Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `app_id` | str | Required | Unique application identifier |
| `app_name` | str | Required | Display name |
| `main_entry` | Callable | Required | Main entry function |
| `url` | str | None | Web content URL |
| `port` | int | Auto | Server port |
| `enable_timer` | bool | True | Enable timer manager |
| `enable_tray` | bool | True | Enable system tray |
| `enable_i18n` | bool | False | Enable i18n |
| `window_width` | int | 1280 | Window width |
| `window_height` | int | 720 | Window height |
| `window_title` | str | app_name | Window title |
| `resizable` | bool | True | Allow resize |
| `tray_icon` | str | None | Tray icon path |
| `tray_menu` | List[TrayMenuItemDict] | [] | Tray menu items |

### TimerManager

Built-in singleton timer for scheduled tasks:

```python
from pycore.pyutils.native_ui import get_timer_manager

timer_mgr = get_timer_manager()

# Register a task (runs every 5 seconds)
timer_mgr.register_task(
    "my_task",
    interval=5.0,
    callback=my_callback
)

# One-time task (runs once after 10 seconds)
timer_mgr.register_task(
    "one_time",
    interval=10.0,
    callback=one_time_callback,
    repeat=False
)

# Unregister task
timer_mgr.unregister_task("my_task")

# Get task info
info = timer_mgr.get_task_info("my_task")
```

**TimerTask Class:**

```python
@dataclass
class TimerTask:
    name: str
    interval: float
    callback: Callable
    repeat: bool = True
    last_run: float = 0
    run_count: int = 0
    enabled: bool = True
```

### I18nManager

Internationalization support:

```python
from pycore.pyutils.native_ui.step0_i18n import i18n
from pathlib import Path

# i18n is pre-initialized with base translations
# Extend with app translations in start() function
app_dir = Path(__file__).parent
i18n.extend_translations(app_dir=str(app_dir), app_name="myapp")

# Get translated string
text = i18n.get("welcome_message")

# Change language
i18n.set_language("zh")

# Get current language
lang = i18n.get_language()

# Check if key exists
if i18n.has_key("some_key"):
    text = i18n.get("some_key")
```

**Translation File Structure:**

```
myapp/
├── myapp_i18n/          # or just 'i18n/'
│   ├── i18n_keys.py     # Key constants
│   ├── translations_en.json
│   └── translations_zh.json
```

**translations_en.json:**
```json
{
    "welcome_message": "Welcome to the application",
    "button_ok": "OK",
    "button_cancel": "Cancel"
}
```

### ShutdownManager

Graceful application termination:

```python
from pycore.pyutils.native_ui import get_shutdown_manager

shutdown_mgr = get_shutdown_manager()

# Add shutdown hook (lower priority runs first)
shutdown_mgr.add_shutdown_hook(
    "cleanup_temp",
    cleanup_temp_files,
    priority=10
)

shutdown_mgr.add_shutdown_hook(
    "save_state",
    save_application_state,
    priority=5  # Runs before cleanup
)

# Request shutdown
shutdown_mgr.request_shutdown()

# Check if shutdown requested
if shutdown_mgr.is_shutdown_requested():
    return
```

**ShutdownHook:**

```python
@dataclass
class ShutdownHook:
    name: str
    callback: Callable
    priority: int = 100  # Lower = higher priority
```

### NativeUIBusManager

THREAD_BUS integration for UI components:

```python
from pycore.pyutils.native_ui import get_bus_manager, BusKeys

bus_mgr = get_bus_manager()

# Subscribe to events
bus_mgr.subscribe(BusKeys.UI_READY, on_ui_ready)
bus_mgr.subscribe(BusKeys.WINDOW_CLOSE, on_window_close)

# Publish events
bus_mgr.publish(BusKeys.UI_READY, {"status": "initialized"})
```

**Available Bus Keys:**

```python
class BusKeys:
    UI_READY = "native_ui.ready"
    WINDOW_CLOSE = "native_ui.window.close"
    WINDOW_MINIMIZE = "native_ui.window.minimize"
    TRAY_CLICK = "native_ui.tray.click"
    TIMER_TICK = "native_ui.timer.tick"
```

## PySide6 Framework

### PySide6Framework

```python
from pycore.pyutils.native_ui.step5_main_ui.pyside6 import (
    PySide6Framework,
    PySide6UIConfig,
    create_framework
)

# Create framework
framework = create_framework(
    config=PySide6UIConfig(
        app_id="my_app",
        window_title="My Application",
        window_width=1280,
        window_height=720
    )
)

# Get main window
main_window = framework.get_main_window()

# Show window
framework.show()

# Run event loop
framework.run()
```

### PySide6MainWindow

```python
from pycore.pyutils.native_ui.step5_main_ui.pyside6 import PySide6MainWindow

class MyMainWindow(PySide6MainWindow):
    def __init__(self, config):
        super().__init__(config)
        self.setup_ui()
    
    def setup_ui(self):
        # Add custom UI elements
        pass
```

### PySide6WebView

Embedded web browser:

```python
from pycore.pyutils.native_ui.step5_main_ui.pyside6 import PySide6WebView

webview = PySide6WebView()
webview.load_url("http://localhost:3000")

# JavaScript bridge
webview.evaluate_js("console.log('Hello from Python')")
```

### PySide6SystemTray

System tray integration:

```python
from pycore.pyutils.native_ui.step5_main_ui.pyside6 import PySide6SystemTray

tray = PySide6SystemTray(
    icon_path="path/to/icon.png",
    tooltip="My Application"
)

# Add menu items
tray.add_menu_item("Show Window", show_callback)
tray.add_menu_item("Exit", exit_callback)

# Show tray icon
tray.show()
```

## Startup Window

Show startup progress:

```python
from pycore.pyutils.native_ui import StartupWindow, launch_app_with_startup

def initialize_app(progress_callback):
    progress_callback(10, "Loading configuration...")
    load_config()
    
    progress_callback(30, "Connecting to server...")
    connect_server()
    
    progress_callback(60, "Loading UI...")
    load_ui()
    
    progress_callback(100, "Ready!")

launch_app_with_startup(
    main_entry=main_app_entry,
    init_callback=initialize_app,
    window_title="Loading...",
    window_width=400,
    window_height=200
)
```

## Port Allocation

```python
from pycore.pyutils.native_ui import get_port_range

# Get available port range for app
port_start, port_end = get_port_range("my_app")

# Use first available port
import socket
for port in range(port_start, port_end):
    try:
        sock = socket.socket()
        sock.bind(('localhost', port))
        sock.close()
        print(f"Using port {port}")
        break
    except OSError:
        continue
```

## URL Handler

```python
from pycore.pyutils.native_ui import URLHandler, process_url

# Process URL with port substitution
url = process_url(
    "http://localhost:{port}/app",
    port=3000
)

# URL handler
handler = URLHandler()
handler.set_base_url("http://localhost:3000")

# Build URLs
api_url = handler.build_url("/api/data")
```

## Server Manager

```python
from pycore.pyutils.native_ui import ServerManager, get_server_manager

server_mgr = get_server_manager()

# Start server
server = server_mgr.start_server(
    name="frontend",
    command="npm run dev",
    port=3000,
    cwd="/path/to/frontend"
)

# Check server status
if server.is_running():
    print(f"Server running on port {server.port}")

# Stop server
server_mgr.stop_server("frontend")

# Stop all servers
server_mgr.stop_all()
```

## Complete Example

```python
from pycore.pyutils.native_ui import (
    NativeUIConfig,
    launch_native_app,
    get_timer_manager,
    get_shutdown_manager,
    get_bus_manager,
    BusKeys
)

def on_timer_tick():
    print("Timer tick!")

def on_shutdown():
    print("Cleaning up...")

def main_entry(framework):
    # Setup timer
    timer_mgr = get_timer_manager()
    timer_mgr.register_task("heartbeat", 1.0, on_timer_tick)
    
    # Setup shutdown hook
    shutdown_mgr = get_shutdown_manager()
    shutdown_mgr.add_shutdown_hook("cleanup", on_shutdown, priority=10)
    
    # Subscribe to bus events
    bus_mgr = get_bus_manager()
    bus_mgr.subscribe(BusKeys.WINDOW_CLOSE, lambda _: shutdown_mgr.request_shutdown())
    
    print("Application initialized!")

if __name__ == "__main__":
    config = NativeUIConfig(
        app_id="example_app",
        app_name="Example Application",
        main_entry=main_entry,
        url="http://localhost:3000",
        enable_timer=True,
        enable_tray=True,
        window_width=1280,
        window_height=720,
        tray_menu=[
            {"label": "Show", "callback": lambda: print("Show")},
            {"label": "Exit", "callback": lambda: get_shutdown_manager().request_shutdown()}
        ]
    )
    
    launch_native_app(config)
```

## Best Practices

1. **Use NativeUIConfig**: Prefer simplified launcher over manual setup

2. **Enable Timer Only When Needed**: Set `enable_timer=False` if not using timers

3. **Use Shutdown Hooks**: Always clean up resources properly

4. **Leverage i18n**: Support multiple languages from the start

5. **Use Bus Manager**: Decouple components with event-driven communication

## Related Modules

- `pycore.pyfoundations.thread_bus` - THREAD_BUS implementation
- `pycore.pyutils.rpc_v2` - RPC server for UI communication
- `pycore.pylauncher` - Application launcher with singleton

## Exports

```python
__all__ = [
    # Timer Manager
    'TimerManager', 'TimerTask', 'get_timer_manager',
    
    # I18n Manager
    'I18nManager', 'get_i18n_manager', 'i18n',
    
    # Shutdown Manager
    'ShutdownManager', 'ShutdownHook', 'get_shutdown_manager',
    
    # Bus Manager
    'NativeUIBusManager', 'get_bus_manager', 'BusKeys',
    
    # Callback Manager
    'CallbackManager', 'get_callback_manager',
    
    # Startup
    'StartupWindow', 'TkinterStartupThread', 'launch_app_with_startup',
    
    # Simplified Launcher
    'NativeUIConfig', 'TrayMenuItemDict', 'launch_native_app', 'launch',
    
    # Port/URL
    'get_port_range', 'URLHandler', 'process_url',
    'ServerManager', 'ServerProcess', 'get_server_manager',
    
    # PySide6 (if available)
    'PySide6Framework', 'PySide6UIConfig', 'PySide6MainWindow',
    'PySide6TitleBar', 'PySide6SystemTray', 'PySide6WebView',
    'create_framework',
]
```

