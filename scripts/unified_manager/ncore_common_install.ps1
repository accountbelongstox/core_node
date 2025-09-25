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

# NCore Common Install Script
# Shared installation logic for all NCore applications

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)

Write-Host "[INFO] Installing shared NCore dependencies" -ForegroundColor Green

try {
    # Change to project root directory
    Set-Location $PROJECT_ROOT
    
    # Check if package.json exists
    if (-not (Test-Path "package.json")) {
        Write-Host "[ERROR] package.json not found in project root" -ForegroundColor Red
        exit 1
    }
    
    # Install shared dependencies using npm
    Write-Host "[INFO] Installing shared NCore dependencies with npm..." -ForegroundColor Cyan
    npm install
    
    Write-Host "[SUCCESS] Shared NCore dependencies installed successfully" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Failed to install shared NCore dependencies: $_" -ForegroundColor Red
    exit 1
}

exit 0
