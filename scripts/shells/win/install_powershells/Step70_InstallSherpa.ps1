# Sherpa-ONNX offline TTS prerequisite (engine "sherpa"): the sherpa-onnx package plus the
# Kokoro multi-lang model in the sherpa model dir, the Windows twin of
# 31_install_tts_offline.sh. Model dir: SHERPA_TTS_MODEL_DIR, else
# <shared cache>\tts\sherpa (what sherpa_engine.model_dir() resolves).
#
# Official: https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/kokoro-multi-lang-v1_1.html
# (release archive URL from tts_model_tiers.kokoro_url: GPU full model, CPU int8 model).
# Idempotent: the sentinel plus onnx + tokens.txt present -> nothing to download; a partial
# archive is resumed. Skip with SHERPA_SKIP=1.
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX   = '[Step70-Sherpa]'
$winCommonDir   = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$resolvedPython = $null
$modelDir       = $null
$modelSentinel  = $null
$modelArchive   = $null
$tmpExtract     = $null
$modelUrl       = $null
$hasGpu         = $false
$expectedBytes  = 0L
$curl           = $null
$complete       = $false
$attempt        = 0
$inner          = $null
$source         = $null
$packagesReady  = $false

. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

$resolvedPython = $Global:PYTHON_EXE_PATH
$modelDir = if ($env:SHERPA_TTS_MODEL_DIR) { $env:SHERPA_TTS_MODEL_DIR } else { Join-Path (Join-Path $Global:CORE_NODE_CACHE_DIR 'tts') 'sherpa' }
$modelSentinel = Join-Path $modelDir '.model_installed'
$modelArchive = Join-Path $modelDir '.download.tar.bz2'
$tmpExtract = Join-Path $env:TEMP 'sherpa-tts-extract'

function Test-SherpaModelPresent {
    param([string]$Dir)
    if (-not (Test-Path -LiteralPath $Dir)) { return $false }
    $onnx = Get-ChildItem -LiteralPath $Dir -Recurse -Filter '*.onnx' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    $tokens = Get-ChildItem -LiteralPath $Dir -Recurse -Filter 'tokens.txt' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    return [bool]($onnx -and $onnx.Length -gt 0 -and $tokens -and $tokens.Length -gt 0)
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Sherpa-ONNX offline TTS (Kokoro model)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:SHERPA_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] SHERPA_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('sherpa_onnx') -AbsentOk -AbsentNote 'SHERPA_SKIP=1'
    return
}
if (-not ($resolvedPython -and (Test-Path -LiteralPath $resolvedPython))) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found at $Global:PYTHON_EXE_PATH." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('sherpa_onnx')
    return
}

$packagesReady = Test-PipPackageInstalled -PipExe $Global:PIP_EXE_PATH -PackageName 'sherpa-onnx'
if (-not $packagesReady) {
    Write-Host "$SCRIPT_INDEX [..] pip install sherpa-onnx ..." -ForegroundColor Yellow
    & $Global:PIP_EXE_PATH install sherpa-onnx
    if ($LASTEXITCODE -ne 0) { Write-Host "$SCRIPT_INDEX [!] pip install sherpa-onnx failed (exit $LASTEXITCODE)." -ForegroundColor DarkYellow }
    $packagesReady = Test-PipPackageInstalled -PipExe $Global:PIP_EXE_PATH -PackageName 'sherpa-onnx'
}

if ((Test-Path -LiteralPath $modelSentinel) -and (Test-SherpaModelPresent -Dir $modelDir) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [idempotent] sherpa model present at $modelDir" -ForegroundColor Green
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('sherpa_onnx')
    return
}

$hasGpu = (Get-CudaRuntimePolicy).Enabled
$modelUrl = Resolve-TtsModelTier -PythonExe $resolvedPython -Key kokoro_url -InstallScriptRoot $PSScriptRoot -Gpu:($hasGpu)
if (-not $modelUrl) {
    Write-Host "$SCRIPT_INDEX [!] could not resolve kokoro_url from tts_model_tiers.py; model download skipped." -ForegroundColor DarkYellow
    Set-GlobalVar -Key 'PYCORE_PREREQUISITE_STEP_STATE' -Value 'pending' | Out-Null
    return
}
Write-Host ("$SCRIPT_INDEX  model dir : {0}" -f $modelDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model url : {0}" -f $modelUrl) -ForegroundColor DarkGray

New-Item -ItemType Directory -Force -Path $modelDir | Out-Null
$head = Invoke-WebRequest -Uri $modelUrl -Method Head -UseBasicParsing -TimeoutSec 30
if ($head.Headers['Content-Length']) { $expectedBytes = [int64]($head.Headers['Content-Length']) }
$curl = Get-Command curl.exe -ErrorAction SilentlyContinue
if (-not $curl) { throw "$SCRIPT_INDEX curl.exe is required to download the sherpa model." }

$complete = Test-HfFileDownloadComplete -Path $modelArchive -ExpectedBytes $expectedBytes
while (-not $complete -and $attempt -lt 6) {
    $attempt += 1
    Write-Host ("$SCRIPT_INDEX [..] downloading sherpa model (attempt {0}, resumable) ..." -f $attempt) -ForegroundColor Yellow
    & $curl.Source -f -L -C - --retry 3 --connect-timeout 30 --progress-bar -o $modelArchive $modelUrl
    $complete = Test-HfFileDownloadComplete -Path $modelArchive -ExpectedBytes $expectedBytes
}
if (-not $complete) {
    Write-Host "$SCRIPT_INDEX [!] download incomplete; archive kept to resume next run." -ForegroundColor DarkYellow
    Set-GlobalVar -Key 'PYCORE_PREREQUISITE_STEP_STATE' -Value 'pending' | Out-Null
    return
}

if (Test-Path -LiteralPath $tmpExtract) { Remove-Item -LiteralPath $tmpExtract -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmpExtract | Out-Null
if (-not (Invoke-InstallerPython -PythonExe $resolvedPython -Arguments @('-c', "import tarfile,sys; t=tarfile.open(sys.argv[1],'r:bz2'); t.extractall(sys.argv[2]); t.close()", $modelArchive, $tmpExtract))) {
    Write-Host "$SCRIPT_INDEX [!] archive extraction failed; the archive was kept for retry." -ForegroundColor DarkYellow
    Set-GlobalVar -Key 'PYCORE_PREREQUISITE_STEP_STATE' -Value 'pending' | Out-Null
    return
}
$inner = Get-ChildItem -LiteralPath $tmpExtract -Directory | Select-Object -First 1
$source = if ($inner) { $inner.FullName } else { $tmpExtract }
Copy-Item -Path (Join-Path $source '*') -Destination $modelDir -Recurse -Force
Remove-Item -LiteralPath $tmpExtract -Recurse -Force

if (-not (Test-SherpaModelPresent -Dir $modelDir)) {
    Write-Host "$SCRIPT_INDEX [!] sherpa model incomplete after extraction (onnx/tokens.txt missing); retrying next run." -ForegroundColor DarkYellow
    Set-GlobalVar -Key 'PYCORE_PREREQUISITE_STEP_STATE' -Value 'pending' | Out-Null
    return
}
Set-Content -LiteralPath $modelSentinel -Value $modelUrl -Encoding utf8
Remove-Item -LiteralPath $modelArchive -Force
Write-Host "$SCRIPT_INDEX [OK] sherpa model installed: $modelDir" -ForegroundColor Green
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('sherpa_onnx')
