# Platform Adapter Usage Guide

Platform Adapter provides unified Linux/Windows/macOS difference handling for Native UI applications.

## Quick Start

### 1. Basic Platform Detection

```python
from pycore.pyutils.native_ui import get_platform_adapter

# Get singleton instance
adapter = get_platform_adapter()

# Check platform
if adapter.is_linux:
    print("Running on Linux")
elif adapter.is_windows:
    print("Running on Windows")
elif adapter.is_macos:
    print("Running on macOS")

# Check capabilities
if adapter.can_use_tray():
    print("System tray available")
if adapter.has_gui:
    print("GUI available")
if adapter.has_x11:
    print("X11 display available (Linux)")
```

### 2. Auto-Configure Tray

```python
from pycore.pyutils.native_ui import (
    NativeUIConfig,
    launch_native_app,
    get_platform_adapter
)

# Get platform adapter
adapter = get_platform_adapter()

# Create config
config = NativeUIConfig(
    app_id="myapp",
    app_name="My Application",
    main_entry=main_func,

    # Tray auto-configuration
    enable_tray=adapter.can_use_tray(),  # Auto-detect availability
    tray_type=adapter.get_recommended_tray_backend().value,  # Auto-select backend
    tray_menu_items=[
        {"text": "Show", "callback": show_func},
        {"text": "Exit", "callback": exit_func}
    ]
)

launch_native_app(config)
```

### 3. Use with pylauncher

```python
from pycore.pylauncher import LauncherConfig, ServiceLauncher
from pycore.pyutils.native_ui import get_platform_adapter

# Get platform adapter
adapter = get_platform_adapter()

# Create launcher config with tray
config = LauncherConfig(
    app_id="myapp",
    app_name="My Application",
    singleton=True,

    # Tray configuration
    enable_tray=adapter.can_use_tray(),
    tray_backend="auto",  # Will use adapter.get_recommended_tray_backend()
    tray_icon_path="/path/to/icon.png",
    tray_menu_items=[
        {"text": "Show Window", "action": "window.show"},
        {"text": "---"},  # Separator
        {"text": "Exit", "action": "app.exit"}
    ],

    # Services
    services={
        'heartbeat': {},
        'rpc_v2': {'port': 58100}
    }
)

launcher = ServiceLauncher(config)
launcher.start()
```

### 4. Platform-Specific Configuration

```python
from pycore.pyutils.native_ui import get_platform_adapter

adapter = get_platform_adapter()

# Get QtWebEngine flags (auto-handles --no-sandbox on Linux root)
qtwebengine_flags = adapter.get_qtwebengine_flags(
    enable_webcodecs=True,
    enable_hardware_acceleration=True
)
print(f"QtWebEngine flags: {qtwebengine_flags}")

# Windows: Set AppUserModelID
if adapter.is_windows:
    adapter.set_windows_appusermodelid("myapp", "My Application")

# Adapt config dict
config_dict = {
    "app_id": "myapp",
    "app_name": "My Application",
    "enable_tray": True,
    "tray_backend": "auto"
}

# Adapt based on platform
adapted_config = adapter.adapt_config(config_dict)
# adapted_config will have:
# - tray disabled if not available
# - tray_backend auto-selected
# - qtwebengine_flags added
# - app_user_model_id added (Windows only)
```

### 5. Print Platform Information

```python
from pycore.pyutils.native_ui import get_platform_adapter

adapter = get_platform_adapter()
adapter.print_platform_info()
```

Output:
```
============================================================
Platform Information
============================================================
  platform: linux
  is_windows: False
  is_linux: True
  is_macos: False
  has_gui: True
  has_x11: True
  can_use_tray: True
  can_use_notifications: True
  needs_sandbox_disable: True
  recommended_tray_backend: pystray
  is_root: True
============================================================
```

## Advanced Usage

### Check Specific Capabilities

```python
from pycore.pyutils.native_ui import (
    is_linux,
    is_windows,
    can_use_tray,
    get_recommended_tray_backend
)

# Convenience functions (call get_platform_adapter() internally)
if is_linux():
    print("Linux detected")

if can_use_tray():
    backend = get_recommended_tray_backend()
    print(f"Use tray backend: {backend.value}")
```

### Custom Configuration Adaptation

```python
from pycore.pyutils.native_ui import get_platform_adapter

adapter = get_platform_adapter()

# Create base config
config = {
    "enable_tray": True,
    "tray_backend": "auto",
    "app_id": "myapp",
    "app_name": "My Application"
}

# Adapt for platform
adapted = adapter.adapt_config(config)

# Result on Linux with X11:
# {
#     "enable_tray": True,
#     "tray_backend": "pystray",  # Auto-selected
#     "app_id": "myapp",
#     "app_name": "My Application",
#     "qtwebengine_flags": "--enable-features=WebCodecs... --no-sandbox"
# }

# Result on Windows:
# {
#     "enable_tray": True,
#     "tray_backend": "pyside6",  # Auto-selected
#     "app_id": "myapp",
#     "app_name": "My Application",
#     "qtwebengine_flags": "--enable-features=WebCodecs...",
#     "app_user_model_id": "pycore.myapp.1.0"  # Added
# }

# Result on Linux without X11 (headless):
# {
#     "enable_tray": False,  # Disabled
#     "tray_backend": "none",
#     "app_id": "myapp",
#     "app_name": "My Application",
#     "qtwebengine_flags": "--enable-features=WebCodecs... --no-sandbox"
# }
```

### Manual Backend Selection

```python
from pycore.pyutils.native_ui import get_platform_adapter, TrayBackend

adapter = get_platform_adapter()

# Prefer specific backend
backend = adapter.select_tray_backend("pystray")

if backend == TrayBackend.NONE:
    print("Tray not available")
elif backend == TrayBackend.PYSTRAY:
    print("Using pystray backend")
elif backend == TrayBackend.PYSIDE6:
    print("Using PySide6 backend")
```

## Platform-Specific Notes

### Linux

1. **X11 Required for Tray**: System tray requires X11 display (`DISPLAY` environment variable)
2. **Headless Mode**: On servers without X11, tray is automatically disabled
3. **Root User**: Running as root adds `--no-sandbox` flag to QtWebEngine
4. **Recommended Backend**: `pystray` (lightweight, works with most Linux DEs)

### Windows

1. **Full Tray Support**: Always available
2. **AppUserModelID**: Automatically set for proper taskbar grouping
3. **Recommended Backend**: `pyside6` (Qt-integrated, more features)

### macOS

1. **Full Tray Support**: Always available
2. **Recommended Backend**: `pyside6` (native macOS menu bar integration)

## Integration Examples

### Example 1: Callmodule with Platform Adaptation

```python
from pycore.pylauncher import LauncherConfig, ServiceLauncher
from pycore.pyutils.native_ui import get_platform_adapter
from pycore import THREAD_BUS

# Get platform adapter
adapter = get_platform_adapter()

# Print platform info
adapter.print_platform_info()

# Create tray menu
tray_menu = []
if adapter.can_use_tray():
    tray_menu = [
        {"text": "Show Module Caller", "action": "ui.show"},
        {"text": "---"},
        {"text": "Restart", "action": "app.restart"},
        {"text": "Exit", "action": "app.exit"}
    ]

# Create launcher config
config = LauncherConfig(
    app_id="pycore_callmodule",
    app_name="Pycore Module Caller",
    singleton=True,
    shutdown_existing=True,

    # Auto-configured tray
    enable_tray=adapter.can_use_tray(),
    tray_backend="auto",
    tray_menu_items=tray_menu,

    # Services
    services={
        'heartbeat': {},
        'rpc_v2': {
            'port': 59000,
            'host': '0.0.0.0',
            'debug': True
        }
    }
)

# Launch
launcher = ServiceLauncher(config)
launcher.start()

# Register tray event handlers
if adapter.can_use_tray():
    THREAD_BUS.register_event_handler('ui.show', handle_show_window)
    THREAD_BUS.register_event_handler('app.restart', handle_restart)
```

### Example 2: Conditional Features Based on Platform

```python
from pycore.pyutils.native_ui import get_platform_adapter, NativeUIConfig, launch_native_app

adapter = get_platform_adapter()

# Base config
config = NativeUIConfig(
    app_id="myapp",
    app_name="My Application",
    main_entry=main_entry_func
)

# Platform-specific features
if adapter.is_windows:
    # Windows-specific: enable notifications
    config.enable_notifications = True
    config.notification_icon = "windows_icon.ico"
elif adapter.is_linux:
    # Linux-specific: check X11 availability
    if adapter.has_x11:
        config.enable_tray = True
        config.tray_type = "pystray"
    else:
        print("Headless mode - tray disabled")
        config.enable_tray = False
elif adapter.is_macos:
    # macOS-specific: use dock icon
    config.enable_dock_menu = True

launch_native_app(config)
```

## API Reference

### PlatformAdapter

#### Properties
- `platform: Platform` - Current platform enum
- `is_windows: bool` - Running on Windows
- `is_linux: bool` - Running on Linux
- `is_macos: bool` - Running on macOS
- `has_gui: bool` - GUI available
- `has_x11: bool` - X11 display available (Linux)

#### Methods
- `can_use_tray() -> bool` - Check if tray available
- `can_use_notifications() -> bool` - Check if notifications available
- `needs_sandbox_disable() -> bool` - Check if QtWebEngine needs --no-sandbox
- `get_recommended_tray_backend() -> TrayBackend` - Get recommended backend
- `select_tray_backend(preferred: Optional[str]) -> TrayBackend` - Select backend
- `get_qtwebengine_flags(...) -> str` - Get Chromium flags
- `get_windows_appusermodelid(app_id, app_name) -> Optional[str]` - Get AppUserModelID
- `set_windows_appusermodelid(app_id, app_name) -> bool` - Set AppUserModelID
- `adapt_config(config: Dict) -> Dict` - Adapt config for platform
- `get_platform_info() -> Dict` - Get platform info dict
- `print_platform_info()` - Print platform info

### Enums

#### Platform
- `WINDOWS` = "windows"
- `LINUX` = "linux"
- `MACOS` = "macos"
- `UNKNOWN` = "unknown"

#### TrayBackend
- `PYSTRAY` = "pystray" - Tkinter + pystray (lightweight)
- `PYSIDE6` = "pyside6" - Qt system tray (integrated)
- `NONE` = "none" - No tray support

## Troubleshooting

### Linux: Tray Not Working

**Problem**: Tray not appearing on Linux

**Solution**:
```python
from pycore.pyutils.native_ui import get_platform_adapter

adapter = get_platform_adapter()

# Check X11 availability
if not adapter.has_x11:
    print("No X11 display - tray requires DISPLAY environment variable")
    print("Run: export DISPLAY=:0")
```

### Linux: Running as Root

**Problem**: QtWebEngine error "Running as root without --no-sandbox"

**Solution**: Platform adapter automatically detects root and adds `--no-sandbox` flag
```python
adapter = get_platform_adapter()
if adapter.needs_sandbox_disable():
    print("Running as root - sandbox disabled automatically")
```

### Windows: Taskbar Icon Not Grouping

**Problem**: Multiple instances show separate taskbar icons

**Solution**:
```python
from pycore.pyutils.native_ui import get_platform_adapter

adapter = get_platform_adapter()
if adapter.is_windows:
    adapter.set_windows_appusermodelid("myapp", "My Application")
```
