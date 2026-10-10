<#
.SYNOPSIS
    Launches Codex in YOLO mode after ensuring the Chrome MCP service.

.DESCRIPTION
    Ensures the official Codex install (shared Invoke-AiCliProvision: official
    installer, upgrade prompt), the shared idempotent Chrome MCP service ensure,
    and Chrome MCP registration. The main session, plan mode, and subagents
    use gpt-5.6-sol at high reasoning effort. Codex feature defaults are
    preserved.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $null
$scriptsDirPath = $null
$coreNodePath = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
$aiCliProvisionScript = $null
$serviceContractScript = $null
$mcpChromeHost = $null
$mcpChromeUrl = $null
$mcpChromePort = 0
$codexCommand = $null
$model = "gpt-5.6-sol"
$reasoningEffort = "high"
$codexArgs = @()
$displayArgs = $null
$resumeRequested = $false
$resumeArgument = $null
$codexHomePath = $null
$threadWriterLocksPath = $null
$threadWriterLockFiles = @()

$scriptPath = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptPath)) {
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$scriptsDirPath = Split-Path $scriptPath -Parent
$coreNodePath = Split-Path $scriptsDirPath -Parent
$shellsWinPath = Join-Path $scriptsDirPath "shells"
$shellsWinPath = Join-Path $shellsWinPath "win"
$winCommonDirPath = Join-Path $shellsWinPath "win_common"
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
$aiCliProvisionScript = Join-Path $winCommonDirPath "AiCliProvisionCommon.ps1"
$serviceContractScript = Join-Path $winCommonDirPath "ServiceContract.ps1"
. $windowsPathFunctionScript
. $serviceContractScript
. $aiCliProvisionScript
$mcpChromeHost = Get-ServiceContractHost -Name "loopback"
$mcpChromePort = Get-ServiceContractPort -Name "mcp_chrome"
$mcpChromeUrl = New-ServiceContractUrl -Protocol "http" -HostName $mcpChromeHost -Port $mcpChromePort -Path "mcp"
Set-CoreNodePaths
foreach ($resumeArgument in $args) {
    if (($resumeArgument -eq "resume") -or ($resumeArgument -eq "--resume")) {
        $resumeRequested = $true
        break
    }
}
if ($resumeRequested) {
    if ([string]::IsNullOrWhiteSpace($env:CODEX_HOME)) {
        $codexHomePath = Join-Path ([Environment]::GetFolderPath("UserProfile")) ".codex"
    } else {
        $codexHomePath = (Resolve-Path -LiteralPath $env:CODEX_HOME).Path
    }
    $threadWriterLocksPath = Join-Path $codexHomePath "thread-writer-locks"
    if (Test-Path -LiteralPath $threadWriterLocksPath) {
        $threadWriterLockFiles = @(Get-ChildItem -LiteralPath $threadWriterLocksPath -Filter "*.lock" -File | Where-Object { $_.Name -ne ".coordination.lock" })
        if ($threadWriterLockFiles.Count -gt 0) {
            $threadWriterLockFiles | Remove-Item -Force
            Write-Host "[INFO] Cleared $($threadWriterLockFiles.Count) Codex thread writer lock file(s) before resume." -ForegroundColor Green
        }
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "codexyolo.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

# Codex: official installer only, then the shared upgrade prompt (idempotent).
Invoke-AiCliProvision -Tool "codex"
$codexCommand = Get-Command codex -ErrorAction SilentlyContinue

Invoke-AiCliChromeServiceEnsure
& $codexCommand.Source mcp add chrome --url $mcpChromeUrl
Write-Host "[INFO] Chrome MCP registered in Codex." -ForegroundColor Green

$codexArgs = @(
    "--yolo",
    "--dangerously-bypass-hook-trust",
    "--search",
    "--model", $model,
    "--config", ('model_reasoning_effort="{0}"' -f $reasoningEffort),
    "--config", ('plan_mode_reasoning_effort="{0}"' -f $reasoningEffort),
    "--config", ('agents.default_subagent_model="{0}"' -f $model),
    "--config", ('agents.default_subagent_reasoning_effort="{0}"' -f $reasoningEffort),
    "--config", "tui.fullscreen_transcript=false"
)
$displayArgs = if ($args.Count -gt 0) {
    [string]::Format("; extra args: {0}", ($args -join " "))
} else {
    ""
}

Write-Host "[INFO] Model: $model ($reasoningEffort)" -ForegroundColor Green
Write-Host "[INFO] YOLO: ON; live search: ON; hook trust bypass: ON" -ForegroundColor Green
Write-Host "[INFO] Codex feature defaults preserved$displayArgs" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

& $codexCommand.Source @codexArgs @args
