# OKX Price Monitor - Frontend Configuration Guide

## 📋 Overview

The OKX Price Monitor frontend uses **Vite + React** and supports two modes:
- **Development Mode**: Hot reload with Vite dev server
- **Production Mode**: Compiled static files served by backend

## 🚀 Quick Start

### Development Mode (Recommended for Testing)

```bash
# Simply run the app - frontend will auto-start
python pymain.py app=okx
```

**What happens:**
1. Backend RPC server starts on port `58888`
2. Vite dev server starts on port `58889`
3. npm dependencies auto-install (if needed)
4. Qt window opens and loads `http://localhost:58889`
5. Hot reload enabled for frontend development

**Access:**
- Frontend UI: http://localhost:58889
- Backend API: http://localhost:58888/rpc
- WebSocket Logs: ws://localhost:58888/ws/logs

### Production Mode (For Deployment)

**Step 1: Switch to Production Mode**

Edit `pyapps/okx_price_monitor/okx_frontend_config.py`:

```python
# Change this line:
FRONTEND_MODE = "dev"

# To:
FRONTEND_MODE = "production"
```

**Step 2: Run the App**

```bash
python pymain.py app=okx
```

**What happens:**
1. Frontend is compiled to `poly_apps/okx_price_monitor/dist/`
2. Backend serves static files from `dist/`
3. Single port `58888` for both frontend and backend
4. Qt window opens and loads `http://localhost:58888`

**Access:**
- Application: http://localhost:58888 (both frontend and API)

## ⚙️ Configuration File

**Location:** `pyapps/okx_price_monitor/okx_frontend_config.py`

```python
class OKXFrontendConfig:
    # Frontend directory
    FRONTEND_DIR = PROJECT_ROOT / "poly_apps" / "okx_price_monitor"

    # Frontend port (dev mode only)
    FRONTEND_PORT = 58889

    # Mode selection: "dev" or "production"
    FRONTEND_MODE = "dev"  # SWITCH HERE

    # Build control (production mode only)
    FRONTEND_SKIP_BUILD = False  # Auto-build when needed
    FRONTEND_FORCE_REBUILD = False  # Force rebuild every time

    # Auto-install npm dependencies
    FRONTEND_AUTO_INSTALL = True
```

## 🔧 Advanced Options

### Skip Frontend Build (Production Only)

If you already have a compiled `dist/` folder:

```python
FRONTEND_SKIP_BUILD = True
```

### Force Rebuild Every Time

To always rebuild from scratch:

```python
FRONTEND_FORCE_REBUILD = True
```

### Manual Build

```bash
cd poly_apps/okx_price_monitor
npm install
npm run build
```

Output will be in `poly_apps/okx_price_monitor/dist/`

## 📂 Directory Structure

```
poly_apps/okx_price_monitor/     # Frontend project
├── package.json                 # npm dependencies
├── vite.config.ts               # Vite configuration
├── index.html                   # Entry HTML
├── index.tsx                    # React entry point
├── App.tsx                      # Main app component
├── components/                  # React components
│   ├── Layout.tsx              # Main layout
│   └── LogViewer.tsx           # Log viewer component
├── pages/                       # Page components
│   ├── Monitor.tsx
│   ├── History.tsx
│   ├── Alerts.tsx
│   ├── Config.tsx
│   └── Stats.tsx
├── services/                    # API services
│   └── rpc.ts                  # RPC client
└── dist/                        # Compiled output (production)
```

## 🔌 Backend Integration

### RPC API

Frontend connects to backend via RPC v2:

```typescript
// In frontend
import { RPCClient } from './services/rpc';

// Call API
const stats = await RPCClient.call('monitor.stats');
```

### WebSocket Logs

Real-time logs stream via WebSocket:

```typescript
const ws = new WebSocket('ws://localhost:58888/ws/logs');
ws.onmessage = (event) => {
  const log = JSON.parse(event.data);
  console.log(log.message);
};
```

## 🐛 Troubleshooting

### Frontend Not Starting / PySide6 Window Not Appearing

**FIXED ISSUES (2025-12-14):**
1. ✅ Removed conflicting importmap from index.html (was preventing Vite startup)
2. ✅ Fixed undefined environment variables in vite.config.ts
3. ✅ Corrected hardcoded ports (58100 → 58888)
4. ✅ Created .env file to prevent env loading errors

**Check 1: Port Conflict**
```bash
# Check if port 58889 is in use
netstat -ano | findstr :58889

# Or let Vite use fallback port
# (Already configured with strictPort: false)
```

**Check 2: npm Dependencies**
```bash
cd poly_apps/okx_price_monitor
npm install
```

**Check 3: Check Logs**

Look for these messages in terminal:
```
[OKX] Frontend mode: dev
[OKX] Frontend port: 58889
[OKX] Window URL: http://localhost:58889
[Vite] Dev server running at http://localhost:58889
[NativeLauncher] Phase 6: Launching application...
```

**If debug window appears but PySide6 doesn't launch:**
- Frontend dev server may not be starting properly
- Check for Vite errors in console
- Ensure all dependencies are installed: `cd poly_apps/okx_price_monitor && pnpm install`
- Try production mode instead: Set `FRONTEND_MODE = "production"` in config

### WebSocket Connection Failed

**Solution:** Ensure backend is running on port 58888

```bash
# Check backend
curl http://localhost:58888/rpc/monitor.stats
```

### Build Errors (Production Mode)

**Clear cache and rebuild:**
```bash
cd poly_apps/okx_price_monitor
rm -rf node_modules dist
npm install
npm run build
```

## 📊 Mode Comparison

| Feature | Development Mode | Production Mode |
|---------|------------------|-----------------|
| Hot Reload | ✅ Yes | ❌ No |
| Build Step | ❌ No | ✅ Yes |
| Ports | 58888 + 58889 | 58888 only |
| Startup Time | Fast | Slower (build time) |
| File Size | N/A | Optimized/Minified |
| Use Case | Development | Deployment |

## 🎯 Recommended Workflow

1. **Development:**
   - Keep `FRONTEND_MODE = "dev"`
   - Make changes and test with hot reload
   - Iterate quickly

2. **Testing Production Build:**
   - Switch to `FRONTEND_MODE = "production"`
   - Run app once to build
   - Test the compiled version

3. **Deployment:**
   - Use production mode
   - Set `FRONTEND_SKIP_BUILD = True` after first build
   - Distribute compiled app

## 📝 Notes

- Frontend auto-installs dependencies on first run
- Backend must be running before frontend can connect
- WebSocket logs require backend API routes registered
- Vite dev server supports HTTPS if needed (see vite.config.ts)

---

**Version:** 2.0
**Last Updated:** 2025-12-14
