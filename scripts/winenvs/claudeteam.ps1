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
    Launches Claude Code with multiple roles (experimental agent teams) always on,
    an opt-in ultracode prompt (default No), and - when ultracode is enabled - an
    opt-in prompt (default Yes) to force Opus 4.8 everywhere.

.DESCRIPTION
    Always sets CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 for the current session
    (multiple roles). Then prompts "Enable ultracode?" (default No); when enabled it
    adds --effort ultracode (session-only xhigh effort + automatic workflow
    orchestration; official CLI reference, requires Claude Code v2.1.203+) and
    prompts "Use Opus 4.8 1M as the ultracode model?" (default Yes). If accepted,
    the pinned Opus 4.8 id plus the 1M-context suffix ("claude-opus-4-8[1m]") is
    forced for the main session, subagents and the background Haiku/Sonnet slots,
    running:
    claude --effort ultracode --model claude-opus-4-8[1m] --dangerously-skip-permissions
    The --model flag pins the main interactive model; CLAUDE_CODE_SUBAGENT_MODEL
    pins subagents/agent-teams; ANTHROPIC_DEFAULT_OPUS_MODEL /
    ANTHROPIC_DEFAULT_SONNET_MODEL / ANTHROPIC_DEFAULT_HAIKU_MODEL redirect the
    opus/sonnet/haiku aliases + background traffic to Opus 4.8 too. Claude Code
    interprets the [1m] suffix client-side as the 1M-context selector. Using
    --effort (not an inline --settings JSON) avoids PowerShell native-exe quote
    mangling. When ultracode is declined, Claude runs on the account default model.
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
$forceModel = $null
$ultraChoice = $null
$enableUltra = $false
$modelChoice = $null
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

# Pinned Opus 4.8 id plus the "[1m]" 1M-context suffix; Claude Code interprets the
# suffix client-side as the 1M-context selector (official model-config reference).
$forceModel = 'claude-opus-4-8[1m]'

# Windows default: run experimental agent teams in-process.
$teammateMode = 'in-process'

# Ultracode: opt-in prompt, default No. When enabled, ultracode is turned on via
# the dedicated effort flag "--effort ultracode" (official CLI reference; requires
# Claude Code v2.1.203+): session-only xhigh effort with automatic workflow
# orchestration. Using --effort avoids the Windows PowerShell 5.1 native-exe quote
# mangling that breaks an inline "--settings '{"ultracode":true}'" (it arrives as
# invalid JSON), so no temp settings file is needed. Ultracode cannot be persisted
# (effortLevel / CLAUDE_CODE_EFFORT_LEVEL accept only low/medium/high/xhigh).
$ultraChoice = Read-Host "Enable ultracode? [y/N]"
$enableUltra = (($ultraChoice -eq 'y') -or ($ultraChoice -eq 'Y'))

if ($enableUltra) {
    # Ultracode model: only asked when ultracode is enabled, default Yes. Forces
    # Opus 4.8 with the 1M-context window everywhere.
    $modelChoice = Read-Host "Use Opus 4.8 1M ($forceModel) as the ultracode model everywhere? [Y/n]"
    $forceOpusEnabled = (($modelChoice -ne 'n') -and ($modelChoice -ne 'N'))
}

if ($forceOpusEnabled) {
    # Env vars cover the model slots that have no CLI flag (official model-config
    # reference): CLAUDE_CODE_SUBAGENT_MODEL (all subagents / experimental agent
    # teams / workflow agents), ANTHROPIC_DEFAULT_OPUS_MODEL (the "opus" alias and
    # opusplan in plan mode), ANTHROPIC_DEFAULT_SONNET_MODEL (the "sonnet" alias and
    # opusplan execution) and ANTHROPIC_DEFAULT_HAIKU_MODEL (the "haiku"/background
    # quick-task slot).
    $env:CLAUDE_CODE_SUBAGENT_MODEL = $forceModel
    $env:ANTHROPIC_DEFAULT_OPUS_MODEL = $forceModel
    $env:ANTHROPIC_DEFAULT_SONNET_MODEL = $forceModel
    $env:ANTHROPIC_DEFAULT_HAIKU_MODEL = $forceModel
    # Light note shown only when the user opted in.
    Write-Host "[NOTE] $forceModel forced for main session, subagents and background (Haiku/Sonnet) slots - background tasks run on Opus too (higher cost/latency)." -ForegroundColor Yellow
}

# Build the claude argument list. --teammate-mode in-process, --permission-mode
# bypassPermissions and --dangerously-skip-permissions are Windows defaults;
# --effort ultracode is added only when ultracode is enabled; --model only when
# Opus forcing is opted in.
$claudeArgs = @("--teammate-mode", $teammateMode, "--permission-mode", "bypassPermissions", "--dangerously-skip-permissions")
if ($enableUltra) {
    $claudeArgs += @("--effort", "ultracode")
}
if ($forceOpusEnabled) {
    $claudeArgs += @("--model", $forceModel)
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
if ($enableUltra) {
    Write-Host "[INFO] Ultracode: ON (--effort ultracode)" -ForegroundColor Green
} else {
    Write-Host "[INFO] Ultracode: off (default N)" -ForegroundColor Green
}
if ($forceOpusEnabled) {
    Write-Host "[INFO] Ultracode model: $forceModel (main session + subagents + background Haiku/Sonnet slots)" -ForegroundColor Green
} else {
    Write-Host "[INFO] Ultracode model: account default" -ForegroundColor Green
}
Write-Host "[INFO] Teammate mode: $teammateMode (Windows default)" -ForegroundColor Green
Write-Host "[INFO] Invoking: claude $($claudeArgs -join ' ')$claudeInvokeDisplayArgs" -ForegroundColor Green
if ($args.Count -gt 0) {
    Write-Host "[INFO] Extra arguments ($($args.Count)): $($args -join ' ')" -ForegroundColor DarkGray
} else {
    Write-Host "[INFO] No extra arguments." -ForegroundColor DarkGray
}
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Invoke claude with the argument list built above (honors --teammate-mode + --permission-mode + force-model).
& claude @claudeArgs @args
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) {
    $exitCode = 0
}

exit $exitCode
