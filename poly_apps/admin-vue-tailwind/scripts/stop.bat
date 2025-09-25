@echo off
REM admin-vue-tailwind Stop Script (BAT Entry Point)
REM Complexity: Simple - Direct batch implementation for process termination
REM This bat file directly implements the stop logic for admin-vue-tailwind

echo [INFO] Stopping admin-vue-tailwind application...

REM Stop common development server processes
echo [INFO] Searching for admin-vue-tailwind processes...

REM Stop npm/yarn/pnpm processes
for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo csv 2^>nul ^| findstr /i "admin-vue-tailwind"') do (
    echo [INFO] Found admin-vue-tailwind process PID: %%i
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

echo [SUCCESS] admin-vue-tailwind stop completed
exit /b 0

