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
    [string]$Mode = "debug",

    [Parameter()]
    [string[]]$MultiApps = @(),

    [switch]$MultiSelect
)

$ORIGINAL_WORKING_DIR = Get-Location
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$FUNCTIONS_DIR = Join-Path $SCRIPT_DIR "functions"
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$multiSelectionRequested = $false
$multiAppInputBuffer = @()
$multiSelectedApps = @()
$multiModeEnabled = $false
$factoryPlatformSegment = ""
$factoryRootPath = ""
$factoryTargetDir = ""
$deploymentScriptPaths = @()
$originalDirectoryRestored = $false
$isWindowsPlatform = $false
$factoryMirrorNoticeLines = @(
    "[NOTICE] Nuxt factory sync mirrors the source workspace to D:/programing/.build_dir/nuxt_factory.",
    "         When sharing build errors (especially with AI), convert mirrored paths back to",
    "         the original source under D:/programing/core_node/poly_apps/nuxt_main.",
    "         Example: D:/programing/.build_dir/nuxt_factory/_app_pymatrix/apps/app_pymatrix",
    "                  /stores_app_pymatrix/scriptStore.ts ->",
    "                  D:/programing/core_node/poly_apps/nuxt_main/apps/app_pymatrix",
    "                  /stores_app_pymatrix/scriptStore.ts"
)

if ([System.Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([System.Runtime.InteropServices.OSPlatform]::Windows)) {
    $isWindowsPlatform = $true
    $factoryPlatformSegment = "windows"
}
else {
    $isWindowsPlatform = $false
    $factoryPlatformSegment = "linux"
}

function Get-FactoryBaseDirectory {
    if ($env:NUXT_FACTORY_BASE_DIR -and (Test-Path $env:NUXT_FACTORY_BASE_DIR)) {
        try {
            return (Resolve-Path $env:NUXT_FACTORY_BASE_DIR).Path
        }
        catch {
            # Fall through to candidate list
        }
    }

    $candidates = @()

    if ($isWindowsPlatform) {
        $candidates += @("D:/programing", "D:/", "C:/programing")
    }
    else {
        $candidates += @("/mnt/d/programing", "/mnt/d", "/www")
    }

    if ($env:USERPROFILE) {
        $candidates += (Join-Path $env:USERPROFILE "nuxt_factory")
    }

    $currentLocation = (Get-Location).ProviderPath
    $candidates += $currentLocation

    foreach ($candidate in $candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
            try {
                return (Resolve-Path $candidate).Path
            }
            catch {
                continue
            }
        }
    }

    return $currentLocation
}

function Get-FactoryRootPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PlatformSegment
    )

    $baseDirectory = Get-FactoryBaseDirectory
    $buildSegment = if ($PlatformSegment -eq "linux") { "_build_dir" } else { ".build_dir" }
    $rootCandidate = Join-Path (Join-Path $baseDirectory $buildSegment) "nuxt_factory"

    if (-not (Test-Path $rootCandidate)) {
        New-Item -ItemType Directory -Path $rootCandidate -Force | Out-Null
    }

    return $rootCandidate
}

function Get-FactoryTargetDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FactoryRoot,
        [Parameter(Mandatory = $true)]
        [string]$PlatformSegment,
        [Parameter(Mandatory = $true)]
        [string]$Namespace
    )

    $appSegment = "_app_{0}" -f $Namespace
    if ($PlatformSegment -eq "linux") {
        $platformRoot = Join-Path $FactoryRoot "linux"
        if (-not (Test-Path $platformRoot)) {
            New-Item -ItemType Directory -Path $platformRoot -Force | Out-Null
        }
        $targetDirectory = Join-Path $platformRoot $appSegment
    }
    else {
        $targetDirectory = Join-Path $FactoryRoot $appSegment
    }

    if (-not (Test-Path $targetDirectory)) {
        New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
    }

    return $targetDirectory
}

function Restore-OriginalDirectory {
    param(
        [switch]$Silent
    )

    if ($script:originalDirectoryRestored) {
        return
    }

    $script:originalDirectoryRestored = $true

    if (-not $Silent) {
        Write-Host "" 
        Write-Host "===============================================================================" -ForegroundColor Cyan
        Write-Host "  RESTORING ORIGINAL WORKING DIRECTORY" -ForegroundColor Cyan
        Write-Host "===============================================================================" -ForegroundColor Cyan
        Write-Host "Original directory: $ORIGINAL_WORKING_DIR" -ForegroundColor Green
        Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
        Write-Host "Switching back to original directory..." -ForegroundColor Cyan
    }

    try {
        $targetPath = (Resolve-Path $ORIGINAL_WORKING_DIR).Path
        $currentPath = (Get-Location).ProviderPath
        if ($currentPath -ne $targetPath) {
            Set-Location $targetPath
        }
    }
    catch {
        if (-not $Silent) {
            Write-Host "[WARNING] Failed to restore directory: $($_.Exception.Message)" -ForegroundColor Yellow
        }
        return
    }

    if (-not $Silent) {
        Write-Host "Restored to: $(Get-Location)" -ForegroundColor Green
        Write-Host "===============================================================================" -ForegroundColor Cyan
    }
}

function New-DeployScripts {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Namespace,
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    $deployPsPath = Join-Path $TargetDirectory "deploy.ps1"
    $deployShPath = Join-Path $TargetDirectory "deploy.sh"

    $psTemplate = @'
param(
    [int]$Port = __PORT__,
    [string]$Host = "0.0.0.0"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$env:NUXT_PORT = $Port
$env:NUXT_HOST = $Host
$env:APP_ENTRY = "__APP__"

Write-Host "Starting Nuxt production server on $Host:$Port" -ForegroundColor Green
node ".output/server/index.mjs"
'@

    $psContent = $psTemplate.Replace("__PORT__", [string]$Port).Replace("__APP__", $Namespace)
    Set-Content -Path $deployPsPath -Value $psContent -Encoding UTF8

    $shTemplate = @'
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${1:-__PORT__}"
HOST="${2:-0.0.0.0}"

cd "$SCRIPT_DIR"
export NUXT_PORT="$PORT"
export NUXT_HOST="$HOST"
export APP_ENTRY="__APP__"

echo "Starting Nuxt production server on ${HOST}:${PORT}"
node .output/server/index.mjs
'@

    $shContent = $shTemplate.Replace("__PORT__", [string]$Port).Replace("__APP__", $Namespace)
    Set-Content -Path $deployShPath -Value $shContent -Encoding UTF8

    return @($deployPsPath, $deployShPath)
}

$null = Register-EngineEvent -SourceIdentifier PowerShell.Exiting -Action { Restore-OriginalDirectory -Silent } | Out-Null

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

foreach ($line in $factoryMirrorNoticeLines) {
    Write-Host $line -ForegroundColor Yellow
}
Write-Host "===============================================================================" -ForegroundColor Cyan

Initialize-AppConfigs -AppDirectory $APP_DIR
$appConfigs = Get-AppConfigs

function Get-AppTokensFromInput {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$RawValues
    )

    $tokens = @()

    foreach ($value in $RawValues) {
        if ([string]::IsNullOrWhiteSpace($value)) {
            continue
        }

        $parts = $value -split '[,; ]+'
        foreach ($part in $parts) {
            $trimmed = $part.Trim()
            if ($trimmed -ne "") {
                $tokens += $trimmed
            }
        }
    }

    return $tokens
}

function Prompt-MultiAppTokens {
    param(
        [Parameter(Mandatory = $true)]
        $AppConfigs
    )

    $sortedKeys = $AppConfigs.Keys | Sort-Object

    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host "  MULTI-APP DEBUG MODE - SELECTION" -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Enter app numbers or names separated by commas or spaces." -ForegroundColor Yellow
    Write-Host "Examples: '1,3,5' or 'pymatrix ittools admin'." -ForegroundColor Yellow
    Write-Host ""

    for ($i = 0; $i -lt $sortedKeys.Count; $i++) {
        $key = $sortedKeys[$i]
        $config = $AppConfigs[$key]
        $displayIndex = $i + 1
        Write-Host ("  [{0}] {1} ({2}) - Port {3}" -f $displayIndex, $config.DisplayName, $key, $config.Port) -ForegroundColor Cyan
    }

    Write-Host ""
    $input = Read-Host "Select one or more apps"

    if ([string]::IsNullOrWhiteSpace($input)) {
        return @()
    }

    return Get-AppTokensFromInput -RawValues @($input)
}

function Resolve-AppTokensToConfigs {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Tokens,
        [Parameter(Mandatory = $true)]
        $AppConfigs
    )

    $resolved = @()
    $deduplicationTable = @{}
    $sortedKeys = $AppConfigs.Keys | Sort-Object

    foreach ($token in $Tokens) {
        $trimmed = $token.Trim()
        if ($trimmed -eq "") {
            continue
        }

        $resolvedKey = $null

        if ($trimmed -match '^\d+$') {
            $indexValue = [int]$trimmed
            if ($indexValue -ge 1 -and $indexValue -le $sortedKeys.Count) {
                $resolvedKey = $sortedKeys[$indexValue - 1]
            }
        }

        if (-not $resolvedKey) {
            $lowerValue = $trimmed.ToLowerInvariant()
            foreach ($key in $AppConfigs.Keys) {
                if ($key.ToLowerInvariant() -eq $lowerValue) {
                    $resolvedKey = $key
                    break
                }

                $config = $AppConfigs[$key]
                if ($config.DisplayName -and $config.DisplayName.ToLowerInvariant() -eq $lowerValue) {
                    $resolvedKey = $key
                    break
                }
            }
        }

        if (-not $resolvedKey) {
            Write-Host ""
            Write-Host "===============================================================================" -ForegroundColor Red
            Write-Host "  ERROR: Unknown multi-app selection '$trimmed'" -ForegroundColor Red
            Write-Host "===============================================================================" -ForegroundColor Red
            exit 1
        }

        if (-not $deduplicationTable.ContainsKey($resolvedKey)) {
            $resolved += $AppConfigs[$resolvedKey]
            $deduplicationTable[$resolvedKey] = $true
        }
    }

    return $resolved
}

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
    Write-Host "  .\start.ps1 <app> debug        Direct launch in debug mode (factory sync)" -ForegroundColor White
    Write-Host "  .\start.ps1 <app> build        Direct launch in build mode" -ForegroundColor White
    Write-Host "  .\start.ps1 list               List available apps" -ForegroundColor White
    Write-Host "  .\start.ps1 help               Show this help" -ForegroundColor White
    Write-Host "  .\start.ps1 -MultiSelect       Interactive multi-app debug selection" -ForegroundColor White
    Write-Host "  .\start.ps1 -MultiApps a,b     Launch multiple apps in debug mode" -ForegroundColor White
    Write-Host "  .\start.ps1 multi a,b          Shortcut to multi-app debug mode" -ForegroundColor White
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
    Write-Host "  .\start.ps1 -MultiApps pymatrix,ittools    Debug multiple apps together" -ForegroundColor White
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

$multiCommandKeywords = @("multi", "multi-debug", "--multi", "-multi")

if ($MultiSelect.IsPresent) {
    $multiSelectionRequested = $true
}

if ($MultiApps.Count -gt 0) {
    $multiSelectionRequested = $true
    $multiAppInputBuffer += $MultiApps
}

if ($AppName -and $AppName.Trim() -ne "") {
    $normalizedAppName = $AppName.Trim()
    $lowerAppName = $normalizedAppName.ToLowerInvariant()

    if ($multiCommandKeywords -contains $lowerAppName) {
        $multiSelectionRequested = $true
        $AppName = ""
    }
    elseif ($normalizedAppName -match ",") {
        $multiSelectionRequested = $true
        $multiAppInputBuffer += $normalizedAppName
        $AppName = ""
    }
}

if ($multiSelectionRequested) {
    if ($Mode -eq "build") {
        Write-Host ""
        Write-Host "===============================================================================" -ForegroundColor Red
        Write-Host "  ERROR: Multi-app mode only supports debug runs" -ForegroundColor Red
        Write-Host "===============================================================================" -ForegroundColor Red
        exit 1
    }

    if ($Mode -and $Mode -ne "debug" -and $Mode -ne "") {
        $multiAppInputBuffer += $Mode
        $Mode = "debug"
    }

    if ($AppName -and $AppName -ne "") {
        $multiAppInputBuffer += $AppName
        $AppName = ""
    }

    $multiAppTokens = Get-AppTokensFromInput -RawValues $multiAppInputBuffer

    if ($multiAppTokens.Count -eq 0) {
        $multiAppTokens = Prompt-MultiAppTokens -AppConfigs $appConfigs
    }

    if ($multiAppTokens.Count -eq 0) {
        Write-Host ""
        Write-Host "===============================================================================" -ForegroundColor Red
        Write-Host "  ERROR: No applications selected for multi-app debug mode" -ForegroundColor Red
        Write-Host "===============================================================================" -ForegroundColor Red
        exit 1
    }

    $multiSelectedApps = Resolve-AppTokensToConfigs -Tokens $multiAppTokens -AppConfigs $appConfigs

    if ($multiSelectedApps.Count -eq 0) {
        Write-Host ""
        Write-Host "===============================================================================" -ForegroundColor Red
        Write-Host "  ERROR: Failed to resolve multi-app selections" -ForegroundColor Red
        Write-Host "===============================================================================" -ForegroundColor Red
        exit 1
    }

    $multiModeEnabled = $true
    $selectedApp = $multiSelectedApps[0]
    $mode = "debug"

    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host "  MULTI-APP DEBUG MODE ACTIVATED" -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Green
}

if ($multiModeEnabled) {
    $multiAppNamesString = ($multiSelectedApps | ForEach-Object { $_.Name }) -join ","
}
else {
    $multiAppNamesString = ""
}

if (-not $multiModeEnabled -and $Mode -ne "debug" -and $Mode -ne "build" -and $Mode -ne "") {
    Write-Host ""
    Write-Host "ERROR: Invalid mode '$Mode'. Must be 'debug' or 'build'." -ForegroundColor Red
    Write-Host "Use '.\start.ps1 help' for usage information." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Determine if using command-line mode or interactive mode
$useCommandLineMode = $false

if (-not $multiModeEnabled) {
    $selectedApp = $null
    if ($Mode -and $Mode -ne "") {
        $mode = $Mode
    }
    else {
        $mode = "debug"
    }

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
}
else {
    $useCommandLineMode = $true
    $mode = "debug"
}

Set-Gvar -Key "SelectedApp" -Value $selectedApp.Name
Set-Gvar -Key "Mode" -Value $mode
Set-Gvar -Key "Port" -Value $selectedApp.Port
Set-Gvar -Key "AppDirectory" -Value $APP_DIR

if ($multiModeEnabled) {
    Set-Gvar -Key "SelectedApps" -Value $multiAppNamesString
    Set-Gvar -Key "SelectedAppCount" -Value $multiSelectedApps.Count
    Set-Gvar -Key "MultiAppMode" -Value $true
}
else {
    Set-Gvar -Key "SelectedApps" -Value $selectedApp.Name
    Set-Gvar -Key "SelectedAppCount" -Value 1
    Set-Gvar -Key "MultiAppMode" -Value $false
}

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

if ($multiModeEnabled) {
    Write-Host "=== Multi-App Debug Selection ===" -ForegroundColor Yellow
    $multiDisplayIndex = 1
    foreach ($multiApp in $multiSelectedApps) {
        $multiUrl = "http://127.0.0.1:$($multiApp.Port)"
        Write-Host ("  [{0}] {1} | Namespace: {2} | Port: {3} | URL: {4}" -f $multiDisplayIndex, $multiApp.DisplayName, $multiApp.Name, $multiApp.Port, $multiUrl) -ForegroundColor Gray
        $multiDisplayIndex += 1
    }
    Write-Host ""
}

Write-Host "=== Entry Point Configuration ===" -ForegroundColor Yellow
Write-Host "  Entry File       : pages/index.vue" -ForegroundColor Gray
Write-Host "  Source Template  : pages/index.$appNamespace.vue" -ForegroundColor Gray
Write-Host "  Switch Script    : scripts/switch-app-entry.js" -ForegroundColor Gray
Write-Host "  Factory Sync     : scripts/switch-app-entry-plus.js" -ForegroundColor Gray
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
if ($multiModeEnabled) {
    $env:MULTI_APP_ENTRIES = $multiAppNamesString
}
elseif ($env:MULTI_APP_ENTRIES) {
    Remove-Item Env:MULTI_APP_ENTRIES -ErrorAction SilentlyContinue
}

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

if ($multiModeEnabled) {
    foreach ($multiApp in $multiSelectedApps) {
        $multiLocalUrl = "http://127.0.0.1:$($multiApp.Port)"
        try {
            Start-Process $multiLocalUrl
            Write-Host "[INFO] Opening browser at $multiLocalUrl for $($multiApp.DisplayName)" -ForegroundColor Green
        }
        catch {
            Write-Host "[WARNING] Failed to open browser for $($multiApp.DisplayName): $_" -ForegroundColor Yellow
        }
    }
}
else {
    try {
        Start-Process $localUrl
        Write-Host "[INFO] Opening browser at $localUrl" -ForegroundColor Green
    }
    catch {
        Write-Host "[WARNING] Failed to open browser automatically: $_" -ForegroundColor Yellow
    }
}

Write-Host ""

Write-Host "===============================================================================" -ForegroundColor Magenta
Write-Host "  STEP 2: STARTING APPLICATION SERVER" -ForegroundColor Magenta
Write-Host "===============================================================================" -ForegroundColor Magenta

if ($mode -eq "debug") {
    if ($multiModeEnabled) {
        Write-Host "[INFO] Mode: MULTI-APP DEBUG (Factory Sync + Dev Servers)" -ForegroundColor Cyan
        Write-Host "[INFO] Primary Port: $($selectedApp.Port)" -ForegroundColor Cyan
        Write-Host "[INFO] Host: 0.0.0.0 (Network Accessible)" -ForegroundColor Cyan
        $multiTargetSummary = ($multiSelectedApps | ForEach-Object { "$($_.Name):$($_.Port)" }) -join ", "
        Write-Host "[INFO] Targets: $multiTargetSummary" -ForegroundColor Cyan
        Write-Host ""

        $plusScriptPath = Join-Path $SCRIPT_DIR "switch-app-entry-plus.js"
        $plusCommand = "node `"$plusScriptPath`" --apps `"$multiAppNamesString`" --mode dev"

        Write-Host "[COMMAND TRACE] Environment Variables:" -ForegroundColor Yellow
        Write-Host "  > `$env:NUXT_PORT = $($selectedApp.Port)" -ForegroundColor White
        Write-Host "  > `$env:NUXT_HOST = 0.0.0.0" -ForegroundColor White
        Write-Host "  > `$env:APP_ENTRY = $appNamespace" -ForegroundColor White
        Write-Host "  > `$env:MULTI_APP_ENTRIES = $multiAppNamesString" -ForegroundColor White
        Write-Host ""
        Write-Host "[COMMAND TRACE] Executing Multi-App Factory Sync:" -ForegroundColor Yellow
        Write-Host "  > $plusCommand" -ForegroundColor White
        Write-Host ""
        Write-Host "[INFO] switch-app-entry-plus.js will:" -ForegroundColor Green
        Write-Host "  - Mirror the repository into dedicated workspaces per app" -ForegroundColor Gray
        Write-Host "  - Keep every workspace in sync via a shared watcher" -ForegroundColor Gray
        Write-Host "  - Launch pnpm dev commands for each selected app" -ForegroundColor Gray
        Write-Host "===============================================================================" -ForegroundColor Magenta
        Write-Host ""

        Invoke-CommandWithErrorHandling -Command {
            $env:NUXT_PORT = $selectedApp.Port
            $env:NUXT_HOST = "0.0.0.0"
            $env:APP_ENTRY = $appNamespace
            $env:MULTI_APP_ENTRIES = $multiAppNamesString
            Write-Host "[EXEC] node $plusScriptPath --apps $multiAppNamesString --mode dev" -ForegroundColor DarkYellow
            node $plusScriptPath --apps $multiAppNamesString --mode dev
        } -CommandDescription "Start multi-app factory sync sessions" -PauseOnError $true
    }
    else {
        Write-Host "[INFO] Mode: DEBUG (Factory Sync + Dev Server)" -ForegroundColor Cyan
        Write-Host "[INFO] Port: $($selectedApp.Port)" -ForegroundColor Cyan
        Write-Host "[INFO] Host: 0.0.0.0 (Network Accessible)" -ForegroundColor Cyan
        Write-Host ""

        $plusScriptPath = Join-Path $SCRIPT_DIR "switch-app-entry-plus.js"
        $plusCommand = "node `"$plusScriptPath`" $appNamespace --mode dev"

        Write-Host "[COMMAND TRACE] Environment Variables:" -ForegroundColor Yellow
        Write-Host "  > `$env:NUXT_PORT = $($selectedApp.Port)" -ForegroundColor White
        Write-Host "  > `$env:NUXT_HOST = 0.0.0.0" -ForegroundColor White
        Write-Host "  > `$env:APP_ENTRY = $appNamespace" -ForegroundColor White
        Write-Host ""
        Write-Host "[COMMAND TRACE] Executing Nuxt Factory Sync:" -ForegroundColor Yellow
        Write-Host "  > $plusCommand" -ForegroundColor White
        Write-Host ""
        Write-Host "[INFO] switch-app-entry-plus.js will:" -ForegroundColor Green
        Write-Host "  - Mirror the repo to the factory build directory" -ForegroundColor Gray
        Write-Host "  - Continuously sync changes every 2 seconds" -ForegroundColor Gray
        Write-Host "  - Launch pnpm $($selectedApp.DevCommand) from the mirrored workspace" -ForegroundColor Gray
        Write-Host "===============================================================================" -ForegroundColor Magenta
        Write-Host ""

        Invoke-CommandWithErrorHandling -Command {
            $env:NUXT_PORT = $selectedApp.Port
            $env:NUXT_HOST = "0.0.0.0"
            Write-Host "[EXEC] node $plusScriptPath $appNamespace --mode dev" -ForegroundColor DarkYellow
            node $plusScriptPath $appNamespace --mode dev
        } -CommandDescription "Start $($selectedApp.DisplayName) in debug mode via factory sync" -PauseOnError $true
    }
}
else {
    Write-Host "[INFO] Mode: BUILD (Factory Mirror + Production Build)" -ForegroundColor Cyan
    Write-Host "[INFO] Port: $($selectedApp.Port)" -ForegroundColor Cyan
    Write-Host ""

    $factoryRootPath = Get-FactoryRootPath -PlatformSegment $factoryPlatformSegment
    $factoryTargetDir = Get-FactoryTargetDirectory -FactoryRoot $factoryRootPath -PlatformSegment $factoryPlatformSegment -Namespace $appNamespace
    $plusScriptPath = Join-Path $SCRIPT_DIR "switch-app-entry-plus.js"

    Write-Host "[INFO] Factory Root     : $factoryRootPath" -ForegroundColor Gray
    Write-Host "[INFO] Target Directory : $factoryTargetDir" -ForegroundColor Gray
    Write-Host ""

    Write-Host "[COMMAND TRACE] Environment Variables:" -ForegroundColor Yellow
    Write-Host "  > `$env:NUXT_PORT = $($selectedApp.Port)" -ForegroundColor White
    Write-Host "  > `$env:NUXT_HOST = 0.0.0.0" -ForegroundColor White
    Write-Host "  > `$env:APP_ENTRY = $appNamespace" -ForegroundColor White
    Write-Host ""
    Write-Host "[COMMAND TRACE] Executing Factory Build:" -ForegroundColor Yellow
    Write-Host "  > node $plusScriptPath $appNamespace --mode build --factory-root $factoryRootPath --platform $factoryPlatformSegment" -ForegroundColor White
    Write-Host ""
    Write-Host "[INFO] switch-app-entry-plus.js will mirror the workspace, sync entry files, then run pnpm build from the mirrored tree." -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Magenta
    Write-Host ""

    Invoke-CommandWithErrorHandling -Command {
        $env:NUXT_PORT = $selectedApp.Port
        $env:NUXT_HOST = "0.0.0.0"
        Write-Host "[EXEC] node $plusScriptPath $appNamespace --mode build --factory-root $factoryRootPath --platform $factoryPlatformSegment" -ForegroundColor DarkYellow
        node $plusScriptPath $appNamespace --mode build --factory-root $factoryRootPath --platform $factoryPlatformSegment
    } -CommandDescription "Factory build for $($selectedApp.DisplayName)" -PauseOnError $true

    $outputPath = Join-Path $factoryTargetDir ".output"
    if (-not (Test-Path $outputPath)) {
        Write-Host "[WARNING] Build completed but '.output' was not found at $factoryTargetDir" -ForegroundColor Yellow
    }
    else {
        $deploymentScriptPaths = New-DeployScripts -TargetDirectory $factoryTargetDir -Namespace $appNamespace -Port $selectedApp.Port
        Write-Host "[INFO] Deploy scripts created for Nuxt production server:" -ForegroundColor Green
        foreach ($deployPath in $deploymentScriptPaths) {
            Write-Host "  - $deployPath" -ForegroundColor Cyan
        }
        Write-Host "[INFO] Run deploy.ps1 or deploy.sh to start the built app on port $($selectedApp.Port)." -ForegroundColor Green
    }
}

# Restore original working directory
Write-Host ""
Restore-OriginalDirectory
Write-Host ""
