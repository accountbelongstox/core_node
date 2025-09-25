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

# Laravel Main Start Script
# Starts laravel_main application
# PARAMETERS: PROHIBITED - No parameters allowed for consistency and reliability

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$CORE_NODE_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)
$FLUTTER_BLOOM_DIR = Join-Path $CORE_NODE_ROOT "poly_apps\flutter_bloom"
$FLUTTER_WIN_COMMON_DIR = Join-Path $FLUTTER_BLOOM_DIR "scripts\win_common"
# Import Flutter GVar system for shared variables
if (Test-Path (Join-Path $FLUTTER_WIN_COMMON_DIR "FlutterGlobalVar.ps1")) {
    . (Join-Path $FLUTTER_WIN_COMMON_DIR "FlutterGlobalVar.ps1")
    $FLUTTER_BUILD_SCRIPT = Join-Path $Global:BUILD_SCRIPTS_DIR "build_main.ps1"
    Write-Host "[INFO] Flutter GVar system loaded" -ForegroundColor Green
} else {
    $FLUTTER_BUILD_SCRIPT = Join-Path $FLUTTER_BLOOM_DIR "scripts\build_scripts\build_main.ps1"
    Write-Host "[WARNING] Flutter GVar system not found, some features may be limited" -ForegroundColor Yellow
}

function Show-Menu {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Laravel Main Application - Start Menu" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "1. Start Laravel Server (Development)" -ForegroundColor White
    Write-Host "2. Start Laravel Server (Production)" -ForegroundColor White
    Write-Host "3. Build Flutter App for Laravel Integration" -ForegroundColor Yellow
    Write-Host "4. Exit" -ForegroundColor Red
    Write-Host ""
    Write-Host -NoNewline "Select option (1-4): " -ForegroundColor Cyan
}

function Start-LaravelServer {
    param([string]$Environment = "development")

    try {
        # Change to app directory
        Set-Location $APP_DIR

        # Check if composer.json exists
        if (-not (Test-Path "composer.json")) {
            Write-Host "[ERROR] composer.json not found in app directory" -ForegroundColor Red
            return $false
        }

        # Check if artisan exists
        if (-not (Test-Path "artisan")) {
            Write-Host "[ERROR] artisan file not found in app directory" -ForegroundColor Red
            return $false
        }

        # Set Laravel environment variables for Flutter integration
        if (Get-Command "Set-GvarValue" -ErrorAction SilentlyContinue) {
            Set-GvarValue -Name $Global:KEY_LARAVEL_SERVER_STATUS -Value "starting"
            Set-GvarValue -Name $Global:KEY_LARAVEL_ENVIRONMENT -Value $Environment
            Set-GvarValue -Name $Global:KEY_LARAVEL_PORT -Value "8000"
        }

        # Start the Laravel application
        if ($Environment -eq "production") {
            Write-Host "[INFO] Starting Laravel production server..." -ForegroundColor Cyan
            Write-Host "[INFO] Note: For production, consider using nginx/apache instead" -ForegroundColor Yellow
            php artisan serve --host=0.0.0.0 --port=8000 --env=production
        } else {
            Write-Host "[INFO] Starting Laravel development server..." -ForegroundColor Cyan
            php artisan serve --host=0.0.0.0 --port=8000
        }

        return $true
    }
    catch {
        Write-Host "[ERROR] Failed to start Laravel server: $_" -ForegroundColor Red

        if (Get-Command "Set-GvarValue" -ErrorAction SilentlyContinue) {
            Set-GvarValue -Name $Global:KEY_LARAVEL_SERVER_STATUS -Value "error"
        }

        return $false
    }
}

function Start-FlutterBuild {
    Write-Host "[INFO] Preparing Flutter build for Laravel integration..." -ForegroundColor Green

    # Check if Flutter build script exists
    if (-not (Test-Path $FLUTTER_BUILD_SCRIPT)) {
        Write-Host "[ERROR] Flutter build script not found: $FLUTTER_BUILD_SCRIPT" -ForegroundColor Red
        return $false
    }

    # Set build parameters for Laravel integration
    if (Get-Command "Set-GvarValue" -ErrorAction SilentlyContinue) {
        # Default to web build for Laravel integration
        Set-GvarValue -Name "build_app_name" -Value "app_main"
        Set-GvarValue -Name $Global:KEY_BUILD_PLATFORM -Value "web"
        Set-GvarValue -Name $Global:KEY_BUILD_ACTION -Value "build"
        Set-GvarValue -Name "build_timestamp" -Value (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
        Set-GvarValue -Name $Global:KEY_LARAVEL_INTEGRATION -Value "true"

        # Set app config path
        $appConfigPath = Join-Path $FLUTTER_BLOOM_DIR "lib\apps\app_main\build_config.ini"
        Set-GvarValue -Name "app_config_path" -Value $appConfigPath

        Write-Host "[INFO] Build parameters set for Laravel integration:" -ForegroundColor Cyan
        Write-Host "  App: app_main" -ForegroundColor White
        Write-Host "  Platform: web" -ForegroundColor White
        Write-Host "  Config: $appConfigPath" -ForegroundColor White
        Write-Host ""
    }

    try {
        Write-Host "[INFO] Executing Flutter build script..." -ForegroundColor Yellow
        & $FLUTTER_BUILD_SCRIPT

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[SUCCESS] Flutter build completed successfully" -ForegroundColor Green
            Write-Host "[INFO] Flutter web build can now be integrated with Laravel" -ForegroundColor Cyan
            return $true
        } else {
            Write-Host "[ERROR] Flutter build failed with exit code: $LASTEXITCODE" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "[ERROR] Failed to execute Flutter build: $_" -ForegroundColor Red
        return $false
    }
}

Write-Host "[INFO] Laravel Main Application - Enhanced Start Script" -ForegroundColor Green

# Main menu loop
do {
    Show-Menu
    $choice = Read-Host

    switch ($choice) {
        "1" {
            Write-Host ""
            if (Start-LaravelServer -Environment "development") {
                break
            }
        }
        "2" {
            Write-Host ""
            if (Start-LaravelServer -Environment "production") {
                break
            }
        }
        "3" {
            Write-Host ""
            Start-FlutterBuild
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor Yellow
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
        "4" {
            Write-Host "[INFO] Exiting..." -ForegroundColor Yellow
            exit 0
        }
        default {
            Write-Host "[ERROR] Invalid option. Please select 1-4." -ForegroundColor Red
        }
    }
} while ($true)
