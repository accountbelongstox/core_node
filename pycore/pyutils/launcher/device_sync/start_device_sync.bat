@echo off
REM Device Sync - Background Launcher
REM This script starts Device Sync in background mode (detached from console)

echo Starting Device Sync in background...

REM Get Python executable path
set PYTHON_EXE=python

REM Check if pythonw.exe exists (no console window)
where pythonw >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PYTHON_EXE=pythonw
    echo Using pythonw.exe (no console window)
) else (
    echo Warning: pythonw.exe not found, using python.exe
    echo Console window will remain visible
)

REM Start Device Sync in background
start "" %PYTHON_EXE% -m pycore.pyutils.launcher.device_sync

echo Device Sync started in background
echo Check system tray for Device Sync icon
echo.
echo You can safely close this window now.
echo.
pause
