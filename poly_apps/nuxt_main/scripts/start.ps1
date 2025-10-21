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

# Nuxt Main Start Script - Interactive Launcher
# Starts nuxt_main application with interactive menu selection

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$FUNCTIONS_DIR = Join-Path $SCRIPT_DIR "functions"
$APP_DIR = Split-Path -Parent $SCRIPT_DIR

. (Join-Path $FUNCTIONS_DIR "AppScanner.ps1")
. (Join-Path $FUNCTIONS_DIR "MenuConfig.ps1")
. (Join-Path $FUNCTIONS_DIR "MenuState.ps1")
. (Join-Path $FUNCTIONS_DIR "InteractiveMenu.ps1")
. (Join-Path $FUNCTIONS_DIR "Prerequisites.ps1")
. (Join-Path $FUNCTIONS_DIR "ErrorHandler.ps1")
. (Join-Path $FUNCTIONS_DIR "GvarExchange.ps1")

Set-Location $APP_DIR

Test-Prerequisites -AppDirectory $APP_DIR

Initialize-AppConfigs -AppDirectory $APP_DIR
$appConfigs = Get-AppConfigs
$menuItems = @()

foreach ($key in $appConfigs.Keys | Sort-Object) {
    $menuItems += $appConfigs[$key]
}

$savedState = Get-MenuState

$stateChangedCallback = {
    param($index, $mode)
    Save-MenuState -SelectedIndex $index -Mode $mode
}

$menuResult = Show-InteractiveMenu -MenuItems $menuItems -InitialIndex $savedState.SelectedIndex -InitialMode $savedState.Mode -OnStateChange $stateChangedCallback

Save-MenuState -SelectedIndex $menuResult.SelectedIndex -Mode $menuResult.Mode

$selectedApp = $menuResult.SelectedApp
$mode = $menuResult.Mode

Set-Gvar -Key "SelectedApp" -Value $selectedApp.Name
Set-Gvar -Key "Mode" -Value $mode
Set-Gvar -Key "Port" -Value $selectedApp.Port
Set-Gvar -Key "AppDirectory" -Value $APP_DIR

$appNamespace = $selectedApp.Name
$themeLocation = "apps/app_$appNamespace/theme_app_$appNamespace/"
$storeLocation = "apps/app_$appNamespace/stores_app_$appNamespace/"
$constantsLocation = "apps/app_$appNamespace/constants_app_$appNamespace/"
$routerLocation = "apps/app_$appNamespace/router_app_$appNamespace/"

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  NUXT MULTI-APP LAUNCHER - APPLICATION STARTUP INFO" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "=== Application Selection ===" -ForegroundColor Yellow
Write-Host "  Selected App     : $($selectedApp.DisplayName)" -ForegroundColor Green
Write-Host "  Namespace        : $appNamespace" -ForegroundColor Green
Write-Host "  Mode             : $mode" -ForegroundColor Green
Write-Host "  Port             : $($selectedApp.Port)" -ForegroundColor Green
Write-Host "  Host             : 0.0.0.0 (accessible from network)" -ForegroundColor Green
Write-Host ""

Write-Host "=== Entry Point Configuration ===" -ForegroundColor Yellow
Write-Host "  Entry File       : pages/index.vue" -ForegroundColor Gray
Write-Host "  Source Template  : pages/index.$appNamespace.vue" -ForegroundColor Gray
Write-Host "  Switch Script    : scripts/switch-app-entry.js" -ForegroundColor Gray
Write-Host "  APP_ENTRY Env    : $appNamespace" -ForegroundColor Green
Write-Host ""

Write-Host "=== Architecture Locations ===" -ForegroundColor Yellow
Write-Host "  App Directory    : $APP_DIR" -ForegroundColor Gray
Write-Host "  Theme Location   : $themeLocation" -ForegroundColor Gray
Write-Host "  Store Location   : $storeLocation" -ForegroundColor Gray
Write-Host "  Constants        : $constantsLocation" -ForegroundColor Gray
Write-Host "  Router           : $routerLocation" -ForegroundColor Gray
Write-Host ""

Write-Host "=== Network Configuration ===" -ForegroundColor Yellow
$localUrl = "http://127.0.0.1:$($selectedApp.Port)"
Write-Host "  Local URL        : $localUrl" -ForegroundColor Cyan
Write-Host "  Network URL      : http://0.0.0.0:$($selectedApp.Port)" -ForegroundColor Cyan
Write-Host ""

Write-Host "=== Global Variables (Gvar Exchange) ===" -ForegroundColor Yellow
$allGvars = Get-AllGvars
if ($allGvars.PSObject.Properties.Count -gt 0) {
    foreach ($prop in $allGvars.PSObject.Properties) {
        Write-Host "  $($prop.Name) = $($prop.Value)" -ForegroundColor Gray
    }
}
else {
    Write-Host "  (Gvar system initialized)" -ForegroundColor Gray
}
Write-Host ""

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

$env:NUXT_HOST = "0.0.0.0"
$env:NUXT_PORT = $selectedApp.Port
$env:APP_ENTRY = $appNamespace

Write-Host "[INFO] Switching app entry point to $appNamespace..." -ForegroundColor Cyan
$switchScriptPath = Join-Path $SCRIPT_DIR "switch-app-entry.js"

Invoke-CommandWithErrorHandling -Command {
    node $switchScriptPath $appNamespace
} -CommandDescription "Switch app entry to $appNamespace" -PauseOnError $true

Write-Host "[SUCCESS] App entry switched successfully" -ForegroundColor Green
Write-Host ""

Start-Sleep -Milliseconds 500

try {
    Start-Process $localUrl
    Write-Host "[INFO] Opening browser at $localUrl" -ForegroundColor Green
}
catch {
    Write-Host "[WARNING] Failed to open browser automatically: $_" -ForegroundColor Yellow
}

Write-Host ""

if ($mode -eq "debug") {
    Write-Host "[INFO] Starting in debug mode..." -ForegroundColor Cyan
    Write-Host "[CMD] yarn $($selectedApp.DevCommand)" -ForegroundColor Gray
    Write-Host ""

    Invoke-CommandWithErrorHandling -Command {
        yarn $selectedApp.DevCommand
    } -CommandDescription "Start $($selectedApp.DisplayName) in debug mode" -PauseOnError $true
}
else {
    Write-Host "[INFO] Starting in build mode..." -ForegroundColor Cyan
    Write-Host "[CMD] yarn $($selectedApp.BuildCommand)" -ForegroundColor Gray
    Write-Host ""

    Invoke-CommandWithErrorHandling -Command {
        yarn $selectedApp.BuildCommand
    } -CommandDescription "Build $($selectedApp.DisplayName)" -PauseOnError $true
}
