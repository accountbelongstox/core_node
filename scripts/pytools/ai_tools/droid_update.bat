@echo off

REM Factory AI Droid Upgrade Script
REM This script upgrades Factory AI Droid to the latest version

setlocal enabledelayedexpansion

title Factory AI Droid Upgrade

echo.
echo ============================================================
echo Factory AI Droid - Upgrade to Latest Version
echo ============================================================
echo.
echo This window will upgrade Factory AI Droid to its latest version.
echo The upgrade runs in a separate window to avoid interrupting
echo your main development session.
echo.
echo Tool: Factory AI Droid
echo.
echo ============================================================
echo.

echo [INFO] Starting Factory AI Droid upgrade...
echo.

REM Check if droid command is available
echo [INFO] Checking Droid installation...
droid --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Factory AI Droid is not installed.
    echo.
    echo To install Factory AI Droid, run:
    echo   curl -fsSL https://app.factory.ai/cli ^| sh
    echo.
    echo Or visit: https://factory.ai
    echo.
    goto :exit_script
)

echo [SUCCESS] Factory AI Droid is installed
echo.

REM Try to upgrade droid (if upgrade command exists)
echo [CMD]  droid upgrade
echo.

droid upgrade
set "DROID_EXIT_CODE=%ERRORLEVEL%"

if %DROID_EXIT_CODE% NEQ 0 (
    echo.
    echo [INFO] Upgrade command not available or failed, trying reinstall...
    echo [CMD]  curl -fsSL https://app.factory.ai/cli ^| sh
    echo.
    curl -fsSL https://app.factory.ai/cli | sh
    set "DROID_EXIT_CODE=%ERRORLEVEL%"
)

echo.
echo ============================================================
if %DROID_EXIT_CODE% EQU 0 (
    echo [SUCCESS] Factory AI Droid upgrade completed successfully!
    echo.
    echo You can now close this window and start using the latest version.
) else (
    echo [WARNING] Factory AI Droid upgrade completed with warnings.
    echo Exit code: %DROID_EXIT_CODE%
    echo.
    echo Please check the error messages above for more details.
    echo You may need to manually reinstall Factory AI Droid.
)
echo ============================================================
echo.

:exit_script
echo Press any key to close this window...
pause >nul

exit /b %DROID_EXIT_CODE%
