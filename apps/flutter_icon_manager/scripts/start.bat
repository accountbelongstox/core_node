@echo off
REM flutter_icon_manager NCore App Start Script (BAT Entry Point)
REM Complexity: Complex - Triggers PowerShell script for advanced logic
REM This bat file serves as the Windows entry point for starting flutter_icon_manager application

echo [INFO] Starting flutter_icon_manager NCore application...

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
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1_SCRIPT%"

REM Check exit code
if %ERRORLEVEL% neq 0 (
    echo [ERROR] flutter_icon_manager startup failed with exit code: %ERRORLEVEL%
        exit /b %ERRORLEVEL%
)

echo [SUCCESS] flutter_icon_manager startup completed
exit /b 0


