# Single source of truth for the edge-tts prerequisite (DEFAULT text-to-speech
# engine for the pycore voice-subtitle pipeline). Runs AFTER Python_Default,
# Python_CudaPrereq, and Python_PrereqPackages so
# pip and torch/paddle stacks are ready. Also invoked directly by
# PreparePycorePrerequisites.ps1 (pyservice prerequisite reference).
# reference) to keep one copy of the logic.
#
# Existing edge-tts installations are preserved; pip resolves the package when absent.
#
# Invocation contracts:
#   - DevInstaller flow:  & Model_EdgeTts.ps1 <Region>
#   - pyservice flow:     & Model_EdgeTts.ps1 -Python <py> [-Force]
[CmdletBinding()]
param(
    [string]$Region = 'Global',
    [string]$Python = '',
    [switch]$Force
)

# Variable Declarations (all globals at top, per rule 5)
$ErrorActionPreference = 'Stop'
$SCRIPT_INDEX          = '[Model_EdgeTts]'
$resolvedPython        = $null
$pipExePath            = $null
$pipArgs               = $null

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Installing edge-tts (text-to-speech)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$resolvedPython = $Global:PYTHON_EXE_PATH
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [X] Python 3 was NOT found. Run Python_Default first, or pass -Python <path>." -ForegroundColor Red
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('edge_tts')
    return
}
Write-Host ("$SCRIPT_INDEX python : {0}" -f $resolvedPython) -ForegroundColor DarkGray

$pipExePath = $Global:PIP_EXE_PATH
if (-not $pipExePath) {
    Write-Host "$SCRIPT_INDEX [X] pip.exe not found. Run Python_Default first." -ForegroundColor Red
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('edge_tts')
    return
}

if (Test-PipPackageInstalled -PipExe $pipExePath -PackageName 'edge-tts') {
    Write-Host "$SCRIPT_INDEX [SKIP] edge-tts is installed." -ForegroundColor Green
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('edge_tts')
    return
}

Write-Host "$SCRIPT_INDEX [..] pip install edge-tts ..." -ForegroundColor Yellow
$pipArgs = @('install', 'edge-tts')
& $pipExePath @pipArgs

if (Test-PipPackageInstalled -PipExe $pipExePath -PackageName 'edge-tts') {
    Write-Host "$SCRIPT_INDEX [OK] edge-tts installed." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [!] edge-tts install did not complete cleanly; pycore will install it at import time." -ForegroundColor DarkYellow
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('edge_tts')
