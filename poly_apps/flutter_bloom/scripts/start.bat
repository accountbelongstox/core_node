@echo off

REM flutter_bloom Start Script (BAT Entry Point)
REM Complexity: Complex - Triggers PowerShell script for poly-flutter application startup
REM This bat file serves as the Windows entry point for starting flutter_bloom application
REM IMPORTANT: Windows Script Execution Rules:
REM   - Simple scripts: Use BAT files directly for basic operations  
REM   - Complex scripts: Use BAT triggers to call PS1 scripts (hardcoded implementation)
REM   - NEVER use explorer to directly open PS1 files - they will open as text files
REM   - All Poly applications MUST use BAT entry points that trigger PS1 scripts
REM   - BAT files execute properly when opened with explorer, PS1 files do not
REM PARAMETERS: No parameters allowed for install/start/deploy/build scripts
REM            All scripts must work without external parameters for consistency

echo [INFO] Starting flutter_bloom application...

REM Get script directory and PowerShell script path
set "SCRIPT_DIR=%~dp0"
set "PS1_SCRIPT=%SCRIPT_DIR%start.ps1"

REM Check if PowerShell script exists
if not exist "%PS1_SCRIPT%" (
    echo [ERROR] PowerShell script not found: %PS1_SCRIPT%
    exit /b 1
)

REM Execute PowerShell script with proper execution policy
echo [INFO] Executing PowerShell script: %PS1_SCRIPT%
echo [DEBUG] Normalizing working directory to script location: %SCRIPT_DIR%
pushd "%SCRIPT_DIR%" >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1_SCRIPT%"
set EXIT_CODE=%ERRORLEVEL%
popd >nul

REM Check exit code
if %EXIT_CODE% neq 0 (
    echo [ERROR] flutter_bloom startup failed with exit code: %EXIT_CODE%
    exit /b %EXIT_CODE%
)

echo [SUCCESS] flutter_bloom startup completed
exit /b 0

