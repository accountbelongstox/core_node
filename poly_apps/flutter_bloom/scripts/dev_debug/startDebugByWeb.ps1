# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Flutter Web Debug Script - Simplified for Web Testing
# Hardcoded for Debug/Web mode, reads essential variables only

# Set UTF-8 encoding for the script
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Set error action preference to continue on errors
$ErrorActionPreference = "Continue"

function Show-ErrorAndPause {
    param($ErrorMessage, $Exception = $null)
    
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "[ERROR] $ErrorMessage" -ForegroundColor Red
    if ($Exception) {
        Write-Host "[DEBUG] Exception: $($Exception.Message)" -ForegroundColor Yellow
        Write-Host "[DEBUG] Stack Trace: $($Exception.StackTrace)" -ForegroundColor Yellow
    }
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "[INFO] Press any key to continue..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_ROOT = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent $SCRIPTS_ROOT
$WIN_COMMON_DIR = Join-Path $SCRIPTS_ROOT "win_common"

# Import required modules
. (Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1")
. (Join-Path $WIN_COMMON_DIR "CommonUtilities.ps1")

# Change to project root directory
Write-Host "[DEBUG] Script location: $SCRIPT_DIR" -ForegroundColor Magenta
Write-Host "[DEBUG] Switching to project root: $PROJECT_ROOT" -ForegroundColor Magenta
Set-Location $PROJECT_ROOT
Write-Host "[DEBUG] Current working directory: $(Get-Location)" -ForegroundColor Magenta

function Load-WebDebugVariables {
    """
    Load essential variables for Web debugging
    Can work with or without Python-saved variables
    """
    Write-Host "[INFO] Loading variables for Web debug..." -ForegroundColor Cyan

    # Load essential variables with sensible defaults
    $selectedApp = Get-FileVariable -Name "SELECTED_APP" -DefaultValue "app_main"
    $entryFile = Get-FileVariable -Name "SELECTED_ENTRY_FILE" -DefaultValue "lib/apps/$selectedApp/main_app_$($selectedApp.Replace('app_', '')).dart"
    $appIndex = Get-FileVariable -Name "APP_INDEX" -DefaultValue "0"
    $debugPort = Get-FileVariable -Name "DEBUG_PORT" -DefaultValue "10000"

    # Display loaded configuration
    Write-Host "[INFO] Web Debug Configuration:" -ForegroundColor Green
    Write-Host "  App: $selectedApp" -ForegroundColor Yellow
    Write-Host "  Entry File: $entryFile" -ForegroundColor Yellow
    Write-Host "  App Index: $appIndex" -ForegroundColor Yellow
    Write-Host "  Debug Port: $debugPort" -ForegroundColor Yellow
    Write-Host "  Action: Debug (hardcoded)" -ForegroundColor Yellow
    Write-Host "  Platform: Web (hardcoded)" -ForegroundColor Yellow

    return @{
        App = $selectedApp
        Action = "Debug"
        Platform = "Web"
        EntryFile = $entryFile
        AppIndex = $appIndex
        DebugPort = $debugPort
    }
}

function Start-WebDebug {
    param($Config)

    Write-Host "[INFO] Starting Flutter Web Debug..." -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Validate Flutter installation
    if (-not (Get-Command "flutter" -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] Flutter not found in PATH" -ForegroundColor Red
        Write-Host "[INFO] Please install Flutter and add it to your PATH" -ForegroundColor Yellow
        return
    }

    Write-Host "[INFO] Project Root: $PROJECT_ROOT" -ForegroundColor Yellow
    Write-Host "[INFO] Entry File: $($Config.EntryFile)" -ForegroundColor Yellow
    Write-Host "[INFO] Debug Port: $($Config.DebugPort)" -ForegroundColor Yellow

    # Prepare Flutter command
    $flutterArgs = @(
        "run"
        "-d", "web-server"
        "--web-port", $Config.DebugPort
        "--web-hostname", "0.0.0.0"
    )

    # Add entry file if specified
    if ($Config.EntryFile -and $Config.EntryFile -ne "") {
        $flutterArgs += @("-t", $Config.EntryFile)
    }

    Write-Host "[INFO] Executing: flutter $($flutterArgs -join ' ')" -ForegroundColor Green
    Write-Host "[INFO] Web server will be available at: http://localhost:$($Config.DebugPort)" -ForegroundColor Green
    Write-Host "[INFO] Press Ctrl+C to stop the debug server" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan

    # Start Flutter web debug with real-time output and error handling
    try {
        flutter $flutterArgs
        Write-Host "[INFO] Flutter command completed successfully" -ForegroundColor Green
    } catch {
        Show-ErrorAndPause -ErrorMessage "Flutter command failed" -Exception $_.Exception
        Write-Host "[INFO] Continuing script execution to show error details..." -ForegroundColor Yellow
    }
}

# Main execution
try {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Flutter Bloom Web Debug Launcher" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Load configuration for Web debugging
    $config = Load-WebDebugVariables

    # Start web debug
    Start-WebDebug -Config $config

} catch {
    Show-ErrorAndPause -ErrorMessage "An error occurred during script execution" -Exception $_.Exception
} finally {
    Write-Host "[INFO] Script execution finished" -ForegroundColor Green
    Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

Write-Host "[INFO] Web debug script completed" -ForegroundColor Green