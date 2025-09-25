# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Flutter Web Debug Script
# Launches web debug with app selection support
# Author: Development Script System
# Version: 1.1

# Set UTF-8 encoding for the script
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_ROOT = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent $SCRIPTS_ROOT
$WIN_COMMON_DIR = Join-Path $SCRIPTS_ROOT "win_common"
$COMMON_UTILITIES_PATH = Join-Path $WIN_COMMON_DIR "CommonUtilities.ps1"

# Import required modules
. (Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1")
. $COMMON_UTILITIES_PATH



# Main web debug function
function Start-WebDebug {
    Write-Host ""
    Write-Host "[WEB-DEBUG] Starting Web Debug Mode..." -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Cyan

    # Get selected app from file variables
    # Check if temp directory exists and create if needed

    # Read current selection from file variables
    $selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue "" 
    $selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue "Debug"
    $selectedPlatform = Get-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -DefaultValue "Web"

    Write-Host "[WEB-DEBUG] Variables from file system:" -ForegroundColor Yellow
    Write-Host "  selectedApp: '$selectedApp'" -ForegroundColor White
    Write-Host "  selectedAction: '$selectedAction'" -ForegroundColor White
    Write-Host "  selectedPlatform: '$selectedPlatform'" -ForegroundColor White

    # Get Flutter apps with index mapping to derive entry file and port
    $apps = Get-FlutterAppsWithIndex
    Write-Host "[WEB-DEBUG] Get-FlutterAppsWithIndex returned $($apps.Count) apps:" -ForegroundColor Yellow
    foreach ($app in $apps) {
        Write-Host "  - $($app.name) (index: $($app.index), port: $($app.port))" -ForegroundColor White
    }

    $appInfo = $apps | Where-Object { $_.name -eq $selectedApp } | Select-Object -First 1

    if ($appInfo) {
        $selectedEntryFile = $appInfo.entryFile
        $debugPort = $appInfo.port.ToString()
        Write-Host "[WEB-DEBUG] App info derived from index mapping:" -ForegroundColor Green
        Write-Host "  Entry File: $selectedEntryFile" -ForegroundColor White
        Write-Host "  Debug Port: $debugPort" -ForegroundColor White
        Write-Host "  App Index: $($appInfo.index)" -ForegroundColor White
    } else {
        Write-Host "[WEB-ERROR] App '$selectedApp' not found in Flutter apps index mapping" -ForegroundColor Red
        $selectedEntryFile = ""
        $debugPort = "10000"
    }

    if ($selectedApp) {
        Write-Host "[WEB-INFO] Selected App: $selectedApp" -ForegroundColor Cyan
        Write-Host "[WEB-INFO] Selected Action: $selectedAction" -ForegroundColor Cyan
        Write-Host "[WEB-INFO] Selected Platform: $selectedPlatform" -ForegroundColor Cyan
        Write-Host "[WEB-INFO] Entry File: $selectedEntryFile" -ForegroundColor Cyan
        Write-Host "[WEB-INFO] Debug Port: $debugPort" -ForegroundColor Cyan
    } else {
        Write-Host "[WEB-WARN] No app selected, using default behavior" -ForegroundColor Yellow
        $selectedApp = "app_main"
        $selectedEntryFile = Join-Path $PROJECT_ROOT "lib\main.dart"
        $debugPort = "10000"
    }

    # Use the port from main.ps1
    $assignedPort = [int]$debugPort

    # Update packages first
    Invoke-FlutterPubGet

    # Display network URLs for testing
    Show-NetworkURLs -Port $assignedPort -Title "COPY URLs - Available Network URLs" -ShowCopyHint $true

    Write-ColorMessage -Message "URLs are ready for copying to test on different devices" -Type "Success"
    Write-ColorMessage -Message "Starting Flutter web server on port $assignedPort..." -Type "Info"
    Write-ColorMessage -Message "Chrome will open automatically, or manually copy URLs above" -Type "Info"

    try {
        Set-Location $PROJECT_ROOT

        if (-not (Test-Path "pubspec.yaml")) {
            Write-Host "[ERROR] pubspec.yaml not found in app directory" -ForegroundColor Red
            return
        }

        # Use entry file from main.ps1
        $entryFile = $selectedEntryFile

        # Determine build mode based on selected action
        $buildMode = if ($selectedAction -eq "build") { "--release" } else { "--debug" }
        $modeDescription = if ($selectedAction -eq "build") { "Release" } else { "Debug" }

        # Build and execute Flutter command
        $flutterCommand = Build-FlutterCommand -Action "run" -Platform "web-server" -EntryFile $entryFile -Port $assignedPort -HostName "0.0.0.0" -BuildMode $buildMode

        Write-ColorMessage -Message "Launching Flutter web server (accessible from network)..." -Type "Info"
        Write-ColorMessage -Message "Running in $modeDescription mode" -Type "Info"
        Write-ColorMessage -Message "Entry file: $entryFile" -Type "Info"
        Write-ColorMessage -Message $flutterCommand -Type "Command"

        try {
            Invoke-Expression $flutterCommand
        }
        catch {
            Write-ColorMessage -Message "Flutter command execution failed: $_" -Type "Error"
        }
        
        # Print cmd command to view results
        Write-Host ""
        Write-Host "[CMD] To view results, run: cmd" -ForegroundColor Yellow
        Write-Host "[INFO] Script execution completed. Press any key to continue..." -ForegroundColor Green
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
    catch {
        Write-Host "[ERROR] Failed to start web debug: $_" -ForegroundColor Red
    }
}

# Main execution
try {
    Write-Host "[INFO] Flutter Bloom Web Debug Script" -ForegroundColor Green

    # Change to project directory for context
    Set-Location $PROJECT_ROOT

    # Check if this is a Flutter project
    Assert-FlutterProject -ProjectPath $PROJECT_ROOT

    # Check if Flutter is available
    Assert-FlutterEnvironment

    # Start web debug
    Start-WebDebug
}
catch {
    Write-Host "[ERROR] Failed to initialize web debug launcher: $_" -ForegroundColor Red
    Write-Host "[CMD] To view results, run: cmd" -ForegroundColor Yellow
    Write-Host "[INFO] Press any key to continue..." -ForegroundColor Green
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}