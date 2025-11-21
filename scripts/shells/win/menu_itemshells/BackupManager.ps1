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
        [Parameter()] [string]$Description = "script"
    )

    if (Test-Path $ScriptPath) {
        Write-ColorMessage -Message "Launching $Description..." -Type "Info"
        Write-Host ""

        try {
            & python $ScriptPath
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
function Backup-CurrentProject {
    $backupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\core_node\backup_manager.py"
    Invoke-ScriptAndPause -ScriptPath $backupScript -Description "Core Node Project Backup Manager"
}

function Backup-DevelopmentEnvironment {
    $devEnvBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\dev_env\backup_dev_env.py"
    Invoke-ScriptAndPause -ScriptPath $devEnvBackupScript -Description "Development Environment Backup Manager"
}

function Backup-ClaudeCodexAnthropic {
    $aiBackupScript = Join-Path $script:SCRIPT_DIR "pytools\pybackup\claude_backup\backup_claude_anthropic.py"
    Invoke-ScriptAndPause -ScriptPath $aiBackupScript -Description "Claude, Codex and @anthropic-ai Backup Manager"
}
#endregion

#region Menu System
function Show-BackupMenu {
    $menuItems = @(
        @{
            Text = "Backup this project (core_node)"
            Action = { Backup-CurrentProject }
        },
        @{
            Text = "Backup development environment"
            Action = { Backup-DevelopmentEnvironment }
        },
        @{
            Text = "Backup Claude, Codex and @anthropic-ai"
            Action = { Backup-ClaudeCodexAnthropic }
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

    while ($true) {
        Clear-Host
        Write-Host ""
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-ColorMessage -Message "       Backup Management Menu" -Type "Info"
        Write-ColorMessage -Message "========================================" -Type "Info"
        Write-Host ""

        for ($i = 0; $i -lt $menuItems.Count; $i++) {
            if ($i -eq $selectedIndex) {
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
                $selectedIndex--
                if ($selectedIndex -lt 0) {
                    $selectedIndex = $menuItems.Count - 1
                }
            }
            40 {
                $selectedIndex++
                if ($selectedIndex -ge $menuItems.Count) {
                    $selectedIndex = 0
                }
            }
            13 {
                $result = & $menuItems[$selectedIndex].Action
                if ($result -eq $true) {
                    return
                }
            }
        }
    }
}
#endregion

#region Main Execution
Show-BackupMenu
#endregion
