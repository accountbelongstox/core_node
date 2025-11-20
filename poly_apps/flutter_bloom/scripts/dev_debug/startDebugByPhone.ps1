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

# Flutter Android Debug Script - Simplified for Android Testing
# Hardcoded for Debug/Android mode, reads essential variables only

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
. (Join-Path $WIN_COMMON_DIR "BCommon.ps1")
. (Join-Path $WIN_COMMON_DIR "SplashManager.ps1")

# Change to project root directory
Write-Host "[DEBUG] Script location: $SCRIPT_DIR" -ForegroundColor Magenta
Write-Host "[DEBUG] Switching to project root: $PROJECT_ROOT" -ForegroundColor Magenta
Set-Location $PROJECT_ROOT
Write-Host "[DEBUG] Current working directory: $(Get-Location)" -ForegroundColor Magenta

function Load-AndroidDebugVariables {
    """
    Load essential variables for Android debugging
    Can work with or without Python-saved variables
    """
    Write-Host "[INFO] Loading variables for Android debug..." -ForegroundColor Cyan

    # Load essential variables with sensible defaults
    $selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue "app_main"
    $entryFile = Get-FileVariable -Name $Global:KEY_SELECTED_ENTRY_FILE -DefaultValue "lib/apps/$selectedApp/main_app_$($selectedApp.Replace('app_', '')).dart"
    $appIndex = Get-FileVariable -Name $Global:KEY_APP_INDEX -DefaultValue "0"
    $debugPort = Get-FileVariable -Name $Global:KEY_DEBUG_PORT -DefaultValue "10000"

    # Display loaded configuration
    Write-Host "[INFO] Android Debug Configuration:" -ForegroundColor Green
    Write-Host "  App: $selectedApp" -ForegroundColor Yellow
    Write-Host "  Entry File: $entryFile" -ForegroundColor Yellow
    Write-Host "  App Index: $appIndex" -ForegroundColor Yellow
    Write-Host "  Debug Port: $debugPort" -ForegroundColor Yellow
    Write-Host "  Action: Debug (hardcoded)" -ForegroundColor Yellow
    Write-Host "  Platform: Android (hardcoded)" -ForegroundColor Yellow

    return @{
        App = $selectedApp
        Action = "Debug"
        Platform = "Android"
        EntryFile = $entryFile
        AppIndex = $appIndex
        DebugPort = $debugPort
    }
}

function Start-AndroidDebug {
    param($config)

    Write-Host "[INFO] Starting Android Debug Mode..." -ForegroundColor Green
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

    # Show network URLs for wireless debugging
    Show-NetworkURLs -Port $config.DebugPort -Title "COPY URLs - Network URLs for wireless debugging" -ShowCopyHint $true

    # ADB Device Detection
    $adbDevices = Get-ADBDevices
    Show-ADBDeviceInfo -Devices $adbDevices

    if ($adbDevices.Count -eq 0) {
        Write-Host "[INFO] You can still use wireless debugging with URLs above" -ForegroundColor Green
    }

    Write-Host "[INFO] Starting Flutter for Android debugging..." -ForegroundColor Green

    # Validate pubspec.yaml exists
    if (-not (Test-Path "pubspec.yaml")) {
        Write-Host "[ERROR] pubspec.yaml not found in project directory" -ForegroundColor Red
        return
    }

    # Use entry file from variables
    $entryFile = $config.EntryFile
    $buildMode = "--debug"  # Hardcoded for debug
    $modeDescription = "Debug"

    # Check pubspec status for information only
    try {
        $pubspecChanged = Test-PubspecChanged -ProjectRoot (Get-Location)
        if (-not $pubspecChanged) {
            Write-Host "[INFO] pubspec.yaml unchanged, using cached packages" -ForegroundColor Green
        }
    } catch {
        Write-Host "[DEBUG] Could not check pubspec status: $_" -ForegroundColor Magenta
    }

    if ($adbDevices.Count -gt 0) {
        Write-Host "[INFO] Launching on connected Android device..." -ForegroundColor Cyan
        Write-Host "[MODE] Running in $modeDescription mode" -ForegroundColor Yellow
        Write-Host "[DEBUG] Hot reload: press 'r'" -ForegroundColor Yellow
        Write-Host "[DEBUG] Hot restart: press 'R'" -ForegroundColor Yellow
        Write-Host "[DEBUG] Quit: press 'q'" -ForegroundColor Yellow
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
        & flutter run -d $deviceId $buildMode -t $entryFile
    }
    else {
        Write-Host "[INFO] No physical device detected, checking for emulator..." -ForegroundColor Cyan
        Write-Host "[MODE] Running in $modeDescription mode" -ForegroundColor Yellow
        Write-Host "[DEBUG] Hot reload: press 'r'" -ForegroundColor Yellow
        Write-Host "[DEBUG] Hot restart: press 'R'" -ForegroundColor Yellow
        Write-Host "[DEBUG] Quit: press 'q'" -ForegroundColor Yellow
        Write-Host "[INFO] Entry file: $entryFile" -ForegroundColor Cyan
        & flutter run $buildMode -t $entryFile
    }

    Write-Host "[INFO] Android debug completed" -ForegroundColor Green
}

# Main execution
try {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Flutter Bloom Android Debug Launcher" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Check if this is a Flutter project
    Assert-FlutterProject -ProjectPath $PROJECT_ROOT

    # Check if Flutter is available
    Assert-FlutterEnvironment

    # Load configuration for Android debugging
    $config = Load-AndroidDebugVariables

    # Start Android debug
    Start-AndroidDebug -config $config

} catch {
    Write-Host "[ERROR] An error occurred: $_" -ForegroundColor Red
    Write-Host "[DEBUG] Error details: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "[INFO] Android debug script completed" -ForegroundColor Green