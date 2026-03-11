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
    This parameter is used when returning from other scripts (like unified_manager_windows.ps1) to avoid redundant processing
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

# Import GitManagementFunctions.psm1 for unified Git management (calls Python version)
$gitManagementFunctionsPath = Join-Path $PSScriptRoot "win_common\GitManagementFunctions.psm1"
# Resolve path to absolute path to handle execution from different directories
$gitManagementFunctionsPath = Resolve-Path $gitManagementFunctionsPath -ErrorAction SilentlyContinue
if ($null -ne $gitManagementFunctionsPath -and (Test-Path $gitManagementFunctionsPath)) {
    try {
        Import-Module $gitManagementFunctionsPath -Force -ErrorAction Stop
    } catch {
        Write-ColorMessage -Message "Warning: Failed to import GitManagementFunctions.psm1: $_" -Type "Warning"
    }
} else {
    Write-ColorMessage -Message "Warning: GitManagementFunctions.psm1 not found. Git management features may be limited." -Type "Warning"
}

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
            $unifiedManagerScript = Join-Path $Global:CORE_NODE_SCRIPTS_DIR "app_manager\windows_ps1\app_manager.ps1"
            $shellCandidates = @('pwsh', 'powershell')
            $shellExecutable = $null

            foreach ($candidateShell in $shellCandidates) {
                if (Get-Command $candidateShell -ErrorAction SilentlyContinue) {
                    $shellExecutable = $candidateShell
                    break
                }
            }

            if ($null -eq $shellExecutable) {
                Write-ColorMessage -Message "Error: No compatible PowerShell executable found to run app_manager.ps1" -Type "Error"
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
        Text              = "MCP Management"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = $null
        Action            = {
            $mcpMenuScript = Join-Path $script:PS_CURENT_DIR "menu_itemshells\MCPManagementMenu.ps1"
            Write-ColorMessage -Message "Launching MCP Management Menu..." -Type "Info"
            & powershell -NoProfile -ExecutionPolicy Bypass -File $mcpMenuScript
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
    
    # Validate Items parameter
    if ($null -eq $Items -or $Items.Count -eq 0) {
        Write-ColorMessage -Message "Error: Menu items are not initialized or empty" -Type "Error"
        return -1
    }
    
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

    try {
        # First call - execute initialization
        Write-ColorMessage -Message "First call to WindowsPathFunction - performing initialization" -Type "Info"
        & $windowsPathFunctionPath -action "add" -param1 $PROJECT_DIR
        Write-ColorMessage -Message "Added PROJECT_DIR to PATH: $PROJECT_DIR" -Type "Success"

        # Subsequent calls - skip initialization
        Write-ColorMessage -Message "Subsequent calls - skipping initialization" -Type "Info"
        & $windowsPathFunctionPath -action "add" -param1 $PROJECT_SCRIPTS_DIR -SkipInit
        Write-ColorMessage -Message "Added PROJECT_SCRIPTS_DIR to PATH: $PROJECT_SCRIPTS_DIR" -Type "Success"

        # Refresh environment variables - skip initialization
        & $windowsPathFunctionPath -action "refresh-bat" -SkipInit
        Write-ColorMessage -Message "Environment variables refresh batch created" -Type "Success"
    } catch {
        Write-ColorMessage -Message "Warning: Failed to configure environment: $($_.Exception.Message)" -Type "Warning"
        Write-ColorMessage -Message "Continuing with initialization..." -Type "Info"
    }
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


# DEPRECATED: Create-Symlink function is no longer used
# Instead of creating a symlink at C:\Program Files\dd.ps1,
# we add PROJECT_DIR to PATH so dd.cmd can be run from anywhere
# This function is kept for reference but should not be called
function Create-Symlink {
    Write-ColorMessage -Message "Create-Symlink is deprecated. PROJECT_DIR is added to PATH instead." -Type "Warning"
    return

    # Old implementation (deprecated):
    # if (Test-Path $script:script_symlink_path) {
    #     if ((Get-Item $script:script_symlink_path).LinkType -ne "SymbolicLink" -or
    #         (Get-Item $script:script_symlink_path).Target -ne $script:script_path) {
    #         Write-ColorMessage -Message "Removing existing $($script:script_symlink_path) as it is not a symlink to the current script." -Type "Warning"
    #         Remove-Item $script:script_symlink_path -Force
    #     }
    # }
    # if (-not (Test-Path $script:script_symlink_path)) {
    #     $null = New-Item -ItemType SymbolicLink -Path $script:script_symlink_path -Target $script:script_path -Force
    #     Write-ColorMessage -Message "Symbolic link created: $($script:script_symlink_path) -> $($script:script_path)" -Type "Success"
    # }
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
    Write-ColorMessage -Message "Auto-skipping backup (non-interactive mode)." -Type "Info"
}

function Invoke-GitCommitAllChanges {
    param(
        [Parameter()] [string]$DefaultMessage = "chore: save local changes"
    )
    Set-Location $CORE_NODE_DIR
    $statusOutput = git status --porcelain
    if (-not [string]::IsNullOrWhiteSpace($statusOutput)) {
        Write-ColorMessage -Message "Local changes detected. Auto-committing..." -Type "Info"
        git add .
        git commit -m $DefaultMessage
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
    Write-ColorMessage -Message "Auto-executing git pull (non-interactive mode)..." -Type "Info"

    Invoke-GitBackupPrompt
    Invoke-GitCommitAllChanges
    Invoke-RegionAwarePull

    if ($LASTEXITCODE -eq 0) {
        Write-ColorMessage -Message "Git pull operation completed successfully!" -Type "Success"
        Make-PsExecutable
    } else {
        Write-ColorMessage -Message "Git pull operation failed" -Type "Error"
    }
}

function Show-InstallerSubMenu {
    $subItems = @(
        @{
            Text = "Run DevInstaller";
            Values = @("default");
            CurrentValueIndex = 0;
            Key = "INSTALL_TYPE";
            Action = {
                $installType = $subItems[0].Values[$subItems[0].CurrentValueIndex]
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
                & $script:LOCAL_TEST_INSTALLER_SCRIPT
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

    # Validate subItems array
    if ($null -eq $subItems -or $subItems.Count -eq 0) {
        Write-ColorMessage -Message "Error: Sub-menu items are not initialized" -Type "Error"
        return
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
    # Validate MenuItems before proceeding
    if ($null -eq $script:MenuItems -or $script:MenuItems.Count -eq 0) {
        Write-ColorMessage -Message "Error: Menu items are not initialized. Please check script initialization." -Type "Error"
        return -1
    }
    
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
    Write-Host "Press Enter to continue, or any other key to pause (auto-continue in 3 seconds)..." -ForegroundColor Yellow

    # Improved timeout-based pause with better compatibility
    $timeout = 3
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
        if ($selectedIndex -lt 0 -or $null -eq $script:MenuItems -or $selectedIndex -ge $script:MenuItems.Count) {
            Write-ColorMessage -Message "Error: Invalid menu selection or menu items not initialized" -Type "Error"
            Read-Host "Press Enter to exit"
            exit 1
        }
        
        $selectedItem = $script:MenuItems[$selectedIndex]
        if ($null -eq $selectedItem -or $null -eq $selectedItem.Values -or $selectedItem.Values.Count -eq 0) {
            Write-ColorMessage -Message "Error: Selected menu item is invalid" -Type "Error"
            Read-Host "Press Enter to continue"
            continue
        }
        
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

# Set working directory to project directory
if (Test-Path $Global:PROJECT_DIR) {
    Set-Location $Global:PROJECT_DIR
    Write-ColorMessage -Message "Working directory set to: $Global:PROJECT_DIR" -Type "Info"
} else {
    Write-ColorMessage -Message "WARNING: Project directory not found: $Global:PROJECT_DIR" -Type "Warning"
}

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
    # PROJECT_DIR is already added to PATH by Set-ProjectEnvironmentVariables
    # This allows running dd.cmd from anywhere without creating symlinks or syncing scripts

    # Check and ensure desktop shortcut exists
    $shortcutCheckScript = Join-Path $Global:CORE_NODE_DIR "pycore\pyutils\launcher\shortcut_check.ps1"
    if (Test-Path $shortcutCheckScript) {
        Write-ColorMessage -Message "Checking desktop shortcut..." -Type "Info"
        try {
            & powershell -NoProfile -ExecutionPolicy Bypass -File $shortcutCheckScript
        } catch {
            Write-ColorMessage -Message "Failed to check desktop shortcut: $($_.Exception.Message)" -Type "Warning"
        }
    } else {
        Write-ColorMessage -Message "Shortcut check script not found: $shortcutCheckScript" -Type "Warning"
    }

    # Check for encrypted secrets and prompt for decryption
    $secretDecryptCheckScript = Join-Path $script:PS_CURENT_DIR "win_common\SecretDecryptionCheck.ps1"
    & powershell -NoProfile -ExecutionPolicy Bypass -File $secretDecryptCheckScript
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
