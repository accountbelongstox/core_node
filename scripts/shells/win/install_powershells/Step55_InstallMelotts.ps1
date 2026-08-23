<#
.SYNOPSIS
    MeloTTS offline TTS prerequisite — ISOLATED per-engine venv, never the main interpreter.
    Status-only by default; heavy build via -Full / MELOTTS_INSTALL=1.

.DESCRIPTION
    Bucket B (isolated), see
    development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5/§7:
    MeloTTS owns transformer dependencies that may conflict with the shared system stack.
    Therefore melo is NEVER installed into the main interpreter. Instead this step builds a
    DEDICATED per-engine venv via pycore/pyutils/common/python_env/isolated_venv.ensure_venv('melotts', ...)
    (created --system-site-packages so it REUSES the system CUDA torch; only melo + its pinned
    package-managed transformer dependencies are layered inside, shadowing system copies). Production runs
    melotts as a class-C HTTP server (melotts_api_server.py, port 57212) under that venv; the
    main interpreter only talks to it over HTTP.

    Because the build now touches ONLY the isolated venv, it is safe — but kept OPT-IN
    (-Full or MELOTTS_INSTALL=1) so an unattended pyservice boot never spends minutes
    building it unrequested. Skip entirely with MELOTTS_SKIP=1.

    Idempotent + self-repairing: a .deps_done sentinel + a venv-ready probe short-circuit a
    completed build; ensure_venv() re-runs an import-health probe and repairs a broken venv.
    -Force rebuilds the venv from scratch and re-warms the models.

    Official: https://github.com/myshell-ai/MeloTTS  import: from melo.api import TTS

.PARAMETER Python
    python.exe to target (the SYSTEM interpreter that builds the venv).
.PARAMETER Full
    Perform the heavy build (also enabled by MELOTTS_INSTALL=1).
.PARAMETER Force
    Rebuild the venv from scratch and re-warm models.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$SCRIPT_INDEX     = '[Step55-MeloTts]'
$coreNodeRoot     = $null
$stagingDefault   = $null
$targetDir        = $null
$depsSentinel     = $null
$resolvedPython   = $null
$doFull           = ($Full -or $env:MELOTTS_INSTALL -eq '1')
$venvProvisioned  = $false
$venvReady        = $false
$hasCuda          = $false
$device           = 'cpu'
$langs            = 'EN,ZH'
$venvPython       = ''
$optInNote        = 'opt-in; use -Full or MELOTTS_INSTALL=1'
$meloPins         = @()
$meloPackages     = @()
$meloHealth       = ''
$meloPolicy       = $null
$winCommonDir     = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'

. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$resolvedPython = $Global:PYTHON_EXE_PATH

$coreNodeRoot   = $Global:CORE_NODE_DIR
$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'melotts'
$targetDir      = if ($env:MELOTTS_DIR) { $env:MELOTTS_DIR } else { $stagingDefault }
$depsSentinel   = Join-Path $targetDir '.deps_done'

function Invoke-MeloTtsVenvNltk {
    # Pre-download the NLTK tagger used by melo's English G2P — INSIDE the venv.
    param([string]$VenvPython)
    if (-not $VenvPython) { return }
    Write-Host "$SCRIPT_INDEX [..] ensuring NLTK averaged_perceptron_tagger_eng (in venv) ..." -ForegroundColor Yellow
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & $VenvPython -c "import nltk; nltk.download('averaged_perceptron_tagger_eng', quiet=True)" 2>$null
    } catch { }
    $ErrorActionPreference = $prevEap
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX MeloTTS (free offline zh/en TTS, isolated venv)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:MELOTTS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] MELOTTS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @() -AbsentOk -AbsentNote 'MELOTTS_SKIP=1'
    return
}

if (-not ($resolvedPython -and (Test-Path -LiteralPath $resolvedPython))) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found at $Global:PYTHON_EXE_PATH. Run Step8_InstallPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}

$venvProvisioned = Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Engine 'melotts'
$meloPolicy = Get-TtsEngineInstallPolicy -PythonExe $resolvedPython -Engine 'melotts'
if ($meloPolicy) {
    $meloPins = @($meloPolicy.pins)
    $meloPackages = @($meloPolicy.packages)
    $meloHealth = [string]$meloPolicy.health_imports
}
if (-not $meloPolicy -or $meloPackages.Count -eq 0) {
    Write-Host "$SCRIPT_INDEX [!] MeloTTS runtime policy is unavailable or has no dependency plan; pip was not invoked." -ForegroundColor DarkYellow
    return
}
$hasCuda = (Get-CudaRuntimePolicy).Enabled
if ($hasCuda) {
    $device = 'cuda:0'
    $langs = 'EN,ZH,JP,KR,ES,FR'
}

Write-Host ("$SCRIPT_INDEX  python  : {0}" -f $resolvedPython) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  venv    : {0}" -f $(if ($venvProvisioned) { 'provisioned' } else { 'absent' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU -> full model set' } else { 'CPU only -> EN,ZH' })) -ForegroundColor DarkGray
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine melotts -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX

# Idempotent fast-path: venv already built + sentinel present -> nothing to do.
if ($venvProvisioned -and (Test-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'melotts' -Path $depsSentinel) -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'MeloTTS isolated venv already provisioned' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    Write-Host "$SCRIPT_INDEX  Runtime: pycore launches the melotts HTTP server (class C) under the isolated venv on demand." -ForegroundColor Cyan
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}

# EXPLICIT opt-in only: building the venv takes minutes, so require the user to ask
# (the build is now SAFE — it never touches the main interpreter's transformers pin).
if (-not $venvProvisioned -and -not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] opt-in only -> NOT building the isolated venv. Pass -Full or MELOTTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @() -AbsentOk -AbsentNote $optInNote
    return
}

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

# --- Isolated venv (Bucket B): MeloTTS and its transformer dependencies go only into the
#     dedicated venv (--system-site-packages reuses the system CUDA torch). The main
#     interpreter's shared transformers pin is never touched. Self-repairing:
#     ensure_venv re-runs the import-health probe and repairs a broken venv. --- #
Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
Write-Host "$SCRIPT_INDEX [..] building/verifying isolated melotts venv (ensure_venv; first build takes minutes) ..." -ForegroundColor Yellow
Invoke-IsolatedTtsVenvEnsure -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Engine 'melotts' -PipPackages $meloPackages -Pins $meloPins -HealthImports $meloHealth -Force:$Force
$venvReady = Test-IsolatedTtsVenvProvisioned -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Engine 'melotts'
if ($venvReady) {
    Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'melotts' -Path $depsSentinel | Out-Null
    Write-Host "$SCRIPT_INDEX [OK] isolated melotts venv ready; main interpreter transformers pin left untouched." -ForegroundColor Green
} else {
    Write-Host "$SCRIPT_INDEX [!] venv build incomplete; will retry next run (main interpreter untouched)." -ForegroundColor DarkYellow
}

# Post-build NLTK data setup runs inside the venv without loading model weights.
if ($venvReady) {
    $venvPython = Resolve-IsolatedTtsVenvPython -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Engine 'melotts'
    Invoke-MeloTtsVenvNltk -VenvPython $venvPython
    Write-Host "$SCRIPT_INDEX [OK] MeloTTS ready (free, offline; isolated venv)." -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX  Runtime: pycore launches the melotts HTTP server (class C) under the isolated venv on demand." -ForegroundColor Cyan
}

if (-not $venvReady) {
    Write-Host "$SCRIPT_INDEX [!] MeloTTS isolated venv is not ready; retrying next run." -ForegroundColor DarkYellow
    return
}

Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
