@echo off
REM Launch Installation Monitor CLI
REM Run this script to start the command-line interface

echo Starting Installation Monitor CLI...
echo.

cd /d "%~dp0"
python monitor_orchestrator.py

if errorlevel 1 (
    echo.
    echo Error: Failed to start CLI
    echo Please ensure Python is installed and in your PATH
    pause
)
