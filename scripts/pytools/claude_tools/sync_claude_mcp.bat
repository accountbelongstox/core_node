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

REM Claude MCP Servers Configuration Sync Tool - Batch Wrapper
REM This script provides a convenient way to run the Python sync tool

setlocal enabledelayedexpansion

echo.
echo ============================================================
echo Claude MCP Configuration Sync Tool
echo ============================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "PYTHON_SCRIPT=%SCRIPT_DIR%sync_mcp_servers.py"

if not exist "%PYTHON_SCRIPT%" (
    echo [ERROR] Python script not found: %PYTHON_SCRIPT%
    echo.
    pause
    exit /b 1
)

echo [INFO] Running Python sync script...
echo [INFO] Script: %PYTHON_SCRIPT%
echo.

python "%PYTHON_SCRIPT%"

set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
if %EXIT_CODE% EQU 0 (
    echo [SUCCESS] Sync completed successfully
) else (
    echo [ERROR] Sync failed with exit code: %EXIT_CODE%
)
echo ============================================================
echo.

pause
exit /b %EXIT_CODE%
