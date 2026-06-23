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
    Launches Claude Code with multiple roles (experimental agent teams),
    ultracode enabled by default, and the model forced to Opus 4.8 or newer
    everywhere.

.DESCRIPTION
    Sets CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 for the current session (multiple
    roles), forces the newest Opus model (alias "opus[1m]" = latest Opus, e.g.
    Opus 4.8, with the 1M-context window) for the main session, subagents and the
    background "Haiku slot", then runs:
    claude --model opus[1m] --settings '{"ultracode":true}' --dangerously-skip-permissions
    The --model flag pins the main interactive model; CLAUDE_CODE_SUBAGENT_MODEL
    pins subagents/agent-teams; ANTHROPIC_DEFAULT_HAIKU_MODEL /
    ANTHROPIC_DEFAULT_SONNET_MODEL redirect background + sonnet-aliased traffic to
    Opus too. Claude Code strips the [1m] suffix client-side before calling the
    provider. The --settings flag turns on ultracode via inline JSON.
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
$ultraSettingsJson = $null
$forceModel = $null
$forceOpusChoice = $null
$forceOpusEnabled = $false
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

$env:CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = "1"

# Newest-Opus alias plus the 1M-context window ("opus[1m]"); Claude Code strips
# the [1m] suffix client-side before calling the provider.
$forceModel = 'opus[1m]'

# Windows default: run experimental agent teams in-process.
$teammateMode = 'in-process'

# Default-enable ultracode via inline JSON settings (compact; no spaces so
# native-argument quoting stays safe).
$ultraSettingsJson = '{"ultracode":true}'

# Optional: force Opus 4.8 (or newer) everywhere. Opt-in prompt, default No.
$forceOpusChoice = Read-Host "Force model $forceModel everywhere (main + subagents + background)? [y/N]"
$forceOpusEnabled = (($forceOpusChoice -eq 'y') -or ($forceOpusChoice -eq 'Y'))

if ($forceOpusEnabled) {
    # Env vars cover the model slots that have no CLI flag: subagents/agent-teams
    # (CLAUDE_CODE_SUBAGENT_MODEL), the background quick-task "Haiku slot"
    # (ANTHROPIC_DEFAULT_HAIKU_MODEL) and anything resolving via the sonnet alias
    # (ANTHROPIC_DEFAULT_SONNET_MODEL).
    $env:CLAUDE_CODE_SUBAGENT_MODEL = $forceModel
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $forceModel
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = $forceModel
    # Light note shown only when the user opted in.
    Write-Host "[NOTE] $forceModel forced for main session, subagents and background (Haiku/Sonnet) slots - background tasks run on Opus too (higher cost/latency)." -ForegroundColor Yellow
}

# Build the claude argument list. --settings always carries ultracode;
# --teammate-mode in-process and --dangerously-skip-permissions are Windows
# defaults; --model is included only when Opus forcing is opted in.
if ($forceOpusEnabled) {
    $claudeArgs = @("--model", $forceModel, "--settings", $ultraSettingsJson, "--teammate-mode", $teammateMode, "--dangerously-skip-permissions")
} else {
    $claudeArgs = @("--settings", $ultraSettingsJson, "--teammate-mode", $teammateMode, "--dangerously-skip-permissions")
}

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
if ($forceOpusEnabled) {
    Write-Host "[INFO] Forced model: $forceModel (main session + subagents + background Haiku/Sonnet slots)" -ForegroundColor Green
} else {
    Write-Host "[INFO] Forced model: off (default N) - using the account default model" -ForegroundColor Green
}
Write-Host "[INFO] Teammate mode: $teammateMode (Windows default)" -ForegroundColor Green
Write-Host "[INFO] Ultracode settings: --settings $ultraSettingsJson" -ForegroundColor Green
Write-Host "[INFO] Invoking: claude $($claudeArgs -join ' ')$claudeInvokeDisplayArgs" -ForegroundColor Green
if ($args.Count -gt 0) {
    Write-Host "[INFO] Extra arguments ($($args.Count)): $($args -join ' ')" -ForegroundColor DarkGray
} else {
    Write-Host "[INFO] No extra arguments." -ForegroundColor DarkGray
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# & claude --model $forceModel --settings $ultraSettingsJson --dangerously-skip-permissions --teammate-mode in-process @args
& claude --model $forceModel --settings $ultraSettingsJson --dangerously-skip-permissions @args
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) {
    $exitCode = 0
}
exit $exitCode
