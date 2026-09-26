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
    Idempotently starts the Claude Code agent team (Windows, official agent-teams mode).

.DESCRIPTION
    Provisions Claude Code and Windows Terminal when missing, then opens one
    full-screen orchestrator window running claudeteam.ps1 --agent orchestrator --name ca-orchestrator
    (in-process teammates). The user gives the lead one task; the lead spawns the
    other roles of config/claude_team_roles.json as teammates from .claude/agents.
    A live lead PID is skipped. Independent-sessions variant: claudeteamup.ps1
    Linux counterpart: scripts/linuxenvs/claudeagents.sh

.EXAMPLE
    .\claudeagents.ps1
    .\claudeagents.ps1 -Status
    .\claudeagents.ps1 -Roles lead,reviewer -NoKickoff
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
Write-Host "claudeagents.ps1 - Claude Code agent team (lead + in-process teammates)" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ("[INFO] Options: Status={0} NoWindows={1} NoKickoff={2} Roles={3}" -f [bool]$Status, [bool]$NoWindows, [bool]$NoKickoff, $(if ($roleList.Count -gt 0) { $roleList -join "," } else { "all" })) -ForegroundColor Green

Invoke-ClaudeTeamUp -Mode "team" -Status:$Status -NoWindows:$NoWindows -NoKickoff:$NoKickoff -Roles $roleList
