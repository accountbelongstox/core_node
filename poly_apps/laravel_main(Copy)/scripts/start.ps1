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

# Laravel Main Enhanced Start Script (PowerShell)
# Comprehensive startup with full capabilities (development-friendly)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$CORE_NODE_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)
$ENV_FILE = Join-Path $APP_DIR ".env"
$ENV_EXAMPLE = Join-Path $APP_DIR ".env.example"
$VENDOR_DIR = Join-Path $APP_DIR "vendor"
$ARTISAN_FILE = Join-Path $APP_DIR "artisan"
$COMPOSER_JSON = Join-Path $APP_DIR "composer.json"

# Color output functions
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Function to check PHP installation and version
function Test-PhpInstallation {
    Write-Info "Checking PHP installation..."
    
    if (-not (Get-Command php -ErrorAction SilentlyContinue)) {
        Write-Error "PHP is not installed or not in PATH"
        Write-Warning "Please install PHP from https://windows.php.net/download/"
        return $false
    }
    
    $phpVersion = php -v
    Write-Success "PHP is installed: $($phpVersion.Split([Environment]::NewLine)[0])"
    return $true
}

# Function to check Composer installation
function Test-ComposerInstallation {
    Write-Info "Checking Composer installation..."
    
    if (-not (Get-Command composer -ErrorAction SilentlyContinue)) {
        Write-Error "Composer is not installed or not in PATH"
        Write-Warning "Please install Composer from https://getcomposer.org/download/"
        return $false
    }
    
    $composerVersion = composer --version
    Write-Success "Composer is installed: $composerVersion"
    return $true
}

# Function to check if vendor directory exists
function Test-VendorDirectory {
    Write-Info "Checking vendor directory..."
    
    if (-not (Test-Path $VENDOR_DIR)) {
        Write-Warning "Vendor directory not found at: $VENDOR_DIR"
        return $false
    }
    
    $autoloadFile = Join-Path $VENDOR_DIR "autoload.php"
    if (-not (Test-Path $autoloadFile)) {
        Write-Warning "Vendor autoload.php not found at: $autoloadFile"
        return $false
    }
    
    Write-Success "Vendor directory exists with autoload.php"
    return $true
}

# Function to install dependencies
function Install-Dependencies {
    Write-Info "Installing Composer dependencies..."
    
    try {
        Set-Location $APP_DIR
        
        Write-Info "Running: composer install --no-dev --optimize-autoloader"
        composer install --no-dev --optimize-autoloader
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Composer dependencies installed successfully"
            return $true
        } else {
            Write-Error "Composer install failed with exit code: $LASTEXITCODE"
            return $false
        }
    }
    catch {
        Write-Error "Failed to install dependencies: $_"
        return $false
    }
}

# Function to ensure .env file exists
function Initialize-EnvFile {
    Write-Info "Checking .env file..."
    
    if (-not (Test-Path $ENV_FILE)) {
        if (-not (Test-Path $ENV_EXAMPLE)) {
            Write-Error ".env.example file not found at: $ENV_EXAMPLE"
            return $false
        }
        
        Copy-Item $ENV_EXAMPLE $ENV_FILE
        Write-Success "Created .env from .env.example"
        
        # Generate application key
        try {
            Set-Location $APP_DIR
            php artisan key:generate
            Write-Success "Generated application encryption key"
        }
        catch {
            Write-Warning "Failed to generate APP_KEY: $_"
        }
    } else {
        Write-Success ".env file already exists"
    }
    
    return $true
}

# Function to setup directories and permissions
function Initialize-Directories {
    Write-Info "Setting up Laravel directories..."
    
    $directories = @(
        "storage\framework\views",
        "storage\framework\cache",
        "storage\framework\sessions",
        "storage\logs",
        "bootstrap\cache"
    )
    
    foreach ($dir in $directories) {
        $fullPath = Join-Path $APP_DIR $dir
        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
            Write-Success "Created directory: $dir"
        }
    }
    
    Write-Success "Directory setup complete"
}

# Function to clear Laravel cache
function Clear-LaravelCache {
    Write-Info "Clearing Laravel cache..."
    
    try {
        Set-Location $APP_DIR
        php artisan cache:clear 2>$null
        php artisan config:clear 2>$null
        php artisan route:clear 2>$null
        php artisan view:clear 2>$null
        Write-Success "Cache cleared"
    }
    catch {
        Write-Warning "Some cache clear operations failed (this is normal if cache is empty)"
    }
}

# Function to check if port is in use
function Test-PortInUse {
    param([int]$Port = 8000)
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return ($null -ne $connections)
}

# Function to stop processes using port
function Stop-PortProcesses {
    param([int]$Port = 8000)
    
    Write-Info "Checking for processes using port $Port..."
    
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($connection in $connections) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Write-Warning "Stopping process: $($process.Name) (PID: $($process.Id))"
                Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Seconds 2
        Write-Success "Port $Port is now available"
    } else {
        Write-Success "Port $Port is available"
    }
}

# Function to start Laravel server
function Start-LaravelServer {
    param(
        [string]$ServerHost = "0.0.0.0",
        [int]$ServerPort = 8000
    )
    
    Write-Info "Starting Laravel development server..."
    Write-Success "Server will be available at: http://${ServerHost}:${ServerPort}"
    Write-Info "Press Ctrl+C to stop the server"
    Write-Host ""
    
    try {
        Set-Location $APP_DIR
        php artisan serve --host=$ServerHost --port=$ServerPort
    }
    catch {
        Write-Error "Failed to start Laravel server: $_"
        return $false
    }
    
    return $true
}

# Function to show menu
function Show-Menu {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Laravel Main Application - Start Menu" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Start Laravel Server (Development)" -ForegroundColor White
    Write-Host "2. Install/Update Dependencies" -ForegroundColor Yellow
    Write-Host "3. Clear Cache" -ForegroundColor Yellow
    Write-Host "4. Exit" -ForegroundColor Red
    Write-Host ""
    Write-Host -NoNewline "Select option (1-4): " -ForegroundColor Cyan
}

# Main execution
Write-Host ""
Write-Info "Laravel Main Application - Enhanced Start Script"
Write-Host ""

# Change to app directory
Set-Location $APP_DIR
Write-Info "Working directory: $APP_DIR"

# Pre-flight checks
Write-Host ""
Write-Info "Running pre-flight checks..."
Write-Host ""

$phpOk = Test-PhpInstallation
$composerOk = Test-ComposerInstallation

if (-not $phpOk) {
    Write-Error "PHP is required to run Laravel. Please install PHP and try again."
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

if (-not $composerOk) {
    Write-Error "Composer is required to manage Laravel dependencies. Please install Composer and try again."
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check artisan file
if (-not (Test-Path $ARTISAN_FILE)) {
    Write-Error "Laravel artisan file not found at: $ARTISAN_FILE"
    Write-Error "This doesn't appear to be a Laravel application directory"
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check composer.json
if (-not (Test-Path $COMPOSER_JSON)) {
    Write-Error "composer.json not found at: $COMPOSER_JSON"
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check vendor directory
$vendorExists = Test-VendorDirectory

if (-not $vendorExists) {
    Write-Host ""
    Write-Warning "Vendor directory not found. Dependencies need to be installed."
    Write-Host ""
    Write-Host -NoNewline "Do you want to install dependencies now? (Y/N): " -ForegroundColor Yellow
    $response = Read-Host
    
    if ($response -eq "Y" -or $response -eq "y") {
        Write-Host ""
        if (-not (Install-Dependencies)) {
            Write-Error "Failed to install dependencies. Cannot continue."
            Write-Host ""
            Write-Host "Press any key to exit..." -ForegroundColor Yellow
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            exit 1
        }
    } else {
        Write-Error "Dependencies are required to run Laravel. Exiting."
        Write-Host ""
        Write-Host "Press any key to exit..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit 1
    }
}

# Ensure .env file
Write-Host ""
if (-not (Initialize-EnvFile)) {
    Write-Error "Failed to setup .env file. Cannot continue."
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Setup directories
Write-Host ""
Initialize-Directories

# Main menu loop
do {
    Show-Menu
    $choice = Read-Host
    
    switch ($choice) {
        "1" {
            Write-Host ""
            Clear-LaravelCache
            Write-Host ""
            Stop-PortProcesses -Port 8000
            Write-Host ""
            Start-LaravelServer -ServerHost "0.0.0.0" -ServerPort 8000
            break
        }
        "2" {
            Write-Host ""
            Install-Dependencies
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor Yellow
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        "3" {
            Write-Host ""
            Clear-LaravelCache
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor Yellow
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        "4" {
            Write-Info "Exiting..."
            exit 0
        }
        default {
            Write-Error "Invalid option. Please select 1-4."
        }
    }
} while ($true)
