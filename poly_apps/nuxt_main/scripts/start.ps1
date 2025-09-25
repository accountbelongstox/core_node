# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# 8. No parameters allowed for install/start/deploy/build scripts - use hardcoded configuration
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Nuxt Main Start Script
# Starts nuxt_main application with sub-app selection
# PARAMETERS: PROHIBITED - No parameters allowed for consistency and reliability
# Use hardcoded configuration or environment detection instead

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$SubApp = ""  # Hardcoded sub-app - no parameters allowed

Write-Host "[INFO] Starting Nuxt Main application" -ForegroundColor Green

try {
    # Change to app directory
    Set-Location $APP_DIR
    
    # Check if package.json exists
    if (-not (Test-Path "package.json")) {
        Write-Host "[ERROR] package.json not found in app directory" -ForegroundColor Red
        exit 1
    }
    
    # Determine which sub-app to start
    if ([string]::IsNullOrEmpty($SubApp)) {
        Write-Host "[INFO] Available sub-apps:" -ForegroundColor Cyan
        Write-Host "  example  - yarn dev:example" -ForegroundColor Gray
        Write-Host "  codemart - yarn dev:codemart" -ForegroundColor Gray
        Write-Host "  dev      - yarn dev" -ForegroundColor Gray
        Write-Host "  admin    - yarn dev:admin" -ForegroundColor Gray
        Write-Host "  dashboard- yarn dev:dashboard" -ForegroundColor Gray
        
        $SubApp = Read-Host "Enter sub-app name (default: dev)"
        if ([string]::IsNullOrEmpty($SubApp)) {
            $SubApp = "dev"
        }
    }
    
    # Start the appropriate sub-app
    switch ($SubApp.ToLower()) {
        "example" {
            Write-Host "[INFO] Starting nuxt_main:example..." -ForegroundColor Cyan
            yarn dev:example
        }
        "codemart" {
            Write-Host "[INFO] Starting nuxt_main:codemart..." -ForegroundColor Cyan
            yarn dev:codemart
        }
        "dev" {
            Write-Host "[INFO] Starting nuxt_main:dev..." -ForegroundColor Cyan
            yarn dev
        }
        "admin" {
            Write-Host "[INFO] Starting nuxt_main:admin..." -ForegroundColor Cyan
            yarn dev:admin
        }
        "dashboard" {
            Write-Host "[INFO] Starting nuxt_main:dashboard..." -ForegroundColor Cyan
            yarn dev:dashboard
        }
        default {
            Write-Host "[ERROR] Unknown sub-app: $SubApp" -ForegroundColor Red
            Write-Host "[INFO] Available sub-apps: example, codemart, dev, admin, dashboard" -ForegroundColor Gray
            exit 1
        }
    }
}
catch {
    Write-Host "[ERROR] Failed to start nuxt_main:$SubApp - $_" -ForegroundColor Red
    exit 1
}
