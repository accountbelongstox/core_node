# File Structure Migration Guide

**Date:** 2025-12-11
**Migration:** From flat structure to organized multi-directory structure

## Overview

The build_scripts directory has been reorganized from a flat structure with 30+ files in the root to a well-organized multi-directory structure with clear separation of concerns.

## File Migration Map

### Entry Point Files

| Old Location | New Location | Notes |
|--------------|--------------|-------|
| `main_controller.py` | `core/build_controller.py` | Moved to core/ with updated imports |
| N/A (new file) | `main.py` | **New entry point** - Call this instead of main_controller.py |

### Configuration Files (Root Level - No Change)

| File | Location | Notes |
|------|----------|-------|
| `build_versions_config.json` | Root (no change) | Version configuration |
| `README.md` | Root (updated) | Main documentation |
| `PRE_BUILD_CHECKLIST.md` | Root (new) | Frontend checklist |

### Core Business Logic

| Old Location | New Location | Notes |
|--------------|--------------|-------|
| `main_controller.py` | `core/build_controller.py` | Main controller class |
| N/A | `core/__init__.py` | Module initialization |

### Managers (Resource Management)

| Old Location | New Location | Notes |
|--------------|--------------|-------|
| `capacitor_resource_manager.py` | `managers/capacitor_resource_manager.py` | Capacitor asset management |
| `resource_replacer.py` | `managers/resource_replacer.py` | Android resource replacement |
| `resource_scanner.py` | `managers/resource_scanner.py` | Resource scanning |
| N/A | `managers/__init__.py` | Module initialization |

### Utilities

| Old Location | New Location | Notes |
|--------------|--------------|-------|
| `file_var_system_new.py` | `utils/file_var_system_new.py` | File variable system |
| `init_build_config.py` | `utils/init_build_config.py` | Build config initialization |
| `key_center.py` | `utils/key_center.py` | Central key definitions |
| `web_preview_server.py` | `utils/web_preview_server.py` | Web preview server |
| N/A | `utils/__init__.py` | Module initialization |

### Shell Scripts

| Old Location | New Location | Notes |
|--------------|--------------|-------|
| `execute_commands_windows_new.ps1` | `shell/execute_commands_windows_new.ps1` | PowerShell script |
| `execute_commands_linux_new.sh` | `shell/execute_commands_linux_new.sh` | Bash script |

### Documentation

All `.md` files moved to `docs/` directory:

| Old Location | New Location |
|--------------|--------------|
| `ANDROID_PLATFORM_INTERACTIVE.md` | `docs/ANDROID_PLATFORM_INTERACTIVE.md` |
| `BUILD_FLOW_CONFIRMED.md` | `docs/BUILD_FLOW_CONFIRMED.md` |
| `BUILD_VERSIONS_README.md` | `docs/BUILD_VERSIONS_README.md` |
| `CAPACITOR_CONFIG_ERROR_HANDLING.md` | `docs/CAPACITOR_CONFIG_ERROR_HANDLING.md` |
| `CAPACITOR_INTEGRATION_COMPLETE.md` | `docs/CAPACITOR_INTEGRATION_COMPLETE.md` |
| `CODE_CONSISTENCY_ANALYSIS.md` | `docs/CODE_CONSISTENCY_ANALYSIS.md` |
| `GRADLE_CACHE_AUTO_FIX.md` | `docs/GRADLE_CACHE_AUTO_FIX.md` |
| `LEGACY_CODE_CLEANUP.md` | `docs/LEGACY_CODE_CLEANUP.md` |
| `LOGIC_SCAN_REPORT.md` | `docs/LOGIC_SCAN_REPORT.md` |
| `MIGRATION_GUIDE.md` | `docs/MIGRATION_GUIDE.md` |
| `OPTIMIZED_PACKAGE_INSTALLATION.md` | `docs/OPTIMIZED_PACKAGE_INSTALLATION.md` |
| `PACKAGE_INSTALLATION_OPTIMIZATION.md` | `docs/PACKAGE_INSTALLATION_OPTIMIZATION.md` |
| `PNPM_ADD_LIMITATION.md` | `docs/PNPM_ADD_LIMITATION.md` |
| `QUICK_START_RESOURCE_REPLACEMENT.md` | `docs/QUICK_START_RESOURCE_REPLACEMENT.md` |
| `REFACTORING_COMPLETE.md` | `docs/REFACTORING_COMPLETE.md` |
| `REFACTORING_SUMMARY.md` | `docs/REFACTORING_SUMMARY.md` |
| `RESOURCE_REPLACEMENT_GUIDE.md` | `docs/RESOURCE_REPLACEMENT_GUIDE.md` |
| `SYNTAX_FIX.md` | `docs/SYNTAX_FIX.md` |
| `SYSTEM_READY_REPORT.md` | `docs/SYSTEM_READY_REPORT.md` |
| `WEB_PREVIEW_GUIDE.md` | `docs/WEB_PREVIEW_GUIDE.md` |
| N/A (new) | `docs/PRE_BUILD_CHECKLIST.md` |

### Legacy/Old Files (Kept for Reference)

| File | Location | Status |
|------|----------|--------|
| `file_var_system.py` | Root | Old version, use `utils/file_var_system_new.py` |
| `execute_commands_windows.ps1` | Root | Old version, use `shell/execute_commands_windows_new.ps1` |
| `execute_commands_linux.sh` | Root | Old version, use `shell/execute_commands_linux_new.sh` |
| `android_prebuild.py` | Root | Standalone script (not integrated) |
| `test_preview.py` | Root | Test utility |

## Import Changes

### Old Import Style (Flat Structure)

```python
# In main_controller.py
from file_var_system_new import FileVarSystem
from init_build_config import create_default_config
from resource_scanner import ResourceScanner
from key_center import VERSION_CONFIG
```

### New Import Style (Organized Structure)

```python
# In core/build_controller.py
from utils.file_var_system_new import FileVarSystem
from utils.init_build_config import create_default_config
from managers.resource_scanner import ResourceScanner
from utils.key_center import VERSION_CONFIG
```

### For External Scripts

**Old way (DEPRECATED):**
```python
from main_controller import BuildController
```

**New way (RECOMMENDED):**
```python
from core.build_controller import BuildController
```

**Best way (USE THIS):**
```python
# Just call main.py as entry point
# No need to import anything
```

## Command Line Usage Changes

### Old Usage (DEPRECATED)

```bash
# This still works but is not recommended
python main_controller.py /path/to/project
```

### New Usage (RECOMMENDED)

```bash
# Use the new entry point
python main.py /path/to/project
```

## For Start Scripts

### Windows (start.ps1)

**Update this line:**

```powershell
# Old
& python "$BUILD_SCRIPTS_DIR\main_controller.py" $PROJECT_ROOT

# New
& python "$BUILD_SCRIPTS_DIR\main.py" $PROJECT_ROOT
```

**Update shell script path:**

```powershell
# Old
& "$BUILD_SCRIPTS_DIR\execute_commands_windows_new.ps1" -Prefix $APP_PREFIX

# New
& "$BUILD_SCRIPTS_DIR\shell\execute_commands_windows_new.ps1" -Prefix $APP_PREFIX
```

### Linux/Mac (start.sh)

**Update this line:**

```bash
# Old
python "$BUILD_SCRIPTS_DIR/main_controller.py" "$PROJECT_ROOT"

# New
python "$BUILD_SCRIPTS_DIR/main.py" "$PROJECT_ROOT"
```

**Update shell script path:**

```bash
# Old
"$BUILD_SCRIPTS_DIR/execute_commands_linux_new.sh" "$APP_PREFIX"

# New
"$BUILD_SCRIPTS_DIR/shell/execute_commands_linux_new.sh" "$APP_PREFIX"
```

## Directory Structure Comparison

### Old Structure (Flat - 30+ files in root)

```
build_scripts/
├── main_controller.py
├── file_var_system_new.py
├── init_build_config.py
├── key_center.py
├── capacitor_resource_manager.py
├── resource_replacer.py
├── resource_scanner.py
├── web_preview_server.py
├── execute_commands_windows_new.ps1
├── execute_commands_linux_new.sh
├── build_versions_config.json
├── ANDROID_PLATFORM_INTERACTIVE.md
├── BUILD_FLOW_CONFIRMED.md
├── ... (20+ more .md files)
└── react_native_scripts/
```

### New Structure (Organized - 5 directories + entry point)

```
build_scripts/
├── main.py                          # Entry point
├── build_versions_config.json       # Config
├── README.md                        # Main docs
│
├── core/                            # Core logic
│   ├── __init__.py
│   └── build_controller.py
│
├── managers/                        # Managers
│   ├── __init__.py
│   ├── capacitor_resource_manager.py
│   ├── resource_replacer.py
│   └── resource_scanner.py
│
├── utils/                           # Utilities
│   ├── __init__.py
│   ├── file_var_system_new.py
│   ├── init_build_config.py
│   ├── key_center.py
│   └── web_preview_server.py
│
├── shell/                           # Shell scripts
│   ├── execute_commands_windows_new.ps1
│   └── execute_commands_linux_new.sh
│
├── docs/                            # Documentation
│   ├── PRE_BUILD_CHECKLIST.md
│   ├── BUILD_FLOW_CONFIRMED.md
│   └── ... (all .md files)
│
└── react_native_scripts/            # React Native (unchanged)
```

## Benefits of New Structure

### 1. Clear Separation of Concerns
- **core/** = Business logic
- **managers/** = Resource management
- **utils/** = Utilities
- **shell/** = Execution scripts
- **docs/** = Documentation

### 2. Easier Navigation
- No more scrolling through 30+ files in root
- Related files grouped together
- Clear module boundaries

### 3. Better Maintainability
- Entry point is obvious (`main.py`)
- Import paths clearly show dependencies
- Easier to find what you need

### 4. Scalability
- Easy to add new modules
- Can split large modules further if needed
- Clear places for new features

### 5. Professional Structure
- Follows Python best practices
- Similar to other large Python projects
- Easier for new developers to understand

## Migration Checklist for External Scripts

- [ ] Update `start.ps1` to call `main.py` instead of `main_controller.py`
- [ ] Update `start.sh` to call `main.py` instead of `main_controller.py`
- [ ] Update shell script paths to `shell/execute_commands_*.{ps1,sh}`
- [ ] Update any documentation references to old file paths
- [ ] Test build process with new structure
- [ ] Verify all imports work correctly

## Backward Compatibility

### Temporary Compatibility (Old files still exist)

The old files (`main_controller.py`, etc.) still exist in the root directory temporarily for backward compatibility. However:

1. **They are NOT updated** - All changes go to new structure
2. **They will be removed** - In next cleanup phase
3. **Do NOT use them** - Update your scripts to use new structure

### Breaking Changes

If you have custom scripts that import from build_scripts:

```python
# This will break when old files are removed
from main_controller import BuildController  # ❌ Will break

# Update to this
from core.build_controller import BuildController  # ✓ Future-proof
```

## Need Help?

If you encounter issues after migration:

1. Check this migration guide first
2. Check `README.md` for new structure
3. Check `docs/PRE_BUILD_CHECKLIST.md` for frontend config
4. Contact build system maintainer

## Summary

**What changed:**
- Files organized into `core/`, `managers/`, `utils/`, `shell/`, `docs/` directories
- New entry point: `main.py`
- Import paths updated with directory prefixes

**What stayed the same:**
- `build_versions_config.json` still in root
- File variable architecture unchanged
- Build flow and logic unchanged
- Command functionality unchanged

**What you need to do:**
- Update start scripts to call `main.py`
- Update shell script paths to `shell/` directory
- Update any custom imports to include directory prefixes

**Migration effort:** Low - Mostly path updates in start scripts
