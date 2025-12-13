# Unified App Manager - Windows PowerShell Layer
# Execution layer that communicates with Python core through global variables
# PowerShell implementation with Windows-specific features

# Variable declarations - all at top
$ScriptPath = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RootDir = (Split-Path -Parent (Split-Path -Parent $ScriptPath))
$PythonCore = Join-Path $ScriptPath "core\unified_core.py"

# Global variables for UI state
$Script:AppsName = @()
$Script:AppsPath = @()
$Script:AppsType = @()
$Script:AppsFramework = @()
$Script:AppsPort = @()
$Script:AppsCommand = @()
$Script:AppsDebug = @()
$Script:CurrentIndex = 0
$Script:MaxAppNameWidth = 0

# Platform detection
$IsWindows = $true
$IsLinux = $false
$EnableSystemd = $false
$EnableNginx = $false
$EnableFirewall = $false
$EnableDomainProxy = $false

# Colors for console output
$Colors = @{
    Header = "Cyan"
    Success = "Green"
    Warning = "Yellow"
    Error = "Red"
    Info = "DarkGray"
    Highlight = "White"
    Reset = "Gray"
}

# Import global variable management library
. (Join-Path $ScriptPath "utils\global_variables.ps1")



# Logging functions
function Write-Header {
    param([string]$Message)
    Write-Host "=== $Message ===" -ForegroundColor $Colors.Header
}

function Write-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor $Colors.Success
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠ $Message" -ForegroundColor $Colors.Warning
}

function Write-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor $Colors.Error
}

function Write-Info {
    param([string]$Message)
    Write-Host $Message -ForegroundColor $Colors.Info
}

function Write-Highlight {
    param([string]$Message)
    Write-Host $Message -ForegroundColor $Colors.Highlight
}

# Python core communication
function Invoke-PythonCore {
    param(
        [string]$Action,
        [string[]]$Arguments = @()
    )

    if (-not (Test-Path $PythonCore)) {
        Write-Error "Python core not found: $PythonCore"
        return $false
    }

    # Check for Python 3
    $PythonCmd = $null
    foreach ($cmd in @("python", "python3", "py")) {
        try {
            $version = & $cmd --version 2>$null
            if ($version -match "Python 3") {
                $PythonCmd = $cmd
                break
            }
        }
        catch {
            continue
        }
    }

    if (-not $PythonCmd) {
        Write-Error "Python 3 is required but not found"
        return $false
    }

    try {
        $AllArgs = @($PythonCore, $Action) + $Arguments
        & $PythonCmd @AllArgs

        $Status = Read-GlobalVar -Key $Script:VariableKeys.STATUS
        if ($Status -like "error_*") {
            $ErrorMsg = $Status -replace "^error_", ""
            Write-Error "Python core error: $ErrorMsg"
            return $false
        }

        return $true
    }
    catch {
        Write-Error "Failed to execute Python core: $($_.Exception.Message)"
        return $false
    }
}

# Load application data from file variables
function Get-AppData {
    $AppCount = Read-GlobalAppCount

    $Script:AppsName = @()
    $Script:AppsPath = @()
    $Script:AppsType = @()
    $Script:AppsFramework = @()
    $Script:AppsPort = @()
    $Script:AppsCommand = @()
    $Script:AppsDebug = @()
    $Script:MaxAppNameWidth = 0

    for ($i = 0; $i -lt $AppCount; $i++) {
        $Name = Read-GlobalVar -Key (Get-AppVariableKey -Index $i -Property "NAME")
        $Path = Read-GlobalVar -Key (Get-AppVariableKey -Index $i -Property "PATH")
        $Type = Read-GlobalVar -Key (Get-AppVariableKey -Index $i -Property "TYPE")
        $Framework = Read-GlobalVar -Key (Get-AppVariableKey -Index $i -Property "FRAMEWORK")
        $Port = Read-GlobalVar -Key (Get-AppVariableKey -Index $i -Property "PORT")
        $Command = Read-GlobalVar -Key (Get-AppVariableKey -Index $i -Property "COMMAND")
        $Debug = Read-GlobalVar -Key (Get-AppVariableKey -Index $i -Property "DEBUG")

        $Script:AppsName += $Name
        $Script:AppsPath += $Path
        $Script:AppsType += $Type
        $Script:AppsFramework += $Framework
        $Script:AppsPort += $Port
        $Script:AppsCommand += $Command
        $Script:AppsDebug += $Debug

        # Calculate max width for display
        if ($Name.Length -gt $Script:MaxAppNameWidth) {
            $Script:MaxAppNameWidth = $Name.Length
        }
    }
}

# Load platform capabilities
function Get-PlatformCapabilities {
    $Script:IsWindows = Read-GlobalVarAsBool -Key $Script:VariableKeys.IS_WINDOWS -Default $true
    $Script:IsLinux = Read-GlobalVarAsBool -Key $Script:VariableKeys.IS_LINUX -Default $false
    $Script:EnableSystemd = Read-GlobalVarAsBool -Key $Script:VariableKeys.ENABLE_SYSTEMD -Default $false
    $Script:EnableNginx = Read-GlobalVarAsBool -Key $Script:VariableKeys.ENABLE_NGINX -Default $false
    $Script:EnableFirewall = Read-GlobalVarAsBool -Key $Script:VariableKeys.ENABLE_FIREWALL -Default $false
    $Script:EnableDomainProxy = Read-GlobalVarAsBool -Key $Script:VariableKeys.ENABLE_DOMAIN_PROXY -Default $false
}

# Scan applications using Python core
function Start-ApplicationScan {
    Write-Header "Starting Application Scan"

    if (Invoke-PythonCore "scan") {
        Get-AppData
        Get-PlatformCapabilities
        Write-Success "Scan complete - found $($Script:AppsName.Count) applications"
        return $true
    }
    else {
        Write-Error "Failed to scan applications"
        return $false
    }
}

# Show main menu
function Show-Menu {
    Clear-Host
    Write-Header "dd.sh Unified App Manager >16 (Python Core)"
    Write-Info "Platform: Windows | Root: $RootDir"
    Write-Host ""

    if ($Script:AppsName.Count -eq 0) {
        Write-Error "No applications found"
        return
    }

    # Calculate column widths
    $NameWidth = [Math]::Max($Script:MaxAppNameWidth, 8)

    Write-Warning "Application List:"

    # Header
    $HeaderFormat = "No. | {0,-$NameWidth} | {1,-11} | {2,-14} | Port  | Debug"
    Write-Host ($HeaderFormat -f "App Name", "Type", "Framework")

    $SeparatorLine = "----|{0}|-------------|----------------|-------|------" -f ("-" * ($NameWidth + 2))
    Write-Host $SeparatorLine

    # App list
    for ($i = 0; $i -lt $Script:AppsName.Count; $i++) {
        $Indicator = " "
        $Color = $Colors.Highlight

        if ($i -eq $Script:CurrentIndex) {
            $Indicator = ">"
            $Color = $Colors.Warning
        }

        $LineFormat = "{0}{1,2} | {2,-$NameWidth} | {3,-11} | {4,-14} | {5,-5} | {6}"
        $Line = $LineFormat -f $Indicator, ($i + 1), $Script:AppsName[$i], $Script:AppsType[$i], $Script:AppsFramework[$i], $Script:AppsPort[$i], $Script:AppsDebug[$i]

        Write-Host $Line -ForegroundColor $Color
    }

    Write-Host ""
    Write-Warning "Controls:"
    Write-Host "Enter app number to select | L: Launch | R: Rescan | Q: Quit"
    Write-Host ""
    Write-Host "Enter app number (1-$($Script:AppsName.Count)) or command: " -ForegroundColor $Colors.Header -NoNewline
}

# Launch current application
function Start-CurrentApp {
    if ($Script:AppsName.Count -eq 0) {
        Write-Error "No applications available"
        return $false
    }

    $AppName = $Script:AppsName[$Script:CurrentIndex]
    $Command = $Script:AppsCommand[$Script:CurrentIndex]

    if ([string]::IsNullOrEmpty($Command)) {
        Write-Error "No command generated for $AppName"
        return $false
    }

    Write-Header "Launching $AppName"
    Write-Info "Command: $Command"
    Write-Info "Port: $($Script:AppsPort[$Script:CurrentIndex])"
    Write-Info "Debug Mode: $($Script:AppsDebug[$Script:CurrentIndex])"
    Write-Host ""

    # Convert Unix-style paths to Windows paths if needed
    $WindowsCommand = $Command -replace "/", "\"

    # Parse and execute the command
    # Handle different command formats for Windows
    if ($WindowsCommand -match "^cd\s+`"([^`"]+)`"\s+&&\s+(.+)$") {
        $WorkingDir = $Matches[1]
        $ActualCommand = $Matches[2]

        Write-Info "Working Directory: $WorkingDir"
        Write-Info "Executing: $ActualCommand"

        try {
            Push-Location $WorkingDir
            Invoke-Expression $ActualCommand
        }
        catch {
            Write-Error "Failed to execute command: $($_.Exception.Message)"
            return $false
        }
        finally {
            Pop-Location
        }
    }
    else {
        # Direct execution
        try {
            Invoke-Expression $WindowsCommand
        }
        catch {
            Write-Error "Failed to execute command: $($_.Exception.Message)"
            return $false
        }
    }

    return $true
}

# Main program loop
function Start-MainLoop {
    # Initial scan
    if (-not (Start-ApplicationScan)) {
        Write-Error "Initial application scan failed"
        exit 1
    }

    while ($true) {
        Show-Menu

        # Read user input
        $Input = Read-Host
        $InputUpper = $Input.ToUpper()

        # Handle numeric input (app selection)
        if ($Input -match "^\d+$") {
            $AppNum = [int]$Input
            $AppIndex = $AppNum - 1

            if ($AppIndex -ge 0 -and $AppIndex -lt $Script:AppsName.Count) {
                $Script:CurrentIndex = $AppIndex
                Write-Success "Selected app #$AppNum`: $($Script:AppsName[$AppIndex])"
                Start-Sleep 1
            }
            else {
                Write-Error "Invalid app number: $AppNum"
                Start-Sleep 1
            }
        }
        # Handle commands
        elseif ($InputUpper -eq "L") {
            Start-CurrentApp
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor $Colors.Warning
            [Console]::ReadKey() | Out-Null
        }
        elseif ($InputUpper -eq "R") {
            if (Start-ApplicationScan) {
                Write-Success "Application list updated"
            }
            else {
                Write-Error "Failed to rescan applications"
            }
            Start-Sleep 1
        }
        elseif ($InputUpper -eq "Q" -or $InputUpper -eq "QUIT" -or $InputUpper -eq "EXIT") {
            Write-Warning "Exiting program"
            exit 0
        }
        elseif ([string]::IsNullOrEmpty($Input)) {
            # Empty input, launch current app
            Start-CurrentApp
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor $Colors.Warning
            [Console]::ReadKey() | Out-Null
        }
        else {
            Write-Error "Unknown command: $Input"
            Write-Info "Valid commands: L (launch), R (rescan), Q (quit)"
            Write-Info "Or enter an app number (1-$($Script:AppsName.Count))"
            Start-Sleep 2
        }
    }
}

# Entry point
try {
    Start-MainLoop
}
catch {
    Write-Error "Unhandled error: $($_.Exception.Message)"
    exit 1
}