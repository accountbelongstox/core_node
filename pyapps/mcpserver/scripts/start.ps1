# MCP Server Start Script
# Start the mcpserver application

Write-Host "Starting MCP Server..." -ForegroundColor Green

# Get script directory and navigate to project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $ScriptDir))

# Change to project root
Set-Location $ProjectRoot

# Check if Python is available
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check Python version
$pythonVersion = python --version 2>&1
Write-Host "Using $pythonVersion" -ForegroundColor Cyan

# Start mcpserver
Write-Host "Launching mcpserver..." -ForegroundColor Yellow
python pymain.py app=mcpserver

# If script exits, show message
Write-Host "MCP Server stopped." -ForegroundColor Yellow
