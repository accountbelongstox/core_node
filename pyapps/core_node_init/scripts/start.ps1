# Core Node Init - Start Script
# Starts the Core Node Init MCP Server

$ErrorActionPreference = "Stop"

# Get the script directory (pyapps/core_node_init/scripts)
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
# Get the app directory (pyapps/core_node_init)
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
# Get the project root directory
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)

Write-Host "Starting Core Node Init MCP Server..." -ForegroundColor Cyan
Write-Host "Project Root: $PROJECT_ROOT" -ForegroundColor Gray
Write-Host "App Directory: $APP_DIR" -ForegroundColor Gray

# Change to project root
Set-Location $PROJECT_ROOT

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Start the application
Write-Host "Starting application..." -ForegroundColor Cyan
try {
    python -m pyapps.core_node_init.main
} catch {
    Write-Host "ERROR: Failed to start application: $_" -ForegroundColor Red
    exit 1
}
