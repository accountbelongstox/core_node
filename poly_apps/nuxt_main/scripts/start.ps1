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

# Nuxt Main Start Script - Parameterized Launcher
# Supports both command-line arguments and interactive menu selection
#
# Usage:
#   .\start.ps1                    # Interactive menu (original behavior)
#   .\start.ps1 <app>              # Direct launch in debug mode
#   .\start.ps1 <app> debug        # Direct launch in debug mode (explicit)
#   .\start.ps1 <app> build        # Direct launch in build mode
#   .\start.ps1 -h                 # Show help
#   .\start.ps1 -list              # List available apps
#
# Examples:
#   .\start.ps1 pymatrix           # Start pyMatrix in debug mode
#   .\start.ps1 ittools build      # Build ITTools
#   .\start.ps1 example            # Start Example app

# Declare all variables at the beginning
param(
    [Parameter(Position = 0)]
    [string]$AppName = "",

    [Parameter(Position = 1)]
    [string]$Mode = "debug"
)

$ORIGINAL_WORKING_DIR = Get-Location
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$FUNCTIONS_DIR = Join-Path $SCRIPT_DIR "functions"
$APP_DIR = Split-Path -Parent $SCRIPT_DIR

# Validate Mode parameter
if ($Mode -ne "debug" -and $Mode -ne "build" -and $Mode -ne "") {
    Write-Host ""
    Write-Host "ERROR: Invalid mode '$Mode'. Must be 'debug' or 'build'." -ForegroundColor Red
    Write-Host "Use '.\start.ps1 help' for usage information." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  NUXT MAIN APPLICATION LAUNCHER - INITIALIZATION" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[TRACE] Script Initialization:" -ForegroundColor Yellow
Write-Host "  > Original Working Directory: $ORIGINAL_WORKING_DIR" -ForegroundColor White
Write-Host "  > Script Directory: $SCRIPT_DIR" -ForegroundColor White
Write-Host "  > Functions Directory: $FUNCTIONS_DIR" -ForegroundColor White
Write-Host "  > Application Directory: $APP_DIR" -ForegroundColor White
Write-Host ""
Write-Host "[TRACE] Loading PowerShell Modules:" -ForegroundColor Yellow

. (Join-Path $FUNCTIONS_DIR "AppScanner.ps1")
Write-Host "  [OK] AppScanner.ps1" -ForegroundColor Green

. (Join-Path $FUNCTIONS_DIR "MenuConfig.ps1")
Write-Host "  [OK] MenuConfig.ps1" -ForegroundColor Green

. (Join-Path $FUNCTIONS_DIR "MenuState.ps1")
Write-Host "  [OK] MenuState.ps1" -ForegroundColor Green

. (Join-Path $FUNCTIONS_DIR "InteractiveMenu.ps1")
Write-Host "  [OK] InteractiveMenu.ps1" -ForegroundColor Green

. (Join-Path $FUNCTIONS_DIR "Prerequisites.ps1")
Write-Host "  [OK] Prerequisites.ps1" -ForegroundColor Green

. (Join-Path $FUNCTIONS_DIR "ErrorHandler.ps1")
Write-Host "  [OK] ErrorHandler.ps1" -ForegroundColor Green

. (Join-Path $FUNCTIONS_DIR "GvarExchange.ps1")
Write-Host "  [OK] GvarExchange.ps1" -ForegroundColor Green

Write-Host ""
Write-Host "[TRACE] Changing Directory to Application Root:" -ForegroundColor Yellow
Write-Host "  > Set-Location: $APP_DIR" -ForegroundColor White
Set-Location $APP_DIR
Write-Host "  [OK] Current Location: $(Get-Location)" -ForegroundColor Green

Write-Host ""
Write-Host "[TRACE] Checking Prerequisites..." -ForegroundColor Yellow
Test-Prerequisites -AppDirectory $APP_DIR
Write-Host "  [OK] Prerequisites verified" -ForegroundColor Green
Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan

Initialize-AppConfigs -AppDirectory $APP_DIR
$appConfigs = Get-AppConfigs

# Handle special commands
if ($AppName -eq "help" -or $AppName -eq "-h" -or $AppName -eq "--help") {
    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host "  NUXT MAIN LAUNCHER - HELP" -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\start.ps1                    Interactive menu (original behavior)" -ForegroundColor White
    Write-Host "  .\start.ps1 <app>              Direct launch in debug mode" -ForegroundColor White
    Write-Host "  .\start.ps1 <app> debug        Direct launch in debug mode (explicit)" -ForegroundColor White
    Write-Host "  .\start.ps1 <app> build        Direct launch in build mode" -ForegroundColor White
    Write-Host "  .\start.ps1 list               List available apps" -ForegroundColor White
    Write-Host "  .\start.ps1 help               Show this help" -ForegroundColor White
    Write-Host ""
    Write-Host "Available Apps:" -ForegroundColor Yellow
    foreach ($key in $appConfigs.Keys | Sort-Object) {
        $config = $appConfigs[$key]
        Write-Host "  - $key" -ForegroundColor Cyan -NoNewline
        Write-Host " ($($config.DisplayName) on port $($config.Port))" -ForegroundColor Gray
    }
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\start.ps1 pymatrix           Start pyMatrix in debug mode" -ForegroundColor White
    Write-Host "  .\start.ps1 ittools build      Build ITTools" -ForegroundColor White
    Write-Host "  .\start.ps1 example            Start Example app" -ForegroundColor White
    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Green
    exit 0
}

if ($AppName -eq "list" -or $AppName -eq "-list" -or $AppName -eq "--list") {
    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host "  AVAILABLE APPLICATIONS" -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host ""
    foreach ($key in $appConfigs.Keys | Sort-Object) {
        $config = $appConfigs[$key]
        Write-Host "  App Name     : " -ForegroundColor Yellow -NoNewline
        Write-Host $key -ForegroundColor Cyan
        Write-Host "  Display Name : " -ForegroundColor Yellow -NoNewline
        Write-Host $config.DisplayName -ForegroundColor White
        Write-Host "  Port         : " -ForegroundColor Yellow -NoNewline
        Write-Host $config.Port -ForegroundColor White
        Write-Host "  Dev Command  : " -ForegroundColor Yellow -NoNewline
        Write-Host $config.DevCommand -ForegroundColor Gray
        Write-Host "  Build Command: " -ForegroundColor Yellow -NoNewline
        Write-Host $config.BuildCommand -ForegroundColor Gray
        Write-Host ""
    }
    Write-Host "===============================================================================" -ForegroundColor Green
    exit 0
}

# Determine if using command-line mode or interactive mode
$useCommandLineMode = $false
$selectedApp = $null
$mode = "debug"

if ($AppName -and $AppName -ne "") {
    # Command-line mode
    if ($appConfigs.ContainsKey($AppName)) {
        $useCommandLineMode = $true
        $selectedApp = $appConfigs[$AppName]
        Write-Host ""
        Write-Host "===============================================================================" -ForegroundColor Green
        Write-Host "  COMMAND-LINE MODE ACTIVATED" -ForegroundColor Green
        Write-Host "===============================================================================" -ForegroundColor Green
        Write-Host "  Selected App: $($selectedApp.DisplayName)" -ForegroundColor Cyan
        Write-Host "  Mode: $Mode" -ForegroundColor Cyan
        Write-Host "===============================================================================" -ForegroundColor Green
        Write-Host ""
    }
    else {
        Write-Host ""
        Write-Host "===============================================================================" -ForegroundColor Red
        Write-Host "  ERROR: Unknown application '$AppName'" -ForegroundColor Red
        Write-Host "===============================================================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Available apps:" -ForegroundColor Yellow
        foreach ($key in $appConfigs.Keys | Sort-Object) {
            Write-Host "  - $key" -ForegroundColor Cyan
        }
        Write-Host ""
        Write-Host "Use '.\start.ps1 -list' to see detailed app information" -ForegroundColor Gray
        Write-Host "Use '.\start.ps1 -h' for help" -ForegroundColor Gray
        Write-Host ""
        exit 1
    }
}
else {
    # Interactive mode (original behavior)
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
}

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

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Magenta
Write-Host "  STEP 1: SWITCHING APP ENTRY POINT" -ForegroundColor Magenta
Write-Host "===============================================================================" -ForegroundColor Magenta
Write-Host "[INFO] Target App: $appNamespace" -ForegroundColor Cyan
Write-Host "[INFO] Switch Script: $SCRIPT_DIR\switch-app-entry.js" -ForegroundColor Cyan

$switchScriptPath = Join-Path $SCRIPT_DIR "switch-app-entry.js"
$switchCommand = "node `"$switchScriptPath`" $appNamespace"

Write-Host ""
Write-Host "[COMMAND TRACE] Executing:" -ForegroundColor Yellow
Write-Host "  > $switchCommand" -ForegroundColor White
Write-Host ""

Invoke-CommandWithErrorHandling -Command {
    node $switchScriptPath $appNamespace
} -CommandDescription "Switch app entry to $appNamespace" -PauseOnError $true

Write-Host ""
Write-Host "[SUCCESS] App entry switched successfully" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Magenta
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

Write-Host "===============================================================================" -ForegroundColor Magenta
Write-Host "  STEP 2: STARTING APPLICATION SERVER" -ForegroundColor Magenta
Write-Host "===============================================================================" -ForegroundColor Magenta

if ($mode -eq "debug") {
    Write-Host "[INFO] Mode: DEBUG (Development Server)" -ForegroundColor Cyan
    Write-Host "[INFO] Port: $($selectedApp.Port)" -ForegroundColor Cyan
    Write-Host "[INFO] Host: 0.0.0.0 (Network Accessible)" -ForegroundColor Cyan
    Write-Host ""

    $yarnCommand = "yarn $($selectedApp.DevCommand)"
    $fullCommand = "Set `$env:NUXT_PORT=$($selectedApp.Port); Set `$env:NUXT_HOST=`"0.0.0.0`"; $yarnCommand"

    Write-Host "[COMMAND TRACE] Environment Variables:" -ForegroundColor Yellow
    Write-Host "  > `$env:NUXT_PORT = $($selectedApp.Port)" -ForegroundColor White
    Write-Host "  > `$env:NUXT_HOST = 0.0.0.0" -ForegroundColor White
    Write-Host "  > `$env:APP_ENTRY = $appNamespace" -ForegroundColor White
    Write-Host ""
    Write-Host "[COMMAND TRACE] Executing Yarn Command:" -ForegroundColor Yellow
    Write-Host "  > $yarnCommand" -ForegroundColor White
    Write-Host ""
    Write-Host "[COMMAND TRACE] Package.json Script Resolution:" -ForegroundColor Yellow
    Write-Host "  > Script Name: $($selectedApp.DevCommand)" -ForegroundColor White
    Write-Host "  > Full Script: npm run switch-app $appNamespace && cross-env APP_ENTRY=$appNamespace nuxt dev" -ForegroundColor White
    Write-Host ""
    Write-Host "[INFO] Starting development server..." -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Magenta
    Write-Host ""

    Invoke-CommandWithErrorHandling -Command {
        $env:NUXT_PORT = $selectedApp.Port
        $env:NUXT_HOST = "0.0.0.0"
        Write-Host "[EXEC] yarn $($selectedApp.DevCommand)" -ForegroundColor DarkYellow
        yarn $selectedApp.DevCommand
    } -CommandDescription "Start $($selectedApp.DisplayName) in debug mode at port $($selectedApp.Port)" -PauseOnError $true
}
else {
    Write-Host "[INFO] Mode: BUILD (Production Build)" -ForegroundColor Cyan
    Write-Host "[INFO] Port: $($selectedApp.Port)" -ForegroundColor Cyan
    Write-Host ""

    $yarnCommand = "yarn $($selectedApp.BuildCommand)"

    Write-Host "[COMMAND TRACE] Environment Variables:" -ForegroundColor Yellow
    Write-Host "  > `$env:NUXT_PORT = $($selectedApp.Port)" -ForegroundColor White
    Write-Host "  > `$env:APP_ENTRY = $appNamespace" -ForegroundColor White
    Write-Host ""
    Write-Host "[COMMAND TRACE] Executing Yarn Command:" -ForegroundColor Yellow
    Write-Host "  > $yarnCommand" -ForegroundColor White
    Write-Host ""
    Write-Host "[COMMAND TRACE] Package.json Script Resolution:" -ForegroundColor Yellow
    Write-Host "  > Script Name: $($selectedApp.BuildCommand)" -ForegroundColor White
    Write-Host "  > Full Script: npm run switch-app $appNamespace && cross-env APP_ENTRY=$appNamespace nuxt build" -ForegroundColor White
    Write-Host ""
    Write-Host "[INFO] Starting build process..." -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Magenta
    Write-Host ""

    Invoke-CommandWithErrorHandling -Command {
        $env:NUXT_PORT = $selectedApp.Port
        Write-Host "[EXEC] yarn $($selectedApp.BuildCommand)" -ForegroundColor DarkYellow
        yarn $selectedApp.BuildCommand
    } -CommandDescription "Build $($selectedApp.DisplayName)" -PauseOnError $true
}

# Restore original working directory
Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  RESTORING ORIGINAL WORKING DIRECTORY" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "Original directory: $ORIGINAL_WORKING_DIR" -ForegroundColor Green
Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
Write-Host "Switching back to original directory..." -ForegroundColor Cyan

Set-Location $ORIGINAL_WORKING_DIR

Write-Host "Restored to: $(Get-Location)" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
