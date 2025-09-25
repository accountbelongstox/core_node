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

# Flutter Windows Debug Script
# Provides Windows desktop debugging capabilities for Flutter applications

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
$selectedPlatform = Get-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -DefaultValue "Windows"

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

# Function to check Windows development environment
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

# Function to start Windows debugging
function Start-WindowsDebug {
    Write-Host ""
    Write-Host "[INFO] Starting Windows Debug Mode..." -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Cyan
    
    # Get next available port for this app
    $assignedPort = Get-NextAvailablePort -AppName $selectedApp
    
    # Update packages first
    Invoke-FlutterPubGet
    
    Write-Host "[INFO] URLs are ready for copying to test on different devices" -ForegroundColor Green
    Write-Host "[INFO] Starting Flutter Windows desktop application..." -ForegroundColor Cyan
    Write-Host "[INFO] Application will launch in a new window" -ForegroundColor Yellow
    
    try {
        # Check if Windows platform is enabled
        $windowsDir = Join-Path $PROJECT_ROOT "windows"
        if (-not (Test-Path $windowsDir)) {
            Write-Host "[ERROR] Windows platform not enabled for this Flutter project" -ForegroundColor Red
            Write-Host "[SETUP] To enable Windows platform:" -ForegroundColor Yellow
            Write-Host "  flutter config --enable-windows-desktop" -ForegroundColor White
            Write-Host "  flutter create --platforms=windows ." -ForegroundColor White
            return
        }
        
        # Use entry file from file variables (set by start.ps1)
        $entryFile = $selectedEntryFile

        # Determine build mode based on selected action
        $buildMode = if ($selectedAction -eq "build") { "--release" } else { "--debug" }
        $modeDescription = if ($selectedAction -eq "build") { "Release" } else { "Debug" }

        Write-Host "[INFO] Launching Flutter Windows desktop application..." -ForegroundColor Green
        Write-Host "[MODE] Running in $modeDescription mode" -ForegroundColor Yellow
        if ($selectedAction -eq "debug") {
            Write-Host "[DEBUG] Hot reload: press 'r'" -ForegroundColor Yellow
            Write-Host "[DEBUG] Hot restart: press 'R'" -ForegroundColor Yellow
            Write-Host "[DEBUG] Quit: press 'q'" -ForegroundColor Yellow
        }
        Write-Host "[INFO] Entry file: $entryFile" -ForegroundColor Cyan

        flutter run -d windows $buildMode -t $entryFile
        
    } catch {
        Write-Host "[ERROR] Failed to start Windows application: $_" -ForegroundColor Red
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
    
    # Check Windows development environment
    if (-not (Test-WindowsEnvironment)) {
        Write-Host "[ERROR] Windows development environment not ready" -ForegroundColor Red
        Write-Host "[INFO] Please install required tools and try again" -ForegroundColor Yellow
        exit 1
    }
    
    # Check if platform is already selected from main launcher
    if ($selectedPlatform -eq "Windows" -or $selectedPlatform -eq "windows") {
        # Direct Windows debug execution
        Start-WindowsDebug
    } else {
        # Manual Windows debug execution
        Start-WindowsDebug
    }
}
catch {
    Write-Host "[ERROR] Failed to initialize Windows debug launcher: $_" -ForegroundColor Red
    exit 1
}
