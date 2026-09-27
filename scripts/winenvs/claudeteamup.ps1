<#
.SYNOPSIS
    Idempotently starts the Claude Code roles as independent sessions (Windows).

.DESCRIPTION
    Provisions Claude Code and Windows Terminal when missing, then opens one named,
    maximized Windows Terminal window with every enabled role of .claude/agents
    (catalog overrides in config/claude_team_roles.json) in its own pane, packed
    into tabs by the measured monitor size and DPI. Each pane runs
    claudeteam.ps1 --team-pane sessions --agent <role> --name ct-<role>; the lead
    ct-orchestrator gets sessions.kickoff_lead. Roles coordinate through
    cross-session messaging (ListAgents / SendMessage). Live PIDs are skipped;
    -Status prints the plan (monitors, tabs, panes, commands) without opening
    anything. Agent-teams lead variant: claudeagents.ps1
    Linux counterpart: scripts/linuxenvs/claudeteamup.sh

.EXAMPLE
    .\claudeteamup.ps1
    .\claudeteamup.ps1 -Status
    .\claudeteamup.ps1 -Roles orchestrator,reviewer -NoKickoff
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
Write-Host "claudeteamup.ps1 - Claude Code roles as independent sessions (cross-session messaging)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ("[INFO] Options: Status={0} NoWindows={1} NoKickoff={2} Roles={3}" -f [bool]$Status, [bool]$NoWindows, [bool]$NoKickoff, $(if ($roleList.Count -gt 0) { $roleList -join "," } else { "all" })) -ForegroundColor Green

Invoke-ClaudeTeamUp -Mode "sessions" -Status:$Status -NoWindows:$NoWindows -NoKickoff:$NoKickoff -Roles $roleList
