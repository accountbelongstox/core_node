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
            $exitCode = $LASTEXITCODE

            Write-Host ""
            Write-Host "========================================" -ForegroundColor $script:COLOR_INFO
            if ($exitCode -eq 0) {
                Write-ColorMessage -Message "Script completed successfully" -Type "Success"
            } else {
                Write-ColorMessage -Message "Script completed with exit code: $exitCode" -Type "Warning"
            }
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
    Write-Host "Do you want to proceed with backup? (Y/N): " -NoNewline -ForegroundColor $script:COLOR_HIGHLIGHT

    $confirmation = Read-Host
    if ($confirmation -eq 'Y' -or $confirmation -eq 'y') {
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
    Write-Host "Do you want to proceed with backup? (Y/N): " -NoNewline -ForegroundColor $script:COLOR_HIGHLIGHT

    $confirmation = Read-Host
    if ($confirmation -eq 'Y' -or $confirmation -eq 'y') {
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
    Write-Host "Do you want to proceed with backup? (Y/N): " -NoNewline -ForegroundColor $script:COLOR_HIGHLIGHT

    $confirmation = Read-Host
    if ($confirmation -eq 'Y' -or $confirmation -eq 'y') {
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

    # Calculate total backup size
    $allBackups = $coreNodeBackups + $devEnvBackups + $claudeBackups
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

#region Menu System
function Show-BackupMenu {
    $menuItems = @(
        # Core Node Project Section
        @{
            Text = "-- Core Node Project --------------"
            Action = { }
            IsHeader = $true
        },
        @{
            Text = "  Backup core_node"
            Action = { Backup-CurrentProject }
        },
        @{
            Text = "  List core_node backups"
            Action = { List-CurrentProjectBackups }
        },
        @{
            Text = "  Restore core_node backup"
            Action = { Restore-CurrentProject }
        },
        # Development Environment Section
        @{
            Text = "-- Development Environment --------"
            Action = { }
            IsHeader = $true
        },
        @{
            Text = "  Backup dev environment"
            Action = { Backup-DevelopmentEnvironment }
        },
        @{
            Text = "  List dev environment backups"
            Action = { List-DevelopmentEnvironmentBackups }
        },
        @{
            Text = "  Restore dev environment"
            Action = { Restore-DevelopmentEnvironment }
        },
        # Claude/Codex/@anthropic-ai Section
        @{
            Text = "-- Claude, Codex & @anthropic-ai --"
            Action = { }
            IsHeader = $true
        },
        @{
            Text = "  Backup Claude/Codex/@anthropic-ai"
            Action = { Backup-ClaudeCodexAnthropic }
        },
        @{
            Text = "  List Claude/Codex backups"
            Action = { List-ClaudeCodexAnthropicBackups }
        },
        @{
            Text = "  Restore Claude/Codex backup"
            Action = { Restore-ClaudeCodexAnthropic }
        },
        # Utilities Section
        @{
            Text = "-- Utilities ---------------------"
            Action = { }
            IsHeader = $true
        },
        @{
            Text = "  Show backup statistics"
            Action = { Show-BackupStatistics }
        },
        @{
            Text = "  Open backup directory"
            Action = { Open-BackupDirectory }
        },
        # Navigation
        @{
            Text = "------------------------------------"
            Action = { }
            IsHeader = $true
        },
        @{
            Text = "Back to main menu"
            Action = { return $true }
        },
        @{
            Text = "Exit"
            Action = { exit }
        }
    )

    $selectedIndex = 0

    # Skip header items in initial selection
    while ($menuItems[$selectedIndex].IsHeader -eq $true) {
        $selectedIndex++
    }

    while ($true) {
        Clear-Host
        Write-Host ""
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-ColorMessage -Message "       Backup Management Menu" -Type "Info"
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-Host ""

        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($menuItems[$i].IsHeader -eq $true) {
                # Display header in gray
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
                # Up arrow
                do {
                    $selectedIndex--
                    if ($selectedIndex -lt 0) {
                        $selectedIndex = $menuItems.Count - 1
                    }
                } while ($menuItems[$selectedIndex].IsHeader -eq $true)
            }
            40 {
                # Down arrow
                do {
                    $selectedIndex++
                    if ($selectedIndex -ge $menuItems.Count) {
                        $selectedIndex = 0
                    }
                } while ($menuItems[$selectedIndex].IsHeader -eq $true)
            }
            13 {
                # Enter key
                if ($menuItems[$selectedIndex].IsHeader -ne $true) {
                    $result = & $menuItems[$selectedIndex].Action
                    if ($result -eq $true) {
                        return
                    }
                }
            }
        }
    }
}
#endregion

#region Main Execution
Show-BackupMenu
#endregion
