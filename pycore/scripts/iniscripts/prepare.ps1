<#
.SYNOPSIS
    Prerequisite-install orchestrator for the Pycore service (Windows).

.DESCRIPTION
    This directory (pycore\scripts\iniscripts) holds the shell-managed
    prerequisite installers that run BEFORE pycore_module_caller.py launches.
    Their job is to set up the heavy / awkward third-party packages that are
    more convenient to install from a shell than from Python's import-time
    auto-installer (pycore\pyfoundations\third_party.py). third_party.py still
    fast-detects and installs the lighter packages; these scripts cover the rest
    (e.g. whisper, with its model download and GPU runtime libs).

    prepare.ps1 simply AUTO-DISCOVERS every `install_*.ps1` file next to it and
    runs each one, passing the resolved Python path. To add a new prerequisite,
    drop an `install_<name>.ps1` here - no edit to this orchestrator is needed.
    Each installer MUST be idempotent (detect "already installed" and skip).

.PARAMETER Python
    Path to the python.exe the installers should target. Default: 'python'.

.PARAMETER Include
    Optional: only run installers whose name (without the install_ prefix and
    .ps1 suffix) is in this list, e.g. -Include whisper.

.PARAMETER WhisperModel
    Forwarded to install_whisper.ps1 to also pre-download a whisper model.

.EXAMPLE
    .\prepare.ps1 -Python C:\Python312\python.exe
    .\prepare.ps1 -Include whisper -WhisperModel base
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [string[]]$Include = @(),
    [string]$WhisperModel = ''
)

$ErrorActionPreference = 'Stop'

Write-Host '------------------------------------------------------' -ForegroundColor Cyan
Write-Host ' Pycore prerequisites (iniscripts)' -ForegroundColor Cyan
Write-Host '------------------------------------------------------' -ForegroundColor Cyan

# Discover all install_*.ps1 scripts next to this orchestrator.
$installers = Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'install_*.ps1' -File |
              Sort-Object Name

if (-not $installers) {
    Write-Host '[i] No install_*.ps1 prerequisite scripts found.' -ForegroundColor DarkYellow
    exit 0
}

$failed = @()
foreach ($installer in $installers) {
    $name = $installer.BaseName -replace '^install_', ''   # e.g. install_whisper -> whisper

    if ($Include.Count -gt 0 -and ($Include -notcontains $name)) {
        Write-Host ("[skip] {0} (not in -Include)" -f $name) -ForegroundColor DarkGray
        continue
    }

    Write-Host ("[..] Prerequisite: {0}" -f $name) -ForegroundColor Yellow

    # Build per-installer args. Every installer accepts -Python; the whisper one
    # additionally accepts -Model (fed from -WhisperModel).
    # NOTE: use a HASHTABLE for splatting - array splatting (@('-Python', ...))
    # binds POSITIONALLY and does NOT honor the -Name tokens, so -Python ends up
    # as a *value*. Hashtable splatting binds by parameter name.
    $installerArgs = @{ Python = $Python }
    if (($name -eq 'whisper' -or $name -eq 'faster_whisper') -and $WhisperModel) { $installerArgs['Model'] = $WhisperModel }

    try {
        & $installer.FullName @installerArgs
        if ($LASTEXITCODE -ne 0) {
            Write-Host ("[!] {0} exited with {1}." -f $name, $LASTEXITCODE) -ForegroundColor DarkYellow
            $failed += $name
        }
    } catch {
        Write-Host ("[!] {0} threw: {1}" -f $name, $_.Exception.Message) -ForegroundColor DarkYellow
        $failed += $name
    }
}

if ($failed.Count -gt 0) {
    Write-Host ("[!] Some prerequisites did not complete cleanly: {0}" -f ($failed -join ', ')) -ForegroundColor DarkYellow
    # Non-fatal: the service can still start; affected features may be degraded.
    exit 0
}

Write-Host '[OK] All prerequisites complete.' -ForegroundColor Green
exit 0
