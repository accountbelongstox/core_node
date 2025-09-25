@echo off
setlocal

REM This script starts the Tauri development environment by calling the PowerShell setup script.

set "SCRIPT_DIR=%~dp0"
set "POWERSHELL_SCRIPT=%SCRIPT_DIR%scripts\dev.ps1"

echo [LAUNCHER] Starting development environment...
echo [LAUNCHER] Executing PowerShell script: %POWERSHELL_SCRIPT%

powershell -NoProfile -ExecutionPolicy Bypass -File "%POWERSHELL_SCRIPT%"

if %errorlevel% neq 0 (
    echo [LAUNCHER] Script finished with errors.
    pause
)

endlocal
