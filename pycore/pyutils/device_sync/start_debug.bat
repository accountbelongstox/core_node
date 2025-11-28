@echo off
REM Device Sync - Debug Mode Startup (Windows)
REM This script runs Device Sync in console mode (no background) to see all output

echo ================================================
echo Device Sync - Debug Mode
echo ================================================
echo.
echo Running in FOREGROUND mode (you will see all output)
echo Console window must stay open
echo.

REM Disable auto-background mode
set DEVICE_SYNC_NO_BACKGROUND=1

echo Starting Device Sync...
python -m pycore.pyutils.launcher.device_sync

echo.
echo ================================================
echo Device Sync stopped
echo ================================================
pause
