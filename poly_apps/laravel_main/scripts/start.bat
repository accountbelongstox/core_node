@echo off
REM laravel_main Start Script (BAT Entry Point)
REM Complexity: Complex - Triggers PowerShell script for poly-laravel application startup
REM This bat file serves as the Windows entry point for starting laravel_main application
REM IMPORTANT: All Poly applications MUST use BAT triggers to call PS1 scripts
REM           Direct explorer execution of PS1 files is PROHIBITED as PS1 will be treated as text
REM PARAMETERS: No parameters allowed for install/start/deploy/build scripts
REM            All scripts must work without external parameters for consistency

echo [INFO] Starting laravel_main application...

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
    echo [ERROR] laravel_main startup failed with exit code: %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)

echo [SUCCESS] laravel_main startup completed
exit /b 0

