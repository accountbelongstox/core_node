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
    Development Environment Backup Manager
.DESCRIPTION
    Provides backup functionality for development environment including:
    - D:\applications directory
    - OS-specific development environments
    - Incremental backup strategy
    - Multi-drive selection
#>

#region Variable Declarations
$script:PS_CURRENT_DIR = $PSScriptRoot
$script:WIN_DIR = Split-Path $script:PS_CURRENT_DIR -Parent
$script:SHELLS_DIR = Split-Path $script:WIN_DIR -Parent
$script:SCRIPTS_DIR = Split-Path $script:SHELLS_DIR -Parent
$script:WIN_COMMON_DIR = Join-Path $script:WIN_DIR "win_common"
$script:PYTOOLS_DIR = Join-Path $script:SCRIPTS_DIR "pytools"
$script:PYBACKUP_DIR = Join-Path $script:PYTOOLS_DIR "pybackup"
$script:DEV_ENV_DIR = Join-Path $script:PYBACKUP_DIR "dev_env"
$script:DEV_ENV_BACKUP_SCRIPT = Join-Path $script:DEV_ENV_DIR "backup_dev_env.py"

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

#region Main Function
function Show-DevEnvBackupMenu {
    Write-ColorMessage -Message "========================================" -Type "Info"
    Write-ColorMessage -Message "Development Environment Backup" -Type "Info"
    Write-ColorMessage -Message "========================================" -Type "Info"
    Write-ColorMessage -Message "WARNING: This backup process may take a considerable amount of time." -Type "Warning"
    Write-ColorMessage -Message "The system will:" -Type "Info"
    Write-ColorMessage -Message "  1. Scan all available drives (except C:)" -Type "Info"
    Write-ColorMessage -Message "  2. Backup D:\applications directory" -Type "Info"
    Write-ColorMessage -Message "  3. Backup OS-specific development environments" -Type "Info"
    Write-ColorMessage -Message "  4. Use incremental backup strategy" -Type "Info"
    Write-ColorMessage -Message "========================================" -Type "Info"
    Write-Host ""

    $confirmation = Read-Host "Type 'yes' to start the backup process"

    if ($confirmation -ne "yes") {
        Write-ColorMessage -Message "Backup cancelled by user." -Type "Warning"
        Read-Host "Press Enter to continue"
        return
    }

    if (Test-Path $script:DEV_ENV_BACKUP_SCRIPT) {
        Write-ColorMessage -Message "Starting Development Environment Backup..." -Type "Success"
        Write-ColorMessage -Message "Backup started at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -Type "Info"
        Write-ColorMessage -Message "Python script path: $script:DEV_ENV_BACKUP_SCRIPT" -Type "Info"
        Write-Host ""

        try {
            & python $script:DEV_ENV_BACKUP_SCRIPT
            Write-Host ""
            Write-ColorMessage -Message "Backup completed at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -Type "Success"
        } catch {
            Write-ColorMessage -Message "Error running dev env backup script: $($_.Exception.Message)" -Type "Error"
        }
        Read-Host "Press Enter to continue"
    } else {
        Write-ColorMessage -Message "Error: backup_dev_env.py script not found at: $script:DEV_ENV_BACKUP_SCRIPT" -Type "Error"
        Write-ColorMessage -Message "Please check if the backup script is properly installed" -Type "Info"
        Write-ColorMessage -Message "Expected location: $script:DEV_ENV_BACKUP_SCRIPT" -Type "Info"
        Read-Host "Press Enter to continue"
    }
}
#endregion

Show-DevEnvBackupMenu
