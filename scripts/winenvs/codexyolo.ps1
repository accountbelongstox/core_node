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
    Launches Codex in YOLO mode with every active additive feature enabled.

.DESCRIPTION
    Offers an optional pnpm upgrade, discovers the installed CLI's feature list,
    and enables stable, experimental, and under-development features for this
    session. The main session, plan mode, and subagents use gpt-5.6-sol at high
    reasoning effort. Removed, deprecated, and tool-restricting modes are skipped.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $null
$scriptsDirPath = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
$upgradeChoice = $null
$pnpmCommand = $null
$pnpmExitCode = 0
$codexCommand = $null
$featureListOutput = @()
$featureListExitCode = 0
$featureLine = $null
$featureMatch = $null
$featureName = $null
$featureStage = $null
$featureLinePattern = '^(?<name>\S+)\s{2,}(?<stage>under development|experimental|stable|deprecated|removed)\s{2,}(?<enabled>true|false)\s*$'
$excludedFeatures = @("code_mode_only", "shell_zsh_fork", "unified_exec_zsh_fork")
$enabledFeatures = @()
$model = "gpt-5.6-sol"
$reasoningEffort = "high"
$rolloutBudgetLimitTokens = if (($env:CODEX_ROLLOUT_BUDGET_TOKENS -match '^\d+$') -and ([int64]$env:CODEX_ROLLOUT_BUDGET_TOKENS -gt 0)) { [int64]$env:CODEX_ROLLOUT_BUDGET_TOKENS } else { 100000 }
$codexArgs = @()
$displayArgs = $null
$exitCode = 0

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

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "codexyolo.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

$upgradeChoice = Read-Host "Upgrade Codex CLI via 'pnpm add --global @openai/codex@latest'? [y/N]"
if (($upgradeChoice -eq "y") -or ($upgradeChoice -eq "Y")) {
    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($null -eq $pnpmCommand) {
        Write-Host "[ERROR] pnpm is required to upgrade Codex CLI." -ForegroundColor Red
        exit 127
    }

    Write-Host "[INFO] Upgrading Codex CLI with pnpm..." -ForegroundColor Cyan
    & pnpm add --global "@openai/codex@latest"
    $pnpmExitCode = $LASTEXITCODE
    if (($null -ne $pnpmExitCode) -and ($pnpmExitCode -ne 0)) {
        Write-Host "[ERROR] Codex CLI upgrade failed with exit code $pnpmExitCode." -ForegroundColor Red
        exit $pnpmExitCode
    }
    Write-Host "[INFO] Codex CLI upgrade complete." -ForegroundColor Green
} else {
    Write-Host "[INFO] Codex CLI upgrade skipped (default N)." -ForegroundColor DarkGray
}

$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
if ($null -eq $codexCommand) {
    Write-Host "[ERROR] codex is not available on PATH." -ForegroundColor Red
    exit 127
}

$featureListOutput = @(& codex features list 2>$null)
$featureListExitCode = $LASTEXITCODE
if ($null -eq $featureListExitCode) {
    $featureListExitCode = 0
}

if ($featureListExitCode -eq 0) {
    foreach ($featureLine in $featureListOutput) {
        $featureMatch = [regex]::Match([string]$featureLine, $featureLinePattern)
        if (-not $featureMatch.Success) {
            continue
        }

        $featureName = $featureMatch.Groups["name"].Value
        $featureStage = $featureMatch.Groups["stage"].Value
        if (($featureStage -eq "deprecated") -or ($featureStage -eq "removed")) {
            continue
        }
        if (($excludedFeatures -contains $featureName) -or ($enabledFeatures -contains $featureName)) {
            continue
        }
        $enabledFeatures += $featureName
    }
} else {
    Write-Host "[WARN] Feature discovery is unavailable; upgrade Codex to enable all active feature flags." -ForegroundColor Yellow
}

$codexArgs = @(
    "--yolo",
    "--dangerously-bypass-hook-trust",
    "--search",
    "--model", $model,
    "--config", ('model_reasoning_effort="{0}"' -f $reasoningEffort),
    "--config", ('plan_mode_reasoning_effort="{0}"' -f $reasoningEffort),
    "--config", ('agents.default_subagent_model="{0}"' -f $model),
    "--config", ('agents.default_subagent_reasoning_effort="{0}"' -f $reasoningEffort),
    "--config", ('features.rollout_budget.limit_tokens={0}' -f $rolloutBudgetLimitTokens)
)
foreach ($featureName in $enabledFeatures) {
    $codexArgs += @("--enable", $featureName)
}

$displayArgs = if ($args.Count -gt 0) {
    [string]::Format("; extra args: {0}", ($args -join " "))
} else {
    ""
}

Write-Host "[INFO] Model: $model ($reasoningEffort)" -ForegroundColor Green
Write-Host "[INFO] YOLO: ON; live search: ON; hook trust bypass: ON" -ForegroundColor Green
Write-Host "[INFO] Active features enabled: $($enabledFeatures.Count)$displayArgs" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

& codex @codexArgs @args
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) {
    $exitCode = 0
}

exit $exitCode
