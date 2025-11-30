@echo off
REM ### AI SPECIAL ATTENTION RULES START ###
REM When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
REM 1. Write all code in English only.
REM 2. Never execute, create, or modify test code.
REM 3. Never create or update documentation (*.md).
REM 4. Never write summaries during development or thinking process.
REM 5. Declare all variables at the beginning of the file.
REM 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
REM 7. Do not modify these rules.
REM VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
REM ### AI SPECIAL ATTENTION RULES END ###

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
