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

# Flutter Bloom Start Script with Interactive Menu
# PARAMETERS: PROHIBITED - No parameters allowed for consistency and reliability
# Uses menu system to select app and action, then calls appropriate debug script

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$WIN_COMMON_DIR = Join-Path $SCRIPT_DIR "win_common"

# Import required modules first to get global variables
. (Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1")
. (Join-Path $WIN_COMMON_DIR "FlutterMenuSystem.ps1")

# Use global directory variables
$PHONE_DEBUG_SCRIPT = Join-Path $Global:DEV_DEBUG_DIR "startDebugByPhone.ps1"
$WEB_DEBUG_SCRIPT = Join-Path $Global:DEV_DEBUG_DIR "startDebugByWeb.ps1"
$WINDOWS_DEBUG_SCRIPT = Join-Path $Global:DEV_DEBUG_DIR "startDebugByWindows.ps1"
$IOS_DEBUG_SCRIPT = Join-Path $Global:DEV_DEBUG_DIR "startDebugByIOS.ps1"

# Build script paths
$BUILD_MAIN_SCRIPT = Join-Path $Global:BUILD_SCRIPTS_DIR "build_main.ps1"

# Function to handle app and action selection
function Start-AppSelection {
    try {
        # Get available Flutter apps with index information
        $apps = Get-FlutterAppsWithIndex

        if ($apps.Count -eq 0) {
            Write-Warning "No Flutter apps found in the project"
            Write-Host "Press any key to continue..."
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            return $false
        }

        Write-Host "[START] Flutter Bloom App Selection" -ForegroundColor Green
        Write-Host "===================================" -ForegroundColor Cyan
        Write-Host ""

        # Get app selection with interactive toggle support (includes platform selection)
        $selectedApp = Get-AppSelectionWithToggle -Apps $apps

        # Skip build action and platform selection since they're now handled in the app selection
        $buildAction = Get-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_ACTION -DefaultValue "Debug"
        $platformName = Get-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_PLATFORM -DefaultValue "Web"
        $platform = $platformName.ToLower()

        Write-Host ""
        Write-Host "[START] Selection completed:" -ForegroundColor Green
        Write-Host "  App: $($selectedApp.name)" -ForegroundColor White
        Write-Host "  Action: $buildAction" -ForegroundColor White
        Write-Host "  Platform: $platform" -ForegroundColor White
        Write-Host ""

        # Update cached variables for consistency
        if ($selectedApp.name -ne "All" -and -not [string]::IsNullOrEmpty($selectedApp.name)) {
            Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_APP -Value $selectedApp.name
            Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_ACTION -Value $buildAction
            Set-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_PLATFORM -Value $platformName
        }

        return $true

    } catch {
        Write-Error "Error in app selection: $($_.Exception.Message)"
        return $false
    }
}

# Main execution
try {
    Write-Host "[START] Flutter Bloom Start Script" -ForegroundColor Green

    # Verify script files exist
    if (-not (Test-Path $PHONE_DEBUG_SCRIPT)) {
        Write-Host "[ERROR] Phone debug script not found: $PHONE_DEBUG_SCRIPT" -ForegroundColor Red
        exit 1
    }

    if (-not (Test-Path $WEB_DEBUG_SCRIPT)) {
        Write-Host "[ERROR] Web debug script not found: $WEB_DEBUG_SCRIPT" -ForegroundColor Red
        exit 1
    }

    # Check build script availability
    $BUILD_MAIN_SCRIPT = Join-Path $Global:BUILD_SCRIPTS_DIR "build_main.ps1"
    if (-not (Test-Path $BUILD_MAIN_SCRIPT)) {
        Write-Host "[ERROR] Build main script not found: $BUILD_MAIN_SCRIPT" -ForegroundColor Red
        exit 1
    }

    # Start app selection process
    if (-not (Start-AppSelection)) {
        Write-Host "[ERROR] App selection failed" -ForegroundColor Red
        exit 1
    }

    # Get stored selections - use file variables for consistency
    $selectedAppName = Get-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_APP -DefaultValue ""
    $selectedAction = Get-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_ACTION -DefaultValue "Debug"
    $selectedPlatform = Get-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_PLATFORM -DefaultValue "Web"

    # Also set file variables for backward compatibility
    if (-not [string]::IsNullOrEmpty($selectedAppName)) {
        Set-FileVariable -Name $Global:KEY_SELECTED_APP -Value $selectedAppName
        Set-FileVariable -Name $Global:KEY_SELECTED_ACTION -Value $selectedAction
        Set-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -Value $selectedPlatform
    } else {
        Write-Host "[ERROR] Selected app name is empty" -ForegroundColor Red
        exit 1
    }

    # Debug information
    Write-Host "[DEBUG] Final selection values:" -ForegroundColor Yellow
    Write-Host "  App: $selectedAppName" -ForegroundColor White
    Write-Host "  Action: $selectedAction" -ForegroundColor White
    Write-Host "  Platform: $selectedPlatform" -ForegroundColor White
    Write-Host ""

    # Store selection in file variables for dev_debug main script
    if (-not [string]::IsNullOrEmpty($selectedAppName)) {
        Set-FileVariable -Name $Global:KEY_APP_NAME -Value $selectedAppName
        Set-FileVariable -Name $Global:KEY_BUILD_ACTION -Value $selectedAction
        Set-FileVariable -Name $Global:KEY_BUILD_PLATFORM -Value $selectedPlatform
    }

    # Get app information using centralized function
    $appInfo = Get-AppInfoByName -AppName $selectedAppName

    if ($appInfo) {
        $entryFile = $appInfo.entryFile
        $appIndex = $appInfo.index
        $debugPort = $appInfo.port

        Write-Host "[START] App information loaded:" -ForegroundColor Green
        Write-Host "  Entry File: $entryFile" -ForegroundColor White
        Write-Host "  App Index: $appIndex" -ForegroundColor White
        Write-Host "  Debug Port: $debugPort" -ForegroundColor White
    } else {
        Write-Host "[ERROR] App '$selectedAppName' not found in Flutter apps" -ForegroundColor Red
        exit 1
    }

    # Set all computed variables
    Set-FileVariable -Name $Global:KEY_SELECTED_ENTRY_FILE -Value $entryFile
    Set-FileVariable -Name $Global:KEY_APP_INDEX -Value $appIndex.ToString()
    Set-FileVariable -Name $Global:KEY_DEBUG_PORT -Value $debugPort.ToString()

    Write-Host "[START] Selection and computed values stored in file variables" -ForegroundColor Green
    Write-Host "  App: $selectedAppName" -ForegroundColor White
    Write-Host "  Action: $selectedAction" -ForegroundColor White
    Write-Host "  Platform: $selectedPlatform" -ForegroundColor White
    Write-Host "  Entry File: $entryFile" -ForegroundColor White
    Write-Host "  Debug Port: $debugPort" -ForegroundColor White
    Write-Host ""

    # Determine which main script to call based on action
    $DEV_DEBUG_DIR = Join-Path $SCRIPT_DIR "dev_debug"
    $BUILD_SCRIPTS_DIR = Join-Path $SCRIPT_DIR "build_scripts"
    $DEV_DEBUG_MAIN = Join-Path $DEV_DEBUG_DIR "main.ps1"
    $BUILD_MAIN = Join-Path $BUILD_SCRIPTS_DIR "build_main.ps1"

    if ($selectedAction -eq "Build") {
        $scriptToCall = $BUILD_MAIN
        Write-Host "[START] Calling build_scripts main script for $selectedAction mode" -ForegroundColor Green
    } else {
        $scriptToCall = $DEV_DEBUG_MAIN
        Write-Host "[START] Calling dev_debug main script for $selectedAction mode" -ForegroundColor Green
    }

    Write-Host "Executing: $scriptToCall" -ForegroundColor Cyan
    Write-Host ""

    # Verify all Set-FileVariable calls BEFORE executing the script
    Write-Host "=== VERIFICATION: Reading back all Set-FileVariable values BEFORE script execution ===" -ForegroundColor Cyan
    Write-Host "KEY_SELECTED_APP: '$(Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_SELECTED_ACTION: '$(Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_SELECTED_PLATFORM: '$(Get-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_CURRENT_ACTIVE_APP: '$(Get-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_APP -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_CURRENT_ACTIVE_ACTION: '$(Get-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_ACTION -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_CURRENT_ACTIVE_PLATFORM: '$(Get-FileVariable -Name $Global:KEY_CURRENT_ACTIVE_PLATFORM -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_APP_NAME: '$(Get-FileVariable -Name $Global:KEY_APP_NAME -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_BUILD_ACTION: '$(Get-FileVariable -Name $Global:KEY_BUILD_ACTION -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_BUILD_PLATFORM: '$(Get-FileVariable -Name $Global:KEY_BUILD_PLATFORM -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_SELECTED_ENTRY_FILE: '$(Get-FileVariable -Name $Global:KEY_SELECTED_ENTRY_FILE -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_APP_INDEX: '$(Get-FileVariable -Name $Global:KEY_APP_INDEX -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "KEY_DEBUG_PORT: '$(Get-FileVariable -Name $Global:KEY_DEBUG_PORT -DefaultValue 'NOT_SET')'" -ForegroundColor White
    Write-Host "======================================================" -ForegroundColor Cyan
    Write-Host ""

    # Verify the selected script exists before execution
    if (-not (Test-Path $scriptToCall)) {
        Write-Host "[ERROR] Selected script not found: $scriptToCall" -ForegroundColor Red
        exit 1
    }

    # Execute the selected main script
    Write-Host "[START] Executing script: $scriptToCall" -ForegroundColor Cyan
    & $scriptToCall

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Script execution failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "[DEBUG] Script path: $scriptToCall" -ForegroundColor Yellow
        Write-Host "[DEBUG] Working directory: $(Get-Location)" -ForegroundColor Yellow
        Write-Host "[DEBUG] PowerShell version: $($PSVersionTable.PSVersion)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Press any key to continue..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        exit $LASTEXITCODE
    }

    Write-Host "[SUCCESS] Script execution completed successfully" -ForegroundColor Green

} catch {
    Write-Host "[ERROR] Failed to execute Flutter Bloom launcher: $_" -ForegroundColor Red
    Write-Host "[DEBUG] Exception details:" -ForegroundColor Yellow
    Write-Host "  Message: $($_.Exception.Message)" -ForegroundColor White
    Write-Host "  StackTrace: $($_.Exception.StackTrace)" -ForegroundColor White
    Write-Host "  ScriptStackTrace: $($_.ScriptStackTrace)" -ForegroundColor White
    Write-Host ""
    Write-Host "Press any key to continue..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
