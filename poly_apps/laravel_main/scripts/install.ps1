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

# Laravel Main Install Script
# Installs dependencies for laravel_main application

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR

Write-Host "[INFO] Installing dependencies for Laravel Main application" -ForegroundColor Green

try {
    # Change to app directory
    Set-Location $APP_DIR
    
    # Check if composer.json exists
    if (-not (Test-Path "composer.json")) {
        Write-Host "[ERROR] composer.json not found in app directory" -ForegroundColor Red
        exit 1
    }
    
    # Install PHP dependencies using composer
    Write-Host "[INFO] Installing PHP dependencies with composer..." -ForegroundColor Cyan
    composer install --no-dev --optimize-autoloader
    
    # Check if package.json exists for frontend dependencies
    if (Test-Path "package.json") {
        Write-Host "[INFO] Installing frontend dependencies with npm..." -ForegroundColor Cyan
        npm install
        
        Write-Host "[INFO] Building frontend assets..." -ForegroundColor Cyan
        npm run build
    }
    
    # Generate application key if needed
    if (-not (Test-Path ".env")) {
        Write-Host "[INFO] Creating .env file from .env.example..." -ForegroundColor Cyan
        Copy-Item ".env.example" ".env"
        php artisan key:generate
    }
    
    Write-Host "[SUCCESS] Dependencies installed successfully for laravel_main" -ForegroundColor Green
}
catch {
    Write-Host "[ERROR] Failed to install dependencies for laravel_main - $_" -ForegroundColor Red
    exit 1
}
