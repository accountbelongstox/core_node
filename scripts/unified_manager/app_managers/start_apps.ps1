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

# Unified Manager - Start Applications
# Starts one or multiple applications in the project
#
# IMPORTANT: Windows Application Startup Rules
# - Simple scripts: Use BAT files directly for basic operations
# - Complex scripts: Use BAT triggers to call PS1 scripts (hardcoded implementation)
# - NEVER use explorer to directly open PS1 files - they will be treated as text
# - All Poly applications MUST use BAT entry points that trigger PS1 scripts
# - This ensures proper PowerShell execution with correct policies and error handling

param(
    [string[]]$Apps = @(),           # Specific apps to start (ID, name, or range format)
    [string]$Preset = "",            # Preset configuration to start
    [switch]$Background = $false,    # Start apps in background
    [switch]$Sequential = $false,    # Start apps sequentially instead of parallel
    [switch]$List = $false,          # List available apps and presets
    [switch]$Verbose = $false,       # Verbose output
    [int]$Delay = 2,                 # Delay between starting apps (seconds)
    [switch]$Interactive = $false    # Interactive mode for app selection
)

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$UTILS_PATH = Join-Path (Split-Path -Parent $SCRIPT_DIR) "common\utils.ps1"
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $SCRIPT_DIR)
$RUNNING_PROCESSES = @()

# Import utilities
. $UTILS_PATH

# Function to list available apps and presets with optimized format
function Show-AvailableOptions {
    $registry = Get-AppRegistry
    if (-not $registry) {
        Write-Error "Failed to load application registry"
        return
    }

    Write-Host ""
    Write-Host "=== Available Applications (from registry) ===" -ForegroundColor Yellow
    Write-Host ""

    # Sort applications by ID for numbered display (handle PSCustomObject)
    $sortedApps = @()
    foreach ($appProperty in $registry.apps.PSObject.Properties) {
        $appName = $appProperty.Name
        $appConfig = $appProperty.Value
        $sortedApps += @{ Name = $appName; Config = $appConfig; Id = [int]$appConfig.id }
    }
    $sortedApps = $sortedApps | Sort-Object { [int]$_.Id }
    
    Write-Host "Found $($sortedApps.Count) applications in registry:" -ForegroundColor Green
    Write-Host ""

    foreach ($appEntry in $sortedApps) {
        $appName = $appEntry.Name
        $appConfig = $appEntry.Config

        # Format: "ID: AppName (type) 'Description...'"
        $description = $appConfig.description
        if ($description.Length -gt 50) {
            $description = $description.Substring(0, 47) + "..."
        }

        Write-Host "$($appConfig.id): $appName ($($appConfig.type)) '$description'" -ForegroundColor Cyan
    }

    Write-Host ""
    Write-Host "=== Available Presets ===" -ForegroundColor Yellow
    
    # Sort presets by ID for consistent display
    $sortedPresets = @()
    if ($registry.presets) {
        foreach ($presetProperty in $registry.presets.PSObject.Properties) {
            $presetName = $presetProperty.Name
            $presetConfig = $presetProperty.Value
            $sortedPresets += @{ Name = $presetName; Config = $presetConfig }
        }
        $sortedPresets = $sortedPresets | Sort-Object { $_.Config.id }
    }
    
    Write-Host "Found $($sortedPresets.Count) presets:" -ForegroundColor Green
    Write-Host ""
    
    foreach ($presetEntry in $sortedPresets) {
        $presetName = $presetEntry.Name
        $presetConfig = $presetEntry.Config
        $apps = $presetConfig.app_names -join ', '
        if ($apps.Length -gt 60) {
            $apps = $apps.Substring(0, 57) + "..."
        }
        Write-Host "$($presetConfig.id): $presetName '$($presetConfig.description)' [$apps]" -ForegroundColor Magenta
    }
    
    Write-Host ""
    Write-Host "INFO: Applications are read directly from app_registry.json - no script detection required" -ForegroundColor Green

    Write-Host ""
    Write-Host "Enter apps to start (comma-separated, or preset name with -Preset): " -NoNewline -ForegroundColor Yellow
}

# Function to start a single application
function Start-SingleApp {
    param(
        [string]$AppSpec,
        [bool]$InBackground = $false
    )

    Write-Info "Starting application: $AppSpec"

    # Get app configuration by name or ID
    $appConfig = Get-AppConfig -AppIdentifier $AppSpec
    if (-not $appConfig) {
        Write-Error "Failed to get configuration for $AppSpec"
        return $null
    }

    # Auto-detect script files and determine start command
    Write-Info "Auto-detecting scripts for $AppSpec..."
    $scriptCheck = Test-AppScripts -AppConfig $appConfig -AppName $AppSpec
    
    # Determine start command based on auto-detection results
    $startCmd = ""
    $appPath = $scriptCheck.AppPath
    
    if ($scriptCheck.FoundScripts["start_cmd"]) {
        # Use detected start.bat script
        $startCmd = "explorer `"$($scriptCheck.FoundScripts["start_cmd"])`""
        Write-Success "Found start script: $($scriptCheck.FoundScripts["start_cmd"])"
    } elseif ($scriptCheck.FoundScripts["embedded_start"]) {
        # Use NCore embedded start command
        $startCmd = $scriptCheck.FoundScripts["embedded_start"]
        Write-Success "Using NCore embedded start: $startCmd"
    } else {
        Write-Error "No start method found for $AppSpec"
        Write-Warning "Missing scripts:"
        foreach ($missing in $scriptCheck.MissingScripts) {
            Write-Warning "  - $missing"
        }
        
        $continue = Read-Host "Continue anyway? (y/N)"
        if ($continue -notmatch '^[Yy]') {
            Write-Info "Skipping $AppSpec due to missing scripts"
            return $null
        } else {
            Write-Error "Cannot proceed without a valid start method"
            return $null
        }
    }

    # Validate app path exists
    if (-not (Test-Path $appPath)) {
        Write-Error "Application directory not found: $appPath"
        return $null
    }
    
    # Check basic dependencies based on app type
    $requiredCommands = @()
    switch ($appConfig.type) {
        "ncore-app" { 
            if ($startCmd -like "node*") {
                $requiredCommands = @("node")
            }
        }
        "poly-vue" { $requiredCommands = @("node") }
        "poly-laravel" { $requiredCommands = @("php") }
        "poly-flutter" { $requiredCommands = @("flutter") }
        "python" { $requiredCommands = @("python") }
    }
    
    if ($requiredCommands.Count -gt 0) {
        if (-not (Test-Dependencies -RequiredCommands $requiredCommands)) {
            Write-Warning "Missing dependencies for ${AppSpec}: $($requiredCommands -join ', ')"
            Write-Warning "App may fail to start properly"
        }
    }
    
    # Display app information
    Write-Info "  Type: $($appConfig.type)"
    Write-Info "  Path: $appPath"
    Write-Info "  Command: $startCmd"
    if ($appConfig.ports) {
        Write-Info "  Ports: $($appConfig.ports -join ', ')"
    }
    
    try {
        if ($InBackground) {
            # Start in background using Start-Process
            # For explorer commands, execute directly without changing directory
            if ($startCmd -like "explorer*") {
                $processInfo = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "$startCmd" -PassThru -WindowStyle Minimized
            } else {
                $processInfo = Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "Set-Location '$appPath'; $startCmd" -PassThru -WindowStyle Minimized
            }
            
            if ($processInfo) {
                Write-Success "Started $AppSpec in background (PID: $($processInfo.Id))"
                return @{
                    AppSpec = $AppSpec
                    Process = $processInfo
                    Path = $appPath
                    Command = $startCmd
                }
            } else {
                Write-Error "Failed to start $AppSpec in background"
                return $null
            }
        } else {
            # Start in foreground
            Write-Info "Starting $AppSpec in foreground..."
            Write-Warning "Press Ctrl+C to stop the application"

            # For explorer commands, execute directly without changing directory
            if ($startCmd -like "explorer*") {
                Invoke-Expression $startCmd
            } else {
                Invoke-InDirectory -Path $appPath -ScriptBlock {
                    Invoke-Expression $startCmd
                }
            }
            
            return @{
                AppSpec = $AppSpec
                Process = $null
                Path = $appPath
                Command = $startCmd
            }
        }
    }
    catch {
        Write-Error "Failed to start $AppSpec`: $_"
        return $null
    }
}

# Function to start multiple applications
function Start-MultipleApps {
    param([string[]]$AppSpecs)
    
    Write-Info "Starting $($AppSpecs.Count) applications..."
    
    $startedApps = @()
    $failedApps = @()
    
    if ($Sequential) {
        # Start apps sequentially
        foreach ($appSpec in $AppSpecs) {
            $result = Start-SingleApp -AppSpec $appSpec -InBackground $Background
            if ($result) {
                $startedApps += $result
                if ($Delay -gt 0 -and $appSpec -ne $AppSpecs[-1]) {
                    Write-Info "Waiting $Delay seconds before starting next app..."
                    Start-Sleep -Seconds $Delay
                }
            } else {
                $failedApps += $appSpec
            }
        }
    } else {
        # Start apps in parallel (background mode required)
        if (-not $Background) {
            Write-Warning "Parallel mode requires background execution. Enabling background mode."
            $Background = $true
        }
        
        foreach ($appSpec in $AppSpecs) {
            $result = Start-SingleApp -AppSpec $appSpec -InBackground $true
            if ($result) {
                $startedApps += $result
            } else {
                $failedApps += $appSpec
            }
            
            if ($Delay -gt 0 -and $appSpec -ne $AppSpecs[-1]) {
                Start-Sleep -Seconds $Delay
            }
        }
    }
    
    # Report results
    Write-Info "Startup completed"
    Write-Success "Successfully started: $($startedApps.Count) apps"
    foreach ($app in $startedApps) {
        Write-Info "  - $($app.AppSpec)"
        if ($app.Process) {
            Write-Info "    PID: $($app.Process.Id)"
        }
    }
    
    if ($failedApps.Count -gt 0) {
        Write-Error "Failed to start: $($failedApps.Count) apps"
        Write-Error "  - $($failedApps -join ', ')"
    }
    
    return $startedApps
}

# Function to start apps from preset
function Start-PresetApps {
    param([string]$PresetName)
    
    Write-Info "Starting preset: $PresetName"
    
    $presetConfig = Get-PresetConfig -PresetName $PresetName
    if (-not $presetConfig) {
        return @()
    }
    
    Write-Info "Preset description: $($presetConfig.description)"
    Write-Info "Apps in preset: $($presetConfig.apps -join ', ')"
    
    return Start-MultipleApps -AppSpecs $presetConfig.apps
}

# Function to cleanup on exit
function Stop-RunningProcesses {
    if ($RUNNING_PROCESSES.Count -gt 0) {
        Write-Info "Stopping running processes..."
        foreach ($appInfo in $RUNNING_PROCESSES) {
            if ($appInfo.Process -and -not $appInfo.Process.HasExited) {
                try {
                    $appInfo.Process.Kill()
                    Write-Info "Stopped $($appInfo.AppSpec)"
                }
                catch {
                    Write-Warning "Failed to stop $($appInfo.AppSpec): $_"
                }
            }
        }
    }
}

# Cleanup handler will be called manually when needed

# Function to convert input to app identifiers
function Convert-ToAppIdentifiers {
    param([string[]]$InputSpecs)

    $appIdentifiers = @()
    $registry = Get-AppRegistry
    if (-not $registry) {
        return @()
    }

    foreach ($spec in $InputSpecs) {
        if ($spec -match '^\d+$') {
            # Single number - convert ID to app name
            $appId = [int]$spec
            $appName = $null
            foreach ($appProperty in $registry.apps.PSObject.Properties) {
                if ($appProperty.Value.id -eq $appId) {
                    $appName = $appProperty.Name
                    break
                }
            }
            if ($appName) {
                $appIdentifiers += $appName
            } else {
                Write-Warning "App ID $appId not found"
            }
        }
        elseif ($spec -match '^(\d+)-(\d+)$') {
            # Range (e.g., 1-5)
            $start = [int]$matches[1]
            $end = [int]$matches[2]
            for ($i = $start; $i -le $end; $i++) {
                $appName = $null
                foreach ($appProperty in $registry.apps.PSObject.Properties) {
                    if ($appProperty.Value.id -eq $i) {
                        $appName = $appProperty.Name
                        break
                    }
                }
                if ($appName) {
                    $appIdentifiers += $appName
                }
            }
        }
        elseif ($spec -match '^[\d,\s-]+$') {
            # Multiple numbers or ranges separated by commas/spaces
            $parts = $spec -split '[,\s]+' | Where-Object { $_ -ne '' }
            foreach ($part in $parts) {
                $subResult = Convert-ToAppIdentifiers -InputSpecs @($part)
                $appIdentifiers += $subResult
            }
        }
        else {
            # Preset name or app name (case-insensitive)
            $matchedPreset = $null
            $matchedApp = $null

            # Check presets (case-insensitive, including ID matching)
            if ($registry.presets) {
                foreach ($presetProperty in $registry.presets.PSObject.Properties) {
                    $presetName = $presetProperty.Name
                    $presetConfig = $presetProperty.Value
                    if ($presetName -ieq $spec -or $presetConfig.id -ieq $spec) {
                        $matchedPreset = $presetName
                        break
                    }
                }
            }

            # Check apps (case-insensitive)
            if (-not $matchedPreset) {
                foreach ($appProperty in $registry.apps.PSObject.Properties) {
                    $appName = $appProperty.Name
                    if ($appName -ieq $spec) {
                        $matchedApp = $appName
                        break
                    }
                }
            }

            if ($matchedPreset) {
                # It's a preset
                $presetApps = $registry.presets.$matchedPreset.app_names
                $appIdentifiers += $presetApps
            } elseif ($matchedApp) {
                # It's an app name
                $appIdentifiers += $matchedApp
            } else {
                Write-Warning "Unknown app or preset: $spec"
            }
        }
    }

    return $appIdentifiers | Select-Object -Unique
}

# Function for interactive app selection
function Get-InteractiveSelection {
    Show-AvailableOptions
    Write-Host ""
    Write-Info "Enter apps to start (comma-separated, or preset name with -Preset):"
    $selection = Read-Host

    if ([string]::IsNullOrWhiteSpace($selection)) {
        Write-Warning "No selection made"
        return @()
    }

    # Check for special commands
    if ($selection -eq 'q' -or $selection -eq 'quit' -or $selection -eq 'exit') {
        return $null
    }

    # Check for back/menu command
    if ($selection -eq 'b' -or $selection -eq 'back' -or $selection -eq 'menu') {
        return @()  # Return empty array to continue loop
    }

    # Check for list command
    if ($selection -eq 'list' -or $selection -eq 'l') {
        Show-AvailableOptions
        Write-Host ""
        return @()  # Return empty array to continue loop
    }

    return Convert-ToAppIdentifiers -InputSpecs @($selection)
}

# Function for continuous interactive mode
function Start-InteractiveMode {
    Write-Info "Starting Interactive Application Manager"
    Write-Info "Commands: 'q'=quit, 'b'=back to menu, 'list'=show apps, or enter app numbers/names"
    Write-Host ""

    while ($true) {
        try {
            # Show current running processes
            if ($script:RUNNING_PROCESSES.Count -gt 0) {
                $activeProcesses = $script:RUNNING_PROCESSES | Where-Object { $_.Process -and -not $_.Process.HasExited }
                if ($activeProcesses.Count -gt 0) {
                    Write-Info "Currently running applications:"
                    foreach ($proc in $activeProcesses) {
                        $appName = if ($proc.AppName) { $proc.AppName } else { "Unknown" }
                        Write-Host "  - $appName (PID: $($proc.Process.Id))" -ForegroundColor Green
                    }
                    Write-Host ""
                }
            }

            # Get user selection
            $appsToStart = Get-InteractiveSelection

            # Check for quit
            if ($null -eq $appsToStart) {
                Write-Info "Exiting Interactive Mode..."
                break
            }

            # Check for empty selection
            if ($appsToStart.Count -eq 0) {
                continue
            }

            # Start selected applications
            Write-Info "Starting applications: $($appsToStart -join ', ')"
            $startedApps = Start-MultipleApps -AppSpecs $appsToStart
            $script:RUNNING_PROCESSES += $startedApps

            Write-Host ""
            Write-Success "Applications started in background. You can continue selecting more apps."
            Write-Host ""
        }
        catch {
            Write-Error "Error in interactive mode: $_"
            Write-Info "Continuing..."
        }
    }

    # Clean up when exiting
    if ($script:RUNNING_PROCESSES.Count -gt 0) {
        Write-Info "Stopping all running applications..."
        Stop-RunningProcesses
    }
}

# Main execution function
function Start-Applications {
    if ($List) {
        Show-AvailableOptions
        return
    }

    # If no specific parameters provided, start interactive mode
    if (-not $Interactive -and -not $Preset -and $Apps.Count -eq 0) {
        Start-InteractiveMode
        return
    }

    $appsToStart = @()

    if ($Interactive) {
        # Single interactive selection (legacy mode)
        Start-InteractiveMode
        return
    }
    elseif ($Preset) {
        # Start from preset
        $startedApps = Start-PresetApps -PresetName $Preset
        $script:RUNNING_PROCESSES += $startedApps

        # After starting preset, enter interactive mode for more selections
        Write-Host ""
        Write-Success "Preset '$Preset' started. You can continue selecting more apps."
        Write-Host ""
        Start-InteractiveMode
        return
    }
    elseif ($Apps.Count -gt 0) {
        # Convert input specifications to app identifiers
        $appsToStart = Convert-ToAppIdentifiers -InputSpecs $Apps
        if ($appsToStart.Count -eq 0) {
            Write-Error "No valid applications found from input: $($Apps -join ', ')"
            return
        }

        # Start the selected apps
        Write-Info "Starting applications: $($appsToStart -join ', ')"
        $startedApps = Start-MultipleApps -AppSpecs $appsToStart
        $script:RUNNING_PROCESSES += $startedApps

        # After starting apps, enter interactive mode for more selections
        Write-Host ""
        Write-Success "Applications started. You can continue selecting more apps."
        Write-Host ""
        Start-InteractiveMode
        return
    }
}

# Main execution
if (-not (Test-Path $UTILS_PATH)) {
    Write-Error "Utilities not found: $UTILS_PATH"
    exit 1
}

Start-Applications
exit 0
