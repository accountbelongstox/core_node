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
    Launches Codex in YOLO mode after optional Chrome MCP installation.

.DESCRIPTION
    Offers an optional pnpm upgrade and Chrome MCP installation. The main session,
    plan mode, and subagents use gpt-5.6-sol at high reasoning effort. Codex feature
    defaults are preserved.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = $null
$scriptsDirPath = $null
$coreNodePath = $null
$shellsWinPath = $null
$winCommonDirPath = $null
$windowsPathFunctionScript = $null
$mcpChromePath = $null
$mcpChromeNodeModulesPath = $null
$mcpChromeSharedArtifactPath = $null
$mcpChromeNativeArtifactPath = $null
$mcpChromeExtensionManifestPath = $null
$mcpChromeRegisterScriptPath = $null
$mcpChromeEnsureWinBinScriptPath = $null
$mcpChromeSupervisorScriptPath = $null
$mcpChromeNeedsDependencies = $false
$mcpChromeNeedsBuild = $false
$mcpChromeUrl = "http://127.0.0.1:12306/mcp"
$mcpChromePort = 12306
$mcpChromePortReady = $false
$mcpChromePortWasReady = $false
$mcpChromePortWaitCount = 0
$mcpChromePython = $null
$mcpChromeSupervisorArgs = @()
$previousLocation = $null
$upgradeChoice = $null
$pnpmCommand = $null
$nodeCommand = $null
$codexCommand = $null
$model = "gpt-5.6-sol"
$reasoningEffort = "high"
$codexArgs = @()
$displayArgs = $null

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
$mcpChromePath = Join-Path $coreNodePath "apps"
$mcpChromePath = Join-Path $mcpChromePath "mcp-chrome"
$mcpChromeNodeModulesPath = Join-Path $mcpChromePath "node_modules"
$mcpChromeSharedArtifactPath = Join-Path $mcpChromePath "packages"
$mcpChromeSharedArtifactPath = Join-Path $mcpChromeSharedArtifactPath "shared"
$mcpChromeSharedArtifactPath = Join-Path $mcpChromeSharedArtifactPath "dist"
$mcpChromeSharedArtifactPath = Join-Path $mcpChromeSharedArtifactPath "index.js"
$mcpChromeNativeArtifactPath = Join-Path $mcpChromePath "app"
$mcpChromeNativeArtifactPath = Join-Path $mcpChromeNativeArtifactPath "native-server"
$mcpChromeNativeArtifactPath = Join-Path $mcpChromeNativeArtifactPath "dist"
$mcpChromeNativeArtifactPath = Join-Path $mcpChromeNativeArtifactPath "index.js"
$mcpChromeExtensionManifestPath = Join-Path $mcpChromePath ".output"
$mcpChromeExtensionManifestPath = Join-Path $mcpChromeExtensionManifestPath "build_extension"
$mcpChromeExtensionManifestPath = Join-Path $mcpChromeExtensionManifestPath "manifest.json"
$mcpChromeRegisterScriptPath = Join-Path $mcpChromePath "scripts"
$mcpChromeEnsureWinBinScriptPath = Join-Path $mcpChromeRegisterScriptPath "ensure_win_bin.ps1"
$mcpChromeSupervisorScriptPath = Join-Path $mcpChromeRegisterScriptPath "service_supervisor.py"
$mcpChromeRegisterScriptPath = Join-Path $mcpChromeRegisterScriptPath "register-local-dev.cjs"
. $windowsPathFunctionScript
Set-CoreNodePaths
$mcpChromePython = (Resolve-Path -LiteralPath $Global:PYTHON_EXE_PATH).Path

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "codexyolo.ps1" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan

$upgradeChoice = Read-Host "Upgrade Codex CLI via 'pnpm add --global @openai/codex@latest'? [N/y]"
if (($upgradeChoice -eq "y") -or ($upgradeChoice -eq "Y")) {
    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($null -eq $pnpmCommand) {
        Write-Host "[WARN] pnpm is unavailable; keeping the installed Codex CLI." -ForegroundColor Yellow
    } else {
        Write-Host "[INFO] Upgrading Codex CLI with pnpm..." -ForegroundColor Cyan
        & $pnpmCommand.Source add --global "@openai/codex@latest"
        Write-Host "[INFO] Codex CLI upgrade command completed." -ForegroundColor Green
    }
} else {
    Write-Host "[INFO] Codex CLI upgrade skipped." -ForegroundColor DarkGray
}

$codexCommand = Get-Command codex -ErrorAction SilentlyContinue
if ($null -eq $codexCommand) {
    throw "codex is not available on PATH."
}

$mcpChromeNeedsDependencies = -not (Test-Path -LiteralPath $mcpChromeNodeModulesPath)
$mcpChromeNeedsBuild = (-not (Test-Path -LiteralPath $mcpChromeSharedArtifactPath)) -or
    (-not (Test-Path -LiteralPath $mcpChromeNativeArtifactPath)) -or
    (-not (Test-Path -LiteralPath $mcpChromeExtensionManifestPath))
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
if ($null -eq $nodeCommand) {
    throw "node is required to install Chrome MCP."
}
if ($mcpChromeNeedsDependencies -or $mcpChromeNeedsBuild) {
    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($null -eq $pnpmCommand) {
        throw "pnpm is required to install Chrome MCP."
    }
}

Write-Host "[INFO] Ensuring Chrome MCP is installed..." -ForegroundColor Cyan
$previousLocation = Get-Location
try {
    Set-Location -LiteralPath $mcpChromePath
    if ($mcpChromeNeedsDependencies) {
        Write-Host "[INFO] Installing Chrome MCP dependencies..." -ForegroundColor Cyan
        & $pnpmCommand.Source install
    }
    if ($mcpChromeNeedsBuild) {
        & $mcpChromeEnsureWinBinScriptPath -WorkspaceRoot $mcpChromePath
        Write-Host "[INFO] Building missing Chrome MCP artifacts..." -ForegroundColor Cyan
        & $pnpmCommand.Source run build:all
    }
    & $nodeCommand.Source $mcpChromeRegisterScriptPath
} finally {
    Set-Location -LiteralPath $previousLocation
}

& $codexCommand.Source mcp add chrome --url $mcpChromeUrl
Write-Host "[INFO] Chrome MCP registered in Codex." -ForegroundColor Green

$mcpChromePortReady = $null -ne (Get-NetTCPConnection -LocalPort $mcpChromePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
$mcpChromePortWasReady = $mcpChromePortReady
if ($mcpChromeNeedsBuild -or -not $mcpChromePortWasReady) {
    $mcpChromeSupervisorArgs = @(
        $mcpChromeSupervisorScriptPath,
        "--project-root", $mcpChromePath,
        "--watch-mode", "dev",
        "--recover-on-start"
    )
} else {
    $mcpChromeSupervisorArgs = @(
        $mcpChromeSupervisorScriptPath,
        "--project-root", $mcpChromePath,
        "--watch-mode", "dev"
    )
}
Write-Host "[INFO] Starting Chrome MCP development service..." -ForegroundColor Cyan
Start-Process -FilePath $mcpChromePython -ArgumentList $mcpChromeSupervisorArgs -WindowStyle Hidden
while (-not $mcpChromePortReady -and $mcpChromePortWaitCount -lt 60) {
    Start-Sleep -Milliseconds 500
    $mcpChromePortReady = $null -ne (Get-NetTCPConnection -LocalPort $mcpChromePort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
    $mcpChromePortWaitCount = $mcpChromePortWaitCount + 1
}
if ($mcpChromePortReady) {
    Write-Host "[INFO] Chrome MCP is listening on 127.0.0.1:$mcpChromePort." -ForegroundColor Green
} else {
    Write-Host "[WARN] Chrome MCP did not become ready; reload the unpacked extension once." -ForegroundColor Yellow
}

$codexArgs = @(
    "--yolo",
    "--dangerously-bypass-hook-trust",
    "--search",
    "--model", $model,
    "--config", ('model_reasoning_effort="{0}"' -f $reasoningEffort),
    "--config", ('plan_mode_reasoning_effort="{0}"' -f $reasoningEffort),
    "--config", ('agents.default_subagent_model="{0}"' -f $model),
    "--config", ('agents.default_subagent_reasoning_effort="{0}"' -f $reasoningEffort)
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
