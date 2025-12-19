@echo off
REM ========================================
REM TcUi Deployment Script for Windows
REM Creates a standalone package with all dependencies
REM ========================================

setlocal enabledelayedexpansion

echo ========================================
echo TcUi Deployment Script for Windows
echo ========================================
echo.

REM Check if windeployqt is available
where windeployqt >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] windeployqt not found in PATH!
    echo Please run this script from Qt Command Prompt.
    pause
    exit /b 1
)

REM Set build configuration
set BUILD_CONFIG=%1
if "%BUILD_CONFIG%"=="" set BUILD_CONFIG=release

echo Deployment configuration: %BUILD_CONFIG%
echo.

REM Navigate to TcUi directory
cd /d "%~dp0..\TcUi"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to navigate to TcUi directory
    pause
    exit /b 1
)

REM Set output and deployment directories
if "%BUILD_CONFIG%"=="debug" (
    set OUTPUT_DIR=output\win\x64\debug
    set DEPLOY_DIR=..\deploy\win\x64\debug
) else (
    set OUTPUT_DIR=output\win\x64\release
    set DEPLOY_DIR=..\deploy\win\x64\release
)

REM Check if build exists
if not exist "%OUTPUT_DIR%\17_TcUi.exe" (
    echo [ERROR] Build not found at %OUTPUT_DIR%\17_TcUi.exe
    echo Please run build-windows.bat first.
    pause
    exit /b 1
)

echo Output directory: %OUTPUT_DIR%
echo Deploy directory: %DEPLOY_DIR%
echo.

REM Create deployment directory
echo Creating deployment directory...
if exist "%DEPLOY_DIR%" rmdir /S /Q "%DEPLOY_DIR%"
mkdir "%DEPLOY_DIR%"

REM Copy executable
echo Copying executable...
copy "%OUTPUT_DIR%\17_TcUi.exe" "%DEPLOY_DIR%\"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to copy executable
    pause
    exit /b 1
)

REM Run windeployqt
echo Running windeployqt...
windeployqt "%DEPLOY_DIR%\17_TcUi.exe" --no-translations
if %errorlevel% neq 0 (
    echo [ERROR] windeployqt failed!
    pause
    exit /b 1
)
echo windeployqt completed.
echo.

REM Copy FFmpeg DLLs
echo Copying FFmpeg libraries...
if exist "third_party\ffmpeg\bin\x64" (
    xcopy "third_party\ffmpeg\bin\x64\*.dll" "%DEPLOY_DIR%\" /Y /Q
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to copy FFmpeg DLLs
    )
) else (
    echo [WARNING] FFmpeg directory not found: third_party\ffmpeg\bin\x64
)
echo.

REM Copy ADB files
echo Copying ADB files...
if exist "third_party\adb\win" (
    mkdir "%DEPLOY_DIR%\adb" 2>nul
    xcopy "third_party\adb\win\*.*" "%DEPLOY_DIR%\adb\" /Y /Q
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to copy ADB files
    )
) else (
    echo [WARNING] ADB directory not found: third_party\adb\win
)
echo.

REM Copy scrcpy-server
echo Copying scrcpy-server...
if exist "third_party\scrcpy-server" (
    mkdir "%DEPLOY_DIR%\scrcpy-server" 2>nul
    xcopy "third_party\scrcpy-server\*.*" "%DEPLOY_DIR%\scrcpy-server\" /Y /Q
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to copy scrcpy-server
    )
) else (
    echo [WARNING] scrcpy-server directory not found: third_party\scrcpy-server
)
echo.

REM Copy config files
echo Copying config files...
if exist "config" (
    mkdir "%DEPLOY_DIR%\config" 2>nul
    xcopy "config\*.*" "%DEPLOY_DIR%\config\" /Y /Q
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to copy config files
    )
) else (
    echo [WARNING] Config directory not found: config
)
echo.

REM Copy keymap files
echo Copying keymap files...
if exist "keymap" (
    mkdir "%DEPLOY_DIR%\keymap" 2>nul
    xcopy "keymap\*.json" "%DEPLOY_DIR%\keymap\" /Y /Q
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to copy keymap files
    )
) else (
    echo [WARNING] Keymap directory not found: keymap
)
echo.

REM Create README
echo Creating README.txt...
(
echo TcUi - Android Screen Mirroring ^& Control
echo ==========================================
echo.
echo Qt Version: 6.9
echo Build Configuration: %BUILD_CONFIG%
echo Build Date: %DATE% %TIME%
echo.
echo How to run:
echo 1. Double-click 17_TcUi.exe
echo 2. Connect your Android device via USB
echo 3. Enable USB debugging on your device
echo.
echo Requirements:
echo - Windows 10 or later
echo - Android device with USB debugging enabled
echo.
echo For more information, visit:
echo https://github.com/barry-ran/QtScrcpy
) > "%DEPLOY_DIR%\README.txt"

echo ========================================
echo Deployment completed successfully!
echo Package location: %CD%\%DEPLOY_DIR%
echo ========================================
echo.
echo You can now:
echo 1. Test the application by running: %DEPLOY_DIR%\17_TcUi.exe
echo 2. Compress the folder and distribute it
echo.

pause
endlocal
