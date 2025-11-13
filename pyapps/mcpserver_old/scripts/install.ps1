# MCP Server Installation Script
# Install dependencies and setup environment

Write-Host "Installing MCP Server dependencies..." -ForegroundColor Green

# Get script directory and navigate to project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))

# Change to project root
Set-Location $ProjectRoot

# Check if Python is available
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.10+ from https://www.python.org/" -ForegroundColor Yellow
    exit 1
}

# Check Python version
$pythonVersion = python --version 2>&1
Write-Host "Using $pythonVersion" -ForegroundColor Cyan

# Check if pip is available
if (-not (Get-Command pip -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: pip is not installed" -ForegroundColor Red
    exit 1
}

# Install core dependencies from requirements.txt if it exists
if (Test-Path "requirements.txt") {
    Write-Host "Installing dependencies from requirements.txt..." -ForegroundColor Yellow
    pip install -r requirements.txt

    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "WARNING: requirements.txt not found" -ForegroundColor Yellow
}

# Install mcpserver-specific dependencies (if any)
Write-Host ""
Write-Host "Installing mcpserver-specific dependencies..." -ForegroundColor Yellow

# Core packages for MCP server
$packages = @(
    "websockets",      # WebSocket support
    "pydantic",        # Data validation
    "loguru"           # Logging
)

foreach ($package in $packages) {
    Write-Host "Installing $package..." -ForegroundColor Cyan
    pip install $package --quiet
}

Write-Host ""
Write-Host "Installation completed successfully!" -ForegroundColor Green
Write-Host "Run './start.ps1' to start the MCP Server" -ForegroundColor Cyan
