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

# Flutter iOS Debug Script - Simplified for iOS Testing
# Hardcoded for Debug/iOS mode, reads essential variables only

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

function Load-IOSDebugVariables {
    """
    Load essential variables for iOS debugging
    Can work with or without Python-saved variables
    """
    Write-Host "[INFO] Loading variables for iOS debug..." -ForegroundColor Cyan

    # Load essential variables with sensible defaults
    $selectedApp = Get-FileVariable -Name "SELECTED_APP" -DefaultValue "app_main"
    $entryFile = Get-FileVariable -Name "SELECTED_ENTRY_FILE" -DefaultValue "lib/apps/$selectedApp/main_app_$($selectedApp.Replace('app_', '')).dart"
    $appIndex = Get-FileVariable -Name "APP_INDEX" -DefaultValue "0"
    $debugPort = Get-FileVariable -Name "DEBUG_PORT" -DefaultValue "10000"

    # Display loaded configuration
    Write-Host "[INFO] iOS Debug Configuration:" -ForegroundColor Green
    Write-Host "  App: $selectedApp" -ForegroundColor Yellow
    Write-Host "  Entry File: $entryFile" -ForegroundColor Yellow
    Write-Host "  App Index: $appIndex" -ForegroundColor Yellow
    Write-Host "  Debug Port: $debugPort" -ForegroundColor Yellow
    Write-Host "  Action: Debug (hardcoded)" -ForegroundColor Yellow
    Write-Host "  Platform: iOS (hardcoded)" -ForegroundColor Yellow

    return @{
        App = $selectedApp
        Action = "Debug"
        Platform = "iOS"
        EntryFile = $entryFile
        AppIndex = $appIndex
        DebugPort = $debugPort
    }
}

function Test-IOSEnvironment {
    Write-Host "[INFO] Checking iOS development environment..." -ForegroundColor Cyan

    $issues = @()

    # Check if running on macOS
    if (-not $Global:IS_MACOS) {
        $issues += "iOS development requires macOS"
        Write-Host "[ERROR] iOS development is only supported on macOS" -ForegroundColor Red
        Write-Host "[INFO] For iOS development, you need:" -ForegroundColor Yellow
        Write-Host "  - macOS computer" -ForegroundColor White
        Write-Host "  - Xcode installed from App Store" -ForegroundColor White
        Write-Host "  - iOS Simulator or physical iOS device" -ForegroundColor White
        Write-Host "  - Apple Developer account (for device testing)" -ForegroundColor White
        return $false
    }

    # Check Xcode installation
    try {
        $xcodeVersion = & xcode-select --version 2>$null
        if (-not $xcodeVersion) {
            $issues += "Xcode command line tools not found"
            Write-Host "[SETUP] To install Xcode command line tools:" -ForegroundColor Yellow
            Write-Host "  xcode-select --install" -ForegroundColor White
        }
    } catch {
        $issues += "Xcode not properly configured"
    }

    # Check iOS Simulator
    try {
        $simulators = & xcrun simctl list devices available 2>$null
        if (-not $simulators) {
            $issues += "iOS Simulator not available"
        }
    } catch {
        $issues += "iOS Simulator not accessible"
    }

    if ($issues.Count -gt 0) {
        Write-Host "[ERROR] iOS development environment issues:" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "  - $issue" -ForegroundColor Red
        }
        return $false
    }

    Write-Host "[SUCCESS] iOS development environment ready" -ForegroundColor Green
    return $true
}

function Show-IOSDeviceMenu {
    Write-Host ""
    Write-Host "iOS Target Selection:" -ForegroundColor Yellow
    Write-Host "-" * 30 -ForegroundColor Yellow
    Write-Host "1. iOS Simulator" -ForegroundColor White
    Write-Host "2. Physical iOS Device" -ForegroundColor White
    Write-Host ""
}

function Start-IOSDebug {
    param($config)

    Write-Host "[INFO] Starting iOS Debug Mode..." -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Cyan

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

    Write-Host "[INFO] Starting Flutter iOS application..." -ForegroundColor Cyan
    Write-Host "[INFO] Application will launch in iOS Simulator or connected device" -ForegroundColor Yellow

    # Check if iOS platform is enabled
    $iosDir = Join-Path $PROJECT_ROOT "ios"
    if (-not (Test-Path $iosDir)) {
        Write-Host "[ERROR] iOS platform not enabled for this Flutter project" -ForegroundColor Red
        Write-Host "[SETUP] To enable iOS platform:" -ForegroundColor Yellow
        Write-Host "  flutter config --enable-ios" -ForegroundColor White
        Write-Host "  flutter create --platforms=ios ." -ForegroundColor White
        return
    }

    # Show device selection menu
    Show-IOSDeviceMenu
    $choice = Read-Host "Select target (1-2)"

    # Use entry file from variables
    $entryFile = $config.EntryFile
    $buildMode = "--debug"  # Hardcoded for debug
    $modeDescription = "Debug"

    Write-Host "[MODE] Running in $modeDescription mode" -ForegroundColor Yellow
    Write-Host "[DEBUG] Hot reload: press 'r'" -ForegroundColor Yellow
    Write-Host "[DEBUG] Hot restart: press 'R'" -ForegroundColor Yellow
    Write-Host "[DEBUG] Quit: press 'q'" -ForegroundColor Yellow
    Write-Host "[INFO] Entry file: $entryFile" -ForegroundColor Cyan

    switch ($choice) {
        "1" {
            # iOS Simulator
            Write-Host "[INFO] Launching on iOS Simulator..." -ForegroundColor Green
            & flutter run -d ios $buildMode -t $entryFile
        }
        "2" {
            # Physical device
            Write-Host "[INFO] Launching on physical iOS device..." -ForegroundColor Green
            Write-Host "[INFO] Make sure your iOS device is connected and trusted" -ForegroundColor Yellow
            & flutter run -d ios --device-id=auto $buildMode -t $entryFile
        }
        default {
            Write-Host "[INFO] Using default iOS Simulator..." -ForegroundColor Green
            & flutter run -d ios $buildMode -t $entryFile
        }
    }

    Write-Host "[INFO] iOS debug completed" -ForegroundColor Green
}

# Main execution
try {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Flutter Bloom iOS Debug Launcher" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Check if this is a Flutter project
    Assert-FlutterProject -ProjectPath $PROJECT_ROOT

    # Check if Flutter is available
    Assert-FlutterEnvironment

    # Check iOS development environment
    if (-not (Test-IOSEnvironment)) {
        Write-Host "[ERROR] iOS development environment not ready" -ForegroundColor Red
        Write-Host "[INFO] iOS development requires macOS with Xcode" -ForegroundColor Yellow
        exit 1
    }

    # Load configuration for iOS debugging
    $config = Load-IOSDebugVariables

    # Start iOS debug
    Start-IOSDebug -config $config

} catch {
    Write-Host "[ERROR] An error occurred: $_" -ForegroundColor Red
    Write-Host "[DEBUG] Error details: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "[INFO] iOS debug script completed" -ForegroundColor Green