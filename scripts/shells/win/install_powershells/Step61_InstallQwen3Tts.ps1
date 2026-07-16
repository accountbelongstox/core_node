<#
.SYNOPSIS
    Qwen3-TTS prerequisite (Alibaba qwen-tts package).

.DESCRIPTION
    Category 2 — Python 3.13 compatible via official qwen-tts wheel.
    Official: https://github.com/QwenLM/Qwen3-TTS  pip install -U qwen-tts

    GPU: Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice; CPU: 0.6B-CustomVoice.
    Runtime: SoX binary on PATH (pysox; winget ChrisBagwell.SoX).
    Idempotent by default (no switches required): installs deps, downloads or repairs
    HF weights (curl resume + size verification). Skip with QWEN3TTS_SKIP=1.
    -Force reinstalls pip deps and re-validates every weight file.
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

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'WindowsPathFunction.ps1')

$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'qwen3tts'
$targetDir = if ($env:QWEN3TTS_DIR) { $env:QWEN3TTS_DIR } else { $stagingDefault }
$weightsDir = Join-Path $targetDir 'weights'
$depsSentinel = Join-Path $targetDir '.deps_done'
$modelSentinel = Join-Path $targetDir '.model_installed'

. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

function Test-PyModule {
    param([string]$Py, [string]$ModuleName)
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = (& $Py -c "import importlib.util; print('__FOUND__' if importlib.util.find_spec('$ModuleName') else '__MISSING__')" 2>$null) -join ''
    $ErrorActionPreference = $prevEap
    return ($out -match '__FOUND__')
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX Qwen3-TTS (Alibaba qwen-tts)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:QWEN3TTS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] QWEN3TTS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('qwen_tts')
}

$resolvedPython = $Global:PYTHON_EXE_PATH
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found." -ForegroundColor DarkYellow
    Complete-PrereqStep -Prefix $SCRIPT_INDEX -ImportModules @('qwen_tts')
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
    (Test-PyModule -Py $resolvedPython -ModuleName 'qwen_tts') -and
    (Test-Path $depsSentinel) -and
    (Test-Path $modelSentinel) -and
    -not $Force
) {
    $sentinelModel = (Get-Content -LiteralPath $modelSentinel -Raw -ErrorAction SilentlyContinue)
    if ($sentinelModel) { $sentinelModel = $sentinelModel.Trim().Trim([char]0xFEFF) }
    if ($sentinelModel -and ($sentinelModel -eq $qwenModel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
        Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason "Qwen3-TTS already installed (deps + verified model)" -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
        Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('qwen_tts')
    }
    if ($sentinelModel -and ($sentinelModel -ne $qwenModel)) {
        Write-Host ("$SCRIPT_INDEX [..] model tier changed ({0} -> {1}); refreshing weights." -f $sentinelModel, $qwenModel) -ForegroundColor Yellow
    } elseif (-not (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
        Write-Host "$SCRIPT_INDEX [..] local weights incomplete or corrupt; repairing download." -ForegroundColor Yellow
    }
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if ((Test-Path $depsSentinel) -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'dependencies already installed (.deps_done)' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    Write-Host "$SCRIPT_INDEX [..] pip install -U qwen-tts soundfile ..." -ForegroundColor Yellow
    try { & $Global:PIP_EXE_PATH install -U qwen-tts soundfile } catch { }
    Set-Content -Path $depsSentinel -Value (Get-Date -Format o) -Encoding utf8
    Write-Host "$SCRIPT_INDEX [OK] Qwen3-TTS dependencies installed." -ForegroundColor Green
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
        Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready at {1}." -f $qwenModel, $weightsDir) -ForegroundColor Green
    } else {
        Write-Host ("$SCRIPT_INDEX [!] model download not finished; partial files kept at {0}; will RESUME next run." -f $weightsDir) -ForegroundColor DarkYellow
    }
}

Write-Host "$SCRIPT_INDEX [OK] Qwen3-TTS ready. Set QWEN3TTS_MODEL / QWEN3TTS_SPEAKER." -ForegroundColor Green
if ((Test-Path $modelSentinel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
    Write-Host ("$SCRIPT_INDEX  local weights auto-detected: {0}" -f $weightsDir) -ForegroundColor Cyan
}
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('qwen_tts')
