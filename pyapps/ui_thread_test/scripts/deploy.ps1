#!/usr/bin/env pwsh
# Deploy UI Thread Test Application

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Deploying UI Thread Test Application" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory and project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Split-Path -Parent $scriptDir
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

# Change to project root
Set-Location $projectRoot

Write-Host "Project Root: $projectRoot" -ForegroundColor Cyan
Write-Host "App Directory: $appDir" -ForegroundColor Cyan
Write-Host ""

# Step 1: Install dependencies
Write-Host "Step 1: Installing dependencies..." -ForegroundColor Yellow
& "$scriptDir\install.ps1"

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Error: Dependency installation failed" -ForegroundColor Red
    exit 1
}

# Step 2: Verify configuration
Write-Host ""
Write-Host "Step 2: Verifying configuration..." -ForegroundColor Yellow

$configFile = Join-Path $appDir "config\launcher_config.json"
if (Test-Path $configFile) {
    Write-Host "Configuration file found: $configFile" -ForegroundColor Green
} else {
    Write-Host "Warning: Configuration file not found, will be created on first run" -ForegroundColor Yellow
}

# Step 3: Create log directory
Write-Host ""
Write-Host "Step 3: Creating directories..." -ForegroundColor Yellow

$logDir = Join-Path $projectRoot "logs"
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    Write-Host "Created log directory: $logDir" -ForegroundColor Green
} else {
    Write-Host "Log directory exists: $logDir" -ForegroundColor Green
}

# Step 4: Test application
Write-Host ""
Write-Host "Step 4: Testing application import..." -ForegroundColor Yellow

try {
    $testResult = python -c "from pyapps.ui_thread_test import UIThreadTestApp; print('OK')" 2>&1

    if ($testResult -match "OK") {
        Write-Host "Application import test: PASSED" -ForegroundColor Green
    } else {
        Write-Host "Application import test: FAILED" -ForegroundColor Red
        Write-Host $testResult -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Application import test: FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Deployment complete
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host " Deployment completed successfully!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "To start the application, run:" -ForegroundColor Cyan
Write-Host "  .\scripts\start.ps1" -ForegroundColor White
Write-Host ""
