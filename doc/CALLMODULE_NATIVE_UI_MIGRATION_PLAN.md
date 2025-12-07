# Callmodule Native UI Migration Plan

> **Date**: 2025-12-07
> **Goal**: Migrate callmodule from ServiceLauncher to NativeUIConfig pattern (like Matrix)

---

## 📋 Configuration Pattern Analysis

### Matrix Configuration Pattern (Reference)

#### 1. Configuration File: `pyapps/matrix/matrix_config/config.py`

```python
class Config:
    APP_NAME = "matrix"

    # Frontend Configuration
    FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "matrixui"
    FRONTEND_PORT = 38007
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"
    FRONTEND_MODE = "dev"  # "dev" or "production"
    FRONTEND_SKIP_BUILD = False
    FRONTEND_FORCE_REBUILD = False

    # Backend Configuration
    WEB_HOST = "0.0.0.0"
    WEB_PORT = 48000
```

#### 2. Main Entry: `pyapps/matrix/matrix_main.py`

```python
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app

config = NativeUIConfig(
    # Basic
    app_id="matrix",
    app_name="Xingcan Media - Cloud Matrix",
    main_entry=matrix_main_entry,
    debug=True,

    # Frontend
    frontend_enabled=True,
    frontend_framework="vite",
    frontend_app_dir=frontend_app_dir,
    frontend_mode=Config.FRONTEND_MODE,
    frontend_port=Config.FRONTEND_PORT,
    frontend_auto_install=True,
    frontend_block_until_ready=(Config.FRONTEND_MODE == "dev"),

    # RPC v2 Backend
    rpc_enabled=True,
    rpc_port=Config.WEB_PORT,
    rpc_host=Config.WEB_HOST,
    rpc_routers=[...],
    rpc_allow_origins=["*"],
    rpc_auto_mount_frontend=True,

    # UI
    window_size="fullscreen",
    show_on_start=True,
    frameless=True,
    icon_path=str(icon_path),

    # Tray
    enable_tray=False,

    # Debug Window
    show_debug_window=True,
)

launch_native_app(config)
```

---

## 🎯 Callmodule Current State

### Current Files

1. **Entry Point**: `pycore/callmodule/__main__.py`
   - Three modes: `--service`, `--tray`, default (platform-aware)
   - `--service`: Direct uvicorn (working)
   - `--tray`: Broken (references missing `launch_windows_tray`)
   - Default: Broken (references missing `launch_platform_aware`)

2. **Config Builder**: `pycore/callmodule/config.py`
   - Builds `LauncherConfig` (old approach)
   - Uses `ServiceLauncher` instead of NativeUI
   - Already has all routers registered

3. **Frontend**: `poly_apps/pycore-management`
   - Vite + React application
   - Dev server port: 3000
   - Backend proxy: http://localhost:59000
   - 95% complete (per FRONTEND_STATUS_UPDATE.md)

4. **Backend**: `pycore/callmodule/app.py`
   - FastAPI application factory
   - Port: 59000 (default)
   - All routers already registered

---

## 🔄 Migration Strategy

### Phase 1: Create Configuration File

**File**: `pycore/callmodule/callmodule_config/config.py`

```python
"""
Pycore Callmodule Configuration
"""
import os
import platform
from pathlib import Path
from pycore.pygvar import PROJECT_ROOT as PYCORE_PROJECT_ROOT

class Config:
    """Callmodule Configuration"""

    # Application Info
    APP_NAME = "callmodule"
    APP_ID = "pycore_callmodule"

    # Project Paths
    PROJECT_ROOT = Path(PYCORE_PROJECT_ROOT)
    APP_ROOT = PROJECT_ROOT / "pycore" / "callmodule"
    RESOURCES_DIR = APP_ROOT / "resources"

    # Frontend Configuration
    FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "pycore-management"
    FRONTEND_PORT = 3000  # Vite dev server port
    FRONTEND_URL = f"http://localhost:{FRONTEND_PORT}"
    FRONTEND_MODE = "dev"  # "dev" or "production"

    # Backend Configuration
    RPC_HOST = "0.0.0.0"
    RPC_PORT = 59000

    # Runtime Mode
    MODE = os.getenv("CALLMODULE_MODE", "dev")

    @classmethod
    def is_dev_mode(cls) -> bool:
        return cls.MODE == "dev"

    @classmethod
    def is_production_mode(cls) -> bool:
        return cls.MODE == "production"

config = Config()
```

### Phase 2: Create Main Entry

**File**: `pycore/callmodule/callmodule_main.py`

```python
"""
Pycore Callmodule - Native UI Integration
"""
import sys
import platform
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from pycore import ColorPrint
from pycore.pyutils.native_ui import NativeUIConfig, launch_native_app
from pycore.callmodule.callmodule_config import Config

def callmodule_main_entry():
    """Callmodule main entry point"""
    # Any initialization code here
    ColorPrint.green("[Callmodule] Main entry initialized")

def start():
    """Unified startup entry point"""
    ColorPrint.blue("=" * 70)
    ColorPrint.blue(" PYCORE CALLMODULE - Native UI Integrated")
    ColorPrint.blue("=" * 70)

    # Import all routers (from existing config.py)
    from pycore.callmodule.routers.management import (
        status_router, config_router, control_router, logs_router,
        capabilities_router, local_config_router, local_stats_router,
        local_test_router
    )
    from pycore.callmodule.routers.local import (
        screenshot_router, image_router, audio_router,
        file_router, video_router
    )
    from pycore.callmodule.routers.upload import router as upload_router
    from pycore.callmodule.routers.client import router as client_router
    from pycore.callmodule.routers.mcp_router import mcp_router
    from pycore.callmodule.routers.code_sync_router import router as code_sync_router
    from pycore.callmodule.routers.module_call_router import module_call_router
    from pycore.callmodule.routers.notebooklm_stt_router import router as notebooklm_stt_router

    # Resource paths
    resources_dir = Path(__file__).parent / "resources"
    icon_path = resources_dir / "icon.ico"
    logo_path = resources_dir / "logo.png"

    # Frontend project path
    frontend_app_dir = PROJECT_ROOT / "poly_apps" / "pycore-management"

    # Platform-specific configuration
    IS_WINDOWS = platform.system() == 'Windows'

    # Create Native UI configuration
    config = NativeUIConfig(
        # Basic Configuration
        app_id="pycore_callmodule",
        app_name="Pycore Module Caller",
        main_entry=callmodule_main_entry,
        project_root=PROJECT_ROOT,
        debug=True,

        # Frontend Configuration
        frontend_enabled=True,
        frontend_framework="vite",
        frontend_app_dir=frontend_app_dir,
        frontend_mode=Config.FRONTEND_MODE,
        frontend_port=Config.FRONTEND_PORT,
        frontend_auto_install=True,
        frontend_block_until_ready=(Config.FRONTEND_MODE == "dev"),

        # RPC v2 Configuration
        rpc_enabled=True,
        rpc_port=Config.RPC_PORT,
        rpc_host=Config.RPC_HOST,
        rpc_debug=True,
        rpc_routers=[
            # Management Layer
            status_router, config_router, control_router, logs_router,
            capabilities_router, local_config_router, local_stats_router,
            local_test_router,
            # Local Processing Layer
            screenshot_router, image_router, audio_router, file_router, video_router,
            # Upload Layer
            upload_router,
            # Client Layer
            client_router,
            # Legacy Routers
            mcp_router, code_sync_router, module_call_router, notebooklm_stt_router
        ],
        rpc_allow_origins=["*"],
        rpc_auto_mount_frontend=True,

        # UI Configuration (Platform-specific)
        window_size=(1400, 900) if IS_WINDOWS else (1280, 800),
        show_on_start=IS_WINDOWS,  # Windows: show UI, Linux: background
        frameless=True,
        icon_path=str(icon_path) if icon_path.exists() else None,
        logo_path=str(logo_path) if logo_path.exists() else None,

        # Tray Configuration (Windows only)
        enable_tray=IS_WINDOWS,

        # Debug Window Configuration
        show_debug_window=True,
        debug_window_width=650,
        debug_window_height=500,
        min_display_time=2.0,
        enable_language_selector=True,
    )

    ColorPrint.green(f"[Callmodule] Configuration created")
    ColorPrint.blue(f"  - Frontend mode: {Config.FRONTEND_MODE}")
    ColorPrint.blue(f"  - Frontend port: {Config.FRONTEND_PORT}")
    ColorPrint.blue(f"  - Backend port: {Config.RPC_PORT}")
    ColorPrint.blue(f"  - Frontend dir: {frontend_app_dir}")
    ColorPrint.blue(f"  - Platform: {platform.system()}")
    ColorPrint.blue(f"  - Enable tray: {IS_WINDOWS}")

    # Launch application
    ColorPrint.green("[Callmodule] Launching application...")
    launch_native_app(config)

    ColorPrint.green("[Callmodule] Application exited")

def main():
    """Alias for start()"""
    start()

if __name__ == '__main__':
    main()
```

### Phase 3: Update __main__.py

**File**: `pycore/callmodule/__main__.py`

```python
"""
Pycore Module Caller - Main Entry Point

Run as module:
    python -m pycore.callmodule                    # Native UI mode (NEW)
    python -m pycore.callmodule --service          # Service mode (no UI)
    python -m pycore.callmodule --host 0.0.0.0 --port 8000 --debug
"""

import argparse
import sys
from pathlib import Path

PYCORE_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PYCORE_ROOT))

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description="Pycore Module Caller Service")
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--port', type=int, default=59000, help='Port to bind to')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    parser.add_argument('--service', action='store_true', help='Service mode (no UI)')
    parser.add_argument('--reload', action='store_true', help='Enable auto-reload (dev)')

    args = parser.parse_args()

    # Service mode (legacy, no UI)
    if args.service or args.reload:
        from .global_config import init_global_config
        from pycore.pyfoundations.third_party import get_third_package_uvicorn

        init_global_config(
            pycore_root=str(PYCORE_ROOT),
            http_port=args.port,
            host=args.host,
            debug=args.debug
        )

        uvicorn = get_third_package_uvicorn()
        uvicorn.run(
            "pycore.callmodule.app:create_app",
            host=args.host,
            port=args.port,
            reload=args.reload,
            factory=True,
            log_level="debug" if args.debug else "info"
        )
        return

    # Native UI mode (default, NEW)
    from .callmodule_main import start
    start()

if __name__ == '__main__':
    main()
```

---

## 📊 Platform-Specific Behavior

### Windows
- **Frontend**: Vite dev server (dev mode) or static files (production)
- **Backend**: RPC v2 on port 59000
- **UI**: PySide6 window (frameless, 1400x900)
- **Tray**: System tray icon with menu
- **Startup**: Shows debug window → Main UI window

### Linux
- **Frontend**: Vite dev server (dev mode) or static files (production)
- **Backend**: RPC v2 on port 59000
- **UI**: Optional (show_on_start=False, or don't show at all)
- **Tray**: Disabled
- **Access**: Direct web browser to http://localhost:3000 (dev) or http://localhost:59000 (prod)

---

## 🚀 Startup Flow Comparison

### Matrix Startup Flow
```
1. Start Debug Window (tk)
2. Start Frontend Launcher Thread
   - Dev mode: Launch Vite dev server (port 38007)
   - Production mode: Build frontend to dist/
3. Start RPC v2 Server (port 48000)
   - Production mode: Mount frontend static files at '/'
4. Create PySide6 UI
   - Dev mode: WebView → http://localhost:38007
   - Production mode: WebView → http://localhost:48000
5. Close Debug Window (auto)
6. Run Main Application
```

### Callmodule Target Flow
```
1. Start Debug Window (tk)
2. Start Frontend Launcher Thread
   - Dev mode: Launch Vite dev server (port 3000)
   - Production mode: Build frontend to dist/
3. Start RPC v2 Server (port 59000)
   - Production mode: Mount frontend static files at '/'
4. Create PySide6 UI (Windows only)
   - Dev mode: WebView → http://localhost:3000
   - Production mode: WebView → http://localhost:59000
5. Close Debug Window (auto)
6. Run Main Application
```

---

## 📁 File Structure Changes

### New Files
```
pycore/callmodule/
├── callmodule_config/
│   ├── __init__.py
│   └── config.py                    # NEW: Configuration class
├── callmodule_main.py               # NEW: Native UI entry point
└── resources/                       # NEW: Icons and assets
    ├── icon.ico
    └── logo.png
```

### Modified Files
```
pycore/callmodule/
├── __main__.py                      # MODIFIED: Add native UI mode
├── config.py                        # KEEP: Still used for service mode
└── app.py                           # KEEP: Unchanged
```

### Deprecated Files
```
pycore/callmodule/
└── platform/
    ├── __init__.py                  # DEPRECATED: Empty, can be removed
    └── windows_tray.py              # DEPRECATED: No longer needed
```

---

## ✅ Implementation Checklist

### Phase 1: Configuration (1 file)
- [ ] Create `pycore/callmodule/callmodule_config/__init__.py`
- [ ] Create `pycore/callmodule/callmodule_config/config.py`

### Phase 2: Main Entry (1 file)
- [ ] Create `pycore/callmodule/callmodule_main.py`

### Phase 3: Update Entry Point (1 file)
- [ ] Modify `pycore/callmodule/__main__.py`

### Phase 4: Resources (2 files)
- [ ] Create `pycore/callmodule/resources/` directory
- [ ] Add icon.ico (can copy from pyutils/native_ui)
- [ ] Add logo.png (optional)

### Phase 5: Testing
- [ ] Test dev mode: `python -m pycore.callmodule`
- [ ] Test service mode: `python -m pycore.callmodule --service`
- [ ] Test Windows UI + tray
- [ ] Test Linux background mode
- [ ] Verify frontend connection to backend

---

## 🔧 Frontend Configuration Check

### Current Frontend Setup
```javascript
// vite.config.ts
server: {
  port: 3000,
  proxy: {
    '/api': {
      target: 'http://localhost:59000',
      changeOrigin: true,
    }
  }
}
```

**Status**: ✅ Already configured correctly
- Dev server: port 3000
- Backend proxy: http://localhost:59000
- No changes needed

---

## 💡 Key Differences from Matrix

| Feature | Matrix | Callmodule |
|---------|--------|------------|
| Frontend Port | 38007 | 3000 |
| Backend Port | 48000 | 59000 |
| Frontend Framework | Vite + React | Vite + React |
| Fullscreen | Yes | No (1400x900) |
| Tray (Windows) | Disabled | Enabled |
| Service Mode | No | Yes (legacy) |

---

## 🎯 Expected Outcome

### After Migration

**Windows**:
```bash
$ python -m pycore.callmodule
# Shows debug window → Main UI window with system tray
# Frontend: http://localhost:3000 (dev) or embedded (production)
# Backend: http://localhost:59000
```

**Linux**:
```bash
$ python -m pycore.callmodule
# Shows debug window → Exits (no UI window)
# Access: http://localhost:3000 (dev) or http://localhost:59000 (production)
```

**Service Mode (Both Platforms)**:
```bash
$ python -m pycore.callmodule --service
# No UI, no debug window
# Direct uvicorn server on port 59000
# Access: http://localhost:59000
```

---

## 📝 Notes

1. **Backward Compatibility**: Service mode (`--service`) remains unchanged for CI/CD and Docker deployments
2. **Frontend Ready**: Frontend is 95% complete and uses correct backend port (59000)
3. **Routers**: All routers already registered, no changes needed
4. **Platform Detection**: Automatic via `platform.system() == 'Windows'`
5. **Configuration Flexibility**: Can switch between dev/production modes via `FRONTEND_MODE`

---

**Status**: 📋 Ready for Implementation
**Estimated Files**: 4 new + 1 modified = 5 files total
**Risk Level**: Low (fallback to service mode available)
