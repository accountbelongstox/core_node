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
    Management & Backup Menu (merged dispatcher)
.DESCRIPTION
    Single entry point that groups the previously separate "Windows Management"
    and "Backup Management" top-level menus into one menu with sub-menus:
      - Windows Management : WindowsManagementManager.ps1
      - Backup Management  : BackupManager.ps1 (core_node / dev env / Claude /
                             Python runtime & models)
    Arrow keys to move, Enter to select.
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_COMMON_DIR = Join-Path (Split-Path $script:PS_CURRENT_DIR -Parent) "win_common"
$script:WINDOWS_MANAGEMENT_SCRIPT = Join-Path $script:PS_CURRENT_DIR "WindowsManagementManager.ps1"
$script:BACKUP_MANAGEMENT_SCRIPT = Join-Path $script:PS_CURRENT_DIR "BackupManager.ps1"

$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
$script:COLOR_HIGHLIGHT = "Cyan"
#endregion

#region Bootstrap
. (Join-Path $script:WIN_COMMON_DIR "CommonFunc.ps1")
#endregion

#region Helper Functions
function Write-ColorMessage {
    param(
        [Parameter(Mandatory=$true)] [string]$Message,
        [Parameter()] [string]$Type = "Info"
    )

    $color = $script:COLOR_INFO
    $prefix = "[*] "

    if ($Type -eq "Success") {
        $color = $script:COLOR_SUCCESS
        $prefix = "[+] "
    } elseif ($Type -eq "Warning") {
        $color = $script:COLOR_WARNING
        $prefix = "[!] "
    } elseif ($Type -eq "Error") {
        $color = $script:COLOR_ERROR
        $prefix = "[X] "
    }

    Write-Host "$prefix$Message" -ForegroundColor $color
}

function Test-MenuItemIsHeader {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$MenuItem
    )

    return ($MenuItem.ContainsKey('IsHeader') -and $MenuItem.IsHeader -eq $true)
}

function Invoke-SubMenuScript {
    param(
        [Parameter(Mandatory=$true)] [string]$ScriptPath,
        [Parameter(Mandatory=$true)] [string]$Description
    )

    if (Test-Path $ScriptPath) {
        Write-ColorMessage -Message "Launching $Description..." -Type "Info"
        Write-Host ""
        & $ScriptPath
        Wait-MenuContinue
    } else {
        Write-ColorMessage -Message "Script not found: $ScriptPath" -Type "Error"
        Wait-MenuContinue
    }
}
#endregion

#region Menu System
function Show-ManagementAndBackupMenu {
    $menuItems = @(
        @{
            Text = "Windows Management"
            IsHeader = $false
            Action = { Invoke-SubMenuScript -ScriptPath $script:WINDOWS_MANAGEMENT_SCRIPT -Description "Windows Management Menu" }
        },
        @{
            Text = "Backup Management"
            IsHeader = $false
            Action = { Invoke-SubMenuScript -ScriptPath $script:BACKUP_MANAGEMENT_SCRIPT -Description "Backup Management Menu" }
        },
        @{
            Text = "------------------------------------"
            IsHeader = $true
            Action = { }
        },
        @{
            Text = "Back to main menu"
            IsHeader = $false
            Action = { return $true }
        },
        @{
            Text = "Exit"
            IsHeader = $false
            Action = { exit }
        }
    )

    $selectedIndex = 0
    while (Test-MenuItemIsHeader -MenuItem $menuItems[$selectedIndex]) {
        $selectedIndex++
    }

    while ($true) {
        Clear-Host
        Write-Host ""
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-ColorMessage -Message "       Management & Backup Menu" -Type "Info"
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-Host ""

        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if (Test-MenuItemIsHeader -MenuItem $menuItems[$i]) {
                Write-Host $menuItems[$i].Text -ForegroundColor DarkGray
            }
            elseif ($i -eq $selectedIndex) {
                Write-Host -NoNewline "  > " -ForegroundColor $script:COLOR_HIGHLIGHT
                Write-Host $menuItems[$i].Text -ForegroundColor Black -BackgroundColor White
            } else {
                Write-Host "    $($menuItems[$i].Text)"
            }
        }

        Write-Host ""
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-Host ""
        Write-Host "Use arrow keys to navigate, Enter to select" -ForegroundColor $script:COLOR_HIGHLIGHT

        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

        switch ($key.VirtualKeyCode) {
            38 {
                do {
                    $selectedIndex--
                    if ($selectedIndex -lt 0) { $selectedIndex = $menuItems.Count - 1 }
                } while (Test-MenuItemIsHeader -MenuItem $menuItems[$selectedIndex])
            }
            40 {
                do {
                    $selectedIndex++
                    if ($selectedIndex -ge $menuItems.Count) { $selectedIndex = 0 }
                } while (Test-MenuItemIsHeader -MenuItem $menuItems[$selectedIndex])
            }
            13 {
                if (-not (Test-MenuItemIsHeader -MenuItem $menuItems[$selectedIndex])) {
                    $result = & $menuItems[$selectedIndex].Action
                    if ($result -eq $true) { return }
                }
            }
        }
    }
}
#endregion

#region Main Execution
Show-ManagementAndBackupMenu
#endregion
