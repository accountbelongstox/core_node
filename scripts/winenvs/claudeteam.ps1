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
    Launches Claude Code with experimental agent teams and teammate mode (in-process).

.DESCRIPTION
    Sets CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 for the current session, then runs:
    claude --dangerously-skip-permissions --teammate-mode in-process
    Any script arguments are appended to that command line.

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
$windowsPathFunctionScript = $null
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

$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"

$claudeInvokeDisplayArgs = if ($args.Count -gt 0) {
    [string]::Format(" {0}", ($args -join " "))
} else {
    ""
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "claudeteam.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "[INFO] CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 (session)" -ForegroundColor Green
Write-Host "[INFO] Invoking: claude --dangerously-skip-permissions$claudeInvokeDisplayArgs" -ForegroundColor Green
if ($args.Count -gt 0) {
    Write-Host "[INFO] Extra arguments ($($args.Count)): $($args -join ' ')" -ForegroundColor DarkGray
} else {
    Write-Host "[INFO] No extra arguments." -ForegroundColor DarkGray
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# & claude --dangerously-skip-permissions --teammate-mode in-process @args
& claude --dangerously-skip-permissions @args
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) {
    $exitCode = 0
}
exit $exitCode
