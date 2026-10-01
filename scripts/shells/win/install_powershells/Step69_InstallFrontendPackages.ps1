# Frontend dependencies for the one workspace every pycore-launched frontend lives in
# (poly_apps\pycore_laravel_wordnew_ui; callmodule_config.FRONTEND_DIR: pycore-manager,
# vortex, pdd-manager, ...). pycore no longer installs dependencies at runtime.
#
# node_modules is junctioned to the program-drive trees root (E:, namespace per
# project) through ProjectTreeCommon.ps1; without E: the shared notice is printed
# and the in-repo directory is kept. The install itself is the UI's own idempotent
# policy (scripts\start.ps1 -Prepare: node + bun, `bun install` converges against
# bun.lock, legacy pnpm layout rebuilt once), the Windows twin of
# `start.sh --prepare` used by the Linux frontend_packages step.
#
# Optional prerequisite: a failure marks the step pending and never stops the service.
[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX = '[Step69-Frontends]'
$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$repoRoot     = $null
$uiDir        = $null
$startScript  = $null
$linkResults  = @()
$prepareOk    = $false

. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'CommonFunc.ps1')
. (Join-Path $winCommonDir 'ProjectTreeCommon.ps1')

$repoRoot = $Global:CORE_NODE_DIR
$uiDir = Join-Path (Join-Path $repoRoot 'poly_apps') 'pycore_laravel_wordnew_ui'
$startScript = Join-Path (Join-Path $uiDir 'scripts') 'start.ps1'

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' Installing frontend dependencies - pycore_laravel_wordnew_ui' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if (-not (Test-Path -LiteralPath $startScript -PathType Leaf)) {
    Write-Host "$SCRIPT_INDEX [skip] pycore_laravel_wordnew_ui start script not found at $startScript" -ForegroundColor DarkYellow
    return
}

$linkResults = @(Invoke-ProjectTreeLinks -RepoRoot $repoRoot -ProjectDir $uiDir -LinkDirs @('node_modules'))
foreach ($linkResult in $linkResults) {
    Write-Host ("$SCRIPT_INDEX  {0}: {1}" -f $linkResult.Path, $linkResult.Result) -ForegroundColor DarkGray
}

if ($Force) {
    & $startScript -Prepare -NonInteractive -ForceInstall
} else {
    & $startScript -Prepare -NonInteractive
}
$prepareOk = ($LASTEXITCODE -eq 0)
if ($prepareOk) {
    Write-Host "$SCRIPT_INDEX [OK] frontend dependencies ready." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [!] frontend dependency install failed (exit $LASTEXITCODE); the frontends will not start until it succeeds. Retrying next run." -ForegroundColor DarkYellow
    Set-GlobalVar -Key 'PYCORE_PREREQUISITE_STEP_STATE' -Value 'pending' | Out-Null
}
