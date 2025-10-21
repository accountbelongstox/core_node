# Dynamic Port Configuration Architecture

**Principle:** No hardcoding of commands - Auto-generate from configuration

---

## Architecture Overview

### Before (INCORRECT - Hardcoded)
```
package.json (hardcoded)
  dev:ittools: "npm run switch-app ittools && cross-env APP_ENTRY=ittools NUXT_PORT=3005 nuxt dev -p 3005"
  dev:codemart: "npm run switch-app codemart && cross-env APP_ENTRY=codemart NUXT_PORT=3001 nuxt dev -p 3001"
  ... (10 hardcoded commands)

Problem: Package.json becomes unmaintainable as apps grow
When new apps added, must manually edit package.json
Violates DRY principle
```

### After (CORRECT - Dynamic)
```
package.json (generic, not hardcoded)
  dev:ittools: "npm run switch-app ittools && cross-env APP_ENTRY=ittools nuxt dev"
  dev:codemart: "npm run switch-app codemart && cross-env APP_ENTRY=codemart nuxt dev"
  ... (only APP_ENTRY env var, no port hardcoding)

scripts/start.ps1 (dynamic logic)
  Reads: app-config.json
  Gets: selectedApp.Port (e.g., 3005)
  Sets: $env:NUXT_PORT = 3005
  Runs: yarn dev:ittools
  Result: Nuxt respects NUXT_PORT environment variable
```

---

## How It Works

### 1. App Configuration (Static)
File: `apps/app_ittools/app-config.json`
```json
{
  "displayName": "IT Tools Suite",
  "port": 3005,
  "devCommand": "dev:ittools",
  "buildCommand": "build:ittools"
}
```

### 2. Auto-Discovery (PowerShell)
File: `scripts/functions/AppScanner.ps1`
```
Scan apps/ directory
  -> Find app_ittools
  -> Read app-config.json
  -> Extract port: 3005
  -> Create config object with port info
  -> Return to MenuConfig.ps1
```

### 3. Interactive Menu (PowerShell)
File: `scripts/start.ps1`
```powershell
# User selects app from menu
$selectedApp = Get-AppConfigs()["ittools"]

# selectedApp object contains:
# - Name: "ittools"
# - Port: 3005
# - DevCommand: "dev:ittools"
# - DisplayName: "IT Tools Suite"
```

### 4. Dynamic Environment Setup (PowerShell)
File: `scripts/start.ps1` (lines 145-155)
```powershell
if ($mode -eq "debug") {
    Invoke-CommandWithErrorHandling -Command {
        $env:NUXT_PORT = $selectedApp.Port   # Set to 3005 dynamically
        $env:NUXT_HOST = "0.0.0.0"           # Set host
        yarn $selectedApp.DevCommand         # Run: yarn dev:ittools
    }
}
```

### 5. Generic package.json (No Hardcoding)
File: `package.json` (line 23)
```json
"dev:ittools": "npm run switch-app ittools && cross-env APP_ENTRY=ittools nuxt dev"
```

### 6. Nuxt Respects Environment Variable
Nuxt 4 automatically reads `NUXT_PORT` environment variable
```
NUXT_PORT=3005 detected by Nuxt
  -> Dev server starts on port 3005
  -> No additional parameters needed
```

---

## Data Flow Diagram

```
app-config.json (port: 3005)
  |
  +-> AppScanner.ps1 (reads config)
  |
  +-> MenuConfig.ps1 (loads into $selectedApp)
  |
  +-> start.ps1 (user selects app)
  |
  +-> $selectedApp.Port = 3005
  |
  +-> $env:NUXT_PORT = 3005
  |
  +-> yarn dev:ittools (generic command)
  |
  +-> cross-env sets APP_ENTRY=ittools
  |
  +-> nuxt dev (reads NUXT_PORT env var)
  |
  +-> Nuxt starts on port 3005
```

---

## Scalability

### Adding New Apps

When adding new app (e.g., `app_newapp` on port 3008):

1. **Create app directory:**
   ```
   apps/app_newapp/
   ├── config_app_newapp/
   ├── pages_app_newapp/
   └── app-config.json
   ```

2. **Create app-config.json:**
   ```json
   {
     "displayName": "New App",
     "port": 3008,
     "devCommand": "dev:newapp",
     "buildCommand": "build:newapp"
   }
   ```

3. **Add commands to package.json (ONLY generic versions):**
   ```json
   "dev:newapp": "npm run switch-app newapp && cross-env APP_ENTRY=newapp nuxt dev",
   "build:newapp": "npm run switch-app newapp && cross-env APP_ENTRY=newapp nuxt build"
   ```

4. **Done!** Auto-discovery and start.ps1 handle the rest
   - AppScanner finds it
   - Menu displays it
   - start.ps1 reads port from config
   - App runs on correct port

NO manual port assignment in start.ps1 needed!

---

## Architectural Benefits

| Aspect | Hardcoded | Dynamic |
|--------|-----------|---------|
| Maintainability | Low - manual updates needed | High - auto-discovered |
| Scalability | Poor - O(n) work per app | Excellent - O(1) work per app |
| Configuration Location | Multiple files (package.json + start.ps1) | Centralized (app-config.json) |
| New App Onboarding | Complex - many files to edit | Simple - just create structure |
| DRY Principle | Violated - port hardcoded everywhere | Followed - single source of truth |
| Error Prone | High - easy to forget port updates | Low - auto-generated |

---

## Environment Variables

### set by start.ps1 (Dynamic)
```powershell
$env:NUXT_PORT = $selectedApp.Port    # From app-config.json
$env:NUXT_HOST = "0.0.0.0"            # Fixed for all apps
$env:APP_ENTRY = $appNamespace         # From auto-discovery
```

### set by package.json (Fixed)
```json
"dev:ittools": "npm run switch-app ittools && cross-env APP_ENTRY=ittools nuxt dev"
                                         ^^^^^^^^^^^^^^^^^^^^^
                                         Only APP_ENTRY, NO PORT
```

### Read by Nuxt
```
NUXT_PORT environment variable
  -> Nuxt starts dev server on that port
  -> No -p flag needed (but can be used)
```

---

## File Changes Summary

### Modified Files

1. **scripts/start.ps1** (lines 145-166)
   - Added: `$env:NUXT_PORT = $selectedApp.Port`
   - Added: `$env:NUXT_HOST = "0.0.0.0"`
   - Result: Dynamic port from config

2. **package.json** (reverted)
   - Removed: Hardcoded NUXT_PORT in commands
   - Removed: -p flag from nuxt dev
   - Kept: Generic APP_ENTRY environment variable
   - Result: Minimal, maintainable commands

3. **nuxt.config.ts** (line 67)
   - Added: `'@/app_ittools': './apps/app_ittools'` alias
   - Result: Module imports work correctly

### No Changes Needed

- `app-config.json` files - already have correct ports
- `AppScanner.ps1` - already reads ports
- `package.json` app names - already correct

---

## Verification

### Test Dynamic Port Configuration

1. **Start the launcher:**
   ```bash
   cd poly_apps\nuxt_main
   .\scripts\start.ps1
   ```

2. **Select IT Tools Suite**

3. **Observe in console:**
   ```
   [INFO] Configuring port dynamically: 3005
   [CMD] yarn dev:ittools

   Local: http://localhost:3005/
   ```

4. **Port 3005 is used (not 3000)** ✓

### Verify Commands Are Generic

```bash
cd poly_apps\nuxt_main
cat package.json | grep "dev:ittools"

Output:
"dev:ittools": "npm run switch-app ittools && cross-env APP_ENTRY=ittools nuxt dev"

Notice: NO hardcoded port (3005) in command
Port comes from: scripts/start.ps1 which reads app-config.json
```

---

## Scalability Example

### Current Setup (7 apps)
- package.json: 7 generic dev commands
- start.ps1: 1 dynamic port reader
- app-config.json files: 7 port configs
- Total complexity: LOW

### Future Expansion (20 apps)
- package.json: 20 generic dev commands (NO changes needed to start.ps1!)
- start.ps1: Still 1 dynamic port reader
- app-config.json files: 20 port configs
- Total complexity: STILL LOW (linear growth)

---

## Conclusion

By using:
1. App-specific `app-config.json` for configuration
2. PowerShell auto-discovery for reading configs
3. Dynamic environment variables in `start.ps1`
4. Generic commands in `package.json`

We achieve:
- [x] No hardcoding
- [x] Scalability
- [x] Maintainability
- [x] DRY principle
- [x] Single source of truth
- [x] Easy new app onboarding

**Result:** System scales to any number of apps without manual port management!

---

**Generated:** 2025-10-21
**Architecture:** Dynamic Configuration
**Status:** Implemented and Verified
