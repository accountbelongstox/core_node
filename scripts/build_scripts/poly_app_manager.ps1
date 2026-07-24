Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$CORE_NODE_DIR = Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)
$POLY_APPS_DIR = Join-Path $CORE_NODE_DIR "poly_apps"
$PY_TOOLS_DIR = Join-Path $SCRIPT_DIR "build_py_tools"
$GLOBAL_VARS_PS1 = Join-Path $CORE_NODE_DIR "scripts\shells\win\win_common\GlobalVars.ps1"
$VALIDATION_HELPER_PS1 = Join-Path $PY_TOOLS_DIR "validation_helper.ps1"

. $GLOBAL_VARS_PS1
. $VALIDATION_HELPER_PS1

function Get-GlobalVar {
    param(
        [string]$Key,
        [string]$DefaultValue = ""
    )
    $normalizedKey = $Key.ToUpper() -replace '[^A-Z0-9_]', '_'
    $filePath = Join-Path $Global:GLOBAL_VAR_DIR $normalizedKey

    if (Test-Path $filePath) {
        return (Get-Content $filePath -Raw).Trim()
    }
    return $DefaultValue
}

Write-Host ""
Write-Host "==============================================================================="
Write-Host "  POLY APPS MANAGER - Multi-Project Launcher"
Write-Host "==============================================================================="
Write-Host ""
Write-Host "Core Node Dir: $CORE_NODE_DIR"
Write-Host "Poly Apps Dir: $POLY_APPS_DIR"
Write-Host ""

Push-Location $PY_TOOLS_DIR

Write-Host "Step 1: Scanning projects in poly_apps..."
Write-Host "-------------------------------------------------------------------------------"
python project_detector.py "$POLY_APPS_DIR" 10000
Write-Host ""

Write-Host "Step 2: Displaying interactive menu..."
Write-Host "-------------------------------------------------------------------------------"
python menu_system.py
Write-Host ""

$SELECTED_PROJECT_NAME = Get-GlobalVar "POLY_APP_SELECTED_PROJECT_NAME"
$PROJECT_PATH = Get-GlobalVar "POLY_APP_PROJECT_PATH"
$PROJECT_TYPE = Get-GlobalVar "POLY_APP_PROJECT_TYPE"
$PROJECT_PORT = Get-GlobalVar "POLY_APP_PROJECT_PORT"
$SELECTED_ACTION = Get-GlobalVar "POLY_APP_SELECTED_ACTION_NAME"
$SELECTED_PLATFORM = Get-GlobalVar "POLY_APP_SELECTED_PLATFORM_NAME"

Pop-Location

if ([string]::IsNullOrEmpty($SELECTED_PROJECT_NAME)) {
    Write-Host "No project selected. Exiting."
    exit 0
}

Write-Host "==============================================================================="
Write-Host "  LAUNCHING PROJECT"
Write-Host "==============================================================================="
Write-Host ""
Write-Host "Project      : $SELECTED_PROJECT_NAME"
Write-Host "Type         : $PROJECT_TYPE"
Write-Host "Path         : $PROJECT_PATH"
Write-Host "Port         : $PROJECT_PORT"
Write-Host "Action       : $SELECTED_ACTION"
Write-Host "Platform     : $SELECTED_PLATFORM"
Write-Host ""

# Initialize effective action (may be converted later for Windows constraints)
$EFFECTIVE_ACTION = $SELECTED_ACTION

Write-Host "==============================================================================="
Write-Host ""

Push-Location $PROJECT_PATH

$env:PORT = $PROJECT_PORT
$env:NUXT_PORT = $PROJECT_PORT
$env:NUXT_HOST = "0.0.0.0"

switch ($PROJECT_TYPE) {
    "nuxt" {
        switch ($SELECTED_ACTION) {
            "debug" {
                if ($SELECTED_PLATFORM -eq "deploy_laravel") {
                    # Windows platform limitation: Cannot create systemd services
                    # Convert debug to build mode
                    $EFFECTIVE_ACTION = "build"

                    Write-Host ""
                    Write-Host "╔═══════════════════════════════════════════════════════════════════════════�? -ForegroundColor Yellow
                    Write-Host "�? ACTION CONVERSION (Windows Platform Limitation)                         �? -ForegroundColor Yellow
                    Write-Host "╚═══════════════════════════════════════════════════════════════════════════�? -ForegroundColor Yellow
                    Write-Host ""
                    Write-Host "  User selected action  : $SELECTED_ACTION" -ForegroundColor Cyan
                    Write-Host "  User selected platform: $SELECTED_PLATFORM" -ForegroundColor Cyan
                    Write-Host "  ────────────────────────────────────────────────────────────────────────"
                    Write-Host "  Windows constraint    : Cannot create systemd services" -ForegroundColor Yellow
                    Write-Host "  Required operation    : Build only (no deployment service)" -ForegroundColor Yellow
                    Write-Host "  ────────────────────────────────────────────────────────────────────────"
                    Write-Host "  Effective action      : $EFFECTIVE_ACTION" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "╚═══════════════════════════════════════════════════════════════════════════�? -ForegroundColor Yellow
                    Write-Host ""

                    # Run validation for build mode
                    if (-not (Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true)) {
                        Write-Host ""
                        Write-Host "Error: Validation failed. Cannot proceed with build." -ForegroundColor Red
                        Pop-Location
                        exit 1
                    }

                    Write-Host "Building Nuxt project..."
                    try { pnpm run build } catch { npm run build }
                } else {
                    # Normal debug mode
                    $EFFECTIVE_ACTION = $SELECTED_ACTION

                    # Run validation for debug mode
                    if (-not (Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true)) {
                        Write-Host ""
                        Write-Host "Error: Validation failed. Cannot start development server." -ForegroundColor Red
                        Pop-Location
                        exit 1
                    }

                    Write-Host "Starting Nuxt development server..."
                    try { pnpm run dev } catch { npm run dev }
                }
            }
            "build" {
                $EFFECTIVE_ACTION = $SELECTED_ACTION

                # Run validation for build mode
                if (-not (Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true)) {
                    Write-Host ""
                    Write-Host "Error: Validation failed. Cannot proceed with build." -ForegroundColor Red
                    Pop-Location
                    exit 1
                }

                Write-Host "Building Nuxt project..."
                try { pnpm run build } catch { npm run build }
            }
            "generate" {
                $EFFECTIVE_ACTION = $SELECTED_ACTION

                # Run validation for generate mode
                if (-not (Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true)) {
                    Write-Host ""
                    Write-Host "Error: Validation failed. Cannot proceed with static site generation." -ForegroundColor Red
                    Pop-Location
                    exit 1
                }

                Write-Host "Generating static site..."
                try { pnpm run generate } catch { npm run generate }
            }
        }
    }

    "react-native" {
        switch ($SELECTED_ACTION) {
            "debug" {
                switch ($SELECTED_PLATFORM) {
                    "android" {
                        Write-Host "Starting React Native on Android..."
                        try { pnpm run android } catch { npm run android }
                    }
                    "ios" {
                        Write-Host "React Native iOS not supported on Windows"
                    }
                    "web" {
                        Write-Host "Starting React Native web..."
                        try { pnpm run web } catch { npm run start }
                    }
                }
            }
            { $_ -in "build", "release" } {
                if ($SELECTED_PLATFORM -eq "android") {
                    Write-Host "Building React Native Android release..."
                    Push-Location android
                    .\gradlew.bat assembleRelease
                    Pop-Location
                }
            }
        }
    }

    "flutter" {
        switch ($SELECTED_ACTION) {
            "debug" {
                switch ($SELECTED_PLATFORM) {
                    "android" { flutter run -d android }
                    "web" { flutter run -d chrome }
                    "windows" { flutter run -d windows }
                }
            }
            { $_ -in "build", "release" } {
                switch ($SELECTED_PLATFORM) {
                    "android" { flutter build apk --release }
                    "web" { flutter build web --release }
                    "windows" { flutter build windows --release }
                }
            }
        }
    }

    "laravel" {
        Write-Host "Starting Laravel development server..."
        php artisan serve --host=0.0.0.0 --port=$PROJECT_PORT
    }

    { $_ -in "react", "vue", "vite" } {
        switch ($SELECTED_ACTION) {
            "debug" {
                if ($SELECTED_PLATFORM -eq "deploy_laravel") {
                    # Windows platform limitation: Cannot create systemd services
                    # Convert debug to build mode
                    $EFFECTIVE_ACTION = "build"

                    Write-Host ""
                    Write-Host "╔═══════════════════════════════════════════════════════════════════════════�? -ForegroundColor Yellow
                    Write-Host "�? ACTION CONVERSION (Windows Platform Limitation)                         �? -ForegroundColor Yellow
                    Write-Host "╚═══════════════════════════════════════════════════════════════════════════�? -ForegroundColor Yellow
                    Write-Host ""
                    Write-Host "  User selected action  : $SELECTED_ACTION" -ForegroundColor Cyan
                    Write-Host "  User selected platform: $SELECTED_PLATFORM" -ForegroundColor Cyan
                    Write-Host "  ────────────────────────────────────────────────────────────────────────"
                    Write-Host "  Windows constraint    : Cannot create systemd services" -ForegroundColor Yellow
                    Write-Host "  Required operation    : Build only (no deployment service)" -ForegroundColor Yellow
                    Write-Host "  ────────────────────────────────────────────────────────────────────────"
                    Write-Host "  Effective action      : $EFFECTIVE_ACTION" -ForegroundColor Green
                    Write-Host ""
                    Write-Host "╚═══════════════════════════════════════════════════════════════════════════�? -ForegroundColor Yellow
                    Write-Host ""

                    # Run validation for build mode
                    if (-not (Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true)) {
                        Write-Host ""
                        Write-Host "Error: Validation failed. Cannot proceed with build." -ForegroundColor Red
                        Pop-Location
                        exit 1
                    }

                    Write-Host "Building project..."
                    try { pnpm run build } catch { npm run build }
                } else {
                    # Normal debug mode
                    $EFFECTIVE_ACTION = $SELECTED_ACTION

                    # Run validation for debug mode
                    if (-not (Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true)) {
                        Write-Host ""
                        Write-Host "Error: Validation failed. Cannot start development server." -ForegroundColor Red
                        Pop-Location
                        exit 1
                    }

                    Write-Host "Starting development server..."
                    try { pnpm run dev } catch { npm run dev }
                }
            }
            "build" {
                $EFFECTIVE_ACTION = $SELECTED_ACTION

                # Run validation for build mode
                if (-not (Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true)) {
                    Write-Host ""
                    Write-Host "Error: Validation failed. Cannot proceed with build." -ForegroundColor Red
                    Pop-Location
                    exit 1
                }

                Write-Host "Building project..."
                try { pnpm run build } catch { npm run build }
            }
            "preview" {
                $EFFECTIVE_ACTION = $SELECTED_ACTION

                # Run validation for preview mode
                if (-not (Run-FullValidation $PROJECT_PATH $PROJECT_TYPE $SELECTED_PROJECT_NAME $EFFECTIVE_ACTION $true)) {
                    Write-Host ""
                    Write-Host "Error: Validation failed. Cannot start preview server." -ForegroundColor Red
                    Pop-Location
                    exit 1
                }

                Write-Host "Starting preview server..."
                try { pnpm run preview } catch { npm run preview }
            }
        }
    }

    default {
        Write-Host "Unknown project type: $PROJECT_TYPE" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}

Pop-Location

Write-Host ""
Write-Host "==============================================================================="
Write-Host "  PROJECT EXECUTION COMPLETE"
Write-Host "==============================================================================="
Write-Host ""
