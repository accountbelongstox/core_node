<#
.SYNOPSIS
    Backup actions
.DESCRIPTION
    Backup, list and restore actions dot-sourced by ManagementAndBackupManager.ps1
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_DIR = Split-Path $script:PS_CURRENT_DIR -Parent
$script:SHELLS_DIR = Split-Path $script:WIN_DIR -Parent
$script:SCRIPT_DIR = Split-Path $script:SHELLS_DIR -Parent
$script:CORE_NODE_DIR = Split-Path $script:SCRIPT_DIR -Parent
$script:WIN_COMMON_DIR = Join-Path $script:WIN_DIR "win_common"

$script:COLOR_SUCCESS = "Green"
$script:COLOR_WARNING = "Yellow"
$script:COLOR_ERROR = "Red"
$script:COLOR_INFO = "White"
$script:COLOR_HIGHLIGHT = "Cyan"
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

    Write-Host -ForegroundColor $color "$prefix$Message"
}

function Invoke-ScriptAndPause {
    param(
        [Parameter(Mandatory=$true)] [string]$ScriptPath,
        [Parameter()] [string]$Description = "script",
        [Parameter()] [string]$Action = "",
        [Parameter()] [switch]$AutoConfirm
    )

    if (Test-Path $ScriptPath) {
        Write-ColorMessage -Message "Launching $Description..." -Type "Info"
        Write-Host ""

        try {
            if ($Action) {
                if ($AutoConfirm) {
                    & python $ScriptPath --action $Action --auto-confirm
                } else {
                    & python $ScriptPath --action $Action
                }
            } else {
                & python $ScriptPath
            }
            Write-Host ""
            Write-Host "========================================" -ForegroundColor $script:COLOR_INFO
            Write-ColorMessage -Message "Script completed" -Type "Success"
            Write-Host "========================================" -ForegroundColor $script:COLOR_INFO
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        } catch {
            Write-Host ""
            Write-ColorMessage -Message "Error running script: $($_.Exception.Message)" -Type "Error"
            Write-Host ""
            Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    } else {
        Write-ColorMessage -Message "Error: Script not found at: $ScriptPath" -Type "Error"
        Write-ColorMessage -Message "Please check if the script is properly installed" -Type "Info"
        Write-Host ""
        Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}
#endregion

#region Backup Functions
# Core Node Project Backups
function Backup-CurrentProject {
    Write-Host ""
    Write-ColorMessage -Message "Core Node Project Backup" -Type "Info"
    Write-Host "========================================" -ForegroundColor $script:COLOR_INFO
    Write-ColorMessage -Message "Source: $script:CORE_NODE_DIR" -Type "Info"

    $backupParentDir = Split-Path $script:CORE_NODE_DIR -Parent
    Write-ColorMessage -Message "Destination: $backupParentDir\core_node_bak_[timestamp]" -Type "Info"
    Write-Host ""
    Write-ColorMessage -Message "Excluded:" -Type "Warning"
    Write-Host "  - node_modules, __pycache__, .git (tracked), build, dist" -ForegroundColor Gray
    Write-Host "  - .pyc, .log, .tmp, .cache files" -ForegroundColor Gray
    Write-Host "  - Compilation directories (dart, flutter, nuxt, etc.)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Do you want to proceed with backup? (Y/n): " -NoNewline -ForegroundColor $script:COLOR_HIGHLIGHT

    $confirmation = Read-Host
    if ($confirmation -eq '' -or $confirmation -eq 'Y' -or $confirmation -eq 'y') {
        $backupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\core_node\backup_manager.py"
        Invoke-ScriptAndPause -ScriptPath $backupScript -Description "Core Node Project Backup Manager" -Action "backup"
    }
    else {
        Write-ColorMessage -Message "Backup cancelled by user." -Type "Warning"
        Write-Host ""
        Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}

function List-CurrentProjectBackups {
    $backupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\core_node\backup_manager.py"
    Invoke-ScriptAndPause -ScriptPath $backupScript -Description "List Core Node Project Backups" -Action "list"
}

function Restore-CurrentProject {
    $backupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\core_node\backup_manager.py"
    Invoke-ScriptAndPause -ScriptPath $backupScript -Description "Restore Core Node Project" -Action "restore"
}
#endregion
