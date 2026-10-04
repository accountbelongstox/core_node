# Variable Declarations (all globals at top)
$PSScriptRoot = Split-Path -Parent $PSCommandPath

# String constants
$SHELLS_WIN_PATH = "shells/win"
$SCRIPTS_PATH = "scripts"
$INSTALL_POWERSHELLS_DIR_NAME = "install_powershells"
$WIN_COMMON_DIR_NAME = "win_common"
$INSTALLER_SCRIPTS_LIST_FILE = "InstallerScriptsList.ps1"
$INSTALL_ITEM_RUNNER_FILE = "InstallItemRunner.ps1"

# Path combinations
$SCRIPTS_SHELLS_WIN_INSTALL_POWERSHELLS_PATH = Join-Path (Join-Path $SCRIPTS_PATH $SHELLS_WIN_PATH) $INSTALL_POWERSHELLS_DIR_NAME
$SHELLS_WIN_INSTALL_POWERSHELLS_PATH = Join-Path $SHELLS_WIN_PATH $INSTALL_POWERSHELLS_DIR_NAME
$SCRIPTS_SHELLS_WIN_WIN_COMMON_PATH = Join-Path (Join-Path $SCRIPTS_PATH $SHELLS_WIN_PATH) $WIN_COMMON_DIR_NAME
$SHELLS_WIN_WIN_COMMON_PATH = Join-Path $SHELLS_WIN_PATH $WIN_COMMON_DIR_NAME

# Directory and path variables
$USER_DIR = Join-Path "D:\www" "core_node"
$GLOBAL_VAR_DIR = Join-Path $USER_DIR "global_var"
$INSTALL_POWERSHELLS_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) $INSTALL_POWERSHELLS_DIR_NAME
$WIN_COMMON_DIR = Join-Path (Split-Path -Parent $PSScriptRoot) $WIN_COMMON_DIR_NAME

# Global variable to track if base scripts have been downloaded
$script:BASE_SCRIPTS_DOWNLOADED = $false

# Load common/global modules first (as per spec)
. "$WIN_COMMON_DIR/GlobalVars.ps1"
. "$WIN_COMMON_DIR/CommonFunc.ps1"
. "$WIN_COMMON_DIR/WindowsPathFunction.ps1" -version


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

# Install-Script and the menu item registry live in the shared runner
$itemRunnerPath = Invoke-SmartLoadScript -SubPath (Join-Path $SHELLS_WIN_WIN_COMMON_PATH $INSTALL_ITEM_RUNNER_FILE)
if (-not $itemRunnerPath) {
    throw "Failed to load install item runner"
}
. $itemRunnerPath

# Single-item run requested from the configuration menu (DD_RUN_ITEM); cleared before running
$runItemKey = Get-GlobalVar -key $INSTALL_ITEM_SELECTED_ITEM_VAR
if (-not [string]::IsNullOrWhiteSpace($runItemKey)) {
    Set-GlobalVar -key $INSTALL_ITEM_SELECTED_ITEM_VAR -value "" | Out-Null
    $runItem = Get-InstallItemByKey -Key $runItemKey.Trim()
    if ($runItem) {
        & $runItem.File
        return
    }
    Write-Host "Unknown install item '$runItemKey'; running the full installation" -ForegroundColor Yellow
}

# Execute the main installation steps in order via a single source of truth
# Smart load the steps list file using Invoke-SmartLoadScript
$stepsListSubPath = Join-Path $SHELLS_WIN_WIN_COMMON_PATH $INSTALLER_SCRIPTS_LIST_FILE
$stepsList = Invoke-SmartLoadScript -SubPath $stepsListSubPath
if (-not $stepsList) {
    throw "Failed to load steps list file"
}

. $stepsList

$disabledItemSteps = @(Get-InstallItemDisabledSteps)
Write-InstallPlan -Title 'Full installation' -Steps $InstallerScripts -SwitchedOffSteps $disabledItemSteps
foreach ($stepScript in $InstallerScripts) {
    if ($disabledItemSteps -contains $stepScript) {
        Write-Host "[skip] $stepScript (switched off in the installation configuration)" -ForegroundColor DarkGray
        continue
    }
    Install-Script -scriptName $stepScript -shouldExecute $true
}
