<#
.SYNOPSIS
    Service entry point for the Pycore Module Caller (Windows / PowerShell).

.DESCRIPTION
    `pyservice.ps1` is ONLY an entry point. It does two things, in order:

        1. PREREQUISITES: runs pycore\scripts\iniscripts\prepare.ps1, which
           installs the heavy third-party packages that are more convenient to
           set up from a shell (e.g. whisper) than from Python. This complements
           pycore\pyfoundations\third_party.py, which fast-detects/installs the
           lighter packages at import time. Skip this step with -NoInstall.

        2. LAUNCH: starts pycore\pycore_module_caller.py (the real worker, which
           now lives inside the pycore package, not at the repo root).

    Both the prerequisite scripts and the worker are invoked through RELATIVE
    paths from this script's own folder, so the repo can live anywhere.

.PARAMETER BindHost
    Host the RPC v2 server binds to. Default: 0.0.0.0

.PARAMETER Port
    Port the RPC v2 server binds to. Default: 59000

.PARAMETER DebugMode
    Enable the worker's debug mode. (Named -DebugMode because -Debug is a reserved
    PowerShell common parameter.)

.PARAMETER NoInstall
    Skip the prerequisite-install step (step 1) and launch the worker directly.

.PARAMETER Only
    Run ONLY the prerequisite-install step and exit (do not launch the worker).
    Useful for provisioning a machine ahead of time.

.PARAMETER WhisperModel
    Forwarded to the prerequisite step: also pre-download this whisper model
    (e.g. -WhisperModel base). Skipped if already cached.

.PARAMETER Include
    Forwarded to the prerequisite step: only run the named installer(s), e.g.
    -Include whisper. Default: run all discovered install_*.ps1.

.EXAMPLE
    .\pyservice.ps1
    Install prerequisites, then launch on 0.0.0.0:59000.

.EXAMPLE
    .\pyservice.ps1 -NoInstall -Port 8000 -DebugMode
    Skip prerequisites; launch on port 8000 in debug mode.

.EXAMPLE
    .\pyservice.ps1 -Only -WhisperModel base
    Only install prerequisites (incl. pre-downloading the whisper 'base' model).
#>
[CmdletBinding()]
param(
    [string]$BindHost = '0.0.0.0',
    [int]   $Port     = 59000,
    [switch]$DebugMode,
    [switch]$NoInstall,
    [switch]$Only,
    [string]$WhisperModel = '',
    [string[]]$Include = @()
)

$ErrorActionPreference = 'Stop'

# --------------------------------------------------------------------------- #
# Locate a REAL Python interpreter (skip the Windows Store alias stub).        #
# --------------------------------------------------------------------------- #
function Resolve-Python {
    $candidates = New-Object System.Collections.Generic.List[string]

    foreach ($name in 'python', 'python3', 'py') {
        Get-Command $name -All -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Source -and $_.Source -notmatch 'WindowsApps') {
                $candidates.Add($_.Source)
            }
        }
    }
    foreach ($p in @(
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "C:\Python313\python.exe", "C:\Python312\python.exe", "C:\Python311\python.exe",
        "$env:USERPROFILE\scoop\shims\python.exe"
    )) { $candidates.Add($p) }

    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) {
            try {
                $v = & $c --version 2>&1
                if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') {
                    return [PSCustomObject]@{ Path = $c; Version = ("$v").Trim() }
                }
            } catch { }
        }
    }
    return $null
}

Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ' Pycore Service - entry point' -ForegroundColor Cyan
Write-Host '======================================================' -ForegroundColor Cyan

$py = Resolve-Python
if (-not $py) {
    Write-Host '[X] Python 3 was NOT found.' -ForegroundColor Red
    Write-Host '    (The Microsoft Store "python.exe" alias is a stub and does not count.)' -ForegroundColor DarkYellow
    Write-Host '    Install one of the following, then re-run this script:' -ForegroundColor Yellow
    Write-Host '      - winget install Python.Python.3.12'
    Write-Host '      - scoop install python'
    Write-Host '      - or download from https://www.python.org/downloads/'
    exit 1
}
Write-Host ("[OK] Python : {0}" -f $py.Version) -ForegroundColor Green
Write-Host ("       path : {0}" -f $py.Path)    -ForegroundColor DarkGray

# Relative paths from this script's folder (repo root).
$prepareRel = '.\pycore\scripts\iniscripts\prepare.ps1'
$workerRel  = '.\pycore\pycore_module_caller.py'

Push-Location -LiteralPath $PSScriptRoot
try {
    # --- 1) prerequisites ------------------------------------------------- #
    if ($NoInstall) {
        Write-Host '[i] Skipping prerequisite install (-NoInstall).' -ForegroundColor DarkYellow
    } else {
        Write-Host '[..] Running prerequisite installers ...' -ForegroundColor Yellow
        # Hashtable splat -> binds by parameter name (array splat would not).
        $prepareParams = @{ Python = $py.Path }
        if ($Include.Count -gt 0) { $prepareParams['Include']      = $Include }
        if ($WhisperModel)        { $prepareParams['WhisperModel'] = $WhisperModel }
        & $prepareRel @prepareParams
        if ($LASTEXITCODE -ne 0) {
            Write-Host ("[!] Prerequisite step exited with {0}; continuing to launch." -f $LASTEXITCODE) -ForegroundColor DarkYellow
        }
    }

    if ($Only) {
        Write-Host '[OK] Prerequisite step complete (-Only); not launching the worker.' -ForegroundColor Green
        exit 0
    }

    # --- 2) launch the worker -------------------------------------------- #
    $pyArgs = @('-u', $workerRel, '--host', $BindHost, '--port', $Port)
    if ($DebugMode) { $pyArgs += '--debug' }

    Write-Host ''
    Write-Host ("[>] Launching worker: {0}" -f $workerRel) -ForegroundColor Cyan
    Write-Host ''
    & $py.Path @pyArgs
    $code = $LASTEXITCODE
}
finally {
    Pop-Location
}

exit $code
