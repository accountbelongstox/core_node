# Idempotent: ensures bun .bin shims are Windows-compatible (.cmd files exist).
# Detects Unix-style .bin dirs (created by bash/WSL bun install) and fixes them
# by removing all node_modules and reinstalling from PowerShell so Windows .cmd
# shims are generated correctly. Safe to run multiple times — exits early when OK.

param(
    [Parameter(Mandatory = $true)]
    [string]$WorkspaceRoot
)

$ErrorActionPreference = "Stop"

$ProbeDir = Join-Path (Join-Path (Join-Path (Join-Path $WorkspaceRoot "app") "chrome-extension") "node_modules") ".bin"
$ProbeFile = Join-Path $ProbeDir "wxt.cmd"

if (Test-Path $ProbeFile) {
    Write-Host "  OK Windows .cmd shims present" -ForegroundColor Green
    return
}

Write-Host "  [FIX] Windows .cmd shims missing — bun was previously installed via bash/WSL." -ForegroundColor Yellow
Write-Host "  [FIX] Removing all node_modules and reinstalling from PowerShell..." -ForegroundColor Yellow

$NmRoot = Join-Path $WorkspaceRoot "node_modules"
$NmChromeExt = Join-Path (Join-Path (Join-Path $WorkspaceRoot "app") "chrome-extension") "node_modules"
$NmNative = Join-Path (Join-Path (Join-Path $WorkspaceRoot "app") "native-server") "node_modules"
$NmShared = Join-Path (Join-Path (Join-Path $WorkspaceRoot "packages") "shared") "node_modules"
$NmDirs = @($NmRoot, $NmChromeExt, $NmNative, $NmShared)

foreach ($Dir in $NmDirs) {
    if (Test-Path $Dir) {
        Write-Host ("  Removing: " + $Dir) -ForegroundColor DarkGray
        Remove-Item -LiteralPath $Dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "  Running bun install from PowerShell (generates Windows .cmd shims)..." -ForegroundColor Cyan
$SavedLocation = Get-Location
Set-Location -LiteralPath $WorkspaceRoot
& bun install
Set-Location -LiteralPath $SavedLocation.Path

if (Test-Path $ProbeFile) {
    Write-Host "  OK Windows .cmd shims now present" -ForegroundColor Green
} else {
    Write-Host "  ERROR: .cmd shims still missing after reinstall — bun install may have failed." -ForegroundColor Red
    throw "Windows bun command shims are still missing after reinstall."
}
