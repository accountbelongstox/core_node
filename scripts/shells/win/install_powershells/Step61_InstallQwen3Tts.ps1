<#
.SYNOPSIS
    Qwen3-TTS prerequisite (Alibaba qwen-tts) — ISOLATED venv, never the main interpreter.

.DESCRIPTION
    Bucket B (isolated). qwen-tts owns transformer dependencies that may conflict with the
    main system Python 3.13 shared stack. Therefore qwen-tts
    is NEVER installed into the main interpreter. Instead this step builds the DEDICATED venv
    via pycore/pyutils/common/python_env/isolated_venv.ensure_venv(). The environment is a
    dedicated dependency overlay: --system-site-packages exposes the managed Python runtime
    so the CUDA torch group is reused, while qwen-tts owns its local dependency overrides.
    Production runs qwen3tts as a class-C HTTP server under that venv; the main interpreter only
    talks to it over HTTP. Contract:
    development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5.
    Official: https://github.com/QwenLM/Qwen3-TTS

    GPU: Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice; CPU: 0.6B-CustomVoice.
    Runtime: SoX binary on PATH (pysox; winget ChrisBagwell.SoX).
    Idempotent + self-repairing by default (no switches required): builds/verifies the venv
    (ensure_venv re-imports qwen_tts and repairs it in place if broken), downloads or repairs HF
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
$venvReady      = $false
$cudaPolicy     = $null
$soxReady       = $false
$pythonCommand  = $null

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'WindowsPathFunction.ps1')

$coreNodeRoot = $Global:CORE_NODE_DIR
$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'qwen3tts'
$targetDir = if ($env:QWEN3TTS_DIR) { $env:QWEN3TTS_DIR } else { $stagingDefault }
$weightsDir = Join-Path $targetDir 'weights'
$depsSentinel = Join-Path $targetDir '.deps_done'
$modelSentinel = Join-Path $targetDir '.model_installed'

# Storage ownership invariant:
# - $targetDir\weights is the only installer-managed Qwen model store.
# - .model_installed identifies the HF repository stored in weights.
# - .deps_done describes the package plan only.
# - D:\.dev_win10\py_venv_qwen3tts_* contains Python packages only.
# Rebuilding or changing the venv must never delete, move, or redownload
# complete files under $weightsDir. Install-HfRepoFlat skips verified files and
# resumes incomplete files in place.

. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
if ($PSBoundParameters.ContainsKey('Python')) {
    if ([System.IO.Path]::IsPathRooted($Python)) {
        $resolvedPython = (Resolve-Path -LiteralPath $Python).Path
    } else {
        $pythonCommand = Get-Command -Name $Python -CommandType Application -ErrorAction Stop
        $resolvedPython = $pythonCommand.Source
    }
} else {
    $resolvedPython = $Global:PYTHON_EXE_PATH
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Qwen3-TTS (Alibaba qwen-tts)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ("$SCRIPT_INDEX  base python: {0}" -f $resolvedPython) -ForegroundColor DarkGray

if ($env:QWEN3TTS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] QWEN3TTS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @() -AbsentOk -AbsentNote 'QWEN3TTS_SKIP=1'
    return
}

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found." -ForegroundColor DarkYellow
    Complete-PrereqStep -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}

if (-not (Test-TtsEngineCompatible -PythonExe $resolvedPython -Engine 'qwen3tts' -Prefix "$SCRIPT_INDEX ")) {
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}

$cudaPolicy = Get-CudaRuntimePolicy
Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
if ($cudaPolicy.Enabled -and -not (Test-TorchCudaUsable -PythonCmd $resolvedPython)) {
    Write-Host "$SCRIPT_INDEX [!] NVIDIA GPU is present but $($cudaPolicy.Tag) torch is not usable; Qwen3-TTS will retry after the runtime is repaired." -ForegroundColor DarkYellow
    return
}

$hasCuda = ($cudaPolicy.Enabled -and (Test-TorchCudaUsable -PythonCmd $resolvedPython))
$qwenModel = Resolve-TtsModelTier -PythonExe $resolvedPython -Key qwen3tts_model -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine qwen3tts -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  weights : {0}" -f $weightsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model   : {0}" -f $qwenModel) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  sentinel: {0} ({1})" -f $modelSentinel, $(if (Test-Path $modelSentinel) { 'present' } else { 'absent' })) -ForegroundColor DarkGray

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
$soxReady = Ensure-SoxOnPath -Prefix "$SCRIPT_INDEX " -Force:$Force
if (-not $soxReady) {
    Write-Host "$SCRIPT_INDEX [!] SoX is unavailable; qwen-tts will retry next run." -ForegroundColor DarkYellow
    return
}

if (
    (Test-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'qwen3tts' -Path $depsSentinel) -and
    (Test-Path $modelSentinel) -and
    -not $Force -and
    (Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Engine 'qwen3tts')
) {
    $sentinelModel = (Get-Content -LiteralPath $modelSentinel -Raw -ErrorAction SilentlyContinue)
    if ($sentinelModel) { $sentinelModel = $sentinelModel.Trim().Trim([char]0xFEFF) }
    if ($sentinelModel -and ($sentinelModel -eq $qwenModel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
        Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason "Qwen3-TTS already installed (deps + verified model)" -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
        Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
        return
    }
    if ($sentinelModel -and ($sentinelModel -ne $qwenModel)) {
        Write-Host ("$SCRIPT_INDEX [..] model tier changed ({0} -> {1}); refreshing weights." -f $sentinelModel, $qwenModel) -ForegroundColor Yellow
    } elseif (-not (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
        Write-Host "$SCRIPT_INDEX [..] local weights incomplete or corrupt; repairing download." -ForegroundColor Yellow
    }
}

# --- Isolated venv (Bucket B): qwen-tts owns its transformer dependency set, which is
#     potentially incompatible with the main interpreter's shared stack, so it is never
#     installed here. Build the dedicated dependency overlay (ensure_venv;
#     --system-site-packages exposes the managed CUDA torch group) instead.
#     Self-repairing: ensure_venv re-imports
#     qwen_tts and repairs a broken venv in place. See lifecycle doc §5. --- #
Write-Host "$SCRIPT_INDEX [..] building/verifying isolated qwen-tts venv (ensure_venv; first build takes minutes) ..." -ForegroundColor Yellow
$venvReady = Invoke-IsolatedTtsVenvEnsure -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Engine 'qwen3tts' -Force:$Force
if ($venvReady) {
    Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'qwen3tts' -Path $depsSentinel | Out-Null
    Write-Host "$SCRIPT_INDEX [OK] isolated qwen-tts venv ready; main interpreter packages left untouched." -ForegroundColor Green
} else {
    if (Test-Path -LiteralPath $depsSentinel) {
        Remove-Item -LiteralPath $depsSentinel -Force -ErrorAction SilentlyContinue
    }
    Write-Host "$SCRIPT_INDEX [!] venv build incomplete; full probe diagnostics were emitted above. Retry once, then use -Force if the same failure repeats (main interpreter untouched)." -ForegroundColor DarkYellow
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
    Write-Host "$SCRIPT_INDEX [!] Qwen3-TTS is not ready; the incomplete component will be retried next run." -ForegroundColor DarkYellow
    return
}

Write-Host "$SCRIPT_INDEX [OK] Qwen3-TTS ready. Set QWEN3TTS_MODEL / QWEN3TTS_SPEAKER." -ForegroundColor Green
if ((Test-Path $modelSentinel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
    Write-Host ("$SCRIPT_INDEX  local weights auto-detected: {0}" -f $weightsDir) -ForegroundColor Cyan
}
Write-Host "$SCRIPT_INDEX  Runtime: pycore launches the qwen3tts HTTP server (class C) under the isolated venv on demand; no manual start needed." -ForegroundColor Cyan
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
