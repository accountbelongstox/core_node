# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# AI Translator App - Start Script (Windows)
# This script checks for dependencies and starts the application

$ErrorActionPreference = "Stop"

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)
$NODE_MODULES = Join-Path $PROJECT_ROOT "node_modules"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AI Translator App - Start Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if pnpm is installed
function Test-PnpmInstalled {
    try {
        $null = Get-Command pnpm -ErrorAction Stop
        return $true
    }
    catch {
        return $false
    }
}

# Function to check if node_modules exists and is valid
function Test-NodeModulesValid {
    param($Path)

    if (-not (Test-Path $Path)) {
        return $false
    }

    $moduleCount = (Get-ChildItem -Path $Path -Directory -ErrorAction SilentlyContinue | Measure-Object).Count

    if ($moduleCount -lt 10) {
        return $false
    }

    return $true
}

# Step 1: Check project root
Write-Host "[1/4] Checking project root..." -ForegroundColor Yellow
Write-Host "      Project root: $PROJECT_ROOT" -ForegroundColor Gray

if (-not (Test-Path $PROJECT_ROOT)) {
    Write-Host "[ERROR] Project root not found: $PROJECT_ROOT" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path (Join-Path $PROJECT_ROOT "main.js"))) {
    Write-Host "[ERROR] main.js not found in project root" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] Project root verified" -ForegroundColor Green
Write-Host ""

# Step 2: Check node_modules
Write-Host "[2/4] Checking dependencies..." -ForegroundColor Yellow
Write-Host "      node_modules: $NODE_MODULES" -ForegroundColor Gray

if (-not (Test-NodeModulesValid $NODE_MODULES)) {
    Write-Host "[WARN] node_modules not found or incomplete" -ForegroundColor Yellow
    Write-Host ""

    # Check if pnpm is installed
    if (-not (Test-PnpmInstalled)) {
        Write-Host "[ERROR] pnpm is not installed" -ForegroundColor Red
        Write-Host "[INFO] Please install pnpm first:" -ForegroundColor Cyan
        Write-Host "       npm install -g pnpm" -ForegroundColor Gray
        exit 1
    }

    Write-Host "[INFO] Installing dependencies with pnpm..." -ForegroundColor Cyan

    try {
        Set-Location $PROJECT_ROOT

        Write-Host "[CMD] pnpm install" -ForegroundColor Gray
        $installOutput = pnpm install 2>&1

        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] pnpm install failed" -ForegroundColor Red
            Write-Host $installOutput -ForegroundColor Red
            exit 1
        }

        Write-Host "[OK] Dependencies installed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "[ERROR] Failed to install dependencies: $_" -ForegroundColor Red
        exit 1
    }
}
else {
    Write-Host "[OK] Dependencies already installed" -ForegroundColor Green
}

Write-Host ""

# Step 3: Verify configuration
Write-Host "[3/4] Verifying configuration..." -ForegroundColor Yellow

$CONFIG_FILE = Join-Path $APP_DIR "config\index.js"
if (-not (Test-Path $CONFIG_FILE)) {
    Write-Host "[WARN] Configuration file not found: $CONFIG_FILE" -ForegroundColor Yellow
}
else {
    Write-Host "[OK] Configuration file exists" -ForegroundColor Green
}

Write-Host ""

# Step 4: Start application
Write-Host "[4/4] Starting application..." -ForegroundColor Yellow
Write-Host "      App: ai_translator_app" -ForegroundColor Gray
Write-Host "      Command: node main.js app=ai_translator_app" -ForegroundColor Gray
Write-Host ""

try {
    Set-Location $PROJECT_ROOT

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Application Output:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""

    node .\main.js app=ai_translator_app

    $exitCode = $LASTEXITCODE

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Application exited with code: $exitCode" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    exit $exitCode
}
catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "[ERROR] Failed to start application" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host $_ -ForegroundColor Red
    exit 1
}
