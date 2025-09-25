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

# Unified Manager Common Utilities - PowerShell
# Provides common functions for application management

# Import global variables
. (Join-Path $PSScriptRoot "global_vars.ps1")

# Function to load constants from JSON files
function Get-Constants {
    param([string]$Type)

    $constantsFile = switch ($Type) {
        "paths" { $PATHS_FILE }
        "commands" { $COMMANDS_FILE }
        "versions" { $VERSIONS_FILE }
        "services" { $SERVICES_FILE }
        default { throw "Unknown constants type: $Type" }
    }

    if (-not (Test-Path $constantsFile)) {
        Write-Error "Constants file not found: $constantsFile"
        return $null
    }

    try {
        return Get-Content $constantsFile -Raw | ConvertFrom-Json
    }
    catch {
        Write-Error "Failed to parse constants file: $_"
        return $null
    }
}

# Function to load app registry
function Get-AppRegistry {
    if (-not (Test-Path $REGISTRY_FILE)) {
        Write-Error "Registry file not found: $REGISTRY_FILE"
        return $null
    }

    try {
        return Get-Content $REGISTRY_FILE -Raw | ConvertFrom-Json
    }
    catch {
        Write-Error "Failed to parse registry file: $_"
        return $null
    }
}

# Function to get app by name
function Get-AppByName {
    param([string]$AppName)
    
    $registry = Get-AppRegistry
    if (-not $registry -or -not $registry.apps -or -not $registry.apps.$AppName) {
        return $null
    }
    
    return $registry.apps.$AppName
}

# Function to generate dynamic commands for an app
function Get-AppDynamicCommands {
    param(
        [Parameter(Mandatory=$true)] [string]$AppName,
        [Parameter(Mandatory=$false)] [string[]]$CommandTypes = @("start_cmd", "install_cmd", "deploy_cmd", "stop_cmd", "build_cmd")
    )
    
    $app = Get-AppByName -AppName $AppName
    if (-not $app) {
        return @{}
    }
    
    $commands = @{}
    
    foreach ($cmdType in $CommandTypes) {
        # Hardcoded script names - same for all apps
        $scriptName = switch ($cmdType) {
            "start_cmd" { "start.sh" }
            "install_cmd" { "install.sh" }
            "deploy_cmd" { if ($IS_WINDOWS) { "deploy.bat" } else { "deploy.sh" } }
            "stop_cmd" { if ($IS_WINDOWS) { "stop.bat" } else { "stop.sh" } }
            "build_cmd" { "build.sh" }
            default { $null }
        }
        
        if ($scriptName) {
            $scriptPath = Get-AppScriptPath -AppPath $app.path -ScriptName $scriptName
            
            if (Test-Path $scriptPath) {
                $commands[$cmdType] = Build-AppCommand -CommandType $cmdType -AppPath $app.path -ScriptName $scriptName
            } else {
                # Red warning when script not found
                Write-Host "WARNING: Script not found: $scriptPath" -ForegroundColor Red
            }
        }
        
        # Add platform-specific commands
        if ($IS_LINUX -and $cmdType -in @("install_cmd", "deploy_cmd", "stop_cmd")) {
            $linuxCmdType = "${cmdType}_linux"
            $linuxScriptName = switch ($cmdType) {
                "install_cmd" { "install.sh" }
                "deploy_cmd" { "deploy.sh" }
                "stop_cmd" { "stop.sh" }
            }
            
            if ($linuxScriptName) {
                $scriptPath = Get-AppScriptPath -AppPath $app.path -ScriptName $linuxScriptName
                
                if (Test-Path $scriptPath) {
                    $commands[$linuxCmdType] = Build-AppCommand -CommandType $cmdType -AppPath $app.path -ScriptName $linuxScriptName
                } else {
                    # Red warning when script not found
                    Write-Host "WARNING: Script not found: $scriptPath" -ForegroundColor Red
                }
            }
        }
    }
    
    return $commands
}

# Function to get all apps with dynamic commands
function Get-AllAppsWithCommands {
    $registry = Get-AppRegistry
    if (-not $registry -or -not $registry.apps) {
        return @{}
    }
    
    $appsWithCommands = @{}
    
    foreach ($appName in $registry.apps.PSObject.Properties.Name) {
        $app = $registry.apps.$appName
        $commands = Get-AppDynamicCommands -AppName $appName
        
        $appsWithCommands[$appName] = @{
            App = $app
            Commands = $commands
        }
    }
    
    return $appsWithCommands
}

# Function to display app commands with warnings
function Show-AppCommands {
    param(
        [Parameter(Mandatory=$true)] [string]$AppName,
        [Parameter(Mandatory=$false)] [switch]$ShowWarnings = $true
    )
    
    $app = Get-AppByName -AppName $AppName
    if (-not $app) {
        Write-Host "ERROR: App not found: $AppName" -ForegroundColor Red
        return
    }
    
    Write-Host "App: $AppName" -ForegroundColor Cyan
    Write-Host "Path: $($app.path)" -ForegroundColor Gray
    Write-Host "Description: $($app.description)" -ForegroundColor Gray
    Write-Host ""
    
    # Define all possible command types
    $commandTypes = @("start_cmd", "install_cmd", "deploy_cmd", "stop_cmd", "build_cmd")
    if ($IS_LINUX) {
        $commandTypes += @("install_cmd_linux", "deploy_cmd_linux", "stop_cmd_linux")
    }
    
    $availableCommands = @()
    $missingScripts = @()
    
    foreach ($cmdType in $commandTypes) {
        $scriptName = switch ($cmdType) {
            "start_cmd" { "start.sh" }
            "install_cmd" { "install.sh" }
            "install_cmd_linux" { "install.sh" }
            "deploy_cmd" { if ($IS_WINDOWS) { "deploy.bat" } else { "deploy.sh" } }
            "deploy_cmd_linux" { "deploy.sh" }
            "stop_cmd" { if ($IS_WINDOWS) { "stop.bat" } else { "stop.sh" } }
            "stop_cmd_linux" { "stop.sh" }
            "build_cmd" { "build.sh" }
            default { $null }
        }
        
        if ($scriptName) {
            $scriptPath = Get-AppScriptPath -AppPath $app.path -ScriptName $scriptName
            
            if (Test-Path $scriptPath) {
                $command = Build-AppCommand -CommandType $cmdType -AppPath $app.path -ScriptName $scriptName
                $availableCommands += @{
                    Type = $cmdType
                    Script = $scriptName
                    Command = $command
                }
                Write-Host "OK: $cmdType`: $scriptName" -ForegroundColor Green
            } else {
                $missingScripts += @{
                    Type = $cmdType
                    Script = $scriptName
                    Path = $scriptPath
                }
                if ($ShowWarnings) {
                    Write-Host "ERROR: $cmdType`: $scriptName (not found)" -ForegroundColor Red
                }
            }
        }
    }
    
    if ($ShowWarnings -and $missingScripts.Count -gt 0) {
        Write-Host ""
        Write-Host "WARNING: Missing scripts:" -ForegroundColor Yellow
        foreach ($missing in $missingScripts) {
            Write-Host "   $($missing.Type): $($missing.Path)" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    return @{
        Available = $availableCommands
        Missing = $missingScripts
    }
}

# Function to load application registry (legacy)
function Get-AppRegistryLegacy {
    $registryParserPath = Join-Path $SCRIPT_DIR "registry_parser.ps1"
    
    if (Test-Path $registryParserPath) {
        # Use new INI-based registry with auto-detection
        try {
            . $registryParserPath
            $registry = Get-AppRegistryWithAutoDetection
            if ($registry) {
                return $registry
            }
        }
        catch {
            Write-Warning "Failed to use INI registry parser: $_"
        }
    }
    
    # Fallback to JSON registry if INI parser fails or doesn't exist
    if (Test-Path $REGISTRY_FILE) {
        try {
            $registryContent = Get-Content $REGISTRY_FILE -Raw | ConvertFrom-Json
            return $registryContent
        }
        catch {
            Write-Error "Failed to parse JSON registry: $_"
            return $null
        }
    }
    
    Write-Error "No valid registry file found"
    return $null
}

# Function to check if script files exist for an application using auto-detection
function Test-AppScripts {
    param(
        [Parameter(Mandatory=$true)]
        [PSCustomObject]$AppConfig,
        [Parameter(Mandatory=$true)]
        [string]$AppName
    )

    $results = @{
        AppName = $AppName
        Type = $AppConfig.type
        ScriptsExist = @{}
        AllScriptsExist = $true
        MissingScripts = @()
        FoundScripts = @{}
        AppPath = ""
    }

    # Auto-detect application directory based on type
    $appPath = ""
    if ($AppConfig.type -eq "ncore-app") {
        $appPath = Join-Path $PROJECT_ROOT "apps\$AppName"
    } elseif ($AppConfig.type -like "poly-*") {
        $appPath = Join-Path $PROJECT_ROOT "poly_apps\$AppName"
    } else {
        $appPath = Join-Path $PROJECT_ROOT "apps\$AppName"
    }

    $results.AppPath = $appPath
    
    # Check if application directory exists
    if (-not (Test-Path $appPath)) {
        $results.AllScriptsExist = $false
        $results.MissingScripts += "Application directory not found: $appPath"
        return $results
    }

    # Auto-detect scripts directory
    $scriptsDir = Join-Path $appPath "scripts"
    if (-not (Test-Path $scriptsDir)) {
        $results.AllScriptsExist = $false
        $results.MissingScripts += "Scripts directory not found: $scriptsDir"
        return $results
    }

    # Define standard script files to check based on app type
    $scriptsToCheck = @()
    
    if ($AppConfig.type -eq "ncore-app") {
        # NCore apps: look for standard BAT files
        $scriptsToCheck = @("start.bat", "install.bat", "deploy.bat", "stop.bat")
    } elseif ($AppConfig.type -like "poly-*") {
        # Poly apps: look for start and install scripts
        $scriptsToCheck = @("start.bat", "install.bat")
    } else {
        # Other types: minimal script check
        $scriptsToCheck = @("start.bat")
    }

    # Auto-detect existing scripts in the scripts directory
    foreach ($scriptFile in $scriptsToCheck) {
        $scriptPath = Join-Path $scriptsDir $scriptFile
        $scriptType = ""

        # Determine script type based on file extension
        if ($scriptFile -like "*.ps1") {
            $scriptType = $scriptFile -replace '\.ps1$', '_cmd'
        } else {
            $scriptType = $scriptFile -replace '\.bat$', '_cmd'
        }

        if (Test-Path $scriptPath) {
            $results.ScriptsExist[$scriptType] = $true
            $results.FoundScripts[$scriptType] = $scriptPath
        } else {
            $results.ScriptsExist[$scriptType] = $false
            $results.AllScriptsExist = $false
            $results.MissingScripts += "$scriptFile not found in $scriptsDir"
        }
    }

    # For NCore apps, check if we can fallback to embedded launch (node ../main.js app=AppName)
    if ($AppConfig.type -eq "ncore-app" -and -not $results.ScriptsExist["start_cmd"]) {
        $ncoreMainPath = Join-Path $PROJECT_ROOT "ncore\main.js"
        if (Test-Path $ncoreMainPath) {
            $results.ScriptsExist["embedded_start"] = $true
            $results.FoundScripts["embedded_start"] = "node `"$ncoreMainPath`" app=$AppName"
        }
    }

    return $results
}

# Function to check all applications' scripts
function Test-AllAppScripts {
    Write-Info "Checking script files for all applications..."

    $registry = Get-AppRegistry
    if (-not $registry) {
        Write-Error "Failed to load application registry"
        return $null
    }

    $allResults = @()
    $totalApps = 0
    $appsWithAllScripts = 0
    $appsWithMissingScripts = 0

    foreach ($appName in $registry.apps.PSObject.Properties.Name) {
        $appConfig = $registry.apps.$appName
        $result = Test-AppScripts -AppConfig $appConfig -AppName $appName
        $allResults += $result
        $totalApps++

        if ($result.AllScriptsExist) {
            $appsWithAllScripts++
        } else {
            $appsWithMissingScripts++
        }
    }

    # Generate summary report
    Write-Info "Script Check Summary:"
    Write-Info "  Total Applications: $totalApps"
    Write-Success "  Apps with all scripts: $appsWithAllScripts"
    if ($appsWithMissingScripts -gt 0) {
        Write-Warning "  Apps with missing scripts: $appsWithMissingScripts"
    }

    # Show detailed results for apps with missing scripts
    if ($appsWithMissingScripts -gt 0) {
        Write-Warning "Applications with missing scripts:"
        foreach ($result in $allResults) {
            if (-not $result.AllScriptsExist) {
                Write-Warning "  $($result.AppName) ($($result.Type)):"
                foreach ($missing in $result.MissingScripts) {
                    Write-Warning "    - Missing: $missing"
                }
            }
        }
    }

    return @{
        Results = $allResults
        Summary = @{
            Total = $totalApps
            WithAllScripts = $appsWithAllScripts
            WithMissingScripts = $appsWithMissingScripts
        }
    }
}

# Function to get application by ID or name
function Get-AppById {
    param(
        [Parameter(Mandatory=$true)]
        $AppId
    )

    $registry = Get-AppRegistry
    if (-not $registry) {
        return $null
    }

    # If AppId is numeric, search by ID
    if ($AppId -match '^\d+$') {
        foreach ($appName in $registry.apps.PSObject.Properties.Name) {
            $app = $registry.apps.$appName
            if ($app.id -eq [int]$AppId) {
                $app | Add-Member -NotePropertyName "name" -NotePropertyValue $appName -Force
                return $app
            }
        }
    }
    # Otherwise search by name
    else {
        if ($registry.apps.$AppId) {
            $app = $registry.apps.$AppId
            $app | Add-Member -NotePropertyName "name" -NotePropertyValue $AppId -Force
            return $app
        }
    }

    return $null
}

# Function to list all applications with numbers
function Get-AllAppsWithNumbers {
    $registry = Get-AppRegistry
    if (-not $registry) {
        return @()
    }

    $apps = @()
    foreach ($appName in $registry.apps.PSObject.Properties.Name) {
        $app = $registry.apps.$appName
        $apps += @{
            Id = $app.id
            Name = $appName
            Type = $app.type
            Category = $app.category
            Description = $app.description
            Path = $app.path
        }
    }

    return $apps | Sort-Object Id
}

# Function to parse number input (supports single, multiple, ranges)
function ConvertTo-AppIds {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Input
    )

    $appIds = @()
    $parts = $Input -split '\s+'

    foreach ($part in $parts) {
        if ($part -match '^\d+$') {
            # Single number
            $appIds += [int]$part
        }
        elseif ($part -match '^(\d+)-(\d+)$') {
            # Range (e.g., 1-5)
            $start = [int]$matches[1]
            $end = [int]$matches[2]
            for ($i = $start; $i -le $end; $i++) {
                $appIds += $i
            }
        }
        else {
            # Preset name or app name
            $preset = Get-PresetConfig -PresetName $part
            if ($preset) {
                $appIds += $preset.apps
            }
            else {
                # Try as app name
                $app = Get-AppById -AppId $part
                if ($app) {
                    $appIds += $app.id
                }
            }
        }
    }

    return $appIds | Sort-Object | Get-Unique
}

# Function to get application configuration (updated for new structure)
function Get-AppConfig {
    param(
        [Parameter(Mandatory=$true)]
        $AppIdentifier  # Can be ID, name, or app object
    )

    if ($AppIdentifier -is [PSCustomObject] -and $AppIdentifier.id) {
        # Already an app object
        return $AppIdentifier
    }

    return Get-AppById -AppId $AppIdentifier
}

# Function to get application path
function Get-AppPath {
    param(
        [Parameter(Mandatory=$true)]
        $AppIdentifier
    )

    $appConfig = Get-AppConfig -AppIdentifier $AppIdentifier
    if (-not $appConfig) {
        return $null
    }

    return Join-Path $PROJECT_ROOT $appConfig.path
}

# Function to check if application exists
function Test-AppExists {
    param(
        [Parameter(Mandatory=$true)]
        $AppIdentifier
    )

    $appConfig = Get-AppConfig -AppIdentifier $AppIdentifier
    if (-not $appConfig) {
        return $false
    }

    $appPath = Get-AppPath -AppIdentifier $AppIdentifier
    return Test-Path $appPath
}

# Function to display applications with numbers
function Show-AppsWithNumbers {
    param([string]$Title = "Available Applications")

    Write-Info $Title
    $apps = Get-AllAppsWithNumbers

    foreach ($app in $apps) {
        Write-Host "$($app.Id). $($app.Name) (Type: $($app.Type))" -ForegroundColor Cyan
        Write-Host "    Category: $($app.Category)" -ForegroundColor Gray
        Write-Host "    Description: $($app.Description)" -ForegroundColor Gray
        Write-Host ""
    }

    return $apps
}

# Function to get preset configuration
function Get-PresetConfig {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PresetName
    )
    
    $registry = Get-AppRegistry
    if (-not $registry) {
        return $null
    }
    
    if (-not $registry.presets.$PresetName) {
        Write-Error "Preset not found: $PresetName"
        return $null
    }
    
    return $registry.presets.$PresetName
}

# Function to list all applications (updated for new structure)
function Get-AllApps {
    $registry = Get-AppRegistry
    if (-not $registry) {
        return @()
    }

    $apps = @()
    foreach ($appName in $registry.apps.PSObject.Properties.Name) {
        $apps += $appName
    }

    return $apps | Sort-Object
}

# Function to list all presets
function Get-AllPresets {
    $registry = Get-AppRegistry
    if (-not $registry) {
        return @()
    }
    
    return $registry.presets.PSObject.Properties.Name
}

# Function to write colored output
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Cyan
}

# Function to execute command in specific directory
function Invoke-InDirectory {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Path,
        [Parameter(Mandatory=$true)]
        [scriptblock]$ScriptBlock
    )
    
    $originalLocation = Get-Location
    try {
        Set-Location $Path
        & $ScriptBlock
    }
    finally {
        Set-Location $originalLocation
    }
}

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to validate dependencies
function Test-Dependencies {
    param([array]$RequiredCommands)

    $missing = @()
    foreach ($cmd in $RequiredCommands) {
        if (-not (Test-Command $cmd)) {
            $missing += $cmd
        }
    }

    if ($missing.Count -gt 0) {
        Write-Error "Missing required commands: $($missing -join ', ')"
        return $false
    }

    return $true
}

# Function to check tech stack prerequisites
function Test-TechStackPrerequisites {
    param([string]$TechStack)

    $versions = Get-Constants -Type "versions"
    $services = Get-Constants -Type "services"

    if (-not $versions.$TechStack) {
        Write-Warning "No version requirements defined for tech stack: $TechStack"
        return $true
    }

    $requirements = $versions.$TechStack
    $missing = @()

    foreach ($tool in $requirements.PSObject.Properties.Name) {
        $requiredVersion = $requirements.$tool
        if (-not (Test-Command $tool)) {
            $missing += "$tool (required: $requiredVersion)"
        }
    }

    if ($missing.Count -gt 0) {
        Write-Error "Missing prerequisites for $TechStack`: $($missing -join ', ')"
        return $false
    }

    return $true
}

# Function to install tech stack prerequisites
function Install-TechStackPrerequisites {
    param([string]$TechStack)

    Write-Info "Installing prerequisites for tech stack: $TechStack"

    switch ($TechStack) {
        "ncore-app" {
            if (-not (Test-Command "node")) {
                Write-Error "Node.js is required but not installed"
                return $false
            }
            if (-not (Test-Command "yarn")) {
                Write-Info "Installing yarn globally..."
                npm install -g yarn
            }
        }
        "python" {
            if (-not (Test-Command "python")) {
                Write-Error "Python is required but not installed"
                return $false
            }
            if (-not (Test-Command "uv")) {
                Write-Info "Installing uv..."
                pip install uv
            }
            if ($IsWindows) {
                # Install Windows-specific packages
                Write-Info "Installing Windows-specific Python packages..."
                pip install pywin32 auto
            }
        }
        "poly-laravel" {
            if (-not (Test-Command "php")) {
                Write-Error "PHP is required but not installed"
                return $false
            }
            if (-not (Test-Command "composer")) {
                Write-Error "Composer is required but not installed"
                return $false
            }
        }
        "poly-flutter" {
            if (-not (Test-Command "flutter")) {
                Write-Error "Flutter is required but not installed"
                return $false
            }
            if (-not $env:JAVA_HOME) {
                Write-Error "JAVA_HOME environment variable is required"
                return $false
            }
        }
    }

    return $true
}

# Function to enhance app display with automatic script detection
function Get-AppWithScriptInfo {
    param(
        [Parameter(Mandatory=$true)] [PSCustomObject]$AppConfig,
        [Parameter(Mandatory=$true)] [string]$AppName
    )

    $appPath = ""
    if ($AppConfig.path) {
        $appPath = Join-Path $PROJECT_ROOT $AppConfig.path
    } else {
        if ($AppConfig.type -eq "ncore-app") {
            $appPath = Join-Path $PROJECT_ROOT "apps\$AppName"
        } elseif ($AppConfig.type -like "*poly*") {
            $appPath = Join-Path $PROJECT_ROOT "poly_apps\$AppName"
        } else {
            $appPath = Join-Path $PROJECT_ROOT "apps\$AppName"
        }
    }

    $scriptsDir = Join-Path $appPath "scripts"
    $availableScripts = @()

    if (Test-Path $scriptsDir) {
        $scriptTypes = @(
            @{ Name = "start"; Extensions = @("bat", "ps1", "sh") },
            @{ Name = "install"; Extensions = @("bat", "ps1", "sh") },
            @{ Name = "build"; Extensions = @("bat", "ps1", "sh") },
            @{ Name = "deploy"; Extensions = @("bat", "ps1", "sh") },
            @{ Name = "stop"; Extensions = @("bat", "ps1", "sh") }
        )

        foreach ($scriptType in $scriptTypes) {
            foreach ($ext in $scriptType.Extensions) {
                $scriptFile = Join-Path $scriptsDir "$($scriptType.Name).$ext"
                if (Test-Path $scriptFile) {
                    $availableScripts += "$($scriptType.Name).$ext"
                }
            }
        }
    }

    return @{
        AppName = $AppName
        AppConfig = $AppConfig
        AppPath = $appPath
        ScriptsDir = $scriptsDir
        AvailableScripts = $availableScripts
        HasScripts = $availableScripts.Count -gt 0
    }
}

# Function to display enhanced app information with script detection
function Show-EnhancedAppList {
    $registry = Get-AppRegistry
    if (-not $registry) {
        Write-Error "Failed to load application registry"
        return
    }

    Write-Host ""
    Write-Host "=== Enhanced Application List with Script Detection ===" -ForegroundColor Yellow
    Write-Host ""

    $sortedApps = @()
    foreach ($appProperty in $registry.apps.PSObject.Properties) {
        $appName = $appProperty.Name
        $appConfig = $appProperty.Value
        $appInfo = Get-AppWithScriptInfo -AppConfig $appConfig -AppName $appName
        $sortedApps += $appInfo
    }
    $sortedApps = $sortedApps | Sort-Object { [int]$_.AppConfig.id }

    Write-Host "Found $($sortedApps.Count) applications:" -ForegroundColor Green
    Write-Host ""

    foreach ($appInfo in $sortedApps) {
        $appConfig = $appInfo.AppConfig
        $description = $appConfig.description
        if ($description.Length -gt 40) {
            $description = $description.Substring(0, 37) + "..."
        }

        $scriptsInfo = ""
        if ($appInfo.HasScripts) {
            $scriptsInfo = " [Scripts: $($appInfo.AvailableScripts -join ', ')]"
        } else {
            $scriptsInfo = " [No scripts found]"
        }

        Write-Host "$($appConfig.id): $($appInfo.AppName) ($($appConfig.type)) '$description'" -ForegroundColor Cyan
        Write-Host "   Path: $($appInfo.AppPath)" -ForegroundColor Gray

        if ($appInfo.HasScripts) {
            Write-Host "   Scripts: $($appInfo.AvailableScripts -join ', ')" -ForegroundColor Green
        } else {
            Write-Host "   Scripts: None found in $($appInfo.ScriptsDir)" -ForegroundColor Red
        }
        Write-Host ""
    }
}

# Functions are available when this script is dot-sourced
