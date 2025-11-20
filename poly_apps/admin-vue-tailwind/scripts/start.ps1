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

# Admin Vue Tailwind Start Script
# Starts admin-vue-tailwind application

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR

Write-Host "[INFO] Starting Admin Vue Tailwind application" -ForegroundColor Green

try {
    # Change to app directory
    Set-Location $APP_DIR
    
    # Check if package.json exists
    if (-not (Test-Path "package.json")) {
        Write-Host "[ERROR] package.json not found in app directory" -ForegroundColor Red
        exit 1
    }
    
    # Start the application
    Write-Host "[INFO] Starting admin-vue-tailwind with npm run dev..." -ForegroundColor Cyan
    npm run dev
}
catch {
    Write-Host "[ERROR] Failed to start admin-vue-tailwind - $_" -ForegroundColor Red
    exit 1
}
