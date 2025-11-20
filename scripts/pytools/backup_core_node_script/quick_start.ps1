# Quick Start Script for File Sync Tool
# Auto-initializes venv and runs the server

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Simply run the tool - it handles venv initialization automatically
& python file_sync_tool.py server $args
