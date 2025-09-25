@echo off
REM ai_translator_app NCore App Stop Script (BAT Entry Point)
REM Complexity: Simple - Direct batch implementation for process termination
REM This bat file directly implements the stop logic without PowerShell

echo [INFO] Stopping ai_translator_app NCore application...

REM Find and terminate ai_translator_app processes
echo [INFO] Searching for ai_translator_app processes...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr "app=ai_translator_app"') do (
    echo [INFO] Found ai_translator_app process PID: %%i
    taskkill /pid %%i /f >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] Successfully stopped process PID: %%i
    ) else (
        echo [WARNING] Failed to stop process PID: %%i
    )
)

REM Check if any processes are still running
tasklist /fi "imagename eq node.exe" /fo csv | findstr "app=ai_translator_app" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Some ai_translator_app processes may still be running
) else (
    echo [SUCCESS] All ai_translator_app processes stopped successfully
)

exit /b 0

