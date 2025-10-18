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

REM Claude Code Upgrade Script
REM This script runs in a separate window to upgrade Claude Code without interrupting the main process

setlocal enabledelayedexpansion

title Claude Code Upgrade

echo.
echo ============================================================
echo Claude Code - Upgrade to Latest Version
echo ============================================================
echo.
echo This window will upgrade Claude Code to the latest version.
echo The upgrade runs in a separate window to avoid interrupting
echo your main Claude session.
echo.
echo ============================================================
echo.

echo [INFO] Starting npm upgrade...
echo [CMD]  npm install -g @anthropic-ai/claude-code
echo.

npm install -g @anthropic-ai/claude-code

set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
if %EXIT_CODE% EQU 0 (
    echo [SUCCESS] Claude Code upgrade completed successfully!
    echo.
    echo You can now close this window and continue using Claude Code.
) else (
    echo [WARNING] Claude Code upgrade completed with warnings.
    echo Exit code: %EXIT_CODE%
    echo.
    echo This is normal if Claude Code is currently running.
    echo You can still use Claude Code normally.
)
echo ============================================================
echo.

echo Press any key to close this window...
pause >nul

exit /b 0
