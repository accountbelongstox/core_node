# WebLocalAreaNetwork NCore App Deploy Script
# Complexity: Complex - Production deployment with environment configuration
# Hardcoded deploy script for WebLocalAreaNetwork application
# Entry Point: deploy.bat (Windows) / deploy.sh (Linux)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)

Write-Host "[INFO] Deploying NCore application: WebLocalAreaNetwork" -ForegroundColor Green

try {
    # Change to project root directory
    Set-Location $PROJECT_ROOT

    # Check if main.js exists
    if (-not (Test-Path "main.js")) {
        Write-Host "[ERROR] main.js not found in project root" -ForegroundColor Red
        exit 1
    }

    # Deploy WebLocalAreaNetwork in production mode
    Write-Host "[INFO] Starting WebLocalAreaNetwork in production mode..." -ForegroundColor Cyan
    $env:NODE_ENV = "production"
    node ./main.js app=WebLocalAreaNetwork
}
catch {
    Write-Host "[ERROR] Failed to deploy WebLocalAreaNetwork: $_" -ForegroundColor Red
    exit 1
}

exit 0

