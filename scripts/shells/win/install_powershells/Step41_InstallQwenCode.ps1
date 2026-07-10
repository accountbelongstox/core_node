# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using Split-Path, Join-Path, or Resolve-Path.
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Qwen Code (qwen CLI) installation - Windows. Official Alibaba/QwenLM coding agent CLI.
# Installed via the shared npm global (same pattern as pnpm/yarn in Step4_InstallNodeJS.ps1):
# npm.cmd lives in $Global:NODE_DIR, so `npm install -g` lands qwen.cmd in $Global:NODE_DIR
# (on PATH) for the installing user. Official sources:
#   https://github.com/QwenLM/qwen-code   (npm: @qwen-code/qwen-code)
# Alternative official installer (per-user):
#   irm https://qwen-code-assets.oss-cn-hangzhou.aliyuncs.com/installation/install-qwen-standalone.ps1 | iex
# Idempotent: skipped when `qwen --version` already works.

$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
$shellsWinRoot = Split-Path $scriptRoot -Parent
$winCommonDir = Join-Path $shellsWinRoot "win_common"

. (Join-Path $winCommonDir "GlobalVars.ps1")
. (Join-Path $winCommonDir "CommonFunc.ps1")

$SCRIPT_INDEX = "[Step 41]"
$QwenExec = "qwen"
$QwenPackage = "@qwen-code/qwen-code"

# Resolve npm: prefer the installed Node npm.cmd (shared global bin), fall back to PATH.
function Resolve-NpmCmd {
    $npmFromNode = Join-Path $Global:NODE_DIR "npm.cmd"
    if (Test-Path $npmFromNode) { return $npmFromNode }
    $cmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

Write-Host "$SCRIPT_INDEX Qwen Code ($QwenExec CLI) via npm" -ForegroundColor Cyan

# Idempotent: skip if qwen already works.
$qwenCmd = Get-Command $QwenExec -ErrorAction SilentlyContinue
if ($qwenCmd) {
    $ver = & $QwenExec --version 2>$null | Select-Object -First 1
    Write-Host "$SCRIPT_INDEX [SKIP] $QwenExec already installed: $($qwenCmd.Source) ($ver)" -ForegroundColor Green
    exit 0
}

$npmCmd = Resolve-NpmCmd
if (-not $npmCmd) {
    Write-Host "$SCRIPT_INDEX [ERROR] npm not found. Run Step4_InstallNodeJS.ps1 first." -ForegroundColor Red
    exit 1
}
Write-Host "$SCRIPT_INDEX Using npm: $npmCmd" -ForegroundColor White

Write-Host "$SCRIPT_INDEX Installing $QwenPackage (global)..." -ForegroundColor Yellow
& $npmCmd install -g $QwenPackage
if ($LASTEXITCODE -ne 0) {
    Write-Host "$SCRIPT_INDEX [ERROR] npm install failed for $QwenPackage." -ForegroundColor Red
    exit 1
}

$qwenCmd = Get-Command $QwenExec -ErrorAction SilentlyContinue
$qwenFromNode = Join-Path $Global:NODE_DIR "$QwenExec.cmd"
if ($qwenCmd) {
    $ver = & $QwenExec --version 2>$null | Select-Object -First 1
    Write-Host "$SCRIPT_INDEX [OK] $QwenExec ready: $($qwenCmd.Source) ($ver)" -ForegroundColor Green
} elseif (Test-Path $qwenFromNode) {
    Write-Host "$SCRIPT_INDEX [OK] $QwenExec installed at $qwenFromNode (restart shell to pick up PATH)." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [WARN] $QwenExec not on PATH yet; restart your shell." -ForegroundColor Yellow
}
exit 0
