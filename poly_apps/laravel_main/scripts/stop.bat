@echo off
REM laravel_main Stop Script (BAT Entry Point)
REM Complexity: Simple - Direct batch implementation for process termination
REM This bat file directly implements the stop logic for laravel_main

echo [INFO] Stopping laravel_main application...

REM Stop common development server processes
echo [INFO] Searching for laravel_main processes...

REM Stop npm/yarn/pnpm processes
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv 2^>nul ^| findstr /i "laravel_main"') do (
    echo [INFO] Found laravel_main process PID: %%i
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

echo [SUCCESS] laravel_main stop completed
exit /b 0

