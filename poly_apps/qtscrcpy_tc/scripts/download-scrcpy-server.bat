@echo off
REM ========================================
REM Download scrcpy-server 3.3.3
REM ========================================

setlocal enabledelayedexpansion

echo ========================================
echo Downloading scrcpy-server v3.3.3
echo ========================================
echo.

set SCRCPY_VERSION=3.3.3
set DOWNLOAD_URL=https://github.com/Genymobile/scrcpy/releases/download/v%SCRCPY_VERSION%/scrcpy-server-v%SCRCPY_VERSION%
set TARGET_DIR=..\TcUi\third_party\scrcpy-server
set TARGET_FILE=%TARGET_DIR%\scrcpy-server-v%SCRCPY_VERSION%

echo Version: %SCRCPY_VERSION%
echo Download URL: %DOWNLOAD_URL%
echo Target: %TARGET_FILE%
echo.

REM Create target directory (create parent directories if needed)
if not exist "%TARGET_DIR%" (
    echo Creating directory: %TARGET_DIR%
    mkdir "%TARGET_DIR%" 2>nul
    if not exist "%TARGET_DIR%" (
        REM Try creating parent directories first
        cd /d "%~dp0..\TcUi"
        if not exist "third_party" mkdir "third_party"
        if not exist "third_party\scrcpy-server" mkdir "third_party\scrcpy-server"
        cd /d "%~dp0"
    )
)

REM Check if already downloaded
if exist "%TARGET_FILE%" (
    echo scrcpy-server v%SCRCPY_VERSION% already exists.
    echo File: %TARGET_FILE%
    echo.
    set /p REDOWNLOAD="Re-download? (Y/N): "
    if /i not "!REDOWNLOAD!"=="Y" (
        echo Skipping download.
        goto :end
    )
    del "%TARGET_FILE%"
)

echo Downloading scrcpy-server...
echo This may take a few moments depending on your connection.
echo.

REM Download using PowerShell
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%TARGET_FILE%'}"

if %errorlevel% neq 0 (
    echo [ERROR] Download failed!
    echo.
    echo Please download manually from:
    echo %DOWNLOAD_URL%
    echo.
    echo And save to:
    echo %TARGET_FILE%
    pause
    exit /b 1
)

REM Verify download
if not exist "%TARGET_FILE%" (
    echo [ERROR] Downloaded file not found!
    pause
    exit /b 1
)

REM Get file size
for %%A in ("%TARGET_FILE%") do set FILE_SIZE=%%~zA

echo.
echo ========================================
echo Download Completed Successfully!
echo ========================================
echo File: %TARGET_FILE%
echo Size: %FILE_SIZE% bytes
echo.

REM Create version info file
(
echo {
echo   "scrcpy_version": "%SCRCPY_VERSION%",
echo   "download_date": "%DATE% %TIME%",
echo   "file_size": %FILE_SIZE%,
echo   "download_url": "%DOWNLOAD_URL%"
echo }
) > "%TARGET_DIR%\version.json"

echo Version info saved to: %TARGET_DIR%\version.json
echo.

:end
echo ========================================
echo Next Steps:
echo ========================================
echo 1. Build the application using build-windows.bat
echo 2. The scrcpy-server will be automatically included
echo 3. When running, it will be pushed to Android device
echo.

pause
endlocal
