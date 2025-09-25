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

# Flutter Bloom Phone Debug Script - English Version
# PARAMETERS: PROHIBITED - No parameters allowed for consistency and reliability
# Provides Android phone debugging with ADB device detection and wireless debugging support

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_ROOT = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent $SCRIPTS_ROOT
$WIN_COMMON_DIR = Join-Path $SCRIPTS_ROOT "win_common"
$COMMON_UTILITIES_PATH = Join-Path $WIN_COMMON_DIR "CommonUtilities.ps1"
$env:LANG = "en_US"
$env:LANGUAGE = "en_US"

# Import required modules
. (Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1")
. $COMMON_UTILITIES_PATH

Write-Host "[INFO] Flutter Bloom Phone Debug Launcher - English" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan

# Get selected app from file variables
# Read current selection from file variables
$selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue ""
$selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue "Debug"
$selectedPlatform = Get-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -DefaultValue "Android"

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






# Function to start phone debugging
function Start-PhoneDebug {
    Write-Host ""
    Write-Host "[INFO] Starting Phone Debug Mode..." -ForegroundColor Green
    Write-Host "====================================" -ForegroundColor Cyan

    # Get next available port for this app
    $assignedPort = Get-NextAvailablePort -AppName $selectedApp

    # Update packages first
    Invoke-FlutterPubGet

    # Show network URLs for wireless debugging
    Show-NetworkURLs -Port $assignedPort -Title "COPY URLs - Network URLs for wireless debugging" -ShowCopyHint $true
    
    # ADB Device Detection
    $adbDevices = Get-ADBDevices
    Show-ADBDeviceInfo -Devices $adbDevices

    if ($adbDevices.Count -eq 0) {
        Write-Host "[INFO] You can still use wireless debugging with URLs above" -ForegroundColor Green
    }
    
    Write-Host "[INFO] Starting Flutter for Android debugging..." -ForegroundColor Green
    
    try {
        Set-Location $PROJECT_ROOT
        
        if (-not (Test-Path "pubspec.yaml")) {
            Write-Host "[ERROR] pubspec.yaml not found in app directory" -ForegroundColor Red
            return
        }
        
        # Use entry file from file variables (set by start.ps1)
        $entryFile = $selectedEntryFile

        # Determine build mode based on selected action
        $buildMode = if ($selectedAction -eq "build") { "--release" } else { "--debug" }
        $modeDescription = if ($selectedAction -eq "build") { "Release" } else { "Debug" }

        if ($adbDevices.Count -gt 0) {
            Write-Host "[INFO] Launching on connected Android device..." -ForegroundColor Cyan
            Write-Host "[MODE] Running in $modeDescription mode" -ForegroundColor Yellow
            if ($selectedAction -eq "debug") {
                Write-Host "[DEBUG] Hot reload: press 'r'" -ForegroundColor Yellow
                Write-Host "[DEBUG] Hot restart: press 'R'" -ForegroundColor Yellow
                Write-Host "[DEBUG] Quit: press 'q'" -ForegroundColor Yellow
            }
            Write-Host "[INFO] Entry file: $entryFile" -ForegroundColor Cyan
            
            # Select device if multiple devices are connected
            $deviceId = if ($adbDevices.Count -eq 1) {
                $adbDevices[0].ID
            } else {
                Write-Host "[INFO] Multiple devices detected. Select device:" -ForegroundColor Yellow
                for ($i = 0; $i -lt $adbDevices.Count; $i++) {
                    $device = $adbDevices[$i]
                    Write-Host "  $($i + 1). $($device.ID) - $($device.Info)" -ForegroundColor White
                }
                do {
                    $selection = Read-Host "Enter device number (1-$($adbDevices.Count))"
                    try {
                        $index = [int]$selection - 1
                        if ($index -ge 0 -and $index -lt $adbDevices.Count) {
                            $adbDevices[$index].ID
                        } else {
                            Write-Host "[ERROR] Invalid selection. Please enter 1-$($adbDevices.Count)" -ForegroundColor Red
                            $null
                        }
                    } catch {
                        Write-Host "[ERROR] Invalid input. Please enter a number." -ForegroundColor Red
                        $null
                    }
                } while ($null -eq $deviceId)
            }
            
            Write-Host "[INFO] Using device: $deviceId" -ForegroundColor Cyan
            flutter run -d $deviceId $buildMode -t $entryFile
        }
        else {
            Write-Host "[INFO] No physical device detected, checking for emulator..." -ForegroundColor Cyan
            Write-Host "[MODE] Running in $modeDescription mode" -ForegroundColor Yellow
            if ($selectedAction -eq "debug") {
                Write-Host "[DEBUG] Hot reload: press 'r'" -ForegroundColor Yellow
                Write-Host "[DEBUG] Hot restart: press 'R'" -ForegroundColor Yellow
                Write-Host "[DEBUG] Quit: press 'q'" -ForegroundColor Yellow
            }
            Write-Host "[INFO] Entry file: $entryFile" -ForegroundColor Cyan
            flutter run $buildMode -t $entryFile
        }
    }
    catch {
        Write-Host "[ERROR] Failed to start phone debug: $_" -ForegroundColor Red
        Write-Host "[FALLBACK] Use the network URLs above for wireless debugging" -ForegroundColor Yellow
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

    # Direct phone debug execution - this script is dedicated to phone debugging
    Start-PhoneDebug
}
catch {
    Write-Host "[ERROR] Failed to initialize phone debug launcher: $_" -ForegroundColor Red
    exit 1
}