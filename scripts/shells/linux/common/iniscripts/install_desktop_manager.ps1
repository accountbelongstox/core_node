<#
.SYNOPSIS
    Prerequisite installer for the UNIFIED dashboard UI (poly_apps\pycore_laravel_wordflow_ui,
    React/Vite) loaded by the PySide6 webview. Runs `pnpm install` once (idempotent).

.DESCRIPTION
    Auto-discovered and run by prepare.ps1 before the Pycore service launches.
    Pre-warms the Node dependencies for poly_apps\pycore_laravel_wordflow_ui (its
    pycore-manager end is what the webview loads via PYCORE_UI_URL) so the Vite dev
    server starts fast. The legacy standalone app pycore\pyctl\desktop\desktop-manager
    is SUPERSEDED and no longer installed here (code is kept but unused).

    The UI is OPTIONAL: if pnpm is not installed, this skips with a warning (the
    service still runs; PySide6 falls back to the legacy /web/subtitle UI).

    IDEMPOTENT: skips `pnpm install` when node_modules already exists (use -Force to
    reinstall). It never builds here; building is done on demand by pyservice
    (-UiBuild). pyservice.ps1's run step also installs deps on demand.

.PARAMETER Python
    Accepted for prepare.ps1 compatibility; unused (this is a Node prerequisite).

.PARAMETER Force
    Reinstall node_modules even if present.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',   # unused; kept for prepare.ps1's uniform call
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# scripts\shells\linux\common\iniscripts  ->  core_node\poly_apps\pycore_laravel_wordflow_ui (five parents up)
$uiDir = Join-Path $PSScriptRoot '..\..\..\..\..\poly_apps\pycore_laravel_wordflow_ui'

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' Installing Dashboard UI deps (pnpm) - pycore_laravel_wordflow_ui' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $uiDir 'package.json'))) {
    Write-Host "[skip] pycore_laravel_wordflow_ui not found at $uiDir" -ForegroundColor DarkYellow
    exit 0
}

$pnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if (-not $pnpm) {
    Write-Host '[skip] pnpm not found on PATH. UI is optional; install Node 18+ and pnpm to enable it.' -ForegroundColor DarkYellow
    Write-Host '       (npm install -g pnpm)' -ForegroundColor DarkGray
    exit 0
}

$nodeModules = Join-Path $uiDir 'node_modules'
if ((Test-Path $nodeModules) -and -not $Force) {
    Write-Host '[OK] node_modules present; skipping pnpm install.' -ForegroundColor Green
    exit 0
}

Write-Host ("[..] pnpm install in {0} ..." -f $uiDir) -ForegroundColor Yellow
Push-Location -LiteralPath $uiDir
try {
    & pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[!] pnpm install reported an error; UI may not start.' -ForegroundColor DarkYellow
        exit 0   # non-fatal: the service can still run with the legacy UI
    }
    Write-Host '[OK] Dashboard UI dependencies installed.' -ForegroundColor Green
}
finally {
    Pop-Location
}
exit 0
