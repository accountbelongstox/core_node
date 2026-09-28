# VideoCompression NCore App Deploy Script
# Complexity: Complex - Production deployment with environment configuration
# Hardcoded deploy script for VideoCompression application
# Entry Point: deploy.bat (Windows) / deploy.sh (Linux)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)

Write-Host "[INFO] Deploying NCore application: VideoCompression" -ForegroundColor Green

try {
    # Change to project root directory
    Set-Location $PROJECT_ROOT

    # Check if main.js exists
    if (-not (Test-Path "main.js")) {
        Write-Host "[ERROR] main.js not found in project root" -ForegroundColor Red
        exit 1
    }

    # Deploy VideoCompression in production mode
    Write-Host "[INFO] Starting VideoCompression in production mode..." -ForegroundColor Cyan
    $env:NODE_ENV = "production"
    node ./main.js app=VideoCompression
}
catch {
    Write-Host "[ERROR] Failed to deploy VideoCompression: $_" -ForegroundColor Red
    exit 1
}

exit 0

