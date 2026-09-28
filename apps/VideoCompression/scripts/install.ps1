# VideoCompression NCore App Install Script
# Complexity: Complex - Dependency management and common script integration
# Hardcoded install script for VideoCompression application
# Entry Point: install.bat (Windows) / install.sh (Linux)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)
$COMMON_INSTALL = Join-Path $PROJECT_ROOT "scripts\unified_manager\ncore_common_install.ps1"

Write-Host "[INFO] Installing dependencies for VideoCompression application" -ForegroundColor Green

try {
    # Call common install script first
    if (Test-Path $COMMON_INSTALL) {
        Write-Host "[INFO] Calling common NCore install script..." -ForegroundColor Cyan
        & $COMMON_INSTALL
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[ERROR] Common install script failed" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "[ERROR] Common install script not found: $COMMON_INSTALL" -ForegroundColor Red
        exit 1
    }

    # VideoCompression-specific installation logic (if any)
    Write-Host "[INFO] VideoCompression-specific installation completed" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Failed to install VideoCompression dependencies: $_" -ForegroundColor Red
    exit 1
}

exit 0

