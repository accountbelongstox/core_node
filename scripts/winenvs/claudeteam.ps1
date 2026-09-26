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
    Launches Claude Code with multiple roles (experimental agent teams) always on.

.DESCRIPTION
    Always sets CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 for the current session
    (multiple roles). The model is the account default (Opus 5.5 since v2.1.280), so no
    model is pinned. Any script arguments are appended to the command line.

.EXAMPLE
    .\claudeteam.ps1
    .\claudeteam.ps1 -xx
    .\claudeteam.ps1 --resume session-id
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $null
$scriptsDirPath = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$aiCliProvisionCommonScript = $null
$windowsPathFunctionScript = $null
$teammateMode = $null
$claudeArgs = $null
$exitCode = 0
$claudeInvokeDisplayArgs = $null

$scriptPath = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$scriptsDirPath = Split-Path $scriptPath -Parent
$shellsWinPath = Join-Path $scriptsDirPath "shells"
$shellsWinPath = Join-Path $shellsWinPath "win"
$winCommonDirPath = Join-Path $shellsWinPath "win_common"
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
. $windowsPathFunctionScript
Set-CoreNodePaths

# Idempotent AI CLI provisioning: install Claude Code with the official native
# installer when the command is missing, then offer an upgrade (default N,
# auto-skip after 5 seconds) only when a newer version is published.
$aiCliProvisionCommonScript = Join-Path $winCommonDirPath "AiCliProvisionCommon.ps1"
. $aiCliProvisionCommonScript
Invoke-AiCliProvision -Tool "claude"

$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"
$env:CLAUDE_AGENTS_SESSION = "1"

# Windows default: run experimental agent teams in-process.
$teammateMode = 'in-process'

# Build the claude argument list. --teammate-mode in-process and --permission-mode
# auto are the defaults; teammates inherit the lead's mode.
# The model is the account default (Opus 5.5 since v2.1.280), so no model is pinned.
$claudeArgs = @("--teammate-mode", $teammateMode, "--permission-mode", "auto")

$claudeArgs += @(Get-AiCliUltracodeArgs -SettingsName "claudeteam")

$claudeInvokeDisplayArgs = if ($args.Count -gt 0) {
    [string]::Format(" {0}", ($args -join " "))
} else {
    ""
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "claudeteam.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "[INFO] CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (session, multiple roles)" -ForegroundColor Green
Write-Host "[INFO] Teammate mode: $teammateMode (Windows default)" -ForegroundColor Green
Write-Host "[INFO] Invoking: claude $($claudeArgs -join ' ')$claudeInvokeDisplayArgs" -ForegroundColor Green
if ($args.Count -gt 0) {
    Write-Host "[INFO] Extra arguments ($($args.Count)): $($args -join ' ')" -ForegroundColor DarkGray
} else {
    Write-Host "[INFO] No extra arguments." -ForegroundColor DarkGray
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Invoke claude with the argument list built above (honors --teammate-mode + --permission-mode).
& claude @claudeArgs @args
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) {
    $exitCode = 0
}

exit $exitCode
