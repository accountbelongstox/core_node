#!/usr/bin/env pwsh
# Selenium Test Application - Install Script
# Description: Installs required dependencies

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Installing Dependencies" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$AppDir = Split-Path -Parent $ScriptDir
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $AppDir)

Write-Host "[INFO] Project root: $ProjectRoot" -ForegroundColor Yellow
Write-Host ""

# Check Python installation
try {
    $PythonVersion = python --version 2>&1
    Write-Host "[OK] Python found: $PythonVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Python not found in PATH" -ForegroundColor Red
    Write-Host "Please install Python 3.8+ from https://www.python.org/" -ForegroundColor Red
    exit 1
}

# Check pip
try {
    $PipVersion = python -m pip --version 2>&1
    Write-Host "[OK] pip found: $PipVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] pip not found" -ForegroundColor Red
    Write-Host "Installing pip..." -ForegroundColor Yellow
    python -m ensurepip --upgrade
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Installing Python Packages" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Core dependencies for selenium test
$Packages = @(
    "selenium",
    "webdriver-manager"
)

foreach ($Package in $Packages) {
    Write-Host "[INFO] Installing $Package..." -ForegroundColor Yellow
    try {
        python -m pip install $Package --upgrade
        Write-Host "[OK] $Package installed successfully" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Failed to install $Package: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Checking Browser Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check for Chrome
$ChromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
)

$ChromeFound = $false
foreach ($Path in $ChromePaths) {
    if (Test-Path $Path) {
        Write-Host "[OK] Chrome found: $Path" -ForegroundColor Green
        $ChromeFound = $true
        break
    }
}

if (-not $ChromeFound) {
    Write-Host "[WARNING] Chrome not found" -ForegroundColor Yellow
    Write-Host "          Download from: https://www.google.com/chrome/" -ForegroundColor Yellow
}

# Check for Edge
$EdgePaths = @(
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
)

$EdgeFound = $false
foreach ($Path in $EdgePaths) {
    if (Test-Path $Path) {
        Write-Host "[OK] Edge found: $Path" -ForegroundColor Green
        $EdgeFound = $true
        break
    }
}

if (-not $EdgeFound) {
    Write-Host "[INFO] Edge not found (usually pre-installed on Windows)" -ForegroundColor Yellow
}

# Check for Firefox
$FirefoxPaths = @(
    "C:\Program Files\Mozilla Firefox\firefox.exe",
    "C:\Program Files (x86)\Mozilla Firefox\firefox.exe"
)

$FirefoxFound = $false
foreach ($Path in $FirefoxPaths) {
    if (Test-Path $Path) {
        Write-Host "[OK] Firefox found: $Path" -ForegroundColor Green
        $FirefoxFound = $true
        break
    }
}

if (-not $FirefoxFound) {
    Write-Host "[INFO] Firefox not found" -ForegroundColor Yellow
    Write-Host "       Download from: https://www.mozilla.org/firefox/" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Creating Directories" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create screenshot directory
$ScreenshotDir = Join-Path $AppDir "screenshots"
if (-not (Test-Path $ScreenshotDir)) {
    New-Item -ItemType Directory -Path $ScreenshotDir | Out-Null
    Write-Host "[OK] Created screenshots directory" -ForegroundColor Green
} else {
    Write-Host "[INFO] Screenshots directory already exists" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Installation Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review config files in: $AppDir\config" -ForegroundColor White
Write-Host "  2. Run: .\scripts\start.ps1" -ForegroundColor White
Write-Host ""
