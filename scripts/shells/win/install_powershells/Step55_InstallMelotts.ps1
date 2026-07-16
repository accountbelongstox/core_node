<#
.SYNOPSIS
    MeloTTS offline TTS prerequisite — status-only by default; heavy install via -Full / MELOTTS_INSTALL=1.

.DESCRIPTION
    Self-contained MeloTTS installer. MeloTTS pins transformers==4.27.4, which can
    downgrade the shared env, so it is NOT installed during normal pyservice boot unless
    -Full or MELOTTS_INSTALL=1. Invoked sequentially by PreparePycorePrerequisites.ps1.

    Official: https://github.com/myshell-ai/MeloTTS  import: from melo.api import TTS
    Windows: pip melotts + unidic-lite; Linux uses unidic download + MeCab.

.PARAMETER Python
    python.exe to target.
.PARAMETER Full
    Perform the heavy install.
.PARAMETER Force
    Reinstall / re-warm models when melo is already present.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX   = '[Step55-MeloTts]'
$resolvedPython = $null
$pipExePath     = $null
$doFull         = ($Full -or $env:MELOTTS_INSTALL -eq '1')
$meloPresent    = $false
$needWarm       = $false
$hasCuda        = $false
$device         = 'cpu'
$langs          = 'EN,ZH'
$optInNote      = 'opt-in; use -Full or MELOTTS_INSTALL=1'
$winCommonDir   = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'

. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

function Install-MeloTtsPackage {
    param([string]$Py, [string]$PipExe)
    Write-Host "$SCRIPT_INDEX [..] pip install melotts (PyPI) ..." -ForegroundColor Yellow
    try { & $PipExe install melotts } catch { }
    if (Test-PyModule -Py $Py -ModuleName 'melo') { return $true }
    Write-Host "$SCRIPT_INDEX [..] PyPI melotts unavailable; pip install git+https://github.com/myshell-ai/MeloTTS.git ..." -ForegroundColor Yellow
    try { & $PipExe install 'git+https://github.com/myshell-ai/MeloTTS.git' } catch { }
    return (Test-PyModule -Py $Py -ModuleName 'melo')
}

function Install-MeloNltkData {
    param([string]$Py)
    Write-Host "$SCRIPT_INDEX [..] ensuring NLTK averaged_perceptron_tagger_eng ..." -ForegroundColor Yellow
    try {
        & $Py -c "import nltk; nltk.download('averaged_perceptron_tagger_eng', quiet=True)" 2>$null
    } catch { }
}

function Invoke-MeloModelWarmup {
    param([string]$Py, [string]$LangList, [string]$DeviceName)
    Write-Host ("$SCRIPT_INDEX [..] pre-downloading models [{0}] on {1} ..." -f $LangList, $DeviceName) -ForegroundColor Yellow
    $warmPy = @"
import sys
from melo.api import TTS
langs = sys.argv[1].split(',')
device = sys.argv[2]
for lang in langs:
    lang = lang.strip()
    if not lang:
        continue
    try:
        TTS(language=lang, device=device)
        print('  [warmed]', lang)
    except Exception as e:
        print('  [skip]', lang, '-', e)
"@
    try { & $Py -c $warmPy $LangList $DeviceName } catch {
        Write-Host "$SCRIPT_INDEX [!] model pre-download incomplete (models still download lazily on first synth)." -ForegroundColor DarkYellow
    }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX MeloTTS (free offline zh/en TTS)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$resolvedPython = $Global:PYTHON_EXE_PATH
if (-not ($resolvedPython -and (Test-Path -LiteralPath $resolvedPython))) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found at $Global:PYTHON_EXE_PATH. Run Step8_InstallPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -Prefix $SCRIPT_INDEX -ImportModules @('melo') -AbsentOk -AbsentNote $optInNote
}
$pipExePath = $Global:PIP_EXE_PATH
if (-not ($pipExePath -and (Test-Path -LiteralPath $pipExePath))) {
    Write-Host "$SCRIPT_INDEX [!] pip not found at $Global:PIP_EXE_PATH" -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('melo') -AbsentOk -AbsentNote $optInNote
}

if ($env:MELOTTS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] MELOTTS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('melo') -AbsentOk -AbsentNote 'MELOTTS_SKIP=1'
}

$meloPresent = Test-PyModule -Py $resolvedPython -ModuleName 'melo'
$needWarm = (-not $meloPresent) -or $Force
$hasCuda = Test-CudaPresent
if ($hasCuda) {
    $device = 'cuda:0'
    $langs = 'EN,ZH,JP,KR,ES,FR'
}

Write-Host ("$SCRIPT_INDEX  python : {0}" -f $resolvedPython) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  melo    : {0}" -f $(if ($meloPresent) { 'installed' } else { 'absent' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU -> full model set' } else { 'CPU only -> EN,ZH' })) -ForegroundColor DarkGray
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine melotts -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX

if (-not $meloPresent -and -not $doFull) {
    Write-Host "$SCRIPT_INDEX [i] opt-in only -> NOT installing. Pass -Full or MELOTTS_INSTALL=1 (pins transformers==4.27.4; may downgrade shared env)." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('melo') -AbsentOk -AbsentNote $optInNote
}

if (-not $meloPresent) {
    Write-Host "$SCRIPT_INDEX [!] NOTE: installing MeloTTS pins transformers==4.27.4 which may downgrade the shared env." -ForegroundColor DarkYellow
}

if ($meloPresent -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'melo already installed' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
} elseif ($meloPresent -and $Force) {
    Write-Host "$SCRIPT_INDEX [..] --Force -> refreshing MeloTTS stack ..." -ForegroundColor Yellow
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    Write-Host "$SCRIPT_INDEX [..] pip install unidic-lite (Windows Japanese support) ..." -ForegroundColor Yellow
    try { & $pipExePath install unidic-lite } catch { }
    if (Install-MeloTtsPackage -Py $resolvedPython -PipExe $pipExePath) {
        Write-Host "$SCRIPT_INDEX [OK] melo importable." -ForegroundColor Green
        $meloPresent = $true
    } else {
        Write-Host "$SCRIPT_INDEX [!] melo not importable after install." -ForegroundColor DarkYellow
    }
    Install-MeloNltkData -Py $resolvedPython
}

if ($meloPresent -and $needWarm) {
    Invoke-MeloModelWarmup -Py $resolvedPython -LangList $langs -DeviceName $device
} elseif ($meloPresent) {
    Write-Host "$SCRIPT_INDEX [OK] melo already present -> skipping model warmup (use -Force to re-warm)." -ForegroundColor Green
}

if ($meloPresent) {
    Write-Host "$SCRIPT_INDEX [OK] MeloTTS ready (free, offline)." -ForegroundColor Green
} else {
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('melo')
}

Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('melo') -PipPackages @('melotts')
