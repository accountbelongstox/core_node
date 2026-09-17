<#
.SYNOPSIS
    VoxCPM2 prerequisite (OpenBMB TTS) — ISOLATED self-contained per-engine venv.

.DESCRIPTION
    Official: pip install voxcpm (https://voxcpm.readthedocs.io/en/latest/quickstart.html)
    GPU hosts install CUDA torch by default (~8GB VRAM recommended).

    VoxCPM2's official support window is Python 3.10-3.12; the main interpreter is
    3.13, so voxcpm is NEVER installed into it. This step builds a dedicated
    self-contained venv via isolated_venv.ensure_venv('voxcpm2', ...) (base
    Python 3.10 from Step13_InstallPython310). Production runs VoxCPM2 as a
    class-C HTTP server (voxcpm2_api_server.py, port 57214) under that venv; the
    main interpreter only talks to it over HTTP.

    Opt-in: -Full or VOXCPM2_INSTALL=1 or NEURAL_TTS_INSTALL=1.
    Skip with VOXCPM2_SKIP=1.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX   = '[Step58-Voxcpm2]'
$stagingDefault = $null
$targetDir      = $null
$depsSentinel   = $null
$weightsDir     = $null
$modelSentinel  = $null
$weightAllow    = @('*.bin', '*.safetensors', '*.pt', '*.json', '*.txt', '*.model', '*.vocab')
$resolvedPython = $null
$hasCuda        = $false
$doFull         = ($Full -or $env:VOXCPM2_INSTALL -eq '1' -or $env:NEURAL_TTS_INSTALL -eq '1')
$voxcpm2Model   = $null
$modelReady     = $false
$dlOk           = $false
$sentinelModel  = $null
$voxcpmPolicy   = $null
$voxcpmPackages = @()

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')

$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'voxcpm2'
$targetDir = if ($env:VOXCPM2_DIR) { $env:VOXCPM2_DIR } else { $stagingDefault }
$depsSentinel = Join-Path $targetDir '.deps_done'
$weightsDir = Join-Path $targetDir 'weights'
$modelSentinel = Join-Path $targetDir '.model_installed'
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$resolvedPython = $Global:PYTHON_EXE_PATH

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX VoxCPM2 (OpenBMB)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:VOXCPM2_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] VOXCPM2_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @() -AbsentOk -AbsentNote 'VOXCPM2_SKIP=1'
    return
    return
}

# --- Install method selection (native/docker), plan steps 16-17 ---
# VoxCPM has no official container evidence (checked 2026-09); the supported set
# is native-only, so the selector persists it directly without a countdown.
. (Join-Path $winCommonDir 'InstallMethodCommon.ps1')
$installMethod = Select-TtsInstallMethod -Engine voxcpm2 `
    -SupportedBackends @('native') `
    -RecommendedBackend 'native' `
    -RecommendationSource 'VoxCPM official repo documents native install only; no official container image - https://github.com/OpenBMB/VoxCPM' `
    -DefaultBackend 'native' -Method $env:TTS_METHOD -Reselect:([bool]$env:TTS_METHOD_RESELECT)
if (-not $installMethod) { Write-Host "$SCRIPT_INDEX [i] install method selection cancelled; nothing changed."; return }
Save-TtsInstallBackend -Engine voxcpm2 -Backend $installMethod

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'voxcpm2' -Path $depsSentinel) -and -not $Force -and -not $doFull) {
    Write-Host "$SCRIPT_INDEX [OK] VoxCPM2 already installed -> skipping." -ForegroundColor Green
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only. Pass -Full, VOXCPM2_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @() -AbsentOk -AbsentNote 'opt-in'
    return
}

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step8_InstallDefaultPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}
if (-not (Test-TtsEngineCompatible -PythonExe $resolvedPython -Engine 'voxcpm2' -Prefix "$SCRIPT_INDEX ")) {
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}
$voxcpmPolicy = Get-TtsEngineInstallPolicy -PythonExe $resolvedPython -Engine 'voxcpm2'
if ($voxcpmPolicy) { $voxcpmPackages = @($voxcpmPolicy.packages) }

$hasCuda = (Get-CudaRuntimePolicy).Enabled
$voxcpm2Model = Resolve-TtsModelTier -PythonExe $resolvedPython -Key voxcpm2_model -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  weights : {0}" -f $weightsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU (default)' } else { 'CPU only' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model   : {0}" -f $voxcpm2Model) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  sentinel: {0} ({1})" -f $modelSentinel, $(if (Test-Path $modelSentinel) { 'present' } else { 'absent' })) -ForegroundColor DarkGray

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

# --- Isolated venv (Bucket B, self-contained): VoxCPM2 and its pinned
#     dependencies go only into the dedicated Python 3.10 venv; the main
#     interpreter (3.13) is outside the official 3.10-3.12 window and is never
#     touched. The engine runs as a class-C HTTP server (voxcpm2_api_server.py,
#     port 57214) under that venv. --- #
if ((Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'voxcpm2') -and (Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'voxcpm2' -Path $depsSentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] isolated venv already provisioned (.deps_done) -> skipping." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [..] building/verifying isolated voxcpm2 venv (ensure_venv; first build takes minutes) ..." -ForegroundColor Yellow
    Invoke-IsolatedTtsVenvEnsure -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'voxcpm2' -PipPackages $voxcpmPackages -Force:$Force
    if (Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $Global:CORE_NODE_DIR -Engine 'voxcpm2') {
        Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'voxcpm2' -Path $depsSentinel | Out-Null
        Write-Host "$SCRIPT_INDEX [OK] isolated voxcpm2 venv ready (policy stamp written)." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] venv build incomplete; will retry next run (main interpreter untouched)." -ForegroundColor DarkYellow
    }
}

# --- HF weights (IDEMPOTENT: sentinel + curl resume + HF size verification) --- #
# allow-list excludes redundant flax/tf/onnx format variants.
$modelReady = $false
if ((Test-Path $modelSentinel) -and -not $Force) {
    $sentinelModel = (Get-Content -LiteralPath $modelSentinel -Raw -ErrorAction SilentlyContinue)
    if ($sentinelModel) { $sentinelModel = $sentinelModel.Trim().Trim([char]0xFEFF) }
    if ($sentinelModel -and ($sentinelModel -eq $voxcpm2Model) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $voxcpm2Model -AllowPatterns $weightAllow)) {
        Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason "model weights verified ($voxcpm2Model)" -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
        $modelReady = $true
    } elseif ($sentinelModel -and ($sentinelModel -ne $voxcpm2Model)) {
        Write-Host ("$SCRIPT_INDEX [..] model tier changed ({0} -> {1}); refreshing weights." -f $sentinelModel, $voxcpm2Model) -ForegroundColor Yellow
    } elseif (-not (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $voxcpm2Model -AllowPatterns $weightAllow)) {
        Write-Host "$SCRIPT_INDEX [..] local weights incomplete or corrupt; repairing download." -ForegroundColor Yellow
    }
}
if (-not $modelReady) {
    Write-Host ("$SCRIPT_INDEX [..] downloading/repairing model '{0}' (curl, resumable) ..." -f $voxcpm2Model) -ForegroundColor Yellow
    $dlOk = Install-HfRepoFlat -RepoId $voxcpm2Model -DestDir $weightsDir -SentinelPath $modelSentinel -AllowPatterns $weightAllow -Prefix "$SCRIPT_INDEX " -SentinelValue $voxcpm2Model
    if ($dlOk -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $voxcpm2Model -AllowPatterns $weightAllow)) {
        $modelReady = $true
        Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready at {1}." -f $voxcpm2Model, $weightsDir) -ForegroundColor Green
    } else {
        Write-Host ("$SCRIPT_INDEX [!] model download not finished; partial files kept at {0}; will RESUME next run." -f $weightsDir) -ForegroundColor DarkYellow
    }
}

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'voxcpm2' -Path $depsSentinel) -and $modelReady) {
    Write-Host "$SCRIPT_INDEX [OK] VoxCPM2 ready. Weights pre-downloaded (idempotent); engine auto-detects local." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [!] VoxCPM2 is not ready; incomplete components will retry next run." -ForegroundColor DarkYellow
    return
}
if ((Test-Path $modelSentinel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $voxcpm2Model -AllowPatterns $weightAllow)) {
    Write-Host ("$SCRIPT_INDEX  local weights auto-detected: {0}" -f $weightsDir) -ForegroundColor Cyan
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
