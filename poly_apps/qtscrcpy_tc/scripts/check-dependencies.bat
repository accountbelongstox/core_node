@echo off
REM ========================================
REM Dependency Checker and Auto-Installer
REM XingCan Cloud Matrix Build System
REM ========================================

setlocal enabledelayedexpansion

echo ========================================
echo Checking Build Dependencies
echo ========================================
echo.

set "ALL_OK=1"

REM ========================================
REM 1. Check Qt
REM ========================================
echo [1/5] Checking Qt installation...

where qmake >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Qt found in PATH
    qmake -v | findstr "Qt version"
) else (
    echo [MISSING] Qt not found
    echo [FIX] Install Qt 6.10+ from: https://www.qt.io/download-qt-installer
    echo       Recommended: Qt 6.10.0 with MSVC 2022 64-bit
    set "ALL_OK=0"
)
echo.

REM ========================================
REM 2. Check MSVC
REM ========================================
echo [2/5] Checking MSVC compiler...

where cl >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] MSVC compiler found
    cl 2>&1 | findstr "Version"
) else (
    echo [MISSING] MSVC compiler not found
    echo [FIX] Install Visual Studio 2022:
    echo       winget install Microsoft.VisualStudio.2022.Community
    echo       Then install "Desktop development with C++" workload
    set "ALL_OK=0"
)
echo.

REM ========================================
REM 3. Check Windows SDK
REM ========================================
echo [3/5] Checking Windows SDK...

if exist "C:\Program Files (x86)\Windows Kits\10\Include" (
    echo [OK] Windows SDK found
    for /d %%D in ("C:\Program Files (x86)\Windows Kits\10\Include\10.*") do (
        echo     Version: %%~nxD
    )
) else (
    echo [MISSING] Windows SDK not found
    echo [FIX] Installing Windows SDK...
    winget install Microsoft.WindowsSDK.10.0.22621 --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% equ 0 (
        echo [OK] Windows SDK installed
    ) else (
        echo [ERROR] Failed to install Windows SDK
        echo [MANUAL] Install from: https://developer.microsoft.com/en-us/windows/downloads/windows-sdk/
        set "ALL_OK=0"
    )
)
echo.

REM ========================================
REM 4. Check FFmpeg
REM ========================================
echo [4/5] Checking FFmpeg...

set "FFMPEG_SEARCH=D:\applications\FFmpeg"
set "FFMPEG_FOUND=0"

if exist "%FFMPEG_SEARCH%" (
    for /r "%FFMPEG_SEARCH%" %%F in (avcodec-*.dll) do (
        set "FFMPEG_FOUND=1"
        echo [OK] FFmpeg found
        echo     Path: %%~dpF
        goto :ffmpeg_done
    )
)

if "%FFMPEG_FOUND%"=="0" (
    echo [MISSING] FFmpeg not found in %FFMPEG_SEARCH%
    echo [FIX] Installing FFmpeg...
    echo.

    if not exist "%FFMPEG_SEARCH%" mkdir "%FFMPEG_SEARCH%"

    winget install --id Gyan.FFmpeg --silent --accept-package-agreements --accept-source-agreements

    if %errorlevel% equ 0 (
        echo [OK] FFmpeg installation initiated
        echo [INFO] FFmpeg will be installed to default location
        echo [INFO] You may need to move it to: %FFMPEG_SEARCH%
    ) else (
        echo [ERROR] Failed to install FFmpeg
        echo [MANUAL] Download from: https://www.gyan.dev/ffmpeg/builds/
        echo [MANUAL] Extract to: %FFMPEG_SEARCH%
        set "ALL_OK=0"
    )
)

:ffmpeg_done
echo.

REM ========================================
REM 5. Check Git (optional but recommended)
REM ========================================
echo [5/5] Checking Git (optional)...

where git >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Git found
    git --version
) else (
    echo [INFO] Git not found (optional)
    echo [FIX] Install Git: winget install Git.Git
)
echo.

REM ========================================
REM Summary
REM ========================================
echo ========================================
echo Dependency Check Summary
echo ========================================
echo.

if "%ALL_OK%"=="1" (
    echo [SUCCESS] All required dependencies are installed!
    echo.
    echo You can now build the project:
    echo   cd scripts
    echo   .\start.ps1
    echo.
    echo Or use the build script directly:
    echo   cd scripts
    echo   build-windows.bat release
) else (
    echo [WARNING] Some dependencies are missing
    echo.
    echo Please follow the [FIX] instructions above to install missing dependencies.
    echo After installation, run this script again to verify.
    echo.
    echo Quick install all with winget:
    echo   winget install Microsoft.VisualStudio.2022.Community
    echo   winget install Microsoft.WindowsSDK.10.0.22621
    echo   winget install Gyan.FFmpeg
    echo.
    echo Then download and install Qt manually from:
    echo   https://www.qt.io/download-qt-installer
)
echo.

pause
endlocal
