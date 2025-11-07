# Node.js Version Manager and Dependency Upgrade Script for Windows
# Author: Assistant
# Description: Manages Node.js versions and upgrades dependencies with detailed guidance using Chocolatey

param(
    [string]$TargetDirectory = ""
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Save initial working directory
$InitialDir = Get-Location
$WorkDir = ""
$TargetDirArg = $TargetDirectory

# Determine Windows version for Chocolatey directory
function Get-WindowsVersionInfo {
    try {
        # Get OS information
        $osInfo = Get-WmiObject Win32_OperatingSystem
        $version = $osInfo.Version
        $buildNumber = $osInfo.BuildNumber
        $caption = $osInfo.Caption
        
        Write-LogInfo "Detected OS: $caption (Version: $version, Build: $buildNumber)"
        
        # Enhanced version detection logic
        $versionShort = switch -Wildcard ($version) {
            "10.0.*" {
                # Windows 10 vs Windows 11 detection based on build number
                # Build number ranges:
                # Windows 10: 10240-19045 (and some newer builds)
                # Windows 11: 22000+ (official release)
                # Windows 11 Dev/Beta: 22500+ (newer builds)
                if ([int]$buildNumber -ge 22000) {
                    if ([int]$buildNumber -ge 22500) {
                        Write-LogInfo "Windows 11 (Insider/Dev) detected (Build $buildNumber >= 22500)"
                    } else {
                        Write-LogInfo "Windows 11 detected (Build $buildNumber >= 22000)"
                    }
                    "11"
                } else {
                    Write-LogInfo "Windows 10 detected (Build $buildNumber < 22000)"
                    "10"
                }
            }
            "6.3.*" {
                Write-LogInfo "Windows 8.1 detected"
                "8"
            }
            "6.2.*" {
                Write-LogInfo "Windows 8 detected"
                "8"
            }
            "6.1.*" {
                Write-LogInfo "Windows 7 detected"
                "7"
            }
            default {
                # For newer versions or unknown, try to determine from caption
                if ($caption -like "*Windows 11*") {
                    Write-LogInfo "Windows 11 detected from caption"
                    "11"
                } elseif ($caption -like "*Windows 10*") {
                    Write-LogInfo "Windows 10 detected from caption"
                    "10"
                } else {
                    Write-LogWarning "Unknown Windows version: $version, defaulting to 11"
                    "11"
                }
            }
        }
        
        return @{
            Version = $version
            BuildNumber = $buildNumber
            Caption = $caption
            VersionShort = $versionShort
        }
    } catch {
        Write-LogWarning "Failed to detect Windows version, using fallback method"
        
        # Fallback: Try using registry
        try {
            $regVersion = Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion" -ErrorAction SilentlyContinue
            if ($regVersion) {
                $productName = $regVersion.ProductName
                $currentBuild = $regVersion.CurrentBuild
                
                Write-LogInfo "Registry detection: $productName (Build: $currentBuild)"
                
                # Enhanced registry-based detection
                if ($productName -like "*Windows 11*") {
                    Write-LogInfo "Windows 11 detected from registry ProductName"
                    $versionShort = "11"
                } elseif ([int]$currentBuild -ge 22000) {
                    Write-LogInfo "Windows 11 detected from registry build number ($currentBuild >= 22000)"
                    $versionShort = "11"
                } elseif ($productName -like "*Windows 10*") {
                    Write-LogInfo "Windows 10 detected from registry ProductName"
                    $versionShort = "10"
                } elseif ($productName -like "*Windows 8*") {
                    Write-LogInfo "Windows 8/8.1 detected from registry"
                    $versionShort = "8"
                } elseif ($productName -like "*Windows 7*") {
                    Write-LogInfo "Windows 7 detected from registry"
                    $versionShort = "7"
                } else {
                    Write-LogWarning "Unknown Windows version from registry: $productName"
                    $versionShort = "11"
                }
                
                return @{
                    Version = "Registry: $($regVersion.CurrentVersion)"
                    BuildNumber = $currentBuild
                    Caption = $productName
                    VersionShort = $versionShort
                }
            }
        } catch {
            Write-LogWarning "Registry detection also failed"
        }
        
        # Final fallback
        Write-LogWarning "Using final fallback: Windows 11"
        return @{
            Version = "Unknown"
            BuildNumber = "Unknown"
            Caption = "Unknown Windows"
            VersionShort = "11"
        }
    }
}

$WinInfo = Get-WindowsVersionInfo
$WinVersion = $WinInfo.Version
$WinVersionShort = $WinInfo.VersionShort
$WinCaption = $WinInfo.Caption
$WinBuildNumber = $WinInfo.BuildNumber

# Set Chocolatey install directory
$ChocolateyInstallDir = "D:\.dev_win$WinVersionShort\node_via_choco"

# Color codes for output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$ForegroundColor = "White"
    )
    Write-Host $Message -ForegroundColor $ForegroundColor
}

# Logging functions
function Write-LogInfo {
    param([string]$Message)
    Write-ColorOutput "[INFO] $Message" "Cyan"
}

function Write-LogSuccess {
    param([string]$Message)
    Write-ColorOutput "[SUCCESS] $Message" "Green"
}

function Write-LogWarning {
    param([string]$Message)
    Write-ColorOutput "[WARNING] $Message" "Yellow"
}

function Write-LogError {
    param([string]$Message)
    Write-ColorOutput "[ERROR] $Message" "Red"
}

function Write-LogStep {
    param([string]$Message)
    Write-ColorOutput "[STEP] $Message" "Magenta"
}

function Write-LogReason {
    param([string]$Message)
    Write-ColorOutput "[REASON] $Message" "DarkCyan"
}

# Banner
function Show-Banner {
    Write-ColorOutput "" "Green"
    Write-ColorOutput "============================================================================================================" "Green"
    Write-ColorOutput "|          Node.js Version Manager & Upgrader             |" "Green"
    Write-ColorOutput "|                    Windows Edition                      |" "Green"
    Write-ColorOutput "| Safely upgrade dependencies across Node.js versions    |" "Green"
    Write-ColorOutput "============================================================================================================" "Green"
    Write-ColorOutput "" "Green"
}

# Working directory selection and validation
function Select-WorkingDirectory {
    if ($TargetDirArg) {
        $script:WorkDir = $TargetDirArg
        Write-LogInfo "Using directory from parameter: $script:WorkDir"
    } else {
        Write-ColorOutput "`n========= Working Directory Selection =========" "Yellow"
        Write-LogReason "Choose the directory containing the Node.js project to upgrade"
        
        Write-Host "1) Current directory ($PWD)"
        Write-Host "2) Manual input"
        Write-Host ""
        
        do {
            $dirChoice = Read-Host "Select working directory [1-2] (default: 1)"
            if ([string]::IsNullOrEmpty($dirChoice)) { $dirChoice = "1" }
        } while ($dirChoice -notin @("1", "2"))
        
        switch ($dirChoice) {
            "1" {
                $script:WorkDir = $PWD.Path
                Write-LogInfo "Using current directory: $script:WorkDir"
            }
            "2" {
                do {
                    $manualDir = Read-Host "Enter the full path to the Node.js project directory"
                } while ([string]::IsNullOrEmpty($manualDir))
                
                $script:WorkDir = $manualDir
                Write-LogInfo "Using manual input directory: $script:WorkDir"
            }
        }
    }
    
    # Validate and change to working directory
    if (-not (Test-Path $script:WorkDir)) {
        Write-LogError "Directory does not exist: $script:WorkDir"
        Restore-InitialDirectory
        exit 1
    }
    
    Write-LogStep "Changing to working directory: $script:WorkDir"
    try {
        Set-Location $script:WorkDir
        Write-LogSuccess "Working directory set to: $PWD"
    } catch {
        Write-LogError "Cannot change to directory: $script:WorkDir"
        Restore-InitialDirectory
        exit 1
    }
}

# Cleanup function to restore initial directory
function Restore-InitialDirectory {
    Write-LogStep "Restoring initial working directory: $InitialDir"
    try {
        Set-Location $InitialDir
    } catch {
        Write-LogWarning "Failed to restore initial directory: $InitialDir"
    }
}

# Setup Chocolatey environment
function Initialize-ChocolateyEnvironment {
    Write-LogStep "Setting up Chocolatey environment"
    Write-LogReason "Chocolatey will be used to manage multiple Node.js versions on Windows"
    
    # Validate Windows version detection first
    try {
        # Additional validation using different methods
        $osVersion = [System.Environment]::OSVersion
        Write-LogInfo "System validation - OS: $($osVersion.VersionString), Build: $($osVersion.Version.Build)"
        
        # Cross-validate with our detection
        if ($osVersion.Version.Major -eq 10 -and $osVersion.Version.Minor -eq 0) {
            if ($osVersion.Version.Build -ge 22000 -and $WinVersionShort -ne "11") {
                Write-LogWarning "Build $($osVersion.Version.Build) suggests Windows 11, but detected as Windows $WinVersionShort"
            } elseif ($osVersion.Version.Build -lt 22000 -and $WinVersionShort -ne "10") {
                Write-LogWarning "Build $($osVersion.Version.Build) suggests Windows 10, but detected as Windows $WinVersionShort"
            } else {
                Write-LogSuccess "Windows version detection validated: Windows $WinVersionShort"
            }
        }
         } catch {
         Write-LogWarning "Could not validate version detection`: $($_)"
     }
    
    # Ensure the directory exists
    if (-not (Test-Path $ChocolateyInstallDir)) {
        Write-LogInfo "Creating Chocolatey directory: $ChocolateyInstallDir"
        New-Item -Path $ChocolateyInstallDir -ItemType Directory -Force | Out-Null
    }
    
    # Set environment variable
    Write-LogInfo "Setting chocolateyInstall environment variable"
    $env:chocolateyInstall = $ChocolateyInstallDir
    [Environment]::SetEnvironmentVariable('chocolateyInstall', $ChocolateyInstallDir, 'Machine')
    
    Write-LogSuccess "Chocolatey environment configured to: $ChocolateyInstallDir"
}

# Install Chocolatey if not present
function Install-Chocolatey {
    Write-LogStep "Checking Chocolatey installation"
    
    $chocoPath = Join-Path $ChocolateyInstallDir "bin\choco.exe"
    if (Test-Path $chocoPath) {
        Write-LogSuccess "Chocolatey already installed at: $chocoPath"
        return $chocoPath
    }
    
    Write-LogInfo "Installing Chocolatey..."
    Write-LogReason "Chocolatey package manager is required to install different Node.js versions"
    
    try {
        & powershell -c "irm https://community.chocolatey.org/install.ps1|iex"
        Write-LogSuccess "Chocolatey installed successfully"
        return $chocoPath
    } catch {
        Write-LogError "Failed to install Chocolatey`: $($_)"
        Restore-InitialDirectory
        exit 1
    }
}

# Configure Chocolatey source
function Set-ChocolateySource {
    param([string]$Registry)
    
    $chocoPath = Join-Path $ChocolateyInstallDir "bin\choco.exe"
    
    Write-LogStep "Configuring Chocolatey source for $Registry"
    
    if ($Registry -eq "cn") {
        Write-LogInfo "Setting up China mirror for Chocolatey"
        try {
            & $chocoPath source add -n=chocolatey-china -s=https://chocolatey.org.cn/api/v2/ --priority=1
            & $chocoPath source disable -n=chocolatey
            Write-LogSuccess "China mirror configured for Chocolatey"
        } catch {
            Write-LogWarning "Failed to configure China mirror, using default source"
        }
    } else {
        Write-LogInfo "Using global Chocolatey source"
        try {
            & $chocoPath source enable -n=chocolatey
            Write-LogSuccess "Global source enabled for Chocolatey"
        } catch {
            Write-LogWarning "Failed to configure global source"
        }
    }
}

# Find executable paths
function Find-NodeExecutables {
    param([string]$Version)
    
    Write-LogInfo "Finding Node.js executables for version $Version"
    
    $nodePattern = "*$($Version.Split('.')[0])*"
    $searchDirs = @(
        (Join-Path $ChocolateyInstallDir "lib"),
        (Join-Path $ChocolateyInstallDir "bin")
    )
    
    $nodeExe = $null
    $npmExe = $null
    $yarnExe = $null
    
    foreach ($searchDir in $searchDirs) {
        if (Test-Path $searchDir) {
            # Find Node.js
            $nodeDirs = Get-ChildItem -Path $searchDir -Directory -Filter "*nodejs*" | Where-Object { $_.Name -like $nodePattern }
            foreach ($nodeDir in $nodeDirs) {
                $possibleNodeExe = Get-ChildItem -Path $nodeDir.FullName -Recurse -Name "node.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($possibleNodeExe) {
                    $nodeExe = Join-Path $nodeDir.FullName $possibleNodeExe
                    break
                }
            }
            
            # Find npm
            if ($nodeExe) {
                $nodeBaseDir = Split-Path $nodeExe
                $npmExe = Join-Path $nodeBaseDir "npm.cmd"
                if (-not (Test-Path $npmExe)) {
                    $npmExe = Join-Path $nodeBaseDir "npm.exe"
                }
            }
        }
    }
    
    # Find yarn using corepack
    if ($nodeExe) {
        $nodeBaseDir = Split-Path $nodeExe
        $yarnExe = Join-Path $nodeBaseDir "yarn.cmd"
        if (-not (Test-Path $yarnExe)) {
            $yarnExe = Join-Path $nodeBaseDir "yarn.exe"
        }
    }
    
    return @{
        Node = $nodeExe
        Npm = $npmExe
        Yarn = $yarnExe
    }
}

# Install Node.js version
function Install-NodeVersion {
    param([string]$Version, [string]$Registry)
    
    Write-LogStep "Installing Node.js version $Version"
    
    $chocoPath = Join-Path $ChocolateyInstallDir "bin\choco.exe"
    
    # Check if already installed
    $installedPackages = & $chocoPath list --local-only nodejs
    $versionInstalled = $installedPackages | Where-Object { $_ -like "*nodejs*$Version*" }
    
    if ($versionInstalled) {
        Write-LogSuccess "Node.js $Version already installed"
        return
    }
    
    Write-LogInfo "Installing Node.js $Version using Chocolatey..."
    Write-LogReason "Installing specific Node.js version for controlled upgrade process"
    
    try {
        if ($Registry -eq "cn") {
            # For China, may need to set additional parameters
            & $chocoPath install nodejs --version="$Version" -y --force
        } else {
            & $chocoPath install nodejs --version="$Version" -y --force
        }
        Write-LogSuccess "Node.js $Version installed successfully"
    } catch {
        Write-LogError "Failed to install Node.js $Version`: $($_)"
        Restore-InitialDirectory
        exit 1
    }
}

# Setup Node.js environment
function Set-NodeEnvironment {
    param([string]$Version, [string]$Purpose)
    
    Write-LogStep "Setting up Node.js $Version environment for $Purpose"
    
    $executables = Find-NodeExecutables -Version $Version
    
    if (-not $executables.Node -or -not (Test-Path $executables.Node)) {
        Write-LogError "Node.js executable not found for version $Version"
        Restore-InitialDirectory
        exit 1
    }
    
    # Set script-level variables for current session
    $script:CurrentNodeExe = $executables.Node
    $script:CurrentNpmExe = $executables.Npm
    $script:CurrentYarnExe = $executables.Yarn
    
    # Verify installation
    try {
        $nodeVersionOutput = & $script:CurrentNodeExe --version
        Write-LogInfo "Current Node.js version: $nodeVersionOutput"
        
        # Enable yarn using corepack
        Write-LogInfo "Enabling Yarn using corepack..."
        & $script:CurrentNodeExe (Join-Path (Split-Path $script:CurrentNodeExe) "..\node_modules\corepack\dist\corepack.js") enable yarn
        
        # Find yarn again after enabling
        $executables = Find-NodeExecutables -Version $Version
        $script:CurrentYarnExe = $executables.Yarn
        
        if ($script:CurrentYarnExe -and (Test-Path $script:CurrentYarnExe)) {
            $yarnVersionOutput = & $script:CurrentYarnExe --version
            Write-LogInfo "Current Yarn version: $yarnVersionOutput"
        }
        
        Write-LogSuccess "Node.js $Version environment configured successfully"
    } catch {
        Write-LogError "Failed to verify Node.js installation`: $($_)"
        Restore-InitialDirectory
        exit 1
    }
}

# Registry selection menu
function Select-Registry {
    Write-ColorOutput "`n========= NPM Registry Configuration =========" "Yellow"
    Write-LogReason "Choosing the right registry ensures faster downloads and better connectivity"
    
    Write-Host "1) Global (default npm registry)"
    Write-Host "2) CN (China - faster for Chinese users)"
    Write-Host ""
    
    do {
        $registryChoice = Read-Host "Select registry [1-2] (default: 1)"
        if ([string]::IsNullOrEmpty($registryChoice)) { $registryChoice = "1" }
    } while ($registryChoice -notin @("1", "2"))
    
    switch ($registryChoice) {
        "1" {
            $script:Registry = "global"
            $script:RegistryUrl = "https://registry.npmjs.org/"
            Write-LogInfo "Using global npm registry"
        }
        "2" {
            $script:Registry = "cn"
            $script:RegistryUrl = "https://registry.npmmirror.com/"
            Write-LogInfo "Using China npm mirror"
        }
    }
}

# Configure npm registry
function Set-NpmRegistry {
    Write-LogStep "Configuring npm registry to $script:RegistryUrl"
    Write-LogReason "Setting registry ensures all package downloads use the selected source"
    
    try {
        & $script:CurrentNpmExe config set registry $script:RegistryUrl
        & $script:CurrentYarnExe config set registry $script:RegistryUrl
        
        if ($script:Registry -eq "cn") {
            # Set additional China-specific configurations
            & $script:CurrentNpmExe config set disturl https://npmmirror.com/dist/
            & $script:CurrentNpmExe config set electron_mirror https://npmmirror.com/mirrors/electron/
            & $script:CurrentNpmExe config set electron_custom_dir 10.1.3
            Write-LogInfo "Applied China-specific npm optimizations"
        }
        
        Write-LogSuccess "Registry configured successfully"
    } catch {
        Write-LogError "Failed to configure npm registry`: $($_)"
        Restore-InitialDirectory
        exit 1
    }
}

# Parse engines from package.json
function Get-EnginesNodeVersion {
    if (Test-Path "package.json") {
        try {
            $packageJson = Get-Content "package.json" | ConvertFrom-Json
            if ($packageJson.engines -and $packageJson.engines.node) {
                $enginesNode = $packageJson.engines.node
                Write-LogInfo "Found engines.node in package.json: $enginesNode"
                
                # Parse version range to recommend a specific version
                if ($enginesNode -like "*>=16*" -or $enginesNode -like "*^16*") {
                    return "3" # 18.12.0 (safe upgrade from 16)
                } elseif ($enginesNode -like "*>=18*" -or $enginesNode -like "*^18*") {
                    return "3" # 18.12.0
                } elseif ($enginesNode -like "*>=20*" -or $enginesNode -like "*^20*") {
                    return "5" # 20.9.0
                } elseif ($enginesNode -like "*>=14*" -or $enginesNode -like "*^14*") {
                    return "1" # 16.14.0 (upgrade from 14)
                } else {
                    return "3" # Default to 18.12.0 LTS
                }
            } else {
                return "3" # Default to 18.12.0 LTS if no engines field
            }
        } catch {
            return "3" # Default to 18.12.0 LTS on error
        }
    } else {
        return "3" # Default to 18.12.0 LTS
    }
}

# Node version selection menu
function Select-NodeVersions {
    Write-ColorOutput "`n========= Node.js Version Selection =========" "Yellow"
    Write-LogReason "We'll install dependencies on an older Node version first, then upgrade on a newer version"
    Write-LogReason "This ensures maximum compatibility and catches version-specific issues"
    
    # Get recommended versions
    $recommendedOld = Get-EnginesNodeVersion
    $recommendedNew = "6" # 20.18.0 (Latest LTS)
    
    Write-Host ""
    Write-Host "Available Node.js versions:"
    Write-Host ""
    Write-Host "16.x series:"
    if ($recommendedOld -eq "1") {
        Write-Host "  1) 16.14.0 (LTS) ???Recommended for OLD"
    } else {
        Write-Host "  1) 16.14.0 (LTS)"
    }
    Write-Host "  2) 16.20.2 (Latest 16.x)"
    Write-Host ""
    Write-Host "18.x series:"
    if ($recommendedOld -eq "3") {
        Write-Host "  3) 18.12.0 (LTS) ???Recommended for OLD"
    } else {
        Write-Host "  3) 18.12.0 (LTS)"
    }
    Write-Host "  4) 18.20.4 (Latest 18.x)"
    Write-Host ""
    Write-Host "20.x series:"
    if ($recommendedOld -eq "5") {
        Write-Host "  5) 20.9.0 (LTS) ???Recommended for OLD"
    } else {
        Write-Host "  5) 20.9.0 (LTS)"
    }
    if ($recommendedNew -eq "6") {
        Write-Host "  6) 20.18.0 (Latest LTS) ???Recommended for NEW"
    } else {
        Write-Host "  6) 20.18.0 (Latest LTS)"
    }
    Write-Host ""
    Write-Host "22.x series:"
    Write-Host "  7) 22.9.0"
    Write-Host "  8) 22.15.0 (Latest)"
    Write-Host ""
    
    # Select old version
    do {
        $oldChoice = Read-Host "Select OLD Node.js version for initial installation [1-8] (default: $recommendedOld)"
        if ([string]::IsNullOrEmpty($oldChoice)) { $oldChoice = $recommendedOld }
    } while ($oldChoice -notin @("1", "2", "3", "4", "5", "6", "7", "8"))
    
    switch ($oldChoice) {
        "1" { $script:OldNodeVersion = "16.14.0" }
        "2" { $script:OldNodeVersion = "16.20.2" }
        "3" { $script:OldNodeVersion = "18.12.0" }
        "4" { $script:OldNodeVersion = "18.20.4" }
        "5" { $script:OldNodeVersion = "20.9.0" }
        "6" { $script:OldNodeVersion = "20.18.0" }
        "7" { $script:OldNodeVersion = "22.9.0" }
        "8" { $script:OldNodeVersion = "22.15.0" }
    }
    
    # Select new version
    do {
        $newChoice = Read-Host "Select NEW Node.js version for upgrade [1-8] (default: $recommendedNew)"
        if ([string]::IsNullOrEmpty($newChoice)) { $newChoice = $recommendedNew }
    } while ($newChoice -notin @("1", "2", "3", "4", "5", "6", "7", "8"))
    
    switch ($newChoice) {
        "1" { $script:NewNodeVersion = "16.14.0" }
        "2" { $script:NewNodeVersion = "16.20.2" }
        "3" { $script:NewNodeVersion = "18.12.0" }
        "4" { $script:NewNodeVersion = "18.20.4" }
        "5" { $script:NewNodeVersion = "20.9.0" }
        "6" { $script:NewNodeVersion = "20.18.0" }
        "7" { $script:NewNodeVersion = "22.9.0" }
        "8" { $script:NewNodeVersion = "22.15.0" }
    }
    
    Write-LogInfo "Selected versions:"
    Write-LogInfo "  Old (for initial install): Node.js $script:OldNodeVersion"
    Write-LogInfo "  New (for upgrade): Node.js $script:NewNodeVersion"
}

# Check prerequisites
function Test-Prerequisites {
    Write-LogStep "Checking prerequisites..."
    
    # Check if we're in a Node.js project
    if (-not (Test-Path "package.json")) {
        Write-LogError "package.json not found. Please run this script in a Node.js project root."
        Restore-InitialDirectory
        exit 1
    }
    
    Write-LogSuccess "All prerequisites are satisfied"
}

# Initialize Node.js versions
function Initialize-NodeVersions {
    Write-LogStep "Initializing Node.js versions"
    Write-LogReason "Pre-installing both Node.js versions to ensure smooth switching later"
    
    # Install old version
    Install-NodeVersion -Version $script:OldNodeVersion -Registry $script:Registry
    
    # Install new version
    Install-NodeVersion -Version $script:NewNodeVersion -Registry $script:Registry
    
    Write-LogSuccess "Both Node.js versions are ready"
}

# Clean environment
function Clear-Environment {
    Write-LogStep "Cleaning existing dependencies and lock files"
    Write-LogReason "Removing old dependencies ensures a fresh start and prevents conflicts"
    
    if (Test-Path "node_modules") {
        Write-LogInfo "Removing node_modules directory..."
        Remove-Item -Path "node_modules" -Recurse -Force
    }
    
    if (Test-Path "yarn.lock") {
        Write-LogInfo "Removing existing yarn.lock..."
        Remove-Item -Path "yarn.lock" -Force
    }
    
    if (Test-Path "package-lock.json") {
        Write-LogInfo "Removing existing package-lock.json..."
        Remove-Item -Path "package-lock.json" -Force
    }
    
    Write-LogSuccess "Environment cleaned"
}

# Install dependencies with old Node version
function Install-WithOldNode {
    Write-LogStep "Installing dependencies with Node.js $script:OldNodeVersion"
    Write-LogReason "Installing with older Node ensures compatibility and generates a stable yarn.lock"
    
    Set-NodeEnvironment -Version $script:OldNodeVersion -Purpose "initial dependency installation"
    Set-NpmRegistry
    
    Write-LogInfo "Running yarn install..."
    try {
        & $script:CurrentYarnExe install
        Write-LogSuccess "Dependencies installed successfully with Node.js $script:OldNodeVersion"
    } catch {
        Write-LogError "Failed to install dependencies with Node.js $script:OldNodeVersion"
        Write-LogInfo "Trying with --legacy-peer-deps flag..."
        try {
            & $script:CurrentYarnExe install --legacy-peer-deps
            Write-LogSuccess "Dependencies installed with legacy peer deps"
        } catch {
            Write-LogError "Installation failed even with legacy peer deps"
            Restore-InitialDirectory
            exit 1
        }
    }
    
    # Verify yarn.lock was created
    if (Test-Path "yarn.lock") {
        Write-LogSuccess "yarn.lock file generated successfully"
    } else {
        Write-LogError "yarn.lock file was not created"
        Restore-InitialDirectory
        exit 1
    }
}

# Upgrade with new Node version
function Update-WithNewNode {
    Write-LogStep "Upgrading dependencies with Node.js $script:NewNodeVersion"
    Write-LogReason "Using newer Node version for upgrades ensures compatibility with latest features"
    
    Set-NodeEnvironment -Version $script:NewNodeVersion -Purpose "dependency upgrade"
    Set-NpmRegistry
    
    Write-LogInfo "Running yarn upgrade-interactive --latest..."
    Write-LogWarning "Interactive upgrade will start. You can choose which packages to upgrade."
    Write-LogInfo "Recommended: Upgrade packages with major version changes carefully"
    Write-LogInfo "Press SPACE to select, ENTER to confirm, or follow the interactive prompts"
    
    Write-Host ""
    Write-ColorOutput "Starting interactive upgrade in 3 seconds..." "Yellow"
    Start-Sleep -Seconds 3
    
    try {
        & $script:CurrentYarnExe upgrade-interactive --latest
        Write-LogSuccess "Interactive upgrade completed successfully"
    } catch {
        Write-LogWarning "Interactive upgrade was cancelled or failed"
        Write-LogInfo "You can run 'yarn upgrade-interactive --latest' manually later"
    }
}

# Final installation with new Node version
function Install-FinalWithNewNode {
    Write-LogStep "Running final installation with Node.js $script:NewNodeVersion"
    Write-LogReason "Installing dependencies with the new Node version ensures all packages work correctly"
    
    Write-LogInfo "Running yarn install..."
    try {
        & $script:CurrentYarnExe install
        Write-LogSuccess "Final installation completed successfully with Node.js $script:NewNodeVersion"
        Write-LogInfo "All dependencies are now installed and compatible with the new Node.js version"
    } catch {
        Write-LogWarning "Final installation failed with standard yarn install"
        Write-LogInfo "Trying with --legacy-peer-deps flag..."
        
        try {
            & $script:CurrentYarnExe install --legacy-peer-deps
            Write-LogSuccess "Final installation completed with legacy peer deps"
        } catch {
            Write-LogError "Final installation failed even with legacy peer deps"
            Write-Host ""
            Write-ColorOutput "Manual installation commands to try:" "Yellow"
            Write-Host "Set-Location `"$PWD`""
            Write-Host "yarn install"
            Write-Host "yarn install --legacy-peer-deps"
            Write-Host "yarn install --force"
            Write-Host "npm install"
            Write-Host "npm install --legacy-peer-deps"
            Write-Host "npm install --force"
            Write-Host ""
            Write-LogWarning "Please try the above commands manually to complete the installation"
        }
    }
}

# Generate upgrade report
function New-UpgradeReport {
    Write-LogStep "Generating upgrade report..."
    
    $reportFile = "upgrade-report-$(Get-Date -Format 'yyyyMMdd_HHmmss').md"
    
    $currentTime = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $nodeVersionOutput = & $script:CurrentNodeExe --version
    $yarnVersionOutput = & $script:CurrentYarnExe --version
    $npmRegistryOutput = & $script:CurrentNpmExe config get registry
    
    $reportContent = @"
# Dependency Upgrade Report

Generated: $currentTime

## Configuration Used
- Registry: $($script:Registry) ($($script:RegistryUrl))
- Old Node.js Version: $($script:OldNodeVersion)
- New Node.js Version: $($script:NewNodeVersion)
- Working Directory: $($script:WorkDir)
- Chocolatey Directory: $ChocolateyInstallDir

## Process Summary
1. ???Cleaned environment (removed node_modules, lock files)
2. ???Initialized Node.js versions via Chocolatey
3. ???Switched to Node.js $($script:OldNodeVersion)
4. ???Installed dependencies with yarn
5. ???Generated yarn.lock file
6. ???Switched to Node.js $($script:NewNodeVersion)
7. ???Ran interactive upgrade
8. ???Final installation with new Node.js version

## Current Environment
- Node.js Version: $nodeVersionOutput
- Yarn Version: $yarnVersionOutput
- NPM Registry: $npmRegistryOutput
- Windows Version: $WinCaption (Build: $WinBuildNumber)
- Windows Version Short: $WinVersionShort
- Chocolatey Install: $ChocolateyInstallDir

## Next Steps
1. Test your application: ``yarn dev`` or ``npm run dev``
2. Run tests if available: ``yarn test`` or ``npm test``
3. Check for any breaking changes in upgraded packages
4. Commit the updated package.json and yarn.lock

## Verification Commands
``````powershell
# Verify installation completed successfully
yarn list --depth=0

# Check for vulnerabilities
yarn audit

# Check for outdated packages
yarn outdated

# Test development server
yarn dev

# Test build process
yarn build
``````

## Manual Installation (if needed)
If the final installation failed, try these commands in the working directory:
``````powershell
Set-Location "$($script:WorkDir)"
yarn install
yarn install --legacy-peer-deps
yarn install --force
npm install
npm install --legacy-peer-deps
npm install --force
``````

"@
    
    $reportContent | Out-File -FilePath $reportFile -Encoding UTF8
    Write-LogSuccess "Upgrade report saved to: $reportFile"
}

# Main execution
function Invoke-Main {
    Show-Banner
    
    Write-LogInfo "Starting Node.js version management and dependency upgrade process"
    Write-Host ""
    
    # Display detailed Windows version information
    Write-ColorOutput "========= System Information =========" "Yellow"
    Write-LogInfo "OS Name: $WinCaption"
    Write-LogInfo "Version: $WinVersion"
    Write-LogInfo "Build Number: $WinBuildNumber"
    Write-LogInfo "Detected Windows: $WinVersionShort"
    Write-LogInfo "Chocolatey Directory: $ChocolateyInstallDir"
    
    # Quick validation check
    if ($WinBuildNumber -ne "Unknown") {
        $buildInt = [int]$WinBuildNumber
        if ($buildInt -ge 22000 -and $WinVersionShort -eq "10") {
            Write-LogWarning "Potential detection issue: Build $WinBuildNumber suggests Windows 11, but detected as Windows 10"
        } elseif ($buildInt -lt 22000 -and $WinVersionShort -eq "11") {
            Write-LogWarning "Potential detection issue: Build $WinBuildNumber suggests Windows 10, but detected as Windows 11"
        } else {
            Write-LogSuccess "Version detection appears accurate"
        }
    }
    
    Write-Host ""
    
    # Step 1: Select working directory
    Select-WorkingDirectory
    Write-Host ""
    
    # Step 2: Check prerequisites
    Test-Prerequisites
    Write-Host ""
    
    # Step 3: Setup Chocolatey environment
    Initialize-ChocolateyEnvironment
    Write-Host ""
    
    # Step 4: Install Chocolatey
    Install-Chocolatey
    Write-Host ""
    
    # Step 5: Select registry
    Select-Registry
    Write-Host ""
    
    # Step 6: Configure Chocolatey source
    Set-ChocolateySource -Registry $script:Registry
    Write-Host ""
    
    # Step 7: Select Node versions
    Select-NodeVersions
    Write-Host ""
    
    # Step 8: Initialize Node.js versions
    Initialize-NodeVersions
    Write-Host ""
    
    # Step 9: Confirm the plan
    Write-ColorOutput "========= Execution Plan =========" "Yellow"
    Write-Host "Working directory: $script:WorkDir"
    Write-Host "Windows system: $WinCaption (Build: $WinBuildNumber)"
    Write-Host "Chocolatey directory: $ChocolateyInstallDir"
    Write-Host "1. Clean environment (remove node_modules, lock files)"
    Write-Host "2. Switch to Node.js $script:OldNodeVersion"
    Write-Host "3. Install dependencies with yarn"
    Write-Host "4. Switch to Node.js $script:NewNodeVersion"
    Write-Host "5. Run interactive upgrade"
    Write-Host "6. Final installation with new Node.js version"
    Write-Host "7. Generate upgrade report"
    Write-Host "8. Restore initial working directory"
    Write-Host ""
    
    do {
        $confirm = Read-Host "Do you want to proceed? [y/N]"
    } while ($confirm -notin @("y", "Y", "n", "N", ""))
    
    if ($confirm -notin @("y", "Y")) {
        Write-LogInfo "Operation cancelled by user"
        Restore-InitialDirectory
        exit 0
    }
    
    Write-Host ""
    Write-LogInfo "Starting execution..."
    Write-Host ""
    
    # Step 10: Execute the plan
    Clear-Environment
    Write-Host ""
    
    Install-WithOldNode
    Write-Host ""
    
    Update-WithNewNode
    Write-Host ""
    
    Install-FinalWithNewNode
    Write-Host ""
    
    New-UpgradeReport
    Write-Host ""
    
    # Final summary
    Write-ColorOutput "========= Process Complete =========" "Green"
    Write-LogSuccess "Node.js version management and dependency upgrade completed!"
    Write-LogInfo "Current Node.js version: $(& $script:CurrentNodeExe --version)"
    Write-LogInfo "Registry: $(& $script:CurrentNpmExe config get registry)"
    Write-LogWarning "Please test your application thoroughly before deploying"
    Write-Host ""
    Write-ColorOutput "Recommended next steps:" "Yellow"
    Write-Host "1. Verify installation: yarn list --depth=0"
    Write-Host "2. Run your development server: yarn dev"
    Write-Host "3. Test critical functionality"
    Write-Host "4. Check for any console errors"
    Write-Host "5. Review the upgrade report"
    Write-Host ""
    
    Write-LogInfo "Working directory was: $script:WorkDir"
    Write-LogInfo "Dependencies have been upgraded and installed with Node.js $script:NewNodeVersion"
    
    # Restore initial directory
    Restore-InitialDirectory
}

# Execute main function
try {
    Invoke-Main
} catch {
    Write-LogError "Script execution failed`: $($_)"
    Restore-InitialDirectory
    exit 1
}
