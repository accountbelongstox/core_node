# Quick Start Script for File Sync Tool
# Automatically initializes and runs the server

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvDir = Join-Path $ScriptDir ".venv"
$InitScript = Join-Path $ScriptDir "init_env.py"
$MainScript = Join-Path $ScriptDir "file_sync_tool.py"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "File Sync Tool - Quick Start" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

if (-not (Test-Path $VenvDir)) {
    Write-Host "`nVirtual environment not found. Initializing..." -ForegroundColor Yellow
    Write-Host "This is a one-time setup. Please wait...`n" -ForegroundColor Yellow

    try {
        & python $InitScript
        if ($LASTEXITCODE -ne 0) {
            throw "Initialization failed"
        }
    }
    catch {
        Write-Host "`nInitialization failed. Please check the error above." -ForegroundColor Red
        Write-Host "You may need to run manually: python init_env.py" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "`nInitialization completed!" -ForegroundColor Green
}
else {
    Write-Host "`nVirtual environment found." -ForegroundColor Green
}

Write-Host "`nStarting File Sync Tool Server...`n" -ForegroundColor Cyan

$VenvPython = if ($IsWindows -or $env:OS -eq "Windows_NT") {
    Join-Path $VenvDir "Scripts\python.exe"
} else {
    Join-Path $VenvDir "bin/python"
}

if (-not (Test-Path $VenvPython)) {
    Write-Host "Python executable not found in virtual environment." -ForegroundColor Red
    Write-Host "Please run: python init_env.py" -ForegroundColor Yellow
    exit 1
}

try {
    & $VenvPython $MainScript server $args
}
catch {
    Write-Host "`nServer stopped or error occurred." -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
