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

# flutter_icon_manager NCore App Deploy Script
# Complexity: Complex - Production deployment with environment configuration
# Hardcoded deploy script for flutter_icon_manager application
# Entry Point: deploy.bat (Windows) / deploy.sh (Linux)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)

Write-Host "[INFO] Deploying NCore application: flutter_icon_manager" -ForegroundColor Green

try {
    # Change to project root directory
    Set-Location $PROJECT_ROOT

    # Check if main.js exists
    if (-not (Test-Path "main.js")) {
        Write-Host "[ERROR] main.js not found in project root" -ForegroundColor Red
        exit 1
    }

    # Deploy flutter_icon_manager in production mode
    Write-Host "[INFO] Starting flutter_icon_manager in production mode..." -ForegroundColor Cyan
    $env:NODE_ENV = "production"
    node ./main.js app=flutter_icon_manager
}
catch {
    Write-Host "[ERROR] Failed to deploy flutter_icon_manager: $_" -ForegroundColor Red
    exit 1
}

exit 0

