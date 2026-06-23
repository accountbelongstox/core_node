<#
.SYNOPSIS
    Prerequisite installer for the multi-terminal grid launcher on Windows
    (pycore/pyutils/launcher: wt_launcher.py). The launcher arranges a grid of
    Windows Terminal windows and is the `launcher` autostart target
    (python -m pycore.pyutils.launcher --mode windows). The autostart `target`
    selection lives in pycore/callmodule/platform/autostart_target.py.

    Discovered & run by prepare.ps1 (which pyservice.ps1 invokes). Ensures the
    Windows Terminal CLI (wt.exe) the launcher drives with `wt -w new --pos/--size`
    is available; when it is missing it is installed best-effort via winget
    (Microsoft.WindowsTerminal).

    IDEMPOTENT: skips when wt.exe is already on PATH. NON-FATAL: when winget is
    absent or the install fails, it exits cleanly - the launcher then falls back
    to whatever terminal is available.

.PARAMETER Python
    Accepted for prepare.ps1 compatibility; unused (this installs a system app).

.PARAMETER Force
    Reinstall Windows Terminal even if wt.exe is already present.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Variable Declarations (all at top)
$wtPresent  = $false
$wingetCmd  = $null
$wtPackage  = 'Microsoft.WindowsTerminal'
$wtArgs     = @()
$rc         = 0

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' Installing multi-terminal launcher prerequisites (Windows)' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$wtPresent = [bool](Get-Command 'wt.exe' -ErrorAction SilentlyContinue)
if ($wtPresent -and (-not $Force)) {
    Write-Host '[OK] Windows Terminal (wt.exe) already present; skipping.' -ForegroundColor Green
    exit 0
}

$wingetCmd = Get-Command 'winget' -ErrorAction SilentlyContinue
if (-not $wingetCmd) {
    Write-Host '[i] winget not found; cannot auto-install Windows Terminal. Install it from the Microsoft Store, then the grid launcher will use it.' -ForegroundColor DarkYellow
    exit 0
}

Write-Host ('[..] winget install {0} ...' -f $wtPackage) -ForegroundColor Yellow
# Build args as a list and splat. -Force honors the documented reinstall contract.
$wtArgs = @('install', '--id', $wtPackage, '-e', '--accept-source-agreements', '--accept-package-agreements')
if ($Force) { $wtArgs += '--force' }
try {
    # Do NOT pipe to Out-Null: that would discard winget's exit code, making every
    # outcome look like success. Capture $LASTEXITCODE and verify wt.exe afterward.
    & $wingetCmd.Source @wtArgs
    $rc = $LASTEXITCODE
    if (Get-Command 'wt.exe' -ErrorAction SilentlyContinue) {
        Write-Host '[OK] Windows Terminal present.' -ForegroundColor Green
    } elseif ($rc -eq 0) {
        Write-Host '[!] winget reported success but wt.exe is not on PATH yet (a re-login may be needed).' -ForegroundColor DarkYellow
    } else {
        Write-Host ('[!] Windows Terminal install did not succeed (winget exit {0}); the launcher will use another terminal if present.' -f $rc) -ForegroundColor DarkYellow
    }
} catch {
    Write-Host ('[!] Windows Terminal install skipped/failed (optional): {0}' -f $_.Exception.Message) -ForegroundColor DarkYellow
}

# Non-fatal by design: the launcher still runs with whatever terminal is present.
exit 0
