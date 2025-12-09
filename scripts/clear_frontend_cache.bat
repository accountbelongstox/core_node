@echo off
REM Clear frontend cache and rebuild

echo ========================================
echo Clearing Frontend Cache
echo ========================================

cd /d "%~dp0\..\poly_apps\matrixui"

echo.
echo [1/3] Removing Vite cache...
if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite"
    echo   - Vite cache cleared
) else (
    echo   - No Vite cache found
)

echo.
echo [2/3] Removing dist folder...
if exist "dist" (
    rmdir /s /q "dist"
    echo   - Dist folder cleared
) else (
    echo   - No dist folder found
)

echo.
echo [3/3] Installing dependencies...
call pnpm install

echo.
echo ========================================
echo Cache cleared successfully!
echo ========================================
echo.
echo Next steps:
echo 1. Restart the Matrix application
echo 2. Or run: python pymain.py app=matrix
echo.
pause
