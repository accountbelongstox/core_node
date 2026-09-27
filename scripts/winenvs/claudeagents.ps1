<#
.SYNOPSIS
    Idempotently starts one Claude Code agent-team lead on Windows.

.DESCRIPTION
    Provisions Claude Code and Windows Terminal when missing, then opens the lead.
    The lead uses the project agent definitions to spawn only the teammates needed
    by the task. It runs
    claudeteam.ps1 --team-pane team --agent orchestrator --name ca-orchestrator
    with the team kickoff. Live PIDs are skipped; -Status prints the plan without
    opening anything.
    Independent-sessions lead variant: claudeteamup.ps1
    Linux counterpart: scripts/linuxenvs/claudeagents.sh

.EXAMPLE
    .\claudeagents.ps1
    .\claudeagents.ps1 -Status
    .\claudeagents.ps1 -Roles orchestrator,reviewer -NoKickoff
#>

param(
    [switch]$Status,
    [switch]$NoWindows,
    [switch]$NoKickoff,
    [string[]]$Roles = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $null
$scriptsDirPath = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
$aiCliProvisionCommonScript = $null
$claudeTeamCommonScript = $null
$roleList = $null

$scriptPath = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$scriptsDirPath = Split-Path $scriptPath -Parent
$shellsWinPath = Join-Path $scriptsDirPath "shells"
$shellsWinPath = Join-Path $shellsWinPath "win"
$winCommonDirPath = Join-Path $shellsWinPath "win_common"
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
$aiCliProvisionCommonScript = Join-Path $winCommonDirPath "AiCliProvisionCommon.ps1"
$claudeTeamCommonScript = Join-Path $winCommonDirPath "ClaudeTeamCommon.ps1"
. $windowsPathFunctionScript
. $aiCliProvisionCommonScript
. $claudeTeamCommonScript

$roleList = @($Roles | ForEach-Object { $_ -split "," } | ForEach-Object { $_.Trim() })

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "claudeagents.ps1 - Claude Code agent team (one lead, teammates on demand)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ("[INFO] Options: Status={0} NoWindows={1} NoKickoff={2} Roles={3}" -f [bool]$Status, [bool]$NoWindows, [bool]$NoKickoff, $(if ($roleList.Count -gt 0) { $roleList -join "," } else { "all" })) -ForegroundColor Green

Invoke-ClaudeTeamUp -Mode "team" -Status:$Status -NoWindows:$NoWindows -NoKickoff:$NoKickoff -Roles $roleList
