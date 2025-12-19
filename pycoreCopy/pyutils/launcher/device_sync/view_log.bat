@echo off
REM Device Sync - View Log Files (Windows)

echo ================================================
echo Device Sync - Log Viewer
echo ================================================
echo.

set LOG_DIR=%TEMP%\device_sync
set LAUNCHER_LOG=%LOG_DIR%\device_sync_launcher.log
set MAIN_LOG=%LOG_DIR%\device_sync.log

echo Log directory: %LOG_DIR%
echo.

REM Check launcher log
echo [1] Launcher Log (from launcher.py startup)
echo ================================================
if exist "%LAUNCHER_LOG%" (
    type "%LAUNCHER_LOG%"
    echo.
) else (
    echo Not found: %LAUNCHER_LOG%
    echo.
)

echo ================================================
echo.

REM Check main log
echo [2] Device Sync Main Log (from background process)
echo ================================================
if exist "%MAIN_LOG%" (
    type "%MAIN_LOG%"
    echo.
) else (
    echo Not found: %MAIN_LOG%
    echo.
)

echo ================================================
echo.

if not exist "%LAUNCHER_LOG%" (
    if not exist "%MAIN_LOG%" (
        echo No log files found!
        echo.
        echo This means Device Sync was never started.
        echo.
        echo To start Device Sync:
        echo   python -m pycore.pyutils.launcher.launcher
        echo   Select option [2] - Launch Device Sync Only
    )
)

echo.
pause
