#!/usr/bin/env pwsh
# Start UI Thread Test Application

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Starting UI Thread Test Application" -ForegroundColor Cyan
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

# Start application
Write-Host ""
Write-Host "Starting application..." -ForegroundColor Yellow
Write-Host ""

try {
    python -m pyapps.ui_thread_test.main
} catch {
    Write-Host ""
    Write-Host "Error: Failed to start application" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Application stopped" -ForegroundColor Yellow
