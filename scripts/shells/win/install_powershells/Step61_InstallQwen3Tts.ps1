<#
.SYNOPSIS
    Qwen3-TTS prerequisite (Alibaba qwen-tts) — ISOLATED venv, never the main interpreter.

.DESCRIPTION
    Bucket B (isolated). qwen-tts pins transformers==4.57.3, which CANNOT coexist with the
    main system Python 3.13's shared Bucket-A pin (transformers==4.46.x). Therefore qwen-tts
    is NEVER installed into the main interpreter. Instead this step builds the DEDICATED venv
    via pycore/pyutils/tts/qwen3tts_venv.ensure_venv() (created --system-site-packages so it
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

function Test-Qwen3TtsVenvProvisioned {
    # Quick, no-build readiness gate: the isolated venv interpreter is present on disk
    # (qwen3tts_venv.venv_ready()). Captures a stdout marker; never rebuilds.
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$CoreNodeRoot
    )
    $rootLiteral = ($CoreNodeRoot -replace "'", "''")
    $pyCode = @"
import sys
sys.path.insert(0, r'$rootLiteral')
from pycore.pyutils.tts import qwen3tts_venv
sys.stdout.write('__VENV_READY__' if qwen3tts_venv.venv_ready() else '__VENV_NOTREADY__')
"@
    # PYCORE_SKIP_DEP_CHECK=1: importing pycore.pyutils.tts must NOT run the import-time
    # check_and_install_dependencies() (it does pip ops and throws under Stop). Same guard
    # as Invoke-Qwen3TtsWeightsReadyCheck.
    $prevSkip = $env:PYCORE_SKIP_DEP_CHECK
    $env:PYCORE_SKIP_DEP_CHECK = '1'
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = (& $PythonExe -c $pyCode 2>$null) -join ''
    $ErrorActionPreference = $prevEap
    $env:PYCORE_SKIP_DEP_CHECK = $prevSkip
    return ($out -match '__VENV_READY__')
}

function Invoke-Qwen3TtsEnsureVenv {
    # Build/verify the isolated venv via qwen3tts_venv.ensure_venv(). Runs the system
    # Python LIVE (pip output streams to console; first build takes minutes) and reads
    # readiness from the process exit code (0 = qwen_tts imports cleanly in the venv).
    # ensure_venv() is self-repairing: it re-imports qwen_tts and rebuilds a broken venv.
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$CoreNodeRoot,
        [switch]$Force,
        [string]$Prefix = ''
    )
    $rootLiteral = ($CoreNodeRoot -replace "'", "''")
    $forceLiteral = if ($Force) { 'True' } else { 'False' }
    $pyCode = @"
import sys
sys.path.insert(0, r'$rootLiteral')
from pycore.pyutils.tts import qwen3tts_venv
py = qwen3tts_venv.ensure_venv(force=$forceLiteral)
sys.exit(0 if py else 1)
"@
    # PYCORE_SKIP_DEP_CHECK=1: importing pycore.pyutils.tts must NOT run the import-time
    # check_and_install_dependencies(). ensure_venv() does its own venv provisioning.
    $prevSkip = $env:PYCORE_SKIP_DEP_CHECK
    $env:PYCORE_SKIP_DEP_CHECK = '1'
    # Run LIVE (attached): ensure_venv streams pip output; first build takes minutes.
    # Out-Host (no 2>&1) shows it live WITHOUT letting the child's stdout leak into this
    # function's return value (PowerShell returns all pipeline output), and avoids native
    # stderr wrapping into ErrorRecords under ErrorActionPreference Stop. $LASTEXITCODE stays the exe's.
    & $PythonExe -c $pyCode | Out-Host
    $venvOk = ($LASTEXITCODE -eq 0)
    $env:PYCORE_SKIP_DEP_CHECK = $prevSkip
    return $venvOk
}

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

$hasCuda = Test-CudaPresent
$qwenModel = Resolve-TtsModelTier -PythonExe $resolvedPython -Key qwen3tts_model -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine qwen3tts -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  weights : {0}" -f $weightsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  model   : {0}" -f $qwenModel) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  sentinel: {0} ({1})" -f $modelSentinel, $(if (Test-Path $modelSentinel) { 'present' } else { 'absent' })) -ForegroundColor DarkGray

Ensure-SoxOnPath -Prefix "$SCRIPT_INDEX " -Force:$Force | Out-Null

if (
    (Test-Path $depsSentinel) -and
    (Test-Path $modelSentinel) -and
    -not $Force -and
    (Test-Qwen3TtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot)
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
$venvReady = $false
if (-not ((Test-Path $depsSentinel) -and -not $Force)) {
    # Fresh or forced: ensure pip + the system torch the venv will reuse, once.
    & $resolvedPython -m pip install --upgrade pip 2>&1 | Out-Host
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
}
Write-Host "$SCRIPT_INDEX [..] building/verifying isolated qwen-tts venv (ensure_venv; first build takes minutes) ..." -ForegroundColor Yellow
$venvReady = Invoke-Qwen3TtsEnsureVenv -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Force:$Force -Prefix "$SCRIPT_INDEX "
if ($venvReady) {
    Set-Content -Path $depsSentinel -Value (Get-Date -Format o) -Encoding utf8
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
        Write-Host ("$SCRIPT_INDEX [OK] model '{0}' ready at {1}." -f $qwenModel, $weightsDir) -ForegroundColor Green
    } else {
        Write-Host ("$SCRIPT_INDEX [!] model download not finished; partial files kept at {0}; will RESUME next run." -f $weightsDir) -ForegroundColor DarkYellow
    }
}

Write-Host "$SCRIPT_INDEX [OK] Qwen3-TTS ready. Set QWEN3TTS_MODEL / QWEN3TTS_SPEAKER." -ForegroundColor Green
if ((Test-Path $modelSentinel) -and (Test-NeuralTtsLocalWeightsReady -WeightsDir $weightsDir -RepoId $qwenModel)) {
    Write-Host ("$SCRIPT_INDEX  local weights auto-detected: {0}" -f $weightsDir) -ForegroundColor Cyan
}
Write-Host "$SCRIPT_INDEX  Runtime: pycore launches the qwen3tts HTTP server (class C) under the isolated venv on demand; no manual start needed." -ForegroundColor Cyan
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
