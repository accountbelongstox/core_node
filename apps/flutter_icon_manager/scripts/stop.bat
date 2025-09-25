@echo off
REM flutter_icon_manager NCore App Stop Script (BAT Entry Point)
REM Complexity: Simple - Direct batch implementation for process termination
REM This bat file directly implements the stop logic without PowerShell

echo [INFO] Stopping flutter_icon_manager NCore application...

REM Find and terminate flutter_icon_manager processes
echo [INFO] Searching for flutter_icon_manager processes...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr "app=flutter_icon_manager"') do (
    echo [INFO] Found flutter_icon_manager process PID: %%i
    taskkill /pid %%i /f >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] Successfully stopped process PID: %%i
    ) else (
        echo [WARNING] Failed to stop process PID: %%i
    )
)

REM Check if any processes are still running
tasklist /fi "imagename eq node.exe" /fo csv | findstr "app=flutter_icon_manager" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Some flutter_icon_manager processes may still be running
) else (
    echo [SUCCESS] All flutter_icon_manager processes stopped successfully
)

exit /b 0

