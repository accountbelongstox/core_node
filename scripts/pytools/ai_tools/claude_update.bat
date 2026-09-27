@echo off

REM Claude Code Upgrade Script
REM This script upgrades Claude Code to the latest version

setlocal enabledelayedexpansion

title Claude Code Upgrade

echo.
echo ============================================================
echo Claude Code - Upgrade to Latest Version
echo ============================================================
echo.
echo This window will upgrade Claude Code to its latest version.
echo The upgrade runs in a separate window to avoid interrupting
echo your main development session.
echo.
echo Tool: Claude Code (Anthropic)
echo Command: npm install -g @anthropic-ai/claude-code
echo.
echo ============================================================
echo.

echo [INFO] Starting Claude Code upgrade...
echo.

REM Upgrade Claude Code
echo [CMD]  npm install -g @anthropic-ai/claude-code
echo.

npm install -g @anthropic-ai/claude-code
set "CLAUDE_EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
if %CLAUDE_EXIT_CODE% EQU 0 (
    echo [SUCCESS] Claude Code upgrade completed successfully!
    echo.
    echo You can now close this window and start using the latest version.
) else (
    echo [WARNING] Claude Code upgrade completed with warnings.
    echo Exit code: %CLAUDE_EXIT_CODE%
    echo.
    echo This is normal if Claude Code is currently running.
    echo Please close Claude Code and try again if the upgrade failed.
)
echo ============================================================
echo.

echo Press any key to close this window...
pause >nul

exit /b %CLAUDE_EXIT_CODE%
