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

    Lifecycle: Bucket-A LLM. Bark is transformers-based and shares the pinned
    transformers version via Install-PinnedTransformers (version-idempotent, never
    --upgrade, self-heals a clobbered pin) so it is compatible with the DeepSeek/
    Qwen2.5/NLLB stack in the one system Python 3.13. Contract:
    development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §7.
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
$weightAllow    = @()
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

. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$resolvedPython = $Global:PYTHON_EXE_PATH

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Bark (Suno / transformers)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:BARK_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] BARK_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers') -AbsentOk -AbsentNote 'BARK_SKIP=1'
    return
    return
}

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'bark' -Path $depsSentinel) -and -not $Force -and -not $doFull) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'Bark (transformers) already installed' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers')
    return
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only. Pass -Full, BARK_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers') -AbsentOk -AbsentNote 'opt-in'
    return
}

$hasCuda = (Get-CudaRuntimePolicy).Enabled
$barkModel = Resolve-TtsModelTier -PythonExe $resolvedPython -Key bark_model -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
# Download/readiness contract (single source: tts_model_tiers.HF_ALLOW['bark']).
$weightAllow = @(
    (Resolve-TtsModelTier -PythonExe $resolvedPython -Key bark_hf_allow -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)) -split ',' |
        ForEach-Object { $_.Trim() } | Where-Object { $_ }
)
if ($weightAllow.Count -eq 0) {
    Write-Host "$SCRIPT_INDEX [!] could not resolve bark_hf_allow from tts_model_tiers.py; aborting." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers')
    return
}
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine bark -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  weights : {0}" -f $weightsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU' } else { 'CPU only' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model   : {0}" -f $barkModel) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  sentinel: {0} ({1})" -f $modelSentinel, $(if (Test-Path $modelSentinel) { 'present' } else { 'absent' })) -ForegroundColor DarkGray

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers')
    return
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'bark' -Path $depsSentinel) -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'dependencies already installed (.deps_done)' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    Write-Host "$SCRIPT_INDEX [..] pip install transformers (shared pin) scipy accelerate ..." -ForegroundColor Yellow
    # transformers goes in at the shared Bucket-A pin (version-idempotent, never
    # --upgrade); scipy/accelerate install as before. See lifecycle doc §7.
    try { Install-PinnedTransformers -PythonExe $resolvedPython -PipExe $Global:PIP_EXE_PATH -Prefix "$SCRIPT_INDEX " | Out-Null } catch { }
    try { & $Global:PIP_EXE_PATH install scipy accelerate } catch { }
    if (Test-TtsEngineHealth -PythonExe $resolvedPython -Engine 'bark') {
        Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'bark' -Path $depsSentinel | Out-Null
        Write-Host "$SCRIPT_INDEX [OK] Bark dependencies installed (policy stamp written)." -ForegroundColor Green
    }
}

# --- HF weights (IDEMPOTENT: sentinel + curl resume + HF size verification) --- #
# Transformers Bark uses the main PyTorch checkpoint plus config/tokenizer and
# speaker preset files; original Bark component .pt files are not pre-downloaded.
$modelReady = $false
if ((Test-Path $modelSentinel) -and -not $Force) {
    $sentinelModel = (Get-Content -LiteralPath $modelSentinel -Raw -ErrorAction SilentlyContinue)
    if ($sentinelModel) { $sentinelModel = $sentinelModel.Trim().Trim([char]0xFEFF) }
    if ($sentinelModel -and ($sentinelModel -eq $barkModel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $barkModel -AllowPatterns $weightAllow)) {
        Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason "model weights verified ($barkModel)" -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
        $modelReady = $true
    } elseif ($sentinelModel -and ($sentinelModel -ne $barkModel)) {
        Write-Host ("$SCRIPT_INDEX [..] model tier changed ({0} -> {1}); refreshing weights." -f $sentinelModel, $barkModel) -ForegroundColor Yellow
    } elseif (-not (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $barkModel -AllowPatterns $weightAllow)) {
        Write-Host "$SCRIPT_INDEX [..] local weights incomplete or corrupt; repairing download." -ForegroundColor Yellow
    }
}
if (-not $modelReady) {
    Write-Host ("$SCRIPT_INDEX [..] downloading/repairing model '{0}' (curl, resumable) ..." -f $barkModel) -ForegroundColor Yellow
    $dlOk = Install-HfRepoFlat -RepoId $barkModel -DestDir $weightsDir -SentinelPath $modelSentinel -AllowPatterns $weightAllow -Prefix "$SCRIPT_INDEX " -SentinelValue $barkModel
    if ($dlOk -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $barkModel -AllowPatterns $weightAllow)) {
        $modelReady = $true
        Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready at {1}." -f $barkModel, $weightsDir) -ForegroundColor Green
    } else {
        Write-Host ("$SCRIPT_INDEX [!] model download not finished; partial files kept at {0}; will RESUME next run." -f $weightsDir) -ForegroundColor DarkYellow
    }
}

if (-not (Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'bark' -Path $depsSentinel) -or -not $modelReady) {
    Write-Host "$SCRIPT_INDEX [!] Bark is not ready; incomplete components will retry next run." -ForegroundColor DarkYellow
    return
}

Write-Host "$SCRIPT_INDEX [OK] Bark ready. Weights pre-downloaded (idempotent); engine auto-detects local." -ForegroundColor Green
if ((Test-Path $modelSentinel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $barkModel -AllowPatterns $weightAllow)) {
    Write-Host ("$SCRIPT_INDEX  local weights auto-detected: {0}" -f $weightsDir) -ForegroundColor Cyan
}
Write-Host "$SCRIPT_INDEX  Set BARK_MODEL / BARK_VOICE_PRESET to override." -ForegroundColor DarkGray
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('transformers')
