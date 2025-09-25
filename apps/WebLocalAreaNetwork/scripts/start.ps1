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

# WebLocalAreaNetwork NCore App Start Script
# Complexity: Complex - Advanced logic for NCore application startup
# Hardcoded start script for WebLocalAreaNetwork application
# Entry Point: start.bat (Windows) / start.sh (Linux)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)

Write-Host "[INFO] Starting NCore application: WebLocalAreaNetwork" -ForegroundColor Green

try {
    # Change to project root directory
    Set-Location $PROJECT_ROOT
    
    # Check if main.js exists
    if (-not (Test-Path "main.js")) {
        Write-Host "[ERROR] main.js not found in project root" -ForegroundColor Red
        exit 1
    }
    
    # Start WebLocalAreaNetwork using unified entry point
    Write-Host "[INFO] Executing: node ./main.js app=WebLocalAreaNetwork" -ForegroundColor Cyan
    node ./main.js app=WebLocalAreaNetwork
}
catch {
    Write-Host "[ERROR] Failed to start WebLocalAreaNetwork: $_" -ForegroundColor Red
    exit 1
}

exit 0

