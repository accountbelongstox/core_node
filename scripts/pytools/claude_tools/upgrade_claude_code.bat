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

REM Universal AI Tools Upgrade Script
REM This script runs in a separate window to automatically upgrade all available AI tools
REM Supports: Claude Code, Factory AI Droid, and other AI development tools
REM Default behavior: Upgrades all available tools without user interaction

setlocal enabledelayedexpansion

REM Script parameters
set "UPGRADE_ALL=%1"
set "TOTAL_TOOLS=0"
set "SUCCESSFUL_UPGRADES=0"
set "FAILED_UPGRADES=0"

title AI Tools Upgrade

echo.
echo ============================================================
echo AI Development Tools - Universal Upgrade
echo ============================================================
echo.
echo This window will upgrade AI development tools to their latest versions.
echo The upgrade runs in a separate window to avoid interrupting
echo your main development session.
echo.
echo Supported tools:
echo   - Claude Code (Anthropic)
echo   - Factory AI Droid
echo   - Other AI tools (if available)
echo.
echo [INFO] Starting automatic upgrade of all available tools...
echo.
echo ============================================================
echo.

REM Check if upgrade all was requested
if "%UPGRADE_ALL%"=="all" (
    echo [INFO] Upgrade all mode enabled - upgrading all available tools
    echo.
    goto :upgrade_all
) else (
    echo [INFO] Default mode - upgrading all available tools
    echo.
    goto :upgrade_all
)

REM Interactive menu removed - script now defaults to upgrade all

:upgrade_all
echo [INFO] Starting upgrade of all available AI tools...
echo.

REM Upgrade Claude Code
call :upgrade_claude_silent
if !ERRORLEVEL! EQU 0 (
    set /a SUCCESSFUL_UPGRADES+=1
) else (
    set /a FAILED_UPGRADES+=1
)
set /a TOTAL_TOOLS+=1

REM Upgrade Factory AI Droid
call :upgrade_droid_silent
if !ERRORLEVEL! EQU 0 (
    set /a SUCCESSFUL_UPGRADES+=1
) else (
    set /a FAILED_UPGRADES+=1
)
set /a TOTAL_TOOLS+=1

goto :show_summary

REM Individual upgrade functions removed - script now only supports upgrade all

:upgrade_claude_silent
echo [INFO] Upgrading Claude Code...
npm install -g @anthropic-ai/claude-code >nul 2>&1
exit /b %ERRORLEVEL%

:upgrade_claude_verbose
echo [INFO] Starting Claude Code upgrade...
echo [CMD]  npm install -g @anthropic-ai/claude-code
echo.

npm install -g @anthropic-ai/claude-code
set "CLAUDE_EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
if %CLAUDE_EXIT_CODE% EQU 0 (
    echo [SUCCESS] Claude Code upgrade completed successfully!
) else (
    echo [WARNING] Claude Code upgrade completed with warnings.
    echo Exit code: %CLAUDE_EXIT_CODE%
    echo This is normal if Claude Code is currently running.
)
echo ============================================================
echo.
exit /b %CLAUDE_EXIT_CODE%

:upgrade_droid_silent
echo [INFO] Upgrading Factory AI Droid...
REM Check if droid command is available
droid --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [SKIP] Factory AI Droid not installed - skipping upgrade
    exit /b 0
)

REM Try to upgrade droid (if upgrade command exists)
droid upgrade >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    REM If no upgrade command, try reinstalling
    curl -fsSL https://app.factory.ai/cli | sh >nul 2>&1
)
exit /b %ERRORLEVEL%

:upgrade_droid_verbose
echo [INFO] Starting Factory AI Droid upgrade...
echo [CMD]  Checking Droid installation...

REM Check if droid command is available
droid --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [SKIP] Factory AI Droid not installed - skipping upgrade
    echo.
    echo To install Factory AI Droid, run:
    echo   curl -fsSL https://app.factory.ai/cli ^| sh
    echo.
    exit /b 0
)

echo [CMD]  droid upgrade
echo.

REM Try to upgrade droid (if upgrade command exists)
droid upgrade
set "DROID_EXIT_CODE=%ERRORLEVEL%"

if %DROID_EXIT_CODE% NEQ 0 (
    echo [INFO] No upgrade command available, trying reinstall...
    echo [CMD]  curl -fsSL https://app.factory.ai/cli ^| sh
    echo.
    curl -fsSL https://app.factory.ai/cli | sh
    set "DROID_EXIT_CODE=%ERRORLEVEL%"
)

echo.
echo ============================================================
if %DROID_EXIT_CODE% EQU 0 (
    echo [SUCCESS] Factory AI Droid upgrade completed successfully!
) else (
    echo [WARNING] Factory AI Droid upgrade completed with warnings.
    echo Exit code: %DROID_EXIT_CODE%
)
echo ============================================================
echo.
exit /b %DROID_EXIT_CODE%

:show_summary
echo.
echo ============================================================
echo Upgrade Summary
echo ============================================================
if "%UPGRADE_ALL%"=="all" (
    echo Total tools processed: %TOTAL_TOOLS%
    echo Successful upgrades: %SUCCESSFUL_UPGRADES%
    echo Failed upgrades: %FAILED_UPGRADES%
    echo.
    if %SUCCESSFUL_UPGRADES% GTR 0 (
        echo [SUCCESS] At least one tool was upgraded successfully!
    )
    if %FAILED_UPGRADES% GTR 0 (
        echo [INFO] Some tools may have failed to upgrade.
        echo This is normal if tools are currently running.
    )
) else (
    echo [INFO] Upgrade process completed.
    echo You can now close this window and continue using your AI tools.
)
echo ============================================================
echo.

:exit_script
echo Press any key to close this window...
pause >nul

exit /b 0
