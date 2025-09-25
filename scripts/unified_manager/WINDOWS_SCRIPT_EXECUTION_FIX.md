# Windows Script Execution Fix

## Problem Description

Previously, the Unified App Manager was using `explorer` to directly open PowerShell (.ps1) files, which caused them to be treated as text files instead of executable scripts. This resulted in applications not starting properly.

## Root Cause

When using `explorer "path/to/script.ps1"`, Windows opens the file in the default text editor rather than executing it as a PowerShell script.

## Solution Implemented

### 1. Updated App Registry Configuration

Modified `scripts/unified_manager/app_registry.json` to use `.bat` trigger files instead of `.ps1` files for all `start_cmd` entries:

**Before:**
```json
"start_cmd": "explorer \"poly_apps\\flutter_bloom\\scripts\\start.ps1\""
```

**After:**
```json
"start_cmd": "explorer \"poly_apps\\flutter_bloom\\scripts\\start.bat\""
```

### 2. Applications Fixed

The following applications were updated:
- flutter_bloom
- nuxt_main:example
- nuxt_main:codemart
- nuxt_main:dev
- nuxt_main:admin
- nuxt_main:dashboard
- admin-vue-tailwind
- it-tools
- laravel_main

### 3. BAT Trigger Script Pattern

All applications now use standardized BAT trigger scripts that:
1. Serve as Windows entry points
2. Validate PowerShell script existence
3. Execute PowerShell scripts with proper execution policy
4. Handle error codes appropriately
5. Provide clear logging

**Example BAT Structure:**
```batch
@echo off
REM Application Start Script (BAT Entry Point)
REM Complexity: Complex - Triggers PowerShell script for application startup
REM IMPORTANT: All applications MUST use BAT triggers to call PS1 scripts
REM           Direct explorer execution of PS1 files is PROHIBITED

echo [INFO] Starting application...
set "SCRIPT_DIR=%~dp0"
set "PS1_SCRIPT=%SCRIPT_DIR%start.ps1"

if not exist "%PS1_SCRIPT%" (
    echo [ERROR] PowerShell script not found: %PS1_SCRIPT%
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1_SCRIPT%"

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Application startup failed with exit code: %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [SUCCESS] Application startup completed
exit /b 0
```

## Development Standards

### For Simple Scripts
- Use BAT files directly for basic operations
- No PowerShell required for simple tasks

### For Complex Scripts
- Use BAT triggers to call PS1 scripts (hardcoded implementation)
- BAT file serves as entry point
- PS1 file contains the complex logic
- Both trigger and PS1 scripts must be AI hardcoded

### Prohibited Practices
- ❌ Direct explorer execution of PS1 files
- ❌ Using `explorer "script.ps1"` in start commands
- ❌ Relying on Windows file associations for script execution

### Required Practices
- ✅ Use BAT triggers for all Windows script execution
- ✅ Include proper error handling in BAT files
- ✅ Add clear comments explaining the trigger pattern
- ✅ Validate PowerShell script existence before execution
- ✅ Use proper PowerShell execution policies

## Files Modified

1. `scripts/unified_manager/app_registry.json` - Updated all poly app start commands
2. `scripts/unified_manager/start_apps.ps1` - Added documentation comments
3. `apps/DevOps/scripts/start.bat` - Added important comments
4. All existing BAT trigger files already had correct implementation

## Testing

After this fix:
1. Unified App Manager now properly executes applications
2. BAT files open in command prompt and execute PowerShell scripts
3. Applications start correctly instead of opening as text files
4. Error handling provides clear feedback

## Future Development

All new applications must follow this pattern:
1. Create both `.bat` and `.ps1` files in the `scripts` directory
2. Use `.bat` as the entry point in app registry
3. Include proper comments and error handling
4. Test execution through Unified App Manager

This ensures consistent, reliable application startup across all Windows environments.
