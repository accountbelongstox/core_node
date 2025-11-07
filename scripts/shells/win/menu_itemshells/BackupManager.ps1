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
    Backup Management Menu
.DESCRIPTION
    Provides a unified menu interface for backup operations
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
#endregion

#region Backup Functions
function Backup-CurrentProject {
    $backupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\core_node\backup_manager.py"

    if (Test-Path $backupScript) {
        Write-ColorMessage -Message "Launching Core Node Project Backup Manager..." -Type "Info"
        try {
            & python $backupScript
        } catch {
            Write-ColorMessage -Message "Error running backup script: $($_.Exception.Message)" -Type "Error"
            Read-Host "Press Enter to continue"
        }
    } else {
        Write-ColorMessage -Message "Error: backup_manager.py script not found at: $backupScript" -Type "Error"
        Write-ColorMessage -Message "Please check if the backup script is properly installed" -Type "Info"
        Read-Host "Press Enter to continue"
    }
}

function Backup-DevelopmentEnvironment {
    $devEnvBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\dev_env\backup_dev_env.py"

    if (Test-Path $devEnvBackupScript) {
        Write-ColorMessage -Message "Launching Development Environment Backup Manager..." -Type "Info"
        try {
            & python $devEnvBackupScript
        } catch {
            Write-ColorMessage -Message "Error running dev env backup script: $($_.Exception.Message)" -Type "Error"
            Read-Host "Press Enter to continue"
        }
    } else {
        Write-ColorMessage -Message "Error: backup_dev_env.py script not found at: $devEnvBackupScript" -Type "Error"
        Write-ColorMessage -Message "Please check if the dev env backup script is properly installed" -Type "Info"
        Read-Host "Press Enter to continue"
    }
}
#endregion

#region Main Menu
function Show-BackupMenu {
    while ($true) {
        Clear-Host
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-ColorMessage -Message "       Backup Management Menu" -Type "Info"
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-Host ""
        Write-Host "  1. Backup this project (core_node)"
        Write-Host "  2. Backup development environment"
        Write-Host "  3. Back to main menu"
        Write-Host "  4. Exit"
        Write-Host ""
        Write-ColorMessage -Message "========================================" -Type "Info"

        $choice = Read-Host "Please select an option (1-4)"

        switch ($choice) {
            "1" {
                Backup-CurrentProject
            }
            "2" {
                Backup-DevelopmentEnvironment
            }
            "3" {
                Write-ColorMessage -Message "Returning to main menu..." -Type "Info"
                return
            }
            "4" {
                Write-ColorMessage -Message "Exiting..." -Type "Info"
                exit
            }
            default {
                Write-ColorMessage -Message "Invalid option. Please try again." -Type "Warning"
                Start-Sleep -Seconds 1
            }
        }
    }
}
#endregion

#region Main Execution
Show-BackupMenu
#endregion
