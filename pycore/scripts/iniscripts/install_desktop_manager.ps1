<#
.SYNOPSIS
    Prerequisite installer for the Desktop Manager UI (React/Vite) used by the
    PySide6 webview. Runs `npm install` once (idempotent).

.DESCRIPTION
    Auto-discovered and run by prepare.ps1 before the Pycore service launches.
    Installs the Node dependencies for pycore\pyctl\desktop\desktop-manager so the
    UI dev server (or a production build) can start. The UI is OPTIONAL: if Node is
    not installed, this skips with a warning (the service still runs; PySide6 falls
    back to the legacy /web/subtitle UI).

    IDEMPOTENT: skips `npm install` when node_modules already exists (use -Force to
    reinstall). It never builds here; building is done on demand by pyservice
    (-UiBuild) or `npm run build`.

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

# pycore\scripts\iniscripts  ->  pycore\pyctl\desktop\desktop-manager
$uiDir = Join-Path $PSScriptRoot '..\..\pyctl\desktop\desktop-manager'

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' Installing Desktop Manager UI deps (npm)' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $uiDir 'package.json'))) {
    Write-Host "[skip] desktop-manager not found at $uiDir" -ForegroundColor DarkYellow
    exit 0
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Write-Host '[skip] Node/npm not found on PATH. UI is optional; install Node 18+ to enable it.' -ForegroundColor DarkYellow
    Write-Host '       (winget install OpenJS.NodeJS.LTS  /  scoop install nodejs-lts)' -ForegroundColor DarkGray
    exit 0
}

$nodeModules = Join-Path $uiDir 'node_modules'
if ((Test-Path $nodeModules) -and -not $Force) {
    Write-Host '[OK] node_modules present; skipping npm install.' -ForegroundColor Green
    exit 0
}

Write-Host ("[..] npm install in {0} ..." -f $uiDir) -ForegroundColor Yellow
Push-Location -LiteralPath $uiDir
try {
    & npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[!] npm install reported an error; UI may not start.' -ForegroundColor DarkYellow
        exit 0   # non-fatal: the service can still run with the legacy UI
    }
    Write-Host '[OK] UI dependencies installed.' -ForegroundColor Green
}
finally {
    Pop-Location
}
exit 0
