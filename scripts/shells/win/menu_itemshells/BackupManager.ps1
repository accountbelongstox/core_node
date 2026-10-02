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

# Development Environment Backups
function Backup-DevelopmentEnvironment {
    Write-Host ""
    Write-ColorMessage -Message "Development Environment Backup" -Type "Info"
    Write-Host "========================================" -ForegroundColor $script:COLOR_INFO
    Write-Host ""
    Write-Host "Do you want to proceed with backup? (Y/n): " -NoNewline -ForegroundColor $script:COLOR_HIGHLIGHT

    $confirmation = Read-Host
    if ($confirmation -eq '' -or $confirmation -eq 'Y' -or $confirmation -eq 'y') {
        $devEnvBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\dev_env\backup_dev_env.py"
        Invoke-ScriptAndPause -ScriptPath $devEnvBackupScript -Description "Development Environment Backup Manager" -Action "backup"
    }
    else {
        Write-ColorMessage -Message "Backup cancelled by user." -Type "Warning"
        Write-Host ""
        Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}

function List-DevelopmentEnvironmentBackups {
    $devEnvBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\dev_env\backup_dev_env.py"
    Invoke-ScriptAndPause -ScriptPath $devEnvBackupScript -Description "List Development Environment Backups" -Action "list"
}

function Restore-DevelopmentEnvironment {
    $devEnvBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\dev_env\backup_dev_env.py"
    Invoke-ScriptAndPause -ScriptPath $devEnvBackupScript -Description "Restore Development Environment" -Action "restore"
}

# Claude, Codex and @anthropic-ai Backups
function Backup-ClaudeCodexAnthropic {
    Write-Host ""
    Write-ColorMessage -Message "Claude, Codex and @anthropic-ai Backup" -Type "Info"
    Write-Host "========================================" -ForegroundColor $script:COLOR_INFO
    Write-Host ""
    Write-Host "Do you want to proceed with backup? (Y/n): " -NoNewline -ForegroundColor $script:COLOR_HIGHLIGHT

    $confirmation = Read-Host
    if ($confirmation -eq '' -or $confirmation -eq 'Y' -or $confirmation -eq 'y') {
        $aiBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\claude_backup\backup_claude_anthropic.py"
        Invoke-ScriptAndPause -ScriptPath $aiBackupScript -Description "Claude, Codex and @anthropic-ai Backup Manager" -Action "backup"
    }
    else {
        Write-ColorMessage -Message "Backup cancelled by user." -Type "Warning"
        Write-Host ""
        Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}

function List-ClaudeCodexAnthropicBackups {
    $aiBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\claude_backup\backup_claude_anthropic.py"
    Invoke-ScriptAndPause -ScriptPath $aiBackupScript -Description "List Claude, Codex and @anthropic-ai Backups" -Action "list"
}

function Restore-ClaudeCodexAnthropic {
    $aiBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\claude_backup\backup_claude_anthropic.py"
    Invoke-ScriptAndPause -ScriptPath $aiBackupScript -Description "Restore Claude, Codex and @anthropic-ai" -Action "restore"
}

# Python Runtime + Models + User Data Backups
# Snapshots the actual Python install directory (parent of python.exe), all
# downloaded models and the core_node user-data root so the environment can
# be restored without re-running the installers. The Python tool prompts for
# compression (Y/n, default Y) and confirmation; restore accepts a compressed
# .tar.gz archive or an uncompressed backup directory.
function Backup-PythonEnvironment {
    Write-Host ""
    Write-ColorMessage -Message "Python Runtime + Models + User Data Backup" -Type "Info"
    Write-Host "========================================" -ForegroundColor $script:COLOR_INFO
    Write-Host "Includes:" -ForegroundColor $script:COLOR_INFO
    Write-Host "  - Python install directory (interpreter + all pip packages)" -ForegroundColor Gray
    Write-Host "  - pycore models + user data (core_node: cache/tts, cache/stt, ...)" -ForegroundColor Gray
    Write-Host "  - HuggingFace model cache (D:\www\cache\huggingface: faster-whisper, ...)" -ForegroundColor Gray
    Write-Host "  - Whisper model cache (D:\www\cache\whisper)" -ForegroundColor Gray
    Write-Host ""
    Write-ColorMessage -Message "You will be asked whether to compress the backup (.tar.gz)." -Type "Warning"
    Write-Host ""
    $pyBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\python_env\backup_python_env.py"
    Invoke-ScriptAndPause -ScriptPath $pyBackupScript -Description "Python Environment Backup Manager" -Action "backup"
}

function List-PythonEnvironmentBackups {
    $pyBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\python_env\backup_python_env.py"
    Invoke-ScriptAndPause -ScriptPath $pyBackupScript -Description "List Python Environment Backups" -Action "list"
}

function Restore-PythonEnvironment {
    $pyBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\python_env\backup_python_env.py"
    Invoke-ScriptAndPause -ScriptPath $pyBackupScript -Description "Restore Python Environment" -Action "restore"
}

# Utility Functions
function Show-BackupStatistics {
    Write-Host ""
    Write-ColorMessage -Message "Backup Statistics" -Type "Info"
    Write-Host "========================================" -ForegroundColor $script:COLOR_INFO

    $projectRoot = $script:CORE_NODE_DIR
    $backupParentDir = Split-Path $projectRoot -Parent

    # Count core_node backups
    $coreNodeBackups = Get-ChildItem -Path $backupParentDir -Directory -Filter "core_node_bak_*" -ErrorAction SilentlyContinue
    Write-Host "Core Node Backups: $($coreNodeBackups.Count)" -ForegroundColor $script:COLOR_SUCCESS

    # Count dev_env backups
    $devEnvBackups = Get-ChildItem -Path $backupParentDir -Directory -Filter "dev_env_bak_*" -ErrorAction SilentlyContinue
    Write-Host "Development Environment Backups: $($devEnvBackups.Count)" -ForegroundColor $script:COLOR_SUCCESS

    # Count claude backups
    $claudeBackups = Get-ChildItem -Path $backupParentDir -Directory -Filter "claude_*_bak_*" -ErrorAction SilentlyContinue
    Write-Host "Claude/Codex/@anthropic-ai Backups: $($claudeBackups.Count)" -ForegroundColor $script:COLOR_SUCCESS

    # Count python env backups (directories and compressed archives)
    $pythonEnvBackups = Get-ChildItem -Path $backupParentDir -Filter "python_env_bak_*" -ErrorAction SilentlyContinue
    Write-Host "Python Runtime/Models Backups: $($pythonEnvBackups.Count)" -ForegroundColor $script:COLOR_SUCCESS

    # Calculate total backup size
    $allBackups = $coreNodeBackups + $devEnvBackups + $claudeBackups + $pythonEnvBackups
    $totalSize = 0
    foreach ($backup in $allBackups) {
        $size = (Get-ChildItem -Path $backup.FullName -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        $totalSize += $size
    }
    $totalSizeGB = [math]::Round($totalSize / 1GB, 2)
    Write-Host "Total Backup Size: $totalSizeGB GB" -ForegroundColor $script:COLOR_INFO

    Write-Host "========================================" -ForegroundColor $script:COLOR_INFO
    Write-Host ""
    Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Open-BackupDirectory {
    $projectRoot = $script:CORE_NODE_DIR
    $backupParentDir = Split-Path $projectRoot -Parent

    if (Test-Path $backupParentDir) {
        Write-ColorMessage -Message "Opening backup directory: $backupParentDir" -Type "Info"
        Start-Process explorer.exe -ArgumentList $backupParentDir
        Start-Sleep -Seconds 1
    } else {
        Write-ColorMessage -Message "Backup directory not found: $backupParentDir" -Type "Error"
        Write-Host ""
        Write-Host "Press any key to return to menu..." -ForegroundColor $script:COLOR_HIGHLIGHT
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
}
#endregion
