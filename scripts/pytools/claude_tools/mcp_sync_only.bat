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

REM Claude MCP Configuration Sync - Standalone Script
REM This script runs in a separate window to sync MCP configurations

setlocal enabledelayedexpansion

title Claude MCP Configuration Sync

set "SCRIPT_DIR=%~dp0"
set "PYTHON_SCRIPT=%SCRIPT_DIR%sync_mcp_servers.py"

echo.
echo ============================================================
echo Claude MCP Configuration Sync
echo ============================================================
echo.
echo This window is syncing MCP server configurations from the
echo project template to your Claude Code user configuration.
echo.
echo Template: D:\programing\core_node_a\.prompt\mcpWindowsTemplate.json
echo Target:   C:\Users\%USERNAME%\.claude.json
echo.
echo ============================================================
echo.

if not exist "%PYTHON_SCRIPT%" (
    echo [ERROR] Python sync script not found: %PYTHON_SCRIPT%
    echo.
    echo Please ensure the script exists at:
    echo %PYTHON_SCRIPT%
    echo.
    goto :error_end
)

echo [INFO] Starting MCP configuration sync...
echo [CMD]  python -u "%PYTHON_SCRIPT%"
echo.

REM Use -u flag for unbuffered output (real-time display)
python -u "%PYTHON_SCRIPT%"

set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
if %EXIT_CODE% EQU 0 (
    echo [SUCCESS] MCP configuration sync completed successfully!
    echo.
    echo Your Claude Code MCP servers have been updated.
    echo Please restart Claude Code to apply the changes.
) else (
    echo [WARNING] MCP sync completed with exit code: %EXIT_CODE%
    echo.
    echo Check the output above for details.
    echo You can still use Claude Code normally.
)
echo ============================================================
echo.

echo Press any key to close this window...
pause >nul
exit /b 0

:error_end
echo ============================================================
echo [ERROR] MCP sync failed
echo ============================================================
echo.
echo Press any key to close this window...
pause >nul
exit /b 1
