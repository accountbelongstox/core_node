@echo off
REM VideoCompression NCore App Deploy Script (BAT Entry Point)
REM Complexity: Complex - Triggers PowerShell script for production deployment
REM This bat file serves as the Windows entry point for deploying VideoCompression application

echo [INFO] Deploying VideoCompression NCore application...

REM Get script directory and PowerShell script path
set "SCRIPT_DIR=%~dp0"
set "PS1_SCRIPT=%SCRIPT_DIR%deploy.ps1"

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
    echo [ERROR] VideoCompression deployment failed with exit code: %ERRORLEVEL%
        exit /b %ERRORLEVEL%
)

echo [SUCCESS] VideoCompression deployment completed
exit /b 0


