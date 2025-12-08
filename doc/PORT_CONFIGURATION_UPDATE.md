# Port Configuration Update & Environment Variable Passing

## Summary

Updated port configuration to avoid conflicts and implemented automatic environment variable passing to frontend.

**Date**: 2025-12-07
**Status**: ✅ Complete

---

## Changes Overview

### 1. Port Configuration Updates

| Component | Old Port | New Port | Reason |
|-----------|----------|----------|--------|
| Frontend (Vite) | 3000 | **38007** | Matrix standard port, avoid conflicts |
| Backend (RPC v2) | 8000 | **48000** | High port to avoid common conflicts |

### 2. Environment Variable Auto-Passing

Implemented automatic backend URL passing to frontend via environment variables.

**Supported Frameworks**:
- ✅ Vite (VITE_API_URL, VITE_API_PORT, VITE_API_HOST)
- ✅ React/CRA (REACT_APP_API_URL, REACT_APP_API_PORT)
- ✅ Next.js (NEXT_PUBLIC_API_URL, NEXT_PUBLIC_API_PORT)

---

## Files Modified

### 1. `pyapps/matrix/matrix_config/config.py`

**Changes**:
```python
# Backend port
WEB_PORT = 48000  # High port number to avoid conflicts (was 8000)

# Frontend port
FRONTEND_PORT = 38007  # Matrix frontend port (was 3000)

# CORS Configuration
CORS_ALLOW_ORIGINS = [
    f"http://localhost:{FRONTEND_PORT}",  # 38007
    f"http://127.0.0.1:{FRONTEND_PORT}",
    f"http://localhost:{WEB_PORT}",  # 48000
    f"http://127.0.0.1:{WEB_PORT}",
]
```

**Updated Comments**:
- Dev mode: Port 38007 (was 3000)
- Production mode: Port 48000 (was 8000)

### 2. `poly_apps/matrix_ui_react/vite.config.ts`

**Changes**:
```typescript
server: {
  port: 38007,  // Matrix frontend port (was 3000)
  host: '0.0.0.0',
}
```

### 3. `pycore/pyutils/native_ui/step9_frontend/frontend_config.py`

**New Field**:
```python
# Environment variables
env_vars: Optional[dict] = None
"""Custom environment variables to pass to frontend process"""
```

### 4. `pycore/pyutils/native_ui/step9_frontend/frontend_thread.py`

**Changes**:

#### A. Fixed Vite Command (Line 365-367)
```python
if self.config.framework == "vite":
    # Use npm run dev for better compatibility (works with local vite)
    return ["npm", "run", "dev", "--", "--host", self.config.host, "--port", str(self.config.port)]
```

**Before**: `["npx", "vite", "dev", ...]` (caused FileNotFoundError on Windows)
**After**: `["npm", "run", "dev", ...]` (uses local vite via package.json)

#### B. Enhanced Environment Variable Builder (Line 372-387)
```python
def _build_env(self) -> dict:
    """Build environment variables for dev server"""
    env = os.environ.copy()

    # Standard port/host variables
    env["PORT"] = str(self.config.port)
    env["HOST"] = self.config.host
    env["NUXT_PORT"] = str(self.config.port)
    env["NUXT_HOST"] = self.config.host

    # Add custom environment variables (from config)
    if self.config.env_vars:
        for key, value in self.config.env_vars.items():
            env[key] = str(value)

    return env
```

### 5. `pycore/pyutils/native_ui/step3_launcher/launch_native_app.py`

**New Code (Line 216-229)**:
```python
# Build environment variables for frontend (pass backend URL)
frontend_env_vars = {}
if config.rpc_enabled:
    backend_url = f"http://localhost:{config.rpc_port}"
    # Vite environment variables (VITE_ prefix)
    frontend_env_vars["VITE_API_URL"] = backend_url
    frontend_env_vars["VITE_API_PORT"] = str(config.rpc_port)
    frontend_env_vars["VITE_API_HOST"] = config.rpc_host
    # React/CRA environment variables (REACT_APP_ prefix)
    frontend_env_vars["REACT_APP_API_URL"] = backend_url
    frontend_env_vars["REACT_APP_API_PORT"] = str(config.rpc_port)
    # Next.js environment variables (NEXT_PUBLIC_ prefix)
    frontend_env_vars["NEXT_PUBLIC_API_URL"] = backend_url
    frontend_env_vars["NEXT_PUBLIC_API_PORT"] = str(config.rpc_port)
```

**Updated FrontendConfig Creation (Line 232-243)**:
```python
frontend_config = FrontendConfig(
    # ... existing fields ...
    env_vars=frontend_env_vars if frontend_env_vars else None
)
```

---

## Architecture Diagram

### Dev Mode Architecture

```
┌─────────────────────────────────────────────────────────┐
│            Matrix Application (Dev Mode)                 │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────┐      ┌──────────────────────┐│
│  │  Vite Dev Server     │      │   RPC v2 Server      ││
│  │   Port: 38007        │◄────►│   Port: 48000        ││
│  │  (Hot Reload)        │      │   (API Only)         ││
│  └──────────────────────┘      └──────────────────────┘│
│           ▲                              ▲               │
│           │                              │               │
│           │  Environment Variables       │               │
│           │  VITE_API_URL=http://localhost:48000        │
│           │  VITE_API_PORT=48000         │               │
│           │                              │               │
│           │       ┌──────────────────┐  │               │
│           └───────┤  PySide6 WebView │──┘               │
│                   └──────────────────┘                   │
│                   URL: http://localhost:38007            │
└─────────────────────────────────────────────────────────┘
```

### Production Mode Architecture

```
┌─────────────────────────────────────────────────────────┐
│          Matrix Application (Production Mode)            │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────────┐│
│  │            RPC v2 Server (Port: 48000)              ││
│  ├─────────────────────────────────────────────────────┤│
│  │  Static Files (/)         │  API (/rpc/<route>)    ││
│  │   from dist/              │                         ││
│  └─────────────────────────────────────────────────────┘│
│                              ▲                            │
│                              │                            │
│                    ┌──────────────────┐                  │
│                    │  PySide6 WebView │                  │
│                    └──────────────────┘                  │
│                    URL: http://localhost:48000           │
└─────────────────────────────────────────────────────────┘
```

---

## Environment Variables Available in Frontend

### Vite Projects
```javascript
// Access in .ts/.tsx files
const apiUrl = import.meta.env.VITE_API_URL;       // "http://localhost:48000"
const apiPort = import.meta.env.VITE_API_PORT;     // "48000"
const apiHost = import.meta.env.VITE_API_HOST;     // "0.0.0.0"

// Example usage
fetch(`${apiUrl}/rpc/health`)
  .then(response => response.json())
  .then(data => console.log(data));
```

### React/Create React App
```javascript
// Access in .js/.jsx files
const apiUrl = process.env.REACT_APP_API_URL;      // "http://localhost:48000"
const apiPort = process.env.REACT_APP_API_PORT;    // "48000"

// Example usage
fetch(`${apiUrl}/rpc/devices`)
  .then(response => response.json())
  .then(data => console.log(data));
```

### Next.js Projects
```javascript
// Access in .js/.jsx files
const apiUrl = process.env.NEXT_PUBLIC_API_URL;    // "http://localhost:48000"
const apiPort = process.env.NEXT_PUBLIC_API_PORT;  // "48000"

// Example usage in pages
export default function Home() {
  useEffect(() => {
    fetch(`${apiUrl}/rpc/status`)
      .then(response => response.json())
      .then(data => console.log(data));
  }, []);
}
```

---

## Testing

### Test Dev Mode

```bash
cd D:\programing\core_node
python pymain.py app=matrix
```

**Expected Output**:
```
[Frontend] Framework: vite
[Frontend] Mode: dev
[Frontend] Port: 38007
[FrontendThread] Starting dev server...
[FrontendThread] Command: npm run dev -- --host 0.0.0.0 --port 38007
[FrontendThread] Dev server ready on http://localhost:38007

[NativeLauncher] Phase 4.7: RPC v2 started on 0.0.0.0:48000
  - HTTP API: http://0.0.0.0:48000/rpc/<route>
  - WebSocket: ws://0.0.0.0:48000/rpc/ws

[PySide6Framework] Scheduling URL load: http://localhost:38007
```

**Verification**:
1. ✅ Frontend dev server starts on port 38007
2. ✅ Backend RPC v2 starts on port 48000
3. ✅ WebView displays React app from dev server
4. ✅ Environment variables available in frontend
5. ✅ Hot reload works when editing React files

### Verify Environment Variables in Frontend

Add debug logging in your React component:

```typescript
// src/App.tsx
console.log('API URL:', import.meta.env.VITE_API_URL);
console.log('API Port:', import.meta.env.VITE_API_PORT);
console.log('API Host:', import.meta.env.VITE_API_HOST);
```

Expected console output:
```
API URL: http://localhost:48000
API Port: 48000
API Host: 0.0.0.0
```

### Test API Calls from Frontend

```typescript
// Example API call
const response = await fetch(`${import.meta.env.VITE_API_URL}/rpc/health`);
const data = await response.json();
console.log('Health check:', data);
```

---

## Benefits

### 1. Automatic Configuration
- ✅ Frontend automatically knows backend URL
- ✅ No manual configuration needed
- ✅ Works in both dev and production modes

### 2. Port Conflict Avoidance
- ✅ Frontend: 38007 (Matrix standard)
- ✅ Backend: 48000 (high port, rarely used)
- ✅ Less likely to conflict with other services

### 3. Framework Agnostic
- ✅ Supports Vite, React, Next.js, Nuxt
- ✅ Each framework gets appropriate env var prefix
- ✅ Easy to add more frameworks

### 4. Dev Experience
- ✅ Hot reload works perfectly
- ✅ Frontend and backend independent
- ✅ Fast development cycle

---

## Migration from Old Configuration

### If You're Using the Old Ports

**Old Configuration**:
```python
FRONTEND_PORT = 3000
WEB_PORT = 8000
```

**New Configuration**:
```python
FRONTEND_PORT = 38007
WEB_PORT = 48000
```

### Update Your Frontend Code

**Before** (hardcoded URL):
```typescript
fetch('http://localhost:8000/rpc/devices')
```

**After** (use environment variable):
```typescript
fetch(`${import.meta.env.VITE_API_URL}/rpc/devices`)
```

---

## Troubleshooting

### Issue 1: Port Already in Use

**Error**: `Port 38007 is already in use`

**Solution**:
```bash
# Find process using port
netstat -ano | findstr :38007

# Kill process (Windows)
taskkill /PID <PID> /F
```

### Issue 2: Environment Variables Not Available

**Problem**: `import.meta.env.VITE_API_URL` is undefined

**Solutions**:
1. Restart dev server (environment variables are set at startup)
2. Check console for environment variable logging
3. Verify `frontend_env_vars` is being passed correctly

### Issue 3: CORS Errors

**Error**: `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solution**: Verify CORS configuration in `matrix_config/config.py`:
```python
CORS_ALLOW_ORIGINS = [
    "http://localhost:38007",
    "http://localhost:48000",
]
```

---

## Future Enhancements

1. **Dynamic Port Allocation**: Auto-detect available ports
2. **Environment Variable Validation**: Warn if API URL is unreachable
3. **Hot Reload for Config**: Reload config without restarting
4. **Multi-Backend Support**: Support multiple backend URLs

---

**Document Version**: v1.0
**Last Updated**: 2025-12-07
**Status**: ✅ Production Ready
