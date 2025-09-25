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

# Dev Debug Main Script
# Simplified entry point for debug operations
# PARAMETERS: PROHIBITED - No parameters allowed for consistency and reliability

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_ROOT = Split-Path -Parent $SCRIPT_DIR
$WIN_COMMON_DIR = Join-Path $SCRIPTS_ROOT "win_common"

# Import Flutter Global Variables system first
. (Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1")

# Use global directory variables
$DEV_DEBUG_DIR = $Global:DEV_DEBUG_DIR
$BUILD_SCRIPTS_DIR = $Global:BUILD_SCRIPTS_DIR


# Helper functions have been moved to start.ps1


# Main execution
try {
    Write-Host "[MAIN-DEBUG] Flutter Bloom Dev Debug Main Script" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Cyan

    # Read variables directly
    $selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue ""
    $selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue "Debug"
    $selectedPlatform = Get-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -DefaultValue "Web"

    if (-not $selectedApp) {
        Write-Host "[MAIN-ERROR] No app selection found" -ForegroundColor Red
        Write-Host "[MAIN-INFO] Please run start.ps1 first to select an app" -ForegroundColor Yellow
        exit 1
    }

    Write-Host ""
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host "Flutter Bloom Dev Debug - Current Selection" -ForegroundColor Green
    Write-Host "===========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[MAIN-INFO] App:      $selectedApp" -ForegroundColor White
    Write-Host "[MAIN-INFO] Action:   $selectedAction" -ForegroundColor White
    Write-Host "[MAIN-INFO] Platform: $selectedPlatform" -ForegroundColor White
    Write-Host ""

    # Determine which debug script to call based on platform
    switch ($selectedPlatform.ToLower()) {
        "web" {
            $debugScript = Join-Path $DEV_DEBUG_DIR "startDebugByWeb.ps1"
            Write-Host "[MAIN-INFO] Calling Web Debug Script" -ForegroundColor Cyan
        }
        "android" {
            $debugScript = Join-Path $DEV_DEBUG_DIR "startDebugByPhone.ps1"
            Write-Host "[MAIN-INFO] Calling Android Debug Script" -ForegroundColor Cyan
        }
        "windows" {
            $debugScript = Join-Path $DEV_DEBUG_DIR "startDebugByWindows.ps1"
            Write-Host "[MAIN-INFO] Calling Windows Debug Script" -ForegroundColor Cyan
        }
        "ios" {
            $debugScript = Join-Path $DEV_DEBUG_DIR "startDebugByIOS.ps1"
            Write-Host "[MAIN-INFO] Calling iOS Debug Script" -ForegroundColor Cyan
        }
        default {
            $debugScript = Join-Path $DEV_DEBUG_DIR "startDebugByWeb.ps1"
            Write-Host "[MAIN-INFO] Calling Web Debug Script (default)" -ForegroundColor Cyan
        }
    }

    if (Test-Path $debugScript) {
        Write-Host "[MAIN-INFO] Executing: $debugScript" -ForegroundColor Yellow
        & $debugScript

        if ($LASTEXITCODE -ne 0) {
            Write-Host "[MAIN-ERROR] Debug script failed with exit code: $LASTEXITCODE" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "[MAIN-ERROR] Debug script not found: $debugScript" -ForegroundColor Red
        exit 1
    }

} catch {
    Write-Host "[ERROR] Script execution failed: $_" -ForegroundColor Red
    Write-Host "[DEBUG] Script path: $($MyInvocation.MyCommand.Path)" -ForegroundColor Yellow
    Write-Host "[DEBUG] Working directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
} finally {
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}