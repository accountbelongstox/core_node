#!/usr/bin/env pwsh
# Selenium Test Application - Start Script
# Description: Launches the selenium test application

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Starting Selenium Test Application" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $AppDir)

Write-Host "[INFO] Project root: $ProjectRoot" -ForegroundColor Yellow
Write-Host "[INFO] App directory: $AppDir" -ForegroundColor Yellow
Write-Host ""

# Check if Python is available
try {
    $PythonVersion = python --version 2>&1
    Write-Host "[OK] Python found: $PythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python not found in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.8+ and add to PATH" -ForegroundColor Red
    exit 1
}

# Check if config exists
$ConfigPath = Join-Path $AppDir "config\launcher_config.json"
if (-not (Test-Path $ConfigPath)) {
    Write-Host "[ERROR] Configuration file not found: $ConfigPath" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Configuration file found" -ForegroundColor Green

# Check if browser is installed (Chrome)
$ChromeInstalled = Test-Path "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not $ChromeInstalled) {
    $ChromeInstalled = Test-Path "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

if ($ChromeInstalled) {
    Write-Host "[OK] Chrome browser found" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Chrome browser not detected" -ForegroundColor Yellow
    Write-Host "          Please ensure your selected browser is installed" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Launching Application" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to project root
Push-Location $ProjectRoot

try {
    # Method 1: Using pymain.py (recommended)
    if (Test-Path (Join-Path $ProjectRoot "pymain.py")) {
        Write-Host "[INFO] Starting via pymain.py..." -ForegroundColor Yellow
        python pymain.py app=selenium_test
    }
    # Method 2: Direct execution
    else {
        Write-Host "[INFO] Starting directly..." -ForegroundColor Yellow
        $MainPy = Join-Path $AppDir "main.py"
        python $MainPy
    }
} catch {
    Write-Host ""
    Write-Host "[ERROR] Application crashed: $_" -ForegroundColor Red
    exit 1
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Application Exited" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
