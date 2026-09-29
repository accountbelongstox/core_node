# GetDocFromUrlByPuppeteer NCore App Install Script
# Complexity: Complex - Dependency management and common script integration
# Hardcoded install script for GetDocFromUrlByPuppeteer application
# Entry Point: install.bat (Windows) / install.sh (Linux)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)
$COMMON_INSTALL = Join-Path $PROJECT_ROOT "scripts\unified_manager\ncore_common_install.ps1"

Write-Host "[INFO] Installing dependencies for GetDocFromUrlByPuppeteer application" -ForegroundColor Green

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

    # GetDocFromUrlByPuppeteer-specific installation logic (if any)
    Write-Host "[INFO] GetDocFromUrlByPuppeteer-specific installation completed" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Failed to install GetDocFromUrlByPuppeteer dependencies: $_" -ForegroundColor Red
    exit 1
}

exit 0

