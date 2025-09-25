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

# Variable Declarations (all globals at top)
$PSScriptRoot = Split-Path -Parent $PSCommandPath

# String constants
$SHELLS_WIN_PATH = "shells/win"
$SCRIPTS_PATH = "scripts"
$INSTALL_POWERSHELLS_DIR_NAME = "install_powershells"
$WIN_COMMON_DIR_NAME = "win_common"
$INSTALLER_SCRIPTS_LIST_FILE = "InstallerScriptsList.ps1"

# Path combinations
$SCRIPTS_SHELLS_WIN_INSTALL_POWERSHELLS_PATH = "$SCRIPTS_PATH\$SHELLS_WIN_PATH\$INSTALL_POWERSHELLS_DIR_NAME"
$SHELLS_WIN_INSTALL_POWERSHELLS_PATH = "$SHELLS_WIN_PATH\$INSTALL_POWERSHELLS_DIR_NAME"

# Directory and path variables
$USER_DIR = "$env:USERPROFILE\.core_node"
$GLOBAL_VAR_DIR = Join-Path $USER_DIR ".global_vars"
$INSTALL_POWERSHELLS_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) $INSTALL_POWERSHELLS_DIR_NAME
$WIN_COMMON_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) $WIN_COMMON_DIR_NAME

# Global variable to track if base scripts have been downloaded
$script:BASE_SCRIPTS_DOWNLOADED = $false

# Load common/global modules first (as per spec)
. "$WIN_COMMON_DIR/GlobalVars.ps1"
. "$WIN_COMMON_DIR/CommanFunc.ps1"
. "$WIN_COMMON_DIR/WindowsPathFunction.ps1" -version


# Script-wide variables potentially used inside functions
$script:scriptExtension = $null
$script:scriptBaseName = $null
$script:isJsScript = $false
$script:isPsScript = $false
$script:downloadPath = $null

$selectedRegion = Get-GlobalVar -key "SELECTED_REGION"

# Ensure script runs in the correct context
Set-Location $PSScriptRoot

# Create necessary directories
if (-not (Test-Path $INSTALL_POWERSHELLS_DIR)) {
    New-Item -ItemType Directory -Path $INSTALL_POWERSHELLS_DIR -Force | Out-Null
}
if (-not (Test-Path $GLOBAL_VAR_DIR)) {
    New-Item -ItemType Directory -Path $GLOBAL_VAR_DIR -Force | Out-Null
}

# Set execution policy
try {
    & Set-ExecutionPolicy Bypass -Scope LocalMachine -Force
} catch {
    Write-Host "Failed to set execution policy: $_" -ForegroundColor Red
}

# Use global var helpers from win_common instead of redefining

# Get selected region from global vars
if ([string]::IsNullOrWhiteSpace($selectedRegion)) {
    $selectedRegion = "Global"
}

# Set environment based on selected region
if ($selectedRegion -eq "China") {
    Write-Host "Using China mirror" -ForegroundColor Green
}
else {
    Write-Host "Using global mirror" -ForegroundColor Green
}

# Function to download and install scripts
function Install-Script {
    param(
        [string]$scriptName,
        [bool]$shouldExecute = $false,
        [string]$password = "123456",
        [bool]$needDecrypt = $false
    )
    
    # Determine script type and base name
    $script:scriptExtension = [System.IO.Path]::GetExtension($scriptName)
    $script:scriptBaseName = [System.IO.Path]::GetFileNameWithoutExtension($scriptName)
    $script:isJsScript = $script:scriptExtension -eq ".js"
    $script:isPsScript = $script:scriptExtension -eq ".ps1"
    
    if (-not ($script:isJsScript -or $script:isPsScript)) {
        Write-Host "Unsupported script type: $script:scriptExtension" -ForegroundColor Red
        return
    }
    
    $script:downloadPath = Join-Path $USER_DIR "$SCRIPTS_SHELLS_WIN_INSTALL_POWERSHELLS_PATH\$scriptName"

    Write-Host "Checking script: $scriptName" -ForegroundColor Cyan

    # Use Invoke-SmartLoadScript for intelligent script loading (local or remote)
    $scriptSubPath = Join-Path $SHELLS_WIN_INSTALL_POWERSHELLS_PATH $scriptName
    $actualScriptPath = Invoke-SmartLoadScript -SubPath $scriptSubPath
    if (-not $actualScriptPath) {
        Write-Host "Failed to load script: $scriptName" -ForegroundColor Red
        return
    }

    if ($shouldExecute) {
        Write-Host "Executing script: $actualScriptPath" -ForegroundColor Cyan
        & $actualScriptPath $selectedRegion
    }
}

# Execute the main installation steps in order via a single source of truth
# Smart load the steps list file using Invoke-SmartLoadScript
$stepsListSubPath = Join-Path $SHELLS_WIN_INSTALL_POWERSHELLS_PATH $INSTALLER_SCRIPTS_LIST_FILE
$stepsList = Invoke-SmartLoadScript -SubPath $stepsListSubPath
if (-not $stepsList) {
    throw "Failed to load steps list file"
}

. $stepsList

foreach ($stepScript in $InstallerScripts) {
    Install-Script -scriptName $stepScript -shouldExecute $true
}
