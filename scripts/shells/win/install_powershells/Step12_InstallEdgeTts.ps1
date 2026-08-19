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
# Existing edge-tts installations are preserved; pip resolves the package when absent.
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
$SCRIPT_INDEX          = '[Step12-EdgeTts]'
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
    Write-Host "$SCRIPT_INDEX [X] Python 3 was NOT found. Run Step8_InstallPython first, or pass -Python <path>." -ForegroundColor Red
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('edge_tts')
    return
}
Write-Host ("$SCRIPT_INDEX python : {0}" -f $resolvedPython) -ForegroundColor DarkGray

$pipExePath = $Global:PIP_EXE_PATH
if (-not $pipExePath) {
    Write-Host "$SCRIPT_INDEX [X] pip.exe not found. Run Step8_InstallPython first." -ForegroundColor Red
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
