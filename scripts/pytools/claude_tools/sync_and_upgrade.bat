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

REM Combined Upgrade and MCP Sync Script for Claude Code
REM This script runs both upgrade and MCP sync in a separate window

setlocal enabledelayedexpansion

title Claude Code - Upgrade and MCP Sync

set "SCRIPT_DIR=%~dp0"

echo.
echo ============================================================
echo Claude Code - Upgrade and MCP Configuration Sync
echo ============================================================
echo.
echo This script will:
echo   1. Upgrade Claude Code to the latest version
echo   2. Sync MCP server configurations from template
echo.
echo ============================================================
echo.

REM Step 1: Upgrade Claude Code
echo.
echo [STEP 1/2] Upgrading Claude Code...
echo ============================================================
echo.
echo [CMD] npm install -g @anthropic-ai/claude-code
echo.

npm install -g @anthropic-ai/claude-code

set "UPGRADE_EXIT_CODE=%ERRORLEVEL%"

echo.
if %UPGRADE_EXIT_CODE% EQU 0 (
    echo [SUCCESS] Claude Code upgrade completed
) else (
    echo [WARNING] Upgrade completed with warnings (Exit code: %UPGRADE_EXIT_CODE%^)
    echo This is normal if Claude Code is currently running
)
echo.

REM Step 2: Sync MCP Configuration (in another separate window to avoid blocking)
echo.
echo [STEP 2/2] Launching MCP Configuration Sync...
echo ============================================================
echo.

set "MCP_SYNC_SCRIPT=%SCRIPT_DIR%mcp_sync_only.bat"

if not exist "%MCP_SYNC_SCRIPT%" (
    echo [WARNING] MCP sync script not found: %MCP_SYNC_SCRIPT%
    echo Skipping MCP sync...
    goto :end_sync
)

echo [INFO] Launching MCP sync in a separate window...
echo.

start "Claude MCP Sync" "%MCP_SYNC_SCRIPT%"

set "SYNC_EXIT_CODE=%ERRORLEVEL%"

echo.
if %SYNC_EXIT_CODE% EQU 0 (
    echo [SUCCESS] MCP sync window launched successfully
) else (
    echo [WARNING] Failed to launch MCP sync window (Exit code: %SYNC_EXIT_CODE%^)
)
echo.

:end_sync

REM Final Summary
echo.
echo ============================================================
echo Summary
echo ============================================================
echo.
echo Upgrade: %UPGRADE_EXIT_CODE% (0 = success^)
echo MCP Sync: %SYNC_EXIT_CODE% (0 = success^)
echo.
echo ============================================================
echo All tasks completed!
echo ============================================================
echo.
echo You can now close this window and continue using Claude Code.
echo If Claude Code was running, please restart it to apply changes.
echo.

echo Press any key to close this window...
pause >nul

exit /b 0
