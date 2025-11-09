@echo off
REM Quick Start Script for Selenium Test
REM Automatically detects test mode and runs appropriate script

echo ====================================================================
echo  Selenium Test - Quick Start
echo ====================================================================
echo.

REM Check if multi_browser_config.json exists
if exist "%~dp0config\multi_browser_config.json" (
    echo [INFO] Found multi_browser_config.json
    echo [INFO] Running multi-browser concurrent test...
    echo.
    python "%~dp0test_multi_browser.py"
) else (
    echo [INFO] multi_browser_config.json not found
    echo [INFO] Running single browser test via launcher...
    echo.
    cd /d "%~dp0..\.."
    python pymain.py app=selenium_test
)

echo.
echo ====================================================================
echo  Test Completed
echo ====================================================================
pause
