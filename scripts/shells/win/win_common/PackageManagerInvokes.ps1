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

# Package Manager Invocation Functions
# This script contains all Invoke-*Command functions for various package managers
# Excluded: Invoke-WingetCommand (remains in CommonFunc.ps1)

# Import required modules
. "$PSScriptRoot\CommonFunc.ps1"
. "$PSScriptRoot\PythonRuntimeCommon.ps1"

function Test-PipPackagePresentOnDisk {
    param(
        [string]$PipExe,
        [string]$PythonExe,
        [string]$PackageName,
        [array]$SearchKeywords,
        [array]$SearchPaths,
        [array]$ExecutableExtensions
    )

    if ($PythonExe -and (Test-Path -LiteralPath $PythonExe)) {
        if (Test-PythonDistInfoPresent -PythonExe $PythonExe -DistPrefixes @($PackageName)) {
            return $true
        }
    }

    if (Test-PipPackageInstalled -PipExe $PipExe -PackageName $PackageName) {
        return $true
    }

    $exe = Find-ExecutableByKeyword -Keywords $SearchKeywords -AdditionalScanPaths $SearchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $false
    return [bool]$exe
}

# =============================================================================
# Common Package Manager Execution Function
# =============================================================================
<#
.SYNOPSIS
    Executes package manager commands in isolated process with real-time output

.DESCRIPTION
    Prevents environment pollution from npm/pnpm/yarn .cmd files by using Start-Process.
    Provides real-time output capture and proper exit code handling.

.PARAMETER ExecutablePath
    Absolute path to the package manager executable (npm.cmd, pnpm.cmd, etc.)

.PARAMETER Arguments
    Arguments to pass to the package manager

.PARAMETER WorkingDirectory
    Optional working directory for the process

.RETURNS
    Exit code of the process (0 = success)
#>
function Invoke-PackageManagerCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ExecutablePath,

        [Parameter(Mandatory = $true)]
        [string]$Arguments,

        [Parameter(Mandatory = $false)]
        [string]$WorkingDirectory = $PWD
    )

    Write-DebugLog -Message "Executing: $ExecutablePath $Arguments" -Category "PKG-MGR" -Color "Cyan"

    # Use & operator to run the command directly, output to host
    try {
        $argArray = $Arguments -split '\s+'
        & $ExecutablePath @argArray | Out-Host
    }
    catch {
        Write-DebugLog -Message "Execution error: $($_.Exception.Message)" -Category "PKG-MGR" -Color "Red"
    }
}

# =============================================================================
# NPM Package Manager Functions
# =============================================================================
# =============================================================================

# =============================================================================
# Package Installation Methods Framework
# =============================================================================
# These functions provide unified interface for different package managers
# All functions follow the same pattern: check -> install -> verify -> return executable path
# This design solves the problem of inconsistent package manager behaviors and
# provides a consistent API for environment variable configuration

<#
.SYNOPSIS
    Installs Node.js packages using NPM with binary scanning verification

.DESCRIPTION
    NPM installation method that addresses the limitations of npm's global installation
    behavior. Unlike winget, npm cannot specify custom installation directories,
    but this function provides consistent binary scanning and environment setup.
    
    Design Problems Solved:
    - NPM installs globally to user/system directories (not controllable)
    - NPM package verification is slow and unreliable
    - Environment variable setup is inconsistent across packages
    
    Solution Approach:
    - Use binary scanning instead of npm list for faster verification
    - Scan common npm global installation paths
    - Return executable path for consistent environment variable setup
    - Support both global and local installations

.PARAMETER PackageName
    The npm package name (e.g., "typescript", "eslint")

.PARAMETER InstallDir
    NOTE: NPM cannot specify custom installation directory like winget.
    This parameter is kept for API consistency but will be ignored.
    NPM installs to global user directory or project directory.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "tsc", "eslint")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Cannot control installation directory (npm limitation)
    - Uses binary scanning for faster verification
    - Supports both global (-g) and local installations
    - Returns executable path for environment variable setup
#>
function Invoke-NpmCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for npm (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $false
    )

    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")

    Write-DebugLog -Message "Processing package: $PackageName" -Category "NPM" -Color "Cyan"

    # Use absolute paths from GlobalVars instead of Repair-NodeEnvironment
    $npmExe = $Global:NPM_EXE_PATH
    $nodeExe = $Global:NODE_EXE_PATH

    # Validate npm and node paths exist
    if (-not $npmExe -or -not (Test-Path $npmExe)) {
        Write-DebugLog -Message "CRITICAL: npm not found at: $npmExe" -Category "NPM" -Color "Red"
        Write-DebugLog -Message "Please run Step4_InstallNodeJS.ps1 first" -Category "NPM" -Color "Yellow"
        return $null
    }

    if (-not $nodeExe -or -not (Test-Path $nodeExe)) {
        Write-DebugLog -Message "CRITICAL: node not found at: $nodeExe" -Category "NPM" -Color "Red"
        Write-DebugLog -Message "Please run Step4_InstallNodeJS.ps1 first" -Category "NPM" -Color "Yellow"
        return $null
    }

    Write-DebugLog -Message "Using npm absolute path: $npmExe" -Category "NPM" -Color "Green"
    Write-DebugLog -Message "Using Node.js absolute path: $nodeExe" -Category "NPM" -Color "Green"

    # Get npm global prefix (installation directory) using absolute path
    try {
        $npmPrefix = & $npmExe config get prefix
        Write-DebugLog -Message "npm prefix: $npmPrefix" -Category "NPM" -Color "Cyan"
    }
    catch {
        Write-DebugLog -Message "Failed to get npm prefix: $($_.Exception.Message)" -Category "NPM" -Color "Red"
        return $null
    }
    
    # Extract package name without scope for directory paths
    $packageDirName = $PackageName
    if ($PackageName -match '^@[^/]+/(.+)$') {
        $packageDirName = $matches[1]
        Write-Host "       [NPM] Package directory name: $packageDirName" -ForegroundColor Cyan
    }
    
    # Define search paths for npm global packages
    Write-DebugLog -Message "npmPrefix: '$npmPrefix'" -Category "NPM" -Color "Magenta"
    Write-DebugLog -Message "packageDirName: '$packageDirName'" -Category "NPM" -Color "Magenta"
    Write-DebugLog -Message "packageDirName type: $($packageDirName.GetType().Name)" -Category "NPM" -Color "Magenta"
    
    Write-DebugLog -Message "Creating search paths..." -Category "NPM" -Color "Magenta"
    $searchPaths = @()
    
    try {
        # Add node root directory (where npm scripts are often placed)
        $searchPaths += $npmPrefix
        Write-DebugLog -Message "Added node root path: $npmPrefix" -Category "NPM" -Color "Magenta"
        
        $searchPaths += Join-Path $npmPrefix "node_modules\.bin"
        Write-DebugLog -Message "Added path 1: node_modules\.bin" -Category "NPM" -Color "Magenta"
        $searchPaths += Join-Path $npmPrefix "node_modules\$packageDirName\bin"
        Write-DebugLog -Message "Added path 2: node_modules\$packageDirName\bin" -Category "NPM" -Color "Magenta"
        $searchPaths += Join-Path $npmPrefix "node_modules\$packageDirName\dist"
        Write-DebugLog -Message "Added path 3: node_modules\$packageDirName\dist" -Category "NPM" -Color "Magenta"
        $searchPaths += Join-Path $npmPrefix "node_modules\$packageDirName"
        Write-DebugLog -Message "Added path 4: node_modules\$packageDirName" -Category "NPM" -Color "Magenta"
    }
    catch {
        Write-DebugLog -Message "Error in Join-Path: $($_.Exception.Message)" -Category "NPM" -Color "Red"
        Write-DebugLog -Message "Error at line: $($_.InvocationInfo.ScriptLineNumber)" -Category "NPM" -Color "Red"
        throw
    }
    
    # Add user-specific npm paths
    $userNpmPrefix = & $npmExe config get prefix --location=user 2>$null
    if ($userNpmPrefix) {
        Write-DebugLog -Message "Adding user-specific paths..." -Category "NPM" -Color "Magenta"
        try {
            # Add user npm root directory
            $searchPaths += $userNpmPrefix
            Write-DebugLog -Message "Added user npm root path: $userNpmPrefix" -Category "NPM" -Color "Magenta"
            
            $searchPaths += Join-Path $userNpmPrefix "node_modules\.bin"
            $searchPaths += Join-Path $userNpmPrefix "node_modules\$packageDirName\bin"
            $searchPaths += Join-Path $userNpmPrefix "node_modules\$packageDirName\dist"
            $searchPaths += Join-Path $userNpmPrefix "node_modules\$packageDirName"
        }
        catch {
            Write-DebugLog -Message "Error in user-specific Join-Path: $($_.Exception.Message)" -Category "NPM" -Color "Red"
            Write-DebugLog -Message "Error at line: $($_.InvocationInfo.ScriptLineNumber)" -Category "NPM" -Color "Red"
            throw
        }
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search in all npm paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "NPM" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "NPM" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }

    # Install package
    Write-DebugLog -Message "Installing package: $PackageName" -Category "NPM" -Color "Yellow"
    try {
        $installArgs = "install -g $PackageName"
        Write-DebugLog -Message "Command: $npmExe $installArgs" -Category "NPM" -Color "Magenta"

        # Run installation directly
        Invoke-PackageManagerCommand -ExecutablePath $npmExe -Arguments $installArgs

        # Refresh search paths after installation
        Write-DebugLog -Message "Refreshing search paths..." -Category "NPM" -Color "Magenta"
        $searchPaths = @()
        try {
            # Add node root directory
            $searchPaths += $npmPrefix
            Write-DebugLog -Message "Added refresh node root path: $npmPrefix" -Category "NPM" -Color "Magenta"

            $searchPaths += Join-Path $npmPrefix "node_modules\.bin"
            $searchPaths += Join-Path $npmPrefix "node_modules\$packageDirName\bin"
            $searchPaths += Join-Path $npmPrefix "node_modules\$packageDirName\dist"
            $searchPaths += Join-Path $npmPrefix "node_modules\$packageDirName"
        }
        catch {
            Write-DebugLog -Message "Error in refresh Join-Path: $($_.Exception.Message)" -Category "NPM" -Color "Red"
            Write-DebugLog -Message "Error at line: $($_.InvocationInfo.ScriptLineNumber)" -Category "NPM" -Color "Red"
            throw
        }

        # Find the installed executable - search in all npm paths at once
        Write-DebugLog -Message "Searching for executable after installation..." -Category "NPM" -Color "Magenta"
        Write-DebugLog -Message "Search keywords: $($searchKeywords -join ', ')" -Category "NPM" -Color "Magenta"
        Write-DebugLog -Message "Search paths: $($searchPaths -join ', ')" -Category "NPM" -Color "Magenta"

        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
        Write-DebugLog -Message "Find-ExecutableByKeyword returned: '$executable'" -Category "NPM" -Color "Yellow"

        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "NPM" -Color "Green"
            return $executable
        }
        else {
            Write-DebugLog -Message "Installation completed but executable not found" -Category "NPM" -Color "Yellow"
            return $null
        }
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "NPM" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs Node.js packages using PNPM with binary scanning verification

.DESCRIPTION
    PNPM installation method - modern Node.js package manager that replaces NPM
    in the core_node project. This project now uses pnpm exclusively for all
    Node.js package management.

    Why PNPM over NPM:
    - Faster installation and disk space efficiency (uses hardlinks)
    - Better monorepo support with workspaces
    - More predictable dependency resolution
    - Native support for hoisting strategies via .pnpmrc
    - Better separation between different configuration concerns

    Features:
    - Uses binary scanning for faster verification
    - Scans common pnpm global installation paths
    - Return executable path for consistent environment variable setup
    - Support for both global and local installations

.PARAMETER PackageName
    The pnpm package name (e.g., "yarn", "pm2", "ts-node")

.PARAMETER InstallDir
    NOTE: PNPM cannot specify custom installation directory like winget.
    This parameter is kept for API consistency but will be ignored.
    PNPM installs globally to user directories.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "yarn", "pm2")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - This project uses pnpm as the primary package manager
    - Cannot control installation directory (pnpm limitation)
    - Uses binary scanning for faster verification
    - Returns executable path for environment variable setup
    - Configuration stored in .pnpmrc (separate from npm .npmrc)
#>
function Invoke-PnpmCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for pnpm (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $false
    )

    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")

    Write-DebugLog -Message "Processing package via PNPM: $PackageName" -Category "PNPM" -Color "Cyan"

    # Use absolute paths from GlobalVars instead of Repair-NodeEnvironment
    $pnpmExe = $Global:PNPM_EXE_PATH
    $npmExe = $Global:NPM_EXE_PATH

    # Validate npm and pnpm paths exist
    if (-not $npmExe -or -not (Test-Path $npmExe)) {
        Write-DebugLog -Message "CRITICAL: npm not found at: $npmExe" -Category "PNPM" -Color "Red"
        Write-DebugLog -Message "Please run Step4_InstallNodeJS.ps1 first" -Category "PNPM" -Color "Yellow"
        return $null
    }

    # If pnpm doesn't exist, install it using npm
    if (-not $pnpmExe -or -not (Test-Path $pnpmExe)) {
        Write-DebugLog -Message "pnpm not found, installing via npm..." -Category "PNPM" -Color "Yellow"
        Invoke-PackageManagerCommand -ExecutablePath $npmExe -Arguments "install -g pnpm"

        Start-Sleep -Milliseconds 500

        # Re-check pnpm path
        if (Test-Path $Global:PNPM_EXE_PATH) {
            $pnpmExe = $Global:PNPM_EXE_PATH
            Write-DebugLog -Message "pnpm installed successfully at: $pnpmExe" -Category "PNPM" -Color "Green"

            # Run pnpm setup
            & $pnpmExe setup
            Write-DebugLog -Message "pnpm setup completed" -Category "PNPM" -Color "Green"

            # Ensure pnpm global bin directory is in PATH after setup
            try {
                $pnpmGlobalBinDirTemp = & $pnpmExe config get global-bin-dir 2>&1 | Select-Object -First 1
                if (-not [string]::IsNullOrEmpty($pnpmGlobalBinDirTemp) -and $pnpmGlobalBinDirTemp -ne "undefined") {
                    if (Test-Path $pnpmGlobalBinDirTemp) {
                        $parentDir = Split-Path $PSScriptRoot -Parent
                        $windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"
                        if (Test-Path $windowsPathFunctionPath) {
                            . $windowsPathFunctionPath
                            Write-DebugLog -Message "Ensuring pnpm global bin directory is in PATH after setup: $pnpmGlobalBinDirTemp" -Category "PNPM" -Color "Yellow"
                            Add-Path -newPath $pnpmGlobalBinDirTemp
                            Write-DebugLog -Message "pnpm global bin directory PATH check completed after setup" -Category "PNPM" -Color "Green"
                        }
                    }
                }
            } catch {
                Write-DebugLog -Message "Warning: Failed to ensure pnpm bin in PATH after setup: $($_.Exception.Message)" -Category "PNPM" -Color "Yellow"
            }
        } else {
            Write-DebugLog -Message "CRITICAL: pnpm installation failed" -Category "PNPM" -Color "Red"
            return $null
        }
    }

    Write-DebugLog -Message "Using pnpm absolute path: $pnpmExe" -Category "PNPM" -Color "Green"
    Write-DebugLog -Message "Using npm absolute path: $npmExe" -Category "PNPM" -Color "Green"

    # Get pnpm global directory using config
    try {
        $pnpmGlobalDir = & $pnpmExe config get global-dir 2>&1 | Select-Object -First 1
        $pnpmGlobalBinDir = & $pnpmExe config get global-bin-dir 2>&1 | Select-Object -First 1

        # Validate results
        if ([string]::IsNullOrEmpty($pnpmGlobalDir) -or $pnpmGlobalDir -eq "undefined") {
            # Fallback to default location
            $pnpmGlobalDir = Join-Path $Global:NODE_DIR "pnpm-global"
            Write-DebugLog -Message "Using fallback pnpm global directory: $pnpmGlobalDir" -Category "PNPM" -Color "Yellow"
        }

        if ([string]::IsNullOrEmpty($pnpmGlobalBinDir) -or $pnpmGlobalBinDir -eq "undefined") {
            $pnpmGlobalBinDir = Join-Path $pnpmGlobalDir ".bin"
            Write-DebugLog -Message "Using fallback pnpm global bin directory: $pnpmGlobalBinDir" -Category "PNPM" -Color "Yellow"
        }

        Write-DebugLog -Message "pnpm global-dir: $pnpmGlobalDir" -Category "PNPM" -Color "Cyan"
        Write-DebugLog -Message "pnpm global-bin-dir: $pnpmGlobalBinDir" -Category "PNPM" -Color "Cyan"

        # Always ensure pnpm global bin directory is in PATH (repair step)
        # Add-Path function handles duplicate checking internally
        if (Test-Path $pnpmGlobalBinDir) {
            $parentDir = Split-Path $PSScriptRoot -Parent
            $windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"
            if (Test-Path $windowsPathFunctionPath) {
                . $windowsPathFunctionPath
                Write-DebugLog -Message "Ensuring pnpm global bin directory is in PATH: $pnpmGlobalBinDir" -Category "PNPM" -Color "Yellow"
                Add-Path -newPath $pnpmGlobalBinDir
                Write-DebugLog -Message "pnpm global bin directory PATH check completed" -Category "PNPM" -Color "Green"
            } else {
                Write-DebugLog -Message "Warning: WindowsPathFunction.ps1 not found, cannot add pnpm bin to PATH" -Category "PNPM" -Color "Yellow"
            }
        } else {
            Write-DebugLog -Message "Warning: pnpm global bin directory does not exist yet: $pnpmGlobalBinDir" -Category "PNPM" -Color "Yellow"
            Write-DebugLog -Message "Will be added to PATH when directory is created" -Category "PNPM" -Color "Cyan"
        }
    }
    catch {
        Write-DebugLog -Message "Failed to get pnpm directories: $($_.Exception.Message)" -Category "PNPM" -Color "Red"
        return $null
    }

    # Extract package name without scope for directory paths
    $packageDirName = $PackageName
    if ($PackageName -match '^@[^/]+/(.+)$') {
        $packageDirName = $matches[1]
        Write-Host "       [PNPM] Package directory name: $packageDirName" -ForegroundColor Cyan
    }

    # Define search paths for pnpm global packages
    Write-DebugLog -Message "pnpmGlobalDir: '$pnpmGlobalDir'" -Category "PNPM" -Color "Magenta"
    Write-DebugLog -Message "pnpmGlobalBinDir: '$pnpmGlobalBinDir'" -Category "PNPM" -Color "Magenta"
    Write-DebugLog -Message "packageDirName: '$packageDirName'" -Category "PNPM" -Color "Magenta"

    Write-DebugLog -Message "Creating search paths..." -Category "PNPM" -Color "Magenta"
    $searchPaths = @()

    try {
        # Add pnpm global bin directory (primary location for executables)
        $searchPaths += $pnpmGlobalBinDir
        Write-DebugLog -Message "Added pnpm global bin path: $pnpmGlobalBinDir" -Category "PNPM" -Color "Magenta"

        # Add pnpm global directory
        $searchPaths += $pnpmGlobalDir
        Write-DebugLog -Message "Added pnpm global path: $pnpmGlobalDir" -Category "PNPM" -Color "Magenta"

        # Add node_modules subdirectories
        $searchPaths += Join-Path $pnpmGlobalDir "node_modules\.bin"
        Write-DebugLog -Message "Added pnpm node_modules\.bin path" -Category "PNPM" -Color "Magenta"

        $searchPaths += Join-Path $pnpmGlobalDir "node_modules\$packageDirName\bin"
        Write-DebugLog -Message "Added pnpm node_modules\$packageDirName\bin path" -Category "PNPM" -Color "Magenta"

        $searchPaths += Join-Path $pnpmGlobalDir "node_modules\$packageDirName\dist"
        Write-DebugLog -Message "Added pnpm node_modules\$packageDirName\dist path" -Category "PNPM" -Color "Magenta"

        $searchPaths += Join-Path $pnpmGlobalDir "node_modules\$packageDirName"
        Write-DebugLog -Message "Added pnpm node_modules\$packageDirName path" -Category "PNPM" -Color "Magenta"
    }
    catch {
        Write-DebugLog -Message "Error in pnpm Join-Path: $($_.Exception.Message)" -Category "PNPM" -Color "Red"
        Write-DebugLog -Message "Error at line: $($_.InvocationInfo.ScriptLineNumber)" -Category "PNPM" -Color "Red"
        throw
    }

    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }

    # Check if already installed
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse

    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "PNPM" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "PNPM" -Color "Cyan"
        return $executable
    }

    if ($OnlyCheckFlag) {
        return $executable
    }

    # Install package using pnpm
    Write-DebugLog -Message "Installing package via pnpm: $PackageName" -Category "PNPM" -Color "Yellow"
    try {
        # Ensure current process PATH is refreshed before calling pnpm
        # This is critical because pnpm checks PATH during installation
        try {
            $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
            $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
            $combinedPath = if ($userPath) { "$userPath;$machinePath" } else { $machinePath }
            [Environment]::SetEnvironmentVariable("Path", $combinedPath, "Process")
            Write-DebugLog -Message "Refreshed current process PATH before pnpm installation" -Category "PNPM" -Color "Cyan"
        } catch {
            Write-DebugLog -Message "Warning: Failed to refresh process PATH: $($_.Exception.Message)" -Category "PNPM" -Color "Yellow"
        }

        $installArgs = "add --global $PackageName"
        Write-DebugLog -Message "Command: $pnpmExe $installArgs" -Category "PNPM" -Color "Magenta"

        # Run installation directly
        Invoke-PackageManagerCommand -ExecutablePath $pnpmExe -Arguments $installArgs

        # Refresh search paths after installation
        Write-DebugLog -Message "Refreshing search paths after installation..." -Category "PNPM" -Color "Magenta"
        $searchPaths = @()
        try {
            # Re-add pnpm paths
            $searchPaths += $pnpmGlobalBinDir
            Write-DebugLog -Message "Added refresh pnpm global bin path: $pnpmGlobalBinDir" -Category "PNPM" -Color "Magenta"

            $searchPaths += $pnpmGlobalDir
            Write-DebugLog -Message "Added refresh pnpm global path: $pnpmGlobalDir" -Category "PNPM" -Color "Magenta"

            $searchPaths += Join-Path $pnpmGlobalDir "node_modules\.bin"
            $searchPaths += Join-Path $pnpmGlobalDir "node_modules\$packageDirName\bin"
            $searchPaths += Join-Path $pnpmGlobalDir "node_modules\$packageDirName\dist"
            $searchPaths += Join-Path $pnpmGlobalDir "node_modules\$packageDirName"
            Write-DebugLog -Message "Added all pnpm node_modules paths after refresh" -Category "PNPM" -Color "Magenta"
        }
        catch {
            Write-DebugLog -Message "Error in refresh Join-Path: $($_.Exception.Message)" -Category "PNPM" -Color "Red"
            Write-DebugLog -Message "Error at line: $($_.InvocationInfo.ScriptLineNumber)" -Category "PNPM" -Color "Red"
            throw
        }

        # Find the installed executable - search in all pnpm paths at once
        Write-DebugLog -Message "Searching for executable after installation..." -Category "PNPM" -Color "Magenta"
        Write-DebugLog -Message "Search keywords: $($searchKeywords -join ', ')" -Category "PNPM" -Color "Magenta"
        Write-DebugLog -Message "Search paths: $($searchPaths -join ', ')" -Category "PNPM" -Color "Magenta"

        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
        Write-DebugLog -Message "Find-ExecutableByKeyword returned: '$executable'" -Category "PNPM" -Color "Yellow"

        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "PNPM" -Color "Green"
            return $executable
        }
        else {
            Write-DebugLog -Message "Installation completed but executable not found" -Category "PNPM" -Color "Yellow"
            return $null
        }
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "PNPM" -Color "Red"
        return $null
    }
}

# Helper function for npm fallback
function Invoke-NpmFallback {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $false
    )

    Write-DebugLog -Message "Using NPM as fallback for: $PackageName" -Category "PNPM" -Color "Yellow"
    return Invoke-NpmCommand -PackageName $PackageName -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -OnlyCheckFlag $OnlyCheckFlag -ForceInstall $ForceInstall
}

<#
.SYNOPSIS
    Installs Python packages using PIP with binary scanning verification

.DESCRIPTION
    PIP installation method that addresses the limitations of pip's installation
    behavior. Unlike winget, pip cannot specify custom installation directories,
    but this function provides consistent binary scanning and environment setup.
    
    Design Problems Solved:
    - PIP installs to user/system Python directories (not controllable)
    - PIP package verification is slow and unreliable
    - Environment variable setup is inconsistent across packages
    - Virtual environment management is complex
    
    Solution Approach:
    - Use binary scanning instead of pip list for faster verification
    - Scan Python Scripts directory and virtual environments
    - Return executable path for consistent environment variable setup
    - Support both global and virtual environment installations

.PARAMETER PackageName
    The pip package name (e.g., "requests", "black")

.PARAMETER InstallDir
    NOTE: PIP cannot specify custom installation directory like winget.
    This parameter is kept for API consistency but will be ignored.
    PIP installs to Python Scripts directory or virtual environment.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "black", "pylint")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Cannot control installation directory (pip limitation)
    - Uses binary scanning for faster verification
    - Supports both global and virtual environment installations
    - Returns executable path for environment variable setup
#>

<#
.SYNOPSIS
    Performs comprehensive Python environment repair and validation

.DESCRIPTION
    This function ensures Python environment is properly configured by:
    1. Detecting Python and pip absolute paths from multiple sources
    2. Verifying and repairing PATH environment variables
    3. Detecting installed pip tools (pipx, uv, poetry)
    4. Using absolute paths for all operations (handles first-time installation)

    The function MUST be called before any pip operations to ensure environment consistency.
    It handles the case where environment variables are just added but not yet effective in current session.

.RETURNS
    Hashtable containing:
    - PythonExe: Absolute path to python.exe
    - PipExe: Absolute path to pip.exe
    - ScriptsDir: Absolute path to Python Scripts directory
    - PathFixed: Boolean indicating if PATH was repaired
#>
function Repair-PythonEnvironment {
    param(
        [bool]$Force = $false
    )

    $result = @{
        PythonExe = $null
        PipExe = $null
        ScriptsDir = $null
        PathFixed = $false
    }

    Write-DebugLog -Message "========== Python Environment Repair Started ==========" -Category "PIP-REPAIR" -Color "Cyan"

    # Step 1: Detect Python and pip absolute paths
    Write-DebugLog -Message "Step 1: Detecting Python and pip paths..." -Category "PIP-REPAIR" -Color "Cyan"

    # Method 1: Use GlobalVars (most reliable)
    if ($Global:PYTHON_DIR -and (Test-Path $Global:PYTHON_DIR)) {
        $pythonExePath = Join-Path $Global:PYTHON_DIR "python.exe"
        $pipExePath = Join-Path $Global:PYTHON_SCRIPTS_DIR "pip.exe"
        $scriptsDir = $Global:PYTHON_SCRIPTS_DIR

        if ((Test-Path $pythonExePath) -and (Test-Path $pipExePath)) {
            $result.PythonExe = $pythonExePath
            $result.PipExe = $pipExePath
            $result.ScriptsDir = $scriptsDir
            Write-DebugLog -Message "Found Python via GlobalVars: $pythonExePath" -Category "PIP-REPAIR" -Color "Green"
            Write-DebugLog -Message "Found pip via GlobalVars: $pipExePath" -Category "PIP-REPAIR" -Color "Green"
        }
    }

    # Method 2: Use Global variables as fallback
    if (-not $result.PipExe -and $Global:PIP_EXE_PATH -and (Test-Path $Global:PIP_EXE_PATH)) {
        $result.PipExe = $Global:PIP_EXE_PATH
        $result.ScriptsDir = Split-Path -Parent $Global:PIP_EXE_PATH
        Write-DebugLog -Message "Found pip via Global:PIP_EXE_PATH: $($result.PipExe)" -Category "PIP-REPAIR" -Color "Green"
    }

    if (-not $result.PythonExe -and $Global:PYTHON_EXE_PATH -and (Test-Path $Global:PYTHON_EXE_PATH)) {
        $result.PythonExe = $Global:PYTHON_EXE_PATH
        Write-DebugLog -Message "Found Python via Global:PYTHON_EXE_PATH: $($result.PythonExe)" -Category "PIP-REPAIR" -Color "Green"
    }

    # Method 3: Search in PATH (fallback)
    if (-not $result.PythonExe) {
        $pythonInPath = Get-Command python.exe -ErrorAction SilentlyContinue
        if ($pythonInPath) {
            $result.PythonExe = $pythonInPath.Source
            Write-DebugLog -Message "Found Python in PATH: $($result.PythonExe)" -Category "PIP-REPAIR" -Color "Yellow"
        }
    }

    if (-not $result.PipExe) {
        $pipInPath = Get-Command pip.exe -ErrorAction SilentlyContinue
        if ($pipInPath) {
            $result.PipExe = $pipInPath.Source
            $result.ScriptsDir = Split-Path -Parent $pipInPath.Source
            Write-DebugLog -Message "Found pip in PATH: $($result.PipExe)" -Category "PIP-REPAIR" -Color "Yellow"
        }
    }

    # Validation
    if (-not $result.PythonExe -or -not $result.PipExe) {
        Write-DebugLog -Message "CRITICAL: Cannot locate Python or pip executables!" -Category "PIP-REPAIR" -Color "Red"
        Write-DebugLog -Message "Python: $($result.PythonExe)" -Category "PIP-REPAIR" -Color "Red"
        Write-DebugLog -Message "pip: $($result.PipExe)" -Category "PIP-REPAIR" -Color "Red"
        return $result
    }

    # Step 2: Verify and repair PATH environment variables
    Write-DebugLog -Message "Step 2: Verifying PATH environment variables..." -Category "PIP-REPAIR" -Color "Cyan"

    $pathsToAdd = @()

    # Check Python directory
    $pythonDir = Split-Path -Parent $result.PythonExe
    $pathsToAdd += $pythonDir

    # Check Scripts directory
    if ($result.ScriptsDir) {
        $pathsToAdd += $result.ScriptsDir
    }

    # Get current PATH (Machine + User)
    $currentUserPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $currentMachinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $combinedPath = "$currentUserPath;$currentMachinePath"

    # Get WindowsPathFunction.ps1 path
    $parentDir = Split-Path $PSScriptRoot -Parent
    $windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"

    foreach ($pathToAdd in $pathsToAdd) {
        if ($combinedPath -notlike "*$pathToAdd*") {
            Write-DebugLog -Message "PATH missing directory: $pathToAdd - REPAIRING" -Category "PIP-REPAIR" -Color "Yellow"

            if (Test-Path $windowsPathFunctionPath) {
                & $windowsPathFunctionPath "add" $pathToAdd
                $result.PathFixed = $true
                Write-DebugLog -Message "Added to PATH: $pathToAdd" -Category "PIP-REPAIR" -Color "Green"
            } else {
                Write-DebugLog -Message "ERROR: Cannot add to PATH - WindowsPathFunction.ps1 not found" -Category "PIP-REPAIR" -Color "Red"
            }
        } else {
            Write-DebugLog -Message "PATH OK: $pathToAdd" -Category "PIP-REPAIR" -Color "Gray"
        }
    }

    # Step 3: Refresh current session PATH
    if ($result.PathFixed -or $Force) {
        Write-DebugLog -Message "Step 3: Refreshing current session PATH..." -Category "PIP-REPAIR" -Color "Cyan"
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-DebugLog -Message "Session PATH refreshed" -Category "PIP-REPAIR" -Color "Green"
    }

    # Step 4: Detect installed pip tools
    Write-DebugLog -Message "Step 4: Detecting installed pip tools..." -Category "PIP-REPAIR" -Color "Cyan"
    $pipTools = @("pipx.exe", "uv.exe", "poetry.exe")
    foreach ($tool in $pipTools) {
        $toolPath = Join-Path $result.ScriptsDir $tool
        if (Test-Path $toolPath) {
            Write-DebugLog -Message "Found: $tool at $toolPath" -Category "PIP-REPAIR" -Color "Green"
        } else {
            Write-DebugLog -Message "Not installed: $tool" -Category "PIP-REPAIR" -Color "Gray"
        }
    }

    # Step 5: Clean up corrupted packages
    Write-DebugLog -Message "Step 5: Checking for corrupted packages..." -Category "PIP-REPAIR" -Color "Cyan"

    # Common locations for user-installed packages
    $sitePackagesPaths = @(
        (Join-Path $env:APPDATA "Python\Python313\site-packages"),
        (Join-Path $env:LOCALAPPDATA "Programs\Python\Python313\site-packages"),
        (Split-Path $result.PythonExe -Parent | Join-Path -ChildPath "Lib\site-packages")
    )

    $corruptedPackagesFound = 0
    foreach ($sitePackagesPath in $sitePackagesPaths) {
        if (Test-Path $sitePackagesPath) {
            Write-DebugLog -Message "Scanning: $sitePackagesPath" -Category "PIP-REPAIR" -Color "Gray"

            try {
                $items = Get-ChildItem -Path $sitePackagesPath -Directory -ErrorAction SilentlyContinue
                foreach ($item in $items) {
                    # Check for corrupted package names (starting with ~, -, or other invalid characters)
                    if ($item.Name -match "^[~\-\.]" -or $item.Name -match "^__pycache__$") {
                        if ($item.Name -ne "__pycache__") {
                            Write-DebugLog -Message "Found corrupted package: $($item.Name)" -Category "PIP-REPAIR" -Color "Yellow"
                            try {
                                Remove-Item -Path $item.FullName -Recurse -Force -ErrorAction Stop
                                Write-DebugLog -Message "Removed corrupted package: $($item.Name)" -Category "PIP-REPAIR" -Color "Green"
                                $corruptedPackagesFound++
                            }
                            catch {
                                Write-DebugLog -Message "Failed to remove $($item.Name): $($_.Exception.Message)" -Category "PIP-REPAIR" -Color "Yellow"
                            }
                        }
                    }
                }
            }
            catch {
                Write-DebugLog -Message "Error scanning $sitePackagesPath`: $($_.Exception.Message)" -Category "PIP-REPAIR" -Color "Gray"
            }
        }
    }

    if ($corruptedPackagesFound -gt 0) {
        Write-DebugLog -Message "Cleaned up $corruptedPackagesFound corrupted package(s)" -Category "PIP-REPAIR" -Color "Green"
    } else {
        Write-DebugLog -Message "No corrupted packages found" -Category "PIP-REPAIR" -Color "Gray"
    }

    Write-DebugLog -Message "========== Python Environment Repair Completed ==========" -Category "PIP-REPAIR" -Color "Cyan"
    Write-DebugLog -Message "Python: $($result.PythonExe)" -Category "PIP-REPAIR" -Color "Green"
    Write-DebugLog -Message "pip: $($result.PipExe)" -Category "PIP-REPAIR" -Color "Green"
    Write-DebugLog -Message "Scripts: $($result.ScriptsDir)" -Category "PIP-REPAIR" -Color "Green"
    Write-DebugLog -Message "PATH Fixed: $($result.PathFixed)" -Category "PIP-REPAIR" -Color $(if ($result.PathFixed) { "Yellow" } else { "Gray" })

    return $result
}

<#
.SYNOPSIS
    Performs comprehensive Node.js environment repair and validation

.DESCRIPTION
    This function ensures Node.js environment is properly configured by:
    1. Detecting Node.js, npm, and pnpm absolute paths from multiple sources
    2. Verifying and repairing PATH environment variables
    3. Installing pnpm if not present
    4. Using absolute paths for all operations (handles first-time installation)

    The function MUST be called before any npm/pnpm operations to ensure environment consistency.
    It handles the case where environment variables are just added but not yet effective in current session.

.RETURNS
    Hashtable containing:
    - NodeExe: Absolute path to node.exe
    - NpmExe: Absolute path to npm.cmd
    - PnpmExe: Absolute path to pnpm.cmd
    - NodeDir: Node.js installation directory
    - PathFixed: Boolean indicating if PATH was repaired
#>
function Repair-NodeEnvironment {
    param(
        [bool]$Force = $false
    )

    $result = @{
        NodeExe = $null
        NpmExe = $null
        PnpmExe = $null
        NodeDir = $null
        PathFixed = $false
    }

    Write-DebugLog -Message "========== Node.js Environment Repair Started ==========" -Category "NODE-REPAIR" -Color "Cyan"

    # Step 1: Detect Node.js, npm, and pnpm absolute paths
    Write-DebugLog -Message "Step 1: Detecting Node.js paths..." -Category "NODE-REPAIR" -Color "Cyan"

    # Method 1: Use GlobalVars (most reliable)
    if ($Global:NODE_DIR -and (Test-Path $Global:NODE_DIR)) {
        $nodeExePath = Join-Path $Global:NODE_DIR "node.exe"
        $npmExePath = Join-Path $Global:NODE_DIR "npm.cmd"
        $pnpmExePath = Join-Path $Global:NODE_DIR "pnpm.cmd"

        if (Test-Path $nodeExePath) {
            $result.NodeExe = $nodeExePath
            $result.NodeDir = $Global:NODE_DIR
            Write-DebugLog -Message "Found Node.js via GlobalVars: $nodeExePath" -Category "NODE-REPAIR" -Color "Green"
        }

        if (Test-Path $npmExePath) {
            $result.NpmExe = $npmExePath
            Write-DebugLog -Message "Found npm via GlobalVars: $npmExePath" -Category "NODE-REPAIR" -Color "Green"
        }

        if (Test-Path $pnpmExePath) {
            $result.PnpmExe = $pnpmExePath
            Write-DebugLog -Message "Found pnpm via GlobalVars: $pnpmExePath" -Category "NODE-REPAIR" -Color "Green"
        }
    }

    # Method 2: Use Global variables as fallback
    if (-not $result.NodeExe -and $Global:NODE_EXE_PATH -and (Test-Path $Global:NODE_EXE_PATH)) {
        $result.NodeExe = $Global:NODE_EXE_PATH
        $result.NodeDir = Split-Path -Parent $Global:NODE_EXE_PATH
        Write-DebugLog -Message "Found Node.js via Global:NODE_EXE_PATH: $($result.NodeExe)" -Category "NODE-REPAIR" -Color "Green"
    }

    if (-not $result.NpmExe -and $Global:NPM_EXE_PATH -and (Test-Path $Global:NPM_EXE_PATH)) {
        $result.NpmExe = $Global:NPM_EXE_PATH
        Write-DebugLog -Message "Found npm via Global:NPM_EXE_PATH: $($result.NpmExe)" -Category "NODE-REPAIR" -Color "Green"
    }

    if (-not $result.PnpmExe -and $Global:PNPM_EXE_PATH -and (Test-Path $Global:PNPM_EXE_PATH)) {
        $result.PnpmExe = $Global:PNPM_EXE_PATH
        Write-DebugLog -Message "Found pnpm via Global:PNPM_EXE_PATH: $($result.PnpmExe)" -Category "NODE-REPAIR" -Color "Green"
    }

    # Method 3: Search in PATH (fallback)
    if (-not $result.NodeExe) {
        $nodeInPath = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($nodeInPath) {
            $result.NodeExe = $nodeInPath.Source
            $result.NodeDir = Split-Path -Parent $nodeInPath.Source
            Write-DebugLog -Message "Found Node.js in PATH: $($result.NodeExe)" -Category "NODE-REPAIR" -Color "Yellow"
        }
    }

    if (-not $result.NpmExe) {
        $npmInPath = Get-Command npm.cmd -ErrorAction SilentlyContinue
        if ($npmInPath) {
            $result.NpmExe = $npmInPath.Source
            Write-DebugLog -Message "Found npm in PATH: $($result.NpmExe)" -Category "NODE-REPAIR" -Color "Yellow"
        }
    }

    if (-not $result.PnpmExe) {
        $pnpmInPath = Get-Command pnpm.cmd -ErrorAction SilentlyContinue
        if ($pnpmInPath) {
            $result.PnpmExe = $pnpmInPath.Source
            Write-DebugLog -Message "Found pnpm in PATH: $($result.PnpmExe)" -Category "NODE-REPAIR" -Color "Yellow"
        }
    }

    # Validation
    if (-not $result.NodeExe -or -not $result.NpmExe) {
        Write-DebugLog -Message "CRITICAL: Cannot locate Node.js or npm executables!" -Category "NODE-REPAIR" -Color "Red"
        Write-DebugLog -Message "Node.js: $($result.NodeExe)" -Category "NODE-REPAIR" -Color "Red"
        Write-DebugLog -Message "npm: $($result.NpmExe)" -Category "NODE-REPAIR" -Color "Red"
        return $result
    }

    # Step 2: Install pnpm if not present
    if (-not $result.PnpmExe) {
        Write-DebugLog -Message "Step 2: pnpm not found, installing via npm..." -Category "NODE-REPAIR" -Color "Yellow"
        & $result.NpmExe install -g pnpm
        $pnpmPath = Join-Path $result.NodeDir "pnpm.cmd"
        if (Test-Path $pnpmPath) {
            $result.PnpmExe = $pnpmPath
            Write-DebugLog -Message "pnpm installed successfully at: $pnpmPath" -Category "NODE-REPAIR" -Color "Green"

            Write-DebugLog -Message "Running pnpm setup..." -Category "NODE-REPAIR" -Color "Yellow"
            & $pnpmPath setup
            Write-DebugLog -Message "pnpm setup completed" -Category "NODE-REPAIR" -Color "Green"

            $result.PathFixed = $true
        } else {
            Write-DebugLog -Message "pnpm installation completed but executable not found" -Category "NODE-REPAIR" -Color "Yellow"
        }
    } else {
        Write-DebugLog -Message "Step 2: pnpm already installed" -Category "NODE-REPAIR" -Color "Gray"

        Write-DebugLog -Message "Running pnpm setup to ensure configuration..." -Category "NODE-REPAIR" -Color "Yellow"
        & $result.PnpmExe setup
        Write-DebugLog -Message "pnpm setup completed" -Category "NODE-REPAIR" -Color "Green"
    }

    # Step 3: Verify and repair PATH environment variables
    Write-DebugLog -Message "Step 3: Verifying PATH environment variables..." -Category "NODE-REPAIR" -Color "Cyan"

    if ($result.NodeDir) {
        # Get current PATH (Machine + User)
        $currentUserPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
        $currentMachinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        $combinedPath = "$currentUserPath;$currentMachinePath"

        # Get WindowsPathFunction.ps1 path
        $parentDir = Split-Path $PSScriptRoot -Parent
        $windowsPathFunctionPath = Join-Path $parentDir "win_common\WindowsPathFunction.ps1"

        if ($combinedPath -notlike "*$($result.NodeDir)*") {
            Write-DebugLog -Message "PATH missing Node.js directory: $($result.NodeDir) - REPAIRING" -Category "NODE-REPAIR" -Color "Yellow"

            if (Test-Path $windowsPathFunctionPath) {
                & $windowsPathFunctionPath "add" $result.NodeDir
                $result.PathFixed = $true
                Write-DebugLog -Message "Added to PATH: $($result.NodeDir)" -Category "NODE-REPAIR" -Color "Green"
            } else {
                Write-DebugLog -Message "ERROR: Cannot add to PATH - WindowsPathFunction.ps1 not found" -Category "NODE-REPAIR" -Color "Red"
            }
        } else {
            Write-DebugLog -Message "PATH OK: $($result.NodeDir)" -Category "NODE-REPAIR" -Color "Gray"
        }
    }

    # Step 4: Refresh current session PATH
    if ($result.PathFixed -or $Force) {
        Write-DebugLog -Message "Step 4: Refreshing current session PATH..." -Category "NODE-REPAIR" -Color "Cyan"
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path", "User")
        Write-DebugLog -Message "Session PATH refreshed" -Category "NODE-REPAIR" -Color "Green"
    }

    Write-DebugLog -Message "========== Node.js Environment Repair Completed ==========" -Category "NODE-REPAIR" -Color "Cyan"
    Write-DebugLog -Message "Node.js: $($result.NodeExe)" -Category "NODE-REPAIR" -Color "Green"
    Write-DebugLog -Message "npm: $($result.NpmExe)" -Category "NODE-REPAIR" -Color "Green"
    Write-DebugLog -Message "pnpm: $($result.PnpmExe)" -Category "NODE-REPAIR" -Color $(if ($result.PnpmExe) { "Green" } else { "Yellow" })
    Write-DebugLog -Message "PATH Fixed: $($result.PathFixed)" -Category "NODE-REPAIR" -Color $(if ($result.PathFixed) { "Yellow" } else { "Gray" })

    return $result
}

function Invoke-PipCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for pip (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )
    
    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")

    Write-DebugLog -Message "Processing pip package: $PackageName" -Category "PIP" -Color "Cyan"

    # CRITICAL: Repair Python environment before any pip operations
    # This ensures:
    # 1. We have valid absolute paths to python.exe and pip.exe
    # 2. PATH environment variables are properly configured
    # 3. Works correctly even on first-time installation (environment vars not yet effective)
    $envRepair = Repair-PythonEnvironment

    if (-not $envRepair.PipExe -or -not $envRepair.PythonExe) {
        Write-DebugLog -Message "CRITICAL: Python environment repair failed - cannot proceed with pip operations" -Category "PIP" -Color "Red"
        return $null
    }

    # Use absolute paths from repair (handles first-time installation)
    $pipExe = $envRepair.PipExe
    $pythonExe = $envRepair.PythonExe
    $pythonScriptsDir = $envRepair.ScriptsDir

    Write-DebugLog -Message "Using pip absolute path: $pipExe" -Category "PIP" -Color "Green"
    Write-DebugLog -Message "Using Python absolute path: $pythonExe" -Category "PIP" -Color "Green"
    Write-DebugLog -Message "Using Scripts directory: $pythonScriptsDir" -Category "PIP" -Color "Green"

    if (Get-Command Ensure-PipCacheDirConfigured -ErrorAction SilentlyContinue) {
        Ensure-PipCacheDirConfigured -PipExe $pipExe
    }

    # Build search paths for pip packages
    $searchPaths = @($pythonScriptsDir)
    Write-DebugLog -Message "Building search paths for pip package scanning..." -Category "PIP" -Color "Cyan"

    try {
        
        # Add user-specific pip paths if available
        Write-DebugLog -Message "Trying to find user-specific pip paths..." -Category "PIP" -Color "Gray"
        try {
            $prevEap = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            try {
                $userPipShowOutput = & $pipExe show pip --user 2>&1
            } finally {
                $ErrorActionPreference = $prevEap
            }

            if ($userPipShowOutput -and ("$userPipShowOutput" -match '(?m)^Name:\s')) {
                $userLocationLine = $userPipShowOutput | Select-String "Location:"
                if ($userLocationLine) {
                    $userPipDir = $userLocationLine.ToString() -replace "^Location:\s*", ""
                    $userScriptsDir = Join-Path $userPipDir "Scripts"
                    Write-DebugLog -Message "Found user pip directory: $userScriptsDir" -Category "PIP" -Color "Cyan"

                    if (Test-Path $userScriptsDir) {
                        $searchPaths += $userScriptsDir
                        Write-DebugLog -Message "SUCCESS: Added user pip Scripts path: $userScriptsDir" -Category "PIP" -Color "Green"
                    } else {
                        Write-DebugLog -Message "User pip Scripts directory not accessible: $userScriptsDir" -Category "PIP" -Color "Gray"
                    }
                } else {
                    Write-DebugLog -Message "Location line not found in user pip show output" -Category "PIP" -Color "Gray"
                }
            } else {
                Write-DebugLog -Message "pip show pip --user command not applicable (likely using system-wide installation)" -Category "PIP" -Color "Gray"
            }
        }
        catch {
            $errorMessage = $_.Exception.Message
            if ($errorMessage -match "WARNING: Package\(s\) not found") {
                Write-DebugLog -Message "User-specific pip not installed (using system-wide pip)" -Category "PIP" -Color "Gray"
            } else {
                Write-DebugLog -Message "Exception while getting user pip location: $errorMessage" -Category "PIP" -Color "Gray"
            }
        }
        
        # Add additional common pip installation paths (only if they exist)
        $additionalPaths = @(
            (Join-Path $env:USERPROFILE ".local\Scripts"),
            (Join-Path $env:APPDATA "Python\Scripts"),
            (Join-Path $env:LOCALAPPDATA "Programs\Python\Scripts"),
            (Join-Path $env:USERPROFILE "AppData\Local\Programs\Python\Scripts"),
            (Join-Path $env:USERPROFILE "AppData\Roaming\Python\Scripts")
        )

        $foundAdditionalPaths = 0
        foreach ($path in $additionalPaths) {
            if (Test-Path $path) {
                $searchPaths += $path
                $foundAdditionalPaths++
                Write-DebugLog -Message "Found additional pip path: $path" -Category "PIP" -Color "Green"
            }
        }

        if ($foundAdditionalPaths -eq 0) {
            Write-DebugLog -Message "No additional user pip paths found (using system-wide Python installation)" -Category "PIP" -Color "Gray"
        } else {
            Write-DebugLog -Message "Added $foundAdditionalPaths additional pip path(s)" -Category "PIP" -Color "Cyan"
        }
        
        # Ensure we have at least one search path
        Write-DebugLog -Message "Final search paths count: $($searchPaths.Count)" -Category "PIP" -Color "Cyan"
        if ($searchPaths.Count -eq 0) {
            Write-DebugLog -Message "WARNING: No valid pip search paths found, adding fallback path" -Category "PIP" -Color "Yellow"
            # Add a fallback path based on pip executable location
            $pipDir = Split-Path $pipExe -Parent
            $fallbackPath = Join-Path $pipDir "Scripts"
            $searchPaths += $fallbackPath
            Write-DebugLog -Message "Added fallback pip path: $fallbackPath" -Category "PIP" -Color "Yellow"
        }
        
        # Log all final search paths
        Write-DebugLog -Message "Final search paths:" -Category "PIP" -Color "Cyan"
        for ($i = 0; $i -lt $searchPaths.Count; $i++) {
            Write-DebugLog -Message "  [$i] $($searchPaths[$i])" -Category "PIP" -Color "Cyan"
        }
    }
    catch {
        Write-DebugLog -Message "CRITICAL ERROR: Error building search paths: $($_.Exception.Message)" -Category "PIP" -Color "Red"
        Write-DebugLog -Message "Stack trace: $($_.ScriptStackTrace)" -Category "PIP" -Color "Red"
        # Don't throw here, continue with empty search paths
        Write-DebugLog -Message "Continuing with empty search paths" -Category "PIP" -Color "Yellow"
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search in all pip paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "PIP" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "PIP" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install package
    # Install package with comprehensive debugging
    Write-DebugLog -Message "Starting pip package installation for: $PackageName" -Category "PIP" -Color "Yellow"
    Write-DebugLog -Message "Search keywords: $($searchKeywords -join ', ')" -Category "PIP" -Color "Cyan"
    Write-DebugLog -Message "Search paths count: $($searchPaths.Count)" -Category "PIP" -Color "Cyan"
    
    try {
        # Try different installation methods with detailed logging
        $installMethods = @(
            @{ Args = @("install", $PackageName); Name = "global installation" },
            @{ Args = @("install", "--upgrade", $PackageName); Name = "upgrade installation" },
            @{ Args = @("install", "--force-reinstall", $PackageName); Name = "force reinstall" }
        )
        
        $installationSuccessful = $false
        $successfulMethod = $null
        
        Write-DebugLog -Message "Will try $($installMethods.Count) installation methods" -Category "PIP" -Color "Cyan"
        
        foreach ($method in $installMethods) {
            Write-DebugLog -Message "=== Trying $($method.Name) ===" -Category "PIP" -Color "Magenta"
            Write-DebugLog -Message "Command: $pipExe $($method.Args -join ' ')" -Category "PIP" -Color "Magenta"

            $startTime = Get-Date
            Write-DebugLog -Message "Starting pip installation..." -Category "PIP" -Color "Cyan"

            & $pipExe $method.Args
            $endTime = Get-Date
            $duration = ($endTime - $startTime).TotalSeconds
            Write-DebugLog -Message "Installation completed in $duration seconds" -Category "PIP" -Color "Cyan"

            $verifyPaths = @()
            if ($pythonScriptsDir -and (Test-Path $pythonScriptsDir)) {
                $verifyPaths += $pythonScriptsDir
            }
            $verifyPaths += $searchPaths

            if (Test-PipPackagePresentOnDisk -PipExe $pipExe -PythonExe $pythonExe -PackageName $PackageName -SearchKeywords $searchKeywords -SearchPaths $verifyPaths -ExecutableExtensions $ExecutableExtensions) {
                Write-DebugLog -Message "SUCCESS: Package present on disk after $($method.Name)" -Category "PIP" -Color "Green"
                $installationSuccessful = $true
                $successfulMethod = $method.Name
                break
            }

            Write-DebugLog -Message "Package not yet present on disk after $($method.Name); trying next method" -Category "PIP" -Color "Yellow"
        }
        
        if ($installationSuccessful) {
            Write-DebugLog -Message "Installation successful with method: $successfulMethod" -Category "PIP" -Color "Green"
            
            # Refresh search paths after installation
            Write-DebugLog -Message "Refreshing search paths after installation..." -Category "PIP" -Color "Magenta"
            $refreshedSearchPaths = @()
            try {
                # Rebuild search paths with the same logic as before
                if ($pythonScriptsDir -and (Test-Path $pythonScriptsDir)) {
                    $refreshedSearchPaths += $pythonScriptsDir
                    Write-DebugLog -Message "Added refreshed path: $pythonScriptsDir" -Category "PIP" -Color "Cyan"
                }
                
                # Add additional common paths
                $additionalPaths = @(
                    (Join-Path $env:USERPROFILE ".local\Scripts"),
                    (Join-Path $env:APPDATA "Python\Scripts"),
                    (Join-Path $env:LOCALAPPDATA "Programs\Python\Scripts")
                )
                
                foreach ($path in $additionalPaths) {
                    if (Test-Path $path) {
                        $refreshedSearchPaths += $path
                        Write-DebugLog -Message "Added refreshed additional path: $path" -Category "PIP" -Color "Cyan"
                    }
                }
                
                # Ensure we have at least one search path
                if ($refreshedSearchPaths.Count -eq 0) {
                    $pipDir = Split-Path $pipExe -Parent
                    $fallbackPath = Join-Path $pipDir "Scripts"
                    $refreshedSearchPaths += $fallbackPath
                    Write-DebugLog -Message "Added refreshed fallback path: $fallbackPath" -Category "PIP" -Color "Yellow"
                }
                
                Write-DebugLog -Message "Refreshed search paths count: $($refreshedSearchPaths.Count)" -Category "PIP" -Color "Cyan"
            }
            catch {
                Write-DebugLog -Message "ERROR: Error refreshing search paths: $($_.Exception.Message)" -Category "PIP" -Color "Yellow"
                # Use original search paths as fallback
                $refreshedSearchPaths = $searchPaths
                Write-DebugLog -Message "Using original search paths as fallback" -Category "PIP" -Color "Yellow"
            }
            
            # Find the installed executable
            Write-DebugLog -Message "Searching for executable after installation..." -Category "PIP" -Color "Magenta"
            Write-DebugLog -Message "Search keywords: $($searchKeywords -join ', ')" -Category "PIP" -Color "Cyan"
            Write-DebugLog -Message "Search paths: $($refreshedSearchPaths -join ', ')" -Category "PIP" -Color "Cyan"
            
            $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $refreshedSearchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
            
            if ($executable) {
                Write-DebugLog -Message "SUCCESS: Found executable: $executable" -Category "PIP" -Color "Green"
                return $executable
            }
            else {
                Write-DebugLog -Message "WARNING: Installation completed but executable not found" -Category "PIP" -Color "Yellow"
                Write-DebugLog -Message "This might be normal for packages that don't install executables" -Category "PIP" -Color "Yellow"
                return $null
            }
        }
        else {
            Write-DebugLog -Message "CRITICAL ERROR: All installation methods failed" -Category "PIP" -Color "Red"
            Write-DebugLog -Message "Package: $PackageName" -Category "PIP" -Color "Red"
            Write-DebugLog -Message "Tried methods: $($installMethods.Name -join ', ')" -Category "PIP" -Color "Red"
            return $null
        }
    }
    catch {
        Write-DebugLog -Message "CRITICAL ERROR: Exception during pip installation: $($_.Exception.Message)" -Category "PIP" -Color "Red"
        Write-DebugLog -Message "Exception type: $($_.Exception.GetType().Name)" -Category "PIP" -Color "Red"
        Write-DebugLog -Message "Stack trace: $($_.ScriptStackTrace)" -Category "PIP" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs Python applications using PIPX with isolated environment support

.DESCRIPTION
    PIPX installation method for Python applications that need isolation.
    PIPX creates isolated virtual environments for each application,
    preventing dependency conflicts while providing global access.
    
    Design Problems Solved:
    - Python applications often have conflicting dependencies
    - Global pip installations can break system Python
    - Application isolation while maintaining global access
    - Consistent binary location and environment setup
    
    Solution Approach:
    - Use pipx for isolated application installation
    - Scan pipx application directories for executables
    - Return executable path for consistent environment variable setup
    - Support application updates and management

.PARAMETER PackageName
    The pipx package name (e.g., "poetry", "black")

.PARAMETER InstallDir
    NOTE: PIPX manages its own installation directory.
    This parameter is kept for API consistency but will be ignored.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "poetry", "black")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Creates isolated virtual environments for each application
    - Prevents dependency conflicts
    - Provides global access to applications
    - Returns executable path for environment variable setup
#>
function Invoke-PipxCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for pipx (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )

    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")

    Write-DebugLog -Message "Processing pipx package: $PackageName" -Category "PIPX" -Color "Cyan"

    # Repair Python environment to get valid paths
    $envRepair = Repair-PythonEnvironment
    if (-not $envRepair.ScriptsDir) {
        Write-DebugLog -Message "CRITICAL: Python environment repair failed - cannot proceed" -Category "PIPX" -Color "Red"
        return $null
    }

    # Try to find pipx using absolute path first
    $pipxExePath = Join-Path $envRepair.ScriptsDir "pipx.exe"
    $pipxExe = $null

    if (Test-Path $pipxExePath) {
        $pipxExe = $pipxExePath
        Write-DebugLog -Message "Found pipx at absolute path: $pipxExePath" -Category "PIPX" -Color "Green"
    } else {
        # Fallback to PATH search
        $pipxExeCmd = Get-Command "pipx" -ErrorAction SilentlyContinue
        if ($pipxExeCmd) {
            $pipxExe = $pipxExeCmd.Source
            Write-DebugLog -Message "Found pipx in PATH: $pipxExe" -Category "PIPX" -Color "Yellow"
        } else {
            Write-DebugLog -Message "pipx not found - needs to be installed via pip first" -Category "PIPX" -Color "Red"
            return $null
        }
    }
    
    # Get pipx home directory using absolute path
    # NOTE: Do NOT use try-catch because pipx's stderr (WARNING) will trigger exceptions
    Write-DebugLog -Message "Getting pipx home directory using absolute path..." -Category "PIPX" -Color "Cyan"
    $pipxEnvOutput = & $pipxExe environment 2>&1  # Capture both stdout and stderr

    $pipxHome = $null
    if ($pipxEnvOutput) {
        # Filter out warnings and find PIPX_HOME
        foreach ($line in $pipxEnvOutput) {
            $lineStr = $line.ToString()
            if ($lineStr -match "PIPX_HOME=(.+)") {
                $pipxHome = $matches[1].Trim()
                break
            }
        }
    }

    if (-not $pipxHome) {
        $pipxHome = Join-Path $env:USERPROFILE ".local"
        Write-DebugLog -Message "Using default PIPX home: $pipxHome" -Category "PIPX" -Color "Yellow"
    } else {
        Write-DebugLog -Message "PIPX home directory: $pipxHome" -Category "PIPX" -Color "Cyan"
    }

    # Build search paths for pipx packages
    $searchPaths = @()

    # PIPX bin directory
    $pipxBinDir = Join-Path $pipxHome "bin"
    $searchPaths += $pipxBinDir
    Write-DebugLog -Message "Added PIPX bin path: $pipxBinDir" -Category "PIPX" -Color "Cyan"

    # PIPX venvs directory for specific package
    $pipxVenvsDir = Join-Path $pipxHome "venvs\$PackageName\Scripts"
    $searchPaths += $pipxVenvsDir
    Write-DebugLog -Message "Added PIPX venv Scripts path: $pipxVenvsDir" -Category "PIPX" -Color "Cyan"

    # Alternative Windows paths
    $windowsPipxBin = Join-Path $env:USERPROFILE ".local\Scripts"
    $searchPaths += $windowsPipxBin
    Write-DebugLog -Message "Added Windows PIPX Scripts path: $windowsPipxBin" -Category "PIPX" -Color "Cyan"

    # Add Python Scripts directory from environment repair
    if ($envRepair.ScriptsDir) {
        $searchPaths += $envRepair.ScriptsDir
        Write-DebugLog -Message "Added Python Scripts directory from envRepair: $($envRepair.ScriptsDir)" -Category "PIPX" -Color "Green"
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search in all pipx paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "PIPX" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "PIPX" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install package
    Write-DebugLog -Message "Installing pipx package: $PackageName" -Category "PIPX" -Color "Yellow"
    try {
        $installArgs = if ($ForceInstall) { @("install", $PackageName, "--force") } else { @("install", $PackageName) }
        $Command = "pipx $($installArgs -join ' ')"
        Write-DebugLog -Message "Command: $Command" -Category "PIPX" -Color "Magenta"
        
        & $pipxExe $installArgs
        
        # Refresh search paths after installation
        Write-DebugLog -Message "Refreshing search paths..." -Category "PIPX" -Color "Magenta"
        $searchPaths = @()
        try {
            $pipxBinDir = Join-Path $pipxHome "bin"
            $searchPaths += $pipxBinDir
            $pipxVenvsDir = Join-Path $pipxHome "venvs\$PackageName\Scripts"
            $searchPaths += $pipxVenvsDir
            $windowsPipxBin = Join-Path $env:USERPROFILE ".local\Scripts"
            $searchPaths += $windowsPipxBin
        }
        catch {
            Write-DebugLog -Message "Error in refresh search paths: $($_.Exception.Message)" -Category "PIPX" -Color "Red"
            throw
        }
        
        # Find the installed executable
        Write-DebugLog -Message "Searching for executable after installation..." -Category "PIPX" -Color "Magenta"
        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
        
        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "PIPX" -Color "Green"
            return $executable
        }
        
        Write-DebugLog -Message "Installation completed but executable not found" -Category "PIPX" -Color "Yellow"
        
        # Try uninstall and reinstall for error recovery
        if (-not $ForceInstall) {
            Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "PIPX" -Color "Yellow"
            & $pipxExe uninstall $PackageName 2>$null
            Start-Sleep -Seconds 2
            & $pipxExe install $PackageName --force
            $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
            return $executable
        }
        
        return $null
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "PIPX" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs Python packages using UV with fast dependency resolution

.DESCRIPTION
    UV installation method that leverages UV's fast Python package installer
    and resolver. UV is significantly faster than pip and provides better
    dependency resolution.
    
    Design Problems Solved:
    - Slow pip installation and dependency resolution
    - Complex dependency conflicts in Python projects
    - Inconsistent package verification methods
    - Environment setup complexity
    
    Solution Approach:
    - Use UV for fast package installation and dependency resolution
    - Leverage UV's built-in verification capabilities
    - Return executable path for consistent environment variable setup
    - Support both global and project-specific installations

.PARAMETER PackageName
    The UV package name (e.g., "requests", "black")

.PARAMETER InstallDir
    NOTE: UV manages its own installation strategy.
    This parameter is kept for API consistency but may be used for project-specific installs.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "black", "pylint")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Significantly faster than pip
    - Better dependency resolution
    - Compatible with existing Python workflows
    - Returns executable path for environment variable setup
#>
function Invoke-UvCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "",
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )

    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")

    Write-DebugLog -Message "Processing uv package: $PackageName" -Category "UV" -Color "Cyan"

    # Repair Python environment to get valid paths
    $envRepair = Repair-PythonEnvironment
    if (-not $envRepair.ScriptsDir) {
        Write-DebugLog -Message "CRITICAL: Python environment repair failed - cannot proceed" -Category "UV" -Color "Red"
        return $null
    }

    # Try to find uv using absolute path first
    $uvExePath = Join-Path $envRepair.ScriptsDir "uv.exe"
    $uvExe = $null

    if (Test-Path $uvExePath) {
        $uvExe = $uvExePath
        Write-DebugLog -Message "Found uv at absolute path: $uvExePath" -Category "UV" -Color "Green"
    } else {
        # Fallback to PATH search
        $uvExeCmd = Get-Command "uv" -ErrorAction SilentlyContinue
        if ($uvExeCmd) {
            $uvExe = $uvExeCmd.Source
            Write-DebugLog -Message "Found uv in PATH: $uvExe" -Category "UV" -Color "Yellow"
        } else {
            Write-DebugLog -Message "uv not found, attempting to install via pip..." -Category "UV" -Color "Yellow"
            try {
                # Use absolute path to pip
                $pipExe = $envRepair.PipExe
                if ($pipExe) {
                    & $pipExe install uv
                    if (Test-Path $uvExePath) {
                        $uvExe = $uvExePath
                        Write-DebugLog -Message "uv installed successfully at: $uvExePath" -Category "UV" -Color "Green"
                    } else {
                        Write-DebugLog -Message "uv installation failed - executable not found" -Category "UV" -Color "Red"
                        return $null
                    }
                } else {
                    Write-DebugLog -Message "pip not found, cannot install uv" -Category "UV" -Color "Red"
                    return $null
                }
            }
            catch {
                Write-DebugLog -Message "Error installing uv: $($_.Exception.Message)" -Category "UV" -Color "Red"
                return $null
            }
        }
    }
    
    # Get Python Scripts directories for uv packages
    # CRITICAL: Use absolute paths from environment repair, not PATH
    $searchPaths = @()

    # Get uv installation paths using absolute path
    # NOTE: Do NOT use try-catch because uv's stderr (WARNING) will trigger exceptions
    Write-DebugLog -Message "Getting uv tool directory using absolute path..." -Category "UV" -Color "Cyan"
    $uvToolOutput = & $uvExe tool dir 2>&1  # Capture both stdout and stderr

    if ($uvToolOutput) {
        # Filter out warnings and get actual path
        $uvToolPath = $null
        foreach ($line in $uvToolOutput) {
            $lineStr = $line.ToString()
            if ($lineStr -notmatch "^WARNING:" -and $lineStr -notmatch "^ERROR:" -and $lineStr.Trim() -ne "") {
                $uvToolPath = $lineStr.Trim()
                break
            }
        }

        if ($uvToolPath -and (Test-Path $uvToolPath)) {
            $searchPaths += $uvToolPath
            Write-DebugLog -Message "Added uv tool directory: $uvToolPath" -Category "UV" -Color "Green"
        }
    }

    # Use Python Scripts directory from environment repair
    # This is the CORRECT directory (D:\.dev_win10\python313\Scripts)
    if ($envRepair.ScriptsDir) {
        $searchPaths += $envRepair.ScriptsDir
        Write-DebugLog -Message "Added Python Scripts directory from envRepair: $($envRepair.ScriptsDir)" -Category "UV" -Color "Green"
    }

    # UV home directory for user-installed tools
    $uvHome = Join-Path $env:USERPROFILE ".local\bin"
    if (Test-Path $uvHome) {
        $searchPaths += $uvHome
        Write-DebugLog -Message "Added UV home bin path: $uvHome" -Category "UV" -Color "Cyan"
    }

    # Ensure we have at least one search path
    if ($searchPaths.Count -eq 0) {
        Write-DebugLog -Message "WARNING: No search paths found, using fallback" -Category "UV" -Color "Yellow"
        $searchPaths += (Split-Path -Parent $uvExe)
    }

    Write-DebugLog -Message "Final UV search paths count: $($searchPaths.Count)" -Category "UV" -Color "Cyan"
    for ($i = 0; $i -lt $searchPaths.Count; $i++) {
        Write-DebugLog -Message "  [$i] $($searchPaths[$i])" -Category "UV" -Color "Cyan"
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search in all uv paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "UV" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "UV" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install package
    Write-DebugLog -Message "Installing uv package: $PackageName" -Category "UV" -Color "Yellow"
    try {
        # Try uv tool install first (for applications), fallback to uv pip install
        $installArgs = @("tool", "install", $PackageName)
        if ($ForceInstall) {
            $installArgs += "--force"
        }
        
        $Command = "uv $($installArgs -join ' ')"
        Write-DebugLog -Message "Command: $Command" -Category "UV" -Color "Magenta"
        
        & $uvExe $installArgs
        
        # Refresh search paths after tool install
        Write-DebugLog -Message "Refreshing search paths..." -Category "UV" -Color "Magenta"
        $searchPaths = @()
        try {
            $uvTool = & $uvExe tool dir 2>$null
            if ($uvTool) {
                $searchPaths += $uvTool
            }
            
            if ($pipExe) {
                $pythonScriptsDir = & $pipExe show pip 2>$null | Select-String "Location:" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }
                if ($pythonScriptsDir) {
                    $scriptsDir = Join-Path $pythonScriptsDir "Scripts"
                    $searchPaths += $scriptsDir
                    $userPipDir = & $pipExe show pip --user 2>$null | Select-String "Location:" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }
                    if ($userPipDir) {
                        $userScriptsDir = Join-Path $userPipDir "Scripts"
                        $searchPaths += $userScriptsDir
                    }
                }
            }
            
            $uvHome = Join-Path $env:USERPROFILE ".local\bin"
            $searchPaths += $uvHome
        }
        catch {
            Write-DebugLog -Message "Error in refresh search paths: $($_.Exception.Message)" -Category "UV" -Color "Red"
            throw
        }
        
        # Find the installed executable
        Write-DebugLog -Message "Searching for executable after installation..." -Category "UV" -Color "Magenta"
        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
        
        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "UV" -Color "Green"
            return $executable
        }
        
        Write-DebugLog -Message "UV tool install did not produce executable, trying pip install..." -Category "UV" -Color "Yellow"
        $pipInstallArgs = @("pip", "install", $PackageName)
        if ($ForceInstall) {
            $pipInstallArgs += "--force-reinstall"
        }
        & $uvExe $pipInstallArgs
        
        # Refresh search paths after pip install
        Write-DebugLog -Message "Refreshing search paths after pip install..." -Category "UV" -Color "Magenta"
        $searchPaths = @()
        try {
            $uvTool = & $uvExe tool dir 2>$null
            if ($uvTool) {
                $searchPaths += $uvTool
            }
            
            $pipExe = $envRepair.PipExe
            if ($pipExe) {
                $pythonScriptsDir = & $pipExe show pip 2>$null | Select-String "Location:" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }
                if ($pythonScriptsDir) {
                    $scriptsDir = Join-Path $pythonScriptsDir "Scripts"
                    $searchPaths += $scriptsDir
                    $userPipDir = & $pipExe show pip --user 2>$null | Select-String "Location:" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }
                    if ($userPipDir) {
                        $userScriptsDir = Join-Path $userPipDir "Scripts"
                        $searchPaths += $userScriptsDir
                    }
                }
            }
            
            $uvHome = Join-Path $env:USERPROFILE ".local\bin"
            $searchPaths += $uvHome
        }
        catch {
            Write-DebugLog -Message "Error in refresh search paths: $($_.Exception.Message)" -Category "UV" -Color "Red"
            throw
        }
        
        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
        
        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "UV" -Color "Green"
            return $executable
        }
        
        Write-DebugLog -Message "Installation completed but executable not found" -Category "UV" -Color "Yellow"
        return $null
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "UV" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs Python packages using UVX with isolated tool execution

.DESCRIPTION
    UVX installation method that leverages UV's isolated tool execution.
    UVX is similar to pipx but uses UV's fast dependency resolution.
    It runs Python tools in isolated environments.
    
    Design Problems Solved:
    - Need for isolated Python tool execution
    - Fast dependency resolution for tools
    - Consistent tool installation across environments
    
    Solution Approach:
    - Use UVX for isolated tool installation and execution
    - Leverage UV's fast dependency resolution
    - Return executable path for consistent environment variable setup
    - Support both temporary execution and permanent installation

.PARAMETER PackageName
    The UVX package name (e.g., "black", "pylint", "mcp-feedback-enhanced@latest")

.PARAMETER InstallDir
    NOTE: UVX manages its own installation strategy.
    This parameter is kept for API consistency but is ignored.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "black", "pylint")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Similar to pipx but uses UV's fast resolver
    - Isolated tool execution
    - Compatible with existing Python workflows
    - Returns executable path for environment variable setup
#>
function Invoke-UvxCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for uvx (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )

    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")

    Write-DebugLog -Message "Processing uvx package: $PackageName" -Category "UVX" -Color "Cyan"

    # Repair Python environment to get valid paths
    $envRepair = Repair-PythonEnvironment
    if (-not $envRepair.ScriptsDir) {
        Write-DebugLog -Message "CRITICAL: Python environment repair failed - cannot proceed" -Category "UVX" -Color "Red"
        return $null
    }

    # Try to find uv using absolute path first (uvx is part of uv)
    $uvExePath = Join-Path $envRepair.ScriptsDir "uv.exe"
    $uvExe = $null

    if (Test-Path $uvExePath) {
        $uvExe = $uvExePath
        Write-DebugLog -Message "Found uv at absolute path: $uvExePath" -Category "UVX" -Color "Green"
    } else {
        # Fallback to PATH search
        $uvExeCmd = Get-Command "uv" -ErrorAction SilentlyContinue
        if ($uvExeCmd) {
            $uvExe = $uvExeCmd.Source
            Write-DebugLog -Message "Found uv in PATH: $uvExe" -Category "UVX" -Color "Yellow"
        } else {
            Write-DebugLog -Message "uv not found, attempting to install via pip..." -Category "UVX" -Color "Yellow"
            try {
                # Use absolute path to pip
                $pipExe = $envRepair.PipExe
                if ($pipExe) {
                    & $pipExe install uv
                    if (Test-Path $uvExePath) {
                        $uvExe = $uvExePath
                        Write-DebugLog -Message "uv installed successfully at: $uvExePath" -Category "UVX" -Color "Green"
                    } else {
                        Write-DebugLog -Message "uv installation failed - executable not found" -Category "UVX" -Color "Red"
                        return $null
                    }
                } else {
                    Write-DebugLog -Message "pip not found, cannot install uv" -Category "UVX" -Color "Red"
                    return $null
                }
            }
            catch {
                Write-DebugLog -Message "Error installing uv: $($_.Exception.Message)" -Category "UVX" -Color "Red"
                return $null
            }
        }
    }
    
    # Get uv tool directory for installed packages
    $searchPaths = @()

    # Get uv tool directory using absolute path
    # NOTE: Do NOT use try-catch because uv's stderr (WARNING) will trigger exceptions
    Write-DebugLog -Message "Getting uv tool directory using absolute path..." -Category "UVX" -Color "Cyan"
    $uvToolOutput = & $uvExe tool dir 2>&1  # Capture both stdout and stderr

    if ($uvToolOutput) {
        # Filter out warnings and get actual path
        $uvToolPath = $null
        foreach ($line in $uvToolOutput) {
            $lineStr = $line.ToString()
            if ($lineStr -notmatch "^WARNING:" -and $lineStr -notmatch "^ERROR:" -and $lineStr.Trim() -ne "") {
                $uvToolPath = $lineStr.Trim()
                break
            }
        }

        if ($uvToolPath -and (Test-Path $uvToolPath)) {
            $searchPaths += $uvToolPath
            Write-DebugLog -Message "Added uv tool directory: $uvToolPath" -Category "UVX" -Color "Green"
        }
    }

    # Use Python Scripts directory from environment repair
    if ($envRepair.ScriptsDir) {
        $searchPaths += $envRepair.ScriptsDir
        Write-DebugLog -Message "Added Python Scripts directory from envRepair: $($envRepair.ScriptsDir)" -Category "UVX" -Color "Green"
    }

    # UV home directory for user-installed tools
    $uvHome = Join-Path $env:USERPROFILE ".local\bin"
    if (Test-Path $uvHome) {
        $searchPaths += $uvHome
        Write-DebugLog -Message "Added UV home bin path: $uvHome" -Category "UVX" -Color "Cyan"
    }

    # Ensure we have at least one search path
    if ($searchPaths.Count -eq 0) {
        Write-DebugLog -Message "WARNING: No search paths found, using fallback" -Category "UVX" -Color "Yellow"
        $searchPaths += (Split-Path -Parent $uvExe)
    }

    Write-DebugLog -Message "Final UVX search paths count: $($searchPaths.Count)" -Category "UVX" -Color "Cyan"
    for ($i = 0; $i -lt $searchPaths.Count; $i++) {
        Write-DebugLog -Message "  [$i] $($searchPaths[$i])" -Category "UVX" -Color "Cyan"
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        # Extract package name from PackageName (remove version specifier if present)
        $packageNameOnly = $PackageName -replace '@.*$', ''
        $searchKeywords = @($packageNameOnly)
    }
    
    # Check if already installed - search in all uv paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "UVX" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "UVX" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install package using uv tool install (uvx uses uv tool install under the hood)
    Write-DebugLog -Message "Installing uvx package: $PackageName" -Category "UVX" -Color "Yellow"
    try {
        # Use uv tool install for permanent installation
        $installArgs = @("tool", "install", $PackageName)
        if ($ForceInstall) {
            $installArgs += "--force"
        }
        
        $Command = "uv $($installArgs -join ' ')"
        Write-DebugLog -Message "Command: $Command" -Category "UVX" -Color "Magenta"
        
        & $uvExe $installArgs
        
        # Refresh search paths after installation
        Write-DebugLog -Message "Refreshing search paths..." -Category "UVX" -Color "Magenta"
        $searchPaths = @()
        try {
            $uvTool = & $uvExe tool dir 2>&1
            if ($uvTool) {
                # Filter out warnings
                foreach ($line in $uvTool) {
                    $lineStr = $line.ToString()
                    if ($lineStr -notmatch "^WARNING:" -and $lineStr -notmatch "^ERROR:" -and $lineStr.Trim() -ne "") {
                        $searchPaths += $lineStr.Trim()
                        break
                    }
                }
            }
            
            if ($envRepair.ScriptsDir) {
                $searchPaths += $envRepair.ScriptsDir
            }
            
            $uvHome = Join-Path $env:USERPROFILE ".local\bin"
            if (Test-Path $uvHome) {
                $searchPaths += $uvHome
            }
        }
        catch {
            Write-DebugLog -Message "Error in refresh search paths: $($_.Exception.Message)" -Category "UVX" -Color "Red"
            throw
        }
        
        # Find the installed executable
        Write-DebugLog -Message "Searching for executable after installation..." -Category "UVX" -Color "Magenta"
        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
        
        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "UVX" -Color "Green"
            return $executable
        }
        
        Write-DebugLog -Message "Installation completed but executable not found" -Category "UVX" -Color "Yellow"
        
        # Try uninstall and reinstall for error recovery
        if (-not $ForceInstall) {
            Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "UVX" -Color "Yellow"
            # Extract package name without version
            $packageNameOnly = $PackageName -replace '@.*$', ''
            & $uvExe tool uninstall $packageNameOnly 2>$null
            Start-Sleep -Seconds 2
            & $uvExe tool install $PackageName --force
            $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
            return $executable
        }
        
        return $null
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "UVX" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs Python packages using Poetry with dependency management

.DESCRIPTION
    Poetry installation method that leverages Poetry's dependency management
    and packaging capabilities. Poetry is designed for Python project
    dependency management and packaging.
    
    Design Problems Solved:
    - Complex Python dependency management
    - Inconsistent package versioning across projects
    - Environment isolation and reproducibility
    - Package distribution and publishing
    
    Solution Approach:
    - Use Poetry for dependency management and installation
    - Leverage Poetry's virtual environment management
    - Return executable path for consistent environment variable setup
    # - Support both development and production installations

.PARAMETER PackageName
    The Poetry package name (e.g., "requests", "black")

.PARAMETER InstallDir
    NOTE: Poetry manages virtual environments automatically.
    This parameter is kept for API consistency but may be used for project-specific installs.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "black", "pylint")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Manages dependencies and virtual environments
    - Provides reproducible builds
    - Supports package publishing
    - Returns executable path for environment variable setup
#>
function Invoke-PoetryCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "",
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )

    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")

    Write-DebugLog -Message "Processing poetry package: $PackageName" -Category "POETRY" -Color "Cyan"

    # Repair Python environment to get valid paths
    $envRepair = Repair-PythonEnvironment
    if (-not $envRepair.ScriptsDir) {
        Write-DebugLog -Message "CRITICAL: Python environment repair failed - cannot proceed" -Category "POETRY" -Color "Red"
        return $null
    }

    # Try to find poetry using absolute path first
    $poetryExePath = Join-Path $envRepair.ScriptsDir "poetry.exe"
    $poetryExe = $null

    if (Test-Path $poetryExePath) {
        $poetryExe = $poetryExePath
        Write-DebugLog -Message "Found poetry at absolute path: $poetryExePath" -Category "POETRY" -Color "Green"
    } else {
        # Fallback to PATH search
        $poetryExeCmd = Get-Command "poetry" -ErrorAction SilentlyContinue
        if ($poetryExeCmd) {
            $poetryExe = $poetryExeCmd.Source
            Write-DebugLog -Message "Found poetry in PATH: $poetryExe" -Category "POETRY" -Color "Yellow"
        } else {
            Write-DebugLog -Message "Poetry not found - fallback to pip installation" -Category "POETRY" -Color "Yellow"
            # Poetry doesn't exist, fallback to pip
            return Invoke-PipCommand -PackageName $PackageName -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -OnlyCheckFlag $OnlyCheckFlag -ForceInstall $ForceInstall
        }
    }
    
    # Get Poetry configuration paths
    $searchPaths = @()
    try {
        # Poetry's cache and venv directories
        $poetryConfig = & $poetryExe config --list 2>$null
        if ($poetryConfig) {
            $cacheDir = $poetryConfig | Select-String "cache-dir" | ForEach-Object { $_.ToString().Split("=")[1].Trim().Trim('"') }
            $virtualenvsPath = $poetryConfig | Select-String "virtualenvs.path" | ForEach-Object { $_.ToString().Split("=")[1].Trim().Trim('"') }
            
            if ($cacheDir) {
                $searchPaths += $cacheDir
                Write-DebugLog -Message "Added Poetry cache directory: $cacheDir" -Category "POETRY" -Color "Magenta"
            }
            
            if ($virtualenvsPath) {
                $searchPaths += $virtualenvsPath
                Write-DebugLog -Message "Added Poetry venvs path: $virtualenvsPath" -Category "POETRY" -Color "Magenta"
            }
        }
        
        # Default Poetry paths on Windows
        $poetryDefaultCache = Join-Path $env:LOCALAPPDATA "pypoetry"
        $searchPaths += $poetryDefaultCache
        Write-DebugLog -Message "Added Poetry default cache: $poetryDefaultCache" -Category "POETRY" -Color "Magenta"
        
        # Poetry's own installation Scripts directory
        $poetryDataDir = Join-Path $env:APPDATA "Python\Scripts"
        $searchPaths += $poetryDataDir
        Write-DebugLog -Message "Added Poetry data Scripts: $poetryDataDir" -Category "POETRY" -Color "Magenta"
        
        # Also check standard Python paths since Poetry often uses pip underneath
        $pipExePath = $envRepair.PipExe
        if ($pipExePath) {
            $pythonScriptsDir = & $pipExePath show pip 2>$null | Select-String "Location:" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }
            if ($pythonScriptsDir) {
                $scriptsDir = Join-Path $pythonScriptsDir "Scripts"
                $searchPaths += $scriptsDir
                Write-DebugLog -Message "Added Python Scripts path: $scriptsDir" -Category "POETRY" -Color "Magenta"
            }
        }
    }
    catch {
        Write-DebugLog -Message "Error building search paths: $($_.Exception.Message)" -Category "POETRY" -Color "Red"
        throw
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search in all poetry paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "POETRY" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "POETRY" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install package - Poetry doesn't have global package install like pip
    # We'll use pip as fallback for global installations
    Write-DebugLog -Message "Poetry doesn't support global package installation, using pip fallback for: $PackageName" -Category "POETRY" -Color "Yellow"
    
    try {
        # Use pip for global package installation since Poetry is project-focused
        $pipResult = Invoke-PipCommand -PackageName $PackageName -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -OnlyCheckFlag $false -ForceInstall $ForceInstall
        
        if ($pipResult) {
            Write-DebugLog -Message "Poetry fallback pip installation successful: $pipResult" -Category "POETRY" -Color "Green"
            return $pipResult
        } else {
            Write-DebugLog -Message "Poetry fallback pip installation failed" -Category "POETRY" -Color "Red"
            return $null
        }
    }
    catch {
        Write-DebugLog -Message "Poetry installation error: $($_.Exception.Message)" -Category "POETRY" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs packages using Chocolatey with custom installation directory support

.DESCRIPTION
    Chocolatey installation method that provides Windows package management
    with custom installation directory support. Chocolatey is an alternative
    to winget with different package availability and installation behavior.
    
    Design Problems Solved:
    - Winget package availability limitations
    - Need for alternative Windows package manager
    - Custom installation directory requirements
    - Consistent binary scanning and verification
    
    Solution Approach:
    - Use Chocolatey for package installation
    - Support custom installation directories where possible
    - Use binary scanning for verification (faster than choco list)
    - Return executable path for consistent environment variable setup

.PARAMETER PackageName
    The Chocolatey package name (e.g., "git", "nodejs")

.PARAMETER InstallDir
    Custom installation directory (supported by Chocolatey)

.PARAMETER Keyword
    Primary executable name for detection (e.g., "git", "node")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Alternative to winget with different package availability
    - Supports custom installation directories
    - Uses binary scanning for faster verification
    - Returns executable path for environment variable setup
#>
function Invoke-ChocoCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "",
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )
    
    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")
    
    Write-DebugLog -Message "Processing chocolatey package: $PackageName" -Category "CHOCO" -Color "Cyan"
    
    # Check if chocolatey is available
    $chocoExe = Get-Command "choco" -ErrorAction SilentlyContinue
    if (-not $chocoExe) {
        Write-DebugLog -Message "Chocolatey not found in PATH" -Category "CHOCO" -Color "Red"
        return $null
    }
    
    # Build search paths for chocolatey packages
    $searchPaths = @()
    try {
        # Chocolatey default installation directories
        $chocoInstallPath = $env:ChocolateyInstall
        if (-not $chocoInstallPath) {
            $chocoInstallPath = "$env:ProgramData\chocolatey"
        }
        
        # Main chocolatey bin directory
        $chocoBinDir = Join-Path $chocoInstallPath "bin"
        $searchPaths += $chocoBinDir
        Write-DebugLog -Message "Added chocolatey bin path: $chocoBinDir" -Category "CHOCO" -Color "Magenta"
        
        # Package-specific installation directory
        if ($InstallDir) {
            $searchPaths += $InstallDir
            Write-DebugLog -Message "Added custom install directory: $InstallDir" -Category "CHOCO" -Color "Magenta"
        }
        
        # Chocolatey lib directory for package-specific binaries
        $chocoLibDir = Join-Path $chocoInstallPath "lib\$PackageName\tools"
        $searchPaths += $chocoLibDir
        Write-DebugLog -Message "Added chocolatey lib tools path: $chocoLibDir" -Category "CHOCO" -Color "Magenta"
        
        # Alternative lib path structure
        $chocoLibBinDir = Join-Path $chocoInstallPath "lib\$PackageName\bin"
        $searchPaths += $chocoLibBinDir
        Write-DebugLog -Message "Added chocolatey lib bin path: $chocoLibBinDir" -Category "CHOCO" -Color "Magenta"
    }
    catch {
        Write-DebugLog -Message "Error building search paths: $($_.Exception.Message)" -Category "CHOCO" -Color "Red"
        throw
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search in all chocolatey paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "CHOCO" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "CHOCO" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install package
    Write-DebugLog -Message "Installing chocolatey package: $PackageName" -Category "CHOCO" -Color "Yellow"
    try {
        $installArgs = @("install", $PackageName, "-y")
        if ($InstallDir) {
            $installArgs += "--install-directory=$InstallDir"
        }
        if ($ForceInstall) {
            $installArgs += "--force"
        }
        
        $Command = "choco $($installArgs -join ' ')"
        Write-DebugLog -Message "Command: $Command" -Category "CHOCO" -Color "Magenta"
        
        & choco $installArgs
        
        # Refresh search paths after installation
        Write-DebugLog -Message "Refreshing search paths..." -Category "CHOCO" -Color "Magenta"
        $searchPaths = @()
        try {
            $chocoBinDir = Join-Path $chocoInstallPath "bin"
            $searchPaths += $chocoBinDir
            if ($InstallDir) {
                $searchPaths += $InstallDir
            }
            $chocoLibDir = Join-Path $chocoInstallPath "lib\$PackageName\tools"
            $searchPaths += $chocoLibDir
            $chocoLibBinDir = Join-Path $chocoInstallPath "lib\$PackageName\bin"
            $searchPaths += $chocoLibBinDir
        }
        catch {
            Write-DebugLog -Message "Error in refresh search paths: $($_.Exception.Message)" -Category "CHOCO" -Color "Red"
            throw
        }
        
        # Find the installed executable
        Write-DebugLog -Message "Searching for executable after installation..." -Category "CHOCO" -Color "Magenta"
        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
        
        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "CHOCO" -Color "Green"
            return $executable
        }
        
        Write-DebugLog -Message "Installation completed but executable not found" -Category "CHOCO" -Color "Yellow"
        
        # Try uninstall and reinstall for error recovery
        if (-not $ForceInstall) {
            Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "CHOCO" -Color "Yellow"
            & choco uninstall $PackageName -y 2>$null
            Start-Sleep -Seconds 2
            $retryArgs = @("install", $PackageName, "-y", "--force")
            if ($InstallDir) {
                $retryArgs += "--install-directory=$InstallDir"
            }
            & choco $retryArgs
            $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
            return $executable
        }
        
        return $null
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "CHOCO" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs command-line applications using Scoop with user-controlled directories

.DESCRIPTION
    Scoop installation method for command-line applications with user-controlled
    installation directories. Scoop is designed for command-line tools and
    provides isolation and easy management.
    
    Design Problems Solved:
    - Need for user-controlled installation directories
    - Command-line application isolation
    - Easy application updates and management
    - Consistent binary location and environment setup
    
    Solution Approach:
    - Use Scoop for command-line application installation
    # - Leverage Scoop's user-controlled directory structure
    - Use binary scanning for verification
    - Return executable path for consistent environment variable setup

.PARAMETER PackageName
    The Scoop package name (e.g., "git", "nodejs")

.PARAMETER InstallDir
    NOTE: Scoop manages its own directory structure.
    This parameter is kept for API consistency but will be ignored.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "git", "node")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Designed for command-line applications
    - User-controlled installation directories
    - Easy updates and management
    - Returns executable path for environment variable setup
#>
function Invoke-ScoopCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for scoop (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )
    
    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")
    
    Write-DebugLog -Message "Processing scoop package: $PackageName" -Category "SCOOP" -Color "Cyan"
    
    # Check if scoop is available
    $scoopExe = Get-Command "scoop" -ErrorAction SilentlyContinue
    if (-not $scoopExe) {
        Write-DebugLog -Message "Scoop not found in PATH" -Category "SCOOP" -Color "Red"
        return $null
    }
    
    # Get scoop installation directory
    try {
        $scoopInstallPath = $env:SCOOP
        if (-not $scoopInstallPath) {
            $scoopInstallPath = Join-Path $env:USERPROFILE "scoop"
        }
        Write-DebugLog -Message "Scoop installation path: $scoopInstallPath" -Category "SCOOP" -Color "Cyan"
    }
    catch {
        Write-DebugLog -Message "Failed to determine scoop installation path: $($_.Exception.Message)" -Category "SCOOP" -Color "Red"
        return $null
    }
    
    # Build search paths for scoop packages
    $searchPaths = @()
    try {
        # Scoop shims directory (primary location for executables)
        $scoopShimsDir = Join-Path $scoopInstallPath "shims"
        $searchPaths += $scoopShimsDir
        Write-DebugLog -Message "Added scoop shims path: $scoopShimsDir" -Category "SCOOP" -Color "Magenta"
        
        # Package-specific installation directory
        $scoopAppsDir = Join-Path $scoopInstallPath "apps\$PackageName\current"
        $searchPaths += $scoopAppsDir
        Write-DebugLog -Message "Added scoop app current path: $scoopAppsDir" -Category "SCOOP" -Color "Magenta"
        
        # Package bin directory
        $scoopAppBinDir = Join-Path $scoopInstallPath "apps\$PackageName\current\bin"
        $searchPaths += $scoopAppBinDir
        Write-DebugLog -Message "Added scoop app bin path: $scoopAppBinDir" -Category "SCOOP" -Color "Magenta"
        
        # Global scoop installation paths
        $globalScoopPath = $env:SCOOP_GLOBAL
        if (-not $globalScoopPath) {
            $globalScoopPath = "$env:ProgramData\scoop"
        }
        
        if (Test-Path $globalScoopPath) {
            $globalScoopShims = Join-Path $globalScoopPath "shims"
            $searchPaths += $globalScoopShims
            Write-DebugLog -Message "Added global scoop shims path: $globalScoopShims" -Category "SCOOP" -Color "Magenta"
            
            $globalScoopAppsDir = Join-Path $globalScoopPath "apps\$PackageName\current"
            $searchPaths += $globalScoopAppsDir
            Write-DebugLog -Message "Added global scoop app current path: $globalScoopAppsDir" -Category "SCOOP" -Color "Magenta"
        }
    }
    catch {
        Write-DebugLog -Message "Error building search paths: $($_.Exception.Message)" -Category "SCOOP" -Color "Red"
        throw
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search in all scoop paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "SCOOP" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "SCOOP" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install package
    Write-DebugLog -Message "Installing scoop package: $PackageName" -Category "SCOOP" -Color "Yellow"
    try {
        $installArgs = @("install", $PackageName)
        if ($ForceInstall) {
            $installArgs += "--force"
        }
        
        $Command = "scoop $($installArgs -join ' ')"
        Write-DebugLog -Message "Command: $Command" -Category "SCOOP" -Color "Magenta"
        
        & scoop $installArgs
        
        # Refresh search paths after installation
        Write-DebugLog -Message "Refreshing search paths..." -Category "SCOOP" -Color "Magenta"
        $searchPaths = @()
        try {
            $scoopShimsDir = Join-Path $scoopInstallPath "shims"
            $searchPaths += $scoopShimsDir
            $scoopAppsDir = Join-Path $scoopInstallPath "apps\$PackageName\current"
            $searchPaths += $scoopAppsDir
            $scoopAppBinDir = Join-Path $scoopInstallPath "apps\$PackageName\current\bin"
            $searchPaths += $scoopAppBinDir
            
            if (Test-Path $globalScoopPath) {
                $globalScoopShims = Join-Path $globalScoopPath "shims"
                $searchPaths += $globalScoopShims
                $globalScoopAppsDir = Join-Path $globalScoopPath "apps\$PackageName\current"
                $searchPaths += $globalScoopAppsDir
            }
        }
        catch {
            Write-DebugLog -Message "Error in refresh search paths: $($_.Exception.Message)" -Category "SCOOP" -Color "Red"
            throw
        }
        
        # Find the installed executable
        Write-DebugLog -Message "Searching for executable after installation..." -Category "SCOOP" -Color "Magenta"
        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
        
        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "SCOOP" -Color "Green"
            return $executable
        }
        
        Write-DebugLog -Message "Installation completed but executable not found" -Category "SCOOP" -Color "Yellow"
        
        # Try uninstall and reinstall for error recovery
        if (-not $ForceInstall) {
            Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "SCOOP" -Color "Yellow"
            & scoop uninstall $PackageName 2>$null
            Start-Sleep -Seconds 2
            & scoop install $PackageName --force
            $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
            return $executable
        }
        
        return $null
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "SCOOP" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs Rust crates using Cargo with binary scanning verification

.DESCRIPTION
    Cargo installation method for Rust crates with binary scanning verification.
    Cargo is Rust's package manager and build system, providing dependency
    management and compilation.
    
    Design Problems Solved:
    - Rust crate installation and dependency management
    - Binary compilation and installation
    - Environment variable setup for Rust tools
    - Consistent verification across different installation methods
    
    Solution Approach:
    - Use Cargo for crate installation and compilation
    - Scan Cargo's binary output directories
    - Return executable path for consistent environment variable setup
    - Support both local and global installations

.PARAMETER PackageName
    The Cargo crate name (e.g., "ripgrep", "fd")

.PARAMETER InstallDir
    NOTE: Cargo manages its own installation strategy.
    This parameter is kept for API consistency but will be ignored.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "rg", "fd")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Rust's official package manager and build system
    - Compiles binaries from source
    - Manages dependencies automatically
    - Returns executable path for environment variable setup
#>
function Invoke-CargoCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for cargo (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )
    
    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")
    
    Write-DebugLog -Message "Processing cargo crate: $PackageName" -Category "CARGO" -Color "Cyan"
    
    # Check if cargo is available
    $cargoExe = Get-Command "cargo" -ErrorAction SilentlyContinue
    if (-not $cargoExe) {
        Write-DebugLog -Message "Cargo not found in PATH" -Category "CARGO" -Color "Red"
        return $null
    }
    
    # Get cargo installation directory
    try {
        $cargoHome = $env:CARGO_HOME
        if (-not $cargoHome) {
            $cargoHome = Join-Path $env:USERPROFILE ".cargo"
        }
        Write-DebugLog -Message "Cargo home directory: $cargoHome" -Category "CARGO" -Color "Cyan"
    }
    catch {
        Write-DebugLog -Message "Failed to determine cargo home directory: $($_.Exception.Message)" -Category "CARGO" -Color "Red"
        return $null
    }
    
    # Build search paths for cargo binaries
    $searchPaths = @()
    try {
        # Cargo bin directory (primary location for installed binaries)
        $cargoBinDir = Join-Path $cargoHome "bin"
        $searchPaths += $cargoBinDir
        Write-DebugLog -Message "Added cargo bin path: $cargoBinDir" -Category "CARGO" -Color "Magenta"
        
        # Rust toolchain bin directory
        $rustupHome = $env:RUSTUP_HOME
        if (-not $rustupHome) {
            $rustupHome = Join-Path $env:USERPROFILE ".rustup"
        }
        
        if (Test-Path $rustupHome) {
            # Find active toolchain
            $activeToolchain = & rustup show active-toolchain 2>$null
            if ($activeToolchain) {
                $toolchainName = $activeToolchain.Split()[0]
                $toolchainBinDir = Join-Path $rustupHome "toolchains\$toolchainName\bin"
                $searchPaths += $toolchainBinDir
                Write-DebugLog -Message "Added toolchain bin path: $toolchainBinDir" -Category "CARGO" -Color "Magenta"
            }
        }
    }
    catch {
        Write-DebugLog -Message "Error building search paths: $($_.Exception.Message)" -Category "CARGO" -Color "Red"
        throw
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search in all cargo paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Crate already installed: $executable" -Category "CARGO" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "CARGO" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install crate
    Write-DebugLog -Message "Installing cargo crate: $PackageName" -Category "CARGO" -Color "Yellow"
    try {
        $installArgs = @("install", $PackageName)
        if ($ForceInstall) {
            $installArgs += "--force"
        }
        
        $Command = "cargo $($installArgs -join ' ')"
        Write-DebugLog -Message "Command: $Command" -Category "CARGO" -Color "Magenta"
        
        & cargo $installArgs
        
        # Refresh search paths after installation
        Write-DebugLog -Message "Refreshing search paths..." -Category "CARGO" -Color "Magenta"
        $searchPaths = @()
        try {
            $cargoBinDir = Join-Path $cargoHome "bin"
            $searchPaths += $cargoBinDir
            
            if (Test-Path $rustupHome) {
                $activeToolchain = & rustup show active-toolchain 2>$null
                if ($activeToolchain) {
                    $toolchainName = $activeToolchain.Split()[0]
                    $toolchainBinDir = Join-Path $rustupHome "toolchains\$toolchainName\bin"
                    $searchPaths += $toolchainBinDir
                }
            }
        }
        catch {
            Write-DebugLog -Message "Error in refresh search paths: $($_.Exception.Message)" -Category "CARGO" -Color "Red"
            throw
        }
        
        # Find the installed executable
        Write-DebugLog -Message "Searching for executable after installation..." -Category "CARGO" -Color "Magenta"
        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
        
        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "CARGO" -Color "Green"
            return $executable
        }
        
        Write-DebugLog -Message "Installation completed but executable not found" -Category "CARGO" -Color "Yellow"
        
        # Try uninstall and reinstall for error recovery
        if (-not $ForceInstall) {
            Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "CARGO" -Color "Yellow"
            & cargo uninstall $PackageName 2>$null
            Start-Sleep -Seconds 2
            & cargo install $PackageName --force
            $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
            return $executable
        }
        
        return $null
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "CARGO" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs Go packages using Go modules with binary scanning verification

.DESCRIPTION
    Go module installation method that leverages Go's module system for
    dependency management and binary installation. Go modules provide
    reproducible builds and dependency management.
    
    Design Problems Solved:
    - Go package dependency management
    - Binary compilation and installation
    - Environment variable setup for Go tools
    - Consistent verification across different installation methods
    
    Solution Approach:
    - Use Go modules for package installation
    - Compile and install binaries using go install
    - Scan Go's binary directories for verification
    - Return executable path for consistent environment variable setup

.PARAMETER PackageName
    The Go package name (e.g., "github.com/golangci/golangci-lint/cmd/golangci-lint")

.PARAMETER InstallDir
    NOTE: Go manages its own installation strategy.
    This parameter is kept for API consistency but will be ignored.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "golangci-lint")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Uses Go modules for dependency management
    - Compiles binaries from source
    - Provides reproducible builds
    - Returns executable path for environment variable setup
#>
function Invoke-GoCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for go (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )
    
    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")
    
    Write-DebugLog -Message "Processing go package: $PackageName" -Category "GO" -Color "Cyan"
    
    # Check if go is available
    $goExe = Get-Command "go" -ErrorAction SilentlyContinue
    if (-not $goExe) {
        Write-DebugLog -Message "Go not found in PATH" -Category "GO" -Color "Red"
        return $null
    }
    
    # Get go installation paths
    try {
        $goPath = $env:GOPATH
        if (-not $goPath) {
            # Use default GOPATH if not set
            $goPath = & go env GOPATH 2>$null
            if (-not $goPath) {
                $goPath = Join-Path $env:USERPROFILE "go"
            }
        }
        Write-DebugLog -Message "Go path: $goPath" -Category "GO" -Color "Cyan"
        
        $goRoot = $env:GOROOT
        if (-not $goRoot) {
            $goRoot = & go env GOROOT 2>$null
        }
        Write-DebugLog -Message "Go root: $goRoot" -Category "GO" -Color "Cyan"
    }
    catch {
        Write-DebugLog -Message "Failed to determine go paths: $($_.Exception.Message)" -Category "GO" -Color "Red"
        return $null
    }
    
    # Build search paths for go binaries
    $searchPaths = @()
    try {
        # GOPATH bin directory (primary location for installed binaries)
        if ($goPath) {
            $goPathBinDir = Join-Path $goPath "bin"
            $searchPaths += $goPathBinDir
            Write-DebugLog -Message "Added go path bin directory: $goPathBinDir" -Category "GO" -Color "Magenta"
        }
        
        # GOROOT bin directory
        if ($goRoot) {
            $goRootBinDir = Join-Path $goRoot "bin"
            $searchPaths += $goRootBinDir
            Write-DebugLog -Message "Added go root bin directory: $goRootBinDir" -Category "GO" -Color "Magenta"
        }
        
        # Default go bin path from environment
        $goBin = & go env GOBIN 2>$null
        if ($goBin) {
            $searchPaths += $goBin
            Write-DebugLog -Message "Added go bin directory: $goBin" -Category "GO" -Color "Magenta"
        }
    }
    catch {
        Write-DebugLog -Message "Error building search paths: $($_.Exception.Message)" -Category "GO" -Color "Red"
        throw
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        # Extract binary name from package path
        $binaryName = $PackageName.Split("/")[-1]
        $searchKeywords = @($binaryName)
    }
    
    # Check if already installed - search in all go paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "GO" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "GO" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install package
    Write-DebugLog -Message "Installing go package: $PackageName" -Category "GO" -Color "Yellow"
    try {
        # Use go install for Go 1.16+ or go get for older versions
        $goVersion = & go version 2>$null
        $useGoInstall = $true
        
        if ($goVersion -match "go(\d+)\.(\d+)") {
            $majorVersion = [int]$matches[1]
            $minorVersion = [int]$matches[2]
            if ($majorVersion -eq 1 -and $minorVersion -lt 16) {
                $useGoInstall = $false
            }
        }
        
        if ($useGoInstall) {
            $installArgs = @("install", "$PackageName@latest")
            $Command = "go $($installArgs -join ' ')"
        }
        else {
            $installArgs = @("get", "-u", $PackageName)
            $Command = "go $($installArgs -join ' ')"
        }
        
        Write-DebugLog -Message "Command: $Command" -Category "GO" -Color "Magenta"
        
        & go $installArgs
        
        # Refresh search paths after installation
        Write-DebugLog -Message "Refreshing search paths..." -Category "GO" -Color "Magenta"
        $searchPaths = @()
        try {
            if ($goPath) {
                $goPathBinDir = Join-Path $goPath "bin"
                $searchPaths += $goPathBinDir
            }
            if ($goRoot) {
                $goRootBinDir = Join-Path $goRoot "bin"
                $searchPaths += $goRootBinDir
            }
            $goBin = & go env GOBIN 2>$null
            if ($goBin) {
                $searchPaths += $goBin
            }
        }
        catch {
            Write-DebugLog -Message "Error in refresh search paths: $($_.Exception.Message)" -Category "GO" -Color "Red"
            throw
        }
        
        # Find the installed executable
        Write-DebugLog -Message "Searching for executable after installation..." -Category "GO" -Color "Magenta"
        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
        
        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "GO" -Color "Green"
            return $executable
        }
        
        Write-DebugLog -Message "Installation completed but executable not found" -Category "GO" -Color "Yellow"
        
        # For go, there's no uninstall command, so we try clean and reinstall
        if (-not $ForceInstall) {
            Write-DebugLog -Message "Attempting clean and reinstall..." -Category "GO" -Color "Yellow"
            & go clean -modcache 2>$null
            Start-Sleep -Seconds 2
            
            if ($useGoInstall) {
                & go install "$PackageName@latest"
            }
            else {
                & go get -u $PackageName
            }
            
            $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
            return $executable
        }
        
        return $null
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "GO" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs Ruby gems using RubyGems with binary scanning verification

.DESCRIPTION
    RubyGems installation method for Ruby gems with binary scanning verification.
    RubyGems is Ruby's package manager, providing gem installation and
    dependency management.
    
    Design Problems Solved:
    - Ruby gem installation and dependency management
    - Binary gem installation and verification
    - Environment variable setup for Ruby tools
    - Consistent verification across different installation methods
    
    Solution Approach:
    - Use RubyGems for gem installation
    - Scan gem binary directories for verification
    - Return executable path for consistent environment variable setup
    - Support both local and global installations

.PARAMETER PackageName
    The Ruby gem name (e.g., "bundler", "jekyll")

.PARAMETER InstallDir
    NOTE: RubyGems manages its own installation strategy.
    This parameter is kept for API consistency but will be ignored.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "bundle", "jekyll")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Ruby's official package manager
    - Installs gems with dependencies
    - Provides binary gems for tools
    - Returns executable path for environment variable setup
#>
function Invoke-GemCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for gem (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )
    
    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1", ".rb")
    
    Write-DebugLog -Message "Processing ruby gem: $PackageName" -Category "GEM" -Color "Cyan"
    
    # Check if gem is available
    $gemExe = Get-Command "gem" -ErrorAction SilentlyContinue
    if (-not $gemExe) {
        Write-DebugLog -Message "RubyGems not found in PATH" -Category "GEM" -Color "Red"
        return $null
    }
    
    # Get ruby and gem installation paths
    try {
        # Get gem environment information
        $gemEnv = & gem environment 2>$null
        $rubyGemsDir = $null
        $userGemsDir = $null
        
        if ($gemEnv) {
            foreach ($line in $gemEnv) {
                if ($line -match "INSTALLATION DIRECTORY: (.+)") {
                    $rubyGemsDir = $matches[1].Trim()
                }
                elseif ($line -match "USER INSTALLATION DIRECTORY: (.+)") {
                    $userGemsDir = $matches[1].Trim()
                }
            }
        }
        
        Write-DebugLog -Message "Ruby gems directory: $rubyGemsDir" -Category "GEM" -Color "Cyan"
        Write-DebugLog -Message "User gems directory: $userGemsDir" -Category "GEM" -Color "Cyan"
    }
    catch {
        Write-DebugLog -Message "Failed to get gem environment: $($_.Exception.Message)" -Category "GEM" -Color "Red"
        return $null
    }
    
    # Build search paths for gem binaries
    $searchPaths = @()
    try {
        # System gem bin directory
        if ($rubyGemsDir) {
            $systemGemBinDir = Join-Path $rubyGemsDir "bin"
            $searchPaths += $systemGemBinDir
            Write-DebugLog -Message "Added system gem bin path: $systemGemBinDir" -Category "GEM" -Color "Magenta"
        }
        
        # User gem bin directory
        if ($userGemsDir) {
            $userGemBinDir = Join-Path $userGemsDir "bin"
            $searchPaths += $userGemBinDir
            Write-DebugLog -Message "Added user gem bin path: $userGemBinDir" -Category "GEM" -Color "Magenta"
        }
        
        # Ruby bin directory (where ruby.exe typically resides)
        $rubyExePath = Get-Command "ruby" -ErrorAction SilentlyContinue
        if ($rubyExePath) {
            $rubyBinDir = Split-Path $rubyExePath.Source -Parent
            $searchPaths += $rubyBinDir
            Write-DebugLog -Message "Added ruby bin path: $rubyBinDir" -Category "GEM" -Color "Magenta"
        }
        
        # Common Windows Ruby installation paths
        $commonRubyPaths = @(
            "C:\Ruby*\bin",
            "$env:ProgramFiles\Ruby*\bin",
            "${env:ProgramFiles(x86)}\Ruby*\bin"
        )
        
        foreach ($pattern in $commonRubyPaths) {
            $paths = Get-ChildItem -Path $pattern -ErrorAction SilentlyContinue
            foreach ($path in $paths) {
                if (Test-Path $path.FullName) {
                    $searchPaths += $path.FullName
                    Write-DebugLog -Message "Added common ruby path: $($path.FullName)" -Category "GEM" -Color "Magenta"
                }
            }
        }
    }
    catch {
        Write-DebugLog -Message "Error building search paths: $($_.Exception.Message)" -Category "GEM" -Color "Red"
        throw
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search in all gem paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Gem already installed: $executable" -Category "GEM" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "GEM" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install gem
    Write-DebugLog -Message "Installing ruby gem: $PackageName" -Category "GEM" -Color "Yellow"
    try {
        $installArgs = @("install", $PackageName)
        if ($ForceInstall) {
            $installArgs += "--force"
        }
        # Install to user directory to avoid permission issues
        $installArgs += "--user-install"
        
        $Command = "gem $($installArgs -join ' ')"
        Write-DebugLog -Message "Command: $Command" -Category "GEM" -Color "Magenta"
        
        & gem $installArgs
        
        # Refresh search paths after installation
        Write-DebugLog -Message "Refreshing search paths..." -Category "GEM" -Color "Magenta"
        $searchPaths = @()
        try {
            # Re-get gem environment after installation
            $gemEnv = & gem environment 2>$null
            if ($gemEnv) {
                foreach ($line in $gemEnv) {
                    if ($line -match "INSTALLATION DIRECTORY: (.+)") {
                        $rubyGemsDir = $matches[1].Trim()
                        $systemGemBinDir = Join-Path $rubyGemsDir "bin"
                        $searchPaths += $systemGemBinDir
                    }
                    elseif ($line -match "USER INSTALLATION DIRECTORY: (.+)") {
                        $userGemsDir = $matches[1].Trim()
                        $userGemBinDir = Join-Path $userGemsDir "bin"
                        $searchPaths += $userGemBinDir
                    }
                }
            }
            
            if ($rubyExePath) {
                $rubyBinDir = Split-Path $rubyExePath.Source -Parent
                $searchPaths += $rubyBinDir
            }
        }
        catch {
            Write-DebugLog -Message "Error in refresh search paths: $($_.Exception.Message)" -Category "GEM" -Color "Red"
            throw
        }
        
        # Find the installed executable
        Write-DebugLog -Message "Searching for executable after installation..." -Category "GEM" -Color "Magenta"
        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
        
        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "GEM" -Color "Green"
            return $executable
        }
        
        Write-DebugLog -Message "Installation completed but executable not found" -Category "GEM" -Color "Yellow"
        
        # Try uninstall and reinstall for error recovery
        if (-not $ForceInstall) {
            Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "GEM" -Color "Yellow"
            & gem uninstall $PackageName --user-install 2>$null
            Start-Sleep -Seconds 2
            & gem install $PackageName --user-install --force
            $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
            return $executable
        }
        
        return $null
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "GEM" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs packages using Homebrew with binary scanning verification

.DESCRIPTION
    Homebrew installation method for packages with binary scanning verification.
    Homebrew is primarily a macOS package manager but can be used on Windows
    through WSL or other compatibility layers.
    
    Design Problems Solved:
    - Cross-platform package management
    - Binary installation and verification
    - Environment variable setup for Homebrew tools
    - Consistent verification across different installation methods
    
    Solution Approach:
    - Use Homebrew for package installation (if available on Windows)
    - Scan Homebrew's binary directories for verification
    - Return executable path for consistent environment variable setup
    - Support cross-platform compatibility

.PARAMETER PackageName
    The Homebrew package name (e.g., "git", "node")

.PARAMETER InstallDir
    NOTE: Homebrew manages its own installation strategy.
    This parameter is kept for API consistency but will be ignored.

.PARAMETER Keyword
    Primary executable name for detection (e.g., "git", "node")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or $null if not found

.NOTES
    - Primarily for macOS but available on Windows through WSL
    - Cross-platform package management
    - Binary installation and verification
    - Returns executable path for environment variable setup
#>
function Invoke-BrewCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for brew (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )
    
    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")
    
    Write-DebugLog -Message "Processing homebrew package: $PackageName" -Category "BREW" -Color "Cyan"
    
    # Check if brew is available (typically through WSL or Linux subsystem on Windows)
    $brewExe = Get-Command "brew" -ErrorAction SilentlyContinue
    if (-not $brewExe) {
        Write-DebugLog -Message "Homebrew not found in PATH (not available on Windows by default)" -Category "BREW" -Color "Red"
        return $null
    }
    
    # Get homebrew installation paths
    try {
        # Get homebrew prefix (installation directory)
        $brewPrefix = & brew --prefix 2>$null
        if (-not $brewPrefix) {
            Write-DebugLog -Message "Failed to get brew prefix" -Category "BREW" -Color "Red"
            return $null
        }
        Write-DebugLog -Message "Homebrew prefix: $brewPrefix" -Category "BREW" -Color "Cyan"
        
        # Get homebrew cellar (package installation directory)
        $brewCellar = & brew --cellar 2>$null
        if (-not $brewCellar) {
            $brewCellar = Join-Path $brewPrefix "Cellar"
        }
        Write-DebugLog -Message "Homebrew cellar: $brewCellar" -Category "BREW" -Color "Cyan"
    }
    catch {
        Write-DebugLog -Message "Failed to get homebrew paths: $($_.Exception.Message)" -Category "BREW" -Color "Red"
        return $null
    }
    
    # Build search paths for homebrew binaries
    $searchPaths = @()
    try {
        # Homebrew bin directory (primary location for binaries)
        $brewBinDir = Join-Path $brewPrefix "bin"
        $searchPaths += $brewBinDir
        Write-DebugLog -Message "Added homebrew bin path: $brewBinDir" -Category "BREW" -Color "Magenta"
        
        # Homebrew sbin directory
        $brewSbinDir = Join-Path $brewPrefix "sbin"
        $searchPaths += $brewSbinDir
        Write-DebugLog -Message "Added homebrew sbin path: $brewSbinDir" -Category "BREW" -Color "Magenta"
        
        # Package-specific cellar directory
        $packageCellarDir = Join-Path $brewCellar $PackageName
        if (Test-Path $packageCellarDir) {
            # Get the latest version directory
            $versionDirs = Get-ChildItem -Path $packageCellarDir -Directory | Sort-Object Name -Descending
            if ($versionDirs) {
                $latestVersionDir = $versionDirs[0].FullName
                $packageBinDir = Join-Path $latestVersionDir "bin"
                $searchPaths += $packageBinDir
                Write-DebugLog -Message "Added package-specific bin path: $packageBinDir" -Category "BREW" -Color "Magenta"
            }
        }
        
        # Homebrew opt directory (symlinked current versions)
        $brewOptDir = Join-Path $brewPrefix "opt\$PackageName\bin"
        $searchPaths += $brewOptDir
        Write-DebugLog -Message "Added homebrew opt bin path: $brewOptDir" -Category "BREW" -Color "Magenta"
    }
    catch {
        Write-DebugLog -Message "Error building search paths: $($_.Exception.Message)" -Category "BREW" -Color "Red"
        throw
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search in all homebrew paths at once
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "Package already installed: $executable" -Category "BREW" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "BREW" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install package
    Write-DebugLog -Message "Installing homebrew package: $PackageName" -Category "BREW" -Color "Yellow"
    try {
        $installArgs = @("install", $PackageName)
        if ($ForceInstall) {
            $installArgs += "--force"
        }
        
        $Command = "brew $($installArgs -join ' ')"
        Write-DebugLog -Message "Command: $Command" -Category "BREW" -Color "Magenta"
        
        & brew $installArgs
        
        # Refresh search paths after installation
        Write-DebugLog -Message "Refreshing search paths..." -Category "BREW" -Color "Magenta"
        $searchPaths = @()
        try {
            $brewBinDir = Join-Path $brewPrefix "bin"
            $searchPaths += $brewBinDir
            $brewSbinDir = Join-Path $brewPrefix "sbin"
            $searchPaths += $brewSbinDir
            
            $packageCellarDir = Join-Path $brewCellar $PackageName
            if (Test-Path $packageCellarDir) {
                $versionDirs = Get-ChildItem -Path $packageCellarDir -Directory | Sort-Object Name -Descending
                if ($versionDirs) {
                    $latestVersionDir = $versionDirs[0].FullName
                    $packageBinDir = Join-Path $latestVersionDir "bin"
                    $searchPaths += $packageBinDir
                }
            }
            
            $brewOptDir = Join-Path $brewPrefix "opt\$PackageName\bin"
            $searchPaths += $brewOptDir
        }
        catch {
            Write-DebugLog -Message "Error in refresh search paths: $($_.Exception.Message)" -Category "BREW" -Color "Red"
            throw
        }
        
        # Find the installed executable
        Write-DebugLog -Message "Searching for executable after installation..." -Category "BREW" -Color "Magenta"
        $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
        
        if ($executable) {
            Write-DebugLog -Message "Found executable: $executable" -Category "BREW" -Color "Green"
            return $executable
        }
        
        Write-DebugLog -Message "Installation completed but executable not found" -Category "BREW" -Color "Yellow"
        
        # Try uninstall and reinstall for error recovery
        if (-not $ForceInstall) {
            Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "BREW" -Color "Yellow"
            & brew uninstall $PackageName 2>$null
            Start-Sleep -Seconds 2
            & brew install $PackageName --force
            $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
            return $executable
        }
        
        return $null
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "BREW" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Downloads and installs packages from web URLs with binary scanning verification

.DESCRIPTION
    Web download installation method for packages with binary scanning verification.
    Downloads executable files directly from URLs and places them in specified directories.
    
    Design Problems Solved:
    - Direct web download of executables
    - Binary installation and verification
    - Environment variable setup for downloaded tools
    - Consistent verification across different installation methods
    
    Solution Approach:
    - Use Invoke-WebRequest for reliable downloads
    - Download to specified installation directory
    - Scan for binary presence for verification
    - Return executable path for consistent environment variable setup
    - Support custom installation directories

.PARAMETER PackageName
    The package name for identification (e.g., "acli", "terraform")

.PARAMETER InstallDir
    The installation directory where the executable should be placed

.PARAMETER DownloadUrl
    The URL to download the executable from

.PARAMETER ExecutableName
    The name of the executable file to download (e.g., "acli.exe", "terraform.exe")

.PARAMETER Keyword
    Primary executable name for detection (e.g., "acli", "terraform")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if package is installed

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns the full path to the main executable, or null if not found

.NOTES
    - Direct web download installation
    - Binary installation and verification
    - Returns executable path for environment variable setup
    - Supports custom installation directories
#>
function Invoke-WebDownloadCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [Parameter(Mandatory = $true)]
        [string]$InstallDir,
        [Parameter(Mandatory = $true)]
        [string]$DownloadUrl,
        [Parameter(Mandatory = $true)]
        [string]$ExecutableName,
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true,
        [bool]$IsArchive = $false,
        [string]$ArchiveType = "zip"
    )
    
    Write-Host "       [WEB] Processing $PackageName" -ForegroundColor Cyan
    
    # Ensure installation directory exists
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
        Write-Host "       [WEB] Created installation directory: $InstallDir" -ForegroundColor Green
    }
    
    # Set executable path
    $executablePath = Join-Path $InstallDir $ExecutableName
    
    # Check if already installed
    if (Test-Path $executablePath) {
        Write-Host "       [WEB] $PackageName executable found at: $executablePath" -ForegroundColor Green
        
        if ($OnlyCheckFlag) {
            return $executablePath
        }
        
        if (-not $ForceInstall) {
            Write-Host "       [WEB] $PackageName already installed, skipping download" -ForegroundColor Yellow
            return $executablePath
        }
        
        Write-Host "       [WEB] Force install requested, will re-download $PackageName" -ForegroundColor Yellow
    }
    
    # Download the file
    try {
        Write-Host "       [WEB] Downloading $PackageName from: $DownloadUrl" -ForegroundColor Cyan
        
        # Determine file type from URL or IsArchive parameter
        $downloadedFile = ""
        $fileExtension = ""
        
        # Auto-detect file type from URL if not specified
        if (-not $IsArchive) {
            $urlExtension = [System.IO.Path]::GetExtension($DownloadUrl).ToLower()
            if ($urlExtension -in @(".zip", ".7z", ".tar.gz", ".tar", ".gz")) {
                $IsArchive = $true
                $ArchiveType = $urlExtension.TrimStart('.')
                Write-Host "       [WEB] Auto-detected archive type from URL: $ArchiveType" -ForegroundColor Yellow
            }
        }
        
        if ($IsArchive) {
            # For archives, download to a temporary file first
            $tempFile = Join-Path $env:TEMP "$PackageName.$ArchiveType"
            Write-Host "       [WEB] Downloading archive to: $tempFile" -ForegroundColor Cyan
            
            Invoke-WebRequest -Uri $DownloadUrl -OutFile $tempFile -UseBasicParsing -ErrorAction Stop
            $downloadedFile = $tempFile
            $fileExtension = $ArchiveType
        } else {
            # For direct executables, download directly to target
            Write-Host "       [WEB] Downloading executable to: $executablePath" -ForegroundColor Cyan
            Invoke-WebRequest -Uri $DownloadUrl -OutFile $executablePath -UseBasicParsing -ErrorAction Stop
            $downloadedFile = $executablePath
            $fileExtension = "exe"
        }
        
        Write-Host "       [WEB] Successfully downloaded $PackageName" -ForegroundColor Green
        
        # Process the downloaded file based on type
        if ($IsArchive) {
            Write-Host "       [WEB] Processing archive file: $downloadedFile" -ForegroundColor Cyan
            
            # Extract archive to installation directory
            switch ($fileExtension.ToLower()) {
                "zip" {
                    Expand-Archive -Path $downloadedFile -DestinationPath $InstallDir -Force
                    Write-Host "       [WEB] Extracted ZIP archive to: $InstallDir" -ForegroundColor Green
                }
                "7z" {
                    # Use 7-Zip if available
                    $sevenZip = Get-Command "7z.exe" -ErrorAction SilentlyContinue
                    if ($sevenZip) {
                        & $sevenZip x $downloadedFile "-o$InstallDir" -y
                        Write-Host "       [WEB] Extracted 7Z archive to: $InstallDir" -ForegroundColor Green
                    } else {
                        Write-Host "       [WEB] Error: 7-Zip not found for extracting 7Z archive" -ForegroundColor Red
                        return $null
                    }
                }
                "tar.gz" {
                    # Use tar if available (Windows 10+ has built-in tar)
                    $tar = Get-Command "tar.exe" -ErrorAction SilentlyContinue
                    if ($tar) {
                        & $tar -xzf $downloadedFile -C $InstallDir
                        Write-Host "       [WEB] Extracted TAR.GZ archive to: $InstallDir" -ForegroundColor Green
                    } else {
                        Write-Host "       [WEB] Error: tar not found for extracting TAR.GZ archive" -ForegroundColor Red
                        return $null
                    }
                }
                default {
                    Write-Host "       [WEB] Error: Unsupported archive type: $fileExtension" -ForegroundColor Red
                    return $null
                }
            }
            
            # Clean up temporary file
            if (Test-Path $downloadedFile) {
                Remove-Item $downloadedFile -Force
                Write-Host "       [WEB] Cleaned up temporary file: $downloadedFile" -ForegroundColor Gray
            }
            
            # Find the executable in the extracted files
            $foundExecutable = Find-ExecutableByKeyword -Keywords $ExecutableName -AdditionalScanPaths $InstallDir -Recursive $true -AdditionalKeywords $AdditionalKeywords
            if ($foundExecutable) {
                Write-Host "       [WEB] Found executable after extraction: $foundExecutable" -ForegroundColor Green
                return $foundExecutable
            } else {
                Write-Host "       [WEB] Error: Executable $ExecutableName not found after archive extraction" -ForegroundColor Red
                return $null
            }
        } else {
            # For direct executables, verify the download
            if (Test-Path $executablePath) {
                Write-Host "       [WEB] $PackageName installation verified at: $executablePath" -ForegroundColor Green
                return $executablePath
            } else {
                Write-Host "       [WEB] Error: $PackageName executable not found after download" -ForegroundColor Red
                return $null
            }
        }
    }
    catch {
        $errorMsg = $_.Exception.Message
        Write-Host "       [WEB] Error downloading $PackageName - $errorMsg" -ForegroundColor Red
        return $null
    }
}

<#
.SYNOPSIS
    Installs PowerShell modules using Install-Module cmdlet

.DESCRIPTION
    This function handles PowerShell module installation using the built-in Install-Module cmdlet.
    It supports checking for existing installations and force installation.

.PARAMETER PackageName
    Name of the PowerShell module to install

.PARAMETER InstallDir
    Ignored for PowerShell modules (API consistency)

.PARAMETER Keyword
    Keyword for executable search (usually the module name)

.PARAMETER AdditionalKeywords
    Additional keywords for search

.PARAMETER OnlyCheckFlag
    If true, only checks if module is installed without installing

.PARAMETER ForceInstall
    If true, forces installation even if module appears to be installed

.RETURNS
    Returns the module name if successfully installed/verified, or $null if not found/installed

.EXAMPLE
    $moduleName = Invoke-PowerShellCommand -PackageName "PSScriptAnalyzer" -Keyword "Invoke-ScriptAnalyzer"

.NOTES
    - Uses Install-Module cmdlet for installation
    - Supports both user and system-wide installation
    - Returns module name for environment variable configuration
    - Recommended for PowerShell modules and cmdlets
#>
function Invoke-PowerShellCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for PowerShell modules (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true,
        [string]$PowerShellCommand = ""
    )
    
    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1", ".psm1", ".psd1")
    
    Write-DebugLog -Message "Processing PowerShell package: $PackageName" -Category "POWERSHELL" -Color "Cyan"
    
    # Build search paths for PowerShell packages
    $searchPaths = @()
    $systemPaths = @(
        ${env:LOCALAPPDATA},
        ${env:APPDATA},
        "C:\Program Files",
        "C:\Program Files (x86)",
        $env:USERPROFILE,
        "$env:USERPROFILE\bin"
    )
    $searchPaths += $systemPaths

    $psModulePaths = $env:PSModulePath -split ';'
    foreach ($path in $psModulePaths) {
        if (-not [string]::IsNullOrWhiteSpace($path) -and (Test-Path $path)) {
            $searchPaths += $path
            Write-DebugLog -Message "Added PowerShell module path: $path" -Category "POWERSHELL" -Color "Magenta"
        }
    }
    
    $userModulePath = Join-Path $env:USERPROFILE "Documents\WindowsPowerShell\Modules"
    if (Test-Path $userModulePath) {
        $searchPaths += $userModulePath
        Write-DebugLog -Message "Added user PowerShell module path: $userModulePath" -Category "POWERSHELL" -Color "Magenta"
    }
    
    # Build search keywords
    $searchKeywords = @($Keyword)
    if ($AdditionalKeywords) {
        $searchKeywords += $AdditionalKeywords
    }
    if (-not $searchKeywords -or $searchKeywords -eq "") {
        $searchKeywords = @($PackageName)
    }
    
    # Check if already installed - search for executable files
    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
    
    if ($executable -and -not $ForceInstall) {
        Write-DebugLog -Message "PowerShell package already installed: $executable" -Category "POWERSHELL" -Color "Green"
        Write-DebugLog -Message "Skipping installation (ForceInstall = $ForceInstall)" -Category "POWERSHELL" -Color "Cyan"
        return $executable
    }
    
    if ($OnlyCheckFlag) {
        return $executable
    }
    
    # Install the package
    Write-DebugLog -Message "Installing PowerShell package: $PackageName" -Category "POWERSHELL" -Color "Yellow"
    if (-not [string]::IsNullOrWhiteSpace($PowerShellCommand)) {
        Write-Host "       [POWERSHELL] Executing PowerShell command: $PowerShellCommand" -ForegroundColor Cyan
        Invoke-Expression $PowerShellCommand -ErrorAction SilentlyContinue
        if (-not $?) {
            $errMsg = if ($Error.Count -gt 0) { $Error[0].Exception.Message } else { "unknown" }
            Write-DebugLog -Message "Install script reported: $errMsg" -Category "POWERSHELL" -Color "Red"
            if ($PackageName -eq "CursorAgent" -and $errMsg -match "denied|Access to the path") {
                Write-Host "       [POWERSHELL] Close Cursor/agent then run as Administrator: irm 'https://cursor.com/install?win32=true' | iex" -ForegroundColor Yellow
            }
        }
    } else {
        Write-Host "       [POWERSHELL] No PowerShellCommand specified, attempting module installation" -ForegroundColor Yellow
        if ($ForceInstall) {
            Install-Module -Name $PackageName -Force -AllowClobber -Scope CurrentUser -ErrorAction SilentlyContinue
        } else {
            Install-Module -Name $PackageName -AllowClobber -Scope CurrentUser -ErrorAction SilentlyContinue
        }
        if ($?) {
            Write-DebugLog -Message "Module installation successful" -Category "POWERSHELL" -Color "Green"
        } else {
            Write-DebugLog -Message "Module installation failed" -Category "POWERSHELL" -Color "Red"
            return $null
        }
    }
    
    # Refresh search paths after installation
    Write-DebugLog -Message "Refreshing search paths..." -Category "POWERSHELL" -Color "Magenta"
    $searchPaths = @()
    $systemPaths = @(
        ${env:LOCALAPPDATA},
        ${env:APPDATA},
        "C:\Program Files",
        "C:\Program Files (x86)",
        $env:USERPROFILE,
        "$env:USERPROFILE\bin"
    )
    $searchPaths += $systemPaths
    
    $psModulePaths = $env:PSModulePath -split ';'
    foreach ($path in $psModulePaths) {
        if (-not [string]::IsNullOrWhiteSpace($path) -and (Test-Path $path)) {
            $searchPaths += $path
        }
    }
    $userModulePath = Join-Path $env:USERPROFILE "Documents\WindowsPowerShell\Modules"
    if (Test-Path $userModulePath) {
        $searchPaths += $userModulePath
    }
    
    # Search for installed executable
    $installedExecutable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
    
    if ($installedExecutable) {
        Write-DebugLog -Message "PowerShell package installation verified: $installedExecutable" -Category "POWERSHELL" -Color "Green"
        return $installedExecutable
    }
    Write-DebugLog -Message "PowerShell package installation verification failed" -Category "POWERSHELL" -Color "Yellow"
    return $null
}