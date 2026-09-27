# VideoCompression NCore App Start Script
# Complexity: Complex - Advanced logic for NCore application startup
# Hardcoded start script for VideoCompression application
# Entry Point: start.bat (Windows) / start.sh (Linux)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)

Write-Host "[INFO] Starting NCore application: VideoCompression" -ForegroundColor Green

try {
    # Change to project root directory
    Set-Location $PROJECT_ROOT
    
    # Check if main.js exists
    if (-not (Test-Path "main.js")) {
        Write-Host "[ERROR] main.js not found in project root" -ForegroundColor Red
        exit 1
    }
    
    # Start VideoCompression using unified entry point
    Write-Host "[INFO] Executing: node ./main.js app=VideoCompression" -ForegroundColor Cyan
    node ./main.js app=VideoCompression
}
catch {
    Write-Host "[ERROR] Failed to start VideoCompression: $_" -ForegroundColor Red
    exit 1
}

exit 0

