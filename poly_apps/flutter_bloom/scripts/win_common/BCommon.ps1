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

# Common PowerShell Functions
# Shared utilities for the Flutter development script system
# Author: Development Script System
# Version: 1.0

# Import Gvar system and common utilities
. "$PSScriptRoot\FlutterGlobalVar.ps1"
. "$PSScriptRoot\CommonUtilities.ps1"
. "$PSScriptRoot\FlutterLogManager.ps1"

function Invoke-SafeCommand {
    <#
    .SYNOPSIS
    Execute command safely with debug mode support
    
    .PARAMETER Command
    Command to execute
    
    .PARAMETER Description
    Description of what the command does
    
    .PARAMETER WorkingDirectory
    Working directory for command execution
    #>
    
    param(
        [Parameter(Mandatory=$true)]
        [string]$Command,
        
        [Parameter(Mandatory=$true)]
        [string]$Description,
        
        [Parameter(Mandatory=$false)]
        [string]$WorkingDirectory = $null
    )
    
    if ($Global:DEBUG_MODE) {
        Write-Host "About to execute: $Description" -ForegroundColor Yellow
        $response = Read-Host "Continue? (Y/n)"
        if ($response -eq "n" -or $response -eq "N") {
            Write-Warning "Command execution cancelled by user"
            return $false
        }
    }
    
    try {
        if ($WorkingDirectory) {
            Push-Location $WorkingDirectory
        }
        
        Write-Host "Executing: $Command" -ForegroundColor Cyan
        
        $result = Invoke-Expression $Command
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Command completed successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Error "Command failed with exit code: $LASTEXITCODE"
            return $false
        }
    }
    catch {
        Write-Error "Error executing command: $($_.Exception.Message)"
        return $false
    }
    finally {
        if ($WorkingDirectory) {
            Pop-Location
        }
    }
}

function Invoke-PythonScript {
    <#
    .SYNOPSIS
    Execute Python script with proper error handling
    
    .PARAMETER ScriptPath
    Path to Python script
    
    .PARAMETER Arguments
    Arguments to pass to script
    
    .PARAMETER Description
    Description of what the script does
    #>
    
    param(
        [Parameter(Mandatory=$true)]
        [string]$ScriptPath,
        
        [Parameter(Mandatory=$false)]
        [string[]]$Arguments = @(),
        
        [Parameter(Mandatory=$true)]
        [string]$Description
    )
    
    if (-not (Test-Path $ScriptPath)) {
        Write-Error "Python script not found: $ScriptPath"
        return $false
    }
    
    $ArgumentString = $Arguments -join " "
    $Command = "python `"$ScriptPath`" $ArgumentString"
    
    return Invoke-SafeCommand -Command $Command -Description $Description
}

function Get-FlutterAppsMenu {
    <#
    .SYNOPSIS
    Get interactive menu for Flutter apps selection
    
    .PARAMETER IncludeAllOption
    Whether to include "All Apps" option
    #>
    
    param(
        [Parameter(Mandatory=$false)]
        [bool]$IncludeAllOption = $true
    )
    
    $apps = Get-FlutterAppsWithIndex
    
    if ($apps.Count -eq 0) {
        Write-Warning "No Flutter apps found"
        return $null
    }
    
    $menuItems = @()
    
    if ($IncludeAllOption) {
        $menuItems += @{
            "index" = 0
            "name" = "All Apps"
            "path" = ""
            "isMain" = $false
            "isAllOption" = $true
        }
    }
    
    for ($i = 0; $i -lt $apps.Count; $i++) {
        $app = $apps[$i]
        $menuItems += @{
            "menuIndex" = $i + 1  # Menu display index
            "name" = $app.name
            "path" = $app.path
            "isMain" = $app.isMain
            "isAllOption" = $false
            "appIndex" = $app.index      # App index for port allocation
            "port" = $app.port           # Debug port
            "entryFile" = $app.entryFile # Entry file path
        }
    }
    
    return $menuItems
}

function Show-FlutterAppsMenu {
    <#
    .SYNOPSIS
    Display Flutter apps menu and get user selection
    
    .PARAMETER MenuItems
    Menu items to display
    
    .PARAMETER Title
    Menu title
    #>
    
    param(
        [Parameter(Mandatory=$true)]
        [array]$MenuItems,
        
        [Parameter(Mandatory=$false)]
        [string]$Title = "Select Flutter App"
    )
    
    Write-Host ""
    Write-Host $Title -ForegroundColor Yellow
    Write-Host "-" * $Title.Length -ForegroundColor Yellow
    
    foreach ($item in $MenuItems) {
        $displayName = $item.name
        if ($item.isMain) {
            $displayName += " (Main - All Apps)"
        }
        if ($item.isAllOption) {
            $displayName += " (Process All)"
        }
        
        Write-Host "$($item.index). $displayName" -ForegroundColor White
    }
    
    Write-Host ""
}

function Get-UserMenuSelection {
    <#
    .SYNOPSIS
    Get user menu selection with validation
    
    .PARAMETER MenuItems
    Menu items to validate against
    
    .PARAMETER Prompt
    Prompt to display
    #>
    
    param(
        [Parameter(Mandatory=$true)]
        [array]$MenuItems,
        
        [Parameter(Mandatory=$false)]
        [string]$Prompt = "Enter your choice"
    )
    
    do {
        $selection = Read-Host "$Prompt (1-$($MenuItems.Count))"
        
        try {
            $selectedIndex = [int]$selection
            if ($selectedIndex -ge 1 -and $selectedIndex -le $MenuItems.Count) {
                return $MenuItems[$selectedIndex - 1]
            }
        }
        catch {
            # Invalid input
        }
        
        Write-Warning "Invalid selection. Please enter a number between 1 and $($MenuItems.Count)"
    } while ($true)
}

function Get-BuildActionMenu {
    <#
    .SYNOPSIS
    Get build action selection (Debug/Build)
    #>
    
    Write-Host ""
    Write-Host "Select Build Action" -ForegroundColor Yellow
    Write-Host "------------------" -ForegroundColor Yellow
    Write-Host "1. Debug (Run app in debug mode)"
    Write-Host "2. Build (Compile app for release)"
    Write-Host ""
    
    do {
        $selection = Read-Host "Enter your choice (1-2)"
        
        switch ($selection) {
            "1" { return "debug" }
            "2" { return "build" }
            default { Write-Warning "Invalid selection. Please enter 1 or 2" }
        }
    } while ($true)
}

# Removed Save-LastUserSelection and Get-LastUserSelection wrapper functions
# Use Get-GvarValue and Set-GvarValue directly for last user selection operations

function Test-FlutterEnvironment {
    <#
    .SYNOPSIS
    Test if Flutter environment is properly set up
    #>
    
    Write-Host "Checking Flutter environment..." -ForegroundColor Yellow
    
    # Check if Flutter is in PATH
    try {
        $flutterVersion = flutter --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Flutter is available" -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Error "✗ Flutter is not available in PATH"
        Write-Host "Please install Flutter and ensure it's in your PATH" -ForegroundColor Red
        return $false
    }
    
    return $false
}

function Get-FlutterCommand {
    <#
    .SYNOPSIS
    Build Flutter command based on action and platform

    .PARAMETER Action
    Build action (debug/build)

    .PARAMETER Platform
    Target platform (android/ios/web/windows/etc)

    .PARAMETER Port
    Port for web debugging (optional)

    .PARAMETER AppName
    App name for entry point
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$Action,

        [Parameter(Mandatory=$true)]
        [string]$Platform,

        [Parameter(Mandatory=$false)]
        [string]$Port = "",

        [Parameter(Mandatory=$true)]
        [string]$AppName
    )

    $entryPoint = "lib\apps\$AppName\main_app_$($AppName.Replace('app_', '')).dart"

    switch ($Action) {
        "debug" {
            switch ($Platform) {
                "web" {
                    if ($Port) {
                        return "flutter run -d chrome --web-port=$Port -t $entryPoint"
                    } else {
                        return "flutter run -d chrome -t $entryPoint"
                    }
                }
                "android" {
                    return "flutter run -d android -t $entryPoint"
                }
                "ios" {
                    return "flutter run -d ios -t $entryPoint"
                }
                "windows" {
                    return "flutter run -d windows -t $entryPoint"
                }
                default {
                    return "flutter run -t $entryPoint"
                }
            }
        }
        "build" {
            switch ($Platform) {
                "web" {
                    return "flutter build web -t $entryPoint"
                }
                "android" {
                    return "flutter build apk -t $entryPoint"
                }
                "ios" {
                    return "flutter build ios -t $entryPoint"
                }
                "windows" {
                    return "flutter build windows -t $entryPoint"
                }
                "all" {
                    # Return array of commands for all platforms
                    return @(
                        "flutter build web -t $entryPoint",
                        "flutter build apk -t $entryPoint",
                        "flutter build windows -t $entryPoint"
                    )
                }
                default {
                    return "flutter build apk -t $entryPoint"
                }
            }
        }
    }

    return ""
}

#region Build Script Functions (from BCommon.ps1)

function Write-Color {
    param(
        [Parameter(Mandatory=$true)][string]$Message,
        [ValidateSet('Yellow','Green','Red','White','Gray','Blue')][string]$Color = 'White'
    )
    switch ($Color) {
        'Yellow' { Write-Host $Message -ForegroundColor Yellow }
        'Green'  { Write-Host $Message -ForegroundColor Green }
        'Red'    { Write-Host $Message -ForegroundColor Red }
        'White'  { Write-Host $Message -ForegroundColor White }
        'Gray'   { Write-Host $Message -ForegroundColor Gray }
        'Blue'   { Write-Host $Message -ForegroundColor Blue }
        default  { Write-Host $Message }
    }
}

function Write-Success {
    param([string]$Message)
    Write-Color -Message $Message -Color Green
}

function Write-Info {
    param([string]$Message)
    if ($Message) {
        Write-Color -Message $Message -Color Blue
    }
}

function Write-Warning {
    param([string]$Message)
    Write-Color -Message $Message -Color Yellow
}

function Write-ErrorMsg {
    param([string]$Message)
    Write-Color -Message $Message -Color Red
}

function Write-Note {
    param([string]$Message)
    Write-Color -Message $Message -Color Gray
}

function Test-ValidAppName {
    param(
        [Parameter(Mandatory=$true)][string]$AppName
    )

    if ($AppName -in $Global:appNames) {
        return $true
    }
    return $false
}

function Get-TimestampNumber {
    # Returns the current Unix timestamp as an integer
    return [int][double]::Parse((Get-Date -UFormat %s))
}

function Get-ApkFileName {
    param([string]$AppName)
    $timestamp = Get-TimestampNumber
    return "$AppName`_$timestamp.apk"
}

function Copy-FileForce {
    param(
        [Parameter(Mandatory=$true)][string]$src,
        [Parameter(Mandatory=$true)][string]$out
    )
    Copy-Item -Path $src -Destination $out -Force
}

function Clean-StaticResourceString {
    param(
        [string]$str
    )
    if ($null -eq $str) { return "" }
    return $str.Trim().Replace("`n","").Replace("`r","")
}

# Removed Set-StaticResourceVar and Get-StaticResourceVar wrapper functions
# Use file operations directly or Set-FileVariable/Get-FileVariable from FlutterGlobalVar.ps1

function Invoke-DebugScriptSelection {
    <#
    .SYNOPSIS
    Handle debug script selection and execution based on Python variables

    .DESCRIPTION
    Reads variables saved by Python main.py and executes appropriate debug script
    Handles both debug and build modes with minimal output
    #>

    try {
        # Read variables saved by Python
        $selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue ""
        $selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue ""
        $selectedPlatform = Get-FileVariable -Name $Global:KEY_SELECTED_PLATFORM -DefaultValue ""
        $selectedEntryFile = Get-FileVariable -Name $Global:KEY_SELECTED_ENTRY_FILE -DefaultValue ""
        $appIndex = Get-FileVariable -Name $Global:KEY_APP_INDEX -DefaultValue ""
        $debugPort = Get-FileVariable -Name $Global:KEY_DEBUG_PORT -DefaultValue ""
        $scriptPath = Get-FileVariable -Name $Global:KEY_SCRIPT_PATH -DefaultValue ""

        # Debug: Print all loaded variables
        Write-Host "[DEBUG] Loaded variables from Python:" -ForegroundColor Magenta
        Write-Host "[DEBUG]   Selected App: '$selectedApp'" -ForegroundColor Magenta
        Write-Host "[DEBUG]   Selected Action: '$selectedAction'" -ForegroundColor Magenta
        Write-Host "[DEBUG]   Selected Platform: '$selectedPlatform'" -ForegroundColor Magenta
        Write-Host "[DEBUG]   Entry File: '$selectedEntryFile'" -ForegroundColor Magenta
        Write-Host "[DEBUG]   App Index: '$appIndex'" -ForegroundColor Magenta
        Write-Host "[DEBUG]   Debug Port: '$debugPort'" -ForegroundColor Magenta
        Write-Host "[DEBUG]   Script Path: '$scriptPath'" -ForegroundColor Magenta

        # Validate required variables
        if (-not $selectedApp -or -not $selectedAction) {
            Write-ErrorMsg "[ERROR] Missing required variables from Python selection"
            return $false
        }

        # Display minimal configuration
        Write-Host "[INFO] $selectedApp [$selectedAction/$selectedPlatform]" -ForegroundColor Cyan

        # Route based on action
        if ($selectedAction.ToLower() -eq "debug") {
            Write-Host "[DEBUG] Debug mode detected, checking script path..." -ForegroundColor Magenta
            Write-Host "[DEBUG] Script path exists check: $(Test-Path $scriptPath)" -ForegroundColor Magenta
            Write-Host "[DEBUG] Script path value: '$scriptPath'" -ForegroundColor Magenta

            if ($scriptPath -and (Test-Path $scriptPath)) {
                Write-Host "[INFO] Starting debug mode..." -ForegroundColor Yellow

                # Get debug script directory and execute from there
                $scriptDir = Split-Path -Parent $scriptPath
                $scriptName = Split-Path -Leaf $scriptPath

                Write-Host "[DEBUG] Script directory: '$scriptDir'" -ForegroundColor Magenta
                Write-Host "[DEBUG] Script name: '$scriptName'" -ForegroundColor Magenta

                # Change to project root (two levels up from script directory)
                $projectRoot = Split-Path -Parent (Split-Path -Parent $scriptDir)
                Write-Host "[DEBUG] Switching to project root: '$projectRoot'" -ForegroundColor Magenta

                Push-Location $projectRoot
                Write-Host "[DEBUG] Current working directory: $(Get-Location)" -ForegroundColor Magenta
                Write-Host "[DEBUG] About to execute: powershell -File $scriptPath" -ForegroundColor Magenta

                # Execute the debug script directly (not through new PowerShell process)
                . $scriptPath

                Pop-Location
                Write-Host "[DEBUG] Restored working directory: $(Get-Location)" -ForegroundColor Magenta

                Write-Success "[SUCCESS] Debug script execution completed"
            } else {
                Write-Host "[DEBUG] Script path validation failed:" -ForegroundColor Magenta
                Write-Host "[DEBUG]   Script path empty: $(-not $scriptPath)" -ForegroundColor Magenta
                Write-Host "[DEBUG]   Script path exists: $(if($scriptPath) { Test-Path $scriptPath } else { 'N/A' })" -ForegroundColor Magenta
                Write-ErrorMsg "[ERROR] Debug script not found: $scriptPath"
            }
        }
        elseif ($selectedAction.ToLower() -eq "build" -or $selectedAction.ToLower() -eq "release") {
            Write-Host "[INFO] Starting build mode..." -ForegroundColor Yellow
            Write-Host "[INFO] Platform: $selectedPlatform | Entry: $selectedEntryFile" -ForegroundColor Gray
            Write-Success "[SUCCESS] Build mode configured"
        }
        else {
            Write-ErrorMsg "[ERROR] Unknown action: $selectedAction"
        }

    } catch {
        Write-ErrorMsg "[ERROR] Debug script selection failed: $_"
    }
}


#endregion
