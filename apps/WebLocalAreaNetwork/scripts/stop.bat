@echo off
REM WebLocalAreaNetwork NCore App Stop Script (BAT Entry Point)
REM Complexity: Simple - Direct batch implementation for process termination
REM This bat file directly implements the stop logic without PowerShell

echo [INFO] Stopping WebLocalAreaNetwork NCore application...

REM Find and terminate WebLocalAreaNetwork processes
echo [INFO] Searching for WebLocalAreaNetwork processes...
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv ^| findstr "app=WebLocalAreaNetwork"') do (
    echo [INFO] Found WebLocalAreaNetwork process PID: %%i
    taskkill /pid %%i /f >nul 2>&1
    if !errorlevel! equ 0 (
        echo [INFO] Successfully stopped process PID: %%i
    ) else (
        echo [WARNING] Failed to stop process PID: %%i
    )
)

REM Check if any processes are still running
tasklist /fi "imagename eq node.exe" /fo csv | findstr "app=WebLocalAreaNetwork" >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Some WebLocalAreaNetwork processes may still be running
) else (
    echo [SUCCESS] All WebLocalAreaNetwork processes stopped successfully
)

exit /b 0

