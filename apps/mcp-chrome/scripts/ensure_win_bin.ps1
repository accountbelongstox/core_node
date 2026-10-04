# Idempotent: ensures bun .bin shims are Windows-compatible. Bun on Windows writes
# `<name>.exe` + `<name>.bunx` (bun >= 1.1) or `<name>.cmd` (older); a .bin dir with only
# Unix-style shims (created by bash/WSL bun install) is fixed by removing all
# node_modules and reinstalling from PowerShell. Safe to run multiple times - exits
# early when any Windows shim form is present.

param(
    [Parameter(Mandatory = $true)]
    [string]$WorkspaceRoot
)

$ErrorActionPreference = "Stop"

$ProbeDir = Join-Path (Join-Path (Join-Path (Join-Path $WorkspaceRoot "app") "chrome-extension") "node_modules") ".bin"
$ProbeName = "wxt"
$ProbeExtensions = @(".exe", ".bunx", ".cmd")
$NmRoot = Join-Path $WorkspaceRoot "node_modules"
$NmChromeExt = Join-Path (Join-Path (Join-Path $WorkspaceRoot "app") "chrome-extension") "node_modules"
$NmNative = Join-Path (Join-Path (Join-Path $WorkspaceRoot "app") "native-server") "node_modules"
$NmShared = Join-Path (Join-Path (Join-Path $WorkspaceRoot "packages") "shared") "node_modules"
$NmDirs = @($NmRoot, $NmChromeExt, $NmNative, $NmShared)
$SavedLocation = $null

function Test-WindowsShim {
    foreach ($Extension in $ProbeExtensions) {
        if (Test-Path -LiteralPath (Join-Path $ProbeDir ($ProbeName + $Extension))) {
            return $true
        }
    }
    return $false
}

if (Test-WindowsShim) {
    Write-Host "  OK Windows bun shims present" -ForegroundColor Green
    return
}

Write-Host "  [FIX] Windows bun shims missing - bun was previously installed via bash/WSL." -ForegroundColor Yellow
Write-Host "  [FIX] Removing all node_modules and reinstalling from PowerShell..." -ForegroundColor Yellow

foreach ($Dir in $NmDirs) {
    if (Test-Path $Dir) {
        Write-Host ("  Removing: " + $Dir) -ForegroundColor DarkGray
        Remove-Item -LiteralPath $Dir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "  Running bun install from PowerShell (generates Windows shims)..." -ForegroundColor Cyan
$SavedLocation = Get-Location
Set-Location -LiteralPath $WorkspaceRoot
& bun install
Set-Location -LiteralPath $SavedLocation.Path

if (Test-WindowsShim) {
    Write-Host "  OK Windows bun shims now present" -ForegroundColor Green
} else {
    Write-Host "  ERROR: Windows bun shims still missing after reinstall - bun install may have failed." -ForegroundColor Red
    throw "Windows bun command shims are still missing after reinstall."
}
