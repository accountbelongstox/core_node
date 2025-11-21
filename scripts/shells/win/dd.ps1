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

# Parameter declaration
param(
    [Parameter(Mandatory=$false)]
    [switch]$SkipInitialization
)

<#
.SYNOPSIS
    Core Node Management Script for Windows

.DESCRIPTION
    This script provides similar functionality to the Linux bash script but adapted for Windows environments.
    It handles directory management, script execution, and system configuration.

.PARAMETER SkipInitialization
    When this switch is provided, the script will skip Process-PsFiles and Process-Directories operations.
    This parameter is used when returning from other scripts (like unified_manager.ps1) to avoid redundant processing
    and provide faster menu display.

.EXAMPLE
    .\dd.ps1
    Runs the script with full initialization

.EXAMPLE
    .\dd.ps1 -SkipInitialization
    Runs the script skipping initialization operations (used when returning from sub-menus)
#>
try{
    & Set-ExecutionPolicy Bypass -Scope LocalMachine -Force
}
catch{
    Write-Host "Failed to set execution policy: $_" -ForegroundColor Yellow
}
# PowerShell Script for Core Node Management

# =============================================================================
# FILE IMPORTS AND VARIABLE DECLARATIONS
# =============================================================================

# Import GlobalVars.ps1 first to get all global variables
$globalVarsPath = Join-Path $PSScriptRoot "win_common\GlobalVars.ps1"
. $globalVarsPath

# Import CommonFunc.ps1 to get common functions
$commonFuncPath = Join-Path $PSScriptRoot "win_common\CommonFunc.ps1"
. $commonFuncPath

# Import InitializationManager.ps1
$initializationManagerPath = Join-Path $PSScriptRoot "menu_itemshells\InitializationManager.ps1"
. $initializationManagerPath

# Import ScriptProcessor.ps1 for file scanning functions
$scriptProcessorPath = Join-Path $PSScriptRoot "tools\ScriptProcessor.ps1"
. $scriptProcessorPath

# Import WindowsPathFunction.ps1 for environment variable management
$windowsPathFunctionPath = Join-Path $PSScriptRoot "win_common\WindowsPathFunction.ps1"
. $windowsPathFunctionPath

#region Variable Declarations 
# =============================================================================
# SCRIPT-SPECIFIC VARIABLES (not defined in GlobalVars.ps1)
# =============================================================================
$script:PS_CURENT_DIR = $PSScriptRoot
$script:SHELLS_DIR = (Get-Item $script:PS_CURENT_DIR).Parent.FullName
$script:MAIN_POWERSHELLS_DIR = Join-Path $script:SHELLS_DIR "win\main_powershells"
$script:COMMON_SHELLS_DIR = Join-Path $script:SHELLS_DIR "common"
$script:COMMON_SCRIPTS_DIR = Join-Path $script:SHELLS_DIR "scripts"

# =============================================================================
# SCRIPT EXECUTION VARIABLES
# =============================================================================
$script:script_symlink_path = "$env:ProgramFiles\dd.ps1"
$script:script_path = $MyInvocation.MyCommand.Path

# =============================================================================
# PATH MANAGEMENT VARIABLES
# =============================================================================
$script:ENV_DETECTION_AVAILABLE = $false
$script:PATH_MANAGEMENT_METHOD = "none"
$script:WINDOWS_PATH_FUNCTION_LOADED = $false

# =============================================================================
# CACHE AND SYSTEM CHECK VARIABLES
# =============================================================================
$script:SYSTEM_CHECK_CACHE_FILE = Join-Path $Global:USER_CACHE_DIR "system_check.json"
$script:SYSTEM_CHECK_CACHE_DURATION = 3 # hours
$script:SOFTWARE_CHECK_CACHE_FILE = Join-Path $Global:USER_CACHE_DIR "software_check.json"
$script:SOFTWARE_CHECK_CACHE_DURATION = 3 # hours
$script:SYSTEM_CHECK_RESULTS = $null
$script:SOFTWARE_STATUS_RESULTS = $null
$script:LAST_CHECK_TIME = $null

# =============================================================================
# URL AND REPOSITORY VARIABLES
# =============================================================================
# These variables will be initialized after functions are defined
$script:SCRIPT_REPO_PATH = "scripts/shells/win"
$script:INSTALLER_SCRIPT_NAME = "DevInstaller.ps1"
$script:TEST_INSTALLER_SCRIPT_NAME = "TestInstaller.ps1"
# URL variables that depend on functions will be set later
$script:CURRENT_DOWNLOAD_BASE_URL = ""
$script:INSTALLER_SCRIPT_URL = ""
$script:TEST_INSTALLER_SCRIPT_URL = ""
$script:LOCAL_INSTALLER_SCRIPT = ""
$script:LOCAL_TEST_INSTALLER_SCRIPT = ""
$script:DOWNLOADED_INSTALLER_SCRIPT = ""
$script:DOWNLOADED_TEST_INSTALLER_SCRIPT = ""

# =============================================================================
# MENU CONFIGURATION VARIABLES
# =============================================================================
# MenuItems will be defined later in the script after functions are available
#endregion

# =============================================================================
# INITIALIZATION CHECK
# =============================================================================
# InitializationManager.ps1 is already imported above and will handle initialization

# Common functions are now imported from CommonFunc.ps1 and GlobalVars.ps1

# =============================================================================
# INITIALIZE DEPENDENT VARIABLES
# =============================================================================
# Initialize variables that depend on functions
$script:CURRENT_DOWNLOAD_BASE_URL = Get-RegionDownloadBaseURL
$script:INSTALLER_SCRIPT_URL = "$($script:CURRENT_DOWNLOAD_BASE_URL)/$($script:SCRIPT_REPO_PATH)/$($script:INSTALLER_SCRIPT_NAME)"
$script:TEST_INSTALLER_SCRIPT_URL = "$($script:CURRENT_DOWNLOAD_BASE_URL)/$($script:SCRIPT_REPO_PATH)/$($script:TEST_INSTALLER_SCRIPT_NAME)"
$script:LOCAL_INSTALLER_SCRIPT = Join-Path $script:SHELLS_DIR "win\menu_itemshells\$($script:INSTALLER_SCRIPT_NAME)"
$script:LOCAL_TEST_INSTALLER_SCRIPT = Join-Path $script:SHELLS_DIR "win\menu_itemshells\$($script:TEST_INSTALLER_SCRIPT_NAME)"
$script:DOWNLOADED_INSTALLER_SCRIPT = Join-Path $Global:USER_CACHE_DIR $script:INSTALLER_SCRIPT_NAME
$script:DOWNLOADED_TEST_INSTALLER_SCRIPT = Join-Path $Global:USER_CACHE_DIR $script:TEST_INSTALLER_SCRIPT_NAME

# Menu configuration
$script:MenuItems = @(
    @{ 
        Text              = "Install/Test environment scripts"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = $null
        Action            = { 
            Show-InstallerSubMenu
        }
    },

    @{
        Text              = "Display global variables"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = "DISPLAY_VARS_TYPE"
        Action            = { 
            Set-GlobalVar -Key "DISPLAY_VARS_TYPE" -Value "default"
            Get-GlobalVariables
            Read-Host "Press Enter to continue"
        }
    },
    @{
        Text              = "Unified App Manager"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = $null
        Action            = {
            $unifiedManagerScript = Join-Path $Global:CORE_NODE_SCRIPTS_DIR "unified_manager\unified_manager.ps1"
            $shellCandidates = @('pwsh', 'powershell')
            $shellExecutable = $null

            foreach ($candidateShell in $shellCandidates) {
                if (Get-Command $candidateShell -ErrorAction SilentlyContinue) {
                    $shellExecutable = $candidateShell
                    break
                }
            }

            if ($null -eq $shellExecutable) {
                Write-ColorMessage -Message "Error: No compatible PowerShell executable found to run unified_manager.ps1" -Type "Error"
                Write-ColorMessage -Message "Please ensure PowerShell (pwsh or powershell) is installed and available in PATH" -Type "Info"
                Read-Host "Press Enter to continue"
                return
            }

            try {
                & $shellExecutable -NoLogo -NoProfile -ExecutionPolicy Bypass -File $unifiedManagerScript
            } finally {
                # Return to dd.ps1 with SkipInitialization to avoid redundant processing
                & $PSCommandPath -SkipInitialization
            }
        }
    },
    @{
        Text              = "Push to git"
        Values            = @("main", "develop")
        CurrentValueIndex = 0
        Key               = "GIT_PUSH_BRANCH"
        Action            = {
            $selectedValue = $script:MenuItems[8].Values[$script:MenuItems[8].CurrentValueIndex]
            Set-GlobalVar -Key "GIT_PUSH_BRANCH" -Value $selectedValue
            Push-Git
        }
    },
    @{
        Text              = "WSL Ubuntu Management"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = $null
        Action            = {
            Show-WSLUbuntuSubMenu
        }
    },
    @{
        Text              = "Git Management"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = "GIT_UPDATE_TYPE"
        Action            = {
            Set-GlobalVar -Key "GIT_UPDATE_TYPE" -Value "default"
            Show-GitManagementMenu
        }
    },
    @{
        Text              = "Set Special Software Environment Variables (like AI)"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = $null
        Action            = {
            Show-SpecialSoftwareEnvMenu
        }
    },
    @{
        Text              = "Windows Management"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = $null
        Action            = {
            $windowsManagementScript = Join-Path $script:PS_CURENT_DIR "menu_itemshells\WindowsManagementManager.ps1"
            Write-ColorMessage -Message "Launching Windows Management Menu..." -Type "Info"
            & powershell -NoProfile -ExecutionPolicy Bypass -File $windowsManagementScript
        }
    },
    @{
        Text              = "Backup Management"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = $null
        Action            = {
            $backupMenuScript = Join-Path $script:PS_CURENT_DIR "menu_itemshells\BackupManager.ps1"
            Write-ColorMessage -Message "Launching Backup Management Menu..." -Type "Info"
            & powershell -NoProfile -ExecutionPolicy Bypass -File $backupMenuScript
        }
    },
    @{
        Text              = "Exit"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = "EXIT_TYPE"
        Action            = {
            Write-ColorMessage -Message "Exiting the script." -Type "Info"
            exit
        }
    }
)
#endregion

#region Functions

function Test-ConsoleCapabilities {
    $capabilities = @{
        CursorControl = $false
        ColorControl = $false
        KeyInput = $false
    }

    try {
        $testCursor = [Console]::CursorVisible
        [Console]::CursorVisible = $testCursor
        $capabilities.CursorControl = $true
    } catch { }

    try {
        $testColor = [Console]::ForegroundColor
        $capabilities.ColorControl = $true
    } catch { }

    try {
        # Test if we can read keys without blocking
        if ([Console]::KeyAvailable) {
            $capabilities.KeyInput = $true
        } else {
            # If no key is available, assume we can read keys
            $capabilities.KeyInput = $true
        }
    } catch { }

    return $capabilities
}

function Invoke-InteractiveMenu {
    param(
        [Parameter(Mandatory=$true)] [array]$Items,
        [Parameter(Mandatory=$true)] [string]$Title,
        [Parameter()] [bool]$EnableValueToggle = $true
    )
    $selectedIndex = 0

    # Test console capabilities first
    $consoleCapabilities = Test-ConsoleCapabilities

    # Safe console operations with error handling
    $cursorVisible = $true
    $originalForeground = [ConsoleColor]::Gray
    $originalBackground = [ConsoleColor]::Black

    if ($consoleCapabilities.CursorControl) {
        try {
            $cursorVisible = [Console]::CursorVisible
            [Console]::CursorVisible = $false
        } catch {
            Write-ColorMessage -Message "Warning: Cannot control cursor visibility in this environment" -Type "Warning"
        }
    }

    if ($consoleCapabilities.ColorControl) {
        try {
            $originalForeground = [Console]::ForegroundColor
            $originalBackground = [Console]::BackgroundColor
        } catch {
            Write-ColorMessage -Message "Warning: Cannot get console colors in this environment" -Type "Warning"
            # Use safe default values instead of calling failed API again
            $originalForeground = [ConsoleColor]::Gray
            $originalBackground = [ConsoleColor]::Black
        }
    }

    function Draw-MenuInternal {
        Clear-Host
        Write-ColorMessage -Message $Title -Type "Info"
        
        # Display execution mode
        if ($Global:EXECUTION_MODE) {
            $modeText = if ($Global:EXECUTION_MODE -eq "PROJECT") { "Project Mode" } else { "Installation Mode" }
            Write-ColorMessage -Message "Execution mode: $modeText" -Type "Info"
        } else {
            Write-ColorMessage -Message "Execution mode: Mode not detected" -Type "Warning"
        }
        
        # Display PS_CURENT_DIR parent directory
        $parentDir = Split-Path (Split-Path $script:PS_CURENT_DIR -Parent) -Parent
        Write-ColorMessage -Message "PS_CURENT_DIR parent: $parentDir" -Type "Info"
        
        for ($i = 0; $i -lt $Items.Count; $i++) {
            $item = $Items[$i]
            if (-not $item.ContainsKey('CurrentValueIndex')) { $item | Add-Member -NotePropertyName CurrentValueIndex -NotePropertyValue 0 }
            $currentValue = $item.Values[$item.CurrentValueIndex]
            $valueDisplay = ""
            if ($item.Values.Count -gt 1 -or $currentValue -ne "default") { $valueDisplay = " [$currentValue]" }
            if ($i -eq $selectedIndex) {
                Write-Host -NoNewline ">"
                Write-Host -NoNewline -ForegroundColor Black -BackgroundColor White (" {0,-40}{1}" -f $item.Text, $valueDisplay)
                Write-Host ""
            } else {
                Write-Host ("  {0,-40}{1}" -f $item.Text, $valueDisplay)
            }
        }
    }

    while ($true) {
        Draw-MenuInternal

        if ($consoleCapabilities.KeyInput) {
            try {
                $key = [Console]::ReadKey($true).Key
            } catch {
                Write-ColorMessage -Message "Error: Cannot read console input in this environment, falling back to number input" -Type "Warning"
                $consoleCapabilities.KeyInput = $false
                continue
            }
        } else {
            # Fallback to number-based selection for environments that don't support ReadKey
            Write-Host ""
            Write-Host "Console key input not supported. Please use number selection:" -ForegroundColor Yellow
            for ($i = 0; $i -lt $Items.Count; $i++) {
                Write-Host "  $($i + 1). $($Items[$i].Text)" -ForegroundColor Cyan
            }

            do {
                $userInput = Read-Host "Enter selection (1-$($Items.Count))"
                $selection = $null
                if ([int]::TryParse($userInput, [ref]$selection) -and $selection -ge 1 -and $selection -le $Items.Count) {
                    $selectedIndex = $selection - 1
                    break
                } else {
                    Write-Host "Invalid selection. Please enter a number between 1 and $($Items.Count)" -ForegroundColor Red
                }
            } while ($true)

            # Restore console settings and return
            if ($consoleCapabilities.CursorControl) {
                try {
                    [Console]::CursorVisible = $cursorVisible
                } catch { }
            }
            if ($consoleCapabilities.ColorControl) {
                try {
                    [Console]::ForegroundColor = $originalForeground
                    [Console]::BackgroundColor = $originalBackground
                } catch { }
            }
            Clear-Host
            return $selectedIndex
        }
        switch ($key) {
            'UpArrow'   { if ($selectedIndex -gt 0) { $selectedIndex-- } else { $selectedIndex = $Items.Count - 1 } }
            'DownArrow' { if ($selectedIndex -lt $Items.Count - 1) { $selectedIndex++ } else { $selectedIndex = 0 } }
            'LeftArrow' {
                if ($EnableValueToggle) {
                    $item = $Items[$selectedIndex]
                    if ($item.Values.Count -gt 1) {
                        $item.CurrentValueIndex--
                        if ($item.CurrentValueIndex -lt 0) { $item.CurrentValueIndex = $item.Values.Count - 1 }
                        if ($item.Key) { Set-GlobalVar -Key $item.Key -Value $item.Values[$item.CurrentValueIndex] }
                    }
                }
            }
            'RightArrow' {
                if ($EnableValueToggle) {
                    $item = $Items[$selectedIndex]
                    if ($item.Values.Count -gt 1) {
                        $item.CurrentValueIndex++
                        if ($item.CurrentValueIndex -ge $item.Values.Count) { $item.CurrentValueIndex = 0 }
                        if ($item.Key) { Set-GlobalVar -Key $item.Key -Value $item.Values[$item.CurrentValueIndex] }
                    }
                }
            }
            'Enter'     {
                # Restore console settings safely
                if ($consoleCapabilities.CursorControl) {
                    try {
                        [Console]::CursorVisible = $cursorVisible
                    } catch {
                        Write-ColorMessage -Message "Warning: Cannot restore cursor visibility" -Type "Warning"
                    }
                }
                if ($consoleCapabilities.ColorControl) {
                    try {
                        [Console]::ForegroundColor = $originalForeground
                        [Console]::BackgroundColor = $originalBackground
                    } catch {
                        Write-ColorMessage -Message "Warning: Cannot restore console colors" -Type "Warning"
                    }
                }
                Clear-Host
                return $selectedIndex
            }
        }
    }
}

function Set-ProjectEnvironmentVariables {
    Write-ColorMessage -Message "Setting project environment variables..." -Type "Info"
    
    # Use WindowsPathFunction.ps1 with parameters to add PROJECT_DIR
    & $windowsPathFunctionPath -action "add" -param1 $PROJECT_DIR
    Write-ColorMessage -Message "Added PROJECT_DIR to PATH: $PROJECT_DIR" -Type "Success"
    
    # Use WindowsPathFunction.ps1 with parameters to add PROJECT_SCRIPTS_DIR
    & $windowsPathFunctionPath -action "add" -param1 $PROJECT_SCRIPTS_DIR
    Write-ColorMessage -Message "Added PROJECT_SCRIPTS_DIR to PATH: $PROJECT_SCRIPTS_DIR" -Type "Success"
    
    # Refresh environment variables using WindowsPathFunction.ps1
    & $windowsPathFunctionPath -action "refresh-bat"
}

function Initialize-Environment {
    Write-ColorMessage -Message "CORE_NODE_DIR: $CORE_NODE_DIR" -Type "Info"
    Write-ColorMessage -Message "PS_CURRENT_DIR: $($script:PS_CURENT_DIR)" -Type "Info"
    Write-ColorMessage -Message "SHELLS_DIR: $($script:SHELLS_DIR)" -Type "Info"
    Write-ColorMessage -Message "PROJECT_DIR: $PROJECT_DIR" -Type "Info"
    Write-ColorMessage -Message "PROJECT_SCRIPTS_DIR: $PROJECT_SCRIPTS_DIR" -Type "Info"
    Write-ColorMessage -Message "PROJECT_WIN_SCRIPTS_DIR: $PROJECT_WIN_SCRIPTS_DIR" -Type "Info"
    
    # Ensure cache directory exists
    if (-not (Test-Path $Global:USER_CACHE_DIR)) {
        New-Item -ItemType Directory -Path $Global:USER_CACHE_DIR -Force | Out-Null
    }
    
    # Set environment variables for non-installation mode
    Set-ProjectEnvironmentVariables
}



function Check-AdminPrivileges {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-ColorMessage -Message "This script requires administrator privileges. Please run as administrator." -Type "Error"
        exit 1
    }
}


function Initialize-GlobalVarDir {
    if (-not (Test-Path $Global:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
        Write-ColorMessage -Message "Created global variable directory: $($Global:GLOBAL_VAR_DIR)" -Type "Success"
    }
}



function Store-GlobalPaths {
    # Store script directory path using UTF-8
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText("$($Global:GLOBAL_VAR_DIR)\SCRIPT_ROOT_DIR", $Global:CORE_NODE_DIR, $utf8NoBom)
}


function Create-Symlink {
    if (Test-Path $script:script_symlink_path) {
        if ((Get-Item $script:script_symlink_path).LinkType -ne "SymbolicLink" -or 
            (Get-Item $script:script_symlink_path).Target -ne $script:script_path) {
            Write-ColorMessage -Message "Removing existing $($script:script_symlink_path) as it is not a symlink to the current script." -Type "Warning"
            Remove-Item $script:script_symlink_path -Force
        }
    }

    if (-not (Test-Path $script:script_symlink_path)) {
        $null = New-Item -ItemType SymbolicLink -Path $script:script_symlink_path -Target $script:script_path -Force
        Write-ColorMessage -Message "Symbolic link created: $($script:script_symlink_path) -> $($script:script_path)" -Type "Success"
    }
}

function Detect-SystemVersion {
    if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
        $script:SYSTEM_VERSION = "Windows_ARM64"
        $script:SYSTEM_NAME = "Windows"
    }
    elseif ($env:PROCESSOR_ARCHITEW6432 -eq "AMD64") {
        $script:SYSTEM_VERSION = "Windows_x64"
        $script:SYSTEM_NAME = "Windows"
    }
    else {
        $script:SYSTEM_VERSION = "Windows_x86"
        $script:SYSTEM_NAME = "Windows"
    }
    
    if ($env:WSL_DISTRO_NAME) {
        $script:SYSTEM_VERSION = "WSL_$($env:WSL_DISTRO_NAME)"
        $script:SYSTEM_NAME = "WSL"
    }
    
    if ($env:DOCKER_CONTAINER) {
        $script:SYSTEM_VERSION = "Docker_Windows"
        $script:SYSTEM_NAME = "Docker"
    }
}

function Show-GitSourceSubMenu {
    # Backward compatibility wrapper to new Git Management menu
    Show-GitManagementMenu
}

function Invoke-GitBackupPrompt {
    $backupChoice = Read-Host "Run Backup Management before git operation? (yes/no)"
    if ($backupChoice -eq "yes") {
        $backupMenuScript = Join-Path $script:PS_CURENT_DIR "menu_itemshells\BackupManager.ps1"
        Write-ColorMessage -Message "Launching Backup Management Menu..." -Type "Info"
        & powershell -NoProfile -ExecutionPolicy Bypass -File $backupMenuScript
    } else {
        Write-ColorMessage -Message "Skipping backup before git operation." -Type "Warning"
    }
}

function Invoke-GitCommitAllChanges {
    param(
        [Parameter()] [string]$DefaultMessage = "chore: save local changes"
    )
    Set-Location $CORE_NODE_DIR
    $statusOutput = git status --porcelain
    if (-not [string]::IsNullOrWhiteSpace($statusOutput)) {
        Write-ColorMessage -Message "Local changes detected. Preparing to add and commit before pull." -Type "Info"
        $shouldCommit = Read-Host "Stage and commit all changes? (yes/no)"
        if ($shouldCommit -eq "yes") {
            $commitMessage = Read-Host "Commit message (default: $DefaultMessage)"
            if ([string]::IsNullOrWhiteSpace($commitMessage)) {
                $commitMessage = $DefaultMessage
            }
            git add .
            git commit -m $commitMessage
        } else {
            Write-ColorMessage -Message "Skipping commit; pull may fail if conflicts occur." -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "No local changes detected. Continuing." -Type "Info"
    }
}

function Invoke-RegionAwarePull {
    Set-Location $CORE_NODE_DIR
    $currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
    if ([string]::IsNullOrWhiteSpace($currentBranch)) {
        Write-ColorMessage -Message "Unable to determine current branch." -Type "Error"
        return
    }

    $remoteUrl = Get-RegionCloneURL
    Write-ColorMessage -Message "Using region-aware remote: $remoteUrl" -Type "Info"
    Write-ColorMessage -Message "Pulling branch: $currentBranch" -Type "Info"

    git pull $remoteUrl $currentBranch
    if ($LASTEXITCODE -eq 0) {
        Write-ColorMessage -Message "Git pull completed." -Type "Success"
    } else {
        Write-ColorMessage -Message "Git pull failed. Please review the output above." -Type "Error"
    }
}

function Get-LatestGitVersion {
    $confirm = Read-Host "Are you sure you want to safely pull the latest git version? (yes/no)"
    if ($confirm -ne "yes") {
        Write-ColorMessage -Message "Git pull cancelled." -Type "Warning"
        return
    }
    
    Write-ColorMessage -Message "Starting region-aware git pull with pre-checks..." -Type "Info"
    
    Invoke-GitBackupPrompt
    Invoke-GitCommitAllChanges
    Invoke-RegionAwarePull

    if ($LASTEXITCODE -eq 0) {
        Write-ColorMessage -Message "Git pull operation completed successfully!" -Type "Success"
        Make-PsExecutable
    } else {
        Write-ColorMessage -Message "Git pull operation failed. Please check the output above." -Type "Error"
    }
}

function Show-GitManagementMenu {
    while ($true) {
        Clear-Host
        Write-Host ""
        Write-ColorMessage -Message "==================== Git Management ====================" -Type "Info"
        Write-Host "  1. Get the latest git version (backup + commit + pull)"
        Write-Host "  2. Git time travel"
        Write-Host "  3. Back"
        Write-ColorMessage -Message "========================================================" -Type "Info"
        $choice = Read-Host "Select an option (1-3)"

        switch ($choice) {
            "1" {
                Get-LatestGitVersion
                Read-Host "Press Enter to return to Git Management menu"
            }
            "2" {
                $gitTimeTravelScript = Join-Path $Global:CORE_NODE_SCRIPTS_DIR "git\git_time_travel.ps1"
                Write-ColorMessage -Message "Launching Git Time Travel..." -Type "Info"
                & powershell -NoProfile -ExecutionPolicy Bypass -File $gitTimeTravelScript
                Read-Host "Press Enter to return to Git Management menu"
            }
            "3" {
                return
            }
            default {
                Write-ColorMessage -Message "Invalid option. Please try again." -Type "Warning"
                Start-Sleep -Seconds 1
            }
        }
    }
}



function Show-DynamicTestInstaller {
    # Define the install_powershells directory path
    $installPowershellsDir = Join-Path $script:PS_CURENT_DIR "install_powershells"
    
    # Check if directory exists
    if (-not (Test-Path $installPowershellsDir -PathType Container)) {
        Write-ColorMessage -Message "Install PowerShells directory not found: $installPowershellsDir" -Type "Error"
        Read-Host "Press Enter to continue"
        return
    }
    
    # Scan for PowerShell scripts in the directory and sort by step number
    # Force the result to always be an array to safely use .Count and indexing
    $availableScripts = @(
        Get-ChildItem -Path $installPowershellsDir -Filter "*.ps1" -File |
            Where-Object { $_.Name -match "^Step\d+_" } |
            ForEach-Object {
                # Extract step number for sorting
                if ($_.Name -match "^Step(\d+)_") {
                    [PSCustomObject]@{
                        Name = $_.Name
                        StepNumber = [int]$matches[1]
                        FullPath = $_.FullName
                    }
                }
            } |
            Sort-Object StepNumber |
            Select-Object -ExpandProperty Name
    )
    
    if ($availableScripts.Count -eq 0) {
        Write-ColorMessage -Message "No Step scripts found in: $installPowershellsDir" -Type "Warning"
        Read-Host "Press Enter to continue"
        return
    }
    
    # Display available scripts
    Clear-Host
    Write-ColorMessage -Message "Available Test Scripts in install_powershells directory:" -Type "Info"
    Write-ColorMessage -Message "Directory: $installPowershellsDir" -Type "Info"
    Write-ColorMessage -Message "=" -Type "Info"
    
    for ($i = 0; $i -lt $availableScripts.Count; $i++) {
        Write-Host ("  {0}" -f $availableScripts[$i])
    }
    
    Write-Host ""
    Write-ColorMessage -Message "Enter search keyword to find and execute script:" -Type "Info"
    Write-ColorMessage -Message "  - Type keyword to search (e.g., 'java', 'git', 'chrome', '1', '46')" -Type "Info"
    Write-ColorMessage -Message "  - Type 'back' to return to menu" -Type "Info"
    Write-ColorMessage -Message "  - Type 'quit' to exit" -Type "Info"
    Write-Host ""
    
    $userChoice = (Read-Host "Enter keyword").Trim()
    
    # Handle special commands
    if ($userChoice -eq "back" -or $userChoice -eq "b") {
        Write-ColorMessage -Message "Returning to installer menu..." -Type "Info"
        return
    }
    
    if ($userChoice -eq "quit" -or $userChoice -eq "q") {
        Write-ColorMessage -Message "Exiting..." -Type "Info"
        exit
    }
    
    # Handle keyword search - find first match
    if (-not [string]::IsNullOrWhiteSpace($userChoice)) {
        $matchingScript = $availableScripts | Where-Object { $_ -match [regex]::Escape($userChoice) -or $_ -like "*$userChoice*" } | Select-Object -First 1
        
        if (-not $matchingScript) {
            Write-ColorMessage -Message "No scripts found matching keyword: '$userChoice'" -Type "Warning"
            Read-Host "Press Enter to continue"
            return
        }
        
        Write-ColorMessage -Message "Found matching script: $matchingScript" -Type "Success"
        $scriptPath = Join-Path $installPowershellsDir $matchingScript
        Write-ColorMessage -Message "Script absolute path: $scriptPath" -Type "Info"
        Write-ColorMessage -Message "Press any key to execute, or 'q' to cancel" -Type "Info"
        $key = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        if ($key.Character -ne 'q' -and $key.Character -ne 'Q') {
            Execute-TestScript -ScriptName $matchingScript -ScriptDir $installPowershellsDir
        } else {
            Write-ColorMessage -Message "Script execution cancelled." -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "No input provided. Returning to installer menu..." -Type "Info"
    }
}

function Execute-TestScript {
    param(
        [string]$ScriptName,
        [string]$ScriptDir
    )
    
    $scriptPath = Join-Path $ScriptDir $ScriptName
    
    if (-not (Test-Path $scriptPath -PathType Leaf)) {
        Write-ColorMessage -Message "Script not found: $scriptPath" -Type "Error"
        Read-Host "Press Enter to continue"
        return
    }
    
    Write-ColorMessage -Message "Executing script: $ScriptName" -Type "Info"
    Write-ColorMessage -Message "Script absolute path: $scriptPath" -Type "Info"
    Write-ColorMessage -Message "=" -Type "Info"
    
    try {
        # Unblock the file to ensure it can be executed
        Unblock-File -Path $scriptPath -ErrorAction SilentlyContinue
        
        # Execute the script
        & $scriptPath
        
        Write-ColorMessage -Message "=" -Type "Info"
        Write-ColorMessage -Message "Script execution completed: $ScriptName" -Type "Success"
        
    } catch {
        Write-ColorMessage -Message "=" -Type "Info"
        Write-ColorMessage -Message "Script execution failed: $($_.Exception.Message)" -Type "Error"
    }
    
    # Pause to allow user to review output (as requested - no exit, no return to menu)
    Write-Host ""
    Write-ColorMessage -Message "Script execution finished. Press any key to continue..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Show-InstallerSubMenu {
    $subItems = @(
        @{ 
            Text = "Run DevInstaller"; 
            Values = @("base", "server", "full"); 
            CurrentValueIndex = 0; 
            Key = "INSTALL_TYPE"; 
            Action = { 
                $installType = $subItems[0].Values[$subItems[0].CurrentValueIndex]
                Set-GlobalVar -Key "INSTALL_TYPE" -Value $installType
                Write-ColorMessage -Message "Installation type set to: $installType" -Type "Info"
                & $script:LOCAL_INSTALLER_SCRIPT
            } 
        },
        @{
            Text = "Run TestInstaller (select a step)";
            Values = @("default");
            CurrentValueIndex = 0;
            Key = "SELECTED_TEST_STEP";
            Action = {
                Show-DynamicTestInstaller
            }
        },
        @{
            Text              = "Select Region"
            Values            = @("China", "Global")
            CurrentValueIndex = 0
            Key               = "SELECTED_REGION"
            Action            = { 
                $selectedValue = $subItems[2].Values[$subItems[2].CurrentValueIndex]
                Set-GlobalVar -Key "SELECTED_REGION" -Value $selectedValue
                Write-ColorMessage -Message "Region set to: $selectedValue" -Type "Success"
                
                $installConfirm = Read-Host "Do you want to proceed with installation? (y/n)"
                if ($installConfirm -eq "y") {
                    $subItems[0].Action.Invoke()
                }
                else {
                    Write-ColorMessage -Message "Installation cancelled. Returning to menu." -Type "Info"
                }
            }
        },
        @{ Text = "Back"; Values = @("default"); Key = $null; Action = { return } },
        @{ Text = "Quit"; Values = @("default"); Key = $null; Action = { exit } }
    )

    # Initialize menu items from saved GlobalVar values
    foreach ($item in $subItems) {
        if ($item.Key) {
            $savedValue = Get-GlobalVar -Key $item.Key
            if ($savedValue) {
                $valueIndex = [array]::IndexOf($item.Values, $savedValue)
                if ($valueIndex -ge 0) {
                    $item.CurrentValueIndex = $valueIndex
                }
            }
        }
    }

    $selected = 0
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "Installer Menu (Up/Down to move, Left/Right to change value, Enter to select)" -Type "Info"
        for ($i=0; $i -lt $subItems.Count; $i++) {
            $it = $subItems[$i]
            $valIndex = if ($it.ContainsKey('CurrentValueIndex')) { $it.CurrentValueIndex } else { 0 }
            $currVal = $it.Values[$valIndex]
            $display = if ($it.Values.Count -gt 1 -or $currVal -ne 'default') { " [$currVal]" } else { "" }
            if ($i -eq $selected) {
                Write-Host -NoNewline ">"
                Write-Host -NoNewline -ForegroundColor Black -BackgroundColor White (" {0,-35}{1}" -f $it.Text, $display)
                Write-Host ""
            } else {
                Write-Host ("  {0,-35}{1}" -f $it.Text, $display)
            }
        }

        try {
            $key = [Console]::ReadKey($true).Key
        } catch {
            Write-ColorMessage -Message "Error: Cannot read console input in this environment, using fallback" -Type "Warning"
            Write-Host "Press Enter to continue or type 'q' to quit: " -NoNewline
            $userInput = Read-Host
            if ($userInput -eq 'q') {
                return
            } else {
                continue
            }
        }
        switch ($key) {
            'UpArrow'   { if ($selected -gt 0) { $selected-- } else { $selected = $subItems.Count - 1 } }
            'DownArrow' { if ($selected -lt $subItems.Count - 1) { $selected++ } else { $selected = 0 } }
            'LeftArrow' {
                $it = $subItems[$selected]
                if ($it.Values.Count -gt 1) {
                    if (-not $it.ContainsKey('CurrentValueIndex')) { $it | Add-Member -NotePropertyName CurrentValueIndex -NotePropertyValue 0 }
                    $it.CurrentValueIndex--
                    if ($it.CurrentValueIndex -lt 0) { $it.CurrentValueIndex = $it.Values.Count - 1 }
                    if ($it.Key) { Set-GlobalVar -Key $it.Key -Value $it.Values[$it.CurrentValueIndex] }
                }
            }
            'RightArrow' {
                $it = $subItems[$selected]
                if ($it.Values.Count -gt 1) {
                    if (-not $it.ContainsKey('CurrentValueIndex')) { $it | Add-Member -NotePropertyName CurrentValueIndex -NotePropertyValue 0 }
                    $it.CurrentValueIndex++
                    if ($it.CurrentValueIndex -ge $it.Values.Count) { $it.CurrentValueIndex = 0 }
                    if ($it.Key) { Set-GlobalVar -Key $it.Key -Value $it.Values[$it.CurrentValueIndex] }
                }
            }
            'Enter'     {
                $it = $subItems[$selected]
                if ($it.Key) {
                    $valIndex = if ($it.ContainsKey('CurrentValueIndex')) { $it.CurrentValueIndex } else { 0 }
                    Set-GlobalVar -Key $it.Key -Value $it.Values[$valIndex]
                }
                & $it.Action
                if ($it.Text -eq 'Back') { return }
            }
        }
    }
}


function Push-Git {
    Write-ColorMessage -Message "Starting Git Push Operations..." -Type "Info"

    # Set working directory
    $OriginalLocation = Get-Location
    try {
        Set-Location $CORE_NODE_DIR

        # Use the unified git script which handles encryption automatically
        $UnifiedGitScript = Join-Path $Global:CORE_NODE_SCRIPTS_DIR "git\gitput_unified.ps1"
        Write-ColorMessage -Message "Running unified git push script..." -Type "Info"
        & powershell -ExecutionPolicy Bypass -File $UnifiedGitScript

        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "Git push operations completed successfully" -Type "Success"
        } else {
            Write-ColorMessage -Message "Git push operations failed" -Type "Error"
        }

    } finally {
        Set-Location $OriginalLocation
    }
}



function Run-ByStart {
    param(
        [string]$FilePath,
        [string]$WorkingDirectory = "",
        [string]$Arguments = ""
    )
    
    # Special handling for explorer
    if ($FilePath -eq "explorer") {
        $fileName = "explorer"
        $fileDir = $WorkingDirectory
    } else {
        # Get file info for display purposes
        $fileInfo = Get-Item $FilePath -ErrorAction SilentlyContinue
        if (-not $fileInfo) {
            Write-ColorMessage -Message "File not found: $FilePath" -Type "Error"
            return
        }
        
        $fileName = $fileInfo.Name
        $fileDir = $fileInfo.DirectoryName
    }
    
    # Determine working directory
    if ([string]::IsNullOrEmpty($WorkingDirectory)) {
        $WorkingDirectory = $fileDir
    }
    
    # Build explorer command - just use the full file path
    if ($FilePath -eq "explorer") {
        # Special case for opening directory with explorer
        $startCommand = "`"$WorkingDirectory`""
    } else {
        # For all other files, use the full file path
        $startCommand = "`"$FilePath`""
    }
    
    Write-ColorMessage -Message "Working directory: $WorkingDirectory" -Type "Info"
    Write-ColorMessage -Message "Executing By: $fileName" -Type "Info"
    Write-ColorMessage -Message "Explorer command: explorer $startCommand" -Type "Info"
    Write-ColorMessage -Message "----------------------------------------" -Type "Info"
    
    # Change to working directory and execute
    $originalDir = Get-Location
    Set-Location $WorkingDirectory
    
    try {
        # Execute using explorer directly
        explorer $startCommand
        $exitCode = $LASTEXITCODE
        Write-ColorMessage -Message "Script started successfully with exit code: $exitCode" -Type "Success"
    } catch {
        Write-ColorMessage -Message "Error starting script: $_" -Type "Error"
        $exitCode = 1
    } finally {
        # Restore original directory
        Set-Location $originalDir
    }

    
    Write-ColorMessage -Message "----------------------------------------" -Type "Info"
    
    # # Show post-execution menu   explorer D:\programing\core_node\poly_apps\flutter_bloom\winStart.bat
    # $postMenuItems = @(
    #     @{
    #         Text = "Back to previous menu"
    #         Values = @("default")
    #         CurrentValueIndex = 0
    #         Key = ""
    #         Action = { return "back" }
    #     },
    #     @{
    #         Text = "Exit"
    #         Values = @("default")
    #         CurrentValueIndex = 0
    #         Key = ""
    #         Action = { exit }
    #     }
    # )
    
    # $selectedIndex = Invoke-InteractiveMenu -Items $postMenuItems -Title "Script execution completed" -EnableValueToggle $false
    
    # if ($selectedIndex -ge 0 -and $selectedIndex -lt $postMenuItems.Count) {
    #     $result = $postMenuItems[$selectedIndex].Action.Invoke()
    #     if ($result -eq "back") {
    #         return "back"
    #     }
    # }
    
    return $exitCode
}

function Get-GlobalVariables {
    if (-not (Test-Path $Global:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $Global:GLOBAL_VAR_DIR -Force | Out-Null
        Write-ColorMessage -Message "Created global variable directory: $($Global:GLOBAL_VAR_DIR)" -Type "Success"
        return
    }

    $files = Get-ChildItem -Path $Global:GLOBAL_VAR_DIR -File

    if ($files.Count -eq 0) {
        Write-ColorMessage -Message "No global variables found in $($Global:GLOBAL_VAR_DIR)" -Type "Warning"
        return
    }

    Write-ColorMessage -Message "`nGlobal Variables:" -Type "Info"
    Write-ColorMessage -Message "----------------" -Type "Info"
    
    foreach ($file in $files) {
        try {
            $key = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
            $value = Get-Content -Path $file.FullName -TotalCount 1
            Write-ColorMessage -Message "$key = $value" -Type "Info"
        }
        catch {
            Write-ColorMessage -Message "Error reading variable from $($file.Name): $_" -Type "Error"
        }
    }
    Write-ColorMessage -Message "----------------`n" -Type "Info"
}

## Removed Google access check to avoid slow network probing

function Initialize-MenuItems {
    $systemCheck = if (Get-Command Test-SystemRequirements -ErrorAction SilentlyContinue) { Test-SystemRequirements } else { $null }
    
    # Set default region without network probing
    $defaultRegion = "China"
    $regionIndex = [array]::IndexOf($script:MenuItems[0].Values, $defaultRegion)
    if ($regionIndex -ge 0) {
        $script:MenuItems[0].CurrentValueIndex = $regionIndex
        Set-GlobalVar -Key "SELECTED_REGION" -Value $defaultRegion
    }

    # Initialize other menu items
    foreach ($item in $script:MenuItems) {
        if ($item.Key) {
            $savedValue = Get-GlobalVar -Key $item.Key
            if ($savedValue) {
                $valueIndex = [array]::IndexOf($item.Values, $savedValue)
                if ($valueIndex -ge 0) {
                    $item.CurrentValueIndex = $valueIndex
                }
            }
        }
    }
}

function Show-InteractiveMenu {
    $selectedIndex = 0
    
    # Safe console operations with error handling
    $cursorVisible = $true
    
    try {
        $cursorVisible = [Console]::CursorVisible
        [Console]::CursorVisible = $false
    } catch {
        Write-ColorMessage -Message "Warning: Cannot control cursor visibility in this environment" -Type "Warning"
    }
    
    try {
        $originalForeground = [Console]::ForegroundColor
        $originalBackground = [Console]::BackgroundColor
    } catch {
        Write-ColorMessage -Message "Warning: Cannot get console colors in this environment" -Type "Warning"
        # Use safe default values instead of calling failed API again
        $originalForeground = [ConsoleColor]::Gray
        $originalBackground = [ConsoleColor]::Black
    }

    function Draw-Menu {
        Clear-Host
        Write-ColorMessage -Message "Current system: $($script:SYSTEM_VERSION)" -Type "Info"
        Write-ColorMessage -Message "PATH management method: $($script:PATH_MANAGEMENT_METHOD)" -Type "Info"
        Write-ColorMessage -Message "Select an option (Up/Down to move, Left/Right to change value, Enter to select)" -Type "Info"
        Write-ColorMessage -Message "Press Ctrl+C to exit" -Type "Info"
        
        for ($i = 0; $i -lt $script:MenuItems.Count; $i++) {
            $item = $script:MenuItems[$i]
            $currentValue = $item.Values[$item.CurrentValueIndex]
            
            $valueDisplay = ""
            if ($item.Values.Count -gt 1 -or $currentValue -ne "default") {
                $valueDisplay = " [$currentValue]"
            }
            
            if ($i -eq $selectedIndex) {
                Write-Host -NoNewline ">"
                Write-Host -NoNewline -ForegroundColor Black -BackgroundColor White (
                    "{0,-40}{1}" -f " $($item.Text)", $valueDisplay
                )
                Write-Host ""
            }
            else {
                Write-Host (" {0,-40}{1}" -f " $($item.Text)", $valueDisplay)
            }
        }
    }

    while ($true) {
        return (Invoke-InteractiveMenu -Items $script:MenuItems -Title "Select an option (Up/Down to move, Left/Right to change value, Enter to select)" -EnableValueToggle $true)
    }
}

function Start-MainLoop {
    Write-ColorMessage -Message "Initialization complete!" -Type "Success"
    
    # Pause before showing menu
    Write-Host ""
    Write-Host "Press Enter to continue, or any other key to pause (auto-continue in 5 seconds)..." -ForegroundColor Yellow
    
    # Improved timeout-based pause with better compatibility
    $timeout = 5
    Write-Host "Auto-continuing in " -NoNewline -ForegroundColor Cyan
    
    # Countdown with non-blocking key check
    for ($i = $timeout; $i -gt 0; $i--) {
        Write-Host "$i " -NoNewline -ForegroundColor Cyan
        
        # Check for key press without blocking
        if ([Console]::KeyAvailable) {
            $key = [Console]::ReadKey($true)
            Write-Host ""
            if ($key.Key -eq 'Enter') {
                # Enter pressed - continue immediately
                break
            } else {
                # Any other key pauses
                Write-Host "Paused. Press Enter to continue..." -ForegroundColor Cyan
                Read-Host
                break
            }
        }
        
        Start-Sleep -Seconds 1
    }
    
    Write-Host ""

    while ($true) {
        Clear-Host
        Detect-SystemVersion
        Write-ColorMessage -Message "Current system: $($script:SYSTEM_VERSION)" -Type "Info"
        
        $selectedIndex = Show-InteractiveMenu
        $selectedItem = $script:MenuItems[$selectedIndex]
        $selectedValue = $selectedItem.Values[$selectedItem.CurrentValueIndex]
        
        Write-ColorMessage -Message "Selected: $($selectedItem.Text) [$selectedValue]" -Type "Info"
        & $selectedItem.Action
        
        Write-ColorMessage -Message "Press 'q' to quit, any other key to continue..." -Type "Info"
        try {
            $key = [Console]::ReadKey($true)
            if ($key.KeyChar -eq 'q') {
                Write-ColorMessage -Message "Exiting script..." -Type "Info"
                exit
            }
        } catch {
            Write-ColorMessage -Message "Console input not available, using fallback" -Type "Warning"
            $userInput = Read-Host "Type 'q' to quit or press Enter to continue"
            if ($userInput -eq 'q') {
                Write-ColorMessage -Message "Exiting script..." -Type "Info"
                exit
            }
        }
    }
}

function Show-WSLUbuntuSubMenu {
    $wslMenuScript = Join-Path $script:PS_CURENT_DIR "menu_itemshells\WSLUbuntuManager.ps1"
    Write-ColorMessage -Message "Launching WSL Ubuntu Management..." -Type "Info"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $wslMenuScript
}

function Set-CommonEnvironmentVariables {
    <#
    .SYNOPSIS
        Sets common environment variables for Claude Code and other AI tools
    
    .DESCRIPTION
        This function sets essential environment variables to prevent Claude Code 
        auto-updates and configure other AI tools properly. It's called during 
        dd.ps1 initialization to ensure consistent environment across all tools.
    #>
    Write-ColorMessage -Message "Setting common environment variables..." -Type "Info"
    
    try {
        # Claude Code configuration - disable auto-updates
        $env:DISABLE_AUTOUPDATER = "1"
        $env:CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1"
        Write-ColorMessage -Message "Set DISABLE_AUTOUPDATER=1 (Claude Code auto-update disabled)" -Type "Success"
        Write-ColorMessage -Message "Set CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1" -Type "Success"
        
        # Python UTF-8 configuration
        $env:PYTHONIOENCODING = "utf-8"
        $env:PYTHONUTF8 = "1"
        Write-ColorMessage -Message "Set Python UTF-8 encoding variables" -Type "Success"
        
        # Locale configuration
        $env:LC_ALL = "C.UTF-8"
        Write-ColorMessage -Message "Set LC_ALL=C.UTF-8" -Type "Success"
        
        # Add project root to environment if not already set
        if (-not $env:CORE_NODE_PROJECT_ROOT -and $Global:CORE_NODE_DIR) {
            $env:CORE_NODE_PROJECT_ROOT = $Global:CORE_NODE_DIR
            Write-ColorMessage -Message "Set CORE_NODE_PROJECT_ROOT=$($Global:CORE_NODE_DIR)" -Type "Success"
        }
        
        Write-ColorMessage -Message "Common environment variables configured successfully" -Type "Success"
        
    } catch {
        Write-ColorMessage -Message "Warning: Failed to set some environment variables: $($_.Exception.Message)" -Type "Warning"
    }
}

function Show-SpecialSoftwareEnvMenu {
    $specialEnvManagerScript = Join-Path $script:PS_CURENT_DIR "menu_itemshells\dd.ps1"
    Write-ColorMessage -Message "Launching Special Software Environment Variables Manager..." -Type "Info"
    # Execute the Python launcher
    & $specialEnvManagerScript
}



#region Main Execution
Initialize-Environment
Set-CommonEnvironmentVariables
Check-AdminPrivileges

# Load common functions
$commonFuncPath = Join-Path $script:PS_CURENT_DIR "win_common\CommonFunc.ps1"
. $commonFuncPath

# Skip initialization operations if SkipInitialization parameter is provided
# This is used when returning from other scripts to avoid redundant processing
if (-not $SkipInitialization) {
    Write-ColorMessage -Message "Performing full initialization..." -Type "Info"
    Ensure-LineEndings
    Process-Directories
    Initialize-GlobalVarDir
    Ensure-GlobalVarsEncoding
    Store-GlobalPaths
    Make-PsExecutable
    Create-Symlink
    
    # Check and ensure desktop shortcut exists
    $shortcutCheckScript = Join-Path $Global:CORE_NODE_DIR "pycore\pyutils\launcher\shortcut_check.ps1"
    if (Test-Path $shortcutCheckScript) {
        Write-ColorMessage -Message "Checking desktop shortcut..." -Type "Info"
        try {
            & powershell -NoProfile -ExecutionPolicy Bypass -File $shortcutCheckScript
            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "Desktop shortcut check completed" -Type "Success"
            } else {
                Write-ColorMessage -Message "Desktop shortcut check completed with warnings" -Type "Warning"
            }
        } catch {
            Write-ColorMessage -Message "Failed to check desktop shortcut: $($_.Exception.Message)" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "Shortcut check script not found: $shortcutCheckScript" -Type "Warning"
    }
} else {
    Write-ColorMessage -Message "Skipping initialization operations (returning from sub-menu)..." -Type "Info"
}

# Check execution mode and handle accordingly BEFORE showing menu
if ($Global:EXECUTION_MODE -eq "INSTALLATION") {
    Write-ColorMessage -Message "Installation Mode detected. Launching initialization menu..." -Type "Info"
    
    # InitializationManager.ps1 is already loaded, just execute its logic
    # The InitializationManager.ps1 will handle its own menu and execution
    exit 0
}

Initialize-MenuItems
Start-MainLoop
