@echo off
REM OKX Price Monitor - Web Server Launcher (Windows)

echo ========================================
echo OKX Price Monitor - Web Interface
echo ========================================
echo.
echo Starting web server on port 58888...
echo Browser will open automatically...
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

python "%~dp0start_web.py"

pause
