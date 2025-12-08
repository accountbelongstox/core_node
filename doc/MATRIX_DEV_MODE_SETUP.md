# Matrix Dev Mode Configuration

## Summary

Updated Matrix application to use **Vite + React** frontend with **dev mode hot reload** debugging.

**Date**: 2025-12-07
**Status**: ✅ Configuration Complete, Ready for Testing

---

## Changes Made

### 1. Frontend Framework Migration

**Previous**: Nuxt multi-app (`poly_apps/nuxt_main`)
**Current**: Vite + React (`poly_apps/matrix_ui_react`)

### 2. Configuration Updates

**File**: `pyapps/matrix/matrix_config/config.py`

| Setting | Old Value | New Value | Reason |
|---------|-----------|-----------|--------|
| `FRONTEND_DIR` | `poly_apps/nuxt_main` | `poly_apps/matrix_ui_react` | Switch to Vite + React |
| `FRONTEND_PORT` | `38007` | `3000` | Match vite.config.ts |
| `FRONTEND_MODE` | `"production"` | `"dev"` | Enable hot reload |
| `FRONTEND_SKIP_BUILD` | `True` | `False` | Allow builds when needed |

### 3. CORS Configuration

Added backend ports to CORS allowed origins:
```python
CORS_ALLOW_ORIGINS = [
    "http://localhost:3000",      # Frontend dev server
    "http://127.0.0.1:3000",
    "http://localhost:8000",      # Backend RPC v2
    "http://127.0.0.1:8000",
]
```

---

## Architecture Overview

### Dev Mode (Current Setup)

```
┌─────────────────────────────────────────────────────┐
│               Matrix Application                     │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────────┐      ┌──────────────────┐    │
│  │  Vite Dev Server │      │   RPC v2 Server  │    │
│  │   Port: 3000     │◄────►│   Port: 8000     │    │
│  │  (Hot Reload)    │      │   (API Only)     │    │
│  └──────────────────┘      └──────────────────┘    │
│           ▲                         ▲                │
│           │                         │                │
│           │    ┌──────────────┐    │                │
│           └────┤ PySide6 UI   │────┘                │
│                │  WebView     │                      │
│                └──────────────┘                      │
│                Points to:                            │
│                http://localhost:3000                 │
└─────────────────────────────────────────────────────┘
```

**Characteristics**:
- ✅ Hot reload enabled (instant code updates)
- ✅ Separate frontend and backend ports
- ✅ Frontend independent from backend
- ✅ API calls: `http://localhost:8000/rpc/<route>`

### Production Mode (Future)

```
┌─────────────────────────────────────────────────────┐
│               Matrix Application                     │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌────────────────────────────────────────────┐    │
│  │          RPC v2 Server (Port: 8000)        │    │
│  ├────────────────────────────────────────────┤    │
│  │  Static Files (/)  │  API (/rpc/<route>)  │    │
│  │   from dist/       │                       │    │
│  └────────────────────────────────────────────┘    │
│                         ▲                            │
│                         │                            │
│                  ┌──────────────┐                   │
│                  │ PySide6 UI   │                   │
│                  │  WebView     │                   │
│                  └──────────────┘                   │
│                  Points to:                          │
│                  http://localhost:8000               │
└─────────────────────────────────────────────────────┘
```

**Characteristics**:
- ✅ Single port for both frontend and backend
- ✅ Pre-compiled static files
- ✅ Faster startup (no build needed)
- ✅ Production-ready

---

## Testing Instructions

### Test Dev Mode (Hot Reload)

```bash
cd D:\programing\core_node
python pymain.py app=matrix
```

**Expected Behavior**:

1. **Frontend Initialization**:
   ```
   [Frontend] Framework: vite
   [Frontend] Mode: dev
   [Frontend] App Dir: D:\programing\core_node\poly_apps\matrix_ui_react
   [Frontend] Port: 3000
   ```

2. **Dependencies Check** (first run only):
   ```
   [FrontendThread] Installing dependencies...
   [FrontendThread] Running: npm install
   ```

3. **Dev Server Start**:
   ```
   [FrontendThread] Starting dev server...
   [FrontendThread] Running: npm run dev
   [FrontendThread] Dev server ready on http://localhost:3000
   ```

4. **RPC v2 Start**:
   ```
   [NativeLauncher] Phase 4.7: RPC v2 started on 0.0.0.0:8000
   - HTTP API: http://0.0.0.0:8000/rpc/<route>
   - WebSocket: ws://0.0.0.0:8000/rpc/ws
   ```

5. **WebView**:
   ```
   [PySide6Framework] WebView created
   [PySide6Framework] Scheduling URL load: http://localhost:3000
   ```

6. **Window Opens**: PySide6 window displays the React app from dev server

### Verify Hot Reload

1. Edit a React component in `poly_apps/matrix_ui_react/src/`
2. Save the file
3. WebView should automatically refresh with changes

---

## Switching Modes

### Switch to Production Mode

Edit `pyapps/matrix/matrix_config/config.py`:

```python
FRONTEND_MODE = "production"  # Change from "dev"
```

Run:
```bash
python pymain.py app=matrix
```

The system will:
1. Build frontend to `dist/` folder (if not exists or outdated)
2. RPC v2 will serve static files from `dist/` at `/`
3. WebView will point to `http://localhost:8000`

### Force Rebuild (Production Mode)

```python
FRONTEND_FORCE_REBUILD = True  # Force rebuild even if dist exists
```

---

## Troubleshooting

### Issue 1: Port 3000 Already in Use

**Error**: `Port 3000 is already in use`

**Solution**: Either kill the process using port 3000, or change the port in:
- `pyapps/matrix/matrix_config/config.py` → `FRONTEND_PORT`
- `poly_apps/matrix_ui_react/vite.config.ts` → `server.port`

### Issue 2: Dependencies Not Installed

**Error**: `node_modules not found`

**Solution**:
```bash
cd poly_apps/matrix_ui_react
npm install
```

Or enable auto-install:
```python
# In matrix_main.py
frontend_auto_install=True  # Already enabled
```

### Issue 3: Dev Server Not Starting

**Check**:
1. Node.js installed: `node --version`
2. npm installed: `npm --version`
3. Check Vite config: `poly_apps/matrix_ui_react/vite.config.ts`

**Logs**: Look for `[FrontendThread]` messages in console

### Issue 4: WebView Shows Blank Page

**Possible Causes**:
1. Dev server not ready yet (wait for "Dev server ready" message)
2. Wrong port in WebView URL
3. CORS issue (check browser console in DevTools)

**Solution**:
- Enable `frontend_block_until_ready=True` in matrix_main.py (already enabled for dev mode)
- Check WebView dev tools: Right-click → Inspect

---

## File Structure

```
core_node/
├── pyapps/matrix/
│   ├── matrix_main.py                    # Main entry point
│   ├── matrix_config/
│   │   └── config.py                     # ✅ UPDATED: Dev mode config
│   └── resources/
│       ├── icon.ico
│       └── logo.png
│
└── poly_apps/
    └── matrix_ui_react/                  # ✅ NEW: Vite + React frontend
        ├── src/                          # React components
        ├── vite.config.ts                # Port: 3000
        ├── package.json                  # Scripts: dev, build
        └── dist/                         # Production build output (not in dev mode)
```

---

## Next Steps

1. **Test Dev Mode**: Run `python pymain.py app=matrix` and verify hot reload works
2. **Develop Features**: Edit React components with instant feedback
3. **Test Production Mode**: Switch to production mode and verify static file serving
4. **Deploy**: Use production mode for final deployment

---

## Integration Details

### How native_ui Handles Dev Mode

1. **Phase 4.6**: Frontend Service
   - Detects `FRONTEND_MODE = "dev"`
   - Runs `npm install` (if needed)
   - Runs `npm run dev`
   - Waits for dev server ready
   - Provides URL: `http://localhost:3000`

2. **Phase 4.7**: RPC v2 Service
   - Starts on port 8000
   - Registers API routers
   - Does NOT mount static files (dev mode)
   - Provides API endpoints: `http://localhost:8000/rpc/<route>`

3. **Phase 7**: PySide6 UI
   - Creates WebView
   - Points to dev server: `http://localhost:3000`
   - React app makes API calls to `http://localhost:8000/rpc/<route>`

### How native_ui Handles Production Mode

1. **Phase 4.6**: Frontend Service
   - Detects `FRONTEND_MODE = "production"`
   - Checks if `dist/` exists and is up-to-date
   - Runs `npm run build` if needed
   - Provides static mount config to RPC v2

2. **Phase 4.7**: RPC v2 Service
   - Gets static mount config from frontend
   - Mounts `dist/` folder at `/`
   - URL: `http://localhost:8000`

3. **Phase 7**: PySide6 UI
   - Creates WebView
   - Points to RPC v2: `http://localhost:8000`
   - Single port for everything

---

## Configuration Reference

### matrix_config/config.py

```python
# Frontend Configuration
FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "matrix_ui_react"
FRONTEND_PORT = 3000
FRONTEND_MODE = "dev"  # "dev" or "production"
FRONTEND_SKIP_BUILD = False
FRONTEND_FORCE_REBUILD = False

# Backend Configuration
WEB_HOST = "0.0.0.0"
WEB_PORT = 8000

# CORS Configuration
CORS_ALLOW_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]
```

### matrix_main.py

```python
config = NativeUIConfig(
    # Frontend
    frontend_enabled=True,
    frontend_framework="vite",
    frontend_app_dir=PROJECT_ROOT / "poly_apps" / "matrix_ui_react",
    frontend_mode=Config.FRONTEND_MODE,  # From config.py
    frontend_port=Config.FRONTEND_PORT,  # From config.py
    frontend_auto_install=True,
    frontend_block_until_ready=(Config.FRONTEND_MODE == "dev"),

    # RPC v2
    rpc_enabled=True,
    rpc_port=Config.WEB_PORT,
    rpc_host=Config.WEB_HOST,
    rpc_routers=[...],
    rpc_auto_mount_frontend=True,
)
```

---

**Document Version**: v1.0
**Last Updated**: 2025-12-07
**Status**: ✅ Ready for Testing
