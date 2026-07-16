<#
.SYNOPSIS
    Bark TTS prerequisite (Suno via Hugging Face transformers).

.DESCRIPTION
    Category 1 — Python 3.13 native. Official:
      https://huggingface.co/docs/transformers/model_doc/bark
      pip install transformers scipy
      Do NOT pip install bark (unrelated package).

    GPU: suno/bark; CPU: suno/bark-small (via tts_model_tiers.py).
    Opt-in: -Full or BARK_INSTALL=1 or NEURAL_TTS_INSTALL=1. Skip with BARK_SKIP=1.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX   = '[Step59-Bark]'
$stagingDefault = $null
$targetDir      = $null
$depsSentinel   = $null
$weightsDir     = $null
$modelSentinel  = $null
$weightAllow    = @('*.bin', '*.safetensors', '*.pt', '*.json', '*.txt', '*.model', '*.vocab')
$resolvedPython = $null
$hasCuda        = $false
$doFull         = ($Full -or $env:BARK_INSTALL -eq '1' -or $env:NEURAL_TTS_INSTALL -eq '1')
$barkModel      = $null
$modelReady     = $false
$dlOk           = $false
$sentinelModel  = $null

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')

$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'bark'
$targetDir = if ($env:BARK_DIR) { $env:BARK_DIR } else { $stagingDefault }
$depsSentinel = Join-Path $targetDir '.deps_done'
$weightsDir = Join-Path $targetDir 'weights'
$modelSentinel = Join-Path $targetDir '.model_installed'

. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Bark (Suno / transformers)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:BARK_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] BARK_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers')
    return
}

$resolvedPython = $Global:PYTHON_EXE_PATH
if ((Test-PyModule -Py $resolvedPython -ModuleName 'transformers') -and (Test-Path $depsSentinel) -and -not $Force -and -not $doFull) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'Bark (transformers) already installed' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers')
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only. Pass -Full, BARK_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers')
}

$hasCuda = Test-CudaPresent
$barkModel = Resolve-TtsModelTier -PythonExe $resolvedPython -Key bark_model -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine bark -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  weights : {0}" -f $weightsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU' } else { 'CPU only' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model   : {0}" -f $barkModel) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  sentinel: {0} ({1})" -f $modelSentinel, $(if (Test-Path $modelSentinel) { 'present' } else { 'absent' })) -ForegroundColor DarkGray

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers')
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if ((Test-Path $depsSentinel) -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'dependencies already installed (.deps_done)' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    Write-Host "$SCRIPT_INDEX [..] pip install transformers scipy accelerate ..." -ForegroundColor Yellow
    try { & $Global:PIP_EXE_PATH install --upgrade transformers scipy accelerate } catch { }
    Set-Content -Path $depsSentinel -Value (Get-Date -Format o) -Encoding utf8
    Write-Host "$SCRIPT_INDEX [OK] Bark dependencies installed." -ForegroundColor Green
}

# --- HF weights (IDEMPOTENT: sentinel + curl resume + HF size verification) --- #
# allow-list excludes redundant flax/tf/onnx format variants so suno/bark does
# not pull 3x the bytes; .bin/.safetensors/.pt + config/tokenizer files cover
# everything transformers BarkModel.from_pretrained needs.
$modelReady = $false
if ((Test-Path $modelSentinel) -and -not $Force) {
    $sentinelModel = (Get-Content -LiteralPath $modelSentinel -Raw -ErrorAction SilentlyContinue)
    if ($sentinelModel) { $sentinelModel = $sentinelModel.Trim().Trim([char]0xFEFF) }
    if ($sentinelModel -and ($sentinelModel -eq $barkModel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $barkModel)) {
        Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason "model weights verified ($barkModel)" -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
        $modelReady = $true
    } elseif ($sentinelModel -and ($sentinelModel -ne $barkModel)) {
        Write-Host ("$SCRIPT_INDEX [..] model tier changed ({0} -> {1}); refreshing weights." -f $sentinelModel, $barkModel) -ForegroundColor Yellow
    } elseif (-not (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $barkModel)) {
        Write-Host "$SCRIPT_INDEX [..] local weights incomplete or corrupt; repairing download." -ForegroundColor Yellow
    }
}
if (-not $modelReady) {
    Write-Host ("$SCRIPT_INDEX [..] downloading/repairing model '{0}' (curl, resumable) ..." -f $barkModel) -ForegroundColor Yellow
    $dlOk = Install-HfRepoFlat -RepoId $barkModel -DestDir $weightsDir -SentinelPath $modelSentinel -AllowPatterns $weightAllow -Prefix "$SCRIPT_INDEX " -SentinelValue $barkModel
    if ($dlOk -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $barkModel)) {
        Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready at {1}." -f $barkModel, $weightsDir) -ForegroundColor Green
    } else {
        Write-Host ("$SCRIPT_INDEX [!] model download not finished; partial files kept at {0}; will RESUME next run." -f $weightsDir) -ForegroundColor DarkYellow
    }
}

Write-Host "$SCRIPT_INDEX [OK] Bark ready. Weights pre-downloaded (idempotent); engine auto-detects local." -ForegroundColor Green
if ((Test-Path $modelSentinel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $barkModel)) {
    Write-Host ("$SCRIPT_INDEX  local weights auto-detected: {0}" -f $weightsDir) -ForegroundColor Cyan
}
Write-Host "$SCRIPT_INDEX  Set BARK_MODEL / BARK_VOICE_PRESET to override." -ForegroundColor DarkGray
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers')
