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

# ============================================================================
# PROJECT-WIDE NODE.JS PACKAGE MANAGEMENT NOTICE
# ============================================================================
# IMPORTANT: This project uses PNPM exclusively for all Node.js package management.
#
# WHY PNPM?
# - Faster installation and disk space efficiency (uses hardlinks)
# - Better monorepo support with workspaces
# - More predictable dependency resolution
# - Native support for hoisting strategies via .pnpmrc
# - Better separation between different configuration concerns
#
# CONFIGURATION:
# - All pnpm-specific settings are stored in .pnpmrc (separate from npm)
# - npm InstallType calls are internally routed to Invoke-PnpmCommand
# - npm is available as a fallback if pnpm is not installed
#
# This separation prevents npm from warning about unknown pnpm configurations
# and maintains clean, project-specific package manager configurations.
# ============================================================================

param(
    [string]$Region = "Global", # This parameter is now largely superseded by Get-GlobalVar
    [string]$PackageName = "", # Filter packages by name (supports partial matching with wildcards)
    [string]$PackageGroup = "", # Filter by package group (BasePackages, ApplicationsPackages, CommonSoftwarePackages, McpServicesPackages, DevSoftwarePackages - supports partial matching)
    [string]$ExactPackageName = "" # When set, only the package whose key equals this value is installed (used by APP Install menu)
)

<#
.SYNOPSIS
    Enhanced Step12 with flexible package and group filtering capabilities

.DESCRIPTION
    This script supports both individual package filtering and package group filtering:

    PACKAGE NAME FILTERING:
    - Use -PackageName to filter packages by name (supports partial matching)
    - Examples: -PackageName "VSCode" (matches VSCodium, VSCode, etc.)
    - Examples: -PackageName "Python" (matches Python313 from Step8 / GlobalVars)

    PACKAGE GROUP FILTERING:
    - Use -PackageGroup to filter entire package groups (supports partial matching)
    - Available groups: Windows10EssentialPatches, BasePackages, ApplicationsPackages, CommonSoftwarePackages, McpServicesPackages, DevSoftwarePackages
    - Examples: -PackageGroup "Windows10" (matches Windows10EssentialPatches - Win10 only)
    - Examples: -PackageGroup "Mcp" (matches McpServicesPackages)
    - Examples: -PackageGroup "Base" (matches BasePackages)
    - Examples: -PackageGroup "Dev" (matches DevSoftwarePackages)

    USAGE EXAMPLES:
    .\Step21_InstallApplications.ps1 -PackageName "VSCode"           # Install all packages containing "VSCode"
    .\Step21_InstallApplications.ps1 -PackageGroup "Windows10"      # Install only Windows 10 Essential Patches (Win10 only)
    .\Step21_InstallApplications.ps1 -PackageGroup "Mcp"            # Install only MCP services packages
    .\Step21_InstallApplications.ps1 -PackageGroup "Base"           # Install only base packages
    .\Step21_InstallApplications.ps1                                # Install all packages (default behavior)
#>

# Load global variables and common functions
. "$PSScriptRoot\..\win_common\GlobalVars.ps1"
. "$PSScriptRoot\..\win_common\ApplicationsList.ps1"
. "$PSScriptRoot\..\win_common\CommonFunc.ps1"
. "$PSScriptRoot\..\win_common\WindowsPathFunction.ps1"
. "$PSScriptRoot\..\win_common\PackageManagerInvokes.ps1"
. "$PSScriptRoot\..\win_common\PostInstallCallbackProcessor.ps1"
. "$PSScriptRoot\..\win_common\DesktopIconManager.ps1"


# Local debug configuration for this script
$LocalDebugMode = $true  # Set to $false to disable debug output for this script only

$SCRIPT_INDEX = "[Step 21]"      
Write-Host "$SCRIPT_INDEX Install Base Packages (winget preferred)" -ForegroundColor Cyan

# Test debug function with local debug mode
Write-DebugLog -Message "Debug system initialized" -Category "STEP12" -Color "Green" -LocalDebug $LocalDebugMode


# Retrieve installation type from global variables
$installType = Get-GlobalVar -key "INSTALL_TYPE" -defaultValue "base"
if ([string]::IsNullOrWhiteSpace($installType)) { $installType = "base" }

# Store filters at script level
$script:PackageNameFilter = $PackageName
$script:PackageGroupFilter = $PackageGroup
$script:ExactPackageNameFilter = $ExactPackageName

# Track installed packages' desktop categories for final organization
$script:InstalledDesktopCategories = @()

# Check if filters are provided
if (-not [string]::IsNullOrWhiteSpace($ExactPackageName)) {
    Write-Host "$SCRIPT_INDEX Exact package name specified: $ExactPackageName (single package)" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Overriding install type to 'full' due to exact package filter" -ForegroundColor Yellow
    $installType = "full"
}
elseif (-not [string]::IsNullOrWhiteSpace($PackageName)) {
    Write-Host "$SCRIPT_INDEX Package name filter specified: $PackageName (partial matching)" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Overriding install type to 'full' due to package name filter" -ForegroundColor Yellow
    $installType = "full"
}

if (-not [string]::IsNullOrWhiteSpace($PackageGroup)) {
    Write-Host "$SCRIPT_INDEX Package group filter specified: $PackageGroup (partial matching)" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Overriding install type to 'full' due to package group filter" -ForegroundColor Yellow
    $installType = "full"
}

Write-Host "$SCRIPT_INDEX Installing all base packages from GlobalVars.ps1" -ForegroundColor Cyan

# Function to check if package should be installed based on filters
function Test-PackageFilter {
    param(
        [string]$PackageName,
        [hashtable]$PackageMeta
    )

    # Exact package name takes precedence (used by APP Install menu)
    if (-not [string]::IsNullOrWhiteSpace($script:ExactPackageNameFilter)) {
        return ($PackageName -eq $script:ExactPackageNameFilter)
    }

    # If no filter is specified, install all packages
    if ([string]::IsNullOrWhiteSpace($script:PackageNameFilter)) {
        return $true
    }

    # Check if package name contains the filter (case-insensitive partial matching)
    if ($PackageName -like "*$($script:PackageNameFilter)*") {
        return $true
    }

    # Check if package Name property contains the filter (case-insensitive partial matching)
    $packageNameValue = if ($PackageMeta.ContainsKey("Name")) { $PackageMeta.Name } else { "" }
    if ($packageNameValue -like "*$($script:PackageNameFilter)*") {
        return $true
    }

    return $false
}

# Function to check if package group should be processed based on group filter
function Test-PackageGroupFilter {
    param(
        [string]$GroupName
    )

    # If no group filter is specified, process all groups
    if ([string]::IsNullOrWhiteSpace($script:PackageGroupFilter)) {
        return $true
    }

    # Check if group name contains the filter (case-insensitive partial matching)
    if ($GroupName -like "*$($script:PackageGroupFilter)*") {
        return $true
    }

    return $false
}

# Enhanced helper function to install single package or package array via specific package manager
function Install-SinglePackageViaManager {
    param(
        [string]$InstallType,
        $PackageName, # Accept string, hashtable, or array of packages
        [string]$Keyword,
        [array]$AdditionalKeywords,
        [bool]$ForceInstall = $false
    )

    # Handle array of packages - batch installation support
    if ($PackageName -is [array] -and $PackageName.Count -gt 1) {
        Write-Host "$SCRIPT_INDEX Installing $InstallType packages (batch): $($PackageName.Count) packages" -ForegroundColor Cyan

        # Try batch installation first for supported package managers
        if ($InstallType -in @("pip", "npm", "yarn", "pnpm")) {
            $batchResult = Install-PackagesBatch -InstallType $InstallType -Packages $PackageName -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall
            if ($batchResult) {
                return $batchResult
            }
            Write-Host "$SCRIPT_INDEX Batch installation failed, falling back to individual installation" -ForegroundColor Yellow
        }

        # Fallback to individual installation
        $results = @()
        foreach ($pkg in $PackageName) {
            $result = Install-SinglePackageViaManager -InstallType $InstallType -PackageName $pkg -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall
            if ($result) {
                $results += $result
            }
        }
        return if ($results.Count -gt 0) { $results[0] } else { $null } # Return first successful result
    }

    # Handle single package (original logic)
    $singlePackage = if ($PackageName -is [array] -and $PackageName.Count -eq 1) { $PackageName[0] } else { $PackageName }

    # Extract package name for display
    $displayName = if ($singlePackage -is [hashtable]) {
        if ($singlePackage.packageName) {
            $singlePackage.packageName
        }
        else {
            "[Hashtable Object - Missing packageName]"
        }
    }
    else {
        $singlePackage
    }
    Write-Host "$SCRIPT_INDEX Installing $InstallType package: $displayName" -ForegroundColor Cyan
    
    try {
        $executable = $null
        
        switch ($InstallType) {
            "npm" { $executable = Invoke-PnpmCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "pip" { $executable = Invoke-PipCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "cargo" { $executable = Invoke-CargoCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "go" { $executable = Invoke-GoCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "gem" { $executable = Invoke-GemCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "pipx" { $executable = Invoke-PipxCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "uv" { $executable = Invoke-UvCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "uvx" { $executable = Invoke-UvxCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "poetry" { $executable = Invoke-PoetryCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "choco" { $executable = Invoke-ChocoCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "scoop" { $executable = Invoke-ScoopCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "brew" { $executable = Invoke-BrewCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "powershell" { $executable = Invoke-PowerShellCommand -PackageName $singlePackage -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            default { 
                Write-Host "$SCRIPT_INDEX Unknown installation type '$InstallType'" -ForegroundColor Red
                return $null
            }
        }
        
        if ($executable) {
            Write-Host "$SCRIPT_INDEX Successfully installed $InstallType package: $displayName" -ForegroundColor Green
            return $executable
        }
        else {
            Write-Host "$SCRIPT_INDEX Failed to install $InstallType package: $displayName" -ForegroundColor Red
            return $null
        }
    }
    catch {
        Write-Host "$SCRIPT_INDEX Error installing $InstallType package $displayName`: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}


# Helper function to validate and get package ID with SubInstallMethod priority
function Get-ValidatedPackageId {
    param(
        [hashtable]$PackageMeta,
        [hashtable]$SubInstallMethod = $null
    )

    # Get install type and package ID, prioritizing SubInstallMethod
    $InstallType = if ($SubInstallMethod -and $SubInstallMethod.ContainsKey("InstallType")) {
        $SubInstallMethod.InstallType
    } elseif ($PackageMeta.ContainsKey("InstallType")) {
        $PackageMeta.InstallType
    } else {
        "winget"
    }

    $PackageId = if ($SubInstallMethod -and $SubInstallMethod.ContainsKey("PackageId")) {
        $SubInstallMethod.PackageId
    } elseif ($PackageMeta.ContainsKey("PackageId")) {
        $PackageMeta.PackageId
    } else {
        ""
    }

    # DEBUG OUTPUT
    Write-DebugLog -Message "Get-ValidatedPackageId - InstallType: '$InstallType', PackageId: '$PackageId'" -Category "VALIDATION" -Color "Yellow" -LocalDebug $LocalDebugMode
    Write-DebugLog -Message "SubInstallMethod exists: $($null -ne $SubInstallMethod)" -Category "VALIDATION" -Color "Yellow" -LocalDebug $LocalDebugMode
    if ($SubInstallMethod) {
        Write-DebugLog -Message "SubInstallMethod.InstallType: '$(if ($SubInstallMethod.ContainsKey("InstallType")) { $SubInstallMethod.InstallType } else { 'NOT SET' })'" -Category "VALIDATION" -Color "Yellow" -LocalDebug $LocalDebugMode
        Write-DebugLog -Message "SubInstallMethod.PackageId: '$(if ($SubInstallMethod.ContainsKey("PackageId")) { $SubInstallMethod.PackageId } else { 'NOT SET' })'" -Category "VALIDATION" -Color "Yellow" -LocalDebug $LocalDebugMode
    }
    Write-DebugLog -Message "PackageMeta.InstallType: '$(if ($PackageMeta.ContainsKey("InstallType")) { $PackageMeta.InstallType } else { 'NOT SET' })'" -Category "VALIDATION" -Color "Yellow" -LocalDebug $LocalDebugMode
    Write-DebugLog -Message "PackageMeta.PackageId: '$(if ($PackageMeta.ContainsKey("PackageId")) { $PackageMeta.PackageId } else { 'NOT SET' })'" -Category "VALIDATION" -Color "Yellow" -LocalDebug $LocalDebugMode

    # Check if PackageId is required for this install type
    $RequiredTypes = @("winget", "choco", "scoop", "web", "uvx", "pipx", "uv", "poetry", "cargo", "go", "gem", "brew")
    $IsRequired = $InstallType -in $RequiredTypes

    # For npm and pip, PackageId is not required as package name is used directly
    if ([string]::IsNullOrEmpty($PackageId) -and $IsRequired) {
        Write-Host "$SCRIPT_INDEX Error: Package requires PackageId for $InstallType installation type" -ForegroundColor Red -BackgroundColor White
        Write-DebugLog -Message "ERROR: Missing PackageId for $InstallType. RequiredTypes: $($RequiredTypes -join ', ')" -Category "VALIDATION" -Color "Red" -LocalDebug $LocalDebugMode
        return $null
    }

    Write-DebugLog -Message "Validation passed. Returning: InstallType='$InstallType', PackageId='$PackageId'" -Category "VALIDATION" -Color "Green" -LocalDebug $LocalDebugMode

    return @{
        InstallType = $InstallType
        PackageId = $PackageId
    }
}

# Enhanced batch installation function for supported package managers
function Install-PackagesBatch {
    param(
        [string]$InstallType,
        [array]$Packages,
        [string]$Keyword,
        [array]$AdditionalKeywords,
        [bool]$ForceInstall = $false
    )

    Write-Host "$SCRIPT_INDEX Attempting batch installation for $InstallType..." -ForegroundColor Cyan

    # Extract package names from mixed array (strings and hashtables)
    $packageNames = @()
    $complexPackages = @()

    foreach ($pkg in $Packages) {
        if ($pkg -is [hashtable]) {
            if ($pkg.ContainsKey("validationType") -and $pkg.validationType -eq "import") {
                # Complex packages need individual handling
                $complexPackages += $pkg
            }
            elseif ($pkg.ContainsKey("packageName")) {
                $packageNames += $pkg.packageName
            }
        }
        elseif ($pkg -is [string]) {
            $packageNames += $pkg
        }
    }

    # Batch install simple packages if any
    $batchResult = $null
    if ($packageNames.Count -gt 0) {
        switch ($InstallType) {
            "pip" { $batchResult = Invoke-PipCommand -PackageName $packageNames -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "npm" { $batchResult = Invoke-PnpmCommand -PackageName $packageNames -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "yarn" { $batchResult = Invoke-YarnCommand -PackageName $packageNames -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            "pnpm" { $batchResult = Invoke-PnpmCommand -PackageName $packageNames -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall }
            default {
                Write-Host "$SCRIPT_INDEX Batch installation not supported for $InstallType" -ForegroundColor Yellow
                return $null
            }
        }
    }

    # Handle complex packages individually
    foreach ($complexPkg in $complexPackages) {
        $result = Install-SinglePackageViaManager -InstallType $InstallType -PackageName $complexPkg -Keyword $Keyword -AdditionalKeywords $AdditionalKeywords -ForceInstall $ForceInstall
        if (-not $result) {
            Write-Host "$SCRIPT_INDEX Failed to install complex package: $($complexPkg.packageName)" -ForegroundColor Red
        }
    }

    return $batchResult
}

# Function to handle post-install callbacks

# Function to handle AdditionalInstallationPackages with enhanced compatibility
function Install-AdditionalPackages {
    param(
        [string]$PackageName,
        [hashtable]$PackageMeta
    )
    
    if (-not $PackageMeta.ContainsKey("AdditionalInstallationPackages") -or -not $PackageMeta.AdditionalInstallationPackages) {
        return
    }
    
    Write-Host "$SCRIPT_INDEX Processing AdditionalInstallationPackages for $PackageName..." -ForegroundColor Cyan
    
    foreach ($additionalPackage in $PackageMeta.AdditionalInstallationPackages) {
        $installType = if ($additionalPackage.ContainsKey("installType")) { $additionalPackage.installType } else { "" }
        $installPackages = if ($additionalPackage.ContainsKey("installPackage")) { $additionalPackage.installPackage } else { @() }
        
        if (-not $installType -or -not $installPackages -or $installPackages.Count -eq 0) {
            Write-Host "$SCRIPT_INDEX Warning: Invalid AdditionalInstallationPackages configuration for $PackageName" -ForegroundColor Yellow
            continue
        }
        
        # Build package names for display
        $packageNames = @()
        foreach ($pkg in $installPackages) {
            if ($pkg -is [hashtable] -and $pkg.packageName) {
                $packageNames += $pkg.packageName
            }
            else {
                $packageNames += $pkg
            }
        }
        Write-Host "$SCRIPT_INDEX Installing additional packages via ${installType}: $($packageNames -join ', ')" -ForegroundColor Cyan
        
        # Use unified package installation function for all types
        foreach ($packageToInstall in $installPackages) {
            # Handle both string and object formats for pip packages
            if ($installType -eq "pip" -and $packageToInstall -is [hashtable]) {
                # Object format: extract packageName for installation
                $packageName = $packageToInstall.packageName
                $keyword = if ($packageToInstall.validationType -eq "import") { $packageToInstall.importName } else { $packageName }
                Install-SinglePackageViaManager -InstallType $installType -PackageName $packageName -Keyword $keyword -AdditionalKeywords @($keyword) -ForceInstall $false | Out-Null
            }
            else {
                # String format: use as-is (original behavior)
                Install-SinglePackageViaManager -InstallType $installType -PackageName $packageToInstall -Keyword $packageToInstall -AdditionalKeywords @($packageToInstall) -ForceInstall $false | Out-Null
            }
        }
    }
}

# Function to manage package installation with combo support
function Install-PackageManager {
    param(
        [string]$PackageName,
        [hashtable]$PackageMeta,
        [ValidateSet("BaseDir", "AppDir", "ProjectDir", "McpDir")]
        [string]$BaseDirectory = "BaseDir"
    )

    # Check package filter early to avoid unnecessary processing
    if (-not (Test-PackageFilter -PackageName $PackageName -PackageMeta $PackageMeta)) {
        Write-Host "$SCRIPT_INDEX Skipping $PackageName - does not match filter '$($script:PackageNameFilter)'" -ForegroundColor Yellow
        return $null
    }

    # Check if InstallType exists
    if (-not $PackageMeta.ContainsKey("InstallType")) {
        Write-Host "$SCRIPT_INDEX Error: Package $PackageName has no InstallType, skipping installation" -ForegroundColor Red -BackgroundColor White
        Write-Host "$SCRIPT_INDEX Package metadata keys: $($PackageMeta.Keys -join ', ')" -ForegroundColor Yellow
        Write-Host "$SCRIPT_INDEX Package description: $($PackageMeta.Description)" -ForegroundColor Yellow
        return $null
    }

    $InstallType = $PackageMeta.InstallType

    # Handle combo installation
    if ($InstallType -eq "combo" -and $PackageMeta.ContainsKey("ComboMethods")) {
        Write-Host "$SCRIPT_INDEX Starting combo installation for $PackageName" -ForegroundColor Cyan
        Write-Host "$SCRIPT_INDEX Available combo methods: $($PackageMeta.ComboMethods.Count)" -ForegroundColor Cyan

        # Try each method in sequence until first success
        foreach ($method in $PackageMeta.ComboMethods) {
            $methodType = $method.InstallType
            Write-Host "$SCRIPT_INDEX Trying installation method: $methodType" -ForegroundColor Cyan

            # Try to install with this method using SubInstallMethod parameter
            try {
                $result = Install-BasePackage -PackageName $PackageName -PackageMeta $PackageMeta -BaseDirectory $BaseDirectory -SubInstallMethod $method

                # Check if installation was successful - verify that executable exists
                if ($result -and $result -ne "" -and $null -ne $result) {
                    # Additional validation: check if the result is a valid file path
                    if (Test-Path $result -ErrorAction SilentlyContinue) {
                        Write-Host "$SCRIPT_INDEX Successfully installed $PackageName via $methodType (verified at: $result), skipping remaining methods" -ForegroundColor Green
                        return $result
                    }
                    else {
                        Write-Host "$SCRIPT_INDEX Installation via $methodType returned path but file not found: $result, trying next method..." -ForegroundColor Yellow
                    }
                }
                else {
                    Write-Host "$SCRIPT_INDEX Installation via $methodType failed for $PackageName (null/empty result), trying next method..." -ForegroundColor Yellow
                }
            }
            catch {
                Write-Host "$SCRIPT_INDEX Installation via $methodType failed with error for ${PackageName}: $($_.Exception.Message)" -ForegroundColor Red
            }
        }

        Write-Host "$SCRIPT_INDEX All installation methods failed for $PackageName" -ForegroundColor Red
        return $null
    }
    else {
        # Regular installation
        return Install-BasePackage -PackageName $PackageName -PackageMeta $PackageMeta -BaseDirectory $BaseDirectory
    }
}

# Function to extract common package parameters
function Get-PackageParameters {
    param(
        [string]$PackageName,
        [hashtable]$PackageMeta,
        [hashtable]$SubInstallMethod = $null
    )

    # Extract common parameters that don't change between combo methods
    $EXEC_NAME = if ($PackageMeta.ContainsKey("Exec")) { $PackageMeta.Exec } else { "" }
    $NAME = if ($PackageMeta.ContainsKey("Name")) { $PackageMeta.Name } else { [System.IO.Path]::GetFileNameWithoutExtension($EXEC_NAME) }

    # Build comprehensive registry search keywords including EXEC_NAME and NAME
    $REGISTRY_SEARCH_KEYWORDS = @()
    if ($PackageMeta.ContainsKey("RegistrySearchKeyword")) {
        $REGISTRY_SEARCH_KEYWORDS += $PackageMeta.RegistrySearchKeyword
    }
    # Always include EXEC_NAME and NAME as fallback keywords
    if ($EXEC_NAME) { $REGISTRY_SEARCH_KEYWORDS += $EXEC_NAME -replace "\.exe$", "" }
    if ($NAME) { $REGISTRY_SEARCH_KEYWORDS += $NAME }
    # Remove duplicates and empty entries
    $REGISTRY_SEARCH_KEYWORDS = $REGISTRY_SEARCH_KEYWORDS | Where-Object { $_ -and $_.Trim() } | Select-Object -Unique
    $REGISTRY_SEARCH_KEYWORD = $REGISTRY_SEARCH_KEYWORDS -join ";"

    $ADDITIONAL_KEYWORDS = if ($PackageMeta.ContainsKey("AdditionalKeywords")) { $PackageMeta.AdditionalKeywords } else { @() }
    $DESCRIPTION = if ($PackageMeta.ContainsKey("Description")) { $PackageMeta.Description } else { $PackageName }
    $AppCustomInstallDir = if ($PackageMeta.ContainsKey("AppCustomInstallDir")) { $PackageMeta.AppCustomInstallDir } else { "" }
    $FORCE_TO_INSTALL_DIR = if ($PackageMeta.ContainsKey("ForceToInstallDir")) { $PackageMeta.ForceToInstallDir } else { $false }
    $INCLUDE_SYSTEM_PATHS = if ($PackageMeta.ContainsKey("IncludeSystemPaths")) { $PackageMeta.IncludeSystemPaths } else { $true }
    $VERIFY_SUFFIX = if ($PackageMeta.ContainsKey("VerifySuffix")) { $PackageMeta.VerifySuffix } else { "" }

    # Handle DesktopCategory - support both string and array, empty string means create directly on desktop
    $DESKTOP_CATEGORIES = @()
    if ($PackageMeta.ContainsKey("DesktopCategory") -and $PackageMeta.DesktopCategory) {
        if ($PackageMeta.DesktopCategory -is [array]) {
            $DESKTOP_CATEGORIES = $PackageMeta.DesktopCategory
        }
        else {
            $DESKTOP_CATEGORIES = @($PackageMeta.DesktopCategory)
        }
    }

    return @{
        EXEC_NAME = $EXEC_NAME
        NAME = $NAME
        REGISTRY_SEARCH_KEYWORD = $REGISTRY_SEARCH_KEYWORD
        ADDITIONAL_KEYWORDS = $ADDITIONAL_KEYWORDS
        DESCRIPTION = $DESCRIPTION
        AppCustomInstallDir = $AppCustomInstallDir
        FORCE_TO_INSTALL_DIR = $FORCE_TO_INSTALL_DIR
        INCLUDE_SYSTEM_PATHS = $INCLUDE_SYSTEM_PATHS
        VERIFY_SUFFIX = $VERIFY_SUFFIX
        DESKTOP_CATEGORIES = $DESKTOP_CATEGORIES
    }
}

# Function to resolve installation directory with custom directory support
function Get-ResolvedInstallDirectory {
    param(
        [string]$BaseDir,
        [string]$Name,
        [string]$AppCustomInstallDir,
        [ref]$ForceToInstallDirRef
    )

    $InstallDir = Join-Path $BaseDir $Name

    if (-not [string]::IsNullOrEmpty($AppCustomInstallDir)) {
        Write-Host "$SCRIPT_INDEX AppCustomInstallDir is specified, using custom install directory: $AppCustomInstallDir" -ForegroundColor Cyan
        $InstallDir = $AppCustomInstallDir
        # Only disable ForceToInstallDir if it was originally false
        # If it was true, keep it true to force installation to custom directory
        if (-not $ForceToInstallDirRef.Value) {
            Write-Host "$SCRIPT_INDEX ForceToInstallDir remains: $($ForceToInstallDirRef.Value)" -ForegroundColor Yellow
        }
    }

    return $InstallDir
}

# Function to handle standard package manager installations
function Invoke-StandardPackageInstallation {
    param(
        [string]$InstallType,
        [string]$PackageId,
        [string]$ExecName,
        [array]$AdditionalKeywords,
        [string]$Description,
        [string]$PackageName = "",
        [hashtable]$PackageMeta = @{}
    )

    # Handle npm special case - check for NpmPackageName field
    if ($InstallType -eq "npm") {
        $resolvedPackageName = $PackageId
        if ($PackageMeta.ContainsKey("NpmPackageName") -and -not [string]::IsNullOrEmpty($PackageMeta.NpmPackageName)) {
            $resolvedPackageName = $PackageMeta.NpmPackageName
            Write-Host "$SCRIPT_INDEX Using NpmPackageName: $resolvedPackageName" -ForegroundColor Cyan
        }
        elseif ([string]::IsNullOrEmpty($PackageId) -and -not [string]::IsNullOrEmpty($PackageName)) {
            $resolvedPackageName = $PackageName
            Write-Host "$SCRIPT_INDEX Using PackageName as NPM package: $resolvedPackageName" -ForegroundColor Cyan
        }

        # Validate that we have a valid package name
        if ([string]::IsNullOrEmpty($resolvedPackageName)) {
            Write-Host "$SCRIPT_INDEX Error: No valid NPM package name found (checked: PackageId, NpmPackageName, PackageName)" -ForegroundColor Red
            Write-Host "$SCRIPT_INDEX PackageId: '$PackageId', NpmPackageName: '$($PackageMeta.NpmPackageName)', PackageName: '$PackageName'" -ForegroundColor Yellow
            return $null
        }

        $PackageId = $resolvedPackageName
    }

    Write-Host "$SCRIPT_INDEX $InstallType Package Name: $PackageId" -ForegroundColor Cyan

    # Add type-specific notes
    switch ($InstallType) {
        "npm" { Write-Host "$SCRIPT_INDEX Note: PNPM (modern Node.js package manager) installs packages globally or locally" -ForegroundColor Yellow }
        "pip" { Write-Host "$SCRIPT_INDEX Note: PIP installs to Python environment, no custom install directory" -ForegroundColor Yellow }
        "pipx" { Write-Host "$SCRIPT_INDEX Note: PIPX installs isolated Python applications" -ForegroundColor Yellow }
        "uv" { Write-Host "$SCRIPT_INDEX Note: UV provides fast Python package management" -ForegroundColor Yellow }
        "uvx" { Write-Host "$SCRIPT_INDEX Note: UVX provides isolated tool execution" -ForegroundColor Yellow }
        "poetry" { Write-Host "$SCRIPT_INDEX Note: Poetry manages Python dependencies and virtual environments" -ForegroundColor Yellow }
        "choco" { Write-Host "$SCRIPT_INDEX Note: Chocolatey may not support custom install directories for all packages" -ForegroundColor Yellow }
        "scoop" { Write-Host "$SCRIPT_INDEX Note: Scoop installs command-line applications in isolated environments" -ForegroundColor Yellow }
        "cargo" { Write-Host "$SCRIPT_INDEX Note: Cargo installs Rust crates and binaries" -ForegroundColor Yellow }
        "go" { Write-Host "$SCRIPT_INDEX Note: Go install downloads and installs Go packages and commands" -ForegroundColor Yellow }
        "gem" { Write-Host "$SCRIPT_INDEX Note: Gem installs Ruby libraries and applications" -ForegroundColor Yellow }
        "brew" { Write-Host "$SCRIPT_INDEX Note: Homebrew package manager (if available on Windows via WSL/Linux)" -ForegroundColor Yellow }
    }

    $executable = Install-SinglePackageViaManager -InstallType $InstallType -PackageName $PackageId -Keyword $ExecName -AdditionalKeywords $AdditionalKeywords -ForceInstall $false
    return $executable
}

# Function to install a single base package
function Install-BasePackage {
    param(
        [string]$PackageName,
        [hashtable]$PackageMeta,
        [ValidateSet("BaseDir", "AppDir", "ProjectDir", "McpDir")]
        [string]$BaseDirectory = "BaseDir",
        [hashtable]$SubInstallMethod = $null
    )

    # DEBUG: Log package installation attempt
    Write-DebugLog -Message "Install-BasePackage called for: $PackageName" -Category "STEP12" -Color "Cyan" -LocalDebug $LocalDebugMode
    Write-DebugLog -Message "PackageMeta keys: $($PackageMeta.Keys -join ', ')" -Category "STEP12" -Color "Cyan" -LocalDebug $LocalDebugMode
    Write-DebugLog -Message "SubInstallMethod: $(if ($null -eq $SubInstallMethod) { 'NULL' } else { 'PROVIDED' })" -Category "STEP12" -Color "Cyan" -LocalDebug $LocalDebugMode

    # Validate package ID and install type at the beginning
    $validationResult = Get-ValidatedPackageId -PackageMeta $PackageMeta -SubInstallMethod $SubInstallMethod
    if (-not $validationResult) {
        Write-DebugLog -Message "Validation failed for package: $PackageName" -Category "STEP12" -Color "Red" -LocalDebug $LocalDebugMode
        return $null
    }

    # Note: Package filter check is now done in Install-PackageManager to avoid redundant combo method attempts

    # Get common package parameters
    $packageParams = Get-PackageParameters -PackageName $PackageName -PackageMeta $PackageMeta -SubInstallMethod $SubInstallMethod

    # Use validated package ID and install type
    $PACKAGE_ID = $validationResult.PackageId
    $InstallType = $validationResult.InstallType

    # Extract parameters from packageParams
    $EXEC_NAME = $packageParams.EXEC_NAME
    $NAME = $packageParams.NAME
    $REGISTRY_SEARCH_KEYWORD = $packageParams.REGISTRY_SEARCH_KEYWORD
    $ADDITIONAL_KEYWORDS = $packageParams.ADDITIONAL_KEYWORDS
    $DESCRIPTION = $packageParams.DESCRIPTION
    $AppCustomInstallDir = $packageParams.AppCustomInstallDir
    $FORCE_TO_INSTALL_DIR = $packageParams.FORCE_TO_INSTALL_DIR
    $INCLUDE_SYSTEM_PATHS = $packageParams.INCLUDE_SYSTEM_PATHS
    $VERIFY_SUFFIX = $packageParams.VERIFY_SUFFIX
    $DESKTOP_CATEGORIES = $packageParams.DESKTOP_CATEGORIES

    Write-DebugLog -Message "AdditionalKeywords: $($ADDITIONAL_KEYWORDS -join ', ')" -Category "STEP12" -Color "Magenta" -LocalDebug $LocalDebugMode
    
    # InstallType is already determined from validation result
    if ($SubInstallMethod -and $SubInstallMethod.ContainsKey("InstallType")) {
        Write-Host "$SCRIPT_INDEX Using sub-installation type: $($SubInstallMethod.InstallType)" -ForegroundColor Cyan
    }
    
    # Determine base directory based on parameter
    $baseDir = switch ($BaseDirectory) {
        "BaseDir" { $Global:LANG_COMPILER_DIR }
        "AppDir" { $Global:APP_INSTALL_DIR }
        "ProjectDir" { $Global:PROJECT_ROOT_DIR }
        "McpDir" { $Global:MCP_DEPLOY_DIR }
        default { $Global:LANG_COMPILER_DIR }
    }

    # Initialize variables
    $executable = $null
    $installed = $false
    $InstallDir = ""
    
    Write-Host "$SCRIPT_INDEX Installing $DESCRIPTION (Name: $NAME)" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Package ID: $PACKAGE_ID" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Install Type: $InstallType" -ForegroundColor Cyan
    
    # Handle different installation types
    switch ($InstallType) {
        "winget" {
            $InstallDir = Get-ResolvedInstallDirectory -BaseDir $baseDir -Name $NAME -AppCustomInstallDir $AppCustomInstallDir -ForceToInstallDirRef ([ref]$FORCE_TO_INSTALL_DIR)
            Write-Host "$SCRIPT_INDEX Base Directory: $BaseDirectory ($baseDir)" -ForegroundColor Cyan
            Write-Host "$SCRIPT_INDEX Install Dir: $InstallDir" -ForegroundColor Cyan
            Write-Host "$SCRIPT_INDEX ForceToInstallDir: $FORCE_TO_INSTALL_DIR" -ForegroundColor Cyan
            # Check if already installed using binary presence (idempotent, fast path)
            $executable = Invoke-WingetCommand -IncludeSystemPaths $INCLUDE_SYSTEM_PATHS -Id $PACKAGE_ID -InstallDir $InstallDir -OnlyCheckFlag $false -Keyword $EXEC_NAME -AdditionalKeywords $ADDITIONAL_KEYWORDS -ForceToInstallDir $FORCE_TO_INSTALL_DIR -RegistrySearchKeyword $REGISTRY_SEARCH_KEYWORD
        }
        "powershell" {
            $PowerShellCommand = if ($PackageMeta.ContainsKey("PowerShellCommand")) { $PackageMeta.PowerShellCommand } else { "" }
            $executable = Invoke-PowerShellCommand -PackageName $PackageName -Keyword $EXEC_NAME -AdditionalKeywords $ADDITIONAL_KEYWORDS -ForceInstall $false -PowerShellCommand $PowerShellCommand
            $installed = $null -ne $executable
        }
        { $_ -in @("npm", "pip", "pipx", "uv", "uvx", "poetry", "choco", "scoop", "cargo", "go", "gem", "brew") } {
            $executable = Invoke-StandardPackageInstallation -InstallType $InstallType -PackageId $PACKAGE_ID -ExecName $EXEC_NAME -AdditionalKeywords $ADDITIONAL_KEYWORDS -Description $DESCRIPTION -PackageName $PackageName -PackageMeta $PackageMeta
            $installed = $null -ne $executable
        }
        "web" {
            # Web download installation - use PackageId as DownloadUrl
            $DownloadUrl = $PACKAGE_ID

            $ExecutableName = if ($SubInstallMethod -and $SubInstallMethod.ContainsKey("ExecutableName")) {
                $SubInstallMethod.ExecutableName
            } elseif ($PackageMeta.ContainsKey("ExecutableName")) {
                $PackageMeta.ExecutableName
            } else {
                $EXEC_NAME
            }

            # Set installation directory for web downloads
            $InstallDir = Get-ResolvedInstallDirectory -BaseDir $baseDir -Name $NAME -AppCustomInstallDir $AppCustomInstallDir -ForceToInstallDirRef ([ref]$FORCE_TO_INSTALL_DIR)
            Write-Host "$SCRIPT_INDEX Base Directory: $BaseDirectory ($baseDir)" -ForegroundColor Cyan
            Write-Host "$SCRIPT_INDEX Install Dir: $InstallDir" -ForegroundColor Cyan
            Write-Host "$SCRIPT_INDEX ForceToInstallDir: $FORCE_TO_INSTALL_DIR" -ForegroundColor Cyan
            
            Write-Host "$SCRIPT_INDEX Web download installation for $PackageName" -ForegroundColor Cyan
            Write-Host "$SCRIPT_INDEX Download URL: $DownloadUrl" -ForegroundColor Cyan
            Write-Host "$SCRIPT_INDEX Executable Name: $ExecutableName" -ForegroundColor Cyan
            
            # Get archive parameters if specified - prioritize SubInstallMethod
            $IsArchive = if ($SubInstallMethod -and $SubInstallMethod.ContainsKey("IsArchive")) {
                $SubInstallMethod.IsArchive
            } elseif ($PackageMeta.ContainsKey("IsArchive")) {
                $PackageMeta.IsArchive
            } else {
                $false
            }
            
            $ArchiveType = if ($SubInstallMethod -and $SubInstallMethod.ContainsKey("ArchiveType")) {
                $SubInstallMethod.ArchiveType
            } elseif ($PackageMeta.ContainsKey("ArchiveType")) {
                $PackageMeta.ArchiveType
            } else {
                "zip"
            }
            
            $executable = Invoke-WebDownloadCommand -PackageName $PackageName -InstallDir $InstallDir -DownloadUrl $DownloadUrl -ExecutableName $ExecutableName -Keyword $EXEC_NAME -AdditionalKeywords @($PackageName.ToLower()) -OnlyCheckFlag $false -ForceInstall $false -IsArchive $IsArchive -ArchiveType $ArchiveType
            $installed = $null -ne $executable
        }
        "postscript" {
            $InstallScript = if ($PackageMeta.ContainsKey("InstallScript")) { $PackageMeta.InstallScript } else { "" }
            if ([string]::IsNullOrWhiteSpace($InstallScript)) {
                Write-Host "$SCRIPT_INDEX Error: postscript InstallType requires InstallScript in PackageMeta for $PackageName" -ForegroundColor Red
                $installed = $false
            } else {
                $postinstallDir = Join-Path $PSScriptRoot "postinstall"
                $scriptPath = Join-Path $postinstallDir $InstallScript
                if (-not (Test-Path $scriptPath)) {
                    Write-Host "$SCRIPT_INDEX Error: Install script not found: $scriptPath" -ForegroundColor Red
                    $installed = $false
                } else {
                    Write-Host "$SCRIPT_INDEX Running postscript installer: $InstallScript" -ForegroundColor Cyan
                    & $scriptPath
                    $installed = $?
                    if (-not $installed) {
                        Write-Host "$SCRIPT_INDEX Postscript installer reported failure" -ForegroundColor Red
                    }
                    if ($installed -and $EXEC_NAME) {
                        $searchPaths = @()
                        if ($PackageMeta.ContainsKey("InstallSearchPaths") -and $PackageMeta.InstallSearchPaths) {
                            $searchPaths = $PackageMeta.InstallSearchPaths | Where-Object { $_ -and (Test-Path $_ -ErrorAction SilentlyContinue) }
                        }
                        $executable = Find-ExecutableByKeyword -Keywords $EXEC_NAME -AdditionalKeywords $ADDITIONAL_KEYWORDS -AdditionalScanPaths $searchPaths -IncludeSystemPaths $true -Recursive $true
                    }
                }
            }
        }
        default {
            Write-Host "$SCRIPT_INDEX Unknown installation type '$InstallType' for $PackageName" -ForegroundColor Red
            Write-Host "$SCRIPT_INDEX Supported types: winget, npm, pip, pipx, uv, uvx, poetry, choco, scoop, cargo, go, gem, brew, web, postscript" -ForegroundColor Yellow
            $installed = $false
        }
    }
    
    # Post verification - binary presence (idempotent verification)
    if ($executable) {
        Write-Host "$SCRIPT_INDEX Found $PackageName executable at: $executable" -ForegroundColor Green
        if ($executable -is [array]) { $executable = $executable[0]; Write-Host "$SCRIPT_INDEX Converted array to first item: $executable" -ForegroundColor Yellow }
        
        # Test the installation using VerifySuffix if provided
        if ($VERIFY_SUFFIX) {
            Write-Host "$SCRIPT_INDEX Verifying installation with: '$executable $VERIFY_SUFFIX'" -ForegroundColor Cyan
            try {
                $verifyResult = & $executable $VERIFY_SUFFIX 2>&1 | Select-Object -First 1
                Write-Host "$SCRIPT_INDEX $PackageName verification result: $verifyResult" -ForegroundColor Green
            }
            catch {
                Write-Host "$SCRIPT_INDEX Warning: Could not verify $PackageName installation" -ForegroundColor Yellow
            }
        }
        else {
            Write-Host "$SCRIPT_INDEX No verification suffix specified for $PackageName" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "$SCRIPT_INDEX Warning: Could not locate $EXEC_NAME in PATH or known install directories" -ForegroundColor Yellow
        if (-not $installed) {
            Write-Host "$SCRIPT_INDEX Installation may have failed. You can try manual installation:" -ForegroundColor Yellow

            # Provide appropriate manual installation suggestions based on InstallType
            switch ($InstallType.ToLower()) {
                "npm" {
                    Write-Host "$SCRIPT_INDEX   npm install -g $PACKAGE_ID" -ForegroundColor Yellow
                    Write-Host "$SCRIPT_INDEX   yarn global add $PACKAGE_ID" -ForegroundColor Yellow
                }
                "pipx" {
                    Write-Host "$SCRIPT_INDEX   pipx install $PACKAGE_ID" -ForegroundColor Yellow
                    Write-Host "$SCRIPT_INDEX   pip install --user $PACKAGE_ID" -ForegroundColor Yellow
                }
                "uvx" {
                    Write-Host "$SCRIPT_INDEX   uvx install $PACKAGE_ID" -ForegroundColor Yellow
                    Write-Host "$SCRIPT_INDEX   uv tool install $PACKAGE_ID" -ForegroundColor Yellow
                }
                default {
                    Write-Host "$SCRIPT_INDEX   winget install $PACKAGE_ID" -ForegroundColor Yellow
                    Write-Host "$SCRIPT_INDEX   choco install $PACKAGE_ID" -ForegroundColor Yellow
                }
            }
        }
    }

    # Handle desktop shortcuts if defined
    $shortcuts = $null
    if ($PackageMeta.ContainsKey("DesktopShortcuts")) {
        $shortcuts = $PackageMeta.DesktopShortcuts
    }

    # Create shortcuts only if the value is a non-empty array
    if ($null -ne $shortcuts -and $shortcuts -is [array] -and $shortcuts.Count -gt 0 -and $executable) {
        Write-Host "$SCRIPT_INDEX Creating desktop shortcuts for $PackageName..." -ForegroundColor Cyan
        foreach ($shortcutConfig in $shortcuts) {
            # Extract shortcut parameters
            $shortcutName = if ($shortcutConfig.ContainsKey("Name") -and $shortcutConfig.Name) { 
                $shortcutConfig.Name 
            }
            else {
                $NAME
            }
            
            $iconPath = if ($shortcutConfig.ContainsKey("IconPath") -and $shortcutConfig.IconPath) { 
                $shortcutConfig.IconPath 
            }
            else { 
                $executable 
            }
            
            $scanKeywords = if ($shortcutConfig.ContainsKey("Keyword") -and $shortcutConfig.Keyword) { 
                @($shortcutConfig.Keyword) 
            }
            else {
                $ADDITIONAL_KEYWORDS
            }
            
            # Debug scanKeywords
            Write-DebugLog -Message "scanKeywords: $($scanKeywords -join ', ')" -Category "STEP12" -Color "Magenta" -LocalDebug $LocalDebugMode
            Write-Host "$SCRIPT_INDEX Shortcut Name: $shortcutName" -ForegroundColor Cyan
            Write-Host "$SCRIPT_INDEX Exe Path: $executable" -ForegroundColor Cyan
            # Write-Host "$SCRIPT_INDEX Icon Path: $iconPath" -ForegroundColor Cyan
            Write-Host "$SCRIPT_INDEX Category Names: $($DESKTOP_CATEGORIES -join ', ')" -ForegroundColor Cyan
            Write-Host "$SCRIPT_INDEX Scan Keywords: $scanKeywords" -ForegroundColor Cyan
            
            # Debug: Show detailed parameter information
            Write-DebugLog -Message "Parameter details:" -Category "STEP12" -Color "Magenta" -LocalDebug $LocalDebugMode
            Write-Host "$SCRIPT_INDEX   - ShortcutName type: $($(if ($shortcutName) { $shortcutName.GetType().Name } else { 'null' })), value: '$shortcutName'" -ForegroundColor Magenta
            Write-Host "$SCRIPT_INDEX   - ExePath type: $($(if ($executable) { $executable.GetType().Name } else { 'null' })), value: '$executable'" -ForegroundColor Magenta
            # Write-Host "$SCRIPT_INDEX   - IconPath type: $($(if ($iconPath) { $iconPath.GetType().Name } else { 'null' })), value: '$iconPath'" -ForegroundColor Magenta
            Write-Host "$SCRIPT_INDEX   - CategoryNames type: $($(if ($DESKTOP_CATEGORIES) { $DESKTOP_CATEGORIES.GetType().Name } else { 'null' })), count: $($(if ($DESKTOP_CATEGORIES) { $DESKTOP_CATEGORIES.Count } else { 0 }))" -ForegroundColor Magenta
            Write-Host "$SCRIPT_INDEX   - ScanKeywords type: $($(if ($scanKeywords) { $scanKeywords.GetType().Name } else { 'null' }))" -ForegroundColor Magenta
            
            # Ensure scanKeywords is an array
            if ($scanKeywords -is [string]) {
                Write-DebugLog -Message "Converting scanKeywords from string to array" -Category "STEP12" -Color "Magenta" -LocalDebug $LocalDebugMode
                $scanKeywords = @($scanKeywords)
            }
            elseif ($scanKeywords -is [array]) {
                Write-DebugLog -Message "scanKeywords is already an array" -Category "STEP12" -Color "Magenta" -LocalDebug $LocalDebugMode
            }
            else {
                Write-DebugLog -Message "scanKeywords is neither string nor array, converting to empty array" -Category "STEP12" -Color "Magenta" -LocalDebug $LocalDebugMode
                $scanKeywords = @()
            }
            
            Write-Host "$SCRIPT_INDEX   - ScanKeywords count: $($(if ($scanKeywords) { $scanKeywords.Count } else { 0 }))" -ForegroundColor Magenta
            if ($scanKeywords -and $scanKeywords.Count -gt 0) {
                for ($i = 0; $i -lt $scanKeywords.Count; $i++) {
                    $keyword = $scanKeywords[$i]
                    Write-Host "$SCRIPT_INDEX     - ScanKeywords[$i]: type=$($(if ($keyword) { $keyword.GetType().Name } else { 'null' })), value='$keyword'" -ForegroundColor Magenta
                }
            }
            
            # Validate parameters before calling Create-DesktopShortcutsForPackage
            $validationErrors = @()
            
            if (-not $shortcutName -or $shortcutName -eq "") {
                $validationErrors += "ShortcutName is empty"
            }
            
            if (-not $executable -or $executable -eq "") {
                $validationErrors += "ExePath is empty"
            }
            
            if (-not $iconPath -or $iconPath -eq "") {
                $validationErrors += "IconPath is empty"
            }
            
            if (-not $DESKTOP_CATEGORIES -or $DESKTOP_CATEGORIES.Count -eq 0) {
                $validationErrors += "CategoryName is empty"
            }
            
            # Check if desktop path is accessible
            $desktopPath = [Environment]::GetFolderPath('Desktop')
            if (-not $desktopPath -or $desktopPath -eq "" -or -not (Test-Path $desktopPath)) {
                $validationErrors += "Desktop path is not accessible: $desktopPath"
            }
            
            # Check if LANG_COMPILER_DIR is set
            if (-not $Global:LANG_COMPILER_DIR -or $Global:LANG_COMPILER_DIR -eq "") {
                $validationErrors += "LANG_COMPILER_DIR is not set"
            }
            
            # Check scanKeywords for empty strings or problematic values
            if ($scanKeywords -and $scanKeywords.Count -gt 0) {
                $validKeywords = @()
                foreach ($keyword in $scanKeywords) {
                    if ($keyword -and $keyword -ne "" -and $null -ne $keyword) {
                        $validKeywords += $keyword
                    }
                    else {
                        Write-Host "$SCRIPT_INDEX [WARNING] Found empty or null keyword in scanKeywords, skipping" -ForegroundColor Yellow
                    }
                }
                if ($validKeywords.Count -eq 0) {
                    $validationErrors += "All scanKeywords are empty or null"
                }
                else {
                    $scanKeywords = $validKeywords
                    Write-DebugLog -Message "Filtered scanKeywords: $($scanKeywords -join ', ')" -Category "STEP12" -Color "Magenta" -LocalDebug $LocalDebugMode
                }
            }
            else {
                Write-Host "$SCRIPT_INDEX [WARNING] scanKeywords is empty or null, will use empty array" -ForegroundColor Yellow
                $scanKeywords = @()
            }
            
            if ($validationErrors.Count -gt 0) {
                Write-Host "$SCRIPT_INDEX [ERROR] Parameter validation failed for desktop shortcut creation:" -ForegroundColor Red
                foreach ($validationError in $validationErrors) {
                    Write-Host "$SCRIPT_INDEX   - $validationError" -ForegroundColor Red
                }
                Write-Host "$SCRIPT_INDEX Skipping desktop shortcut creation for $PackageName" -ForegroundColor Yellow
                continue
            }
            
            # Create desktop shortcuts for each category
            if ($DESKTOP_CATEGORIES -and $DESKTOP_CATEGORIES.Count -gt 0) {
                foreach ($category in $DESKTOP_CATEGORIES) {
                    if ($category -and $category -ne "") {
                        # Track desktop category
                        if ($script:InstalledDesktopCategories -notcontains $category) {
                            $script:InstalledDesktopCategories += $category
                        }

                        # Debug: Print all parameters passed to Create-DesktopShortcutsForPackage
                        Write-Host "$SCRIPT_INDEX [DEBUG] Create-DesktopShortcutsForPackage Parameters:" -ForegroundColor Magenta
                        Write-Host "$SCRIPT_INDEX   - ShortcutName: '$shortcutName' (Type: $(if ($shortcutName) { $shortcutName.GetType().Name } else { 'null' }))" -ForegroundColor Magenta
                        Write-Host "$SCRIPT_INDEX   - ExePath: '$executable' (Type: $(if ($executable) { $executable.GetType().Name } else { 'null' }))" -ForegroundColor Magenta
                        Write-Host "$SCRIPT_INDEX   - IconPath: '$iconPath' (Type: $(if ($iconPath) { $iconPath.GetType().Name } else { 'null' }))" -ForegroundColor Magenta
                        Write-Host "$SCRIPT_INDEX   - CategoryName: '$category' (Type: $(if ($category) { $category.GetType().Name } else { 'null' }))" -ForegroundColor Magenta
                        Write-Host "$SCRIPT_INDEX   - ScanKeywords: '$($scanKeywords -join ', ')' (Type: $(if ($scanKeywords) { $scanKeywords.GetType().Name } else { 'null' }), Count: $(if ($scanKeywords) { $scanKeywords.Count } else { 0 }))" -ForegroundColor Magenta

                        Create-DesktopShortcutsForPackage -ShortcutName $shortcutName -ExePath $executable -IconPath $iconPath -CategoryName $category -ScanKeywords $scanKeywords
                    }
                    else {
                        Write-Host "$SCRIPT_INDEX [WARNING] Skipping empty category name" -ForegroundColor Yellow
                    }
                }
            }
            else {
                Write-Host "$SCRIPT_INDEX [WARNING] No desktop categories available for $PackageName" -ForegroundColor Yellow
            }
        }
    }
    elseif ($PackageMeta.ContainsKey("DesktopShortcuts") -and $PackageMeta.DesktopShortcuts -and -not $executable) {
        Write-Host "$SCRIPT_INDEX Skipping desktop shortcuts for $PackageName - executable not found" -ForegroundColor Yellow
    }
    
    # Handle context menu if MenuName is defined
    if ($PackageMeta.ContainsKey("MenuName") -and $PackageMeta.MenuName -and $executable) {
        Write-Host "$SCRIPT_INDEX Context menu configuration found for $PackageName" -ForegroundColor Cyan
        Write-Host "$SCRIPT_INDEX Menu Name: $($PackageMeta.MenuName)" -ForegroundColor Cyan
        Write-Host "$SCRIPT_INDEX TODO: Context menu creation functionality not yet implemented" -ForegroundColor Yellow
        Write-Host "$SCRIPT_INDEX Would create context menu: '$($PackageMeta.MenuName)' for executable: $executable" -ForegroundColor Yellow
    }
    elseif ($PackageMeta.ContainsKey("MenuName") -and $PackageMeta.MenuName -and -not $executable) {
        Write-Host "$SCRIPT_INDEX Skipping context menu for $PackageName - executable not found" -ForegroundColor Yellow
    }
    
    # Handle AdditionalInstallationPackages if defined
    Install-AdditionalPackages -PackageName $PackageName -PackageMeta $PackageMeta
    
    # Handle PostInstallCallbacks if defined and executable is available
    if ($executable) {
        # Determine install directory for callbacks
        $callbackInstallDir = if ($InstallType -eq "web") {
            # For web installations, check if it's an archive
            $isWebArchive = if ($PackageMeta.ContainsKey("IsArchive")) { $PackageMeta.IsArchive } else { $false }
            if ($isWebArchive) {
                $InstallDir
            } else {
                Split-Path $executable -Parent
            }
        }
        else {
            # For other types, use the executable's parent directory
            Split-Path $executable -Parent
        }
        
        Invoke-PostInstallCallbacks -PackageName $PackageName -PackageMeta $PackageMeta -ExecutablePath $executable -InstallDir $callbackInstallDir -LogPrefix $SCRIPT_INDEX
    }
    elseif ($PackageMeta.ContainsKey("PostInstallCallbacks") -and $PackageMeta.PostInstallCallbacks) {
        Write-Host "$SCRIPT_INDEX Skipping PostInstallCallbacks for $PackageName - executable not found" -ForegroundColor Yellow
    }

    # Handle environment variables if defined (moved after AdditionalInstallationPackages and PostInstallCallbacks)
    if ($PackageMeta.ContainsKey("EnvVars") -and $PackageMeta.EnvVars) {
        Write-Host "$SCRIPT_INDEX Setting environment variables for $PackageName..." -ForegroundColor Cyan

        # Debug: Show parameters before calling Set-MultipleEnvironmentVariablesForPackage
        Write-DebugLog -Message "About to call Set-MultipleEnvironmentVariablesForPackage" -Category "STEP12" -Color "Magenta"
        Write-DebugLog -Message "PackageName: '$PackageName'" -Category "STEP12" -Color "Magenta"
        Write-DebugLog -Message "PackageName type: $($(if ($PackageName) { $PackageName.GetType().Name } else { 'null' }))" -Category "STEP12" -Color "Magenta"
        # Write-DebugLog -Message "EnvVars: $($PackageMeta.EnvVars | ConvertTo-Json -Depth 2)" -Category "STEP12" -Color "Magenta"
        # Write-DebugLog -Message "EnvVars type: $($(if ($PackageMeta.EnvVars) { $PackageMeta.EnvVars.GetType().Name } else { 'null' }))" -Category "STEP12" -Color "Magenta"
        Write-DebugLog -Message "executable: '$executable'" -Category "STEP12" -Color "Magenta"
        Write-DebugLog -Message "executable type: $($(if ($executable) { $executable.GetType().Name } else { 'null' }))" -Category "STEP12" -Color "Magenta"
        Write-DebugLog -Message "executable value: $($(if ($executable) { $executable | ConvertTo-Json -Depth 3 } else { 'null' }))" -Category "STEP12" -Color "Magenta"
        Write-DebugLog -Message "EXEC_NAME: '$EXEC_NAME'" -Category "STEP12" -Color "Magenta"
        Write-DebugLog -Message "EXEC_NAME type: $($(if ($EXEC_NAME) { $EXEC_NAME.GetType().Name } else { 'null' }))" -Category "STEP12" -Color "Magenta"

        # Only proceed if executable is not null
        if ($executable) {
            Set-MultipleEnvironmentVariablesForPackage -Id $PackageName -EnvVars $PackageMeta.EnvVars -ExecutablePath $executable -DefaultExec $EXEC_NAME
        }
        else {
            Write-Host "$SCRIPT_INDEX Warning: Cannot set environment variables for $PackageName - executable path is null" -ForegroundColor Yellow
        }
    }

    # Perform intelligent desktop cleanup and shortcut organization
    if ($executable -and (Test-Path $executable)) {
        Write-Host "$SCRIPT_INDEX Performing desktop cleanup for: $PackageName" -ForegroundColor Cyan

        # Extract scan keywords from package metadata
        $scanKeywords = @()
        if ($PackageMeta.ContainsKey("ScanKeywords")) {
            $scanKeywords = $PackageMeta.ScanKeywords
        }
        elseif ($PackageMeta.ContainsKey("AdditionalKeywords")) {
            $scanKeywords = $PackageMeta.AdditionalKeywords
        }
        else {
            # Generate default keywords from package name
            $scanKeywords = @($PackageName.ToLower(), $EXEC_NAME.ToLower())
        }

        # Determine if shortcut should be created based on the content of DesktopShortcuts
        $createShortcut = $false # Default to not creating a shortcut
        if ($PackageMeta.ContainsKey("DesktopShortcuts")) {
            $shortcutsValue = $PackageMeta.DesktopShortcuts
            if ($null -ne $shortcutsValue -and $shortcutsValue -is [array] -and $shortcutsValue.Count -gt 0) {
                $createShortcut = $true
            }
        }

        # Get category from package metadata
        $categoryName = ""
        if ($PackageMeta.ContainsKey("DesktopCategory")) {
            $categoryName = $PackageMeta.DesktopCategory
            # Track installed desktop categories for final organization
            if (-not [string]::IsNullOrEmpty($categoryName) -and $script:InstalledDesktopCategories -notcontains $categoryName) {
                $script:InstalledDesktopCategories += $categoryName
            }
        }

        try {
            $cleanupResult = Invoke-DesktopCleanupForPackage -PackageName $PackageName -ExecutablePath $executable -ScanKeywords $scanKeywords -CategoryName $categoryName -CreateShortcut $createShortcut

            # Check if cleanup was actually performed (returns null if disabled)
            if ($null -eq $cleanupResult) {
                Write-Host "$SCRIPT_INDEX Desktop cleanup is disabled for $PackageName" -ForegroundColor Gray
            }
            elseif ($cleanupResult.Errors.Count -eq 0) {
                Write-Host "$SCRIPT_INDEX Desktop cleanup successful for $PackageName (Found: $($cleanupResult.ShortcutsFound), Created: $($cleanupResult.ShortcutsCreated))" -ForegroundColor Green
            }
            else {
                Write-Host "$SCRIPT_INDEX Desktop cleanup completed with warnings for $PackageName" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "$SCRIPT_INDEX Desktop cleanup failed for ${PackageName}: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    else {
        Write-Host "$SCRIPT_INDEX Skipping desktop cleanup for $PackageName (no executable found)" -ForegroundColor Yellow
    }

    # Note: Final desktop organization is now performed once after all packages are installed
    # to avoid redundant executions (moved to main script after all installation loops)

    Write-Host "$SCRIPT_INDEX $PackageName installation completed." -ForegroundColor Green
    Write-Host ""

    # Return the executable path for combo installation detection
    return $executable
}

# Main execution starts here

# Install Windows 10 Essential Patches (Priority installation for Windows 10 ONLY)
if (Test-PackageGroupFilter -GroupName "Windows10EssentialPatches") {
    Write-Host "$SCRIPT_INDEX Installing Windows 10 Essential Patches from GlobalVars.ps1" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Windows 10 Essential Patches: $($Global:WINDOWS_10_ESSENTIAL_PATCHES.Keys -join ', ')" -ForegroundColor Cyan
    
    # Check if this is Windows 10 system (Windows 11 already has these components built-in)
    if ($Global:isWin10) {
        Write-Host "$SCRIPT_INDEX Detected Windows 10 system - Installing essential patches for feature parity with Windows 11" -ForegroundColor Yellow
        
        # Iterate through all Windows 10 essential patches
        foreach ($packageName in $Global:WINDOWS_10_ESSENTIAL_PATCHES.Keys) {
            $packageMeta = $Global:WINDOWS_10_ESSENTIAL_PATCHES[$packageName]
            Write-Host "$SCRIPT_INDEX [WIN10_PATCH] Installing essential component: $packageName" -ForegroundColor Magenta
            Install-PackageManager -PackageName $packageName -PackageMeta $packageMeta -BaseDirectory "BaseDir"
        }
        
        Write-Host "$SCRIPT_INDEX Windows 10 Essential Patches installation completed" -ForegroundColor Green
    }
    elseif ($Global:isWin11) {
        Write-Host "$SCRIPT_INDEX Skipping Windows 10 Essential Patches - Windows 11 already has these components built-in" -ForegroundColor Green
    }
    else {
        Write-Host "$SCRIPT_INDEX Skipping Windows 10 Essential Patches - not a Windows 10 system" -ForegroundColor Yellow
    }
}

# Install Base Packages
if (Test-PackageGroupFilter -GroupName "BasePackages") {
    Write-Host "$SCRIPT_INDEX Installing all base packages from GlobalVars.ps1" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Base Packages: $($Global:BasePackages.Keys -join ', ')" -ForegroundColor Cyan
    # Iterate through all base packages in GlobalVars.ps1
    foreach ($packageName in $Global:BasePackages.Keys) {
        $packageMeta = $Global:BasePackages[$packageName]
        Install-PackageManager -PackageName $packageName -PackageMeta $packageMeta -BaseDirectory "BaseDir"
    }
}
# Install Applications Packages
if (Test-PackageGroupFilter -GroupName "ApplicationsPackages") {
    Write-Host "$SCRIPT_INDEX Installing all applications packages from GlobalVars.ps1" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Applications Packages: $($Global:APPLICATIONS_PACKAGES.Keys -join ', ')" -ForegroundColor Cyan
    # Iterate through all applications packages in GlobalVars.ps1
    foreach ($packageName in $Global:APPLICATIONS_PACKAGES.Keys) {
        $packageMeta = $Global:APPLICATIONS_PACKAGES[$packageName]
        Install-PackageManager -PackageName $packageName -PackageMeta $packageMeta -BaseDirectory "AppDir"
    }
}
# Install Common Software Packages
if (Test-PackageGroupFilter -GroupName "CommonSoftwarePackages") {
    Write-Host "$SCRIPT_INDEX Installing all common software packages from GlobalVars.ps1" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Common Software Packages: $($Global:COMMON_SOFTWARE_PACKAGES.Keys -join ', ')" -ForegroundColor Cyan
    if ($installType -eq "server") {
        Write-Host "$SCRIPT_INDEX Skipping common software packages installation for server mode" -ForegroundColor Yellow
    }
    else {
        foreach ($packageName in $Global:COMMON_SOFTWARE_PACKAGES.Keys) {
            $packageMeta = $Global:COMMON_SOFTWARE_PACKAGES[$packageName]
            Install-PackageManager -PackageName $packageName -PackageMeta $packageMeta -BaseDirectory "AppDir"
        }
    }
}
# Install MCP Services Packages
if (Test-PackageGroupFilter -GroupName "McpServicesPackages") {
    Write-Host "$SCRIPT_INDEX Installing all MCP services packages from GlobalVars.ps1" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX MCP Services Packages: $($Global:MCP_SERVICES_PACKAGES.Keys -join ', ')" -ForegroundColor Cyan
    foreach ($packageName in $Global:MCP_SERVICES_PACKAGES.Keys) {
        $packageMeta = $Global:MCP_SERVICES_PACKAGES[$packageName]
        Install-PackageManager -PackageName $packageName -PackageMeta $packageMeta -BaseDirectory "McpDir"
    }
}

# Execute post-MCP installation callbacks (Total Callback)
Write-Host "$SCRIPT_INDEX Executing post-MCP installation integration..." -ForegroundColor Cyan
try {
    # Execute Gemini MCP integration
    $mcpConfigPath = Join-Path $Global:PROJECT_DIR "_prompt\mcp.json"
    # Check if mcp.json exists, if not copy from template
    if (-not (Test-Path $mcpConfigPath)) {
        $templatePath = Join-Path $Global:PROJECT_DIR "_prompt\mcpWindowsTemplate.json"
        if (Test-Path $templatePath) {
            Copy-Item $templatePath $mcpConfigPath
            Write-Host "$SCRIPT_INDEX [GEMINI_MCP] Created mcp.json from template" -ForegroundColor Green
        }
        else {
            Write-Host "$SCRIPT_INDEX [GEMINI_MCP] Error: Template file not found: $templatePath" -ForegroundColor Red
        }
    }
    $geminiIntegrationResult = Invoke-GeminiMcpIntegration -McpConfigPath $mcpConfigPath -LogPrefix "$SCRIPT_INDEX [GEMINI_MCP]"

    if ($geminiIntegrationResult) {
        Write-Host "$SCRIPT_INDEX Gemini MCP integration completed successfully" -ForegroundColor Green
    }
    else {
        Write-Host "$SCRIPT_INDEX Gemini MCP integration failed" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "$SCRIPT_INDEX Error during post-MCP integration: $($_.Exception.Message)" -ForegroundColor Red
}
# Install Dev Software Packages
if (Test-PackageGroupFilter -GroupName "DevSoftwarePackages") {
    Write-Host "$SCRIPT_INDEX Installing all dev software packages from GlobalVars.ps1" -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX Dev Software Packages: $($Global:DEV_SOFTWARE_PACKAGES.Keys -join ', ')" -ForegroundColor Cyan
    # Iterate through all dev software packages in GlobalVars.ps1
    foreach ($packageName in $Global:DEV_SOFTWARE_PACKAGES.Keys) {
        $packageMeta = $Global:DEV_SOFTWARE_PACKAGES[$packageName]
        Install-PackageManager -PackageName $packageName -PackageMeta $packageMeta -BaseDirectory "AppDir"
    }
}

Write-Host "$SCRIPT_INDEX All package installations completed." -ForegroundColor Green

# Perform final desktop organization once after all packages are installed
Write-Host "$SCRIPT_INDEX Performing final desktop organization after all installations..." -ForegroundColor Cyan
try {
    $finalOrganization = Invoke-DesktopIconOrganization -ShowSummary $true -ExtractIcons $false

    # Check if organization was actually performed (returns null if disabled)
    if ($null -eq $finalOrganization) {
        Write-Host "$SCRIPT_INDEX Desktop organization is disabled, skipping" -ForegroundColor Gray
    }
    elseif ($finalOrganization.Errors.Count -eq 0) {
        Write-Host "$SCRIPT_INDEX Final desktop organization completed successfully!" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX Summary: Categories: $($finalOrganization.CategoriesProcessed), Moved: $($finalOrganization.ShortcutsMoved), Unmatched: $($finalOrganization.UnmatchedShortcuts)" -ForegroundColor Green
    }
    else {
        Write-Host "$SCRIPT_INDEX Final desktop organization completed with warnings" -ForegroundColor Yellow
        foreach ($err in $finalOrganization.Errors) {
            Write-Host "$SCRIPT_INDEX Warning: $err" -ForegroundColor Yellow
        }
    }
}
catch {
    Write-Host "$SCRIPT_INDEX Final desktop organization failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Install custom scripts and commands
Write-Host "$SCRIPT_INDEX Installing custom scripts and commands..." -ForegroundColor Cyan
try {
    $customScriptsResult = Invoke-CustomScriptsInstallation -CreateShortcuts $true

    if ($customScriptsResult.Errors.Count -eq 0) {
        Write-Host "$SCRIPT_INDEX Custom scripts installation completed successfully!" -ForegroundColor Green
        Write-Host "$SCRIPT_INDEX Summary: Processed: $($customScriptsResult.ProcessedCount), Scripts: $($customScriptsResult.ScriptsCreated), Shortcuts: $($customScriptsResult.ShortcutsCreated)" -ForegroundColor Green
    }
    else {
        Write-Host "$SCRIPT_INDEX Custom scripts installation completed with warnings" -ForegroundColor Yellow
        foreach ($err in $customScriptsResult.Errors) {
            Write-Host "$SCRIPT_INDEX Warning: $err" -ForegroundColor Yellow
        }
    }
}
catch {
    Write-Host "$SCRIPT_INDEX Custom scripts installation failed: $($_.Exception.Message)" -ForegroundColor Red
}