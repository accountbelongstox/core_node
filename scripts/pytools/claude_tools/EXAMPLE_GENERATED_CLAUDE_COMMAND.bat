@echo off
REM ### EXAMPLE GENERATED CLAUDE COMMAND ###
REM This is an example of what the generated claude1.bat file will look like
REM when created through SpecialSoftwareEnvManager.ps1

REM Claude AI Global File #1
REM Generated on 2025-10-18 XX:XX:XX

REM Set environment variables
echo Setting ANTHROPIC_BASE_URL=https://www.88code.org/api
set ANTHROPIC_BASE_URL=https://www.88code.org/api
echo Setting ANTHROPIC_AUTH_TOKEN=88_YOUR_TOKEN_HERE
set ANTHROPIC_AUTH_TOKEN=88_YOUR_TOKEN_HERE

REM Prompt for upgrade and sync MCP configuration
echo.
echo ============================================================
echo Claude Code - Pre-Launch Tasks
echo ============================================================
echo.
echo Available tasks:
echo   [1] Upgrade Claude Code to latest version (runs in separate window)
echo   [2] Sync MCP server configurations (runs now)
echo.

REM Ask user if they want to upgrade
set /p UPGRADE_CHOICE="Do you want to upgrade Claude Code? (y/N): "
if /i "%UPGRADE_CHOICE%"=="y" (
    echo.
    echo [INFO] Launching upgrade in separate window...
    start "Claude Code Upgrade" "D:\programing\core_node\scripts\pytools\claude_tools\upgrade_claude_code.bat"
    echo [SUCCESS] Upgrade window opened
) else (
    echo [INFO] Skipping upgrade
)

echo.
echo ============================================================
echo Syncing MCP Server Configurations...
echo ============================================================
echo.

REM Run MCP sync in main thread with unbuffered output for real-time display
python -u "D:\programing\core_node\scripts\pytools\claude_tools\sync_mcp_servers.py"

set MCP_EXIT_CODE=%ERRORLEVEL%

if %MCP_EXIT_CODE% EQU 0 (
    echo [SUCCESS] MCP configuration sync completed
) else (
    echo [WARNING] MCP sync exited with code: %MCP_EXIT_CODE%
)

echo.
echo ============================================================
echo Press Enter to start Claude Code...
echo ============================================================
set /p CONTINUE="Press Enter to continue..."

REM Execute PowerShell command with environment variables
echo Executing: claude
echo.
echo PowerShell Command: powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:ANTHROPIC_BASE_URL='https://www.88code.org/api'; $env:ANTHROPIC_AUTH_TOKEN='88_YOUR_TOKEN_HERE'; claude"
echo.
echo Press any key to continue...
pause >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$env:ANTHROPIC_BASE_URL='https://www.88code.org/api'; $env:ANTHROPIC_AUTH_TOKEN='88_YOUR_TOKEN_HERE'; claude"

echo.
pause
