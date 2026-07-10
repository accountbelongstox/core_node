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

# Volcano Engine Ark CLI (arkcli) installation - Windows. Official Volcano Ark MaaS
# toolbox CLI. npm is the sole official channel. Installed via the shared npm global
# (same pattern as pnpm/yarn in Step4_InstallNodeJS.ps1): npm.cmd lives in
# $Global:NODE_DIR, so `npm install -g` lands arkcli.cmd in $Global:NODE_DIR (on PATH).
# Official sources:
#   https://github.com/volcengine/ark-cli   (npm: @volcengine/ark-cli)
# After install: `arkcli auth login volc-sso` then `arkcli +connect` to sync Ark Skills.
# Idempotent: skipped when `arkcli --version` already works.

$scriptRoot = $PSScriptRoot
if (-not $scriptRoot) { $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path }
$shellsWinRoot = Split-Path $scriptRoot -Parent
$winCommonDir = Join-Path $shellsWinRoot "win_common"

. (Join-Path $winCommonDir "GlobalVars.ps1")
. (Join-Path $winCommonDir "CommonFunc.ps1")

$SCRIPT_INDEX = "[Step 42]"
$ArkExec = "arkcli"
$ArkPackage = "@volcengine/ark-cli"

# Resolve npm: prefer the installed Node npm.cmd (shared global bin), fall back to PATH.
function Resolve-NpmCmd {
    $npmFromNode = Join-Path $Global:NODE_DIR "npm.cmd"
    if (Test-Path $npmFromNode) { return $npmFromNode }
    $cmd = Get-Command npm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

Write-Host "$SCRIPT_INDEX Volcano Engine Ark CLI ($ArkExec) via npm" -ForegroundColor Cyan

# Idempotent: skip if arkcli already works.
$arkCmd = Get-Command $ArkExec -ErrorAction SilentlyContinue
if ($arkCmd) {
    $ver = & $ArkExec --version 2>$null | Select-Object -First 1
    Write-Host "$SCRIPT_INDEX [SKIP] $ArkExec already installed: $($arkCmd.Source) ($ver)" -ForegroundColor Green
    exit 0
}

$npmCmd = Resolve-NpmCmd
if (-not $npmCmd) {
    Write-Host "$SCRIPT_INDEX [ERROR] npm not found. Run Step4_InstallNodeJS.ps1 first." -ForegroundColor Red
    exit 1
}
Write-Host "$SCRIPT_INDEX Using npm: $npmCmd" -ForegroundColor White

Write-Host "$SCRIPT_INDEX Installing $ArkPackage (global)..." -ForegroundColor Yellow
& $npmCmd install -g $ArkPackage
if ($LASTEXITCODE -ne 0) {
    Write-Host "$SCRIPT_INDEX [ERROR] npm install failed for $ArkPackage." -ForegroundColor Red
    exit 1
}

$arkCmd = Get-Command $ArkExec -ErrorAction SilentlyContinue
$arkFromNode = Join-Path $Global:NODE_DIR "$ArkExec.cmd"
if ($arkCmd) {
    $ver = & $ArkExec --version 2>$null | Select-Object -First 1
    Write-Host "$SCRIPT_INDEX [OK] $ArkExec ready: $($arkCmd.Source) ($ver)" -ForegroundColor Green
} elseif (Test-Path $arkFromNode) {
    Write-Host "$SCRIPT_INDEX [OK] $ArkExec installed at $arkFromNode (restart shell to pick up PATH)." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [WARN] $ArkExec not on PATH yet; restart your shell." -ForegroundColor Yellow
}
exit 0
