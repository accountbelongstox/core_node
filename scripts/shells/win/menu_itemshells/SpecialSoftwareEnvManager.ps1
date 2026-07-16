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

<#
.SYNOPSIS
    Special Software Environment Variables Management Menu
.DESCRIPTION
    Provides a menu interface for setting environment variables for special software like AI tools
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
$script:COMMON_FUNC_PATH = Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1"
$script:WINDOWS_PATH_FUNCTION_PATH = Join-Path $script:WIN_COMMON_DIR "WindowsPathFunction.ps1"
$script:COMMAND_GENERATOR_PATH = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "tools\CommandContentGenerator.ps1"
$script:SECRET_MANAGER_PATH = Join-Path $script:WIN_COMMON_DIR "SecretManager.ps1"

$script:MENU_FUNC_DIR = Join-Path $script:PS_CURRENT_DIR "menu_func"
$script:COMMON_MENU_PATH = Join-Path $script:MENU_FUNC_DIR "spacial_common_menu.ps1"
$script:CLAUDE_MENU_PATH = Join-Path $script:MENU_FUNC_DIR "ai_claude_menu.ps1"
$script:OPENAI_MENU_PATH = Join-Path $script:MENU_FUNC_DIR "ai_openai_menu.ps1"
$script:DROID_MENU_PATH = Join-Path $script:MENU_FUNC_DIR "ai_droid_menu.ps1"
$script:SSH_MENU_PATH = Join-Path $script:MENU_FUNC_DIR "ssh_menu.ps1"

# Global variables for file management
$script:SelectedFileAction = $null
$script:SelectedFileText = $null
$script:SelectedFileIndex = -1
$script:IsReplacingFile = $false
$script:TargetFilePath = $null

# Global variables for current operation
$script:CurrentConfigName = $null
$script:CurrentConfig = $null
$script:CurrentCommandPrefix = $null
$script:CurrentFileNumber = 1
$script:CurrentWinEnvsDir = $null
$script:CurrentFileName = $null
$script:CurrentBatchContent = $null
$script:CurrentPsCommand = $null
$script:InputTypeIndexTracker = @{}
$script:UserInputValues = @{}

# Environment configurations - will be populated by modules
$script:EnvironmentConfigs = @{}

# Load common functions
. $script:COMMON_FUNC_PATH
. $script:WINDOWS_PATH_FUNCTION_PATH
. $script:COMMAND_GENERATOR_PATH
. $script:SECRET_MANAGER_PATH

# Load common menu module
. $script:COMMON_MENU_PATH

# Load AI tool menu modules
. $script:CLAUDE_MENU_PATH
. $script:OPENAI_MENU_PATH
. $script:DROID_MENU_PATH

# Load SSH menu module
. $script:SSH_MENU_PATH

# Initialize configurations from modules
$script:EnvironmentConfigs["Claude AI"] = Get-ClaudeConfig
$script:EnvironmentConfigs["Codex CLI"] = Get-CodexConfig
$script:EnvironmentConfigs["Factory AI Droid"] = Get-DroidConfig
$script:EnvironmentConfigs["SSH Connection"] = Get-SSHConfig

#endregion

#region Configuration Mapping
$script:ActionToConfigMapping = @{
    'claude' = 'Claude AI'
    'droid' = 'Factory AI Droid'
    'codex' = 'Codex CLI'
    'ssh' = 'SSH Connection'
}

function Get-FullConfigName {
    param(
        [Parameter(Mandatory=$true)] [string]$Action
    )
    
    if ($script:ActionToConfigMapping.ContainsKey($Action)) {
        return $script:ActionToConfigMapping[$Action]
    }
    return $Action
}
#endregion

#region Main Menu Functions
function Show-SpecialSoftwareEnvMenu {
    $menuItems = @()
    
    foreach ($configName in $script:EnvironmentConfigs.Keys) {
        $config = $script:EnvironmentConfigs[$configName]
        $action = $config.Common
        $menuItems += @{ 
            Text = $config.DisplayName; 
            Action = $action; 
            HasSubMenu = $true 
        }
    }
    
    $menuItems += @{ Text = "View All Environment Variables"; Action = "viewall"; HasSubMenu = $false }
    $menuItems += @{ Text = "Refresh Current Terminal Environment"; Action = "refresh"; HasSubMenu = $false }
    $menuItems += @{ Text = "Back to Main Menu"; Action = "back"; HasSubMenu = $false }
    $menuItems += @{ Text = "Exit"; Action = "exit"; HasSubMenu = $false }
    
    $selectedIndex = 0
    
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "Special Software Environment Variables Manager" -Type "Info"
        Write-ColorMessage -Message "Use Up/Down arrows to navigate, Enter to select" -Type "Info"
        Write-ColorMessage -Message "=" -Type "Info"
        
        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($i -eq $selectedIndex) {
                if ($menuItems[$i].HasSubMenu) {
                    Write-Host "> $($menuItems[$i].Text) >" -ForegroundColor Yellow
                } else {
                    Write-Host "> $($menuItems[$i].Text)" -ForegroundColor Yellow
                }
            } else {
                if ($menuItems[$i].HasSubMenu) {
                    Write-Host "  $($menuItems[$i].Text) >" -ForegroundColor White
                } else {
                    Write-Host "  $($menuItems[$i].Text)" -ForegroundColor White
                }
            }
        }
        
        $key = [Console]::ReadKey($true).Key
        
        switch ($key) {
            'UpArrow' {
                $selectedIndex = if ($selectedIndex -gt 0) { $selectedIndex - 1 } else { $menuItems.Count - 1 }
            }
            'DownArrow' {
                $selectedIndex = if ($selectedIndex -lt $menuItems.Count - 1) { $selectedIndex + 1 } else { 0 }
            }
            'Enter' {
                $action = $menuItems[$selectedIndex].Action
                $hasSubMenu = $menuItems[$selectedIndex].HasSubMenu
                
                if ($hasSubMenu) {
                    switch ($action) {
                        'claude' { Show-ClaudeSubMenu }
                        'codex' { Show-CodexSubMenu }
                        'droid' { Show-DroidSubMenu }
                        'ssh' { Show-SSHSubMenu }
                        default {
                            Write-ColorMessage -Message "Unknown menu action: $action" -Type "Error"
                            Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
                            $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
                        }
                    }
                } else {
                    switch ($action) {
                        'viewall' { Show-AllEnvironmentVariables }
                        'refresh' { Refresh-CurrentTerminalEnvironment }
                        'back' { return }
                        'exit' { exit }
                    }
                }
            }
        }
    }
}
#endregion

#region Main Execution
if (-not (Test-AdminPrivileges)) {
    Write-ColorMessage -Message "This script requires administrator privileges." -Type "Error"
    Write-ColorMessage -Message "Please run as administrator to manage system environment variables." -Type "Warning"
    Write-ColorMessage -Message "Press any key to continue..." -Type "Info"
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

Show-SpecialSoftwareEnvMenu
#endregion
