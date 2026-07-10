<#
.SYNOPSIS
    MeloTTS offline TTS prerequisite — status-only by default; heavy install is
    DevInstaller Step13 (-Melotts) or explicit -Full / MELOTTS_INSTALL=1.

.DESCRIPTION
    MeloTTS pins transformers==4.27.4, which can downgrade the shared env, so it
    is NOT installed during normal pyservice boot unless -Full / MELOTTS_INSTALL=1.
    Use DevInstaller Step13 (-Melotts) for the canonical install path.

.PARAMETER Python
    python.exe to target. Default: 'python' on PATH.
.PARAMETER Full
    Perform the heavy install via Step13 (-Melotts).
.PARAMETER Force
    Reinstall / re-warm even if `melo` is already present.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Variable declarations (all at top)
$SCRIPT_INDEX   = '[install_melotts]'
$resolvedPython = $null
$doFull         = ($Full -or $env:MELOTTS_INSTALL -eq '1')
$repoRoot       = Split-Path (Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent) -Parent
$stepScript     = Join-Path $repoRoot 'scripts\shells\win\install_powershells\Step13_InstallTtsOffline.ps1'
$melodPresent   = $false

function Resolve-PythonInterpreter {
    param([string]$Preferred = '')
    if ($Preferred -and (Test-Path $Preferred)) {
        try { $v = & $Preferred --version 2>&1; if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') { return $Preferred } } catch { }
    }
    foreach ($name in 'python', 'python3', 'py') {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source -and $cmd.Source -notmatch 'WindowsApps') {
            try { $v = & $cmd.Source --version 2>&1; if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') { return $cmd.Source } } catch { }
        }
    }
    return $null
}

function Test-PyModule {
    param([string]$Py, [string]$ModuleName)
    & $Py -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$ModuleName') else 1)" 2>$null
    return ($LASTEXITCODE -eq 0)
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX MeloTTS (free offline zh/en TTS)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$resolvedPython = Resolve-PythonInterpreter -Preferred $Python
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step8_InstallPython first, or pass -Python <path>." -ForegroundColor DarkYellow
    return
}
if ($env:MELOTTS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] MELOTTS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    return
}

$melodPresent = Test-PyModule -Py $resolvedPython -ModuleName 'melo'
Write-Host ("$SCRIPT_INDEX  python  : {0}" -f $resolvedPython) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  melo    : {0}" -f $(if ($melodPresent) { 'installed' } else { 'absent' })) -ForegroundColor DarkGray

if (-not $doFull -and -not $Force) {
    if ($melodPresent) {
        Write-Host "$SCRIPT_INDEX [OK] MeloTTS already installed (status-only)." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [i] MeloTTS not installed (status-only). Use Step13 -Melotts, -Full, or MELOTTS_INSTALL=1." -ForegroundColor DarkGray
    }
    return
}

if (-not (Test-Path -LiteralPath $stepScript)) {
    Write-Host ("$SCRIPT_INDEX [X] Step13 script not found: {0}" -f $stepScript) -ForegroundColor Red
    return
}

Write-Host ("$SCRIPT_INDEX [i] Delegating MeloTTS install to: {0}" -f $stepScript) -ForegroundColor DarkGray
$stepArgs = @{ Python = $resolvedPython; Melotts = $true }
if ($Force) { $stepArgs['Force'] = $true }
& $stepScript @stepArgs

if (Test-PyModule -Py $resolvedPython -ModuleName 'melo') {
    Write-Host "$SCRIPT_INDEX [OK] MeloTTS ready." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [!] MeloTTS not importable after Step13." -ForegroundColor DarkYellow
}
