@echo off
REM Matrix Application Launcher
REM This script runs the packaged Matrix application with correct arguments

echo.
echo ======================================================================
echo  Matrix Application Launcher
echo ======================================================================
echo.

REM Get script directory
set SCRIPT_DIR=%~dp0
set DIST_DIR=%SCRIPT_DIR%..\dist\Matrix

REM Check if Matrix.exe exists
if not exist "%DIST_DIR%\Matrix.exe" (
    echo ERROR: Matrix.exe not found at:
    echo   %DIST_DIR%\Matrix.exe
    echo.
    echo Please run build_package.py first to build the application
    echo.
    pause
    exit /b 1
)

echo Starting Matrix application...
echo Executable: %DIST_DIR%\Matrix.exe
echo.

REM Run Matrix with app=matrix argument
"%DIST_DIR%\Matrix.exe" app=matrix

echo.
echo ======================================================================
echo  Matrix Application Exited
echo ======================================================================
echo.
pause
