@echo off
chcp 65001 >nul
echo ================================
echo React Web Project Startup
echo ================================
echo.

echo [1/3] Checking pnpm...
where pnpm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: pnpm is not installed!
    echo Please install pnpm: npm install -g pnpm
    pause
    exit /b 1
)
echo ✓ pnpm found
echo.

echo [2/3] Checking dependencies...
if not exist "node_modules\" (
    echo Dependencies not found. Installing...
    call pnpm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install dependencies!
        pause
        exit /b 1
    )
) else (
    echo ✓ Dependencies installed
)
echo.

echo [3/3] Starting development server...
echo.
echo ======================================
echo Server will start at: http://localhost:3000
echo Press Ctrl+C to stop the server
echo ======================================
echo.

call pnpm dev
