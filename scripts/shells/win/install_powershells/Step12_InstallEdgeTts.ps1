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
# engine for the pycore voice-subtitle pipeline). Runs AFTER Step8_InstallPython,
# Step9_InstallCudaNvidiaPrereq, and Step10_InstallPythonPrereqPackages so
# pip and torch/paddle stacks are ready. Also invoked directly by
# PreparePycorePrerequisites.ps1 (pyservice prerequisite reference).
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
#   - DevInstaller flow:  & Step12_InstallEdgeTts.ps1 <Region>
#   - pyservice flow:     & Step12_InstallEdgeTts.ps1 -Python <py> [-Force]
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
$pipExePath            = $null
$currentVersion        = $null
$pipArgs               = $null

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')

function Get-EdgeTtsVersion {
    param([string]$PipExe, [string]$PythonExe = '')
    $ver = Get-PipPackageVersion -PipExe $PipExe -PackageName 'edge-tts'
    if ($ver) { return $ver }
    if ($PythonExe) {
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            $show = & $PythonExe -m pip show edge-tts 2>&1
            if ("$show" -match '(?m)^Version:\s*(\S+)') { return $Matches[1] }
        } finally { $ErrorActionPreference = $prevEap }
        try {
            $prevEap = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            $spec = (& $PythonExe -c "import importlib.util; print('__FOUND__' if importlib.util.find_spec('edge_tts') else '__MISSING__')" 2>$null) -join ''
            $ErrorActionPreference = $prevEap
            if ($spec -match '__FOUND__') {
                $meta = & $PythonExe -c "import importlib.metadata as m; print(m.version('edge-tts'))" 2>$null
                if ($meta) { return ("$meta").Trim() }
            }
        } catch { }
    }
    return ''
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Installing edge-tts (text-to-speech, latest >= $MIN_VERSION)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$resolvedPython = $Global:PYTHON_EXE_PATH
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [X] Python 3 was NOT found. Run Step8_InstallPython first, or pass -Python <path>." -ForegroundColor Red
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('edge_tts')
}
Write-Host ("$SCRIPT_INDEX python : {0}" -f $resolvedPython) -ForegroundColor DarkGray

$pipExePath = $Global:PIP_EXE_PATH
if (-not $pipExePath) {
    Write-Host "$SCRIPT_INDEX [X] pip.exe not found. Run Step8_InstallPython first." -ForegroundColor Red
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('edge_tts')
}

$currentVersion = Get-EdgeTtsVersion -PipExe $pipExePath -PythonExe $resolvedPython
if ($currentVersion -and -not $Force) {
    try {
        if ([version]$currentVersion -ge [version]$MIN_VERSION) {
            Write-Host ("$SCRIPT_INDEX [OK] edge-tts {0} is current (>= {1}); skipping pip." -f $currentVersion, $MIN_VERSION) -ForegroundColor Green
            Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('edge_tts')
        }
    } catch { }
    Write-Host ("$SCRIPT_INDEX [!] edge-tts {0} is too old (< {1}); upgrading to latest (old versions 403 on a stale handshake)." -f $currentVersion, $MIN_VERSION) -ForegroundColor DarkYellow
}

Write-Host "$SCRIPT_INDEX [..] pip install --upgrade edge-tts ..." -ForegroundColor Yellow
$pipArgs = @('install', '--upgrade', 'edge-tts')
if ($Force) { $pipArgs += '--force-reinstall' }
& $pipExePath @pipArgs

$currentVersion = Get-EdgeTtsVersion -PipExe $pipExePath -PythonExe $resolvedPython
if ($currentVersion) {
    Write-Host ("$SCRIPT_INDEX [OK] edge-tts {0} installed." -f $currentVersion) -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [!] edge-tts install did not complete cleanly; pycore will install it at import time." -ForegroundColor DarkYellow
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('edge_tts')
