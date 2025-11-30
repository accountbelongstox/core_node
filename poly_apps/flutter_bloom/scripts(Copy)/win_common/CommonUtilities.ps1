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

# Common Utilities for Flutter Bloom Development Scripts
# Consolidates shared functionality across all development scripts
# Author: Development Script System
# Version: 1.0

# Import required modules
$WinCommonDir = $PSScriptRoot
. (Join-Path $WinCommonDir "FlutterGlobalVar.ps1")
. (Join-Path $WinCommonDir "FlutterLogManager.ps1")

# Import Python package installer
$packageInstallerDir = Join-Path $WinCommonDir "python_package_installer"
$packageInstallerPath = Join-Path $packageInstallerDir "package_installer.ps1"
if (Test-Path $packageInstallerPath) {
    . $packageInstallerPath
} else {
    Write-Warning "[COMMONUTILITIES] Python package installer not found at: $packageInstallerPath"
}

# Global variables
$Global:FLUTTER_DEFAULT_WEB_PORT = 10000
$Global:FLUTTER_DEFAULT_DEBUG_PORT = 10080
$Global:FLUTTER_PORT_RANGE_START = 10000
$Global:FLUTTER_PORT_RANGE_END = 10099

#region Network and IP Functions

function Get-NetworkIPs {
    <#
    .SYNOPSIS
    Get all available network IP addresses for Flutter web server binding

    .RETURNS
    Array of IP addresses suitable for network access
    #>

    $ips = @()
    try {
        $networkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
            $_.IPAddress -ne "127.0.0.1" -and
            ($_.PrefixOrigin -eq "Dhcp" -or $_.PrefixOrigin -eq "Manual")
        }
        foreach ($adapter in $networkAdapters) {
            if ($adapter.IPAddress -match "^(\d{1,3}\.){3}\d{1,3}$") {
                $ips += $adapter.IPAddress
            }
        }
    }
    catch {
        Write-Warning "Failed to get network adapters: $($_.Exception.Message)"
    }
    
    # Always include localhost as fallback
    if ($ips -notcontains "127.0.0.1") {
        $ips += "127.0.0.1"
    }
    
    return $ips
}

function Get-LocalIPAddress {
    <#
    .SYNOPSIS
    Get the primary local IP address for network access

    .RETURNS
    Primary local IP address or 127.0.0.1 as fallback
    #>

    $ips = Get-NetworkIPs
    
    # Prefer non-localhost addresses
    $nonLocalhost = $ips | Where-Object { $_ -ne "127.0.0.1" }
    if ($nonLocalhost) {
        return $nonLocalhost[0]
    }
    
    return "127.0.0.1"
}

function Test-PortAvailable {
    <#
    .SYNOPSIS
    Test if a port is available for binding

    .PARAMETER Port
    Port number to test

    .RETURNS
    True if port is available, False otherwise
    #>
    param(
        [Parameter(Mandatory=$true)]
        [int]$Port
    )

    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Any, $Port)
        $listener.Start()
        $listener.Stop()
        return $true
    }
    catch {
        return $false
    }
}

function Get-AvailablePort {
    <#
    .SYNOPSIS
    Get an available port within the specified range

    .PARAMETER StartPort
    Starting port number (default: 10000)

    .PARAMETER EndPort
    Ending port number (default: 10099)

    .RETURNS
    Available port number or -1 if none found
    #>
    param(
        [int]$StartPort = $Global:FLUTTER_PORT_RANGE_START,
        [int]$EndPort = $Global:FLUTTER_PORT_RANGE_END
    )

    for ($port = $StartPort; $port -le $EndPort; $port++) {
        if (Test-PortAvailable -Port $port) {
            return $port
        }
    }
    
    return -1
}

#endregion

#region App Index and Port Management

function Get-AppIndex {
    <#
    .SYNOPSIS
    Get the index number for a Flutter app

    .PARAMETER AppName
    Name of the Flutter app

    .RETURNS
    Index number for the app
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName
    )

    # Define app index mapping
    $appIndexMap = @{
        "app_main" = 0
        "app_achat" = 1
        "app_bank" = 2
        "app_example" = 3
        "app_wuy" = 4
    }

    if ($appIndexMap.ContainsKey($AppName)) {
        return $appIndexMap[$AppName]
    }
    
    # For unknown apps, use hash-based index
    $hash = $AppName.GetHashCode()
    return [Math]::Abs($hash) % 100
}

function Get-AppPort {
    <#
    .SYNOPSIS
    Get the assigned port for a Flutter app

    .PARAMETER AppName
    Name of the Flutter app

    .RETURNS
    Port number for the app
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName
    )

    $appIndex = Get-AppIndex -AppName $AppName
    $assignedPort = $Global:FLUTTER_PORT_RANGE_START + $appIndex
    
    # Ensure port is within range
    if ($assignedPort -gt $Global:FLUTTER_PORT_RANGE_END) {
        $assignedPort = $Global:FLUTTER_PORT_RANGE_START + ($appIndex % ($Global:FLUTTER_PORT_RANGE_END - $Global:FLUTTER_PORT_RANGE_START + 1))
    }
    
    return $assignedPort
}

function Get-AppPortWithFallback {
    <#
    .SYNOPSIS
    Get an available port for a Flutter app with fallback

    .PARAMETER AppName
    Name of the Flutter app

    .RETURNS
    Available port number for the app
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName
    )

    $preferredPort = Get-AppPort -AppName $AppName
    
    if (Test-PortAvailable -Port $preferredPort) {
        return $preferredPort
    }
    
    # Find alternative port
    $alternativePort = Get-AvailablePort
    if ($alternativePort -ne -1) {
        Write-Warning "Preferred port $preferredPort for $AppName is not available, using $alternativePort"
        return $alternativePort
    }
    
    Write-Error "No available ports found for $AppName"
    return -1
}

#endregion

#region File Variable Exchange System





#endregion

#region Menu Functions

function Show-CompilationMenu {
    <#
    .SYNOPSIS
    Display compilation options menu with interactive selection

    .RETURNS
    Selected compilation option object with Name and Value properties
    #>

    $options = $Global:COMPILATION_OPTIONS
    $selectedIndex = 0
    $showMenu = $true

    # Load last selection from file variable
    $lastSelection = Get-FileVariable -Name $Global:KEY_LAST_COMPILATION_MENU_SELECTION -DefaultValue ""
    if ($lastSelection) {
        for ($i = 0; $i -lt $options.Count; $i++) {
            if ($options[$i].Value -eq $lastSelection) {
                $selectedIndex = $i
                break
            }
        }
    }

    while ($showMenu) {
        Clear-Host
        Write-Host "[BUILD-MAIN] Flutter Bloom Build System" -ForegroundColor Green
        Write-Host "======================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "BUILD COMPILATION MENU" -ForegroundColor Yellow
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "Working Directory: $($PWD.Path)" -ForegroundColor White
        Write-Host ""
        Write-Host "Select compilation option:" -ForegroundColor White
        Write-Host "Use UP/DOWN arrows to navigate, ENTER to select, Y for default (Debug), ESC to cancel" -ForegroundColor Gray
        Write-Host ""

        # Display menu options
        for ($i = 0; $i -lt $options.Count; $i++) {
            $prefix = if ($i -eq $selectedIndex) { ">>>" } else { "   " }
            $optionText = $options[$i].Name
            if ($i -eq $selectedIndex) {
                Write-Host "$prefix $optionText" -ForegroundColor Green
            } else {
                Write-Host "$prefix $optionText" -ForegroundColor White
            }
        }

        Write-Host ""
        Write-Host "Selected: $($options[$selectedIndex].Name)" -ForegroundColor Cyan

        # Get key input
        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

        switch ($key.VirtualKeyCode) {
            38 { # Up arrow
                $selectedIndex = ($selectedIndex - 1 + $options.Count) % $options.Count
            }
            40 { # Down arrow
                $selectedIndex = ($selectedIndex + 1) % $options.Count
            }
            13 { # Enter
                $selectedOption = $options[$selectedIndex]
                # Save selection for next time
                Set-FileVariable -Name $Global:KEY_LAST_COMPILATION_MENU_SELECTION -Value $selectedOption.Value
                $showMenu = $false
            }
            89 { # Y key - select default (Debug)
                $debugIndex = 0
                for ($i = 0; $i -lt $options.Count; $i++) {
                    if ($options[$i].Value -eq "debug") {
                        $debugIndex = $i
                        break
                    }
                }
                $selectedOption = $options[$debugIndex]
                # Save selection for next time
                Set-FileVariable -Name $Global:KEY_LAST_COMPILATION_MENU_SELECTION -Value $selectedOption.Value
                $showMenu = $false
            }
            27 { # ESC
                Write-Host ""
                Write-Host "[BUILD-CANCELLED] Build cancelled by user" -ForegroundColor Red
                return $null
            }
        }
    }

    return $selectedOption
}

#endregion

#region ADB Device Management Functions

function Test-ADBAvailable {
    <#
    .SYNOPSIS
    Check if ADB is available in the system PATH

    .RETURNS
    Boolean indicating if ADB is available
    #>
    
    try {
        $result = & adb version 2>$null
        return $LASTEXITCODE -eq 0
    }
    catch {
        return $false
    }
}

function Get-ADBPath {
    <#
    .SYNOPSIS
    Get the full path to the ADB executable

    .RETURNS
    Full path to ADB executable or null if not found
    #>
    
    try {
        $adbPath = Get-Command adb -ErrorAction SilentlyContinue
        if ($adbPath) {
            return $adbPath.Source
        }
        return $null
    }
    catch {
        return $null
    }
}

function Get-ADBDevices {
    <#
    .SYNOPSIS
    Get list of connected ADB devices

    .RETURNS
    Array of device objects with ID, Status, and Info properties
    #>
    
    if (-not (Test-ADBAvailable)) {
        return @()
    }

    try {
        $output = & adb devices 2>$null
        if ($LASTEXITCODE -ne 0) {
            return @()
        }

        $devices = @()
        $lines = $output | Where-Object { $_ -match '\t' }
        
        foreach ($line in $lines) {
            $parts = $line -split '\t'
            if ($parts.Count -ge 2) {
                $deviceId = $parts[0].Trim()
                $status = $parts[1].Trim()
                
                $devices += [PSCustomObject]@{
                    ID = $deviceId
                    Status = $status
                    Info = "$deviceId ($status)"
                }
            }
        }

        return $devices
    }
    catch {
        Write-Warning "Failed to get ADB devices: $($_.Exception.Message)"
        return @()
    }
}

function Show-ADBDeviceInfo {
    <#
    .SYNOPSIS
    Display ADB device information

    .PARAMETER Devices
    Array of device objects to display
    #>
    param(
        [Parameter(Mandatory=$true)]
        [array]$Devices
    )

    Write-Host ""
    Write-Host "[ADB] Device Detection Results:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    # Show ADB path information
    $adbPath = Get-ADBPath
    if ($adbPath) {
        Write-Host "  ADB Path: $adbPath" -ForegroundColor Green
    } else {
        Write-Host "  ADB Path: Not found in PATH" -ForegroundColor Red
    }

    if ($Devices.Count -eq 0) {
        if (Test-ADBAvailable) {
            Write-Host "  No ADB devices detected" -ForegroundColor Yellow
            Write-Host "  Make sure USB debugging is enabled on your device" -ForegroundColor Yellow
        } else {
            Write-Host "  ADB is not available in PATH" -ForegroundColor Red
            Write-Host "  Install Android SDK platform-tools to enable ADB" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  Found $($Devices.Count) device(s):" -ForegroundColor Green
        for ($i = 0; $i -lt $Devices.Count; $i++) {
            $device = $Devices[$i]
            $statusIcon = if ($device.Status -eq "device") { "[OK]" } else { "[WARN]" }
            Write-Host "    $($i + 1). $statusIcon $($device.Info)" -ForegroundColor White
        }
    }
    Write-Host ""
}

#endregion

#endregion

#region Python Environment Management Functions

function Invoke-PythonPackageCheck {
    <#
    .SYNOPSIS
    Check and install required Python packages for Flutter Bloom build system

    .PARAMETER Force
    Force reinstallation of all packages

    .PARAMETER Quiet
    Suppress verbose output during installation

    .RETURNS
    Boolean indicating success or failure of package check and installation
    #>
    [CmdletBinding()]
    param(
        [switch]$Force,
        [switch]$Quiet
    )

    Write-ColorMessage -Message "[PYTHON-SETUP] Checking Python package requirements..." -Type "Info"

    try {
        $result = Invoke-PythonPackageDetectionAndInstall -Force:$Force -Quiet:$Quiet

        if ($result) {
            Write-ColorMessage -Message "[PYTHON-SETUP] Python environment setup completed successfully" -Type "Success"
        } else {
            Write-ColorMessage -Message "[PYTHON-SETUP] Python environment setup failed" -Type "Error"
        }

        return $result
    }
    catch {
        Write-ColorMessage -Message "[PYTHON-SETUP] Error during Python package check: $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

function Assert-PythonEnvironment {
    <#
    .SYNOPSIS
    Verify that Python environment is properly set up with required packages

    .PARAMETER AutoFix
    Automatically install missing packages if found

    .RETURNS
    Boolean indicating whether Python environment is ready
    #>
    [CmdletBinding()]
    param(
        [switch]$AutoFix
    )

    # Check Python availability
    try {
        $pythonVersion = & python --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Python command failed"
        }
        Write-ColorMessage -Message "[PYTHON-SETUP] Python detected: $pythonVersion" -Type "Success"
    }
    catch {
        Write-ColorMessage -Message "[PYTHON-SETUP] Python is not installed or not available in PATH" -Type "Error"
        return $false
    }

    # Check package requirements
    if ($AutoFix) {
        return Invoke-PythonPackageCheck -Quiet:$true
    }
    else {
        # Quick check without installation
        $packageInstallerDir = Join-Path $PSScriptRoot "python_package_installer"
        $detectorScript = Join-Path $packageInstallerDir "package_detector.py"

        if (Test-Path $detectorScript) {
            $detectionOutput = & python "$detectorScript" 2>$null
            $missingPackages = @()

            if ($detectionOutput) {
                $missingPackages = $detectionOutput | Where-Object { $_.Trim() -ne "" }
            }

            if ($missingPackages.Count -eq 0) {
                Write-ColorMessage -Message "[PYTHON-SETUP] All required Python packages are available" -Type "Success"
                return $true
            }
            else {
                Write-ColorMessage -Message "[PYTHON-SETUP] Missing Python packages: $($missingPackages -join ', ')" -Type "Warning"
                Write-ColorMessage -Message "[PYTHON-SETUP] Run with -AutoFix to install missing packages" -Type "Info"
                return $false
            }
        }
        else {
            Write-ColorMessage -Message "[PYTHON-SETUP] Package detector script not found" -Type "Error"
            return $false
        }
    }
}

#endregion

#region Flutter Development Functions

function Assert-FlutterProject {
    <#
    .SYNOPSIS
    Verify that the specified path is a valid Flutter project

    .PARAMETER ProjectPath
    Path to check for Flutter project
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$ProjectPath
    )

    if (-not (Test-Path $ProjectPath)) {
        throw "Project path does not exist: $ProjectPath"
    }

    $pubspecPath = Join-Path $ProjectPath "pubspec.yaml"
    if (-not (Test-Path $pubspecPath)) {
        throw "Not a Flutter project - pubspec.yaml not found in: $ProjectPath"
    }

    $pubspecContent = Get-Content $pubspecPath -Raw
    if ($pubspecContent -notmatch "flutter:") {
        throw "Not a Flutter project - flutter dependency not found in pubspec.yaml"
    }
}

function Assert-FlutterEnvironment {
    <#
    .SYNOPSIS
    Verify that Flutter environment is properly set up
    #>

    # Check if Flutter command is available
    try {
        $flutterVersion = flutter --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Flutter command failed"
        }
    }
    catch {
        throw "Flutter is not installed or not available in PATH. Please install Flutter SDK."
    }
}

function Get-NextAvailablePort {
    <#
    .SYNOPSIS
    Get next available port for an app

    .PARAMETER AppName
    Application name to get port for

    .RETURNS
    Available port number
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName
    )

    return Get-AppPortWithFallback -AppName $AppName
}


function Show-NetworkURLs {
    <#
    .SYNOPSIS
    Display network URLs for debugging

    .PARAMETER Port
    Port number

    .PARAMETER Title
    Display title

    .PARAMETER ShowCopyHint
    Show copy hint
    #>
    param(
        [Parameter(Mandatory=$true)]
        [int]$Port,

        [string]$Title = "Network URLs",

        [bool]$ShowCopyHint = $false
    )

    Write-Host ""
    Write-Host $Title -ForegroundColor Green
    Write-Host ("=" * $Title.Length) -ForegroundColor Cyan

    $ips = Get-NetworkIPs
    foreach ($ip in $ips) {
        Write-Host "  http://$ip`:$Port" -ForegroundColor Yellow
    }

    Write-Host "  http://localhost:$Port" -ForegroundColor Yellow

    if ($ShowCopyHint) {
        Write-Host ""
        Write-Host "[TIP] Copy these URLs to test on other devices on the same network" -ForegroundColor Cyan
    }
}

function Write-ColorMessage {
    <#
    .SYNOPSIS
    Write colored message based on type

    .PARAMETER Message
    Message to display

    .PARAMETER Type
    Message type (Info, Success, Warning, Error, Command)
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,

        [ValidateSet("Info", "Success", "Warning", "Error", "Command")]
        [string]$Type = "Info"
    )

    switch ($Type) {
        "Info"    { Write-Host $Message -ForegroundColor Cyan }
        "Success" { Write-Host $Message -ForegroundColor Green }
        "Warning" { Write-Host $Message -ForegroundColor Yellow }
        "Error"   { Write-Host $Message -ForegroundColor Red }
        "Command" { Write-Host $Message -ForegroundColor Magenta }
    }
}

function Build-FlutterCommand {
    <#
    .SYNOPSIS
    Build Flutter command string

    .PARAMETER Action
    Flutter action (run, build)

    .PARAMETER Platform
    Target platform

    .PARAMETER EntryFile
    Entry file path

    .PARAMETER Port
    Port number (for web)

    .PARAMETER HostName
    Host name (for web server)

    .PARAMETER BuildMode
    Build mode (--debug, --release)

    .RETURNS
    Complete Flutter command string
    #>
    param(
        [Parameter(Mandatory=$true)]
        [string]$Action,

        [Parameter(Mandatory=$true)]
        [string]$Platform,

        [string]$EntryFile = "",
        [int]$Port = 0,
        [string]$HostName = "",
        [string]$BuildMode = "--debug"
    )

    $command = "flutter $Action -d $Platform"

    if ($EntryFile) {
        $command += " --target `"$EntryFile`""
    }

    if ($Port -gt 0 -and $Platform -like "*web*") {
        $command += " --web-port $Port"
    }

    if ($HostName -and $Platform -like "*web*") {
        $command += " --web-hostname $HostName"
    }

    if ($BuildMode) {
        $command += " $BuildMode"
    }

    return $command
}

function Invoke-FlutterPubGet {
    <#
    .SYNOPSIS
    Run flutter pub get to update packages
    #>

    Write-Host "[INFO] Updating Flutter packages..." -ForegroundColor Cyan
    try {
        flutter pub get
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[SUCCESS] Packages updated successfully" -ForegroundColor Green
        } else {
            Write-Host "[WARNING] Package update completed with warnings" -ForegroundColor Yellow
        }
    }
    catch {
        Write-Host "[ERROR] Failed to update packages: $_" -ForegroundColor Red
    }
}

#endregion
