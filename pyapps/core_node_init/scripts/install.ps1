# Core Node Init - Install Script
# Installs required dependencies for Core Node Init

$ErrorActionPreference = "Stop"

# Get directories
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)

Write-Host "Installing Core Node Init Dependencies..." -ForegroundColor Cyan
Write-Host "Project Root: $PROJECT_ROOT" -ForegroundColor Gray

# Change to project root
Set-Location $PROJECT_ROOT

# Check if Python is installed
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python found: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.10 or higher from https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Check if pip is installed
try {
    $pipVersion = pip --version 2>&1
    Write-Host "Pip found: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: pip is not installed" -ForegroundColor Red
    exit 1
}

# Install dependencies from requirements.txt if it exists
if (Test-Path "$PROJECT_ROOT\requirements.txt") {
    Write-Host "Installing dependencies from requirements.txt..." -ForegroundColor Cyan
    try {
        pip install -r "$PROJECT_ROOT\requirements.txt"
        Write-Host "Dependencies installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Some dependencies may have failed to install: $_" -ForegroundColor Yellow
    }
} else {
    Write-Host "WARNING: requirements.txt not found in project root" -ForegroundColor Yellow
    Write-Host "Installing minimal dependencies..." -ForegroundColor Cyan

    # Install minimal required packages
    $packages = @(
        "playwright",
        "aiohttp"
    )

    foreach ($package in $packages) {
        Write-Host "Installing $package..." -ForegroundColor Gray
        try {
            pip install $package
        } catch {
            Write-Host "WARNING: Failed to install $package: $_" -ForegroundColor Yellow
        }
    }
}

# Install Playwright browsers
Write-Host "Installing Playwright browsers..." -ForegroundColor Cyan
try {
    python -m playwright install chromium
    Write-Host "Playwright browsers installed successfully" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Failed to install Playwright browsers: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Installation completed!" -ForegroundColor Green
Write-Host "You can now run: .\scripts\start.ps1" -ForegroundColor Cyan
