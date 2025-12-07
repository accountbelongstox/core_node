# Callmodule Native UI Migration - Completed

> **Date**: 2025-12-07
> **Status**: ✅ Migration Complete
> **Pattern**: Matrix NativeUIConfig (Integrated Frontend + UI)

---

## 🎯 What Changed

### Old Approach (Legacy)
- **Entry**: `python pycore_module_caller.py` → ServiceLauncher
- **Architecture**: Separate services (RPC v2, UI, Tray, Frontend not integrated)
- **Frontend**: Not managed by launcher
- **Tray**: Custom tray service
- **Singleton**: Via ServiceLauncher (ports 59100-59199)

### New Approach (Default)
- **Entry**: `python pycore_module_caller.py` → NativeUIConfig + launch_native_app
- **Architecture**: Integrated (Native UI manages everything)
- **Frontend**: Managed by native_ui (Vite dev server or production build)
- **Tray**: Built-in via NativeUIConfig
- **Singleton**: Via NativeUI (automatic)

---

## 📁 New Files Created

### 1. Configuration Module
```
pycore/callmodule/callmodule_config/
├── __init__.py          # Module exports
└── config.py            # Config class (118 lines)
```

**Key Configuration**:
- `APP_ID`: `pycore_callmodule`
- `FRONTEND_DIR`: `poly_apps/pycore-management`
- `FRONTEND_PORT`: 3000 (Vite dev server)
- `RPC_PORT`: 59000 (Backend API)
- `FRONTEND_MODE`: `dev` (or `production`)

### 2. Main Entry Point
```
pycore/callmodule/
└── callmodule_main.py   # Native UI entry (244 lines)
```

**Features**:
- Uses `NativeUIConfig` pattern (like Matrix)
- Imports 19 routers (Management + Local Processing + Upload + Client + Legacy)
- Platform-specific behavior (Windows UI, Linux background)
- Integrated frontend launcher

### 3. Updated Entry Point
```
pycore_module_caller.py  # Root entry (modified)
```

**Changes**:
- Added `main_native_ui()` - new default mode
- Kept `main_legacy()` - old ServiceLauncher mode (use `--legacy` flag)
- Backward compatible

---

## 🚀 Usage

### Default Mode (Native UI)
```bash
# Windows: Shows PySide6 UI window + system tray + frontend
# Linux: Background mode (frontend only, no UI window)
python pycore_module_caller.py

# With options
python pycore_module_caller.py --host 0.0.0.0 --port 59000 --debug
```

### Legacy Mode (Old ServiceLauncher)
```bash
# Use old approach (for comparison or fallback)
python pycore_module_caller.py --legacy
```

### Service Mode (No UI, for CI/CD)
```bash
# Still available via __main__.py
python -m pycore.callmodule --service
```

---

## 🌐 Platform-Specific Behavior

### Windows
- **Frontend**: Vite dev server (port 3000) or production build
- **Backend**: RPC v2 (port 59000)
- **UI**: PySide6 window (1400x900, frameless)
  - WebView loads: http://localhost:3000 (dev) or http://localhost:59000 (prod)
- **Tray**: System tray icon with menu
- **Startup**: Debug window → Main UI window

### Linux
- **Frontend**: Vite dev server (port 3000) or production build
- **Backend**: RPC v2 (port 59000)
- **UI**: No window (background mode)
- **Tray**: Disabled
- **Access**: Direct browser to http://localhost:3000 (dev) or http://localhost:59000 (prod)

---

## 📊 Startup Flow Comparison

### Old Flow (Legacy)
```
1. ServiceLauncher.start()
2. Singleton detection (59100-59199)
3. Start HeartbeatThread
4. Start RPCv2Thread (port 59000)
5. Start UIThread (voice subtitle window)
6. Start TrayThread
7. Register event handlers
8. Wait for shutdown
```

### New Flow (Native UI)
```
1. launch_native_app(NativeUIConfig)
2. Start Debug Window (tk)
3. Start Frontend Launcher Thread
   - Dev mode: Vite dev server (port 3000)
   - Production: Build to dist/
4. Start RPC v2 Server (port 59000)
   - Production: Mount frontend static files
5. Create PySide6 UI (Windows only)
   - Dev: WebView → http://localhost:3000
   - Production: WebView → http://localhost:59000
6. Close Debug Window (auto)
7. Run Main Application
```

---

## 🔄 Service Comparison

### Old Services (Legacy)
- `heartbeat`: Singleton keepalive
- `rpc_v2`: FastAPI server (19 routers)
- `ui`: Voice subtitle window
- `tray`: System tray (Windows)

### New Services (Native UI)
- `frontend`: Vite dev server / production build (integrated)
- `rpc_v2`: FastAPI server (19 routers) + optional static mount
- `ui`: Main management UI window (Windows only)
- `tray`: System tray (Windows only, built-in)

---

## 📋 Router List (Unchanged)

All 19 routers are registered in both modes:

**Management Layer** (8):
- status_router, config_router, control_router, logs_router
- capabilities_router, local_config_router, local_stats_router, local_test_router

**Local Processing Layer** (5):
- screenshot_router, image_router, audio_router, file_router, video_router

**Upload Layer** (1):
- upload_router

**Client Layer** (1):
- client_router

**Legacy** (4):
- mcp_router, code_sync_router, module_call_router, notebooklm_stt_router

---

## 🎨 Frontend Integration

### Frontend Project
- **Location**: `poly_apps/pycore-management`
- **Framework**: Vite + React
- **Dev Port**: 3000
- **Backend Proxy**: http://localhost:59000
- **Completion**: 95% (all endpoints aligned)

### Frontend Modes

#### Development Mode (`FRONTEND_MODE = "dev"`)
- Native UI starts Vite dev server on port 3000
- Hot reload enabled
- Backend serves API only (port 59000)
- Windows WebView: http://localhost:3000
- Linux access: http://localhost:3000

#### Production Mode (`FRONTEND_MODE = "production"`)
- Native UI builds frontend to dist/
- RPC v2 serves static files at `/`
- Single port for frontend + backend (59000)
- Windows WebView: http://localhost:59000
- Linux access: http://localhost:59000

---

## ✅ Migration Benefits

### Before (Legacy Mode)
- ❌ Frontend not integrated (manual start)
- ❌ Complex service coordination
- ❌ Multiple ports to manage
- ❌ Platform differences not handled

### After (Native UI Mode)
- ✅ Frontend fully integrated (auto-start)
- ✅ Single entry point handles everything
- ✅ Automatic port coordination
- ✅ Platform-specific behavior built-in
- ✅ Debug window for startup visibility
- ✅ Clean shutdown handling

---

## 🔧 Configuration Options

### Runtime Configuration
```python
# pycore/callmodule/callmodule_config/config.py

# Frontend mode
FRONTEND_MODE = "dev"  # "dev" or "production"

# Frontend port
FRONTEND_PORT = 3000

# Backend configuration
RPC_HOST = "0.0.0.0"
RPC_PORT = 59000

# UI behavior (platform-specific)
SHOW_UI_ON_START = IS_WINDOWS  # Windows: True, Linux: False
ENABLE_TRAY = IS_WINDOWS

# Window size (Windows)
WINDOW_WIDTH = 1400
WINDOW_HEIGHT = 900
```

---

## 🧪 Testing

### Test Scenarios

#### 1. Windows Dev Mode
```bash
python pycore_module_caller.py --debug
```
**Expected**:
- Debug window appears
- Vite dev server starts (port 3000)
- RPC v2 starts (port 59000)
- Main UI window opens with WebView → http://localhost:3000
- System tray icon appears
- Debug window closes automatically

#### 2. Linux Dev Mode
```bash
python pycore_module_caller.py --debug
```
**Expected**:
- Debug window appears
- Vite dev server starts (port 3000)
- RPC v2 starts (port 59000)
- No UI window (background mode)
- Debug window closes automatically
- Access: http://localhost:3000 in browser

#### 3. Legacy Mode
```bash
python pycore_module_caller.py --legacy --debug
```
**Expected**:
- Old ServiceLauncher behavior
- Voice subtitle window (not management UI)
- Separate tray service
- No integrated frontend

#### 4. Service Mode
```bash
python -m pycore.callmodule --service --debug
```
**Expected**:
- Direct uvicorn server
- No UI, no frontend launcher
- Access: http://localhost:59000/docs

---

## 📝 Files Modified Summary

### Created (3 files + 1 directory)
1. `pycore/callmodule/callmodule_config/` (directory)
2. `pycore/callmodule/callmodule_config/__init__.py` (6 lines)
3. `pycore/callmodule/callmodule_config/config.py` (118 lines)
4. `pycore/callmodule/callmodule_main.py` (244 lines)

### Modified (1 file)
1. `pycore_module_caller.py` (updated to dual-mode: native UI + legacy)

### Unchanged (Preserved for compatibility)
- `pycore/callmodule/config.py` (still used by legacy mode)
- `pycore/callmodule/event_handlers.py`
- `pycore/callmodule/tray_menu.py`
- `pycore/callmodule/app.py`
- All routers

---

## 🎯 Next Steps

### 1. Test Windows Startup
```bash
python pycore_module_caller.py --debug
```
Verify:
- [ ] Debug window shows up
- [ ] Frontend starts (Vite dev server)
- [ ] Backend starts (RPC v2)
- [ ] UI window opens with management interface
- [ ] Tray icon appears
- [ ] All services functional

### 2. Test Linux Startup (if available)
```bash
python pycore_module_caller.py --debug
```
Verify:
- [ ] Debug window shows up
- [ ] Frontend starts (Vite dev server)
- [ ] Backend starts (RPC v2)
- [ ] No UI window (background mode)
- [ ] Can access http://localhost:3000

### 3. Test Legacy Mode (fallback)
```bash
python pycore_module_caller.py --legacy --debug
```
Verify:
- [ ] Old behavior still works
- [ ] Voice subtitle window (not management UI)
- [ ] No frontend integration

### 4. Production Mode Testing
Edit `pycore/callmodule/callmodule_config/config.py`:
```python
FRONTEND_MODE = "production"
```
Then run and verify:
- [ ] Frontend builds to dist/
- [ ] RPC v2 serves static files at `/`
- [ ] Access http://localhost:59000 (single port)

---

## 🔗 Related Documentation

- [CALLMODULE_NATIVE_UI_MIGRATION_PLAN.md](./CALLMODULE_NATIVE_UI_MIGRATION_PLAN.md) - Original migration plan
- [PYCORE_MODULE_CALLER_STARTUP_CHAIN.md](./PYCORE_MODULE_CALLER_STARTUP_CHAIN.md) - Startup flow analysis
- [BACKEND_TEST_REPORT.md](./BACKEND_TEST_REPORT.md) - Backend API test results
- [FRONTEND_STATUS_UPDATE.md](../poly_apps/FRONTEND_STATUS_UPDATE.md) - Frontend completion status

---

## 💡 Key Differences from Matrix

| Feature | Matrix | Callmodule |
|---------|--------|------------|
| Entry Command | `python pymain.py app=matrix` | `python pycore_module_caller.py` |
| Frontend Port | 38007 | 3000 |
| Backend Port | 48000 | 59000 |
| Window Size | Fullscreen | 1400x900 |
| Tray (Windows) | Disabled | Enabled |
| Legacy Mode | No | Yes (`--legacy`) |
| Service Mode | No | Yes (`--service`) |

---

## ✨ Summary

**Migration Status**: ✅ **COMPLETE**

**Unified Entry Point**: `python pycore_module_caller.py`

**Key Achievements**:
1. ✅ Frontend integration (Vite + React, auto-start)
2. ✅ Platform-specific behavior (Windows UI, Linux background)
3. ✅ Native UI pattern (like Matrix)
4. ✅ Backward compatibility (legacy mode available)
5. ✅ Clean configuration structure
6. ✅ Single command startup

**Ready for Testing**: Windows UI + Frontend + Backend integration

---

**Migration Date**: 2025-12-07
**Migration Status**: ✅ Complete
**Test Status**: ⏳ Pending Windows testing
