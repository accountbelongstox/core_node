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

#region Variable Declarations 
$script:SYSTEM_VERSION = ""
$script:SYSTEM_NAME = ""
$script:PS_CURENT_DIR = $PSScriptRoot
$script:DEFAULT_CORE_NODE_DIR = 'D:\programing\core_node'

# Derive core_node root by walking up from this script's directory (scripts/shells/win)
try {
    $candidateCore = (Get-Item $script:PS_CURENT_DIR).Parent.Parent.Parent.FullName
} catch {
    $candidateCore = $null
}

if ($candidateCore -and (Test-Path (Join-Path $candidateCore 'scripts'))) {
    $script:CORE_NODE_DIR = $candidateCore
} else {
    $script:CORE_NODE_DIR = $script:DEFAULT_CORE_NODE_DIR
}


$script:SHELLS_DIR = (Get-Item $script:PS_CURENT_DIR).Parent.FullName
$script:SCRIPT_DIR = Join-Path $script:CORE_NODE_DIR "scripts"
$script:script_symlink_path = "$env:ProgramFiles\dd.ps1"
$script:script_path = $MyInvocation.MyCommand.Path
# NOTE: Changed to match GlobalVars.ps1 path consistency - using .global_vars
$script:GLOBAL_VAR_DIR = Join-Path $env:USERPROFILE ".core_node\.global_vars"
$script:CACHE_DIR = Join-Path $env:USERPROFILE ".core_node\cache"
$script:INSTALLER_SCRIPTS_DIR = Join-Path $env:USERPROFILE ".core_node\installer_scripts"
$script:COMMON_SHELLS_DIR = Join-Path $SHELLS_DIR "common"
$script:COMMON_SCRIPTS_DIR = Join-Path $SHELLS_DIR "scripts"
$script:target_dirs = @("apps", "ncore", "scripts")
$script:MAIN_POWERSHELLS_DIR = Join-Path $script:SHELLS_DIR "win\main_powershells"

# Add color constants
$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"

# Check for EnvironmentDetection.ps1 for PATH management
$script:ENV_DETECTION_AVAILABLE = $false
$envDetectionPath = Join-Path $script:MAIN_POWERSHELLS_DIR "EnvironmentDetection.ps1"
if (Test-Path $envDetectionPath -PathType Leaf) {
    $script:ENV_DETECTION_AVAILABLE = $true
    Write-Host -ForegroundColor Green "[OK] Found EnvironmentDetection.ps1 for PATH management: $envDetectionPath"
} else {
    Write-Host -ForegroundColor Yellow "[!] EnvironmentDetection.ps1 not found: $envDetectionPath"
}

# PATH management logic - prioritize EnvironmentDetection.ps1
$script:PATH_MANAGEMENT_METHOD = "none"

if ($script:ENV_DETECTION_AVAILABLE) {
    try {
        # Use EnvironmentDetection.ps1 to add directories to PATH
        Write-Host -ForegroundColor Cyan "[*] Adding CORE_NODE_DIR to PATH using EnvironmentDetection.ps1: $script:CORE_NODE_DIR"
        & $envDetectionPath "add" $script:CORE_NODE_DIR
        
        Write-Host -ForegroundColor Cyan "[*] Adding SCRIPT_DIR to PATH using EnvironmentDetection.ps1: $script:SCRIPT_DIR"
        & $envDetectionPath "add" $script:SCRIPT_DIR
        
        # Refresh environment variables
        Write-Host -ForegroundColor Cyan "[*] Refreshing environment variables"
        & $envDetectionPath "refresh"
        
        $script:PATH_MANAGEMENT_METHOD = "EnvironmentDetection"
        Write-Host -ForegroundColor Green "[OK] Successfully managed PATH using EnvironmentDetection.ps1"
    }
    catch {
        Write-Host -ForegroundColor Yellow "[!] Failed to use EnvironmentDetection.ps1: $_"
        $script:ENV_DETECTION_AVAILABLE = $false
    }
}

# Fallback to WindowsPathFunction.ps1
if (-not $script:ENV_DETECTION_AVAILABLE) {
    $script:WINDOWS_PATH_FUNCTION_LOADED = $false
    $windowsPathFunctionPath = Join-Path $script:PS_CURENT_DIR "win_common\WindowsPathFunction.ps1"
    if (Test-Path $windowsPathFunctionPath -PathType Leaf) {
        try {
            # Test if the script can be executed by checking its parameters
            $testResult = & $windowsPathFunctionPath "help" 2>$null
            if ($LASTEXITCODE -eq 0 -or $testResult) {
                $script:WINDOWS_PATH_FUNCTION_LOADED = $true
                Write-Host -ForegroundColor Green "[OK] WindowsPathFunction.ps1 is available: $windowsPathFunctionPath"
                
                # Add CORE_NODE_DIR and SCRIPT_DIR to PATH using WindowsPathFunction.ps1
                Write-Host -ForegroundColor Cyan "[*] Adding CORE_NODE_DIR to PATH: $script:CORE_NODE_DIR"
                & $windowsPathFunctionPath "add" $script:CORE_NODE_DIR
                
                Write-Host -ForegroundColor Cyan "[*] Adding SCRIPT_DIR to PATH: $script:SCRIPT_DIR"
                & $windowsPathFunctionPath "add" $script:SCRIPT_DIR
                
                $script:PATH_MANAGEMENT_METHOD = "WindowsPathFunction"
                Write-Host -ForegroundColor Green "[OK] Successfully added directories to PATH using WindowsPathFunction.ps1"
            } else {
                Write-Host -ForegroundColor Yellow "[!] WindowsPathFunction.ps1 exists but may have issues: $windowsPathFunctionPath"
                $script:WINDOWS_PATH_FUNCTION_LOADED = $false
            }
        }
        catch {
            Write-Host -ForegroundColor Yellow "[!] Failed to test WindowsPathFunction.ps1: $_"
            $script:WINDOWS_PATH_FUNCTION_LOADED = $false
        }
    } else {
        Write-Host -ForegroundColor Yellow "[!] WindowsPathFunction.ps1 not found: $windowsPathFunctionPath"
    }
}

# Final fallback to PowerShell system settings if no PATH management tool is available
if ($script:PATH_MANAGEMENT_METHOD -eq "none") {
    Write-Host -ForegroundColor Yellow "[!] Using PowerShell system settings to add directories to PATH"
    
    # Check if directories are already in PATH before adding
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $paths = $currentPath -split ';'
    
    # Check and add CORE_NODE_DIR
    if (-not ($paths -contains $script:CORE_NODE_DIR)) {
        Write-Host -ForegroundColor Cyan "[*] Adding CORE_NODE_DIR to system PATH: $script:CORE_NODE_DIR"
        $newPath = $currentPath + ";" + $script:CORE_NODE_DIR
        [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
        Write-Host -ForegroundColor Green "[OK] Added CORE_NODE_DIR to system PATH"
    } else {
        Write-Host -ForegroundColor Yellow "[!] CORE_NODE_DIR already exists in PATH: $script:CORE_NODE_DIR"
    }
    
    # Check and add SCRIPT_DIR
    if (-not ($paths -contains $script:SCRIPT_DIR)) {
        Write-Host -ForegroundColor Cyan "[*] Adding SCRIPT_DIR to system PATH: $script:SCRIPT_DIR"
        $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")
        $newPath = $currentPath + ";" + $script:SCRIPT_DIR
        [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
        Write-Host -ForegroundColor Green "[OK] Added SCRIPT_DIR to system PATH"
    } else {
        Write-Host -ForegroundColor Yellow "[!] SCRIPT_DIR already exists in PATH: $script:SCRIPT_DIR"
    }
    
    $script:PATH_MANAGEMENT_METHOD = "PowerShell"
}

Write-Host -ForegroundColor Green "[OK] PATH management completed using: $($script:PATH_MANAGEMENT_METHOD)"

# Add system check constants
$script:SYSTEM_CHECK_CACHE_FILE = Join-Path $script:CACHE_DIR "system_check.json"
$script:SYSTEM_CHECK_CACHE_DURATION = 3 # hours

# Add new constants for software check
$script:SOFTWARE_CHECK_CACHE_FILE = Join-Path $script:CACHE_DIR "software_check.json"
$script:SOFTWARE_CHECK_CACHE_DURATION = 3 # hours

# Add script-level variables for caching
$script:SYSTEM_CHECK_RESULTS = $null
$script:SOFTWARE_STATUS_RESULTS = $null
$script:LAST_CHECK_TIME = $null

# Global variable management functions - needed early for URL switching
function Get-GlobalVar {
    param (
        [string]$Key
    )
    $filePath = Join-Path $script:GLOBAL_VAR_DIR $Key
    if (Test-Path $filePath) {
        # Read file with UTF-8 encoding without BOM
        $content = Get-Content -Path $filePath -Encoding UTF8 -TotalCount 1
        # Remove any null bytes and return
        return $content -replace "`0", ""
    }
    return $null
}

function Set-GlobalVar {
    param (
        [string]$Key,
        [string]$Value
    )
    if (-not (Test-Path $script:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $script:GLOBAL_VAR_DIR -Force | Out-Null
    }
    # Create UTF-8 encoding without BOM
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    # Remove any null bytes from the value
    $cleanValue = $Value -replace "`0", ""
    # Write content with UTF-8 encoding without BOM
    [System.IO.File]::WriteAllText((Join-Path $script:GLOBAL_VAR_DIR $Key), $cleanValue, $utf8NoBom)
}

# Function to get appropriate download base URL based on region
function Get-RegionDownloadBaseURL {
    $selectedRegion = Get-GlobalVar -Key "SELECTED_REGION"
    if ($selectedRegion -eq "Global") {
        return "https://raw.githubusercontent.com/accountbelongstox/core_node/main"
    } else {
        return "https://gitee.com/accountbelongstox/core_node/raw/main"
    }
}

# Add script source URLs and paths - Auto-switch based on region
$script:CURRENT_DOWNLOAD_BASE_URL = Get-RegionDownloadBaseURL
$script:GITEE_BASE_URL = "https://gitee.com/accountbelongstox/core_node/raw/main"  # Keep for compatibility
$script:SCRIPT_REPO_PATH = "scripts/shells/win"
$script:INSTALLER_SCRIPT_NAME = "DevInstaller.ps1"
$script:TEST_INSTALLER_SCRIPT_NAME = "TestInstaller.ps1"
$script:INSTALLER_SCRIPT_URL = "$($script:CURRENT_DOWNLOAD_BASE_URL)/$($script:SCRIPT_REPO_PATH)/$($script:INSTALLER_SCRIPT_NAME)"
$script:TEST_INSTALLER_SCRIPT_URL = "$($script:CURRENT_DOWNLOAD_BASE_URL)/$($script:SCRIPT_REPO_PATH)/$($script:TEST_INSTALLER_SCRIPT_NAME)"
$script:LOCAL_INSTALLER_SCRIPT = Join-Path $script:SHELLS_DIR "win\menu_itemshells\$($script:INSTALLER_SCRIPT_NAME)"
$script:LOCAL_TEST_INSTALLER_SCRIPT = Join-Path $script:SHELLS_DIR "win\menu_itemshells\$($script:TEST_INSTALLER_SCRIPT_NAME)"
$script:DOWNLOADED_INSTALLER_SCRIPT = Join-Path $script:INSTALLER_SCRIPTS_DIR $script:INSTALLER_SCRIPT_NAME
$script:DOWNLOADED_TEST_INSTALLER_SCRIPT = Join-Path $script:INSTALLER_SCRIPTS_DIR $script:TEST_INSTALLER_SCRIPT_NAME

# Git repository URLs
$script:GITHUB_REPO_URL = "https://github.com/accountbelongstox/core_node.git"
$script:GITEE_REPO_URL = "https://gitee.com/accountbelongstox/core_node.git"

$script:userProfile = [Environment]::GetFolderPath("UserProfile")
$script:userCacheDir = Join-Path $script:userProfile ".core_node\.cache"
$script:wslInstalledFlag = Join-Path $script:userCacheDir "WSL_Installed_flag"

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
        Text              = "Select Region"
        Values            = @("China", "Global")
        CurrentValueIndex = 0
        Key               = "SELECTED_REGION"
        Action            = { 
            $selectedValue = $script:MenuItems[1].Values[$script:MenuItems[1].CurrentValueIndex]
            Set-GlobalVar -Key "SELECTED_REGION" -Value $selectedValue
            Write-ColorMessage -Message "Region set to: $selectedValue" -Type "Success"
            
            $installConfirm = Read-Host "Do you want to proceed with installation? (y/n)"
            if ($installConfirm -eq "y") {
                $script:MenuItems[0].Action.Invoke()
            }
            else {
                Write-ColorMessage -Message "Installation cancelled. Returning to menu." -Type "Info"
            }
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
        Action            = {
            $unifiedManagerScript = Join-Path $script:SCRIPT_DIR "unified_manager\unified_manager.ps1"
            if (Test-Path $unifiedManagerScript) {
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
            } else {
                Write-ColorMessage -Message "Error: unified_manager.ps1 script not found at: $unifiedManagerScript" -Type "Error"
                Write-ColorMessage -Message "Please check if the unified manager is properly installed" -Type "Info"
                Read-Host "Press Enter to continue"
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
        Text              = "Get the latest git version"
        Values            = @("default")
        CurrentValueIndex = 0
        Key               = "GIT_UPDATE_TYPE"
        Action            = {
            Set-GlobalVar -Key "GIT_UPDATE_TYPE" -Value "default"
            Show-GitSourceSubMenu
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
function Write-ColorMessage {
    param (
        [Parameter(Mandatory = $true)]
        [string]$Message,
        
        [Parameter(Mandatory = $false)]
        [ValidateSet("Success", "Warning", "Error", "Info")]
        [string]$Type = "Info"
    )
    
    if ($Type -eq "Success") {
        $color = $script:COLOR_SUCCESS
    } elseif ($Type -eq "Warning") {
        $color = $script:COLOR_WARNING
    } elseif ($Type -eq "Error") {
        $color = $script:COLOR_ERROR
    } elseif ($Type -eq "Info") {
        $color = $script:COLOR_INFO
    } else {
        $color = $script:COLOR_INFO
    }
    
    if (-not $color) {
        $color = "White"
    }
    
    if ($Type -eq "Success") {
        $prefix = "[OK] "
    } elseif ($Type -eq "Warning") {
        $prefix = "[!] "
    } elseif ($Type -eq "Error") {
        $prefix = "[X] "
    } elseif ($Type -eq "Info") {
        $prefix = "[*] "
    } else {
        $prefix = "[*] "
    }
    
    Write-Host -ForegroundColor $color "$prefix$Message"
}

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

function Initialize-Environment {
    Write-ColorMessage -Message "CORE_NODE_DIR: $CORE_NODE_DIR" -Type "Info"
    Write-ColorMessage -Message "SCRIPT_DIR:         $SCRIPT_DIR" -Type "Info"
    Write-ColorMessage -Message "SHELLS_DIR:         $SHELLS_DIR" -Type "Info"
    Write-ColorMessage -Message "PROJECT_DIR:        $PROJECT_DIR" -Type "Info"
    Write-ColorMessage -Message "PROJECT_SCRIPTS_DIR: $PROJECT_SCRIPTS_DIR" -Type "Info"
    Write-ColorMessage -Message "PROJECT_WIN_SCRIPTS_DIR: $PROJECT_WIN_SCRIPTS_DIR" -Type "Info"
    
    # Ensure cache directory exists
    if (-not (Test-Path $script:CACHE_DIR)) {
        New-Item -ItemType Directory -Path $script:CACHE_DIR -Force | Out-Null
    }
    
    # Ensure installer scripts directory exists
    if (-not (Test-Path $script:INSTALLER_SCRIPTS_DIR)) {
        New-Item -ItemType Directory -Path $script:INSTALLER_SCRIPTS_DIR -Force | Out-Null
    }
}

function Process-PsFiles {
    param (
        [string]$dir
    )

    try{
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
    }
    catch{
        Write-ColorMessage -Message "Error setting execution policy: $_" -Type "Warning"
    }

    Get-ChildItem -Path $dir -Recurse -Filter "*.ps1" | Where-Object {
        return -not (Test-ShouldSkipFile -FilePath $_.FullName)
    } | ForEach-Object {
        $file = $_.FullName
        try{
            Unblock-File -Path $file
        }
        catch{
            Write-ColorMessage -Message "Error unblocking file: $_" -Type "Warning"
        }   
    }
}

function Ensure-LineEndings {
    foreach ($dir in $script:target_dirs) {
        $fullPath = Join-Path $script:CORE_NODE_DIR $dir
        if (Test-Path $fullPath) {
            try{
                Get-ChildItem -Path $fullPath -Recurse -Include "*.ps1", "*.sh" -ErrorAction SilentlyContinue | Where-Object {
                    return -not (Test-ShouldSkipFile -FilePath $_.FullName)
                } | ForEach-Object {
                    $content = Get-Content $_.FullName -Raw
                    $content -replace "`r`n", "`n" | Set-Content $_.FullName -NoNewline
                }
            }
            catch{
                Write-ColorMessage -Message "Error ensuring line endings: $_" -Type "Error"
            }
        }
        else {
            Write-ColorMessage -Message "Directory '$fullPath' not found. Skipping." -Type "Warning"
        }
    }
}

function Check-AdminPrivileges {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-ColorMessage -Message "This script requires administrator privileges. Please run as administrator." -Type "Error"
        exit 1
    }
}

function Process-Directories {
    foreach ($dir in $script:target_dirs) {
        $fullPath = Join-Path $script:CORE_NODE_DIR $dir
        if (Test-Path $fullPath -PathType Container) {
            Process-PsFiles $fullPath
        }
        else {
            Write-ColorMessage -Message "Directory '$fullPath' not found. Skipping." -Type "Warning"
        }
    }
    Write-ColorMessage -Message "All .ps1 files processed!" -Type "Success"
}

function Initialize-GlobalVarDir {
    if (-not (Test-Path $script:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $script:GLOBAL_VAR_DIR -Force | Out-Null
        Write-ColorMessage -Message "Created global variable directory: $($script:GLOBAL_VAR_DIR)" -Type "Success"
    }
}

function Ensure-GlobalVarsEncoding {
    if (Test-Path $script:GLOBAL_VAR_DIR) {
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        Get-ChildItem -Path $script:GLOBAL_VAR_DIR -File | ForEach-Object {
            # Read content with current encoding
            $content = Get-Content -Path $_.FullName -Raw
            if ($content) {
                # Remove any null bytes and write back with UTF-8 encoding
                $cleanContent = $content -replace "`0", ""
                [System.IO.File]::WriteAllText($_.FullName, $cleanContent, $utf8NoBom)
            }
        }
    }
}

function Get-SkipDirectories {
    # Define directories to skip when processing PowerShell scripts
    return @("node_modules", ".git", ".vscode", "bin", "obj", "packages", "dist", "build", ".nuxt", ".next", "__pycache__", ".pytest_cache", "coverage", ".nyc_output", "tmp", "temp")
}

function Test-ShouldSkipFile {
    param(
        [string]$FilePath
    )
    
    $skipDirs = Get-SkipDirectories
    foreach ($skipDir in $skipDirs) {
        if ($FilePath -like "*\$skipDir\*") {
            return $true
        }
    }
    return $false
}

function Store-GlobalPaths {
    # Store script directory path using UTF-8
    $utf8NoBom = New-Object System.Text.UTF8Encoding $false
    [System.IO.File]::WriteAllText("$($script:GLOBAL_VAR_DIR)\SCRIPT_ROOT_DIR", $script:CORE_NODE_DIR, $utf8NoBom)
}

function Make-PsExecutable {
    Get-ChildItem -Path $script:CORE_NODE_DIR -Filter "*.ps1" | ForEach-Object {
        Unblock-File -Path $_.FullName
    }
    if (Test-Path $script:SCRIPT_DIR -PathType Container) {
        Get-ChildItem -Path $script:SCRIPT_DIR -Recurse -Filter "*.ps1" | Where-Object {
            return -not (Test-ShouldSkipFile -FilePath $_.FullName)
        } | ForEach-Object {
            Unblock-File -Path $_.FullName
        }
    }
    else {
        Write-ColorMessage -Message "Directory $($script:SCRIPT_DIR) does not exist." -Type "Warning"
    }
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
    # Direct execution since gitput_unified.ps1 has automatic remote detection
    Write-ColorMessage -Message "Using automatic remote source detection based on your region settings" -Type "Info"
    Write-ColorMessage -Message "The system will automatically choose GitHub (Global region) or Gitee (China region)" -Type "Info"
    Get-LatestGitVersion
}

function Get-LatestGitVersion {
    $confirm = Read-Host "Are you sure you want to safely pull the latest git version? (yes/no)"
    if ($confirm -ne "yes") {
        Write-ColorMessage -Message "Git pull cancelled." -Type "Warning"
        return
    }
    
    Write-ColorMessage -Message "Starting SAFE git pull operation..." -Type "Info"
    $UnifiedGitScript = Join-Path $script:SCRIPT_DIR "git\gitput_unified.ps1"
    
    if (Test-Path $UnifiedGitScript) {
        Write-ColorMessage -Message "Using unified git script for safe pull: $UnifiedGitScript" -Type "Info"
        Write-ColorMessage -Message "Script will automatically select the appropriate remote source" -Type "Info"
        
        # Execute safe pull using unified script with auto remote detection
        Set-Location $CORE_NODE_DIR
        & powershell -ExecutionPolicy Bypass -File $UnifiedGitScript -Pull
        
        if ($LASTEXITCODE -eq 0) {
            Write-ColorMessage -Message "Safe git pull operation completed successfully!" -Type "Success"
            Make-PsExecutable
        } else {
            Write-ColorMessage -Message "Safe git pull operation failed. Please check the output above for resolution options." -Type "Error"
        }
    } else {
        Write-ColorMessage -Message "Error: Unified git script not found: $UnifiedGitScript" -Type "Error"
        Write-ColorMessage -Message "Please ensure the git scripts are properly installed in: $UnifiedGitScript" -Type "Info"
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
    $availableScripts = Get-ChildItem -Path $installPowershellsDir -Filter "*.ps1" -File | 
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
        $UnifiedGitScript = Join-Path $script:SCRIPT_DIR "git\gitput_unified.ps1"
        if (Test-Path $UnifiedGitScript) {
            Write-ColorMessage -Message "Running unified git push script..." -Type "Info"
            & powershell -ExecutionPolicy Bypass -File $UnifiedGitScript

            if ($LASTEXITCODE -eq 0) {
                Write-ColorMessage -Message "Git push operations completed successfully" -Type "Success"
            } else {
                Write-ColorMessage -Message "Git push operations failed" -Type "Error"
            }
        } else {
            Write-ColorMessage -Message "Error: Unified git script not found: $UnifiedGitScript" -Type "Error"
            Write-ColorMessage -Message "Please ensure the git scripts are properly installed" -Type "Info"
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
    if (-not (Test-Path $script:GLOBAL_VAR_DIR)) {
        New-Item -ItemType Directory -Path $script:GLOBAL_VAR_DIR -Force | Out-Null
        Write-ColorMessage -Message "Created global variable directory: $($script:GLOBAL_VAR_DIR)" -Type "Success"
        return
    }

    $files = Get-ChildItem -Path $script:GLOBAL_VAR_DIR -File

    if ($files.Count -eq 0) {
        Write-ColorMessage -Message "No global variables found in $($script:GLOBAL_VAR_DIR)" -Type "Warning"
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
    Start-Sleep -Seconds 1

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

    if (Test-Path $wslMenuScript) {
        Write-ColorMessage -Message "Launching WSL Ubuntu Management..." -Type "Info"
        & powershell -NoProfile -ExecutionPolicy Bypass -File $wslMenuScript
    } else {
        Write-ColorMessage -Message "Error: WSLUbuntuManager.ps1 script not found at: $wslMenuScript" -Type "Error"
        Write-ColorMessage -Message "Please check if the WSL Ubuntu manager is properly installed" -Type "Info"
        Read-Host "Press Enter to continue"
    }
}

function Show-SpecialSoftwareEnvMenu {
    $specialEnvManagerScript = Join-Path $script:PS_CURENT_DIR "menu_itemshells\SpecialSoftwareEnvManager.ps1"

    if (Test-Path $specialEnvManagerScript) {
        Write-ColorMessage -Message "Launching Special Software Environment Variables Manager..." -Type "Info"
        # Use dot-sourcing to execute in the same process
        . $specialEnvManagerScript
    } else {
        Write-ColorMessage -Message "Error: SpecialSoftwareEnvManager.ps1 script not found at: $specialEnvManagerScript" -Type "Error"
        Write-ColorMessage -Message "Please check if the special software environment manager is properly installed" -Type "Info"
        Read-Host "Press Enter to continue"
    }
}


#region Main Execution
Initialize-Environment
Check-AdminPrivileges

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
} else {
    Write-ColorMessage -Message "Skipping initialization operations (returning from sub-menu)..." -Type "Info"
}

Initialize-MenuItems
Start-MainLoop

