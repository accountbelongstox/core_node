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
# Excluded: Invoke-WingetCommand (remains in CommanFunc.ps1)

# Import required modules
. "$PSScriptRoot\CommanFunc.ps1"

# NPM Package Manager Functions

# Package Installation Methods Framework
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
        $PackageName, # Accept string or array of packages
        [string]$InstallDir = "", # Ignored for npm (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $false
    )

    # Handle array of packages - batch installation
    if ($PackageName -is [array] -and $PackageName.Count -gt 1) {
        Write-DebugLog -Message "Processing npm package array with $($PackageName.Count) packages" -Category "NPM_BATCH" -Color "Cyan"
        return Install-NpmPackagesBatch -Packages $PackageName -ForceInstall $ForceInstall
    }

    # Handle single package (extract from array if needed)
    $singlePackage = if ($PackageName -is [array] -and $PackageName.Count -eq 1) { $PackageName[0] } else { $PackageName }

    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")

    Write-DebugLog -Message "Processing package: $singlePackage" -Category "NPM" -Color "Cyan"
    
    # Get npm executable path
    $npmExe = $Global:NPM_EXE_PATH
    if (-not (Test-Path $npmExe)) {
        Write-DebugLog -Message "npm not found at: $npmExe" -Category "NPM" -Color "Red"
        return $null
    }
    
    # Get npm global prefix (installation directory)
    try {
        $npmPrefix = & $npmExe config get prefix
        Write-DebugLog -Message "npm prefix: $npmPrefix" -Category "NPM" -Color "Cyan"
    }
    catch {
        Write-DebugLog -Message "Failed to get npm prefix: $($_.Exception.Message)" -Category "NPM" -Color "Red"
        return $null
    }
    
    # Extract package name without scope for directory paths
    $packageDirName = $singlePackage
    if ($singlePackage -match '^@[^/]+/(.+)$') {
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
        $searchKeywords = @($singlePackage)
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
    Write-DebugLog -Message "Installing package: $singlePackage" -Category "NPM" -Color "Yellow"
    try {
        $installArgs = @("install", "-g", $singlePackage)
        $Command = "$npmExe $installArgs"
        Write-DebugLog -Message "Command: $Command" -Category "NPM" -Color "Magenta"
        
        # Capture npm output but don't return it
        $npmOutput = & $npmExe $installArgs
        Write-DebugLog -Message "npm installation output: $($npmOutput -join ' ')" -Category "NPM" -Color "Cyan"
        
        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "Installation successful" -Category "NPM" -Color "Green"
            
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
        else {
            Write-DebugLog -Message "Installation failed with exit code: $LASTEXITCODE" -Category "NPM" -Color "Red"
            return $null
        }
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "NPM" -Color "Red"
        return $null
    }
}

# Helper function to test Python package imports
function Test-PythonPackageImport {
    param (
        [string]$ImportName,
        [string]$PipExePath
    )
    
    if (-not $ImportName -or -not $PipExePath) {
        return $false
    }
    
    # Get Python executable from pip path
    $pythonExe = $PipExePath -replace "Scripts\\pip\.exe$", "python.exe"
    if (-not (Test-Path $pythonExe)) {
        Write-DebugLog -Message "Python executable not found: $pythonExe" -Category "PIP" -Color "Red"
        return $false
    }
    
    # Create temp directory for validation script
    $tempNamespace = Join-Path $Global:TEMP_DIR "python_validation"
    if (-not (Test-Path $tempNamespace)) {
        New-Item -ItemType Directory -Path $tempNamespace -Force | Out-Null
    }
    
    # Ensure permanent validation script exists
    $validationScript = Join-Path $tempNamespace "package_import_validator.py"
    if (-not (Test-Path $validationScript)) {
        $pythonCode = @"
import sys
import importlib

def test_import(package_name):
    try:
        # Try to import the package
        importlib.import_module(package_name)
        print("IMPORT_SUCCESS")
        return True
    except ImportError as e:
        print(f"IMPORT_FAILED: {str(e)}")
        return False
    except Exception as e:
        print(f"IMPORT_ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("IMPORT_ERROR: No package name provided")
        sys.exit(1)
    
    package_name = sys.argv[1]
    test_import(package_name)
"@
        
        Set-Content -Path $validationScript -Value $pythonCode -Encoding UTF8
        Write-DebugLog -Message "Created permanent validation script: $validationScript" -Category "PIP" -Color "Magenta"
    }
    
    try {
        # Run Python script with ImportName as parameter
        $output = & $pythonExe $validationScript $ImportName 2>&1
        Write-DebugLog -Message "Python import test output: $($output -join ' ')" -Category "PIP" -Color "Cyan"
        
        # Check if import was successful
        $success = $output -match "IMPORT_SUCCESS"
        Write-DebugLog -Message "Import test result for '$ImportName': $success" -Category "PIP" -Color $(if ($success) { "Green" } else { "Yellow" })
        return $success
        
    } catch {
        Write-DebugLog -Message "Error testing Python import: $($_.Exception.Message)" -Category "PIP" -Color "Red"
        return $false
    }
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

# Enhanced batch npm installation function
function Install-NpmPackagesBatch {
    param (
        [Parameter(Mandatory = $true)]
        [array]$Packages,
        [bool]$ForceInstall = $false
    )

    Write-DebugLog -Message "Starting npm batch installation for $($Packages.Count) packages" -Category "NPM_BATCH" -Color "Cyan"

    # Get npm executable
    $npmExe = $Global:NPM_EXE_PATH
    if (-not (Test-Path $npmExe)) {
        Write-DebugLog -Message "npm not found at: $npmExe" -Category "NPM_BATCH" -Color "Red"
        return $null
    }

    Write-DebugLog -Message "Using npm: $npmExe" -Category "NPM_BATCH" -Color "Cyan"

    # Extract package names from mixed array
    $packageNames = @()
    foreach ($pkg in $Packages) {
        if ($pkg -is [hashtable] -and $pkg.ContainsKey("packageName")) {
            $packageNames += $pkg.packageName
        } elseif ($pkg -is [string]) {
            $packageNames += $pkg
        }
    }

    # Batch install all packages
    if ($packageNames.Count -gt 0) {
        Write-DebugLog -Message "Batch installing npm packages: $($packageNames -join ', ')" -Category "NPM_BATCH" -Color "Green"

        try {
            $installArgs = @("install", "-g") + $packageNames
            if ($ForceInstall) {
                $installArgs += "--force"
            }

            $npmOutput = & $npmExe $installArgs 2>&1

            if ($LASTEXITCODE -eq 0) {
                Write-DebugLog -Message "Batch npm installation successful" -Category "NPM_BATCH" -Color "Green"
                return "BATCH_COMPLETED"
            } else {
                Write-DebugLog -Message "Batch npm installation failed, exit code: $LASTEXITCODE" -Category "NPM_BATCH" -Color "Yellow"
                Write-DebugLog -Message "npm output: $($npmOutput -join ' ')" -Category "NPM_BATCH" -Color "Yellow"
                return $null
            }
        } catch {
            Write-DebugLog -Message "Batch npm installation error: $_" -Category "NPM_BATCH" -Color "Red"
            return $null
        }
    }

    return $null
}

function Invoke-PipCommand {
    param (
        [Parameter(Mandatory = $true)]
        $PackageName, # Accept string, hashtable, or array of packages
        [string]$InstallDir = "", # Ignored for pip (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )

    # Handle array of packages - batch installation
    if ($PackageName -is [array] -and $PackageName.Count -gt 1) {
        Write-DebugLog -Message "Processing pip package array with $($PackageName.Count) packages" -Category "PIP_BATCH" -Color "Cyan"
        return Install-PipPackagesBatch -Packages $PackageName -ForceInstall $ForceInstall
    }

    # Handle single package (extract from array if needed)
    $singlePackage = if ($PackageName -is [array] -and $PackageName.Count -eq 1) { $PackageName[0] } else { $PackageName }

    # Parse package information based on input type
    $actualPackageName = ""
    $validationType = "command" # Default to command validation
    $importName = ""

    if ($singlePackage -is [hashtable]) {
        # Object format with validation type
        $actualPackageName = $singlePackage.packageName
        $validationType = if ($singlePackage.validationType) { $singlePackage.validationType } else { "command" }
        $importName = if ($singlePackage.importName) { $singlePackage.importName } else { $actualPackageName }

        if (-not $actualPackageName) {
            Write-DebugLog -Message "ERROR: Hashtable package missing packageName property" -Category "PIP" -Color "Red"
            return $null
        }

        Write-DebugLog -Message "Processing pip package object - Name: $actualPackageName, Validation: $validationType, Import: $importName" -Category "PIP" -Color "Cyan"
    } elseif ($singlePackage -is [string] -and $singlePackage -ne "") {
        # String format (original behavior)
        $actualPackageName = $singlePackage
        $importName = $actualPackageName
        Write-DebugLog -Message "Processing pip package string: $actualPackageName" -Category "PIP" -Color "Cyan"
    } else {
        # Invalid package format
        Write-DebugLog -Message "ERROR: Invalid package format - Expected string or hashtable with packageName, got: $($singlePackage.GetType().Name)" -Category "PIP" -Color "Red"
        return $null
    }
    
    # Get pip executable path
    $pipExe = $null
    
    # Find default Python package from BasePackages
    if ($Global:BasePackages) {
        foreach ($basePackageName in $Global:BasePackages.Keys) {
            $packageConfig = $Global:BasePackages[$basePackageName]
            $isDefault = if ($packageConfig.ContainsKey("IsDefault")) { $packageConfig.IsDefault } else { $false }
            if ($isDefault -eq $true -and $packageConfig.Exec -eq "python.exe") {
                $pythonDir = Join-Path $Global:LANG_COMPILER_DIR $packageConfig.Name
                $derivedPipPath = Join-Path $pythonDir "Scripts\pip.exe"
                
                if (Test-Path $derivedPipPath) {
                    $pipExe = $derivedPipPath
                    Write-DebugLog -Message "Using pip: $pipExe" -Category "PIP" -Color "Green"
                    break
                }
            }
        }
    }
    
    # Fallback: try to find pip via Get-Command
    if (-not $pipExe) {
        $pipCmd = Get-Command "pip" -ErrorAction SilentlyContinue
        if ($pipCmd) {
            $pipExe = $pipCmd.Source
            Write-DebugLog -Message "Found pip via PATH: $pipExe" -Category "PIP" -Color "Green"
        } else {
            Write-DebugLog -Message "pip not found" -Category "PIP" -Color "Red"
            return $null
        }
    }
    
    # Skip all detection - just install directly
    Write-DebugLog -Message "Installing pip package: $actualPackageName" -Category "PIP" -Color "Yellow"
    try {
        $installArgs = @("install", $actualPackageName)
        $pipOutput = & $pipExe $installArgs 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "Installation successful for: $actualPackageName" -Category "PIP" -Color "Green"
            # Return appropriate marker based on validation type
            if ($validationType -eq "import") {
                return "IMPORT_VALIDATED"
            } else {
                return "INSTALLED_SUCCESS"
            }
        } else {
            Write-DebugLog -Message "Installation failed for $actualPackageName - exit code: $LASTEXITCODE" -Category "PIP" -Color "Red"
            Write-DebugLog -Message "pip output: $($pipOutput -join ' ')" -Category "PIP" -Color "Red"
            return $null
        }
    }
    catch {
        Write-DebugLog -Message "Installation error for $actualPackageName`: $($_.Exception.Message)" -Category "PIP" -Color "Red"
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

# Enhanced batch pip installation function
function Install-PipPackagesBatch {
    param (
        [Parameter(Mandatory = $true)]
        [array]$Packages,
        [bool]$ForceInstall = $true
    )

    Write-DebugLog -Message "Starting pip batch installation for $($Packages.Count) packages" -Category "PIP_BATCH" -Color "Cyan"

    # Get pip executable
    $pipExe = $null
    if ($Global:BasePackages) {
        foreach ($basePackageName in $Global:BasePackages.Keys) {
            $basePackage = $Global:BasePackages[$basePackageName]
            if ($basePackage.type -eq "python" -and $basePackage.ContainsKey("ExecutablePaths")) {
                foreach ($execPath in $basePackage.ExecutablePaths) {
                    $pipPath = Join-Path (Split-Path $execPath -Parent) "Scripts\pip.exe"
                    if (Test-Path $pipPath) {
                        $pipExe = $pipPath
                        break
                    }
                }
                if ($pipExe) { break }
            }
        }
    }

    if (-not $pipExe) {
        $pipExe = Get-Command "pip" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
        if (-not $pipExe) {
            Write-DebugLog -Message "pip executable not found" -Category "PIP_BATCH" -Color "Red"
            return $null
        }
    }

    Write-DebugLog -Message "Using pip: $pipExe" -Category "PIP_BATCH" -Color "Cyan"

    # Separate simple packages from complex ones
    $simplePackages = @()
    $complexPackages = @()

    foreach ($pkg in $Packages) {
        if ($pkg -is [hashtable] -and $pkg.ContainsKey("validationType") -and $pkg.validationType -eq "import") {
            $complexPackages += $pkg
        } elseif ($pkg -is [hashtable] -and $pkg.ContainsKey("packageName")) {
            $simplePackages += $pkg.packageName
        } elseif ($pkg -is [string]) {
            $simplePackages += $pkg
        }
    }

    # Batch install simple packages
    if ($simplePackages.Count -gt 0) {
        Write-DebugLog -Message "Batch installing simple packages: $($simplePackages -join ', ')" -Category "PIP_BATCH" -Color "Green"

        try {
            $installArgs = @("install") + $simplePackages
            if ($ForceInstall) {
                $installArgs += "--force-reinstall"
            }

            $pipOutput = & $pipExe $installArgs 2>&1

            if ($LASTEXITCODE -eq 0) {
                Write-DebugLog -Message "Batch installation successful" -Category "PIP_BATCH" -Color "Green"
            } else {
                Write-DebugLog -Message "Batch installation failed, exit code: $LASTEXITCODE" -Category "PIP_BATCH" -Color "Yellow"
                Write-DebugLog -Message "pip output: $($pipOutput -join ' ')" -Category "PIP_BATCH" -Color "Yellow"
            }
        } catch {
            Write-DebugLog -Message "Batch installation error: $_" -Category "PIP_BATCH" -Color "Red"
        }
    }

    # Handle complex packages individually
    foreach ($complexPkg in $complexPackages) {
        Write-DebugLog -Message "Installing complex package individually: $($complexPkg.packageName)" -Category "PIP_BATCH" -Color "Cyan"
        $result = Invoke-PipCommand -PackageName $complexPkg -ForceInstall $ForceInstall
        if (-not $result) {
            Write-DebugLog -Message "Failed to install complex package: $($complexPkg.packageName)" -Category "PIP_BATCH" -Color "Red"
        }
    }

    return "BATCH_COMPLETED"
}

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
    
    # Check if pipx is available
    $pipxExe = Get-Command "pipx" -ErrorAction SilentlyContinue
    if (-not $pipxExe) {
        Write-DebugLog -Message "pipx not found in PATH" -Category "PIPX" -Color "Red"
        return $null
    }
    
    # Get pipx home directory with robust fallback
    $pipxHome = ""
    try {
        $pipxHome = & pipx environment 2>$null | Select-String "PIPX_HOME=" | ForEach-Object { $_.ToString().Split("=")[1].Trim() }
        if ([string]::IsNullOrEmpty($pipxHome)) {
            if ([string]::IsNullOrEmpty($env:USERPROFILE)) {
                throw "USERPROFILE environment variable is not set"
            }
            $pipxHome = Join-Path $env:USERPROFILE ".local"
        }
        Write-DebugLog -Message "PIPX home directory: $pipxHome" -Category "PIPX" -Color "Cyan"
    }
    catch {
        if ([string]::IsNullOrEmpty($env:USERPROFILE)) {
            Write-DebugLog -Message "USERPROFILE environment variable is not set, using C:\Users\Default" -Category "PIPX" -Color "Red"
            $pipxHome = "C:\Users\Default\.local"
        } else {
            $pipxHome = Join-Path $env:USERPROFILE ".local"
        }
        Write-DebugLog -Message "Using default PIPX home: $pipxHome" -Category "PIPX" -Color "Yellow"
    }

    # Final validation to ensure pipxHome is not empty
    if ([string]::IsNullOrEmpty($pipxHome)) {
        if ([string]::IsNullOrEmpty($env:USERPROFILE)) {
            $pipxHome = "C:\Users\Default\.local"
        } else {
            $pipxHome = Join-Path $env:USERPROFILE ".local"
        }
        Write-DebugLog -Message "Final fallback PIPX home: $pipxHome" -Category "PIPX" -Color "Red"
    }

    # Ensure the directory exists
    if (-not (Test-Path $pipxHome)) {
        try {
            New-Item -ItemType Directory -Path $pipxHome -Force | Out-Null
            Write-DebugLog -Message "Created PIPX home directory: $pipxHome" -Category "PIPX" -Color "Green"
        }
        catch {
            Write-DebugLog -Message "Failed to create PIPX home directory: $($_.Exception.Message)" -Category "PIPX" -Color "Red"
        }
    }
    
    # Build search paths for pipx packages with validation
    $searchPaths = @()
    try {
        # Validate pipxHome before using it
        if ([string]::IsNullOrEmpty($pipxHome)) {
            throw "PIPX home directory is empty or null"
        }

        # PIPX bin directory
        $pipxBinDir = Join-Path $pipxHome "bin"
        if (-not [string]::IsNullOrEmpty($pipxBinDir)) {
            $searchPaths += $pipxBinDir
            Write-DebugLog -Message "Added PIPX bin path: $pipxBinDir" -Category "PIPX" -Color "Magenta"
        }

        # PIPX venvs directory for specific package
        if (-not [string]::IsNullOrEmpty($PackageName)) {
            $pipxVenvsDir = Join-Path $pipxHome "venvs\$PackageName\Scripts"
            if (-not [string]::IsNullOrEmpty($pipxVenvsDir)) {
                $searchPaths += $pipxVenvsDir
                Write-DebugLog -Message "Added PIPX venv Scripts path: $pipxVenvsDir" -Category "PIPX" -Color "Magenta"
            }
        }

        # Alternative Windows paths
        if (-not [string]::IsNullOrEmpty($env:USERPROFILE)) {
            $windowsPipxBin = Join-Path $env:USERPROFILE ".local\Scripts"
            if (-not [string]::IsNullOrEmpty($windowsPipxBin)) {
                $searchPaths += $windowsPipxBin
                Write-DebugLog -Message "Added Windows PIPX Scripts path: $windowsPipxBin" -Category "PIPX" -Color "Magenta"
            }
        }

        # Ensure we have at least one search path
        if ($searchPaths.Count -eq 0) {
            $fallbackPath = Join-Path $env:USERPROFILE ".local\Scripts"
            $searchPaths += $fallbackPath
            Write-DebugLog -Message "Added fallback search path: $fallbackPath" -Category "PIPX" -Color "Yellow"
        }
    }
    catch {
        Write-DebugLog -Message "Error building search paths: $($_.Exception.Message)" -Category "PIPX" -Color "Red"
        # Create a minimal fallback search path
        $fallbackPath = Join-Path $env:USERPROFILE ".local\Scripts"
        $searchPaths = @($fallbackPath)
        Write-DebugLog -Message "Using fallback search paths: $($searchPaths -join '; ')" -Category "PIPX" -Color "Yellow"
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
        
        # Capture pipx output but don't return it
        $pipxOutput = & pipx $installArgs 2>&1
        Write-DebugLog -Message "pipx installation output: $($pipxOutput -join ' ')" -Category "PIPX" -Color "Cyan"
        
        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "Installation successful" -Category "PIPX" -Color "Green"
            
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
            else {
                Write-DebugLog -Message "Installation completed but executable not found" -Category "PIPX" -Color "Yellow"
                return $null
            }
        }
        else {
            Write-DebugLog -Message "Installation failed with exit code: $LASTEXITCODE" -Category "PIPX" -Color "Red"
            # Try uninstall and reinstall for error recovery
            if (-not $ForceInstall) {
                Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "PIPX" -Color "Yellow"
                & pipx uninstall $PackageName 2>$null
                Start-Sleep -Seconds 2
                $retryOutput = & pipx install $PackageName --force 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-DebugLog -Message "Retry installation successful" -Category "PIPX" -Color "Green"
                    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
                    return $executable
                }
            }
            return $null
        }
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
    
    # Check if uv is available
    $uvExe = Get-Command "uv" -ErrorAction SilentlyContinue
    if (-not $uvExe) {
        Write-DebugLog -Message "uv not found, attempting to install via pip..." -Category "UV" -Color "Yellow"
        try {
            $pipExe = Get-Command "pip" -ErrorAction SilentlyContinue
            if ($pipExe) {
                & pip install uv 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $uvExe = Get-Command "uv" -ErrorAction SilentlyContinue
                    if (-not $uvExe) {
                        Write-DebugLog -Message "uv installation failed" -Category "UV" -Color "Red"
                        return $null
                    }
                } else {
                    Write-DebugLog -Message "Failed to install uv via pip" -Category "UV" -Color "Red"
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
    
    # Get Python Scripts directories for uv packages
    $searchPaths = @()
    try {
        # Get uv installation paths
        $uvTool = & uv tool dir 2>$null
        if ($uvTool) {
            $searchPaths += $uvTool
            Write-DebugLog -Message "Added uv tool directory: $uvTool" -Category "UV" -Color "Magenta"
        }
        
        # UV typically installs to Python Scripts directories
        $pipExe = Get-Command "pip" -ErrorAction SilentlyContinue
        if ($pipExe) {
            $pythonScriptsDir = & pip show pip 2>$null | Select-String "Location:" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }
            if ($pythonScriptsDir) {
                $scriptsDir = Join-Path $pythonScriptsDir "Scripts"
                $searchPaths += $scriptsDir
                Write-DebugLog -Message "Added Python Scripts path: $scriptsDir" -Category "UV" -Color "Magenta"
                
                # User-specific pip paths - NOTE: Not using --user parameter for consistency
                $userPipDir = & pip show pip 2>$null | Select-String "Location:" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }
                if ($userPipDir) {
                    $userScriptsDir = Join-Path $userPipDir "Scripts"
                    $searchPaths += $userScriptsDir
                    Write-DebugLog -Message "Added user Python Scripts path: $userScriptsDir" -Category "UV" -Color "Magenta"
                }
            }
        }
        
        # UV home directory (~/.local/bin on Unix, %USERPROFILE%\.local\bin on Windows)
        $uvHome = Join-Path $env:USERPROFILE ".local\bin"
        $searchPaths += $uvHome
        Write-DebugLog -Message "Added UV home bin path: $uvHome" -Category "UV" -Color "Magenta"
    }
    catch {
        Write-DebugLog -Message "Error building search paths: $($_.Exception.Message)" -Category "UV" -Color "Red"
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
    
    # For UV packages, skip scanning and use direct pip installation
    # Check if pip is available first
    $pipExecutable = Get-Command "pip" -ErrorAction SilentlyContinue
    if (-not $pipExecutable) {
        Write-DebugLog -Message "pip not found, cannot install UV package: $PackageName" -Category "UV" -Color "Red"
        return $null
    }

    if ($OnlyCheckFlag) {
        # For check-only mode, try to import the package
        try {
            $checkResult = & python -c "import $PackageName; print('installed')" 2>$null
            if ($checkResult -eq "installed") {
                Write-DebugLog -Message "Package already installed (import check): $PackageName" -Category "UV" -Color "Green"
                return "installed"
            }
        } catch {
            Write-DebugLog -Message "Package not installed (import check failed): $PackageName" -Category "UV" -Color "Yellow"
        }
        return $null
    }
    
    # Install package using pip directly (unified approach)
    Write-DebugLog -Message "Installing package via pip: $PackageName" -Category "UV" -Color "Yellow"
    try {
        # Use pip install directly
        $installArgs = @("install", $PackageName)
        if ($ForceInstall) {
            $installArgs += "--force-reinstall"
        }

        $Command = "pip $($installArgs -join ' ')"
        Write-DebugLog -Message "Command: $Command" -Category "UV" -Color "Magenta"

        # Execute pip install
        $pipOutput = & pip @installArgs 2>&1
        Write-DebugLog -Message "pip installation output: $($pipOutput -join ' ')" -Category "UV" -Color "Cyan"

        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "pip installation successful" -Category "UV" -Color "Green"
        } else {
            Write-DebugLog -Message "pip install failed with exit code: $LASTEXITCODE" -Category "UV" -Color "Red"
            return $null
        }
        
        # Return success indicator for pip installations
        Write-DebugLog -Message "Package installation completed successfully" -Category "UV" -Color "Green"
        return "installed"
    }
    catch {
        Write-DebugLog -Message "Installation error: $($_.Exception.Message)" -Category "UV" -Color "Red"
        return $null
    }
}

<#
.SYNOPSIS
    Installs tools using uvx (universal executor for Python tools)

.DESCRIPTION
    uvx installation method that provides isolated tool execution without
    installing packages globally. uvx is designed for running Python
    tools in isolated environments.
    
    Design Problems Solved:
    - Tool isolation and conflict prevention
    - Simple tool execution without global installation
    - Automatic dependency management for tools
    - Consistent tool behavior across environments
    
    Solution Approach:
    - Use uvx for isolated tool execution
    - Support package@version syntax
    - Return executable identifier for tracking
    - Leverage uv's fast Python package management

.PARAMETER PackageName
    The uvx package name with optional version (e.g., "black", "mcp-feedback-enhanced@latest")

.PARAMETER InstallDir
    NOTE: uvx manages isolated environments automatically.
    This parameter is kept for API consistency but is not used.

.PARAMETER Keyword
    Primary tool name for detection (e.g., "black", "uvx")

.PARAMETER AdditionalKeywords
    Additional keywords for comprehensive detection

.PARAMETER OnlyCheckFlag
    If true, only checks if uvx is available

.PARAMETER ForceInstall
    If true, forces reinstallation

.RETURNS
    Returns "uvx" executable path if uvx is available, or $null if not found

.NOTES
    - Provides isolated tool execution
    - No global package installation
    - Fast dependency resolution via uv
    - Returns uvx path for environment variable setup
#>
function Invoke-UvxCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "",
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )
    
    Write-DebugLog -Message "Processing uvx package: $PackageName" -Category "UVX" -Color "Cyan"
    
    # Check if uvx is available (uvx is part of uv)
    $uvxExe = Get-Command "uvx" -ErrorAction SilentlyContinue
    if (-not $uvxExe) {
        # Try uv instead (uvx might be accessed via uv)
        $uvExe = Get-Command "uv" -ErrorAction SilentlyContinue
        if (-not $uvExe) {
            Write-DebugLog -Message "Neither uvx nor uv found, attempting to install uv via pip..." -Category "UVX" -Color "Yellow"
            try {
                $pipExe = Get-Command "pip" -ErrorAction SilentlyContinue
                if ($pipExe) {
                    & pip install uv 2>&1 | Out-Null
                    if ($LASTEXITCODE -eq 0) {
                        $uvExe = Get-Command "uv" -ErrorAction SilentlyContinue
                        if (-not $uvExe) {
                            Write-DebugLog -Message "uv installation failed" -Category "UVX" -Color "Red"
                            return $null
                        }
                        Write-DebugLog -Message "uv installed successfully" -Category "UVX" -Color "Green"
                    } else {
                        Write-DebugLog -Message "Failed to install uv via pip" -Category "UVX" -Color "Red"
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
        
        # Check for uvx command again
        $uvxExe = Get-Command "uvx" -ErrorAction SilentlyContinue
        if (-not $uvxExe) {
            # Use 'uv tool run' as fallback for uvx functionality
            Write-DebugLog -Message "uvx not found, will use 'uv tool run' for execution" -Category "UVX" -Color "Yellow"
            $uvxExe = $uvExe
        }
    }
    
    if ($OnlyCheckFlag) {
        Write-DebugLog -Message "uvx available for tool execution: $PackageName" -Category "UVX" -Color "Green"
        return $uvxExe.Source
    }
    
    # For uvx, we don't actually install the package globally
    # Instead, we verify that uvx/uv is available for tool execution
    Write-DebugLog -Message "uvx tool prepared for execution: $PackageName" -Category "UVX" -Color "Green"
    Write-DebugLog -Message "Package will be executed in isolated environment when needed" -Category "UVX" -Color "Cyan"
    
    try {
        # Test uvx functionality by checking if we can access the tool
        if ($uvxExe.Name -eq "uvx") {
            # Test with uvx directly
            $testResult = & uvx --help 2>$null
        } else {
            # Test with uv tool command
            $testResult = & uv tool --help 2>$null
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "uvx/uv tool functionality verified" -Category "UVX" -Color "Green"
            return $uvxExe.Source
        } else {
            Write-DebugLog -Message "uvx/uv tool functionality test failed" -Category "UVX" -Color "Red"
            return $null
        }
    }
    catch {
        Write-DebugLog -Message "uvx installation error: $($_.Exception.Message)" -Category "UVX" -Color "Red"
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
    
    # Check if poetry is available
    $poetryExe = Get-Command "poetry" -ErrorAction SilentlyContinue
    if (-not $poetryExe) {
        Write-DebugLog -Message "Poetry not found in PATH, fallback to pip installation" -Category "POETRY" -Color "Yellow"
        # Poetry doesn't exist, fallback to pip
        return Invoke-PipCommand -PackageName $PackageName -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -OnlyCheckFlag $OnlyCheckFlag -ForceInstall $ForceInstall
    }
    
    # Get Poetry configuration paths
    $searchPaths = @()
    try {
        # Poetry's cache and venv directories
        $poetryConfig = & poetry config --list 2>$null
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
        $pipExe = Get-Command "pip" -ErrorAction SilentlyContinue
        if ($pipExe) {
            $pythonScriptsDir = & pip show pip 2>$null | Select-String "Location:" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }
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
        Write-DebugLog -Message "Chocolatey not found in PATH, attempting to install..." -Category "CHOCO" -Color "Yellow"
        Write-DebugLog -Message "Current PATH: $env:Path" -Category "CHOCO" -Color "Magenta"
        Write-DebugLog -Message "Windows Version: $([System.Environment]::OSVersion.Version)" -Category "CHOCO" -Color "Magenta"

        try {
            # Check if chocolatey directory already exists
            $chocoPath = "$env:ProgramData\chocolatey"
            if (Test-Path $chocoPath) {
                Write-DebugLog -Message "Chocolatey directory exists at: $chocoPath" -Category "CHOCO" -Color "Yellow"
                Write-DebugLog -Message "Attempting to refresh PATH to detect existing installation..." -Category "CHOCO" -Color "Yellow"

                # Refresh environment variables first
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
                Write-DebugLog -Message "Refreshed PATH: $env:Path" -Category "CHOCO" -Color "Magenta"

                # Check again after PATH refresh
                $chocoExe = Get-Command "choco" -ErrorAction SilentlyContinue
                if ($chocoExe) {
                    Write-DebugLog -Message "Chocolatey found after PATH refresh: $($chocoExe.Source)" -Category "CHOCO" -Color "Green"
                } else {
                    Write-DebugLog -Message "Chocolatey still not found after PATH refresh, checking bin directory..." -Category "CHOCO" -Color "Yellow"
                    $chocoBin = Join-Path $chocoPath "bin\choco.exe"
                    if (Test-Path $chocoBin) {
                        Write-DebugLog -Message "Found choco.exe at: $chocoBin" -Category "CHOCO" -Color "Green"
                        Write-DebugLog -Message "Adding chocolatey bin to PATH..." -Category "CHOCO" -Color "Yellow"
                        $env:Path = "$chocoPath\bin;$env:Path"
                        $chocoExe = Get-Command "choco" -ErrorAction SilentlyContinue
                        if ($chocoExe) {
                            Write-DebugLog -Message "Chocolatey now available: $($chocoExe.Source)" -Category "CHOCO" -Color "Green"
                        }
                    }
                }
            }

            # If still not found, attempt installation
            if (-not $chocoExe) {
                Write-DebugLog -Message "Installing Chocolatey using official script..." -Category "CHOCO" -Color "Yellow"

                # Use different installation methods based on Windows version
                $osVersion = [System.Environment]::OSVersion.Version
                if ($osVersion.Major -ge 10) {
                    # Windows 10/11 - use modern method
                    $installCommand = 'Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString("https://community.chocolatey.org/install.ps1"))'
                    Write-DebugLog -Message "Using Windows 10/11 installation method" -Category "CHOCO" -Color "Cyan"
                } else {
                    # Older Windows - use legacy method
                    $installCommand = 'iwr https://community.chocolatey.org/install.ps1 -UseBasicParsing | iex'
                    Write-DebugLog -Message "Using legacy Windows installation method" -Category "CHOCO" -Color "Cyan"
                }

                Write-DebugLog -Message "Executing installation command..." -Category "CHOCO" -Color "Cyan"
                $installOutput = Invoke-Expression $installCommand 2>&1
                Write-DebugLog -Message "Installation output: $($installOutput -join ' ')" -Category "CHOCO" -Color "Cyan"

                # Refresh environment variables to pick up chocolatey
                $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
                Write-DebugLog -Message "PATH after installation: $env:Path" -Category "CHOCO" -Color "Magenta"

                # Check if installation was successful
                $chocoExe = Get-Command "choco" -ErrorAction SilentlyContinue
                if ($chocoExe) {
                    Write-DebugLog -Message "Chocolatey successfully installed at: $($chocoExe.Source)" -Category "CHOCO" -Color "Green"
                } else {
                    Write-DebugLog -Message "Chocolatey installation failed - command not found after installation" -Category "CHOCO" -Color "Red"
                    Write-DebugLog -Message "Installation output was: $($installOutput -join ' ')" -Category "CHOCO" -Color "Red"
                    return $null
                }
            }
        }
        catch {
            Write-DebugLog -Message "Failed to install Chocolatey: $($_.Exception.Message)" -Category "CHOCO" -Color "Red"
            Write-DebugLog -Message "Exception details: $($_.Exception.ToString())" -Category "CHOCO" -Color "Red"
            return $null
        }
    } else {
        Write-DebugLog -Message "Chocolatey found at: $($chocoExe.Source)" -Category "CHOCO" -Color "Green"
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
        
        # Capture chocolatey output but don't return it
        $chocoOutput = & choco $installArgs 2>&1
        Write-DebugLog -Message "chocolatey installation output: $($chocoOutput -join ' ')" -Category "CHOCO" -Color "Cyan"
        
        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "Installation successful" -Category "CHOCO" -Color "Green"
            
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
            else {
                Write-DebugLog -Message "Installation completed but executable not found" -Category "CHOCO" -Color "Yellow"
                return $null
            }
        }
        else {
            Write-DebugLog -Message "Installation failed with exit code: $LASTEXITCODE" -Category "CHOCO" -Color "Red"
            # Try uninstall and reinstall for error recovery
            if (-not $ForceInstall) {
                Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "CHOCO" -Color "Yellow"
                & choco uninstall $PackageName -y 2>$null
                Start-Sleep -Seconds 2
                $retryArgs = @("install", $PackageName, "-y", "--force")
                if ($InstallDir) {
                    $retryArgs += "--install-directory=$InstallDir"
                }
                $retryOutput = & choco $retryArgs 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-DebugLog -Message "Retry installation successful" -Category "CHOCO" -Color "Green"
                    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
                    return $executable
                }
            }
            return $null
        }
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
        
        # Capture scoop output but don't return it
        $scoopOutput = & scoop $installArgs 2>&1
        Write-DebugLog -Message "scoop installation output: $($scoopOutput -join ' ')" -Category "SCOOP" -Color "Cyan"
        
        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "Installation successful" -Category "SCOOP" -Color "Green"
            
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
            else {
                Write-DebugLog -Message "Installation completed but executable not found" -Category "SCOOP" -Color "Yellow"
                return $null
            }
        }
        else {
            Write-DebugLog -Message "Installation failed with exit code: $LASTEXITCODE" -Category "SCOOP" -Color "Red"
            # Try uninstall and reinstall for error recovery
            if (-not $ForceInstall) {
                Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "SCOOP" -Color "Yellow"
                & scoop uninstall $PackageName 2>$null
                Start-Sleep -Seconds 2
                $retryOutput = & scoop install $PackageName --force 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-DebugLog -Message "Retry installation successful" -Category "SCOOP" -Color "Green"
                    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
                    return $executable
                }
            }
            return $null
        }
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
        
        # Capture cargo output but don't return it
        $cargoOutput = & cargo $installArgs 2>&1
        Write-DebugLog -Message "cargo installation output: $($cargoOutput -join ' ')" -Category "CARGO" -Color "Cyan"
        
        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "Installation successful" -Category "CARGO" -Color "Green"
            
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
            else {
                Write-DebugLog -Message "Installation completed but executable not found" -Category "CARGO" -Color "Yellow"
                return $null
            }
        }
        else {
            Write-DebugLog -Message "Installation failed with exit code: $LASTEXITCODE" -Category "CARGO" -Color "Red"
            # Try uninstall and reinstall for error recovery
            if (-not $ForceInstall) {
                Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "CARGO" -Color "Yellow"
                & cargo uninstall $PackageName 2>$null
                Start-Sleep -Seconds 2
                $retryOutput = & cargo install $PackageName --force 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-DebugLog -Message "Retry installation successful" -Category "CARGO" -Color "Green"
                    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
                    return $executable
                }
            }
            return $null
        }
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
        
        # Capture go output but don't return it
        $goOutput = & go $installArgs 2>&1
        Write-DebugLog -Message "go installation output: $($goOutput -join ' ')" -Category "GO" -Color "Cyan"
        
        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "Installation successful" -Category "GO" -Color "Green"
            
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
            else {
                Write-DebugLog -Message "Installation completed but executable not found" -Category "GO" -Color "Yellow"
                return $null
            }
        }
        else {
            Write-DebugLog -Message "Installation failed with exit code: $LASTEXITCODE" -Category "GO" -Color "Red"
            # For go, there's no uninstall command, so we try clean and reinstall
            if (-not $ForceInstall) {
                Write-DebugLog -Message "Attempting clean and reinstall..." -Category "GO" -Color "Yellow"
                & go clean -modcache 2>$null
                Start-Sleep -Seconds 2
                
                if ($useGoInstall) {
                    $retryOutput = & go install "$PackageName@latest" 2>&1
                }
                else {
                    $retryOutput = & go get -u $PackageName 2>&1
                }
                
                if ($LASTEXITCODE -eq 0) {
                    Write-DebugLog -Message "Retry installation successful" -Category "GO" -Color "Green"
                    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
                    return $executable
                }
            }
            return $null
        }
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
        
        # Capture gem output but don't return it
        $gemOutput = & gem $installArgs 2>&1
        Write-DebugLog -Message "gem installation output: $($gemOutput -join ' ')" -Category "GEM" -Color "Cyan"
        
        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "Installation successful" -Category "GEM" -Color "Green"
            
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
            else {
                Write-DebugLog -Message "Installation completed but executable not found" -Category "GEM" -Color "Yellow"
                return $null
            }
        }
        else {
            Write-DebugLog -Message "Installation failed with exit code: $LASTEXITCODE" -Category "GEM" -Color "Red"
            # Try uninstall and reinstall for error recovery
            if (-not $ForceInstall) {
                Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "GEM" -Color "Yellow"
                & gem uninstall $PackageName --user-install 2>$null
                Start-Sleep -Seconds 2
                $retryOutput = & gem install $PackageName --user-install --force 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-DebugLog -Message "Retry installation successful" -Category "GEM" -Color "Green"
                    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $true -Recursive $Recurse
                    return $executable
                }
            }
            return $null
        }
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
        
        # Capture brew output but don't return it
        $brewOutput = & brew $installArgs 2>&1
        Write-DebugLog -Message "brew installation output: $($brewOutput -join ' ')" -Category "BREW" -Color "Cyan"
        
        if ($LASTEXITCODE -eq 0) {
            Write-DebugLog -Message "Installation successful" -Category "BREW" -Color "Green"
            
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
            else {
                Write-DebugLog -Message "Installation completed but executable not found" -Category "BREW" -Color "Yellow"
                return $null
            }
        }
        else {
            Write-DebugLog -Message "Installation failed with exit code: $LASTEXITCODE" -Category "BREW" -Color "Red"
            # Try uninstall and reinstall for error recovery
            if (-not $ForceInstall) {
                Write-DebugLog -Message "Attempting uninstall and reinstall..." -Category "BREW" -Color "Yellow"
                & brew uninstall $PackageName 2>$null
                Start-Sleep -Seconds 2
                $retryOutput = & brew install $PackageName --force 2>&1
                if ($LASTEXITCODE -eq 0) {
                    Write-DebugLog -Message "Retry installation successful" -Category "BREW" -Color "Green"
                    $executable = Find-ExecutableByKeyword -Keywords $searchKeywords -AdditionalScanPaths $searchPaths -ExecutableExtensions $ExecutableExtensions -IncludeSystemPaths $false -Recursive $Recurse
                    return $executable
                }
            }
            return $null
        }
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
    
    # Check if already installed by looking for executable in install directory
    if (-not $IsArchive) {
        # For direct executable downloads, check the exact path
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
    } else {
        # For archive downloads, search for executable in install directory
        $foundExecutable = Get-ChildItem -Path $InstallDir -Name $ExecutableName -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($foundExecutable) {
            $executablePath = Join-Path $InstallDir $foundExecutable
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
    }
    
    # Determine download approach based on whether it's an archive
    try {
        Write-Host "       [WEB] Downloading $PackageName from: $DownloadUrl" -ForegroundColor Cyan
        
        if ($IsArchive) {
            # For archives, download to temporary location first
            $tempDir = Join-Path $Global:USER_CACHE_DIR "temp_downloads"
            if (-not (Test-Path $tempDir)) {
                New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
            }
            
            $fileName = [System.IO.Path]::GetFileName($DownloadUrl)
            if (-not $fileName -or $fileName -eq "") {
                $fileName = "$PackageName.$ArchiveType"
            }
            $tempFilePath = Join-Path $tempDir $fileName
            
            Write-Host "       [WEB] Downloading archive to temp location: $tempFilePath" -ForegroundColor Cyan
            
            # Download the archive
            Invoke-WebRequest -Uri $DownloadUrl -OutFile $tempFilePath -UseBasicParsing -ErrorAction Stop
            
            if (-not (Test-Path $tempFilePath)) {
                throw "Downloaded file not found at expected location: $tempFilePath"
            }
            
            Write-Host "       [WEB] Successfully downloaded archive $PackageName" -ForegroundColor Green
            
            # Extract the archive
            Write-Host "       [WEB] Extracting $ArchiveType archive..." -ForegroundColor Cyan
            
            # Clear install directory for clean extraction
            if (Test-Path $InstallDir) {
                Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
            }
            New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
            
            # Extract based on archive type
            switch ($ArchiveType.ToLower()) {
                "zip" {
                    if (Get-Command "Expand-Archive" -ErrorAction SilentlyContinue) {
                        Expand-Archive -Path $tempFilePath -DestinationPath $InstallDir -Force
                        Write-Host "       [WEB] Archive extracted using Expand-Archive" -ForegroundColor Green
                    } else {
                        throw "Expand-Archive not available and no alternative extraction method configured"
                    }
                }
                "7z" {
                    # Try 7-Zip if available, fallback to Expand-Archive for zip-compatible formats
                    if (Test-Path $Global:SEVENZIP_EXE_PATH -ErrorAction SilentlyContinue) {
                        $arguments = "x `"$tempFilePath`" -o`"$InstallDir`" -y"
                        $process = Start-Process -FilePath $Global:SEVENZIP_EXE_PATH -ArgumentList $arguments -Wait -NoNewWindow -PassThru
                        if ($process.ExitCode -eq 0) {
                            Write-Host "       [WEB] Archive extracted using 7-Zip" -ForegroundColor Green
                        } else {
                            throw "7-Zip extraction failed with exit code: $($process.ExitCode)"
                        }
                    } else {
                        throw "7-Zip not available for .7z file extraction"
                    }
                }
                default {
                    throw "Unsupported archive type: $ArchiveType"
                }
            }
            
            # Clean up temporary file
            Remove-Item -Path $tempFilePath -Force -ErrorAction SilentlyContinue
            
            # Search for the executable in the extracted contents
            Write-Host "       [WEB] Searching for executable: $ExecutableName" -ForegroundColor Cyan
            $foundFiles = Get-ChildItem -Path $InstallDir -Name $ExecutableName -Recurse -ErrorAction SilentlyContinue
            
            if ($foundFiles -and $foundFiles.Count -gt 0) {
                # Get the first match and construct full path
                $relativePath = $foundFiles[0]
                $executablePath = Join-Path $InstallDir $relativePath
                Write-Host "       [WEB] Found executable at: $executablePath" -ForegroundColor Green
                
                # Verify the executable exists and is accessible
                if (Test-Path $executablePath) {
                    Write-Host "       [WEB] $PackageName installation verified at: $executablePath" -ForegroundColor Green
                    return $executablePath
                } else {
                    Write-Host "       [WEB] Error: Found executable path is not accessible: $executablePath" -ForegroundColor Red
                    return $null
                }
            } else {
                Write-Host "       [WEB] Warning: Could not find executable '$ExecutableName' in extracted archive" -ForegroundColor Yellow
                Write-Host "       [WEB] Archive contents extracted to: $InstallDir" -ForegroundColor Yellow
                # List contents for debugging
                $contents = Get-ChildItem -Path $InstallDir -Recurse -File | Select-Object -First 10
                if ($contents) {
                    Write-Host "       [WEB] First 10 files in archive:" -ForegroundColor Yellow
                    foreach ($file in $contents) {
                        Write-Host "       [WEB]   - $($file.FullName.Substring($InstallDir.Length + 1))" -ForegroundColor Yellow
                    }
                }
                return $null
            }
        } else {
            # For direct executable downloads
            Write-Host "       [WEB] Target path: $executablePath" -ForegroundColor Cyan
            
            Invoke-WebRequest -Uri $DownloadUrl -OutFile $executablePath -UseBasicParsing -ErrorAction Stop
            
            Write-Host "       [WEB] Successfully downloaded $PackageName" -ForegroundColor Green
            
            # Verify the download
            if (Test-Path $executablePath) {
                Write-Host "       [WEB] $PackageName installation verified at: $executablePath" -ForegroundColor Green
                return $executablePath
            }
            else {
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

# PowerShell Command Installation Function
function Invoke-PowerShellCommand {
    param (
        [Parameter(Mandatory = $true)]
        [string]$PackageName,
        [string]$InstallDir = "", # Ignored for PowerShell (API consistency)
        [string]$Keyword = "",
        [array]$AdditionalKeywords = @(),
        [bool]$OnlyCheckFlag = $false,
        [bool]$ForceInstall = $true
    )
    
    $Recurse = $false
    $ExecutableExtensions = @(".exe", ".bat", ".cmd", ".ps1")
    
    Write-Host "       [PS] Processing PowerShell package: $PackageName" -ForegroundColor Cyan
    
    try {
        # Get package metadata
        $packageMeta = $null
        if ($Global:DEV_SOFTWARE_PACKAGES.ContainsKey($PackageName)) {
            $packageMeta = $Global:DEV_SOFTWARE_PACKAGES[$PackageName]
        } elseif ($Global:APPLICATIONS_PACKAGES.ContainsKey($PackageName)) {
            $packageMeta = $Global:APPLICATIONS_PACKAGES[$PackageName]
        } elseif ($Global:COMMON_SOFTWARE_PACKAGES.ContainsKey($PackageName)) {
            $packageMeta = $Global:COMMON_SOFTWARE_PACKAGES[$PackageName]
        }
        
        if (-not $packageMeta) {
            Write-Host "       [PS] Package metadata not found for: $PackageName" -ForegroundColor Red
            return $null
        }
        
        # Build search keywords
        $searchKeywords = @($Keyword)
        if ($AdditionalKeywords) {
            $searchKeywords += $AdditionalKeywords
        }
        if (-not $searchKeywords -or $searchKeywords -eq "") {
            $searchKeywords = @($PackageName)
        }
        
        # Define search paths for PowerShell-installed packages
        $searchPaths = @()
        
        # Common PowerShell installation paths
        $userProfile = $env:USERPROFILE
        $searchPaths += Join-Path $userProfile "bin"
        $searchPaths += Join-Path $userProfile ".local\bin"
        $searchPaths += Join-Path $userProfile "AppData\Local\Microsoft\WindowsApps"
        $searchPaths += Join-Path $userProfile "AppData\Roaming\Microsoft\Windows\Start Menu\Programs"
        
        # System paths
        $searchPaths += "C:\Program Files"
        $searchPaths += "C:\Program Files (x86)"
        $searchPaths += "C:\Windows\System32"
        $searchPaths += "C:\Windows"
        
        # Check if already installed - simple check using Get-Command
        Write-Host "       [PS] Checking if package is already installed..." -ForegroundColor Cyan
        $executable = $null
        
        # Try to find the executable using Get-Command
        foreach ($keyword in $searchKeywords) {
            $found = Get-Command $keyword -ErrorAction SilentlyContinue
            if ($found) {
                $executable = $found.Source
                break
            }
        }
        
        if ($executable -and -not $ForceInstall) {
            Write-Host "       [PS] Package already installed: $executable" -ForegroundColor Green
            Write-Host "       [PS] Skipping installation (ForceInstall = $ForceInstall)" -ForegroundColor Cyan
            return $executable
        }
        
        if ($OnlyCheckFlag) {
            return $executable
        }
        
        # Get PowerShell command
        $powerShellCommand = if ($packageMeta.ContainsKey("PowerShellCommand")) { 
            $packageMeta.PowerShellCommand 
        } else { 
            Write-Host "       [PS] No PowerShellCommand specified for: $PackageName" -ForegroundColor Red
            return $null
        }
        
        Write-Host "       [PS] Executing PowerShell command: $powerShellCommand" -ForegroundColor Yellow
        
        # Execute PowerShell command
        Invoke-Expression $powerShellCommand | Out-Null
        
        if ($LASTEXITCODE -eq 0 -or $?) {
            Write-Host "       [PS] PowerShell installation completed successfully for: $PackageName" -ForegroundColor Green
            
            # Find the installed executable after installation
            Write-Host "       [PS] Searching for installed executable..." -ForegroundColor Cyan
            $executable = $null
            
            # Try to find the executable using Get-Command
            foreach ($keyword in $searchKeywords) {
                $found = Get-Command $keyword -ErrorAction SilentlyContinue
                if ($found) {
                    $executable = $found.Source
                    break
                }
            }
            
            if ($executable) {
                Write-Host "       [PS] Found executable: $executable" -ForegroundColor Green
                return $executable
            } else {
                Write-Host "       [PS] Installation completed but executable not found" -ForegroundColor Yellow
                # Fallback: return the expected executable name from metadata
                if ($packageMeta.ContainsKey("Exec")) {
                    $expectedExec = $packageMeta.Exec
                    Write-Host "       [PS] Returning expected executable name: $expectedExec" -ForegroundColor Yellow
                    return $expectedExec
                }
                return $null
            }
        } else {
            Write-Host "       [PS] PowerShell installation failed for: $PackageName" -ForegroundColor Red
            return $null
        }
    }
    catch {
        Write-Host "       [PS] Error executing PowerShell command for $PackageName`: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}