# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Single source of truth for the edge-tts prerequisite (DEFAULT text-to-speech
# engine for the pycore voice-subtitle pipeline). Runs AFTER Step9_InstallPython
# so pip is available. Also invoked directly by
# scripts\shells\linux\common\iniscripts\install_edge_tts.ps1 (the pyservice prerequisite
# reference) to keep one copy of the logic.
#
# LATEST VERSION (>= 7.2.4): the NoAudioReceived bug (issue #443) was a 7.2.3
# server-outage workaround once "fixed" by pinning 7.2.1; the real fix shipped in
# 7.2.4. Pinning an OLD version is now harmful — a stale Sec-MS-GEC handshake gets
# rejected with HTTP 403 (issues #290/#458). So we install the LATEST and only
# upgrade if the present version is < 7.2.4. A 403 on the latest is rate-limit /
# regional blocking (set EDGE_TTS_PROXY), not a version problem.
#
# Invocation contracts:
#   - DevInstaller flow:  & Step19_InstallEdgeTts.ps1 <Region>
#   - pyservice flow:     & Step19_InstallEdgeTts.ps1 -Python <py> [-Force]
[CmdletBinding()]
param(
    [string]$Region = 'Global',
    [string]$Python = '',
    [switch]$Force
)

# Variable Declarations (all globals at top, per rule 5)
$ErrorActionPreference = 'Stop'
$SCRIPT_INDEX          = '[Step19-EdgeTts]'
$MIN_VERSION           = '7.2.4'
$resolvedPython        = $null
$currentVersion        = $null
$pipArgs               = $null

# Resolve a REAL Python interpreter (skip the Windows Store alias stub). Mirrors
# the resolution policy used by pyservice.ps1 / Step17 so behaviour stays consistent.
function Resolve-PythonInterpreter {
    param([string]$Preferred = '')

    if ($Preferred -and (Test-Path $Preferred)) {
        try {
            $v = & $Preferred --version 2>&1
            if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') { return $Preferred }
        } catch { }
    }

    $candidates = New-Object System.Collections.Generic.List[string]
    foreach ($name in 'python', 'python3', 'py') {
        Get-Command $name -All -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Source -and $_.Source -notmatch 'WindowsApps') { $candidates.Add($_.Source) }
        }
    }
    foreach ($p in @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'),
        'C:\Python313\python.exe', 'C:\Python312\python.exe', 'C:\Python311\python.exe',
        (Join-Path $env:USERPROFILE 'scoop\shims\python.exe')
    )) { $candidates.Add($p) }

    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) {
            try {
                $v = & $c --version 2>&1
                if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') { return $c }
            } catch { }
        }
    }
    return $null
}

# Installed edge_tts version, or '' when not importable. Swallows errors in
# Python so no stderr traceback becomes a NativeCommandError under -EA Stop.
function Get-EdgeTtsVersion {
    param([string]$Py)
    $code = "import sys`ntry:`n    import edge_tts`n    sys.stdout.write(getattr(edge_tts,'__version__',''))`nexcept Exception:`n    pass"
    $out = & $Py -c $code 2>$null
    return ("$out").Trim()
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Installing edge-tts (text-to-speech, latest >= $MIN_VERSION)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

# --- 0) resolve python (Step9_InstallPython has already run in the installer flow) --- #
$resolvedPython = Resolve-PythonInterpreter -Preferred $Python
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [X] Python 3 was NOT found. Run Step9_InstallPython first, or pass -Python <path>." -ForegroundColor Red
    exit 1
}
Write-Host ("$SCRIPT_INDEX python : {0}" -f $resolvedPython) -ForegroundColor DarkGray

# --- 1) edge-tts latest install (idempotent) ----------------------------- #
$currentVersion = Get-EdgeTtsVersion -Py $resolvedPython
if ($currentVersion -and -not $Force) {
    try {
        if ([version]$currentVersion -ge [version]$MIN_VERSION) {
            Write-Host ("$SCRIPT_INDEX [OK] edge-tts {0} is current (>= {1}); skipping pip." -f $currentVersion, $MIN_VERSION) -ForegroundColor Green
            exit 0
        }
    } catch { }   # unparseable version -> fall through and upgrade
    Write-Host ("$SCRIPT_INDEX [!] edge-tts {0} is too old (< {1}); upgrading to latest (old versions 403 on a stale handshake)." -f $currentVersion, $MIN_VERSION) -ForegroundColor DarkYellow
}

Write-Host "$SCRIPT_INDEX [..] pip install --upgrade edge-tts ..." -ForegroundColor Yellow
$pipArgs = @('-m', 'pip', 'install', '--upgrade', 'edge-tts')
if ($Force) { $pipArgs += '--force-reinstall' }
try {
    & $resolvedPython @pipArgs
    $rc = $LASTEXITCODE
} catch {
    Write-Host ("$SCRIPT_INDEX [!] pip threw: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
    $rc = 1
}
if ($rc -ne 0) {
    Write-Host "$SCRIPT_INDEX [!] edge-tts install did not complete cleanly; pycore will install it at import time." -ForegroundColor DarkYellow
    exit 0
}

$currentVersion = Get-EdgeTtsVersion -Py $resolvedPython
Write-Host ("$SCRIPT_INDEX [OK] edge-tts {0} installed." -f $currentVersion) -ForegroundColor Green

exit 0
