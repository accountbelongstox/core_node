# GetDocFromUrlByPuppeteer NCore App Deploy Script
# Complexity: Complex - Production deployment with environment configuration
# Hardcoded deploy script for GetDocFromUrlByPuppeteer application
# Entry Point: deploy.bat (Windows) / deploy.sh (Linux)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)

Write-Host "[INFO] Deploying NCore application: GetDocFromUrlByPuppeteer" -ForegroundColor Green

try {
    # Change to project root directory
    Set-Location $PROJECT_ROOT

    # Check if main.js exists
    if (-not (Test-Path "main.js")) {
        Write-Host "[ERROR] main.js not found in project root" -ForegroundColor Red
        exit 1
    }

    # Deploy GetDocFromUrlByPuppeteer in production mode
    Write-Host "[INFO] Starting GetDocFromUrlByPuppeteer in production mode..." -ForegroundColor Cyan
    $env:NODE_ENV = "production"
    node ./main.js app=GetDocFromUrlByPuppeteer
}
catch {
    Write-Host "[ERROR] Failed to deploy GetDocFromUrlByPuppeteer: $_" -ForegroundColor Red
    exit 1
}

exit 0

