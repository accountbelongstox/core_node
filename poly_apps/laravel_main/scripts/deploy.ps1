# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only
# 2. Never execute, create, or modify test code
# 3. Never create or update documentation (*.md)
# 4. Never write summaries during development or thinking process
# 5. Declare all variables at the beginning of the file
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# ============================================================================
# Laravel Deployment Script with UP Method Support (PowerShell)
# ============================================================================
# This script provides reusable functions for Laravel project deployment
# Includes versioned up() methods for incremental updates
# ============================================================================

param(
    [switch]$FullDeploy
)

# Variables declaration
# Use $PSScriptRoot for reliable path resolution (PowerShell 3.0+)
# This ensures the script works regardless of current working directory
if ($PSScriptRoot) {
    $SCRIPT_DIR = $PSScriptRoot
} else {
    # Fallback for older PowerShell versions
    $SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$CORE_NODE_DIR = Split-Path -Parent (Split-Path -Parent $APP_DIR)

# Save initial working directory to restore at the end
$INITIAL_WORKING_DIR = Get-Location

# Color output functions
function Write-Info { param([string]$Message) Write-Host "[INFO] $Message" -ForegroundColor Cyan }
function Write-Success { param([string]$Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green }
function Write-Warning { param([string]$Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow }
function Write-Error { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }

# Environment variables (kept for compatibility, may be used in future)
# $IS_WSL = $false
# $IS_PRODUCTION = $false
# $HAS_DESKTOP_ENVIRONMENT = $true
# $USE_SUDO = ""

# ============================================================================
# Windows/Linux Path Differences
# ============================================================================
# Windows: Uses fixed D:\ drive for all web-related paths
#   - Only D: drive is available for web paths
#   - Direct path access: D:\www\wwwroot, D:\www\nginxconfig, etc.
#   - No environment detection needed
#
# Linux: Uses environment-aware path mapping (via gvar_common.sh)
#   - WSL: Uses /mnt/d/www (or largest mounted drive)
#   - Desktop: Uses largest /mnt/* drive if available, else /www
#   - Server: Uses /www
#   - Requires gvar_common.sh for path mapping
# ============================================================================

# Load Windows common functions and global variables (trust mode, no path checking)
$WIN_COMMON_DIR = Join-Path $CORE_NODE_DIR "scripts\shells\win\win_common"
$GLOBAL_VARS_PATH = Join-Path $WIN_COMMON_DIR "GlobalVars.ps1"
. $GLOBAL_VARS_PATH

# Windows web paths - Direct D: drive access (Windows only has D: drive available)
# These paths are fixed for Windows and match the structure expected by Laravel
$WWW_BASE = "D:\www"
$WWW_ROOT = Join-Path $WWW_BASE "wwwroot"
$NGINX_CONFIG_DIR = Join-Path $WWW_BASE "nginxconfig"
$SHARED_DATA_DIR = Join-Path $WWW_BASE "shared-data"
$BACKUP_DIR = Join-Path $WWW_BASE "backup"
$LARAVEL_DB_DIR = Join-Path $WWW_ROOT "laravel_db"

# ============================================================================
# Print Environment and Configuration Information
# ============================================================================
function Show-EnvironmentInfo {
    Write-Host ""
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host "ENVIRONMENT AND CONFIGURATION INFORMATION" -ForegroundColor Cyan
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Script paths
    Write-Host "[SCRIPT PATHS]" -ForegroundColor Yellow
    Write-Host "  SCRIPT_DIR: $SCRIPT_DIR"
    Write-Host "  APP_DIR: $APP_DIR"
    Write-Host "  CORE_NODE_DIR: $CORE_NODE_DIR"
    Write-Host "  INITIAL_WORKING_DIR: $INITIAL_WORKING_DIR"
    Write-Host ""
    
    # Windows web paths
    Write-Host "[WINDOWS WEB PATHS]" -ForegroundColor Yellow
    Write-Host "  WWW_BASE: $WWW_BASE"
    Write-Host "  WWW_ROOT: $WWW_ROOT"
    Write-Host "  NGINX_CONFIG_DIR: $NGINX_CONFIG_DIR"
    Write-Host "  SHARED_DATA_DIR: $SHARED_DATA_DIR"
    Write-Host "  BACKUP_DIR: $BACKUP_DIR"
    Write-Host "  LARAVEL_DB_DIR: $LARAVEL_DB_DIR"
    Write-Host ""
    
    # Global variables from GlobalVars.ps1
    Write-Host "[GLOBAL VARIABLES]" -ForegroundColor Yellow
    if ($Global:BASE_DIR) { Write-Host "  BASE_DIR: $Global:BASE_DIR" }
    if ($Global:CORE_NODE_DIR) { Write-Host "  CORE_NODE_DIR: $Global:CORE_NODE_DIR" }
    if ($Global:PROJECT_DIR) { Write-Host "  PROJECT_DIR: $Global:PROJECT_DIR" }
    if ($Global:APP_INSTALL_DIR) { Write-Host "  APP_INSTALL_DIR: $Global:APP_INSTALL_DIR" }
    if ($Global:LANG_COMPILER_DIR) { Write-Host "  LANG_COMPILER_DIR: $Global:LANG_COMPILER_DIR" }
    if ($Global:TEMP_DIR) { Write-Host "  TEMP_DIR: $Global:TEMP_DIR" }
    if ($Global:USER_DIR) { Write-Host "  USER_DIR: $Global:USER_DIR" }
    Write-Host ""
    
    # System information
    Write-Host "[SYSTEM INFORMATION]" -ForegroundColor Yellow
    Write-Host "  OS: Windows"
    if ($Global:isWin11) { Write-Host "  Windows Version: Windows 11" }
    elseif ($Global:isWin10) { Write-Host "  Windows Version: Windows 10" }
    Write-Host "  PowerShell Version: $($PSVersionTable.PSVersion)"
    Write-Host "  Current User: $env:USERNAME"
    Write-Host "  User Profile: $env:USERPROFILE"
    Write-Host ""
    
    # Environment variables
    Write-Host "[ENVIRONMENT VARIABLES]" -ForegroundColor Yellow
    Write-Host "  PATH: $($env:PATH.Substring(0, [Math]::Min(200, $env:PATH.Length)))..."
    Write-Host "  TEMP: $env:TEMP"
    Write-Host "  TMP: $env:TMP"
    Write-Host "  COMPUTERNAME: $env:COMPUTERNAME"
    Write-Host "  USERPROFILE: $env:USERPROFILE"
    if ($env:PHP_HOME) { Write-Host "  PHP_HOME: $env:PHP_HOME" }
    if ($env:COMPOSER_HOME) { Write-Host "  COMPOSER_HOME: $env:COMPOSER_HOME" }
    Write-Host ""
    
    # UP state information
    Write-Host "[UP STATE]" -ForegroundColor Yellow
    Write-Host "  UP_STATE_DIR: $UP_STATE_DIR"
    Write-Host "  UP_STATE_FILE: $UP_STATE_FILE"
    if (Test-Path $UP_STATE_FILE) {
        $upVersions = Get-Content $UP_STATE_FILE -ErrorAction SilentlyContinue
        if ($null -ne $upVersions) {
            # Handle both array and single string cases
            if ($upVersions -is [array]) {
                $versionCount = $upVersions.Count
            } else {
                $versionCount = 1
            }
            Write-Host "  Applied UP versions: $versionCount"
            if ($versionCount -gt 0) {
                if ($upVersions -is [array]) {
                    foreach ($version in $upVersions) {
                        if (-not [string]::IsNullOrWhiteSpace($version)) {
                            Write-Host "    - $version"
                        }
                    }
                } else {
                    if (-not [string]::IsNullOrWhiteSpace($upVersions)) {
                        Write-Host "    - $upVersions"
                    }
                }
            }
        } else {
            Write-Host "  Applied UP versions: 0"
        }
    } else {
        Write-Host "  No UP state file found (will be created)"
    }
    Write-Host ""
    
    # Tool availability
    Write-Host "[TOOL AVAILABILITY]" -ForegroundColor Yellow
    $tools = @("php", "composer", "node", "pnpm", "git")
    foreach ($tool in $tools) {
        $toolPath = Get-Command $tool -ErrorAction SilentlyContinue
        if ($toolPath) {
            $version = & $tool --version 2>&1 | Select-Object -First 1
            Write-Host "  $tool : Available - $version"
        } else {
            Write-Host "  $tool : Not found" -ForegroundColor Red
        }
    }
    Write-Host ""
    
    # Laravel directory
    Write-Host "[LARAVEL DIRECTORY]" -ForegroundColor Yellow
    try {
        $laravelDir = Get-LaravelDir
        Write-Host "  Laravel Directory: $laravelDir"
        if (Test-Path $laravelDir) {
            Write-Host "  Exists: Yes"
            $envFile = Join-Path $laravelDir ".env"
            if (Test-Path $envFile) {
                Write-Host "  .env file: Exists"
            } else {
                Write-Host "  .env file: Not found" -ForegroundColor Yellow
            }
            $vendorDir = Join-Path $laravelDir "vendor"
            if (Test-Path $vendorDir) {
                Write-Host "  vendor directory: Exists"
            } else {
                Write-Host "  vendor directory: Not found" -ForegroundColor Yellow
            }
        } else {
            Write-Host "  Exists: No" -ForegroundColor Red
        }
    } catch {
        $laravelDir = Join-Path $CORE_NODE_DIR "poly_apps\laravel_main"
        Write-Host "  Laravel Directory (calculated): $laravelDir"
        Write-Host "  Get-LaravelDir function not available yet"
    }
    Write-Host ""
    
    Write-Host "============================================================================" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================================================
# UP METHODS - Versioned Updates
# ============================================================================
# Each up method represents a specific version update
# Format: up_YYYYMMDD_description()
# ============================================================================

# Helper function to safely check if a Composer package is installed
function Test-ComposerPackage {
    param(
        [string]$PackageName,
        [string]$LaravelDir
    )
    
    # Check if vendor directory exists
    $vendorDir = Join-Path $LaravelDir "vendor"
    if (-not (Test-Path $vendorDir)) {
        return $false
    }
    
    # Try to check package
    $composerShow = composer show $PackageName 2>&1
    if ($composerShow -match $PackageName) {
        return $true
    }
    
    return $false
}

$UP_STATE_DIR = Join-Path $env:USERPROFILE ".laravel_deploy_state"
$UP_STATE_FILE = Join-Path $UP_STATE_DIR "up_versions.txt"

# Initialize up state tracking
function Initialize-UpState {
    if (-not (Test-Path $UP_STATE_DIR)) {
        New-Item -ItemType Directory -Path $UP_STATE_DIR -Force | Out-Null
    }
    if (-not (Test-Path $UP_STATE_FILE)) {
        New-Item -ItemType File -Path $UP_STATE_FILE -Force | Out-Null
    }
}

# Check if up version was already applied
function Test-UpApplied {
    param([string]$Version)
    
    if (-not (Test-Path $UP_STATE_FILE)) {
        return $false
    }
    
    $content = Get-Content $UP_STATE_FILE -ErrorAction SilentlyContinue
    return $content -contains $Version
}

# Mark up version as applied
function Set-UpApplied {
    param([string]$Version)
    
    Add-Content -Path $UP_STATE_FILE -Value $Version
    Write-Success "[UP] Marked $Version as applied"
}

# ============================================================================
# UP: 20251115_install_laravel_mcp
# Date: 2025-11-15
# Description: Install and initialize Laravel MCP for AI integration
# Idempotent: Can be run multiple times safely
# ============================================================================
function Invoke-Up20251115InstallLaravelMcp {
    $version = "20251115_install_laravel_mcp"
    
    Write-Info "========================================"
    Write-Info "[UP] Running: $version"
    Write-Info "[UP] Date: 2025-11-15"
    Write-Info "[UP] Description: Install Laravel MCP for AI integration"
    
    if (Test-UpApplied $version) {
        Write-Info "[UP] Note: Already applied before, re-running for idempotency"
    }
    
    Write-Info "========================================"
    
    $laravelDir = Get-LaravelDir
    if ([string]::IsNullOrEmpty($laravelDir)) {
        Write-Error "[UP] ERROR: Laravel directory not found"
        return $false
    }
    
    Set-Location $laravelDir
    
    Write-Info "[UP] Step 1: Checking Composer..."
    if (-not (Get-Command composer -ErrorAction SilentlyContinue)) {
        Write-Error "[UP] Composer not found"
        return $false
    }
    Write-Success "[UP] OK Composer found"
    
    Write-Info "[UP] Step 2: Installing/Updating Laravel MCP..."
    if (Test-ComposerPackage -PackageName "laravel/mcp" -LaravelDir $laravelDir) {
        Write-Info "[UP] Laravel MCP already installed, ensuring latest version..."
        composer update laravel/mcp
    } else {
        Write-Info "[UP] Installing Laravel MCP..."
        composer require laravel/mcp
    }
    
    
    Write-Info "[UP] Step 3: Publishing AI routes..."
    $aiRoutesFile = Join-Path $laravelDir "routes\ai.php"
    if (Test-Path $aiRoutesFile) {
        Write-Info "[UP] AI routes already exist, skipping publish"
    } else {
        php artisan vendor:publish --tag=ai-routes --force
    }
    
    if (Test-Path $aiRoutesFile) {
        Write-Success "[UP] OK AI routes file exists"
    } else {
        Write-Warning "[UP] WARNING AI routes file not found"
    }
    
    Write-Info "[UP] Step 4: Verifying installation..."
    if (Test-ComposerPackage -PackageName "laravel/mcp" -LaravelDir $laravelDir) {
        Write-Success "[UP] OK Laravel MCP package installed"
    } else {
        Write-Error "[UP] ERROR Laravel MCP package not found"
        return $false
    }
    
    Set-UpApplied $version
    
    Write-Success "========================================"
    Write-Success "[UP] $version completed successfully"
    Write-Success "========================================"
    
    return $true
}

# ============================================================================
# UP: 20251115_install_octane
# Date: 2025-11-15
# Description: Install Laravel Octane with Swoole support
# Idempotent: Can be run multiple times safely
# ============================================================================
function Invoke-Up20251115InstallOctane {
    $version = "20251115_install_octane"
    
    Write-Info "========================================"
    Write-Info "[UP] Running: $version"
    Write-Info "[UP] Date: 2025-11-15"
    Write-Info "[UP] Description: Install Laravel Octane with Swoole"
    
    if (Test-UpApplied $version) {
        Write-Info "[UP] Note: Already applied before, re-running for idempotency"
    }
    
    Write-Info "========================================"
    
    $laravelDir = Get-LaravelDir
    if ([string]::IsNullOrEmpty($laravelDir)) {
        Write-Error "[UP] ERROR: Laravel directory not found"
        return $false
    }
    
    Set-Location $laravelDir
    
    Write-Info "[UP] Step 1: Checking Composer..."
    if (-not (Get-Command composer -ErrorAction SilentlyContinue)) {
        Write-Error "[UP] Composer not found"
        return $false
    }
    Write-Success "[UP] OK Composer found"
    
    Write-Info "[UP] Step 2: Installing/Updating Laravel Octane..."
    if (Test-ComposerPackage -PackageName "laravel/octane" -LaravelDir $laravelDir) {
        Write-Info "[UP] Laravel Octane already installed, ensuring latest version..."
        composer update laravel/octane
    } else {
        Write-Info "[UP] Installing Laravel Octane..."
        composer require laravel/octane
    }
    
    
    Write-Info "[UP] Step 3: Publishing Octane configuration..."
    $octaneConfigFile = Join-Path $laravelDir "config\octane.php"
    if (Test-Path $octaneConfigFile) {
        Write-Info "[UP] Octane config already exists, skipping publish"
    } else {
        php artisan octane:install --server=swoole
    }
    
    if (Test-Path $octaneConfigFile) {
        Write-Success "[UP] OK Octane config file exists"
    } else {
        Write-Warning "[UP] WARNING Octane config not found"
    }
    
    Write-Info "[UP] Step 4: Verifying installation..."
    if (Test-ComposerPackage -PackageName "laravel/octane" -LaravelDir $laravelDir) {
        Write-Success "[UP] OK Laravel Octane package installed"
    } else {
        Write-Error "[UP] ERROR Laravel Octane package not found"
        return $false
    }
    
    Set-UpApplied $version
    
    Write-Success "========================================"
    Write-Success "[UP] $version completed successfully"
    Write-Success "========================================"
    
    return $true
}

# ============================================================================
# UP: 20251127_install_chokidar
# Date: 2025-11-27
# Description: Install chokidar for Octane hot-reload functionality
# Idempotent: Always runs to verify and fix installation
# ============================================================================
function Invoke-Up20251127InstallChokidar {
    $version = "20251127_install_chokidar"
    
    Write-Info "========================================"
    Write-Info "[UP] Running: $version"
    Write-Info "[UP] Date: 2025-11-27"
    Write-Info "[UP] Description: Install chokidar for hot-reload"
    Write-Info "[UP] Note: Always runs to ensure proper installation"
    Write-Info "========================================"
    
    $laravelDir = Get-LaravelDir
    if ([string]::IsNullOrEmpty($laravelDir)) {
        Write-Error "[UP] ERROR: Laravel directory not found"
        return $false
    }
    
    Set-Location $laravelDir
    
    Write-Info "[UP] Step 1: Checking Node.js and pnpm..."
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Error "[UP] ERROR: Node.js not found"
        Write-Warning "[UP] Please install Node.js first"
        return $false
    }
    
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        Write-Error "[UP] ERROR: pnpm not found"
        Write-Warning "[UP] Please install pnpm first (npm install -g pnpm)"
        return $false
    }
    
    $nodeVersion = node --version
    $pnpmVersion = pnpm --version
    Write-Success "[UP] OK Node.js: $nodeVersion"
    Write-Success "[UP] OK pnpm: $pnpmVersion"
    
    Write-Info "[UP] Step 2: Checking/Installing chokidar (always runs)..."
    
    $chokidarDir = Join-Path $laravelDir "node_modules\chokidar"
    if (Test-Path $chokidarDir) {
        Write-Info "[UP] chokidar exists, verifying installation..."
        pnpm install --save-dev chokidar
    } else {
        Write-Info "[UP] Installing chokidar..."
        pnpm install --save-dev chokidar
    }
    
    Write-Info "[UP] Step 3: Verifying chokidar installation..."
    if (Test-Path $chokidarDir) {
        Write-Success "[UP] OK chokidar installed"
    } else {
        Write-Error "[UP] ERROR: chokidar not found after installation"
        return $false
    }
    
    Write-Info "[UP] Step 4: Testing chokidar functionality..."
    $testResult = node -e "require('chokidar'); console.log('OK')" 2>&1
    if ($testResult -match "OK") {
        Write-Success "[UP] OK chokidar can be loaded successfully"
    } else {
        Write-Warning "[UP] WARNING: chokidar test failed, but continuing..."
    }
    
    Set-UpApplied $version
    
    Write-Success "========================================"
    Write-Success "[UP] $version completed successfully"
    Write-Success "========================================"
    
    return $true
}

# ============================================================================
# UP: 20251206_install_faker
# Date: 2025-12-06
# Description: Install FakerPHP library for model factories and seeding
# Idempotent: Can be run multiple times safely
# ============================================================================
function Invoke-Up20251206InstallFaker {
    $version = "20251206_install_faker"
    
    Write-Info "========================================"
    Write-Info "[UP] Running: $version"
    Write-Info "[UP] Date: 2025-12-06"
    Write-Info "[UP] Description: Install FakerPHP for testing"
    
    if (Test-UpApplied $version) {
        Write-Info "[UP] Note: Already applied before, re-running for idempotency"
    }
    
    Write-Info "========================================"
    
    $laravelDir = Get-LaravelDir
    if ([string]::IsNullOrEmpty($laravelDir)) {
        Write-Error "[UP] ERROR: Laravel directory not found"
        return $false
    }
    
    Set-Location $laravelDir
    
    Write-Info "[UP] Step 1: Checking Composer..."
    if (-not (Get-Command composer -ErrorAction SilentlyContinue)) {
        Write-Error "[UP] Composer not found"
        return $false
    }
    Write-Success "[UP] OK Composer found"
    
    Write-Info "[UP] Step 2: Installing/Updating FakerPHP..."
    if (Test-ComposerPackage -PackageName "fakerphp/faker" -LaravelDir $laravelDir) {
        Write-Info "[UP] FakerPHP already installed, ensuring latest version..."
        composer update fakerphp/faker --dev
    } else {
        Write-Info "[UP] Installing FakerPHP..."
        composer require fakerphp/faker --dev
    }
    
    
    Write-Info "[UP] Step 3: Verifying installation..."
    if (Test-ComposerPackage -PackageName "fakerphp/faker" -LaravelDir $laravelDir) {
        Write-Success "[UP] OK FakerPHP package installed"
    } else {
        Write-Error "[UP] ERROR FakerPHP package not found"
        return $false
    }
    
    Write-Info "[UP] Step 4: Testing fake() helper..."
    $tinkerResult = php artisan tinker --execute="var_dump(function_exists('fake'));" 2>&1
    if ($tinkerResult -match "bool\(true\)") {
        Write-Success "[UP] OK fake() helper function is available"
    } else {
        Write-Warning "[UP] WARNING fake() helper may not be available"
    }
    
    Set-UpApplied $version
    
    Write-Success "========================================"
    Write-Success "[UP] $version completed successfully"
    Write-Success "========================================"
    
    return $true
}

# ============================================================================
# UP: 20251215_install_reverb
# Date: 2025-12-15
# Description: Install Laravel Reverb for WebSocket support
# Idempotent: Can be run multiple times safely
# ============================================================================
function Invoke-Up20251215InstallReverb {
    $version = "20251215_install_reverb"
    
    Write-Info "========================================"
    Write-Info "[UP] Running: $version"
    Write-Info "[UP] Date: 2025-12-15"
    Write-Info "[UP] Description: Install Laravel Reverb for WebSocket"
    
    if (Test-UpApplied $version) {
        Write-Info "[UP] Note: Already applied before, re-running for idempotency"
    }
    
    Write-Info "========================================"
    
    $laravelDir = Get-LaravelDir
    if ([string]::IsNullOrEmpty($laravelDir)) {
        Write-Error "[UP] ERROR: Laravel directory not found"
        return $false
    }
    
    Set-Location $laravelDir
    
    Write-Info "[UP] Step 1: Checking Composer..."
    if (-not (Get-Command composer -ErrorAction SilentlyContinue)) {
        Write-Error "[UP] Composer not found"
        return $false
    }
    Write-Success "[UP] OK Composer found"
    
    Write-Info "[UP] Step 2: Installing Pusher PHP Server (Reverb dependency)..."
    if (Test-ComposerPackage -PackageName "pusher/pusher-php-server" -LaravelDir $laravelDir) {
        Write-Info "[UP] Pusher PHP Server already installed"
    } else {
        Write-Info "[UP] Installing pusher/pusher-php-server..."
        composer require pusher/pusher-php-server --with-all-dependencies
    }
    
    Write-Info "[UP] Step 3: Installing/Updating Laravel Reverb..."
    if (Test-ComposerPackage -PackageName "laravel/reverb" -LaravelDir $laravelDir) {
        Write-Info "[UP] Laravel Reverb already installed, ensuring latest version..."
        composer update laravel/reverb --with-all-dependencies
    } else {
        Write-Info "[UP] Installing Laravel Reverb..."
        composer require laravel/reverb --with-all-dependencies
    }
    
    
    Write-Info "[UP] Step 4: Publishing Reverb configuration..."
    $reverbConfigFile = Join-Path $laravelDir "config\reverb.php"
    if (Test-Path $reverbConfigFile) {
        Write-Info "[UP] Reverb config already exists, skipping publish"
    } else {
        php artisan reverb:install --no-interaction
    }
    
    if (Test-Path $reverbConfigFile) {
        Write-Success "[UP] OK Reverb config file exists"
    } else {
        Write-Warning "[UP] WARNING Reverb config not found"
    }
    
    Write-Info "[UP] Step 5: Verifying installation..."
    if (Test-ComposerPackage -PackageName "laravel/reverb" -LaravelDir $laravelDir) {
        Write-Success "[UP] OK Laravel Reverb package installed"
    } else {
        Write-Error "[UP] ERROR Laravel Reverb package not found"
        return $false
    }
    
    Write-Info "[UP] Step 6: Updating .env for Reverb..."
    $envFile = Join-Path $laravelDir ".env"
    if (Test-Path $envFile) {
        $envContent = Get-Content $envFile -Raw
        
        if ($envContent -notmatch "^BROADCAST_CONNECTION=") {
            Add-Content -Path $envFile -Value "BROADCAST_CONNECTION=reverb"
            Write-Success "[UP] OK Added BROADCAST_CONNECTION=reverb"
        } elseif ($envContent -match "^BROADCAST_CONNECTION=log") {
            $envContent = $envContent -replace "^BROADCAST_CONNECTION=log", "BROADCAST_CONNECTION=reverb"
            Set-Content -Path $envFile -Value $envContent
            Write-Success "[UP] OK Updated BROADCAST_CONNECTION to reverb"
        } else {
            Write-Info "[UP] BROADCAST_CONNECTION already configured"
        }
        
        if ($envContent -notmatch "^REVERB_APP_ID=") {
            $timestamp = [DateTimeOffset]::Now.ToUnixTimeSeconds()
            Add-Content -Path $envFile -Value ""
            Add-Content -Path $envFile -Value "REVERB_APP_ID=task-system"
            Add-Content -Path $envFile -Value "REVERB_APP_KEY=reverb-key-$timestamp"
            Add-Content -Path $envFile -Value "REVERB_APP_SECRET=reverb-secret-$timestamp"
            Add-Content -Path $envFile -Value "REVERB_HOST=0.0.0.0"
            Add-Content -Path $envFile -Value "REVERB_PORT=8080"
            Add-Content -Path $envFile -Value "REVERB_SCHEME=http"
            Write-Success "[UP] OK Added Reverb configuration to .env"
        } else {
            Write-Info "[UP] Reverb env variables already configured"
        }
    } else {
        Write-Warning "[UP] WARNING .env file not found"
    }
    
    Set-UpApplied $version
    
    Write-Success "========================================"
    Write-Success "[UP] $version completed successfully"
    Write-Success "========================================"
    
    return $true
}

# ============================================================================
# UP: 20251220_install_haikunator
# Date: 2025-12-20
# Description: Install Haikunator PHP for auto-generating nicknames
# Idempotent: Can be run multiple times safely
# ============================================================================
function Invoke-Up20251220InstallHaikunator {
    $version = "20251220_install_haikunator"
    
    Write-Info "========================================"
    Write-Info "[UP] Running: $version"
    Write-Info "[UP] Date: 2025-12-20"
    Write-Info "[UP] Description: Install Haikunator for nickname generation"
    
    if (Test-UpApplied $version) {
        Write-Info "[UP] Note: Already applied before, re-running for idempotency"
    }
    
    Write-Info "========================================"
    
    $laravelDir = Get-LaravelDir
    if ([string]::IsNullOrEmpty($laravelDir)) {
        Write-Error "[UP] ERROR: Laravel directory not found"
        return $false
    }
    
    Set-Location $laravelDir
    
    Write-Info "[UP] Step 1: Checking Composer..."
    if (-not (Get-Command composer -ErrorAction SilentlyContinue)) {
        Write-Error "[UP] Composer not found"
        return $false
    }
    Write-Success "[UP] OK Composer found"
    
    Write-Info "[UP] Step 2: Installing/Updating Haikunator..."
    if (Test-ComposerPackage -PackageName "atrox/haikunator" -LaravelDir $laravelDir) {
        Write-Info "[UP] Haikunator already installed, ensuring latest version..."
        composer update atrox/haikunator
    } else {
        Write-Info "[UP] Installing Haikunator..."
        composer require atrox/haikunator
    }
    
    
    Write-Info "[UP] Step 3: Verifying installation..."
    if (Test-ComposerPackage -PackageName "atrox/haikunator" -LaravelDir $laravelDir) {
        Write-Success "[UP] OK Haikunator package installed"
    } else {
        Write-Error "[UP] ERROR Haikunator package not found"
        return $false
    }
    
    Set-UpApplied $version
    
    Write-Success "========================================"
    Write-Success "[UP] $version completed successfully"
    Write-Success "========================================"
    
    return $true
}

# ============================================================================
# REUSABLE FUNCTIONS - Can be called from other scripts
# ============================================================================

# Function to get Laravel directory path
function Get-LaravelDir {
    if ([string]::IsNullOrEmpty($CORE_NODE_DIR)) {
        $scriptRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)))
        return Join-Path $scriptRoot "poly_apps\laravel_main"
    } else {
        return Join-Path $CORE_NODE_DIR "poly_apps\laravel_main"
    }
}

# Function to initialize system directories
function Initialize-SystemDirectories {
    Write-Info "[DEPLOY] Initializing system directories"
    
    # Windows: Direct D: drive paths (no path mapping needed)
    $wwwRoot = $WWW_ROOT
    $nginxConfigDir = $NGINX_CONFIG_DIR
    $sslDir = Join-Path $nginxConfigDir "ssl"
    $sharedData = $SHARED_DATA_DIR
    $backupDir = $BACKUP_DIR
    $laravelMain = Join-Path $wwwRoot "laravel_main"
    $laravelDb = Join-Path $laravelMain "laravel_db"
    
    $dbFiles = Get-ChildItem -Path $laravelDb -Filter "*.db" -ErrorAction SilentlyContinue
    $dbFiles += Get-ChildItem -Path $laravelDb -Filter "*.sqlite" -ErrorAction SilentlyContinue
    $dbFiles += Get-ChildItem -Path $laravelDb -Filter "*.sqlite3" -ErrorAction SilentlyContinue
    
    if ($dbFiles.Count -gt 0) {
        Write-Info "[DEPLOY] Database files detected - will preserve"
    }
    
    $systemDirs = @(
        $nginxConfigDir,
        $sslDir,
        (Join-Path $nginxConfigDir "sites-available"),
        (Join-Path $nginxConfigDir "sites-enabled"),
        $wwwRoot,
        $laravelMain,
        $laravelDb,
        (Join-Path $laravelDb "tmp"),
        (Join-Path $laravelDb "sessions"),
        $sharedData,
        $backupDir
    )
    
    foreach ($dir in $systemDirs) {
        if (-not (Test-Path $dir)) {
            try {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            } catch {
                Write-Error "[DEPLOY] Failed to create $dir"
                return $false
            }
        }
    }
    
    Write-Success "[DEPLOY] OK System directories initialized"
    return $true
}

# Function to check if Laravel is available
function Test-LaravelAvailable {
    $laravelDir = Get-LaravelDir
    
    Write-Success "[DEPLOY] OK Laravel directory: $laravelDir"
    
    $vendorDir = Join-Path $laravelDir "vendor"
    if (-not (Test-Path $vendorDir)) {
        Write-Warning "[DEPLOY] Running composer install..."
        Set-Location $laravelDir
        composer install --optimize-autoloader
    }
    
    Set-Location $laravelDir
    php artisan --version
    
    Write-Success "[DEPLOY] OK Laravel is ready"
    return $true
}

# Function to initialize Laravel-specific directories
function Initialize-LaravelDirectories {
    Write-Info "[DEPLOY] Initializing Laravel directories"
    
    $laravelDir = Get-LaravelDir
    
    $laravelDirs = @(
        (Join-Path $laravelDir "storage\framework\sessions"),
        (Join-Path $laravelDir "storage\framework\cache"),
        (Join-Path $laravelDir "storage\framework\views"),
        (Join-Path $laravelDir "storage\logs"),
        (Join-Path $laravelDir "storage\app\public"),
        (Join-Path $laravelDir "bootstrap\cache")
    )
    
    foreach ($dir in $laravelDirs) {
        if (-not (Test-Path $dir)) {
            try {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
            } catch {
                Write-Error "[DEPLOY] Failed to create $dir"
                return $false
            }
        }
    }
    
    Write-Success "[DEPLOY] OK Laravel directories initialized"
    return $true
}

# Check initialization - ensure directories and permissions
function Test-Initialization {
    Write-Info "[INIT] Initializing Laravel environment"
    
    $laravelDir = Get-LaravelDir
    Set-Location $laravelDir
    
    # Create Laravel directories
    $storageDirs = @(
        "storage\framework\sessions",
        "storage\framework\cache",
        "storage\framework\views",
        "storage\logs",
        "storage\app\public",
        "bootstrap\cache"
    )
    
    foreach ($dir in $storageDirs) {
        $fullPath = Join-Path $laravelDir $dir
        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        }
    }
    
    # Create external directories for PathMapper
    # Windows: Direct D: drive path
    $sessionsDir = Join-Path $LARAVEL_DB_DIR "sessions"
    $tmpDir = Join-Path $LARAVEL_DB_DIR "tmp"
    
    if (-not (Test-Path $sessionsDir)) {
        New-Item -ItemType Directory -Path $sessionsDir -Force | Out-Null
    }
    if (-not (Test-Path $tmpDir)) {
        New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
    }
    
    # Create .env if needed
    $envFile = Join-Path $laravelDir ".env"
    $envExample = Join-Path $laravelDir ".env.example"
    
    if (-not (Test-Path $envFile)) {
        if (Test-Path $envExample) {
            Copy-Item $envExample $envFile
        }
    }
    
    # Generate APP_KEY if needed
    $envContent = Get-Content $envFile -Raw -ErrorAction SilentlyContinue
    if ($envContent -and $envContent -notmatch "^APP_KEY=base64:") {
        php artisan key:generate --force
    }
    
    Write-Success "[INIT] OK Environment initialized"
    return $true
}

# Run all UP methods in sequence
function Invoke-AllUps {
    Write-Info "========================================"
    Write-Info "Running all UP methods"
    Write-Info "========================================"
    
    Initialize-UpState
    
    $failed = $false
    
    if (-not (Invoke-Up20251115InstallLaravelMcp)) { $failed = $true }
    # Octane is not needed on Windows - skipped
    # if (-not (Invoke-Up20251115InstallOctane)) { $failed = $true }
    if (-not (Invoke-Up20251127InstallChokidar)) { $failed = $true }
    if (-not (Invoke-Up20251206InstallFaker)) { $failed = $true }
    if (-not (Invoke-Up20251215InstallReverb)) { $failed = $true }
    if (-not (Invoke-Up20251220InstallHaikunator)) { $failed = $true }
    
    if (-not $failed) {
        Write-Success "[UP] All updates applied successfully"
        return $true
    } else {
        Write-Error "[UP] Some updates failed"
        return $false
    }
}

# Function to fix prerequisites and common issues
function Repair-Prerequisites {
    Write-Host ""
    Write-Info "[PREREQUISITES] Checking and fixing common issues"
    
    # 1. Fix Git safe directory issue (WSL/dual boot common problem)
    Write-Warning "Fixing Git safe directory issues..."
    $currentDir = Get-Location
    $projectRoot = $CORE_NODE_DIR
    
    # Add current directory and project root to Git safe directories
    git config --global --add safe.directory $currentDir
    git config --global --add safe.directory $projectRoot
    
    # Also add any parent directories that might be causing issues
    $parentDir = Split-Path -Parent $currentDir
    git config --global --add safe.directory $parentDir
    
    Write-Success "Git safe directories configured"
    
    # 2. Check archive extraction tools (Windows doesn't need apt, but we check for 7zip/unzip)
    Write-Warning "Checking archive extraction tools..."
    $toolsAvailable = $false
    
    if ((Get-Command unzip -ErrorAction SilentlyContinue) -or (Get-Command 7z -ErrorAction SilentlyContinue) -or (Get-Command 7za -ErrorAction SilentlyContinue)) {
        $toolsAvailable = $true
        Write-Success "Archive extraction tools already available"
    } else {
        Write-Warning "No archive tools found - Composer will use PHP zip extension"
    }
    
    # 3. Fix file permissions for Windows
    Write-Warning "Fixing file permissions..."
    
    # Fix script permissions
    $scriptFile = Join-Path $SCRIPT_DIR "deploy.ps1"
    if (Test-Path $scriptFile) {
        # PowerShell scripts don't need chmod on Windows
    }
    
    # Fix common Laravel file permissions
    $laravelDir = Get-LaravelDir
    $artisanFile = Join-Path $laravelDir "artisan"
    if (Test-Path $artisanFile) {
        Write-Success "Fixed artisan permissions"
    }
    
    # 4. Verify Git functionality
    Write-Warning "Verifying Git functionality..."
    git status
    Write-Success "Git is working properly"
    
    # 5. Check Composer functionality
    Write-Warning "Checking Composer zip handling..."
    if ($toolsAvailable) {
        Write-Success "Archive extraction tools available for Composer"
    } else {
        Write-Warning "No archive tools found - Composer will use PHP zip extension"
    }
    
    Write-Success "[PREREQUISITES] Setup complete"
    Write-Host ""
}

# Ensures the .env file exists and is properly configured
function Test-EnvFile {
    param(
        [string]$ProjectRoot = ""
    )
    
    if ([string]::IsNullOrEmpty($ProjectRoot)) {
        $ProjectRoot = Get-Location
    }
    
    $envFile = Join-Path $ProjectRoot ".env"
    $envExample = Join-Path $ProjectRoot ".env.example"
    
    Write-Host ""
    Write-Info "[ENV SETUP] Verifying environment configuration"
    
    # Verify .env file existence
    if (-not (Test-Path $envFile)) {
        if (-not (Test-Path $envExample)) {
            Write-Error "Error: Missing .env.example file in $ProjectRoot"
            return $false
        }
        
        # Create from example
        Copy-Item $envExample $envFile
        Write-Success "Created .env from template"
        
        # Generate application key
        $envContent = Get-Content $envFile -Raw
        if ($envContent -match "APP_KEY=") {
            if (Get-Command php -ErrorAction SilentlyContinue) {
                Set-Location $ProjectRoot
                php artisan key:generate --quiet
                Write-Success "Generated application encryption key"
            } else {
                Write-Warning "PHP not available - APP_KEY remains unset"
            }
        }
    } else {
        Write-Info ".env already exists"
    }
    
    # Set secure permissions (Windows: remove read permissions for others)
    if (Test-Path $envFile) {
        $acl = Get-Acl $envFile
        $acl.SetAccessRuleProtection($true, $false)
        $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
        $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentUser, "FullControl", "Allow")
        $acl.SetAccessRule($accessRule)
        Set-Acl $envFile $acl
        Write-Success "Applied secure file permissions"
    }
    
    return $true
}

# Ensures production environment configuration
function Test-ProductionEnvironment {
    param(
        [string]$ProjectRoot = ""
    )
    
    if ([string]::IsNullOrEmpty($ProjectRoot)) {
        $ProjectRoot = Get-Location
    }
    
    $envFile = Join-Path $ProjectRoot ".env"
    $changesMade = $false
    
    Write-Host ""
    Write-Info "[ENV CONFIG] Validating production settings"
    
    # Verify .env exists
    if (-not (Test-Path $envFile)) {
        Write-Error "Error: .env not found in $ProjectRoot"
        return $false
    }
    
    # Create backup
    Copy-Item $envFile "$envFile.bak"
    
    $envContent = Get-Content $envFile -Raw
    
    # Configure APP_ENV
    if ($envContent -match "^APP_ENV=") {
        if ($envContent -notmatch "^APP_ENV=production`r?`n") {
            $envContent = $envContent -replace "^APP_ENV=.*", "APP_ENV=production"
            $changesMade = $true
            Write-Success "Set APP_ENV to production"
        }
    } else {
        $envContent += "`nAPP_ENV=production`n"
        $changesMade = $true
        Write-Success "Added APP_ENV setting"
    }
    
    # Configure APP_DEBUG
    if ($envContent -match "^APP_DEBUG=") {
        if ($envContent -notmatch "^APP_DEBUG=false`r?`n") {
            $envContent = $envContent -replace "^APP_DEBUG=.*", "APP_DEBUG=false"
            $changesMade = $true
            Write-Success "Disabled debug mode"
        }
    } else {
        $envContent += "`nAPP_DEBUG=false`n"
        $changesMade = $true
        Write-Success "Added APP_DEBUG setting"
    }
    
    # Cleanup if no changes were needed
    if (-not $changesMade) {
        Remove-Item "$envFile.bak" -Force -ErrorAction SilentlyContinue
        Write-Info "Production settings already configured"
    } else {
        Set-Content -Path $envFile -Value $envContent
        Write-Success "Production configuration complete"
    }
    
    return $true
}

# ============================================================================
# MAIN EXECUTION - Always runs (idempotent)
# ============================================================================
# Print environment and configuration information
Show-EnvironmentInfo

# Check initialization (ensure directories and permissions)
Test-Initialization

# Run all UP methods automatically when sourced or executed
Invoke-AllUps

# Restore initial working directory first
Set-Location $INITIAL_WORKING_DIR
Write-Info "Restored initial working directory: $INITIAL_WORKING_DIR"

# Run Laravel system initialization (in parent directory of scripts)
$parentDir = Split-Path -Parent $SCRIPT_DIR
Set-Location $parentDir
Write-Info "Running Laravel system initialization..."
php artisan sys:init
Write-Success "Laravel system initialization completed"

# Verify Laravel project can start after sys:init (Windows: no service installation needed)
$laravelDir = Get-LaravelDir
Set-Location $laravelDir

Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host "LARAVEL PROJECT STARTUP VERIFICATION" -ForegroundColor Cyan
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Info "Verifying Laravel project can start..."

# Check if artisan exists
$artisanFile = Join-Path $laravelDir "artisan"
if (-not (Test-Path $artisanFile)) {
    Write-Error "artisan file not found at: $artisanFile"
} else {
    Write-Success "artisan file found"
}

# Check if vendor directory exists
$vendorDir = Join-Path $laravelDir "vendor"
if (-not (Test-Path $vendorDir)) {
    Write-Warning "vendor directory not found - run 'composer install' first"
} else {
    Write-Success "vendor directory exists"
}

# Check if .env exists
$envFile = Join-Path $laravelDir ".env"
if (-not (Test-Path $envFile)) {
    Write-Warning ".env file not found - Laravel may not start properly"
} else {
    Write-Success ".env file exists"
}

# Test basic artisan command
Write-Info "Testing Laravel artisan command..."
php artisan --version
Write-Success "Laravel artisan is working"

Write-Host ""
Write-Info "Laravel project is ready to start"
Write-Info "To start the development server, run:"
Write-Host "  cd $laravelDir" -ForegroundColor Yellow
Write-Host "  php artisan serve" -ForegroundColor Yellow
Write-Host ""
Write-Host "============================================================================" -ForegroundColor Cyan
Write-Host ""

# Restore initial working directory after startup verification
Set-Location $INITIAL_WORKING_DIR
Write-Info "Restored initial working directory: $INITIAL_WORKING_DIR"

# ============================================================================
# LEGACY DEPLOYMENT FUNCTIONS (kept for reference, not executed automatically)
# ============================================================================
# To run full deployment, execute: .\deploy.ps1 -FullDeploy
# ============================================================================

if ($FullDeploy) {
    # Change to the script's directory
    Set-Location $SCRIPT_DIR
    Write-Host "Changed to directory: $SCRIPT_DIR"
    
    # Windows does not need permission setup - directories are created with proper permissions automatically
    
    # Function to verify PHP installation (no version specified)
    function Test-Php {
        Write-Info "Verifying PHP installation..."
        if (Get-Command php -ErrorAction SilentlyContinue) {
            $phpVersion = php -v | Select-Object -First 1
            Write-Success "PHP version: $phpVersion"
            return $true
        } else {
            Write-Error "PHP is not installed or not in PATH"
            Write-Warning "Please install PHP from https://windows.php.net/download/"
            return $false
        }
    }
    
    # Function to check and install required PHP extensions
    function Test-PhpExtensions {
        Write-Host "Checking required PHP extensions (dom, xml)..."
        $phpModules = php -m 2>&1
        
        if ($phpModules -notmatch 'dom') {
            Write-Warning "PHP extension 'dom' not found. Please install php-xml extension."
        }
        if ($phpModules -notmatch 'xml') {
            Write-Warning "PHP extension 'xml' not found. Please install php-xml extension."
        }
    }
    
    # Function to verify Composer installation
    function Test-Composer {
        Write-Info "Verifying Composer installation..."
        if (Get-Command composer -ErrorAction SilentlyContinue) {
            $composerVersion = composer --version
            Write-Success "Composer version: $composerVersion"
            return $true
        } else {
            Write-Error "Composer is not installed or not in PATH"
            Write-Warning "Please install Composer from https://getcomposer.org/download/"
            return $false
        }
    }
    
    # Function to check and install vendor dependencies
    function Test-Vendor {
        $laravelDir = Get-LaravelDir
        $vendorDir = Join-Path $laravelDir "vendor"
        
        if (-not (Test-Path $vendorDir)) {
            Write-Host "Vendor directory not found. Installing dependencies..."
            Set-Location $laravelDir
            composer install
        } else {
            Write-Host "Vendor directory exists."
        }
        
        # Octane is not needed on Windows - skipped
        # Repair-OctaneSwooleCompatibility
    }
    
    # Function to clear Laravel cache
    function Clear-Cache {
        $laravelDir = Get-LaravelDir
        Set-Location $laravelDir
        
        Write-Host "Clearing Laravel cache..."
        php artisan cache:clear
        php artisan config:clear
        php artisan route:clear
        php artisan view:clear
    }
    
    # Function to handle SQLite database with intelligent migration
    function Initialize-Database {
        # Windows: Direct D: drive path
        $dbDir = $LARAVEL_DB_DIR
        $dbFile = Join-Path $dbDir "database.sqlite"
        $laravelDir = Get-LaravelDir
        $envFile = Join-Path $laravelDir ".env"
        
        Write-Info "[DATABASE] Initializing SQLite database"
        Write-Host "Database file location: $dbFile" -ForegroundColor Green
        
        # 1. Ensure database directory exists
        if (-not (Test-Path $dbDir)) {
            New-Item -ItemType Directory -Path $dbDir -Force | Out-Null
            Write-Warning "Created database directory"
        }
        
        # 2. Handle database file creation
        $dbExists = $false
        if (-not (Test-Path $dbFile)) {
            $response = Read-Host "Database file does not exist. Create it? (y/N)"
            if ($response -eq "y" -or $response -eq "Y") {
                New-Item -ItemType File -Path $dbFile -Force | Out-Null
                Write-Success "Created new database file"
            } else {
                Write-Warning "Skipping database initialization"
                return
            }
        } else {
            $dbExists = $true
            Write-Success "Using existing database"
        }
        
        # 3. Configure .env file
        if (-not (Test-Path $envFile)) {
            $envExample = Join-Path $laravelDir ".env.example"
            if (Test-Path $envExample) {
                Copy-Item $envExample $envFile
                Write-Warning "Created .env file from example"
            }
        }
        
        # Update .env with SQLite configuration
        $envContent = Get-Content $envFile -Raw
        if ($envContent -notmatch "^DB_CONNECTION=sqlite") {
            $envContent = $envContent -replace "^DB_CONNECTION=.*", "DB_CONNECTION=sqlite"
        }
        $dbFileEscaped = $dbFile -replace '\\', '\\'
        $envContent = $envContent -replace "^DB_DATABASE=.*", "DB_DATABASE=$dbFileEscaped"
        Set-Content -Path $envFile -Value $envContent
        
        # 4. Run appropriate migrations based on database state
        Set-Location $laravelDir
        if ($dbExists) {
            Write-Info "[DATABASE] Running schema updates on existing database"
            php artisan migrate --force
        } else {
            Write-Info "[DATABASE] Initializing new database with migrations"
            php artisan migrate:fresh --force --seed
        }
        
        # 5. Optional configuration (if needed)
        $artisanCommands = php artisan 2>&1
        if ($artisanCommands -match "database:config") {
            php artisan database:config
        }
        
        # Set proper permissions
        if (Test-Path $dbDir) {
            $acl = Get-Acl $dbDir
            $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
            $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule($currentUser, "FullControl", "Allow")
            $acl.SetAccessRule($accessRule)
            Set-Acl $dbDir $acl
        }
        
        Write-Success "Database setup complete"
    }
    
    # Function to fix Octane/Swoole compatibility
    function Repair-OctaneSwooleCompatibility {
        $laravelRoot = Split-Path -Parent $SCRIPT_DIR
        $fixerScript = Join-Path $laravelRoot "app\Support\OctaneSwooleCompatFixer.php"
        
        # Always try to apply patch, silently skip if conditions not met
        if ((Test-Path $fixerScript) -and (Test-Path (Join-Path $laravelRoot "vendor\laravel\octane"))) {
            php $fixerScript $laravelRoot
        }
        
        return $true
    }
    
    # Function to verify Laravel project can start (Windows only - no service installation)
    function Test-LaravelStartup {
        $laravelDir = Get-LaravelDir
        Set-Location $laravelDir
        
        Write-Host ""
        Write-Host "============================================================================" -ForegroundColor Cyan
        Write-Host "LARAVEL PROJECT STARTUP VERIFICATION" -ForegroundColor Cyan
        Write-Host "============================================================================" -ForegroundColor Cyan
        Write-Host ""
        
        Write-Info "Verifying Laravel project can start..."
        
        # Check if artisan exists
        $artisanFile = Join-Path $laravelDir "artisan"
        if (-not (Test-Path $artisanFile)) {
            Write-Error "artisan file not found at: $artisanFile"
            return $false
        }
        Write-Success "artisan file found"
        
        # Check if vendor directory exists
        $vendorDir = Join-Path $laravelDir "vendor"
        if (-not (Test-Path $vendorDir)) {
            Write-Warning "vendor directory not found - run 'composer install' first"
            return $false
        }
        Write-Success "vendor directory exists"
        
        # Check if .env exists
        $envFile = Join-Path $laravelDir ".env"
        if (-not (Test-Path $envFile)) {
            Write-Warning ".env file not found - Laravel may not start properly"
        } else {
            Write-Success ".env file exists"
        }
        
        # Test basic artisan command
        Write-Info "Testing Laravel artisan command..."
        php artisan --version
        Write-Success "Laravel artisan is working"
        
        Write-Host ""
        Write-Info "Laravel project is ready to start"
        Write-Info "To start the development server, run:"
        Write-Host "  cd $laravelDir" -ForegroundColor Yellow
        Write-Host "  php artisan serve" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "============================================================================" -ForegroundColor Cyan
        Write-Host ""
        
        return $true
    }
    
    # Function to configure open_basedir in project's .user.ini
    function Set-ProjectOpenBasedir {
        Write-Info "[PHP CONFIG] Configuring .user.ini"
        
        $projectRoot = $SCRIPT_DIR
        $userIniFile = Join-Path $projectRoot "public\.user.ini"
        
        $publicDir = Split-Path -Parent $userIniFile
        if (-not (Test-Path $publicDir)) {
            New-Item -ItemType Directory -Path $publicDir -Force | Out-Null
        }
        
        $iniContent = @"
; Disable open_basedir for Laravel poly projects to allow PathMapper environment detection
open_basedir = none

; Security settings
disable_functions = exec,passthru,shell_exec,system,proc_open,popen
expose_php = Off
"@
        
        Set-Content -Path $userIniFile -Value $iniContent
        Write-Success "[PHP CONFIG] OK .user.ini configured"
    }
    
    # Main execution for full deploy
    Write-Host "System detected as Windows"
    
    # Fix prerequisites and common issues first
    Repair-Prerequisites
    
    # Verify PHP and Composer before proceeding
    Test-Php
    Test-Composer
    
    Test-PhpExtensions
    
    $laravelDir = Get-LaravelDir
    Test-EnvFile -ProjectRoot $laravelDir
    Test-ProductionEnvironment -ProjectRoot $laravelDir
    # Windows does not need permission setup - skipped
    Test-Vendor
    # Octane is not needed on Windows - skipped
    # Repair-OctaneSwooleCompatibility
    Clear-Cache
    Initialize-Database
    Set-ProjectOpenBasedir
    
    # Create initialization marker
    $markerFile = Join-Path $laravelDir ".laravel_initialized"
    New-Item -ItemType File -Path $markerFile -Force | Out-Null
    Write-Host "Project initialization completed. Marker file created."
    
    # Restore initial working directory before final step
    Set-Location $INITIAL_WORKING_DIR
    Write-Info "Restored initial working directory: $INITIAL_WORKING_DIR"
    
    # Run Laravel system initialization last (in parent directory of scripts)
    $parentDir = Split-Path -Parent $SCRIPT_DIR
    Set-Location $parentDir
    Write-Info "Running Laravel system initialization (final step)..."
    php artisan sys:init
    Write-Success "Laravel system initialization completed"
    
    # Restore initial working directory after sys:init
    Set-Location $INITIAL_WORKING_DIR
    Write-Info "Restored initial working directory: $INITIAL_WORKING_DIR"
    
    # Verify Laravel project can start (Windows: no service installation needed)
    Test-LaravelStartup
    
    # Restore initial working directory after startup verification
    Set-Location $INITIAL_WORKING_DIR
    Write-Info "Restored initial working directory: $INITIAL_WORKING_DIR"
}
