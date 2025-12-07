# Windows vs Linux Platform Differences

## Status

**Date**: 2025-12-07
**Consistency**: ✅ **VERIFIED**

## Core Principle

Both platforms follow the same architecture and validation flow, but differ in **deployment capabilities** due to platform constraints.

## Similarities (What's Identical)

### 1. Architecture

✅ **Both platforms use the same architecture**:
- Python modules for validation ONLY (no command execution)
- Shell scripts (Bash/PowerShell) for command execution
- File-based variable communication via global_var directory
- Same validation system: `project_validator.py`, `dependency_manager.py`, `build_validator.py`

### 2. Validation System

✅ **Both platforms have identical validation flow**:

**Linux (Bash)**:
```bash
source validation_helper.sh
run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$PROJECT_NAME" "$ACTION" "true"
```

**Windows (PowerShell)**:
```powershell
. validation_helper.ps1
Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $PROJECT_NAME $ACTION $true
```

Both call the same Python validators:
1. Project structure validation
2. Dependency checking and auto-installation
3. Build requirements validation

### 3. Variable Flow

✅ **Both platforms use identical variable names**:
- `POLY_APP_SELECTED_PROJECT_NAME`
- `POLY_APP_PROJECT_PATH`
- `POLY_APP_PROJECT_TYPE`
- `POLY_APP_PROJECT_PORT`
- `POLY_APP_SELECTED_ACTION_NAME`
- `POLY_APP_SELECTED_PLATFORM_NAME`

✅ **Both platforms introduce `EFFECTIVE_ACTION` variable**:
- Bash: `EFFECTIVE_ACTION="$SELECTED_ACTION"`
- PowerShell: `$EFFECTIVE_ACTION = $SELECTED_ACTION`

### 4. Menu System

✅ **Both platforms use the same Python menu**:
- `project_detector.py` - scans projects
- `menu_system.py` - displays interactive menu
- Same project types: nuxt, react, vue, vite, react-native, flutter, laravel
- Same actions: debug, build, generate, preview
- Same platforms: web, android, ios, windows, linux, **deploy_laravel**

## Critical Difference: Deploy+Laravel Platform

### Linux (Bash) - FULL DEPLOYMENT CAPABILITY

**Nuxt debug + deploy_laravel**:
```bash
EFFECTIVE_ACTION="$SELECTED_ACTION"  # Keep as "debug"

# Run validation for debug mode
run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"

# Deploy to Laravel ServerManager
php artisan servermanager:nuxt add "$SELECTED_PROJECT_NAME" \
    --port="$PROJECT_PORT" \
    --build-path="$PROJECT_PATH" \
    --debug
```

**Result**: Creates systemd service running `pnpm run dev` + nginx reverse proxy

---

**React/Vue/Vite debug + deploy_laravel**:
```bash
EFFECTIVE_ACTION="$SELECTED_ACTION"  # Keep as "debug"

# Run validation for debug mode
run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"

# Deploy to Laravel ServerManager
php artisan servermanager:static add "$SELECTED_PROJECT_NAME" \
    --port="$PROJECT_PORT" \
    --build-path="$PROJECT_PATH" \
    --debug
```

**Result**: Creates systemd service running `pnpm run dev` + nginx reverse proxy

---

**React/Vue/Vite build + deploy_laravel**:
```bash
EFFECTIVE_ACTION="$SELECTED_ACTION"  # Keep as "build"

# Run validation
run_full_validation "$PROJECT_PATH" "$PROJECT_TYPE" "$SELECTED_PROJECT_NAME" "$EFFECTIVE_ACTION" "true"

# Build
pnpm run build || npm run build

# Deploy to Laravel ServerManager
php artisan servermanager:static add "$SELECTED_PROJECT_NAME" \
    --port="$PROJECT_PORT" \
    --build-path="$BUILD_PATH"
```

**Result**: Nginx serves static files directly (no systemd service)

### Windows (PowerShell) - BUILD ONLY

**Nuxt debug + deploy_laravel**:
```powershell
# Convert action due to Windows platform limitation
$EFFECTIVE_ACTION = "build"

# Display conversion notice
Write-Host "ACTION CONVERSION (Windows Platform Limitation)"
Write-Host "Windows constraint: Cannot create systemd services"
Write-Host "Effective action: $EFFECTIVE_ACTION"

# Run validation for build mode
Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true

# Build only (no deployment)
try { pnpm run build } catch { npm run build }
```

**Result**: Build output created, but NOT deployed (no ServerManager on Windows)

---

**React/Vue/Vite debug + deploy_laravel**:
```powershell
# Convert action due to Windows platform limitation
$EFFECTIVE_ACTION = "build"

# Display conversion notice
Write-Host "ACTION CONVERSION (Windows Platform Limitation)"
Write-Host "Windows constraint: Cannot create systemd services"
Write-Host "Effective action: $EFFECTIVE_ACTION"

# Run validation for build mode
Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true

# Build only (no deployment)
try { pnpm run build } catch { npm run build }
```

**Result**: Build output created, but NOT deployed (no ServerManager on Windows)

---

**React/Vue/Vite build + deploy_laravel**:
```powershell
$EFFECTIVE_ACTION = $SELECTED_ACTION  # Keep as "build"

# Run validation
Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true

# Build only (no deployment)
try { pnpm run build } catch { npm run build }
```

**Result**: Build output created, but NOT deployed (no ServerManager on Windows)

## Why This Difference Exists

### Technical Constraints

**Linux**:
- ✅ Has systemd service manager
- ✅ Has nginx web server
- ✅ Laravel ServerManager can create/manage services
- ✅ Can run dev servers as persistent system services
- ✅ Can configure nginx as reverse proxy

**Windows**:
- ❌ No systemd (uses Windows Services, different API)
- ❌ No nginx (typically uses IIS)
- ❌ Laravel ServerManager commands don't work on Windows
- ❌ Cannot create system services from PowerShell script
- ❌ Cannot configure nginx (doesn't exist)

### Design Decision

**Windows behavior**: `debug + deploy_laravel` → **Build only, no deployment**

**Rationale**:
1. User can still get the build output
2. User can manually deploy to IIS or other Windows web server
3. Clear notification explains the platform limitation
4. No false promises (don't pretend to deploy when we can't)

## Action Conversion Table

| User Selection | Linux Effective Action | Windows Effective Action | Reason |
|----------------|------------------------|--------------------------|--------|
| **Nuxt** |
| debug + web | debug | debug | Same (local dev) |
| debug + deploy_laravel | **debug** | **build** | Linux: create service; Windows: can't deploy |
| build + deploy_laravel | build | build | Both build, but Linux also deploys |
| generate + deploy_laravel | generate | generate | Both generate, but Linux also deploys |
| **React/Vue/Vite** |
| debug + web | debug | debug | Same (local dev) |
| debug + deploy_laravel | **debug** | **build** | Linux: create service; Windows: can't deploy |
| build + deploy_laravel | build | build | Both build, but Linux also deploys |
| preview + deploy_laravel | preview | preview | Both preview, but Linux also deploys |

## User Experience

### Linux User (debug + deploy_laravel)

```
Action       : debug
Platform     : deploy_laravel

===============================================================================

Deploying development server as system service...

✓ Project validation passed
✓ Dependencies installed successfully
✓ Build requirements satisfied

Deploying to Laravel service manager (debug mode)...
✓ Service created: static-matrix_ui_react (debug mode)
✓ Service started and running
✓ Nginx configured for http://matrix-ui-react.local

⚠ Debug mode: Running dev server from source. Changes will reload automatically.
```

**Result**: Dev server running as system service, accessible via domain

### Windows User (debug + deploy_laravel)

```
Action       : debug
Platform     : deploy_laravel

╔═══════════════════════════════════════════════════════════════════════════╗
║  ACTION CONVERSION (Windows Platform Limitation)                         ║
╚═══════════════════════════════════════════════════════════════════════════╝

  User selected action  : debug
  User selected platform: deploy_laravel
  ────────────────────────────────────────────────────────────────────────
  Windows constraint    : Cannot create systemd services
  Required operation    : Build only (no deployment service)
  ────────────────────────────────────────────────────────────────────────
  Effective action      : build

╚═══════════════════════════════════════════════════════════════════════════╝

✓ Project validation passed
✓ Dependencies installed successfully
✓ Build requirements satisfied

Building project...
✓ Build completed successfully

Note: Build output created at dist/ directory
      To deploy on Windows, use IIS or other Windows web server
```

**Result**: Build output created, user must manually deploy

## Consistency Verification

### Files Updated

1. **Linux (Bash)**:
   - `scripts/build_scripts/poly_app_manager.sh`
   - ✅ Loads `validation_helper.sh`
   - ✅ Initializes `EFFECTIVE_ACTION`
   - ✅ Calls `run_full_validation`
   - ✅ debug + deploy_laravel: Keeps action as "debug", deploys with ServerManager

2. **Windows (PowerShell)**:
   - `scripts/build_scripts/poly_app_manager.ps1`
   - ✅ Loads `validation_helper.ps1`
   - ✅ Initializes `$EFFECTIVE_ACTION`
   - ✅ Calls `Run-FullValidation`
   - ✅ debug + deploy_laravel: Converts action to "build", no deployment

### Validation Helpers

1. **Linux**: `scripts/build_scripts/build_py_tools/validation_helper.sh`
   - ✅ Bash syntax
   - ✅ Calls same Python validators

2. **Windows**: `scripts/build_scripts/build_py_tools/validation_helper.ps1`
   - ✅ PowerShell syntax
   - ✅ Calls same Python validators

### Python Validators (100% Identical)

1. `project_validator.py` - Same on both platforms
2. `dependency_manager.py` - Same on both platforms
3. `build_validator.py` - Same on both platforms
4. `menu_system.py` - Same on both platforms
5. `project_detector.py` - Same on both platforms

## Summary

### What's Consistent ✅

1. **Architecture**: Python validates, Shell executes
2. **Validation**: Same 3-layer validation system
3. **Variables**: Same names, same flow
4. **Menu**: Same project types, actions, platforms
5. **Logic**: Same EFFECTIVE_ACTION pattern
6. **Auto-fix**: Both auto-install dependencies

### What's Different (By Design) ⚠️

1. **deploy_laravel platform**:
   - Linux: **Full deployment** (nginx + systemd services)
   - Windows: **Build only** (no deployment capability)

2. **Action conversion for debug + deploy_laravel**:
   - Linux: **Keeps as "debug"**, creates dev server service
   - Windows: **Converts to "build"**, no deployment

3. **User notification**:
   - Linux: "Deploying to Laravel service manager (debug mode)..."
   - Windows: "ACTION CONVERSION (Windows Platform Limitation)"

### Rationale for Difference ✅

The difference is **intentional and necessary**:
- Windows doesn't have systemd or nginx
- Cannot create system services from PowerShell
- Better to build and let user manually deploy than fail silently
- Clear notifications prevent user confusion

### Compliance Status ✅

Both platforms comply with architecture rules:
- ✅ Rule 1: Python does NOT execute commands
- ✅ Rule 2: Shell executes all commands
- ✅ Rule 3: Laravel ServerManager only on Linux (by design)

---

**Verification Date**: 2025-12-07
**Status**: Consistent with documented differences
**Next Review**: When adding new project types or platforms
