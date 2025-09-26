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

# Flutter Windows Debug Script - Simplified for Windows Testing
# Hardcoded for Debug/Windows mode, reads essential variables only

# Set UTF-8 encoding for the script
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

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

function Load-WindowsDebugVariables {
    """
    Load essential variables for Windows debugging
    Can work with or without Python-saved variables
    """
    Write-Host "[INFO] Loading variables for Windows debug..." -ForegroundColor Cyan

    # Load essential variables with sensible defaults
    $selectedApp = Get-FileVariable -Name "SELECTED_APP" -DefaultValue "app_main"
    $entryFile = Get-FileVariable -Name "SELECTED_ENTRY_FILE" -DefaultValue "lib/apps/$selectedApp/main_app_$($selectedApp.Replace('app_', '')).dart"
    $appIndex = Get-FileVariable -Name "APP_INDEX" -DefaultValue "0"
    $debugPort = Get-FileVariable -Name "DEBUG_PORT" -DefaultValue "10000"

    # Display loaded configuration
    Write-Host "[INFO] Windows Debug Configuration:" -ForegroundColor Green
    Write-Host "  App: $selectedApp" -ForegroundColor Yellow
    Write-Host "  Entry File: $entryFile" -ForegroundColor Yellow
    Write-Host "  App Index: $appIndex" -ForegroundColor Yellow
    Write-Host "  Debug Port: $debugPort" -ForegroundColor Yellow
    Write-Host "  Action: Debug (hardcoded)" -ForegroundColor Yellow
    Write-Host "  Platform: Windows (hardcoded)" -ForegroundColor Yellow

    return @{
        App = $selectedApp
        Action = "Debug"
        Platform = "Windows"
        EntryFile = $entryFile
        AppIndex = $appIndex
        DebugPort = $debugPort
    }
}

function Test-WindowsEnvironment {
    Write-Host "[INFO] Checking Windows development environment..." -ForegroundColor Cyan

    $issues = @()

    # Check if Windows platform is supported
    if (-not $Global:IS_WINDOWS) {
        $issues += "Windows platform debugging requires Windows OS"
        return $false
    }

    # Check Visual Studio Build Tools
    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
    if (-not (Test-Path $vsWhere)) {
        $issues += "Visual Studio Build Tools not found"
        Write-Host "[SETUP] To install Visual Studio Build Tools:" -ForegroundColor Yellow
        Write-Host "1. Download Visual Studio Installer from https://visualstudio.microsoft.com/downloads/" -ForegroundColor White
        Write-Host "2. Install 'Build Tools for Visual Studio' or 'Visual Studio Community'" -ForegroundColor White
        Write-Host "3. Include 'C++ build tools' and 'Windows 10/11 SDK'" -ForegroundColor White
    }

    # Check Windows SDK
    $windowsKits = "${env:ProgramFiles(x86)}\Windows Kits\10"
    if (-not (Test-Path $windowsKits)) {
        $issues += "Windows 10/11 SDK not found"
        Write-Host "[SETUP] Windows SDK is required for Windows app development" -ForegroundColor Yellow
    }

    if ($issues.Count -gt 0) {
        Write-Host "[ERROR] Windows development environment issues:" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "  - $issue" -ForegroundColor Red
        }
        return $false
    }

    Write-Host "[SUCCESS] Windows development environment ready" -ForegroundColor Green
    return $true
}

function Start-WindowsDebug {
    param($config)

    Write-Host "[INFO] Starting Windows Debug Mode..." -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Cyan

    # Validate Flutter installation
    if (-not (Get-Command "flutter" -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] Flutter not found in PATH" -ForegroundColor Red
        Write-Host "[INFO] Please install Flutter and add it to your PATH" -ForegroundColor Yellow
        return
    }

    Write-Host "[INFO] Project Root: $PROJECT_ROOT" -ForegroundColor Yellow
    Write-Host "[INFO] Entry File: $($config.EntryFile)" -ForegroundColor Yellow
    Write-Host "[INFO] Debug Port: $($config.DebugPort)" -ForegroundColor Yellow

    # Update packages first
    Invoke-FlutterPubGet

    Write-Host "[INFO] URLs are ready for copying to test on different devices" -ForegroundColor Green
    Write-Host "[INFO] Starting Flutter Windows desktop application..." -ForegroundColor Cyan
    Write-Host "[INFO] Application will launch in a new window" -ForegroundColor Yellow

    # Check if Windows platform is enabled
    $windowsDir = Join-Path $PROJECT_ROOT "windows"
    if (-not (Test-Path $windowsDir)) {
        Write-Host "[ERROR] Windows platform not enabled for this Flutter project" -ForegroundColor Red
        Write-Host "[SETUP] To enable Windows platform:" -ForegroundColor Yellow
        Write-Host "  flutter config --enable-windows-desktop" -ForegroundColor White
        Write-Host "  flutter create --platforms=windows ." -ForegroundColor White
        return
    }

    # Use entry file from variables
    $entryFile = $config.EntryFile
    $buildMode = "--debug"  # Hardcoded for debug
    $modeDescription = "Debug"

    Write-Host "[INFO] Launching Flutter Windows desktop application..." -ForegroundColor Green
    Write-Host "[MODE] Running in $modeDescription mode" -ForegroundColor Yellow
    Write-Host "[DEBUG] Hot reload: press 'r'" -ForegroundColor Yellow
    Write-Host "[DEBUG] Hot restart: press 'R'" -ForegroundColor Yellow
    Write-Host "[DEBUG] Quit: press 'q'" -ForegroundColor Yellow
    Write-Host "[INFO] Entry file: $entryFile" -ForegroundColor Cyan

    & flutter run -d windows $buildMode -t $entryFile

    Write-Host "[INFO] Windows debug completed" -ForegroundColor Green
}

# Main execution
try {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Flutter Bloom Windows Debug Launcher" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Check if this is a Flutter project
    Assert-FlutterProject -ProjectPath $PROJECT_ROOT

    # Check if Flutter is available
    Assert-FlutterEnvironment

    # Check Windows development environment
    if (-not (Test-WindowsEnvironment)) {
        Write-Host "[ERROR] Windows development environment not ready" -ForegroundColor Red
        Write-Host "[INFO] Please install required tools and try again" -ForegroundColor Yellow
        exit 1
    }

    # Load configuration for Windows debugging
    $config = Load-WindowsDebugVariables

    # Start Windows debug
    Start-WindowsDebug -config $config

} catch {
    Write-Host "[ERROR] An error occurred: $_" -ForegroundColor Red
    Write-Host "[DEBUG] Error details: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "[INFO] Windows debug script completed" -ForegroundColor Green