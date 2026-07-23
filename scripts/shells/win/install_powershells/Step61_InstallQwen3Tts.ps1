<#
.SYNOPSIS
    Qwen3-TTS prerequisite (Alibaba qwen-tts) — ISOLATED venv, never the main interpreter.

.DESCRIPTION
    Bucket B (isolated). qwen-tts pins transformers==4.57.3, which CANNOT coexist with the
    main system Python 3.13's shared Bucket-A pin (transformers==4.46.x). Therefore qwen-tts
    is NEVER installed into the main interpreter. Instead this step builds the DEDICATED venv
    via pycore/pyfoundations/isolated_venv.ensure_venv() (created --system-site-packages so it
    reuses the system CUDA torch; only the pinned transformers/accelerate are layered inside).
    Production runs qwen3tts as a class-C HTTP server under that venv; the main interpreter only
    talks to it over HTTP. Contract:
    development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5.
    Official: https://github.com/QwenLM/Qwen3-TTS

    GPU: Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice; CPU: 0.6B-CustomVoice.
    Runtime: SoX binary on PATH (pysox; winget ChrisBagwell.SoX).
    Idempotent + self-repairing by default (no switches required): builds/verifies the venv
    (ensure_venv re-imports qwen_tts and rebuilds it if broken), downloads or repairs HF
    weights (curl resume + size verification). Skip with QWEN3TTS_SKIP=1.
    -Force rebuilds the venv from scratch and re-validates every weight file.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX   = '[Step61-Qwen3Tts]'
$coreNodeRoot   = $null
$stagingDefault = $null
$targetDir      = $null
$weightsDir     = $null
$depsSentinel   = $null
$modelSentinel  = $null
$resolvedPython = $null
$hasCuda        = $false
$qwenModel      = $null
$modelReady     = $false
$dlOk           = $false
$sentinelModel  = $null
$apiServerSrc   = $null
$apiServerDst   = $null
$venvReady      = $false
$cudaPolicy     = $null

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'WindowsPathFunction.ps1')

$coreNodeRoot = $Global:CORE_NODE_DIR
$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'qwen3tts'
$targetDir = if ($env:QWEN3TTS_DIR) { $env:QWEN3TTS_DIR } else { $stagingDefault }
$weightsDir = Join-Path $targetDir 'weights'
$depsSentinel = Join-Path $targetDir '.deps_done'
$modelSentinel = Join-Path $targetDir '.model_installed'

. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Qwen3-TTS (Alibaba qwen-tts)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:QWEN3TTS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] QWEN3TTS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
}

$resolvedPython = $Global:PYTHON_EXE_PATH
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found." -ForegroundColor DarkYellow
    Complete-PrereqStep -Prefix $SCRIPT_INDEX -ImportModules @()
}

if (-not (Test-TtsEngineCompatible -PythonExe $resolvedPython -Engine 'qwen3tts' -Prefix "$SCRIPT_INDEX ")) {
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
}

$cudaPolicy = Get-CudaRuntimePolicy
Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
if ($cudaPolicy.Enabled -and -not (Test-TorchCudaUsable -PythonCmd $resolvedPython)) {
    throw "$SCRIPT_INDEX NVIDIA GPU is present but canonical $($cudaPolicy.Tag) torch is not usable; refusing a silent CPU fallback."
}

$hasCuda = Test-CudaPresent
$qwenModel = Resolve-TtsModelTier -PythonExe $resolvedPython -Key qwen3tts_model -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine qwen3tts -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  weights : {0}" -f $weightsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model   : {0}" -f $qwenModel) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  sentinel: {0} ({1})" -f $modelSentinel, $(if (Test-Path $modelSentinel) { 'present' } else { 'absent' })) -ForegroundColor DarkGray

Ensure-SoxOnPath -Prefix "$SCRIPT_INDEX " -Force:$Force | Out-Null

if (
    (Test-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'qwen3tts' -Path $depsSentinel) -and
    (Test-Path $modelSentinel) -and
    -not $Force -and
    (Test-IsolatedTtsVenvHealthy -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Engine 'qwen3tts')
) {
    $sentinelModel = (Get-Content -LiteralPath $modelSentinel -Raw -ErrorAction SilentlyContinue)
    if ($sentinelModel) { $sentinelModel = $sentinelModel.Trim().Trim([char]0xFEFF) }
    if ($sentinelModel -and ($sentinelModel -eq $qwenModel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
        Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason "Qwen3-TTS already installed (deps + verified model)" -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
        Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    }
    if ($sentinelModel -and ($sentinelModel -ne $qwenModel)) {
        Write-Host ("$SCRIPT_INDEX [..] model tier changed ({0} -> {1}); refreshing weights." -f $sentinelModel, $qwenModel) -ForegroundColor Yellow
    } elseif (-not (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
        Write-Host "$SCRIPT_INDEX [..] local weights incomplete or corrupt; repairing download." -ForegroundColor Yellow
    }
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$apiServerSrc = Join-Path (Get-PycoreTtsInstallAssetsDir -InstallScriptRoot $PSScriptRoot) 'qwen3tts_api_server.py'
$apiServerDst = Join-Path $targetDir 'qwen3tts_api_server.py'
if (Test-Path $apiServerSrc) {
    Copy-Item -Path $apiServerSrc -Destination $apiServerDst -Force
}

# --- Isolated venv (Bucket B): qwen-tts pins transformers==4.57.3, which is
#     incompatible with the main interpreter's shared 4.46.x pin, so it is NEVER
#     installed here. Build the DEDICATED venv (ensure_venv, --system-site-packages
#     reuses the system CUDA torch) instead. Self-repairing: ensure_venv re-imports
#     qwen_tts and rebuilds a broken venv. See lifecycle doc §5. --- #
Write-Host "$SCRIPT_INDEX [..] building/verifying isolated qwen-tts venv (ensure_venv; first build takes minutes) ..." -ForegroundColor Yellow
$venvReady = Invoke-IsolatedTtsVenvEnsure -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Engine 'qwen3tts' -Force:$Force
if ($venvReady) {
    Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'qwen3tts' -Path $depsSentinel | Out-Null
    Write-Host "$SCRIPT_INDEX [OK] isolated qwen-tts venv ready; main interpreter transformers pin left untouched." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [!] venv build incomplete; will retry next run (main interpreter untouched)." -ForegroundColor DarkYellow
}

# --- HF weights (IDEMPOTENT: sentinel + curl resume + HF size verification) --- #
$modelReady = $false
if ((Test-Path $modelSentinel) -and -not $Force) {
    $sentinelModel = (Get-Content -LiteralPath $modelSentinel -Raw -ErrorAction SilentlyContinue)
    if ($sentinelModel) { $sentinelModel = $sentinelModel.Trim().Trim([char]0xFEFF) }
    if ($sentinelModel -and ($sentinelModel -eq $qwenModel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
        Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason "model weights verified ($qwenModel)" -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
        $modelReady = $true
    }
}
if (-not $modelReady) {
    Write-Host ("$SCRIPT_INDEX [..] downloading/repairing model '{0}' (curl, resumable) ..." -f $qwenModel) -ForegroundColor Yellow
    $dlOk = Install-HfRepoFlat -RepoId $qwenModel -DestDir $weightsDir -SentinelPath $modelSentinel -Prefix "$SCRIPT_INDEX " -SentinelValue $qwenModel
    if ($dlOk -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
        $modelReady = $true
        Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready at {1}." -f $qwenModel, $weightsDir) -ForegroundColor Green
    } else {
        Write-Host ("$SCRIPT_INDEX [!] model download not finished; partial files kept at {0}; will RESUME next run." -f $weightsDir) -ForegroundColor DarkYellow
    }
}

if (-not $venvReady -or -not $modelReady) {
    throw "$SCRIPT_INDEX Qwen3-TTS is not ready; the incomplete component will be retried next run."
}

Write-Host "$SCRIPT_INDEX [OK] Qwen3-TTS ready. Set QWEN3TTS_MODEL / QWEN3TTS_SPEAKER." -ForegroundColor Green
if ((Test-Path $modelSentinel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
    Write-Host ("$SCRIPT_INDEX  local weights auto-detected: {0}" -f $weightsDir) -ForegroundColor Cyan
}
Write-Host "$SCRIPT_INDEX  Runtime: pycore launches the qwen3tts HTTP server (class C) under the isolated venv on demand; no manual start needed." -ForegroundColor Cyan
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
