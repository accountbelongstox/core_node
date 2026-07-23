<#
.SYNOPSIS
    VoxCPM2 prerequisite (OpenBMB in-process TTS).

.DESCRIPTION
    Official: pip install voxcpm (https://voxcpm.readthedocs.io/en/latest/quickstart.html)
    GPU hosts install CUDA torch by default (~8GB VRAM recommended).

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
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX VoxCPM2 (OpenBMB)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:VOXCPM2_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] VOXCPM2_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('voxcpm') -AbsentOk -AbsentNote 'VOXCPM2_SKIP=1'
    return
}

$resolvedPython = $Global:PYTHON_EXE_PATH
if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'voxcpm2' -Path $depsSentinel) -and -not $Force -and -not $doFull) {
    Write-Host "$SCRIPT_INDEX [OK] VoxCPM2 already installed -> skipping." -ForegroundColor Green
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('voxcpm')
}
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] status-only. Pass -Full, VOXCPM2_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('voxcpm') -AbsentOk -AbsentNote 'opt-in'
}

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step8_InstallPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('voxcpm')
}
if (-not (Test-TtsEngineCompatible -PythonExe $resolvedPython -Engine 'voxcpm2' -Prefix "$SCRIPT_INDEX ")) {
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
}
$voxcpmPolicy = Get-TtsEngineInstallPolicy -PythonExe $resolvedPython -Engine 'voxcpm2'
if ($voxcpmPolicy) { $voxcpmPackages = @($voxcpmPolicy.packages) }

$hasCuda = Test-CudaPresent
$voxcpm2Model = Resolve-TtsModelTier -PythonExe $resolvedPython -Key voxcpm2_model -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  weights : {0}" -f $weightsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU (default)' } else { 'CPU only' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model   : {0}" -f $voxcpm2Model) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  sentinel: {0} ({1})" -f $modelSentinel, $(if (Test-Path $modelSentinel) { 'present' } else { 'absent' })) -ForegroundColor DarkGray

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'voxcpm2' -Path $depsSentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] dependencies already installed (.deps_done) -> skipping pip." -ForegroundColor Green
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    Write-Host "$SCRIPT_INDEX [..] installing the central VoxCPM2 dependency plan ..." -ForegroundColor Yellow
    try { & $Global:PIP_EXE_PATH install @voxcpmPackages } catch { Write-Host "$SCRIPT_INDEX [!] voxcpm pip failed." -ForegroundColor DarkYellow }
    if (Test-TtsEngineHealth -PythonExe $resolvedPython -Engine 'voxcpm2') {
        Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'voxcpm2' -Path $depsSentinel | Out-Null
        Write-Host "$SCRIPT_INDEX [OK] dependencies installed (policy stamp written)." -ForegroundColor Green
    }
}

# --- HF weights (IDEMPOTENT: sentinel + curl resume + HF size verification) --- #
# allow-list excludes redundant flax/tf/onnx format variants.
$modelReady = $false
if ((Test-Path $modelSentinel) -and -not $Force) {
    $sentinelModel = (Get-Content -LiteralPath $modelSentinel -Raw -ErrorAction SilentlyContinue)
    if ($sentinelModel) { $sentinelModel = $sentinelModel.Trim().Trim([char]0xFEFF) }
    if ($sentinelModel -and ($sentinelModel -eq $voxcpm2Model) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $voxcpm2Model)) {
        Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason "model weights verified ($voxcpm2Model)" -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
        $modelReady = $true
    } elseif ($sentinelModel -and ($sentinelModel -ne $voxcpm2Model)) {
        Write-Host ("$SCRIPT_INDEX [..] model tier changed ({0} -> {1}); refreshing weights." -f $sentinelModel, $voxcpm2Model) -ForegroundColor Yellow
    } elseif (-not (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $voxcpm2Model)) {
        Write-Host "$SCRIPT_INDEX [..] local weights incomplete or corrupt; repairing download." -ForegroundColor Yellow
    }
}
if (-not $modelReady) {
    Write-Host ("$SCRIPT_INDEX [..] downloading/repairing model '{0}' (curl, resumable) ..." -f $voxcpm2Model) -ForegroundColor Yellow
    $dlOk = Install-HfRepoFlat -RepoId $voxcpm2Model -DestDir $weightsDir -SentinelPath $modelSentinel -AllowPatterns $weightAllow -Prefix "$SCRIPT_INDEX " -SentinelValue $voxcpm2Model
    if ($dlOk -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $voxcpm2Model)) {
        $modelReady = $true
        Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready at {1}." -f $voxcpm2Model, $weightsDir) -ForegroundColor Green
    } else {
        Write-Host ("$SCRIPT_INDEX [!] model download not finished; partial files kept at {0}; will RESUME next run." -f $weightsDir) -ForegroundColor DarkYellow
    }
}

if ((Test-TtsDependenciesReady -PythonExe $resolvedPython -Engine 'voxcpm2' -Path $depsSentinel) -and $modelReady) {
    Write-Host "$SCRIPT_INDEX [OK] VoxCPM2 ready. Weights pre-downloaded (idempotent); engine auto-detects local." -ForegroundColor Green
} else {
    throw "$SCRIPT_INDEX VoxCPM2 is not ready; incomplete components will retry next run."
}
if ((Test-Path $modelSentinel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $voxcpm2Model)) {
    Write-Host ("$SCRIPT_INDEX  local weights auto-detected: {0}" -f $weightsDir) -ForegroundColor Cyan
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('voxcpm')
