# Pycore Module Caller Startup Chain Analysis

> **Startup Command**: `python .\pycore_module_caller.py`
> **Analysis Date**: 2025-12-07
> **Important**: This is the UNIFIED startup entry point (never separate this path)

---

## 📋 Complete Call Chain

### Level 1: Root Entry Point
**File**: `pycore_module_caller.py` (project root directory)

```
python pycore_module_caller.py [--host HOST] [--port PORT] [--debug]
```

**Architecture Layers**:
1. **callmodule/**: Builds configuration and registers event handlers
2. **pylauncher/**: Handles singleton detection and service launching
3. **pythreadpool/**: Starts actual service threads

### Level 2: Startup Sequence

```python
# pycore_module_caller.py:33-95
def main(host='0.0.0.0', port=59000, debug=False):
    # Step 1: Build configuration (callmodule layer)
    config = build_launcher_config(host=host, port=port, debug=debug)

    # Step 2: Start services (pylauncher layer)
    launcher = ServiceLauncher(config)
    launcher.start()

    # Step 3: Register event handlers (callmodule layer)
    register_event_handlers(launcher, port)

    # Step 4: Update tray menu with singleton port
    update_tray_menu_with_singleton(launcher, port, singleton_port)

    # Step 5: Setup signal handler (Ctrl+C)
    signal.signal(signal.SIGINT, signal_handler)

    # Step 6: Wait for shutdown signal
    while not THREAD_BUS.is_shutdown_requested():
        time.sleep(0.5)

    # Step 7: Shutdown
    launcher.stop()
```

---

## 🔗 Detailed Call Chain

### 1. Configuration Building

**Source**: `pycore/callmodule/config.py:19-176`

```
pycore_module_caller.py
  └─> build_launcher_config(host, port, debug)
       ├─> Import all routers:
       │    ├─> Management Layer (8 routers)
       │    │    ├─> status_router
       │    │    ├─> config_router
       │    │    ├─> control_router
       │    │    ├─> logs_router
       │    │    ├─> capabilities_router
       │    │    ├─> local_config_router
       │    │    ├─> local_stats_router
       │    │    └─> local_test_router
       │    │
       │    ├─> Local Processing Layer (5 routers)
       │    │    ├─> screenshot_router
       │    │    ├─> image_router
       │    │    ├─> audio_router
       │    │    ├─> file_router
       │    │    └─> video_router
       │    │
       │    ├─> Upload Layer (1 router)
       │    │    └─> upload_router
       │    │
       │    ├─> Client Layer (1 router)
       │    │    └─> client_router
       │    │
       │    └─> Legacy Routers (4 routers)
       │         ├─> mcp_router
       │         ├─> code_sync_router
       │         ├─> module_call_router
       │         └─> notebooklm_stt_router
       │
       ├─> Build services dict:
       │    ├─> heartbeat: {}
       │    ├─> rpc_v2: {routers, static_mounts, port, host}
       │    ├─> ui: {webview_url, window_size, ...} (Windows only)
       │    └─> tray: {icon, menu_items, ...} (Windows only)
       │
       └─> Return LauncherConfig(
               app_id="pycore_module_caller",
               singleton=True,
               services=services
           )
```

**Key Configuration Values**:
- **App ID**: `pycore_module_caller`
- **Singleton**: True (port range 59100-59199)
- **RPC Port**: 59000 (default)
- **Total Routers**: 19 routers
- **Static Mounts**: `/desktop` → `pycore/pyctl/desktop/ui`

---

### 2. Service Launching

**Source**: `pycore/pylauncher/service_launcher.py`

```
ServiceLauncher(config).start()
  ├─> Singleton Detection
  │    ├─> Scan ports 59100-59199
  │    ├─> Check for existing instance
  │    ├─> Bind to available port (e.g., 59100)
  │    └─> Set is_primary = True
  │
  ├─> Start Services (via pythreadpool)
  │    ├─> heartbeat service
  │    │    └─> Thread: HeartbeatThread
  │    │
  │    ├─> rpc_v2 service
  │    │    └─> Thread: RPCv2Thread
  │    │         ├─> Create FastAPI app
  │    │         ├─> Register 19 routers
  │    │         ├─> Mount static files (/desktop)
  │    │         └─> Start uvicorn server (port 59000)
  │    │
  │    ├─> ui service (Windows only)
  │    │    └─> Thread: UIThread (PySide6)
  │    │         ├─> Show startup/debug window (tk)
  │    │         ├─> Create main WebView window
  │    │         ├─> Load: http://localhost:59000/web/subtitle
  │    │         └─> Window size: 1000x180
  │    │
  │    └─> tray service (Windows only)
  │         └─> Thread: TrayThread (PySide6)
  │              ├─> Create system tray icon
  │              ├─> Build tray menu (from build_tray_menu)
  │              └─> Enable trigger_shutdown_on_exit
  │
  └─> Return success
```

---

### 3. Event Handler Registration

**Source**: `pycore/callmodule/event_handlers.py:17-90`

```
register_event_handlers(launcher, port)
  └─> Register THREAD_BUS event handlers:
       ├─> 'tray_action_open'
       │    └─> Open browser: http://localhost:{port}/
       │
       ├─> 'tray_action_restart'
       │    └─> Trigger: THREAD_BUS.trigger_event('app.restart')
       │
       ├─> 'tray_action_exit'
       │    └─> Trigger: THREAD_BUS.request_shutdown()
       │
       ├─> 'tray_action_toggle_startup'
       │    └─> WindowsStartupManager.toggle()
       │
       ├─> 'tray_action_toggle_voice_subtitle'
       │    └─> Trigger: THREAD_BUS.trigger_event('voice_subtitle_ui.toggle')
       │
       └─> 'tray_action_toggle_code_sync'
            └─> get_code_sync_manager().toggle_mode()
```

---

### 4. Tray Menu Update

**Source**: `pycore/callmodule/config.py:178-201`

```
update_tray_menu_with_singleton(launcher, port, singleton_port)
  ├─> Get tray service from launcher
  ├─> Rebuild menu with singleton port
  │    └─> build_tray_menu(port=59000, singleton_port=59100)
  │
  └─> Trigger: THREAD_BUS.trigger_event('tray.update_menu', {...})
```

---

## 🎛️ Tray Menu Structure

**Source**: `pycore/callmodule/tray_menu.py`

```
build_tray_menu(port, singleton_port) returns:
  [
    {
      "text": "🌐 Open Web Interface",
      "event": "tray_action_open"
    },
    {
      "text": "🔄 Restart Service",
      "event": "tray_action_restart"
    },
    {
      "text": "separator"
    },
    {
      "text": "📊 API Dashboard",
      "event": "tray_action_api_dashboard"
    },
    {
      "text": "💬 Voice Subtitle Window",
      "event": "tray_action_toggle_voice_subtitle"
    },
    {
      "text": "separator"
    },
    {
      "text": "🔧 Toggle Auto-Start (Windows)",
      "event": "tray_action_toggle_startup"
    },
    {
      "text": "🔄 Toggle Code Sync",
      "event": "tray_action_toggle_code_sync"
    },
    {
      "text": "separator"
    },
    {
      "text": "ℹ️ Info",
      "submenu": [
        {
          "text": f"RPC Port: {port}",
          "event": None
        },
        {
          "text": f"Singleton Port: {singleton_port}",
          "event": None
        },
        {
          "text": "separator"
        },
        {
          "text": "📝 View Logs",
          "event": "tray_action_view_logs"
        }
      ]
    },
    {
      "text": "separator"
    },
    {
      "text": "❌ Exit",
      "event": "tray_action_exit"
    }
  ]
```

---

## 🔄 Service Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  pycore_module_caller.py (Root Entry)                          │
│  python pycore_module_caller.py --host 0.0.0.0 --port 59000    │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ├─> build_launcher_config()
                      │    └─> Import 19 routers
                      │    └─> Build LauncherConfig
                      │
                      ├─> ServiceLauncher(config)
                      │    │
                      │    ├─> Singleton Detection (59100-59199)
                      │    │
                      │    └─> Start Services:
                      │         │
                      │         ├─> HeartbeatThread
                      │         │    └─> Keep singleton alive
                      │         │
                      │         ├─> RPCv2Thread (port 59000)
                      │         │    ├─> FastAPI app
                      │         │    ├─> 19 routers
                      │         │    └─> Static: /desktop
                      │         │
                      │         ├─> UIThread (Windows)
                      │         │    ├─> Startup window (tk)
                      │         │    └─> WebView: http://localhost:59000/web/subtitle
                      │         │
                      │         └─> TrayThread (Windows)
                      │              └─> System tray with menu
                      │
                      ├─> register_event_handlers(launcher, port)
                      │    └─> Register 6 THREAD_BUS handlers
                      │
                      ├─> update_tray_menu_with_singleton(...)
                      │    └─> Update menu with singleton port
                      │
                      └─> Wait for shutdown
                           └─> THREAD_BUS.is_shutdown_requested()
```

---

## 📊 Services Breakdown

### Service: heartbeat
- **Type**: HeartbeatThread
- **Purpose**: Keep singleton port alive
- **Port**: Singleton port (59100-59199)

### Service: rpc_v2
- **Type**: RPCv2Thread
- **Purpose**: FastAPI HTTP/WebSocket server
- **Port**: 59000 (default)
- **Routers**: 19 routers
  - Management Layer: 8
  - Local Processing: 5
  - Upload Layer: 1
  - Client Layer: 1
  - Legacy: 4
- **Static Mounts**: `/desktop` → `pycore/pyctl/desktop/ui`

### Service: ui (Windows only)
- **Type**: UIThread (PySide6)
- **Purpose**: Voice subtitle window
- **URL**: http://localhost:59000/web/subtitle
- **Window Size**: 1000x180
- **Frameless**: False
- **Show on Start**: True
- **Startup Window**: True (tk debug window)

### Service: tray (Windows only)
- **Type**: TrayThread (PySide6)
- **Purpose**: System tray icon and menu
- **Icon**: `pycore/pyutils/native_ui/step1_config/app_icon.png`
- **Trigger Shutdown**: True (exit on tray exit)

---

## 🌐 Network Ports

| Service | Port | Protocol | Purpose |
|---------|------|----------|---------|
| Singleton | 59100-59199 | TCP | Instance detection |
| RPC v2 | 59000 | HTTP/WS | API server |
| Frontend (dev) | 3000 | HTTP | Vite dev server |

---

## 🎯 Startup Command Variations

```bash
# Default (0.0.0.0:59000)
python pycore_module_caller.py

# Custom host and port
python pycore_module_caller.py --host 127.0.0.1 --port 8000

# Debug mode
python pycore_module_caller.py --debug

# All options
python pycore_module_caller.py --host 0.0.0.0 --port 59000 --debug
```

---

## 🔧 Alternative Entry Points

### 1. Module Entry (Broken)
```bash
python -m pycore.callmodule
# ERROR: Missing launch_platform_aware function
```

### 2. Service Mode (Working)
```bash
python -m pycore.callmodule --service
# Uses uvicorn directly (no UI, no tray, no singleton)
```

### 3. Direct App Factory (Working)
```bash
python -m uvicorn pycore.callmodule.app:create_app --factory --port 59000
# Direct FastAPI server (no services, no UI)
```

---

## 🚀 Complete Startup Flow Timeline

```
T+0.0s:  python pycore_module_caller.py
T+0.1s:  Import dependencies
T+0.2s:  build_launcher_config()
          └─> Import 19 routers
T+0.3s:  ServiceLauncher(config)
T+0.4s:  Singleton detection (scan 59100-59199)
T+0.5s:  Bind to port 59100
T+0.6s:  Start HeartbeatThread (port 59100)
T+0.7s:  Start RPCv2Thread (port 59000)
          ├─> Create FastAPI app
          ├─> Register 19 routers
          └─> Mount static files
T+1.0s:  Start UIThread (Windows)
          ├─> Show tk startup window
          └─> Create PySide6 WebView window
T+1.2s:  Start TrayThread (Windows)
          └─> Create system tray icon
T+1.5s:  register_event_handlers()
          └─> Register 6 THREAD_BUS handlers
T+1.6s:  update_tray_menu_with_singleton()
          └─> Update tray menu (59100)
T+1.7s:  Setup signal handler (Ctrl+C)
T+1.8s:  Main loop starts (wait for shutdown)
T+∞:     Running... (Press Ctrl+C or use tray to exit)
```

---

## 📝 Key Differences from Matrix

| Feature | Matrix | Pycore Module Caller |
|---------|--------|---------------------|
| Entry Point | `pymain.py app=matrix` | `pycore_module_caller.py` |
| Config Pattern | NativeUIConfig | LauncherConfig (ServiceLauncher) |
| Frontend | Vite + React (matrixui) | Vite + React (pycore-management) |
| Frontend Port | 38007 | 3000 |
| Backend Port | 48000 | 59000 |
| UI Integration | launch_native_app() | ServiceLauncher |
| Tray | Disabled | Enabled (Windows) |
| Singleton | Via NativeUI | Via ServiceLauncher (59100-59199) |
| Service Mode | No | Yes (--service flag) |

---

## 🎯 Summary

**Unified Entry Point**: `python pycore_module_caller.py`

**Key Components**:
1. **Configuration**: `build_launcher_config()` (pycore/callmodule/config.py)
2. **Service Launcher**: `ServiceLauncher` (pycore/pylauncher)
3. **Event Handlers**: `register_event_handlers()` (pycore/callmodule/event_handlers.py)
4. **Tray Menu**: `build_tray_menu()` (pycore/callmodule/tray_menu.py)

**Services Started**:
- Heartbeat (singleton keepalive)
- RPC v2 (FastAPI server, 19 routers)
- UI (PySide6 WebView, Windows only)
- Tray (PySide6 system tray, Windows only)

**Frontend**: `poly_apps/pycore-management` (Vite + React, port 3000)

**Backend**: FastAPI on port 59000 (19 routers, 4 layers)

---

**Status**: ✅ Complete Analysis
**Date**: 2025-12-07
