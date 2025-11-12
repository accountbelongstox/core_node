# Native UI Directory Structure

## Overview

The Native UI module has been reorganized into a step-based directory structure for better management and development clarity. Each step represents a phase in the application launch flow.

## Root Directory

```
native_ui/
├── __init__.py                 # ONLY PUBLIC ENTRY FILE
├── _docs/                      # Documentation files
├── _prompts/                   # Development prompts
├── step1_config/               # Configuration (Phase 1)
├── step2_port_url/             # Port & URL Management (Phase 2)
├── step3_launcher/             # Main Launcher (Phase 3)
├── step4_startup/              # Startup Window (Phase 4)
├── step5_main_ui/              # Main UI (Phase 5)
├── step6_tray/                 # System Tray (Phase 6)
├── step7_managers/             # Lifecycle Managers (Phase 7)
├── step8_utils/                # Utility Functions (Phase 8)
├── step0_i18n/                 # Internationalization (Initialization Phase)
└── step10_resource/            # Static Resources (Phase 10)
```

## Step-by-Step Breakdown

### Step 1: Configuration (step1_config/)
**Phase**: Application Configuration Initialization

Files:
- `app_config.py` - NativeUIConfig dataclass (NEW)
- `config.py` - Legacy UIConfig
- `tray_config.py` - Tray configuration

Purpose: Unified configuration management for native UI applications.

### Step 2: Port & URL Management (step2_port_url/)
**Phase**: Port Allocation and URL Processing

Files:
- `port_allocator.py` - Auto port range allocation (NEW)
- `url_handler.py` - URL type detection and processing (NEW)

Purpose: Automatic port allocation and URL processing for different types (remote, static, Nuxt, Vue).

### Step 3: Launcher (step3_launcher/)
**Phase**: Main Application Launcher

Files:
- `launch_native_app.py` - Simplified main entry point (NEW)
- `launcher_with_startup.py` - Legacy launcher with startup window

Purpose: Single-function entry point that orchestrates entire launch flow.

### Step 4: Startup (step4_startup/)
**Phase**: Debug/Startup Window Display

Files:
- `startup_window.py` - Tkinter startup window
- `startup_window_thread.py` - Startup window thread

Purpose: Debug window display during application initialization with dependency installation progress.

### Step 5: Main UI (step5_main_ui/)
**Phase**: Main Application UI

Subdirectories:
- `pyside6/` - PySide6 framework components
- `tkinter/` - Tkinter themed components

Purpose: PySide6 and Tkinter UI implementations.

### Step 6: Tray (step6_tray/)
**Phase**: System Tray Integration

Files:
- `tkinter_system_tray.py` - Tkinter system tray implementation

Purpose: System tray icon and menu management.

### Step 7: Managers (step7_managers/)
**Phase**: Lifecycle and Resource Management

Files:
- `callback_manager.py` - Callback queue management (NEW)
- `timer_manager.py` - Periodic task execution
- `shutdown_manager.py` - Graceful shutdown control
- `thread_bus_manager.py` - THREAD_BUS scoped access
- `file_monitor.py` - File change monitoring

Purpose: Application lifecycle management and resource monitoring.

### Step 8: Utils (step8_utils/)
**Phase**: Utility Functions

Files:
- `signals.py` - Signal management
- `image_converter.py` - Image conversion utilities
- `resize_handles.py` - Window resize handles
- `embedded_images.py` - Base64 embedded images

Purpose: Utility functions and helper classes.

### Step 0: I18n (step0_i18n/) - Initialization Phase
**Phase**: Internationalization

Files:
- `i18n_manager.py` - I18n singleton manager
- `translations/` - Translation files

Purpose: Multi-language support system.

### Step 10: Resource (step10_resource/)
**Phase**: Static Resources

Files:
- HTML loading animations
- Static assets

Purpose: Static resource files for UI.

## Public API

### Entry Point
Only `__init__.py` in the root directory is the public interface. All imports should use:

```python
from pycore.pyutils.native_ui import (
    launch_native_app,
    NativeUIConfig,
    # ...other exports
)
```

### NEW: Simplified API (Recommended)
```python
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

config = NativeUIConfig(
    app_id="matrix",
    app_name="Matrix Application",
    main_entry=main_app_entry,
    url="http://localhost:3000",
    enable_tray=True,
    tray_menu_items=[
        {"text": "Open Frontend", "callback": open_frontend},
        {"text": "Exit", "callback": exit_app}
    ]
)

launch_native_app(config)
```

## Internal Imports

Internal modules should use absolute imports with step directories:

```python
# Good
from pycore.pyutils.native_ui.step1_config import NativeUIConfig
from pycore.pyutils.native_ui.step2_port_url import get_port_range

# Bad - DO NOT USE
from ..step1_config import NativeUIConfig  # Relative import
from pycore.pyutils.native_ui.app_config import NativeUIConfig  # Old path
```

## Migration from Old Structure

Old Path → New Path mapping:

```
app_config.py → step1_config/app_config.py
port_allocator.py → step2_port_url/port_allocator.py
url_handler.py → step2_port_url/url_handler.py
launch_native_app.py → step3_launcher/launch_native_app.py
launcher_with_startup.py → step3_launcher/launcher_with_startup.py
startup_window.py → step4_startup/startup_window.py
startup_window_thread.py → step4_startup/startup_window_thread.py
pyside6/ → step5_main_ui/pyside6/
tkinter/ → step5_main_ui/tkinter/
tkinter_system_tray.py → step6_tray/tkinter_system_tray.py
callback_manager.py → step7_managers/callback_manager.py
timer_manager.py → step7_managers/timer_manager.py
shutdown_manager.py → step7_managers/shutdown_manager.py
thread_bus_manager.py → step7_managers/thread_bus_manager.py
file_monitor.py → step7_managers/file_monitor.py
signals.py → step8_utils/signals.py
image_converter.py → step8_utils/image_converter.py
resize_handles.py → step8_utils/resize_handles.py
embedded_images.py → step8_utils/embedded_images.py
i18n/ → step0_i18n/
resource/ → step10_resource/
```

## Benefits of Step-Based Structure

1. **Clear Launch Flow**: Steps follow the actual application launch sequence
2. **Easy Navigation**: Developers can quickly find relevant files by phase
3. **Better Organization**: Logical grouping by functionality and timing
4. **Scalability**: Easy to add new steps or expand existing ones
5. **Documentation**: Self-documenting structure through step naming

## Development Guidelines

1. **Single Entry**: Only `__init__.py` should be public interface
2. **No Direct Access**: Never import from step directories in external code
3. **Absolute Imports**: Always use absolute imports within native_ui
4. **Step Cohesion**: Keep files within their appropriate step directory
5. **Documentation**: Update this file when adding new steps or files
