@echo off
REM it-tools Start Script (BAT Entry Point)
REM Complexity: Complex - Triggers PowerShell script for poly-vue application startup
REM This bat file serves as the Windows entry point for starting it-tools application
REM IMPORTANT: All Poly applications MUST use BAT triggers to call PS1 scripts
REM           Direct explorer execution of PS1 files is PROHIBITED as PS1 will be treated as text

echo [INFO] Starting it-tools application...

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
    echo [ERROR] it-tools startup failed with exit code: %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [SUCCESS] it-tools startup completed
exit /b 0

