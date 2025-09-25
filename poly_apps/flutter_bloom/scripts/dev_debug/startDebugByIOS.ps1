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

# Flutter iOS Debug Script
# Provides iOS debugging capabilities for Flutter applications

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_ROOT = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent $SCRIPTS_ROOT
$WIN_COMMON_DIR = Join-Path $SCRIPTS_ROOT "win_common"
$COMMON_UTILITIES_PATH = Join-Path $WIN_COMMON_DIR "CommonUtilities.ps1"

# Import required modules
. (Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1")
. $COMMON_UTILITIES_PATH

# Get selected app from file variables
$selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue ""
$selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue "Debug"
$selectedPlatform = Get-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -DefaultValue "iOS"

Write-Host "[DEBUG] Variables from file system:" -ForegroundColor Yellow
Write-Host "  selectedApp: '$selectedApp'" -ForegroundColor White
Write-Host "  selectedAction: '$selectedAction'" -ForegroundColor White
Write-Host "  selectedPlatform: '$selectedPlatform'" -ForegroundColor White

# Get Flutter apps with index mapping to derive entry file and port
$apps = Get-FlutterAppsWithIndex
Write-Host "[DEBUG] Get-FlutterAppsWithIndex returned $($apps.Count) apps:" -ForegroundColor Yellow
foreach ($app in $apps) {
    Write-Host "  - $($app.name) (index: $($app.index), port: $($app.port))" -ForegroundColor White
}

$appInfo = $apps | Where-Object { $_.name -eq $selectedApp } | Select-Object -First 1

if ($appInfo) {
    $selectedEntryFile = $appInfo.entryFile
    $debugPort = $appInfo.port
    Write-Host "[INFO] App info derived from index mapping:" -ForegroundColor Green
    Write-Host "  Entry File: $selectedEntryFile" -ForegroundColor White
    Write-Host "  Debug Port: $debugPort" -ForegroundColor White
    Write-Host "  App Index: $($appInfo.index)" -ForegroundColor White
} else {
    Write-Host "[ERROR] App '$selectedApp' not found in Flutter apps index mapping" -ForegroundColor Red
    $selectedEntryFile = Join-Path $PROJECT_ROOT "lib\main.dart"
    $debugPort = 10000
}

if ($selectedApp) {
    Write-Host "[INFO] Selected App: $selectedApp" -ForegroundColor Cyan
    Write-Host "[INFO] Selected Action: $selectedAction" -ForegroundColor Cyan
    Write-Host "[INFO] Selected Platform: $selectedPlatform" -ForegroundColor Cyan
} else {
    Write-Host "[WARN] No app selected, using default behavior" -ForegroundColor Yellow
    $selectedApp = "app_main"
}

# Function to check iOS development environment
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

# Function to show iOS device/simulator selection
function Show-IOSDeviceMenu {
    Write-Host ""
    Write-Host "iOS Target Selection:" -ForegroundColor Yellow
    Write-Host "-" * 30 -ForegroundColor Yellow
    Write-Host "1. iOS Simulator" -ForegroundColor White
    Write-Host "2. Physical iOS Device" -ForegroundColor White
    Write-Host ""
}

# Function to start iOS debugging
function Start-IOSDebug {
    Write-Host ""
    Write-Host "[INFO] Starting iOS Debug Mode..." -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Cyan
    
    # Get next available port for this app
    $assignedPort = Get-NextAvailablePort -AppName $selectedApp
    
    # Update packages first
    Invoke-FlutterPubGet
    
    Write-Host "[INFO] Starting Flutter iOS application..." -ForegroundColor Cyan
    Write-Host "[INFO] Application will launch in iOS Simulator or connected device" -ForegroundColor Yellow
    
    try {
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
        
        # Use entry file from file variables (set by start.ps1)
        $entryFile = $selectedEntryFile

        # Determine build mode based on selected action
        $buildMode = if ($selectedAction -eq "build") { "--release" } else { "--debug" }
        $modeDescription = if ($selectedAction -eq "build") { "Release" } else { "Debug" }

        Write-Host "[MODE] Running in $modeDescription mode" -ForegroundColor Yellow
        if ($selectedAction -eq "debug") {
            Write-Host "[DEBUG] Hot reload: press 'r'" -ForegroundColor Yellow
            Write-Host "[DEBUG] Hot restart: press 'R'" -ForegroundColor Yellow
            Write-Host "[DEBUG] Quit: press 'q'" -ForegroundColor Yellow
        }
        Write-Host "[INFO] Entry file: $entryFile" -ForegroundColor Cyan

        switch ($choice) {
            "1" {
                # iOS Simulator
                Write-Host "[INFO] Launching on iOS Simulator..." -ForegroundColor Green
                flutter run -d ios $buildMode -t $entryFile
            }
            "2" {
                # Physical device
                Write-Host "[INFO] Launching on physical iOS device..." -ForegroundColor Green
                Write-Host "[INFO] Make sure your iOS device is connected and trusted" -ForegroundColor Yellow
                flutter run -d ios --device-id=auto $buildMode -t $entryFile
            }
            default {
                Write-Host "[INFO] Using default iOS Simulator..." -ForegroundColor Green
                flutter run -d ios $buildMode -t $entryFile
            }
        }
        
    } catch {
        Write-Host "[ERROR] Failed to start iOS application: $_" -ForegroundColor Red
        Write-Host "[HELP] Common solutions:" -ForegroundColor Yellow
        Write-Host "  - Ensure Xcode is properly installed and configured" -ForegroundColor White
        Write-Host "  - Run 'flutter doctor' to check for issues" -ForegroundColor White
        Write-Host "  - For device testing, ensure device is connected and trusted" -ForegroundColor White
    }
}

# Main execution
try {
    # Change to app directory for context
    Set-Location $PROJECT_ROOT
    
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
    
    # Check if platform is already selected from main launcher
    if ($selectedPlatform -eq "iOS" -or $selectedPlatform -eq "ios") {
        # Direct iOS debug execution
        Start-IOSDebug
    } else {
        # Manual iOS debug execution
        Start-IOSDebug
    }
}
catch {
    Write-Host "[ERROR] Failed to initialize iOS debug launcher: $_" -ForegroundColor Red
    exit 1
}
