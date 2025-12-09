# ============================================
# React Native Project Installation Script
# ============================================
# This script automatically installs all dependencies for the React Native project
# Usage: .\install.ps1

# Declare all variables at the beginning
$ErrorActionPreference = "Stop"
$ScriptDir = $null
$ProjectRoot = $null
$NodeModulesPath = $null
$PackageJsonPath = $null
$LogFile = $null

# Initialize paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$NodeModulesPath = Join-Path -Path $ProjectRoot -ChildPath "node_modules"
$PackageJsonPath = Join-Path -Path $ProjectRoot -ChildPath "package.json"
$LogFile = Join-Path -Path $ProjectRoot -ChildPath "install.log"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "React Native Project Installation" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "[1/6] Checking Node.js installation..." -ForegroundColor Yellow
try {
    $NodeVersion = node --version
    Write-Host "Node.js version: $NodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check if pnpm is installed
Write-Host "[2/6] Checking pnpm installation..." -ForegroundColor Yellow
try {
    $PnpmVersion = pnpm --version
    Write-Host "pnpm version: $PnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: pnpm is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install pnpm: npm install -g pnpm" -ForegroundColor Red
    exit 1
}

# Check if package.json exists
Write-Host "[3/6] Checking package.json..." -ForegroundColor Yellow
if (-Not (Test-Path $PackageJsonPath)) {
    Write-Host "ERROR: package.json not found at: $PackageJsonPath" -ForegroundColor Red
    exit 1
}
Write-Host "package.json found" -ForegroundColor Green

# Clean existing node_modules if requested
Write-Host "[4/6] Checking existing installation..." -ForegroundColor Yellow
if (Test-Path $NodeModulesPath) {
    Write-Host "node_modules directory already exists" -ForegroundColor Yellow
    $CleanInstall = Read-Host "Do you want to perform a clean installation? (y/N)"
    if ($CleanInstall -eq "y" -or $CleanInstall -eq "Y") {
        Write-Host "Removing existing node_modules..." -ForegroundColor Yellow
        Remove-Item -Path $NodeModulesPath -Recurse -Force
        Write-Host "node_modules removed" -ForegroundColor Green
    }
}

# Install dependencies
Write-Host "[5/6] Installing dependencies..." -ForegroundColor Yellow
Write-Host "This may take several minutes..." -ForegroundColor Gray
try {
    Set-Location $ProjectRoot
    pnpm install --loglevel=error 2>&1 | Tee-Object -FilePath $LogFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: pnpm install failed. Check $LogFile for details" -ForegroundColor Red
        exit 1
    }
    Write-Host "Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Install React Native CLI globally if not present
Write-Host "[6/6] Checking React Native CLI..." -ForegroundColor Yellow
try {
    $RnCliVersion = npx react-native --version 2>&1
    Write-Host "React Native CLI is available" -ForegroundColor Green
} catch {
    Write-Host "WARNING: React Native CLI check failed, but local installation should work" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Installation completed successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  - Run '.\scripts\debug.ps1' to start development server" -ForegroundColor White
Write-Host "  - Run '.\scripts\build.ps1' to build the application" -ForegroundColor White
Write-Host ""
