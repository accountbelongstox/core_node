#!/usr/bin/env pwsh
# Install UI Thread Test Application Dependencies

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Installing UI Thread Test Dependencies" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Get project root
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)

# Change to project root
Set-Location $projectRoot

# Check if Python is installed
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check Python version
$pythonVersion = python --version 2>&1
Write-Host "Using: $pythonVersion" -ForegroundColor Green

# Check for requirements.txt
$requirementsFile = Join-Path $projectRoot "requirements.txt"
if (!(Test-Path $requirementsFile)) {
    Write-Host ""
    Write-Host "Warning: requirements.txt not found" -ForegroundColor Yellow
    Write-Host "Skipping dependency installation" -ForegroundColor Yellow
    exit 0
}

# Install dependencies
Write-Host ""
Write-Host "Installing dependencies from requirements.txt..." -ForegroundColor Yellow
Write-Host ""

try {
    pip install -r $requirementsFile

    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host " Installation completed successfully!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "Error: Failed to install dependencies" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
