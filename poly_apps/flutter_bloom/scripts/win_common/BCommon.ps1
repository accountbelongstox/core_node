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

# Import Gvar system and common utilities (only if not already loaded)
if (-not (Get-Command -Name "Get-FileVariable" -ErrorAction SilentlyContinue)) {
    . "$PSScriptRoot\FlutterGlobalVar.ps1"
}
if (-not (Get-Command -Name "Test-PathSafe" -ErrorAction SilentlyContinue)) {
    . "$PSScriptRoot\CommonUtilities.ps1"
}
if (-not (Get-Command -Name "Write-LogMessage" -ErrorAction SilentlyContinue)) {
    . "$PSScriptRoot\FlutterLogManager.ps1"
}

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
            Write-Host "[OK] Flutter is available" -ForegroundColor Green
            return $true
        }
    }
    catch {
        Write-Error "[X] Flutter is not available in PATH"
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

function Test-IsDebugMode {
    <#
    .SYNOPSIS
    Check if current action is DEBUG mode

    .DESCRIPTION
    Reads the action variable and determines if it's debug mode
    Returns $true for debug, $false for build/release modes
    #>

    try {
        $selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue ""

        if (-not $selectedAction) {
            Write-Warning "[WARNING] No action selected, defaulting to debug mode"
            return $true
        }

        return ($selectedAction.ToLower() -eq "debug")
    }
    catch {
        Write-Warning "[WARNING] Error checking debug mode: $_"
        return $true  # Default to debug mode on error
    }
}

function Invoke-DebugMode {
    <#
    .SYNOPSIS
    Handle DEBUG mode execution based on Python variables

    .DESCRIPTION
    Reads variables saved by Python main.py and executes appropriate debug script
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

            # Import and run pre-debug splash update
            # Use PSScriptRoot which works correctly even when dot-sourced
            $splashManagerPath = Join-Path $PSScriptRoot "SplashManager.ps1"
            if (Test-Path $splashManagerPath) {
                Write-Host "[DEBUG] Loading SplashManager for pre-debug splash update" -ForegroundColor Magenta
                . $splashManagerPath

                # Run splash update before debug
                Write-Host "[INFO] Running pre-debug splash update..." -ForegroundColor Cyan
                $splashUpdateResult = Invoke-PreDebugSplashUpdate
                if ($splashUpdateResult) {
                    Write-Host "[SUCCESS] Pre-debug splash update completed" -ForegroundColor Green
                } else {
                    Write-Host "[WARNING] Pre-debug splash update failed, continuing with debug" -ForegroundColor Yellow
                }
            } else {
                Write-Host "[WARNING] SplashManager not found at: $splashManagerPath" -ForegroundColor Yellow
            }

            Write-Host "[DEBUG] About to execute: powershell -File $scriptPath" -ForegroundColor Magenta

            # Execute the debug script directly (not through new PowerShell process)
            . $scriptPath

            Pop-Location
            Write-Host "[DEBUG] Restored working directory: $(Get-Location)" -ForegroundColor Magenta

            Write-Success "[SUCCESS] Debug script execution completed"
            return $true
        } else {
            Write-Host "[DEBUG] Script path validation failed:" -ForegroundColor Magenta
            Write-Host "[DEBUG]   Script path empty: $(-not $scriptPath)" -ForegroundColor Magenta
            Write-Host "[DEBUG]   Script path exists: $(if($scriptPath) { Test-Path $scriptPath } else { 'N/A' })" -ForegroundColor Magenta
            Write-ErrorMsg "[ERROR] Debug script not found: $scriptPath"
            return $false
        }

    } catch {
        Write-ErrorMsg "[ERROR] Debug mode execution failed: $_"
        return $false
    }
}

function Invoke-BuildMode {
    <#
    .SYNOPSIS
    Handle BUILD mode execution based on step20 variables

    .DESCRIPTION
    Reads variables prepared by step20 compilation controller and executes build commands
    #>

    try {
        # Read variables saved by Python step20
        $selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue ""
        $selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue ""
        $compilationCommand = Get-FileVariable -Name $Global:KEY_COMPILATION_COMMAND -DefaultValue ""
        $buildRoot = Get-FileVariable -Name $Global:KEY_BUILD_ROOT -DefaultValue ""
        $buildOutputDir = Get-FileVariable -Name $Global:KEY_BUILD_OUTPUT_DIR -DefaultValue ""
        $apkOutputPath = Get-FileVariable -Name $Global:KEY_APK_OUTPUT_PATH -DefaultValue ""
        $compilationPlatform = Get-FileVariable -Name $Global:KEY_COMPILATION_PLATFORM -DefaultValue ""
        $cleanCommand = Get-FileVariable -Name $Global:KEY_CLEAN_COMMAND -DefaultValue ""
        $buildTimestamp = Get-FileVariable -Name $Global:KEY_BUILD_TIMESTAMP -DefaultValue ""
        $apkFileName = Get-FileVariable -Name $Global:KEY_APK_FILE_NAME -DefaultValue ""

        # Debug: Print all loaded variables
        Write-Host "[BUILD] Loaded variables from step20:" -ForegroundColor Green
        Write-Host "[BUILD]   Selected App: '$selectedApp'" -ForegroundColor Green
        Write-Host "[BUILD]   Selected Action: '$selectedAction'" -ForegroundColor Green
        Write-Host "[BUILD]   Compilation Command: '$compilationCommand'" -ForegroundColor Green
        Write-Host "[BUILD]   Build Root: '$buildRoot'" -ForegroundColor Green
        Write-Host "[BUILD]   Build Output Dir: '$buildOutputDir'" -ForegroundColor Green
        Write-Host "[BUILD]   APK Output Path: '$apkOutputPath'" -ForegroundColor Green
        Write-Host "[BUILD]   Platform: '$compilationPlatform'" -ForegroundColor Green
        Write-Host "[BUILD]   Clean Command: '$cleanCommand'" -ForegroundColor Green
        Write-Host "[BUILD]   Build Timestamp: '$buildTimestamp'" -ForegroundColor Green
        Write-Host "[BUILD]   APK File Name: '$apkFileName'" -ForegroundColor Green

        # Validate required variables
        if (-not $selectedApp -or -not $compilationCommand -or -not $buildRoot) {
            Write-ErrorMsg "[ERROR] Missing required variables from step20 compilation preparation"
            return $false
        }

        # Validate build root directory exists
        if (-not (Test-Path $buildRoot)) {
            Write-ErrorMsg "[ERROR] Build root directory does not exist: $buildRoot"
            return $false
        }

        # Get entry file and build script path
        $entryFile = Get-FileVariable -Name $Global:KEY_SELECTED_ENTRY_FILE -DefaultValue ""
        $buildScriptPath = Get-FileVariable -Name $Global:KEY_BUILD_SCRIPT_PATH -DefaultValue ""

        # Display build configuration summary
        Write-Host ""
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host "  BUILD CONFIGURATION SUMMARY" -ForegroundColor Yellow
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host "[INFO] App: $selectedApp" -ForegroundColor White
        Write-Host "[INFO] Mode: $selectedAction / $compilationPlatform" -ForegroundColor White
        Write-Host "[INFO] Entry File: $entryFile" -ForegroundColor Green
        Write-Host "[INFO] Build Root: $buildRoot" -ForegroundColor Gray
        Write-Host "[INFO] Expected Output: $apkFileName" -ForegroundColor Gray

        # Extract and display Flutter command from build script
        if ($buildScriptPath -and (Test-Path $buildScriptPath)) {
            try {
                $flutterCommandLine = Select-String -Path $buildScriptPath -Pattern "Invoke-Expression " | Select-Object -First 1
                if ($flutterCommandLine) {
                    # Extract the flutter command from Invoke-Expression line
                    $commandText = $flutterCommandLine.Line -replace '.*Invoke-Expression\s+"([^"]+)".*', '$1'
                    Write-Host "[INFO] Flutter Command: $commandText" -ForegroundColor Cyan
                }
            } catch {
                Write-Host "[INFO] Could not extract Flutter command from script" -ForegroundColor Yellow
            }
        }
        Write-Host "================================================================" -ForegroundColor Cyan
        Write-Host ""

        # Change to build root directory
        Write-Host "[BUILD] Switching to build root: '$buildRoot'" -ForegroundColor Yellow
        Push-Location $buildRoot
        Write-Host "[BUILD] Current working directory: $(Get-Location)" -ForegroundColor Yellow

        try {
            # Execute clean command only if compilation option is 'clean'
            $compilationOption = Get-FileVariable -Name $Global:KEY_COMPILATION_OPTION -DefaultValue ""

            if ($compilationOption -eq "clean") {
                Write-Host "[BUILD] Clean mode detected - executing clean command" -ForegroundColor Yellow

                $cleanCommandVar = Get-FileVariable -Name $Global:KEY_CLEAN_COMMAND -DefaultValue ""
                $cleanScriptPath = Get-FileVariable -Name $Global:KEY_CLEAN_SCRIPT_PATH -DefaultValue ""

                if ($cleanCommandVar -and $cleanCommandVar.Trim() -ne "") {
                    Write-Host "[BUILD] Executing clean command..." -ForegroundColor Yellow

                    if ($cleanScriptPath -and (Test-Path $cleanScriptPath)) {
                        Write-Host "[BUILD] Clean Script: $cleanScriptPath" -ForegroundColor Gray
                        & powershell -File $cleanScriptPath
                    } else {
                        Write-Host "[BUILD] Clean Command: $cleanCommandVar" -ForegroundColor Gray
                        Invoke-Expression $cleanCommandVar
                    }

                    if ($LASTEXITCODE -ne 0) {
                        Write-Warning "[BUILD] Clean command failed but continuing with build..."
                    }
                } else {
                    Write-Warning "[BUILD] Clean mode selected but no clean command found"
                }
            } else {
                Write-Host "[BUILD] Compilation option is '$compilationOption' - skipping clean command" -ForegroundColor Gray
            }

            # Execute main compilation command
            Write-Host "[BUILD] Executing compilation command..." -ForegroundColor Yellow

            $buildScriptPath = Get-FileVariable -Name $Global:KEY_SCRIPT_PATH -DefaultValue ""
            $buildCommand = Get-FileVariable -Name $Global:KEY_COMMAND -DefaultValue ""

            # Determine log file path
            $logFile = Join-Path $buildRoot "build_log.txt"

            if ($buildScriptPath -and (Test-Path $buildScriptPath)) {
                Write-Host "[BUILD] Build Script: $buildScriptPath" -ForegroundColor Gray
                Write-Host "[BUILD] Log File: $logFile" -ForegroundColor Gray
                # Execute script in current process for real-time output (not & powershell -File)
                & $buildScriptPath
            } elseif ($buildCommand -and $buildCommand.Trim() -ne "") {
                Write-Host "[BUILD] Build Command: $buildCommand" -ForegroundColor Gray
                Write-Host "[BUILD] Log File: $logFile" -ForegroundColor Gray
                Invoke-Expression $buildCommand
            } else {
                Write-Host "[BUILD] Compilation Command: $compilationCommand" -ForegroundColor Gray
                Write-Host "[BUILD] Log File: $logFile" -ForegroundColor Gray
                Invoke-Expression $compilationCommand
            }

            Write-Host "[DEBUG] Command execution completed with exit code: $LASTEXITCODE" -ForegroundColor Magenta

            if ($LASTEXITCODE -eq 0) {
                Write-Success "[BUILD] Compilation completed successfully"
                if ($compilationPlatform -eq "android" -and $apkOutputPath -and (Test-Path -LiteralPath $apkOutputPath)) {
                    Write-Host ""
                    Write-Host "[BUILD] ADB install (copy): adb install -r `"$apkOutputPath`"" -ForegroundColor Cyan
                } elseif ($compilationPlatform -eq "android" -and $apkOutputPath) {
                    Write-Host "[BUILD] ADB install (path from step20): adb install -r `"$apkOutputPath`"" -ForegroundColor Gray
                }
                return $true
            } else {
                Write-ErrorMsg "[BUILD] Compilation failed with exit code: $LASTEXITCODE"
                Write-Host "[ERROR] Press any key to view error details..." -ForegroundColor Red
                $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                return $false
            }

        } finally {
            Pop-Location
            Write-Host "[BUILD] Restored working directory: $(Get-Location)" -ForegroundColor Yellow

            # Open log file in explorer if it exists
            $logFile = Join-Path $buildRoot "build_log.txt"
            if (Test-Path $logFile) {
                Write-Host "[BUILD] Opening build log file..." -ForegroundColor Cyan
                try {
                    Start-Process "explorer.exe" -ArgumentList "/select,`"$logFile`""
                } catch {
                    Write-Warning "[BUILD] Could not open log file: $_"
                }
            }
        }

    } catch {
        Write-ErrorMsg "[ERROR] Build mode execution failed: $_"
        return $false
    }
}

function Invoke-DebugScriptSelection {
    <#
    .SYNOPSIS
    Handle debug script selection and execution based on Python variables

    .DESCRIPTION
    Reads variables saved by Python main.py and routes to appropriate mode function
    Routes to Invoke-DebugMode or Invoke-BuildMode based on action
    #>

    try {
        # Read action to determine mode
        $selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue ""

        if (-not $selectedAction) {
            Write-ErrorMsg "[ERROR] No action selected from Python"
            return $false
        }

        # Route based on action
        if ($selectedAction.ToLower() -eq "debug") {
            return Invoke-DebugMode
        }
        elseif ($selectedAction.ToLower() -eq "build" -or $selectedAction.ToLower() -eq "release") {
            return Invoke-BuildMode
        }
        else {
            Write-ErrorMsg "[ERROR] Unknown action: $selectedAction"
            return $false
        }

    } catch {
        Write-ErrorMsg "[ERROR] Debug script selection failed: $_"
        return $false
    }
}


#endregion
