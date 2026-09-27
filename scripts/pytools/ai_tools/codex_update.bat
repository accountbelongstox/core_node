@echo off

REM Codex CLI Upgrade Script
REM This script upgrades Codex CLI to the latest version

setlocal enabledelayedexpansion

title Codex CLI Upgrade

echo.
echo ============================================================
echo Codex CLI - Upgrade to Latest Version
echo ============================================================
echo.
echo This window will upgrade Codex CLI to its latest version.
echo The upgrade runs in a separate window to avoid interrupting
echo your main development session.
echo.
echo Tool: Codex CLI (OpenAI)
echo Command: npm install -g @openai/codex-cli
echo.
echo ============================================================
echo.

echo [INFO] Starting Codex CLI upgrade...
echo.

REM Check if codex command is available
echo [INFO] Checking Codex installation...
codex --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Codex CLI is not installed.
    echo.
    echo To install Codex CLI, run:
    echo   npm install -g @openai/codex-cli
    echo.
    goto :exit_script
)

echo [SUCCESS] Codex CLI is installed
echo.

REM Upgrade Codex CLI
echo [CMD]  npm install -g @openai/codex-cli
echo.

npm install -g @openai/codex-cli
set "CODEX_EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
if %CODEX_EXIT_CODE% EQU 0 (
    echo [SUCCESS] Codex CLI upgrade completed successfully!
    echo.
    echo You can now close this window and start using the latest version.
) else (
    echo [WARNING] Codex CLI upgrade completed with warnings.
    echo Exit code: %CODEX_EXIT_CODE%
    echo.
    echo This is normal if Codex CLI is currently running.
    echo Please close Codex CLI and try again if the upgrade failed.
)
echo ============================================================
echo.

:exit_script
echo Press any key to close this window...
pause >nul

exit /b %CODEX_EXIT_CODE%
