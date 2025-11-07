@echo off
REM Codebase Scanner MCP Server Startup Script
REM Starts the MCP server directly without using start_server.py

echo Starting Codebase Scanner MCP Server...
python "%~dp0main.py"
