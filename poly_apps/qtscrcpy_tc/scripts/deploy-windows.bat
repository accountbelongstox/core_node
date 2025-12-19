@echo off
REM ========================================
REM TcUi Deployment Script for Windows
REM Qt 6.10 - Creates standalone package
REM ========================================

setlocal enabledelayedexpansion

echo ========================================
echo TcUi Deployment Script for Windows
echo Qt 6.10 Deployment System
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

REM Verify Qt 6.10
for /f "tokens=4" %%i in ('qmake -v ^| findstr "Qt version"') do set QT_VERSION=%%i
echo Using Qt version: %QT_VERSION%
echo.

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
    set DEPLOY_DIR=..\deploy\win\x64\debug\TcUi
) else (
    set OUTPUT_DIR=output\win\x64\release
    set DEPLOY_DIR=..\deploy\win\x64\release\TcUi
)

REM Check if build exists
if not exist "%OUTPUT_DIR%\17_TcUi.exe" (
    echo [ERROR] Build not found at %OUTPUT_DIR%\17_TcUi.exe
    echo Please run build-windows.bat first.
    pause
    exit /b 1
)

echo Source directory: %OUTPUT_DIR%
echo Deploy directory: %DEPLOY_DIR%
echo.

REM Create deployment directory
echo Creating deployment directory...
if exist "%DEPLOY_DIR%" (
    echo Cleaning existing deployment...
    rmdir /S /Q "%DEPLOY_DIR%"
)
mkdir "%DEPLOY_DIR%"

REM Copy executable
echo Copying executable...
copy "%OUTPUT_DIR%\17_TcUi.exe" "%DEPLOY_DIR%\"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to copy executable
    pause
    exit /b 1
)
echo.

REM Run windeployqt for Qt 6.10
echo Running windeployqt for Qt 6.10...
echo This will collect all Qt 6.10 dependencies...
windeployqt "%DEPLOY_DIR%\17_TcUi.exe" --no-translations --no-system-d3d-compiler --no-opengl-sw
if %errorlevel% neq 0 (
    echo [WARNING] windeployqt encountered issues, but continuing...
)
echo windeployqt completed.
echo.

REM Copy FFmpeg DLLs
echo Copying FFmpeg libraries...
if exist "third_party\ffmpeg\bin\x64" (
    xcopy "third_party\ffmpeg\bin\x64\*.dll" "%DEPLOY_DIR%\" /Y /Q
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to copy FFmpeg DLLs
    ) else (
        echo FFmpeg DLLs copied successfully.
    )
) else (
    echo [WARNING] FFmpeg directory not found: third_party\ffmpeg\bin\x64
    echo Application may fail to decode video without FFmpeg.
)
echo.

REM Copy ADB files
echo Copying ADB tools...
if exist "third_party\adb\win" (
    mkdir "%DEPLOY_DIR%\adb" 2>nul
    xcopy "third_party\adb\win\*.*" "%DEPLOY_DIR%\adb\" /Y /Q
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to copy ADB files
    ) else (
        echo ADB tools copied successfully.
    )
) else (
    echo [WARNING] ADB directory not found: third_party\adb\win
    echo Application will not be able to connect to Android devices.
)
echo.

REM Copy scrcpy-server
echo Copying scrcpy-server...
if exist "third_party\scrcpy-server" (
    mkdir "%DEPLOY_DIR%\scrcpy-server" 2>nul
    xcopy "third_party\scrcpy-server\*.*" "%DEPLOY_DIR%\scrcpy-server\" /Y /Q /E
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to copy scrcpy-server
    ) else (
        echo scrcpy-server copied successfully.
    )
) else (
    echo [WARNING] scrcpy-server directory not found: third_party\scrcpy-server
    echo Application will not be able to mirror Android screens.
)
echo.

REM Copy config files
echo Copying configuration files...
if exist "config" (
    mkdir "%DEPLOY_DIR%\config" 2>nul
    xcopy "config\*.*" "%DEPLOY_DIR%\config\" /Y /Q
    if %errorlevel% neq 0 (
        echo [WARNING] Failed to copy config files
    ) else (
        echo Config files copied successfully.
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
    ) else (
        echo Keymap files copied successfully.
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
echo Version Information:
echo   Qt Version: %QT_VERSION%
echo   Build Configuration: %BUILD_CONFIG%
echo   Build Date: %DATE% %TIME%
echo   Platform: Windows x64
echo.
echo System Requirements:
echo   - Windows 10 1809 or later ^(recommended: Windows 11^)
echo   - 64-bit processor
echo   - 4 GB RAM ^(minimum^), 8 GB recommended
echo   - Android device with USB debugging enabled
echo   - USB cable for device connection
echo.
echo How to Run:
echo   1. Connect your Android device via USB
echo   2. Enable USB debugging in Developer Options
echo   3. Run 17_TcUi.exe
echo   4. Allow USB debugging when prompted on device
echo   5. Your device screen will appear in the application
echo.
echo Qt 6.10 Features:
echo   - Enhanced high-DPI scaling support
echo   - Improved accessibility for assistive technologies
echo   - Better touch and stylus input handling
echo   - Native audio backend improvements
echo.
echo Directory Structure:
echo   17_TcUi.exe          - Main application
echo   adb\                 - Android Debug Bridge tools
echo   scrcpy-server\       - Screen mirroring server
echo   config\              - Configuration files
echo   keymap\              - Keyboard mapping profiles
echo   *.dll                - Qt 6.10 and FFmpeg libraries
echo.
echo Troubleshooting:
echo   - Device not detected: Check USB debugging is enabled
echo   - Black screen: Ensure scrcpy-server files are present
echo   - No audio: Check system audio settings and device permissions
echo   - High CPU usage: Try reducing bit rate in settings
echo.
echo For more information:
echo   Qt 6.10 Documentation: https://doc.qt.io/qt-6/
echo   Original QtScrcpy: https://github.com/barry-ran/QtScrcpy
echo   scrcpy Project: https://github.com/Genymobile/scrcpy
echo.
echo License: See LICENSE file
echo Copyright ^(c^) 2025
) > "%DEPLOY_DIR%\README.txt"

REM Create version info file
echo Creating version.json...
(
echo {
echo   "application": "TcUi",
echo   "version": "1.0.0",
echo   "qt_version": "%QT_VERSION%",
echo   "build_config": "%BUILD_CONFIG%",
echo   "build_date": "%DATE%",
echo   "build_time": "%TIME%",
echo   "platform": "Windows x64",
echo   "compiler": "MSVC",
echo   "cpp_standard": "C++17"
echo }
) > "%DEPLOY_DIR%\version.json"

REM Calculate directory size
for /f "tokens=3" %%a in ('dir "%DEPLOY_DIR%" /-c ^| find "File(s)"') do set DEPLOY_SIZE=%%a

echo ========================================
echo Deployment Completed Successfully!
echo ========================================
echo Package location: %CD%\%DEPLOY_DIR%
echo Package size: %DEPLOY_SIZE% bytes
echo.
echo Package Contents:
echo   - TcUi executable (Qt 6.10)
echo   - All Qt 6.10 dependencies
echo   - FFmpeg video codec libraries
echo   - ADB tools for Android connection
echo   - scrcpy-server for screen mirroring
echo   - Configuration and keymap files
echo   - README and version information
echo.
echo Next Steps:
echo   1. Test the application: %DEPLOY_DIR%\17_TcUi.exe
echo   2. Compress the TcUi folder for distribution (ZIP/7z)
echo   3. Share the package - it's fully portable!
echo.
echo Distribution Notes:
echo   - No installation required
echo   - No registry modifications
echo   - Can run from any location
echo   - Users need Android USB debugging enabled
echo.

pause
endlocal
