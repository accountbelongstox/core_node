@echo off
REM pyMatrix Webview Desktop Launcher
REM Launches pyMatrix with native desktop window and system tray icon

echo ============================================================
echo pyMatrix - Webview Desktop Mode Launcher
echo ============================================================
echo.
echo Starting pyMatrix with:
echo - Native desktop window
echo - System tray icon
echo - Embedded webview (no browser)
echo.
echo Please wait...
echo.

cd /d "%~dp0..\.."
python poly_apps\pyMatrix\main.py --webview

pause
