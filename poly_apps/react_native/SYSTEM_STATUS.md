# React Native Multi-App System Status Report
**Date**: 2025-12-03
**Status**: ✓ **WORKING WITH FACTORY DIRECTORY**

---

## System Overview

### Architecture
```
start.ps1
    ↓
main_launcher.py (Python Menu)
    ↓ (User Selection via File Var System)
    ↓
app_switcher.py (App Configuration + Factory Setup)
    ↓
Factory Directory Setup:
  1. Copy project to .factory_builds/{app}/
  2. Create node_modules junction
  3. Update metro.config.js watchFolders
    ↓
Files Updated (in factory directory):
  - app.json
  - index.js
  - AndroidManifest.xml
  - metro.config.js
    ↓
Debug-Android / Build-Android (from factory directory)
    ↓
Hot Reload (Metro watches source directory)
```

---

## Current Configuration

### Active App: `awy` (AnWuYou / SafeGuardian)
- **App Name**: `AnWuYou` (JavaScript registration name)
- **Display Name**: `SafeGuardian` (shown on device)
- **Package ID**: `com.anwuyou.app`
- **External Build**: ✓ **ENABLED** (`use_external_safe_build = true`)
- **Factory Path**: `.factory_builds/awy/`
- **Hot Reload**: Metro watches source `src/apps/awy/` while building in factory

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
**8-Step Process** (Updated with Factory Integration):
1. ✓ Load app configuration from `build_config.ini`
2. ✓ Setup factory directory (if enabled):
   - Copy project to `.factory_builds/{app}/` (excludes node_modules, build dirs)
   - Create node_modules junction to source
   - Set working directory to factory
3. ✓ Update `app.json` (name, displayName) in working directory
4. ✓ Update `index.js` (direct import) in working directory
5. ✓ Update `AndroidManifest.xml` (label) in working directory
6. ✓ Configure Metro bundler:
   - Factory mode: Update `watchFolders` to watch source directory
   - Source mode: Standard config
7. ⚠ Run `android_prebuild.py` (skipped in factory, runs from source)
8. ✓ Save factory path to file variable system for PowerShell

### ✓ factory_manager.py (NEW)
**Key Features**:
- Smart project copying with exclusion patterns (node_modules, build dirs, .git)
- Uses `os.walk()` to avoid symlink traversal issues
- Creates Windows junction for node_modules (saves ~500MB disk space)
- Updates metro.config.js to watch source directory for hot reload
- Timestamp-based copy detection (only copies when source is newer)

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

### ✓ Complete APP Switching with Factory Directory
1. User runs `.\scripts\start.ps1`
2. Python menu displays all apps in `src/apps/`
3. User selects app + mode + platform
4. `app_switcher.py` runs (8-step process):
   - Reads `src/apps/{app}/build_config.ini`
   - **Copies project to `.factory_builds/{app}/`** (if factory enabled)
   - **Creates node_modules junction to source**
   - Updates `app.json` with app name (in factory)
   - Updates `index.js` with direct import (in factory)
   - Updates `AndroidManifest.xml` with display name (in factory)
   - **Updates `metro.config.js` to watch source directory**
   - Saves factory path to file variable system
5. Build/Debug proceeds from factory directory with correct app

### ✓ No Hardcoding
- `index.js` has NO switch statement
- NO manual updates needed when adding new apps
- Everything driven by `build_config.ini`

### ✓ Hot Reload from Source While Building in Factory
- **Factory directory**: Clean isolated build environment at `.factory_builds/{app}/`
- **Metro watches source**: Changes in `src/apps/{app}/` automatically detected
- **Changes sync automatically**: Edit source → Metro detects → Factory rebuilds
- **node_modules junction**: Saves ~500MB disk space per app
- **Safe builds**: Source directory remains untouched during builds

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

## Factory Directory Benefits

### ✓ Safe Build Environment
- **Isolated builds**: Factory directory protects source code from build artifacts
- **Clean state**: Each app gets fresh factory directory on first build
- **Disk space efficient**: node_modules junction saves ~500MB per app

### ✓ Hot Reload Support
- **Metro watches source**: Changes in `src/apps/{app}/` detected automatically
- **No manual sync**: Factory rebuilds triggered by Metro bundler
- **Fast development**: Edit source → See changes immediately

### ✓ Configuration
- **Default enabled**: `use_external_safe_build = true` in `default_config.py`
- **Per-app override**: Set `use_external_safe_build = false` in app's `build_config.ini`
- **Smart copying**: Only copies when source is newer than factory

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
| `use_external_safe_build` | Enable factory directory | `true` (default) |

---

## Conclusion

**System Status**: ✅ FULLY FUNCTIONAL WITH FACTORY DIRECTORY

The multi-app system is working correctly with:
- ✓ Complete app switching from build_config.ini
- ✓ **Factory directory integration** (default enabled)
- ✓ **Safe isolated builds** with node_modules junction
- ✓ **Hot reload from source** while building in factory
- ✓ No hardcoded app lists in index.js
- ✓ Automatic file updates (app.json, index.js, AndroidManifest.xml, metro.config.js)
- ✓ File-based IPC between Python and PowerShell
- ✓ Smart copying with exclusion patterns (node_modules, build dirs)

### Factory Directory Features:
- **Project copied to**: `.factory_builds/{app}/`
- **node_modules junction**: Links to source (saves ~500MB per app)
- **Metro watches**: Source directory `src/apps/{app}/` for hot reload
- **Smart sync**: Only copies when source is newer
- **Fallback**: Automatically falls back to source if factory setup fails

Only minor encoding issues remain with Chinese characters, which do not affect core functionality.
