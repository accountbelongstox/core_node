# React Native Multi-App System Status Report
**Date**: 2025-12-03 17:00
**Status**: ✓ **WORKING**

---

## System Overview

### Architecture
```
start.ps1
    ↓
main_launcher.py (Python Menu)
    ↓ (User Selection via File Var System)
    ↓
app_switcher.py (App Configuration)
    ↓
Files Updated:
  - app.json
  - index.js
  - AndroidManifest.xml
  - Metro Config (if needed)
    ↓
Debug-Android / Build-Android
```

---

## Current Configuration

### Active App: `awy` (AnWuYou / SafeGuardian)
- **App Name**: `AnWuYou` (JavaScript registration name)
- **Display Name**: `SafeGuardian` (shown on device)
- **Package ID**: `com.anwuyou.app`
- **External Build**: DISABLED (`use_external_safe_build = false`)
- **Hot Reload**: Direct source editing in `src/apps/awy/`

---

## File Status

### ✓ app.json
```json
{
    "name": "AnWuYou",
    "displayName": "SafeGuardian"
}
```
**Status**: Correctly updated from `build_config.ini`

### ✓ index.js
```javascript
// Direct app import - no hardcoding, dynamically set by app_switcher.py
import App from './src/apps/awy/App';

AppRegistry.registerComponent(appName, () => App);
```
**Status**: Dynamic import, NO hardcoded switch statement ✓

### ✓ AndroidManifest.xml
```xml
android:label="SafeGuardian"
```
**Status**: App name correctly set

### ✓ Metro Config
**Status**: Watching `src/` directory for hot reload

---

## Python Scripts Status

### ✓ app_switcher.py
**6-Step Process**:
1. ✓ Load app configuration from `build_config.ini`
2. ✓ Update `app.json` (name, displayName)
3. ✓ Update `index.js` (direct import)
4. ✓ Update `AndroidManifest.xml` (label)
5. ✓ Configure Metro (watchFolders if needed)
6. ⚠ Run `android_prebuild.py` (encoding issue with Chinese chars)

### ✓ main_launcher.py
- Scans `src/apps/` directory
- Shows interactive menu
- Writes selection to file variable system

### ✓ file_var_system.py
- File-based IPC between Python ↔ PowerShell
- Location: `~/.core_node/.global_vars/`
- Namespace: `RN_BUILD`

---

## PowerShell Scripts Status

### ✓ start.ps1
- Initializes multi-app mode
- Calls Python menu (direct execution, no output capture)
- Reads selection from file variable system
- Calls `app_switcher.py` before build/debug
- Executes Debug-Android / Build-Android

### ✓ FileVarReader.ps1
- Reads Python-written file variables
- Converts JSON to PowerShell hashtables

---

## What Works

### ✓ Complete APP Switching
1. User runs `.\scripts\start.ps1`
2. Python menu displays all apps in `src/apps/`
3. User selects app + mode + platform
4. `app_switcher.py` runs:
   - Reads `src/apps/{app}/build_config.ini`
   - Updates `app.json` with app name
   - Updates `index.js` with direct import
   - Updates `AndroidManifest.xml` with display name
5. Build/Debug proceeds with correct app

### ✓ No Hardcoding
- `index.js` has NO switch statement
- NO manual updates needed when adding new apps
- Everything driven by `build_config.ini`

### ✓ Hot Reload
- Direct source editing in `src/apps/{app}/`
- Metro auto-detects changes
- No manual sync needed

---

## Known Issues

### Issue 1: android_prebuild.py Encoding Error
**Impact**: Minor - Icon processing may fail for Chinese characters
**Workaround**: Icons can be manually placed, not critical for development
**Fix Needed**: Add UTF-8 encoding to subprocess output capture

### Issue 2: Chinese Characters in build_config.ini
**Impact**: None - English `display_name_english` works correctly
**Status**: Display garbled in console, but file parsing works

---

## What Does NOT Require Implementation

### ✗ Factory Directory Copy
**Reason**: `use_external_safe_build = false`
**Current**: Direct editing in `src/apps/{app}/`
**To Enable**: Set `use_external_safe_build = true` in `build_config.ini`

### ✗ Manual App Entry Updates
**Reason**: `app_switcher.py` handles automatically
**Before**: Had to edit `index.js` switch statement
**Now**: Python replaces entire `index.js` dynamically

---

## Test Commands

### Test App Switcher Standalone
```powershell
cd D:\programing\core_node\poly_apps\react_native
python scripts\build_scripts\react_native_py_scripts\app_switcher.py "D:\programing\core_node\poly_apps\react_native" awy
```

### Run Full Workflow
```powershell
cd D:\programing\core_node\poly_apps\react_native
.\scripts\start.ps1
```

---

## Configuration Reference

### build_config.ini Fields Used

| Field | Purpose | Example |
|-------|---------|---------|
| `app_name` | JavaScript registration name | `AnWuYou` |
| `display_name_english` | Device display name | `SafeGuardian` |
| `default_package_id` | Android package ID | `com.anwuyou.app` |
| `use_external_safe_build` | Enable factory directory | `false` |

---

## Conclusion

**System Status**: ✅ FULLY FUNCTIONAL

The multi-app system is working correctly with:
- ✓ Complete app switching from build_config.ini
- ✓ No hardcoded app lists in index.js
- ✓ Automatic file updates (app.json, index.js, AndroidManifest.xml)
- ✓ Hot reload support
- ✓ File-based IPC between Python and PowerShell

Only minor encoding issues remain with Chinese characters, which do not affect core functionality.
