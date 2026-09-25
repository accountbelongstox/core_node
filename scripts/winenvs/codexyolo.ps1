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
    Launches Codex in YOLO mode.

.DESCRIPTION
    Offers an optional pnpm upgrade. The main session, plan mode, and subagents
    use gpt-5.6-sol at high reasoning effort. Codex feature defaults are preserved.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $null
$scriptsDirPath = $null
$coreNodePath = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
$serviceContractScript = $null
$mcpChromePath = $null
$mcpChromeNodeModulesPath = $null
$mcpChromeSharedArtifactPath = $null
$mcpChromeNativeArtifactPath = $null
$mcpChromeExtensionManifestPath = $null
$mcpChromeRegisterScriptPath = $null
$mcpChromeEnsureWinBinScriptPath = $null
$mcpChromeNeedsDependencies = $false
$mcpChromeNeedsBuild = $false
$mcpChromeHost = $null
$mcpChromeUrl = $null
$mcpChromePort = 0
$previousLocation = $null
$upgradeChoice = $null
$pnpmCommand = $null
$nodeCommand = $null
$codexCommand = $null
$codexInstallScriptPath = $null
$codexCandidatePaths = @()
$codexCandidatePath = $null
$currentVersionOutput = $null
$latestVersionOutput = $null
$currentVersionTokens = @()
$latestVersionTokens = @()
$versionSeparators = @()
$versionToken = $null
$versionCandidate = $null
$currentVersion = $null
$latestVersion = $null
$versionGapLarge = $false
$previousErrorActionPreference = $null
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
$codexInstallScriptPath = Join-Path $shellsWinPath "install_powershells"
$codexInstallScriptPath = Join-Path $codexInstallScriptPath "Step63_InstallCodexMultiDevice.ps1"
$windowsPathFunctionScript = Join-Path $winCommonDirPath "WindowsPathFunction.ps1"
. $windowsPathFunctionScript
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

$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
if ($null -eq $codexCommand) {
    Write-Host "[INFO] codex is not available on PATH; installing via Step63_InstallCodexMultiDevice.ps1..." -ForegroundColor Cyan
    if (Test-Path -LiteralPath $codexInstallScriptPath -PathType Leaf) {
        & powershell -NoProfile -ExecutionPolicy Bypass -File $codexInstallScriptPath
    } else {
        Write-Host "[ERROR] Codex install script not found: $codexInstallScriptPath" -ForegroundColor Red
    }
    $codexCommand = Get-Command codex -ErrorAction SilentlyContinue
    if ($null -eq $codexCommand) {
        $codexCandidatePaths = @(
            (Join-Path $Global:PNPM_GLOBAL_BIN_DIR "codex.cmd"),
            (Join-Path $Global:NODE_DIR "codex.cmd"),
            (Join-Path $Global:NODE_DIR "codex.exe")
        )
        foreach ($codexCandidatePath in $codexCandidatePaths) {
            if (($null -eq $codexCommand) -and (Test-Path -LiteralPath $codexCandidatePath -PathType Leaf)) {
                Add-Path -newPath $Global:PNPM_GLOBAL_BIN_DIR
                $codexCommand = Get-Command codex -ErrorAction SilentlyContinue
            }
        }
    }
    if ($null -eq $codexCommand) {
        throw "codex is still not available on PATH after installation attempt."
    }
}
$pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
$versionSeparators = @([char]' ', [char]"`t", [char]"`r", [char]"`n")
if ($null -ne $pnpmCommand) {
    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $currentVersionOutput = (& $codexCommand.Source --version 2>$null | Out-String).Trim()
        $latestVersionOutput = (& $pnpmCommand.Source view "@openai/codex" version 2>$null | Out-String).Trim()
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    $currentVersionTokens = $currentVersionOutput.Split($versionSeparators, [System.StringSplitOptions]::RemoveEmptyEntries)
    foreach ($versionToken in $currentVersionTokens) {
        $versionCandidate = $versionToken.Trim()
        if ($versionCandidate.StartsWith("v", [System.StringComparison]::OrdinalIgnoreCase)) {
            $versionCandidate = $versionCandidate.Substring(1)
        }
        if ([System.Version]::TryParse($versionCandidate, [ref]$currentVersion)) {
            break
        }
    }
    $latestVersionTokens = $latestVersionOutput.Split($versionSeparators, [System.StringSplitOptions]::RemoveEmptyEntries)
    foreach ($versionToken in $latestVersionTokens) {
        $versionCandidate = $versionToken.Trim()
        if ($versionCandidate.StartsWith("v", [System.StringComparison]::OrdinalIgnoreCase)) {
            $versionCandidate = $versionCandidate.Substring(1)
        }
        if ([System.Version]::TryParse($versionCandidate, [ref]$latestVersion)) {
            break
        }
    }
}
if (($null -ne $currentVersion) -and ($null -ne $latestVersion) -and ($latestVersion -gt $currentVersion)) {
    $versionGapLarge = ($latestVersion.Major -gt $currentVersion.Major) -or
        (($latestVersion.Major -eq $currentVersion.Major) -and ($latestVersion.Minor -gt $currentVersion.Minor))
}
if ($versionGapLarge) {
    Write-Host "Upgrade Codex CLI via 'pnpm add --global @openai/codex@latest'? [N/y]: " -ForegroundColor Yellow -NoNewline
    $upgradeChoice = Read-Host
}
if (($upgradeChoice -eq "y") -or ($upgradeChoice -eq "Y")) {
    Write-Host "[INFO] Upgrading Codex CLI with pnpm..." -ForegroundColor Cyan
    & $pnpmCommand.Source add --global "@openai/codex@latest"
    Write-Host "[INFO] Codex CLI upgrade command completed." -ForegroundColor Green
} elseif ($versionGapLarge) {
    Write-Host "[INFO] Codex CLI upgrade skipped." -ForegroundColor DarkGray
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
    "--config", "tui.raw_output_mode=true"
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
