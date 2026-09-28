<#
.SYNOPSIS
    Parler-TTS prerequisite (Hugging Face parler-tts).

.DESCRIPTION
    Category 1 — Python 3.13 native. Official:
      pip install git+https://github.com/huggingface/parler-tts.git

    GPU: parler-tts/parler-tts-large-v1; CPU: parler-tts/parler-tts-mini-v1.
    Opt-in: -Full or PARLER_INSTALL=1 or NEURAL_TTS_INSTALL=1. Skip with PARLER_SKIP=1.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX   = '[Step60-Parler]'
$stagingDefault = $null
$targetDir      = $null
$depsSentinel   = $null
$weightsDir     = $null
$modelSentinel  = $null
$weightAllow    = @('*.bin', '*.safetensors', '*.pt', '*.json', '*.txt', '*.model', '*.vocab')
$resolvedPython = $null
$hasCuda        = $false
$doFull         = ($Full -or $env:PARLER_INSTALL -eq '1' -or $env:NEURAL_TTS_INSTALL -eq '1')
$parlerModel    = $null
$modelReady     = $false
$dlOk           = $false
$sentinelModel  = $null
$depsReady      = $false

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')

$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'parler'
$targetDir = if ($env:PARLER_DIR) { $env:PARLER_DIR } else { $stagingDefault }
$depsSentinel = Join-Path $targetDir '.deps_done'
$weightsDir = Join-Path $targetDir 'weights'
$modelSentinel = Join-Path $targetDir '.model_installed'

. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$resolvedPython = $Global:PYTHON_EXE_PATH

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Parler-TTS (Hugging Face)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:PARLER_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] PARLER_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('parler_tts') -AbsentOk -AbsentNote 'PARLER_SKIP=1'
    return
    return
}

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found." -ForegroundColor DarkYellow
    Complete-PrereqStep -Prefix $SCRIPT_INDEX -ImportModules @('parler_tts')
    return
}
if (-not (Test-TtsEngineCompatible -PythonExe $resolvedPython -Engine 'parler' -Prefix "$SCRIPT_INDEX ")) {
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('parler_tts') -AbsentOk -AbsentNote 'incompatible Python'
    return
}

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'parler' -Path $depsSentinel) -and -not $Force -and -not $doFull) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'Parler-TTS already installed' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('parler_tts')
    return
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only. Pass -Full, PARLER_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('parler_tts') -AbsentOk -AbsentNote 'opt-in'
    return
}

$hasCuda = (Get-CudaRuntimePolicy).Enabled
$parlerModel = Resolve-TtsModelTier -PythonExe $resolvedPython -Key parler_model -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine parler -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  weights : {0}" -f $weightsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model   : {0}" -f $parlerModel) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  sentinel: {0} ({1})" -f $modelSentinel, $(if (Test-Path $modelSentinel) { 'present' } else { 'absent' })) -ForegroundColor DarkGray

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'parler' -Path $depsSentinel) -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'dependencies already installed (.deps_done)' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    $depsReady = $true
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    Write-Host "$SCRIPT_INDEX [..] pip install parler-tts (git) + soundfile ..." -ForegroundColor Yellow
    try { & $Global:PIP_EXE_PATH install "git+https://github.com/huggingface/parler-tts.git" soundfile } catch { }
    & $Global:PIP_EXE_PATH install $Global:LLM_TRANSFORMERS_SPEC
    if (Test-TtsEngineHealth -PythonExe $resolvedPython -Engine 'parler') {
        Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'parler' -Path $depsSentinel | Out-Null
        $depsReady = $true
        Write-Host "$SCRIPT_INDEX [OK] Parler-TTS dependencies installed." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] Parler-TTS dependencies are incomplete; retrying next run." -ForegroundColor DarkYellow
    }
}

# --- HF weights (IDEMPOTENT: sentinel + curl resume + HF size verification) --- #
# allow-list excludes redundant flax/tf/onnx format variants.
$modelReady = $false
if ((Test-Path $modelSentinel) -and -not $Force) {
    $sentinelModel = (Get-Content -LiteralPath $modelSentinel -Raw -ErrorAction SilentlyContinue)
    if ($sentinelModel) { $sentinelModel = $sentinelModel.Trim().Trim([char]0xFEFF) }
    if ($sentinelModel -and ($sentinelModel -eq $parlerModel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $parlerModel -AllowPatterns $weightAllow)) {
        Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason "model weights verified ($parlerModel)" -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
        $modelReady = $true
    } elseif ($sentinelModel -and ($sentinelModel -ne $parlerModel)) {
        Write-Host ("$SCRIPT_INDEX [..] model tier changed ({0} -> {1}); refreshing weights." -f $sentinelModel, $parlerModel) -ForegroundColor Yellow
    } elseif (-not (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $parlerModel -AllowPatterns $weightAllow)) {
        Write-Host "$SCRIPT_INDEX [..] local weights incomplete or corrupt; repairing download." -ForegroundColor Yellow
    }
}
if (-not $modelReady) {
    Write-Host ("$SCRIPT_INDEX [..] downloading/repairing model '{0}' (curl, resumable) ..." -f $parlerModel) -ForegroundColor Yellow
    $dlOk = Install-HfRepoFlat -RepoId $parlerModel -DestDir $weightsDir -SentinelPath $modelSentinel -AllowPatterns $weightAllow -Prefix "$SCRIPT_INDEX " -SentinelValue $parlerModel
    if ($dlOk -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $parlerModel -AllowPatterns $weightAllow)) {
        $modelReady = $true
        Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready at {1}." -f $parlerModel, $weightsDir) -ForegroundColor Green
    } else {
        Write-Host ("$SCRIPT_INDEX [!] model download not finished; partial files kept at {0}; will RESUME next run." -f $weightsDir) -ForegroundColor DarkYellow
    }
}

if (-not $depsReady -or -not $modelReady) {
    Write-Host "$SCRIPT_INDEX [!] Parler is not ready; incomplete components will retry next run." -ForegroundColor DarkYellow
    return
}

Write-Host "$SCRIPT_INDEX [OK] Parler ready. Weights pre-downloaded (idempotent); engine auto-detects local." -ForegroundColor Green
if ((Test-Path $modelSentinel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $parlerModel -AllowPatterns $weightAllow)) {
    Write-Host ("$SCRIPT_INDEX  local weights auto-detected: {0}" -f $weightsDir) -ForegroundColor Cyan
}
Write-Host "$SCRIPT_INDEX  Set PARLER_MODEL / PARLER_DESCRIPTION to override." -ForegroundColor DarkGray
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('parler_tts')
