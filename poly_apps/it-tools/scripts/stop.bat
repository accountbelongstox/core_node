@echo off
REM it-tools Stop Script (BAT Entry Point)
REM Complexity: Simple - Direct batch implementation for process termination
REM This bat file directly implements the stop logic for it-tools

echo [INFO] Stopping it-tools application...

REM Stop common development server processes
echo [INFO] Searching for it-tools processes...

REM Stop npm/yarn/pnpm processes
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv 2^>nul ^| findstr /i "it-tools"') do (
    echo [INFO] Found it-tools process PID: %%i
    taskkill /pid %%i /f >nul 2>&1
)

REM Stop PHP processes (for Laravel apps)
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq php.exe" /fo csv 2^>nul ^| findstr /i "artisan"') do (
    echo [INFO] Found PHP artisan process PID: %%i
    taskkill /pid %%i /f >nul 2>&1
)

REM Stop Flutter processes
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq flutter.exe" /fo csv 2^>nul') do (
    echo [INFO] Found Flutter process PID: %%i
    taskkill /pid %%i /f >nul 2>&1
)

echo [SUCCESS] it-tools stop completed
exit /b 0

