@echo off
REM DocumentOffline NCore App Stop Script (BAT Entry Point)
REM Complexity: Simple - Direct batch implementation for process termination
REM This bat file directly implements the stop logic without PowerShell

echo [INFO] Stopping DocumentOffline NCore application...

REM Find and terminate DocumentOffline processes
echo [INFO] Searching for DocumentOffline processes...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr "app=DocumentOffline"') do (
    echo [INFO] Found DocumentOffline process PID: %%i
    taskkill /pid %%i /f >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] Successfully stopped process PID: %%i
    ) else (
        echo [WARNING] Failed to stop process PID: %%i
    )
)

REM Check if any processes are still running
tasklist /fi "imagename eq node.exe" /fo csv | findstr "app=DocumentOffline" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Some DocumentOffline processes may still be running
) else (
    echo [SUCCESS] All DocumentOffline processes stopped successfully
)

exit /b 0

