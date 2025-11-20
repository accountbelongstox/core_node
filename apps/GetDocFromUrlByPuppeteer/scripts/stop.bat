@echo off
REM GetDocFromUrlByPuppeteer NCore App Stop Script (BAT Entry Point)
REM Complexity: Simple - Direct batch implementation for process termination
REM This bat file directly implements the stop logic without PowerShell

echo [INFO] Stopping GetDocFromUrlByPuppeteer NCore application...

REM Find and terminate GetDocFromUrlByPuppeteer processes
echo [INFO] Searching for GetDocFromUrlByPuppeteer processes...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr "app=GetDocFromUrlByPuppeteer"') do (
    echo [INFO] Found GetDocFromUrlByPuppeteer process PID: %%i
    taskkill /pid %%i /f >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] Successfully stopped process PID: %%i
    ) else (
        echo [WARNING] Failed to stop process PID: %%i
    )
)

REM Check if any processes are still running
tasklist /fi "imagename eq node.exe" /fo csv | findstr "app=GetDocFromUrlByPuppeteer" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Some GetDocFromUrlByPuppeteer processes may still be running
) else (
    echo [SUCCESS] All GetDocFromUrlByPuppeteer processes stopped successfully
)

exit /b 0

