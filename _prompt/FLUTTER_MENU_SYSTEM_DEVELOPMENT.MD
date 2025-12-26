# Flutter Menu System Development

## Overview

This document describes the development tasks for the Flutter menu system, focusing on the test chain development (compilation optimization within understandable scope, do not arbitrarily modify compilation functionality).

## Menu Flow

From `dd.cmd` guided menu, finally uses `poly_apps/flutter_bloom/scripts/start.ps1` and executes code `poly_apps/flutter_bloom/scripts/dev/startDebugByPhone.ps1` and `startDebugByWeb.ps1`.

## Development Tasks

### Task 1: Rename Gvar.ps1 and Add File Variable Functions

**File**: `poly_apps/flutter_bloom/scripts/dev/win_common/Gvar.ps1`

**Actions**:
1. Rename file to `FlutterGlobalVar.ps1`
2. Use appropriate namespace directory in `.cache` (project root) as `FTemp` temporary directory
3. In `menu_system.ps1`, first select app, use newly added file variable functions in `FlutterGlobalVar.ps1` to store selected APP, for later use
4. After selecting APP, proceed with other operations

### Task 2: Modify start.ps1

**File**: `poly_apps/flutter_bloom/scripts/start.ps1`

**Actions**:
- Do nothing, directly reference `menu_system.ps1`
- According to selected APP name and action, confirm whether to call `startDebugByPhone.ps1` or `startDebugByWeb.ps1`
- **Note**: Currently only write testing, not yet require modifying compilation work

**Requirement**: First select APP name and action (currently only consider testing), then call corresponding script.

### Task 3: Modify Debug Scripts

**Files**: 
- `startDebugByPhone.ps1`
- `startDebugByWeb.ps1`

**Actions**:
- According to `FlutterGlobalVar.ps1` and `FTemp/flutter_global_vars/**` file variables
- File is variable name, content is value
- Read to get APP and automatically select entry file in current logic

## Reference Documents

Read development documentation: `poly_apps/flutter_bloom/development-guides/FLUTTER_GUIDE_THIS_FILE_NO_AI_EDIT.md`

## Menu Display Example

```
Flutter Multi-App Development System

Main Menu:
1. Select App and Debug/Build
2. Cleanup and Restore
3. System Information
4. Settings
5. Icons Visualization System
0. Exit

Available Flutter Apps:
0. All Apps (Process all apps)
1. app_achat
2. app_example
3. app_main (Main Entry Point)
4. app_wuy

Build Actions:
1. Debug (Run in development mode)
2. Build (Compile for production)

Target Platforms:
1. Web
2. Android
3. Windows
4. All Platforms
```

