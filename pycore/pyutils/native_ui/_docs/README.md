# Native UI Refactoring - Design Confirmation

## Executive Summary

This document confirms the complete design for Native UI refactoring before implementation.
All code will be in English with English comments and documentation.

## Design Principles

### 1. Single Entry Point

**✅ CONFIRMED**: `launch_native_app(config)` is the ONLY public API

```python
from pycore.pyutils.native_ui import launch_native_app, NativeUIConfig

config = NativeUIConfig(
    app_id="matrix",
    app_name="matrix.app_name",  # i18n key supported
    main_entry=main_app_entry,
    url="http://localhost:3000",
    enable_tray=True
)
launch_native_app(config)
```

### 2. Parameter-Driven Control

**✅ CONFIRMED**: All UI behavior controlled by NativeUIConfig parameters

| Parameter | Controls | Auto-handled |
|-----------|----------|--------------|
| `app_id` | Port allocation, paths | ✅ Port range auto-assigned |
| `show_debug_window` | Tkinter debug window | ✅ Startup thread creation |
| `enable_tray` | System tray | ✅ Tray creation |
| `tray_type` | Tray implementation | ✅ "tk" or "pyside6" |
| `url` | Main window content | ✅ Type detection |
| `url_type` | URL processing | ✅ Auto-detection |
| `window_size` | Window dimensions | ✅ Default (1280, 900) |
| `window_title_key` | Window title i18n | ✅ Auto-generated |
| `on_ready_callbacks` | Ready event | ✅ Queue execution |
| `on_closing_callbacks` | Cleanup | ✅ Queue execution |
| `on_closed_callbacks` | Post-cleanup | ✅ Queue execution |
| `enable_restart` | Restart support | ✅ Built-in logic |

### 3. Automatic Handling

**✅ CONFIRMED**: Library handles complexity internally

- Port allocation (based on app_id)
- Singleton detection
- i18n initialization (if {app_id}_i18n/ exists)
- Icon/logo path detection
- URL type detection
- Callback queue management
- Dependency installation
- Framework initialization

### 4. Separation of Concerns

**✅ CONFIRMED**: Clear responsibilities

```
User Code
    ↓
launch_native_app()  ← Entry point + orchestration
    ↓
├── NativeUILauncher ← ONLY singleton detection
├── TkinterStartupThread ← ONLY debug window
├── CallbackManager ← ONLY callback execution
├── URLHandler ← ONLY URL processing
└── PySide6Framework ← ONLY main UI
```

## Architecture Components

### Component 1: NativeUIConfig

**Purpose**: Single configuration object

**Features**:
- All parameters with defaults
- Auto-validation in `__post_init__`
- Auto-path detection
- Auto-key generation

**Example**:
```python
config = NativeUIConfig(
    # Required
    app_id="matrix",
    app_name="matrix.app_name",
    main_entry=main_app_entry,

    # Optional (all have defaults)
    url="http://localhost:3000",
    enable_tray=True,
    tray_type="pyside6",
    show_debug_window=True
)
```

### Component 2: launch_native_app()

**Purpose**: Main orchestration function

**Responsibilities**:
1. Validate config
2. Allocate ports automatically
3. Initialize i18n automatically
4. Process URL
5. Detect singleton
6. Create debug window (if enabled)
7. Check dependencies
8. Output flow (if PySide6 tray)
9. Call main_entry()
10. Create PySide6 UI
11. Execute callbacks
12. Enter event loop

**Does NOT**:
- Contain UI logic (delegates to framework)
- Parse command-line args (launcher responsibility)
- Manage services (user responsibility)

### Component 3: NativeUILauncher

**Purpose**: ONLY singleton detection + parameter forwarding

**Does**:
- Detect existing instance on port range
- Bind to available port
- Forward parameters to launch_app_with_startup()
- Return LaunchResult

**Does NOT**:
- Create any UI
- Process URLs
- Manage callbacks
- Initialize services

### Component 4: CallbackManager

**Purpose**: Queue-based callback execution

**Features**:
- Separate queues for ready/closing/closed
- Sequential execution
- Error handling per callback
- Debug logging

**Usage**:
```python
manager = CallbackManager(debug=True)
manager.add_ready_callback(callback1)
manager.add_ready_callback(callback2)
manager.execute_ready_callbacks()
```

### Component 5: URLHandler

**Purpose**: Auto-detect and process URLs

**Supported Types**:
| Type | Example | Processing |
|------|---------|------------|
| `remote` | `http://localhost:3000` | Pass-through |
| `static` | `file:///path/to/index.html` | Convert path |
| `nuxt_app` | `"app_pymatrix"` | Start dev server (TODO) |
| `vue_dist` | `"/path/to/dist"` | Start file server (TODO) |
| `auto` | Any of above | Auto-detect |

**Returns**:
```python
(final_url, detected_type, metadata)
```

### Component 6: PortAllocator

**Purpose**: Auto-assign port ranges

**Built-in Mappings**:
```python
{
    "matrix": (54100, 100),  # 54100-54199
    "mcp": (54200, 100),     # 54200-54299
}
```

**Auto-allocation**:
- Custom apps start at 54300
- Each gets 100 ports
- Auto-increment for new apps

## Complete Launch Flow

### Phase 1: Pre-launch Setup

```
[launch_native_app()]
    ↓
1.1 Validate config
1.2 Auto port allocation
    → get_port_range(app_id) → (port_start, port_range)
1.3 Auto i18n initialization
    → Check pyapps/{app_id}/{app_id}_i18n/
    → Initialize if exists
1.4 Process URL
    → URLHandler.process_url()
    → Returns (final_url, type, metadata)
```

### Phase 2: Singleton Detection

```
[NativeUILauncher]
    ↓
2.1 Create SingletonDetector
2.2 Bind to port in range
2.3 Check for existing instance
    → If exists: Show message and exit
    → If not: Continue
```

### Phase 3: Debug Window (Optional)

```
IF show_debug_window=True:
    ↓
3.1 Create TkinterStartupThread
    → app_name=f"{config.app_name} - Debug Log"
    → width, height from config
    → enable_language_selector from config
3.2 Start thread
3.3 Register ColorPrint callback
    → All logs appear in debug window
3.4 Wait for ready signal
```

### Phase 4: Dependency Check

```
[launch_app_with_startup()]
    ↓
4.1 Call check_and_install_dependencies()
4.2 Install missing packages
    → PySide6
    → PySide6-WebEngine
    → etc.
4.3 Wait minimum display time
    → config.min_display_time (default: 2.0s)
```

### Phase 5: PySide6 Tray Check (IMPORTANT)

```
IF tray_type="pyside6":
    ↓
5.1 Verify PySide6 installed
    → try: import pycore.pyutils.native_ui.pyside6
5.2 Output complete flow status
    → See LAUNCH_FLOW.md for details
5.3 Show next steps
    → Phase 6: Main entry
    → Phase 7: Create UI
    → Phase 8: Ready callbacks
    → Phase 9: Event loop
```

**Why this matters**:
- PySide6 installed AFTER debug window
- Debug window uses Tkinter (always available)
- User sees complete status
- Clear indication of progress

### Phase 6: Main Application Entry

```
[user's main_entry()]
    ↓
6.1 Start services
    → Frontend server
    → Backend API
    → Database
6.2 Store service references
6.3 Return (don't block)
```

### Phase 7: Create PySide6 UI

```
[PySide6Framework]
    ↓
7.1 Create PySide6UIConfig
    → Convert NativeUIConfig to PySide6UIConfig
    → webview_url = final_url
    → window_title = resolve_i18n(window_title_key)
7.2 Convert tray menu items
    → Dict → PySide6TrayMenuItem
    → Resolve i18n for text
7.3 Wire callbacks
    → on_ready → callback_manager.execute_ready_callbacks
    → on_closing → callback_manager.execute_closing_callbacks
    → on_closed → callback_manager.execute_closed_callbacks
7.4 Create framework
    → PySide6Framework(pyside_config)
7.5 Create main window
7.6 Create system tray (if enabled)
```

### Phase 8: Execute Ready Callbacks

```
[CallbackManager]
    ↓
8.1 Built-in ready logic
    → ColorPrint success messages
8.2 User callbacks
    → config.on_ready_callbacks[0]()
    → config.on_ready_callbacks[1]()
    → ...
```

### Phase 9: Event Loop

```
[PySide6Framework.start()]
    ↓
9.1 Show main window
9.2 Enter Qt event loop (BLOCKS)
9.3 Wait for close signal
```

### Phase 10: Shutdown

```
[Close Event]
    ↓
10.1 User closing callbacks
    → callback_manager.execute_closing_callbacks()
    → Stop services
    → Save state
10.2 Built-in cleanup
    → Close windows
    → Destroy tray
    → Cleanup resources
10.3 User closed callbacks
    → callback_manager.execute_closed_callbacks()
    → Final logging
```

## Callback System

### Callback Queues

```python
config = NativeUIConfig(
    # ...
    on_ready_callbacks=[
        lambda: print("Ready 1"),
        lambda: print("Ready 2"),
        service_ready_handler
    ],
    on_closing_callbacks=[
        stop_backend_server,
        close_database_connections,
        save_application_state
    ],
    on_closed_callbacks=[
        log_shutdown_event,
        cleanup_temp_files
    ]
)
```

### Execution Order

**on_ready**:
```
1. [Built-in] Framework initialized
2. [Built-in] UI created
3. [User] on_ready_callbacks[0]
4. [User] on_ready_callbacks[1]
...
```

**on_closing**:
```
1. [User] on_closing_callbacks[0]  ← USER FIRST!
2. [User] on_closing_callbacks[1]
...
n. [Built-in] Close windows
n+1. [Built-in] Destroy tray
```

**on_closed**:
```
1. [Built-in] Signal complete
2. [User] on_closed_callbacks[0]
3. [User] on_closed_callbacks[1]
...
```

### Error Handling

Each callback wrapped in try-except:
```python
try:
    callback()
except Exception as e:
    ColorPrint.red(f"Error in callback: {e}")
    traceback.print_exc()
    # Continue with next callback
```

## Window Title Standard

### Requirement

**MUST** define window title key in ALL translation files

### Format

```python
# Auto-generated
window_title_key = f"{app_id}.window.title"

# Example for Matrix
"matrix.window.title"
```

### Translation Files

**translations_zh.json**:
```json
{
  "matrix.window.title": "星灿传媒科技-云矩阵"
}
```

**translations_en.json**:
```json
{
  "matrix.window.title": "Xingcan Media Technology - Cloud Matrix"
}
```

### Resolution

```python
i18n = get_i18n_manager()
window_title = i18n.get(config.window_title_key)
# Returns: "星灿传媒科技-云矩阵" (Chinese) or "Xingcan..." (English)
```

## Restart Functionality

### Configuration

```python
config = NativeUIConfig(
    # ...
    enable_restart=True,
    on_restart_callback=custom_restart_logic  # Optional
)
```

### Built-in Restart Logic

```python
def restart():
    """Restart application with same arguments"""
    # 1. Execute closing callbacks
    callback_manager.execute_closing_callbacks()

    # 2. Execute restart callback (if set)
    if config.on_restart_callback:
        config.on_restart_callback()

    # 3. Restart process
    import sys, os
    python = sys.executable
    os.execl(python, python, *sys.argv)
```

### Tray Menu Integration

```python
tray_menu_items=[
    {"text": "matrix.tray.open_frontend", "callback": open_frontend},
    {"text": "matrix.tray.restart", "callback": restart},  # ← Restart item
    {"text": "matrix.tray.exit", "callback": exit_app}
]
```

## PySide6 Tray Flow Output

### When to Output

**ONLY when**:
- `tray_type="pyside6"` AND
- After Phase 4 (dependency check) AND
- PySide6 successfully imported

### What to Output

```
==================================================================
 LAUNCH FLOW - PYSIDE6 TRAY MODE
==================================================================

Current Phase: PySide6 Tray Verification

✓ Phase 1: Pre-launch Setup - COMPLETED
  - Port range: 54100-54199
  - i18n initialized: zh
  - URL processed: http://localhost:3000 (remote)

✓ Phase 2: Singleton Detection - COMPLETED
  - Bound to port: 54100
  - No existing instance found

✓ Phase 3: Debug Window - COMPLETED
  - Debug window created
  - ColorPrint callback registered

✓ Phase 4: Dependency Check - COMPLETED
  - PySide6: installed
  - PySide6-WebEngine: installed

✓ Phase 5: PySide6 Tray Check - COMPLETED
  - PySide6 verified
  - Tray creation enabled

→ Phase 6: Main Application Entry - STARTING
→ Phase 7: Create PySide6 UI - PENDING
→ Phase 8: Execute Ready Callbacks - PENDING
→ Phase 9: Event Loop - PENDING

Next Steps:
  1. Call user main_entry()
  2. Create PySide6 framework
  3. Create system tray with menu items:
     - Open Frontend
     - Open API Docs
     - Restart
     - Exit
  4. Load URL in main window: http://localhost:3000
  5. Enter event loop

==================================================================
```

## TODO Items (Future Implementation)

### TODO 1: Nuxt App Auto-start

**Current**: Assumes Nuxt dev server already running

**Need**: Detect and start Nuxt dev server

```python
# In url_handler.py _process_nuxt_app()
def _process_nuxt_app(self, url: str):
    app_name = url
    app_dir = self.project_root / "poly_apps" / "nuxt_main" / "apps" / app_name

    # TODO: Start Nuxt dev server
    # 1. Detect if already running (check port)
    # 2. If not, start: npm run dev --prefix app_dir
    # 3. Wait for ready signal
    # 4. Return dev server URL

    # For now:
    return "http://localhost:3000", "nuxt_app", metadata
```

### TODO 2: Vue Dist File Server

**Current**: Uses `file://` protocol

**Need**: Start local HTTP server

```python
# In url_handler.py _process_vue_dist()
def _process_vue_dist(self, url: str):
    dist_dir = Path(url).resolve()

    # TODO: Start local file server
    # 1. Find available port
    # 2. Start: python -m http.server port --directory dist_dir
    # 3. Return: http://localhost:{port}

    # For now:
    return f"file:///{dist_dir}/index.html", "vue_dist", metadata
```

### TODO 3: Complete PySide6 Integration

**Need**: Pass all config to PySide6Framework

```python
# In launch_native_app.py
# Currently: Uses old launcher.launch() API
# TODO: Direct PySide6Framework creation with all parameters
```

## Backward Compatibility

### Strategy

**Keep old API**:
- Mark as DEPRECATED
- Still functional
- Point to new API in docs

**Migration Path**:
```python
# Old way (DEPRECATED)
from pycore.pylauncher import NativeUILauncher
launcher = NativeUILauncher(...)
launcher.launch(...)

# New way (RECOMMENDED)
from pycore.pyutils.native_ui import launch_native_app, NativeUIConfig
config = NativeUIConfig(...)
launch_native_app(config)
```

## Implementation Status

### ✅ Completed

- [x] NativeUIConfig dataclass
- [x] CallbackManager
- [x] PortAllocator
- [x] URLHandler
- [x] LAUNCH_FLOW.md documentation
- [x] DESIGN_CONFIRMATION.md (this file)

### 🔄 In Progress

- [ ] Complete launch_native_app() implementation
- [ ] PySide6 integration
- [ ] Tray menu conversion

### 📋 Pending

- [ ] Update matrix_main.py
- [ ] Update development guide
- [ ] Implement Nuxt auto-start (TODO)
- [ ] Implement Vue file server (TODO)
- [ ] Implement restart functionality

## Design Approval Checklist

Before proceeding with implementation, confirm:

- [ ] Single entry point API is clear
- [ ] All parameters are documented
- [ ] Launch flow is logical
- [ ] Callback system is intuitive
- [ ] PySide6 tray flow is correct
- [ ] Window title standard is acceptable
- [ ] Restart functionality is sufficient
- [ ] TODO items are clearly marked
- [ ] Backward compatibility is addressed

## Questions for Review

1. **Is the callback queue design correct**?
   - User callbacks in list
   - Execute sequentially
   - Error handling per callback

2. **Is the window title key format acceptable**?
   - `{app_id}.window.title`
   - Must exist in ALL translation files
   - Auto-generated if not specified

3. **Is the PySide6 tray flow output sufficient**?
   - Shows all completed phases
   - Shows pending phases
   - Shows next steps

4. **Should restart be enabled by default**?
   - Current: `enable_restart=False`
   - Alternative: `enable_restart=True`

## Next Steps

After approval:
1. Complete launch_native_app() implementation
2. Integrate with PySide6Framework
3. Update matrix_main.py as example
4. Update development guide
5. Test complete flow
6. Mark old API as deprecated

## Conclusion

This design provides:
- ✅ Single, simple entry point
- ✅ All parameters with defaults
- ✅ Auto-handling of complexity
- ✅ Clear separation of concerns
- ✅ Complete documentation
- ✅ Future extensibility

**Ready for implementation**: Awaiting final approval.
