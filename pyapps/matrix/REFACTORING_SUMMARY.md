# Matrix Application - Refactoring Summary

## Overview

The Matrix application has been refactored to use `pycore.pylauncher` and `pycore.pyutils.native_ui` for a more integrated, professional application architecture.

## Architecture Changes

### Before (Custom Implementation)

```
matrix_main.py
├── Direct frontend launcher (temp batch script)
├── Direct uvicorn backend startup
├── Platform-specific threading logic
└── Manual health checks
```

### After (pylauncher + native_ui)

```
matrix_main.py (Only configuration)
├── UnifiedLauncher
│   ├── MatrixService (custom service)
│   │   ├── FrontendController
│   │   └── BackendController
│   ├── UIThreadService (native UI with webview)
│   └── SystemTray (tray menu)
└── Service lifecycle management
```

## New File Structure

```
pyapps/matrix/
├── controller/
│   ├── __init__.py
│   ├── frontend_controller.py    # Nuxt frontend management
│   ├── backend_controller.py     # FastAPI backend management
│   └── matrix_service.py         # pylauncher integration
├── matrix_main.py                # Simplified entry point
├── config.py                     # Configuration
├── frontend_launcher.py          # Legacy (can be removed)
└── ... (other files)
```

## Component Details

### 1. FrontendController (`controller/frontend_controller.py`)

**Responsibilities:**
- Switch app entry point (index.vue)
- Start factory sync and dev server
- Health check monitoring
- URL management

**Key Methods:**
```python
class FrontendController:
    def switch_entry_point() -> bool
    def start_factory_sync() -> bool
    def wait_for_ready() -> bool
    def start_and_wait() -> bool
    def get_url() -> str
```

**Features:**
- Validates paths before execution
- Platform-specific console handling (Windows/Linux)
- Async health checking with timeout
- Clean process management

### 2. BackendController (`controller/backend_controller.py`)

**Responsibilities:**
- Start FastAPI server
- ADB availability check
- API endpoint management
- Thread-based server execution

**Key Methods:**
```python
class BackendController:
    def start()
    def stop()
    def is_running() -> bool
    def get_api_url() -> str
    def get_docs_url() -> str
```

**Features:**
- Thread-safe server startup
- ADB auto-detection
- URL generation helpers
- Graceful shutdown support

### 3. MatrixService (`controller/matrix_service.py`)

**Responsibilities:**
- Integrate frontend and backend controllers
- Provide unified service interface
- Implement custom pylauncher service
- Service lifecycle coordination

**Key Methods:**
```python
class MatrixService:
    def start()  # Start both frontend and backend
    def stop()   # Stop both services
    def get_frontend_url() -> str
    def get_status() -> dict

def matrix_service_entry(config)  # Entry point for pylauncher
```

**Configuration:**
```python
@dataclass
class MatrixServiceConfig:
    project_root: Optional[Path]
    frontend_port: int = 3007
    frontend_timeout: int = 120
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    backend_mode: str = "dev"
    enable_ui: bool = True
    enable_tray: bool = True
```

### 4. Matrix Main (`matrix_main.py`)

**New Responsibilities:**
- Configure UnifiedLauncher
- Register MatrixService
- Setup system tray menu
- Start native UI with webview

**Simplified Flow:**
```python
def start():
    # 1. Create launcher configuration
    launcher_config = create_launcher_config()

    # 2. Create UnifiedLauncher
    launcher = UnifiedLauncher(launcher_config)

    # 3. Register MatrixService
    launcher.register_custom_service('matrix_service', ...)

    # 4. Start Matrix service
    launcher.start_service('matrix_service')

    # 5. Start native UI (webview)
    launcher.start_service('ui_thread_service')

    # 6. Wait for services
    launcher.wait()
```

## Features Added

### 1. Native UI with WebView

- **Window**: Frameless, resizable native window
- **Content**: Embedded webview displaying frontend URL
- **Size**: 1280x900 (min: 1024x768)
- **Integration**: Automatic frontend URL detection

```python
ui_config = UIServiceConfig(
    app_name="Matrix - Android Device Control",
    window_size=(1280, 900),
    ui_source=f"http://localhost:{Config.FRONTEND_PORT}",
    enable_tray=True,
    frameless=True,
    show_on_start=True
)
```

### 2. System Tray Menu

**Menu Items:**
- Show UI (default action)
- Open Frontend (in browser)
- API Documentation
- Separator
- Restart
- Exit

```python
tray_items = [
    TrayMenuItem("Show UI", on_show_ui, default=True),
    TrayMenuItem.SEPARATOR,
    TrayMenuItem("Open Frontend", on_open_frontend),
    TrayMenuItem("API Documentation", on_open_api_docs),
    TrayMenuItem.SEPARATOR,
    TrayMenuItem("Restart", on_restart),
    TrayMenuItem("Exit", on_exit)
]
```

### 3. Unified Service Management

- **Thread-based**: Each service runs in separate thread
- **Lifecycle**: Unified start/stop/restart
- **Status**: Service health monitoring
- **Graceful Shutdown**: SIGINT/SIGTERM handling

## Benefits

### 1. Separation of Concerns

- **Controllers**: Business logic separated from main entry point
- **Services**: Reusable components for frontend/backend
- **Configuration**: Centralized in dataclasses

### 2. Better Maintainability

- **Modular**: Each controller has single responsibility
- **Testable**: Controllers can be unit tested independently
- **Extensible**: Easy to add new services

### 3. Professional UI

- **Native Window**: Better user experience than console windows
- **System Tray**: Background operation support
- **WebView**: Reuse frontend UI in native window

### 4. Unified Architecture

- **Consistent**: Follows pycore patterns (pylauncher)
- **Reusable**: Controllers can be used in other contexts
- **Standard**: Leverages existing pycore infrastructure

## Migration Guide

### Old Way (Before)

```python
# matrix_main.py - 327 lines
def start():
    # Platform-specific logic
    if platform.system() == 'Windows':
        # Launch frontend via temp script
        # Wait for frontend
        # Start backend in main thread
    else:
        # Start backend in thread
        # Launch frontend in main thread
```

### New Way (After)

```python
# matrix_main.py - 239 lines (much simpler!)
def start():
    # Create launcher
    launcher = UnifiedLauncher(config)

    # Register matrix service
    launcher.register_custom_service('matrix_service', ...)

    # Start all services
    launcher.start_service('matrix_service')
    launcher.start_service('ui_thread_service')

    # Wait
    launcher.wait()
```

## Startup Flow

### 1. Matrix Service Startup

```
matrix_service_entry(config)
  ↓
MatrixService.start()
  ↓
Phase 1: Frontend
  ├── FrontendController.switch_entry_point()
  │   └── node switch-app-entry.js pymatrix
  ├── FrontendController.start_factory_sync()
  │   └── node switch-app-entry-plus.js pymatrix --mode dev
  └── FrontendController.wait_for_ready()
      └── HTTP health check (120s timeout)
  ↓
Phase 2: Backend
  ├── BackendController.start()
  │   └── uvicorn.run(app, ...)
  └── ADB availability check
  ↓
Service Ready
```

### 2. UI Service Startup

```
launcher.start_service('ui_thread_service')
  ↓
NativeUIThread
  ├── Create Tkinter window (1280x900)
  ├── Create WebView widget
  │   └── Load: http://localhost:3007
  ├── Create system tray
  │   └── Menu items + icon
  └── Start Tkinter mainloop
```

## Testing

### Test Basic Startup

```bash
python ./pymain.py app=matrix
```

**Expected Result:**
1. Frontend starts in console window
2. Backend starts in service thread
3. Native UI window appears with webview
4. System tray icon appears
5. All services report ready

### Test System Tray

1. Click tray icon → See menu
2. Click "Show UI" → Window appears
3. Click "Open Frontend" → Browser opens
4. Click "API Documentation" → Docs open
5. Click "Exit" → All services stop

### Test Service Management

```python
# Get service status
status = launcher.get_status()
print(status)
# {
#     'running': True,
#     'services': {
#         'matrix_service': {'running': True, ...},
#         'ui_thread_service': {'running': True, ...}
#     }
# }

# Restart service
launcher.restart_service('matrix_service')

# Stop all
launcher.stop_all()
```

## Known Limitations

1. **WebView Library**: Requires `tkinterweb` or `tkhtmlview`
   - Install: `pip install tkinterweb`
   - Fallback: Shows message if not installed

2. **System Tray**: Requires `pystray`
   - Install: `pip install pystray pillow`
   - Gracefully disabled if not available

3. **Restart**: System tray "Restart" only stops services
   - Full restart requires subprocess (not implemented)

## Future Improvements

1. **WebView Communication**: Implement Python-JavaScript bridge
   - Expose backend API to frontend JS
   - Direct method calls from webview

2. **Configuration UI**: Add settings panel
   - Adjust ports, paths, etc.
   - Save configuration

3. **Service Health**: Advanced monitoring
   - Automatic restart on crash
   - Error notifications in tray

4. **Multi-Instance**: Instance management
   - Prevent multiple instances
   - Switch between instances

## Related Files

- `matrix_main.py` - Entry point (refactored)
- `controller/__init__.py` - Controller package
- `controller/frontend_controller.py` - Frontend management
- `controller/backend_controller.py` - Backend management
- `controller/matrix_service.py` - Service integration
- `config.py` - Application configuration
- `DIRECT_NODE_LAUNCH.md` - Direct Node.js launch documentation
- `CONFIG_FIX_SUMMARY.md` - Configuration fixes
- `STARTUP_FLOW.md` - Original startup flow

## Summary

The refactoring successfully:

- ✅ Moved business logic to controllers
- ✅ Integrated with pylauncher for service management
- ✅ Added native UI with webview
- ✅ Added system tray menu
- ✅ Simplified matrix_main.py
- ✅ Improved separation of concerns
- ✅ Maintained backward compatibility
- ✅ Enhanced user experience

The application now follows pycore architectural patterns and provides a professional desktop application experience.
