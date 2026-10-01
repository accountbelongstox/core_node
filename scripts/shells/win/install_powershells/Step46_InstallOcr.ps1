<#
.SYNOPSIS
    Prerequisite installer for the local OCR engines (Windows).

.DESCRIPTION
    Run by PreparePycorePrerequisites.ps1 before the Pycore service launches. Sets up the LOCAL OCR
    engines used by the voice-subtitle screenshot pipeline, in the project's
    priority order:

        1. windows  - Windows.Media.Ocr (WinRT). Installs the winrt-* packages
                      listed in pycore\pyfoundations\third_party.py
                      (WINDOWS_OCR_WINRT_PACKAGES). Native, offline, no GPU.
        2. easyocr  - torch/GPU OCR (high accuracy; torch is already present).

    CnOCR is managed by the shared prerequisite package policy.

    Why a shell script and not third_party.py? These are heavier / Windows-only
    packages that are better installed explicitly and idempotently up front, so
    the first screenshot does not stall on a pip install. The orchestrator
    (pycore.pyutils.ocr.ocr_orchestrator) degrades gracefully when an engine is
    absent — this script just makes the higher-priority engines available.

    IDEMPOTENT: one pip metadata snapshot installs only the missing set.

.PARAMETER Python
    Path to the python.exe to install into. Default: 'python' on PATH.

.PARAMETER Force
    Accepted for compatibility; installed packages are preserved.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonDependencyMapInstallCommon.ps1')
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$Python = $Global:PYTHON_EXE_PATH
$ocrPrefetch = Join-Path (Get-PycoreTtsInstallAssetsDir -InstallScriptRoot $PSScriptRoot) 'ocr_models_prefetch.py'
$cnArguments = @($ocrPrefetch, 'cn')
$cnOk = $false
$easyOk = $false

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' Installing local OCR engines (windows-native, easyocr)' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ("  python : {0}" -f $Python) -ForegroundColor DarkGray

Install-PycorePolicySet -Set 'ocr' -PythonExe $Python -PipExe $Global:PIP_EXE_PATH -LogPrefix '[ocr]'

# Model weights are installed here only (runtime never downloads):
#  - CnSTD/CnOCR onnx models under CNSTD_HOME / CNOCR_HOME (pyfoundations third_party _ocr_models layout)
#  - EasyOCR craft_mlt_25k.pth + recognizers under EASYOCR_MODULE_PATH\model (or ~\.EasyOCR\model)
# Present files are skipped, so a rerun downloads nothing.
if ((Get-CudaRuntimePolicy).Enabled) { $cnArguments += '--gpu' }
$cnOk = Invoke-InstallerPythonHfEndpoints -PythonExe $Python -Arguments $cnArguments
if (-not $cnOk) { Write-Host '[ocr] [!] CnSTD/CnOCR model download incomplete; retrying next run.' -ForegroundColor DarkYellow }
$easyOk = Invoke-InstallerPython -PythonExe $Python -Arguments @($ocrPrefetch, 'easyocr')
if (-not $easyOk) { Write-Host '[ocr] [!] EasyOCR model download incomplete; retrying next run.' -ForegroundColor DarkYellow }

# Non-fatal by design: a degraded OCR set still lets the service run (cnocr +
# ai-vision remain).
