# ============================================
# HoloFortune AI - Development Start Script
# ============================================
# This script automatically installs dependencies and starts the dev server
# All commands are executed with real-time output

# Disable error action preference to continue on errors
$ErrorActionPreference = "Continue"

# Initialize paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$NodeModulesPath = Join-Path -Path $ProjectRoot -ChildPath "node_modules"
$PackageJsonPath = Join-Path -Path $ProjectRoot -ChildPath "package.json"

# ============================================
# HEADER
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "HoloFortune AI - Development Server" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Project Root: $ProjectRoot" -ForegroundColor Gray
Write-Host ""

# ============================================
# ENVIRONMENT CHECK
# ============================================

Write-Host "[1/4] Checking development environment..." -ForegroundColor Yellow
Write-Host ""

# Check Node.js
Write-Host "[Node.js] Checking Node.js installation..." -ForegroundColor Gray
Write-Host "Command: node --version" -ForegroundColor DarkGray
node --version
Write-Host ""

# Check pnpm
Write-Host "[pnpm] Checking pnpm installation..." -ForegroundColor Gray
Write-Host "Command: pnpm --version" -ForegroundColor DarkGray
pnpm --version
Write-Host ""

# Check package.json
Write-Host "[Project] Checking package.json..." -ForegroundColor Gray
if (Test-Path $PackageJsonPath) {
    Write-Host "package.json found: $PackageJsonPath" -ForegroundColor Green
} else {
    Write-Host "ERROR: package.json not found at: $PackageJsonPath" -ForegroundColor Red
    Write-Host "Please make sure you are in the correct project directory" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    return
}
Write-Host ""

# ============================================
# DEPENDENCY INSTALLATION
# ============================================

Write-Host "[2/4] Installing dependencies..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $NodeModulesPath) {
    Write-Host "[Dependencies] node_modules directory exists" -ForegroundColor Green
    Write-Host "[Dependencies] Running pnpm install to ensure all dependencies are up to date..." -ForegroundColor Gray
} else {
    Write-Host "[Dependencies] node_modules directory not found" -ForegroundColor Yellow
    Write-Host "[Dependencies] Running pnpm install to install all dependencies..." -ForegroundColor Gray
}
Write-Host ""

Write-Host "Command: pnpm install" -ForegroundColor DarkGray
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host ""

Set-Location $ProjectRoot
pnpm install

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host "[Dependencies] Installation completed" -ForegroundColor Green
Write-Host ""

# ============================================
# VERIFY INSTALLATION
# ============================================

Write-Host "[3/4] Verifying installation..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path $NodeModulesPath) {
    Write-Host "[Verification] node_modules directory exists" -ForegroundColor Green
    $NodeModulesSize = (Get-ChildItem -Path $NodeModulesPath -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    $SizeMB = [math]::Round($NodeModulesSize / 1MB, 2)
    Write-Host "[Verification] node_modules size: $SizeMB MB" -ForegroundColor Gray
} else {
    Write-Host "[Verification] WARNING: node_modules directory not found" -ForegroundColor Yellow
    Write-Host "[Verification] Dependencies may not have been installed correctly" -ForegroundColor Yellow
}
Write-Host ""

# ============================================
# START DEVELOPMENT SERVER
# ============================================

Write-Host "[4/4] Starting development server..." -ForegroundColor Yellow
Write-Host ""

Write-Host "[Dev Server] Starting Vite development server..." -ForegroundColor Gray
Write-Host "[Dev Server] The application will open in your default browser" -ForegroundColor Gray
Write-Host "[Dev Server] Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""

Write-Host "Command: pnpm dev" -ForegroundColor DarkGray
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Set-Location $ProjectRoot
pnpm dev

# The script will stay here until the dev server is stopped
# No exit code or return value is used

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Development server stopped" -ForegroundColor Yellow
Write-Host "Thank you for using HoloFortune AI!" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
