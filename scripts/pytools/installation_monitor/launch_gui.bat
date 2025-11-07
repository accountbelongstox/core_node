@echo off
REM Launch Installation Monitor GUI
REM Run this script to start the graphical interface

echo Starting Installation Monitor GUI...
echo.

cd /d "%~dp0"
python main.py

if errorlevel 1 (
    echo.
    echo Error: Failed to start GUI
    echo Please ensure Python is installed and in your PATH
    pause
)
