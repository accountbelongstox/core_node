<#
.SYNOPSIS
    GPT-SoVITS TTS prerequisite (free voice cloning), auto-run by PreparePycorePrerequisites.ps1
    (pyservice). Installs by default into a STAGING area under the code's data root
    and downloads the pretrained models — IDEMPOTENTLY (never re-clones or
    re-downloads what is already present). CPU-fallback: CUDA torch build when a GPU
    is present, else CPU.

.DESCRIPTION
    GPT-SoVITS is a multi-GB repo + HuggingFace models running an api server
    (api_v2.py, default 127.0.0.1:9880). pycore's gptsovits engine is an HTTP CLIENT
    to that server. This installer:
      1. clones RVC-Boss/GPT-SoVITS into <cache>\pycore\gptsovits  (the
         staging/data root; override with GPTSOVITS_DIR) — skipped if already cloned.
      2. builds a DEDICATED isolated venv (isolated_venv.ensure_venv,
         --system-site-packages reuses the system CUDA torch) and installs the repo
         requirements INTO it -- the main interpreter is NEVER touched.
      3. downloads the pretrained models from HuggingFace lj1995/GPT-SoVITS into
         GPT_SoVITS\pretrained_models via curl mirror download (resumable,
         hash-verified, SKIPS files already present) — a
         .snapshot_done sentinel short-circuits a completed download.
    Everything is IDEMPOTENT: a reachable server, an existing repo, or the sentinel
    each skip their step, so re-runs never re-download. Download progress is shown.
    Best-effort: never fails the boot (always exit 0). Skip entirely with
    GPTSOVITS_SKIP=1. Repo: https://github.com/RVC-Boss/GPT-SoVITS

    LIFECYCLE — Bucket B (isolated per-engine venv), see
    development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md §5/§7:
    GPT-SoVITS's requirements.txt pins an OLD transformers that is incompatible with the
    shared transformer stack in the single system Python 3.13. It is
    therefore installed INTO a DEDICATED isolated venv (py_venv_gptsovits_<ver>) and NEVER
    into the main interpreter, so it can no longer clobber DeepSeek/Qwen2.5/NLLB. pycore
    launches api_v2.py under that venv (isolated_venv.resolve_python('gptsovits')). The
    build is kept EXPLICIT-opt-in (-Full or GPTSOVITS_INSTALL=1), NOT the default
    NEURAL_TTS_INSTALL batch, because cloning the multi-GB repo + building the venv takes
    minutes and should not run unrequested on an unattended boot.

.PARAMETER Python
    python.exe (the SYSTEM interpreter that builds the venv + downloads models). Default: 'python'.
.PARAMETER Full
    Perform clone, isolated-venv build, and model download. Also enabled by
    GPTSOVITS_INSTALL=1 (explicit opt-in only; NOT the default NEURAL_TTS_INSTALL batch).
.PARAMETER Force
    Re-run the model snapshot even if the sentinel says it is complete.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Variable declarations (all at top)
$SCRIPT_INDEX   = '[Step54-Gptsovits]'
$REPO_URL       = 'https://github.com/RVC-Boss/GPT-SoVITS.git'
$HF_REPO        = 'lj1995/GPT-SoVITS'
$serverUrl      = if ($env:GPTSOVITS_URL) { $env:GPTSOVITS_URL.TrimEnd('/') } else { 'http://127.0.0.1:9880' }
$coreNodeRoot   = $null
$stagingDefault = $null
$targetDir      = $null
$modelsDir      = $null
$sentinel       = $null
$depsSentinel   = $null
$resolvedPython = $null
$enginePython   = $null
$pythonOverride = [string]$env:GPTSOVITS_PYTHON
$hasCuda        = $false
$reqFile        = $null
$dlOk           = $false
$gptsovitsVenvReady = $false
# EXPLICIT opt-in only (NOT the default NEURAL_TTS_INSTALL batch): a fresh install clones a
# multi-GB repo and builds the isolated venv (minutes), so run it only when asked. The
# old-transformers pin now lands in the venv, never the main interpreter. See the header.
$doFull         = ($Full -or $env:GPTSOVITS_INSTALL -eq '1')

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')
$coreNodeRoot = $Global:CORE_NODE_DIR

# Staging area = PYCORE_LOCAL_DATA_DIR (D:\www\cache\pycore\gptsovits); override with GPTSOVITS_DIR.
$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'gptsovits'
$targetDir = if ($env:GPTSOVITS_DIR) { $env:GPTSOVITS_DIR } else { $stagingDefault }
$modelsDir = Join-Path $targetDir 'GPT_SoVITS\pretrained_models'
$sentinel  = Join-Path $modelsDir '.snapshot_done'
$depsSentinel = Join-Path $targetDir '.deps_done'

# GPU detection comes from the ONE shared helper (canonical: CUDADetector).
. (Join-Path $winCommonDir 'CudaIndex.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
$resolvedPython = $Global:PYTHON_EXE_PATH
$enginePython = $resolvedPython
if ($pythonOverride -and (Test-Path -LiteralPath $pythonOverride -PathType Leaf)) {
    $enginePython = (Resolve-Path -LiteralPath $pythonOverride).Path
    $env:GPTSOVITS_PYTHON = $enginePython
} elseif ($pythonOverride) {
    Write-Host "$SCRIPT_INDEX [i] GPTSOVITS_PYTHON is not a valid interpreter path; using the shared interpreter policy." -ForegroundColor DarkYellow
}

function Test-ServerUp {
    param([string]$Url)
    try { $r = Invoke-WebRequest -Uri "$Url/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; return ($r.StatusCode -lt 500) }
    catch { if ($_.Exception.Response) { return $true } return $false }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX GPT-SoVITS TTS (free voice-clone server, isolated venv)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:GPTSOVITS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] GPTSOVITS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @() -AbsentOk -AbsentNote 'GPTSOVITS_SKIP=1'
    return
}
if (Test-ServerUp -Url $serverUrl) {
    Write-Host "$SCRIPT_INDEX [OK] server reachable at $serverUrl -> nothing to do." -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX      Set GPTSOVITS_REF_AUDIO to a reference clip to enable the engine." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @() -AbsentOk -AbsentNote 'external server reachable'
    return
}

if ($resolvedPython) {
    $gptsovitsVenvReady = Test-IsolatedTtsVenvHealthy -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Engine 'gptsovits'
}

# Fully installed already (repo + models + isolated venv) -> instant idempotent exit.
if ((Test-Path (Join-Path $targetDir 'api_v2.py')) -and (Test-Path $sentinel) -and (Test-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'gptsovits' -Path $depsSentinel) -and $gptsovitsVenvReady -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'GPT-SoVITS repo + models + isolated venv already present' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    Write-Host "$SCRIPT_INDEX  Runtime: pycore launches api_v2.py (class C) under the isolated venv on demand; set GPTSOVITS_REF_AUDIO to a reference clip." -ForegroundColor Cyan
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}
# EXPLICIT opt-in only: cloning the multi-GB repo + building the isolated venv takes
# minutes, so run ONLY when the user asks (NOT via the default NEURAL_TTS batch). The
# build is now SAFE -- the old-transformers pin lands in the venv, never the main interp.
if (-not $doFull -and -not $Force -and -not (Test-Path -LiteralPath $depsSentinel)) {
    Write-Host "$SCRIPT_INDEX [i] opt-in only -> NOT installing. Pass -Full or GPTSOVITS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}

if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found; cannot install. Run Step8_InstallPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}
if (-not (Test-TtsEngineCompatible -PythonExe $enginePython -Engine 'gptsovits' -Prefix "$SCRIPT_INDEX ")) {
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
    return
}

$hasCuda = (Get-CudaRuntimePolicy).Enabled
Write-TtsOfficialEnv -PythonExe $resolvedPython -Engine gptsovits -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  models  : {0}" -f $modelsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  engine  : {0}" -f $enginePython) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  venv    : {0}" -f $(if ($gptsovitsVenvReady) { 'provisioned' } else { 'absent' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU -> GPU build + models' } else { 'CPU only -> CPU build' })) -ForegroundColor DarkGray

# 1) clone (idempotent: skip if the repo is already there) ---------------- #
if (Test-Path (Join-Path $targetDir 'api_v2.py')) {
    Write-Host "$SCRIPT_INDEX [OK] repo already present -> skipping clone." -ForegroundColor Green
} else {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) {
        Write-Host "$SCRIPT_INDEX [!] git not found; cannot clone GPT-SoVITS. Install git, then re-run." -ForegroundColor DarkYellow
        Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
        return
    }
    Write-Host ("$SCRIPT_INDEX [..] cloning {0} -> {1} (progress shown)" -f $REPO_URL, $targetDir) -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetDir) | Out-Null
    try { & git.exe clone --depth 1 --progress $REPO_URL $targetDir } catch {
        Write-Host ("$SCRIPT_INDEX [!] clone failed: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
        Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
        return
    }
}

# 2) isolated per-engine venv (Bucket B) + the system torch it reuses -- ONE-TIME via a
#    .deps_done sentinel + a venv-ready probe. GPT-SoVITS's requirements.txt pins an OLD
#    transformers that would clobber the shared Bucket-A pin, so it is installed INTO a
#    DEDICATED venv (isolated_venv.ensure_venv, --system-site-packages reuses the system
#    CUDA torch), NEVER the main interpreter. Self-repairing: ensure_venv re-runs an
#    import-health probe and repairs a broken venv. pycore launches api_v2.py under this
#    venv. See lifecycle doc §5/§7.
if ((Test-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'gptsovits' -Path $depsSentinel) -and $gptsovitsVenvReady -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'isolated venv already provisioned (.deps_done)' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
} else {
    # System CUDA torch the venv will REUSE (idempotent), plus the huggingface_hub the
    # weight downloader falls back to (install only when MISSING -- NEVER --upgrade).
    # Neither touches the shared transformers pin.
    Install-PycoreTorchStack -PythonExe $enginePython -Prefix "$SCRIPT_INDEX "
    if (-not (Test-PycorePythonModulePresent -PythonExe $enginePython -ModuleName 'huggingface_hub')) {
        try { & $enginePython -m pip install huggingface_hub } catch { }
    }
    $reqFile = Join-Path $targetDir 'requirements.txt'
    if (Test-Path $reqFile) {
        Write-Host "$SCRIPT_INDEX [..] building/verifying isolated gptsovits venv (ensure_venv -r requirements.txt; first build takes minutes) ..." -ForegroundColor Yellow
        $gptsovitsVenvReady = Invoke-IsolatedTtsVenvEnsure -PythonExe $resolvedPython -CoreNodeRoot $coreNodeRoot -Engine 'gptsovits' -PipPackages @('-r', $reqFile) -HealthImports 'import torch, transformers' -Force:$Force
    } else {
        Write-Host "$SCRIPT_INDEX [!] requirements.txt not found in the cloned repo; cannot build the isolated venv." -ForegroundColor DarkYellow
    }
    if ($gptsovitsVenvReady) {
        Set-TtsDependencyStamp -PythonExe $resolvedPython -Engine 'gptsovits' -Path $depsSentinel | Out-Null
        Write-Host "$SCRIPT_INDEX [OK] isolated gptsovits venv ready; main interpreter transformers pin left untouched (policy stamp written)." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] venv build incomplete; will retry next run (main interpreter untouched)." -ForegroundColor DarkYellow
    }
}

# 3) pretrained models from HuggingFace (IDEMPOTENT: sentinel + curl resume) #
if ((Test-Path $sentinel) -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'pretrained models sentinel present' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
} else {
    if (-not $env:GPTSOVITS_HF_ALLOW) {
        $tierAllow = Resolve-TtsModelTier -PythonExe $resolvedPython -Key gptsovits_hf_allow -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
        if ($tierAllow) {
            $env:GPTSOVITS_HF_ALLOW = $tierAllow
            Write-Host ("$SCRIPT_INDEX  models: {0} -> GPTSOVITS_HF_ALLOW={1}" -f $(if ($hasCuda) { 'GPU max' } else { 'CPU max' }), $tierAllow) -ForegroundColor Cyan
        }
    }
    Write-Host ("$SCRIPT_INDEX [..] downloading models {0} -> {1} (mirror bytes, resumable, live progress)" -f $HF_REPO, $modelsDir) -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null
    $allowPatterns = @('*')
    if ($env:GPTSOVITS_HF_ALLOW) {
        $allowPatterns = @($env:GPTSOVITS_HF_ALLOW -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    }
    $dlOk = Install-HfRepoFlat -RepoId $HF_REPO -DestDir $modelsDir -SentinelPath $sentinel -AllowPatterns $allowPatterns -Prefix "$SCRIPT_INDEX " -SentinelValue 'done'
    if ($dlOk -or (Test-Path $sentinel)) {
        Write-Host "$SCRIPT_INDEX [OK] pretrained models downloaded." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] model download not finished; will RESUME next run (finished files are NOT re-downloaded)." -ForegroundColor DarkYellow
    }
}

if (-not (Test-Path (Join-Path $targetDir 'api_v2.py')) -or -not $gptsovitsVenvReady -or -not (Test-Path -LiteralPath $sentinel)) {
    Write-Host "$SCRIPT_INDEX [!] GPT-SoVITS is not ready; incomplete components will retry next run." -ForegroundColor DarkYellow
    return
}

Write-Host "$SCRIPT_INDEX [OK] GPT-SoVITS ready ($targetDir)." -ForegroundColor Green
Write-Host "$SCRIPT_INDEX  Runtime: pycore launches api_v2.py (class C) under the isolated venv on demand; no manual start needed." -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX  Then set GPTSOVITS_REF_AUDIO (+ optional GPTSOVITS_PROMPT_TEXT/LANG) to a reference clip to enable the engine." -ForegroundColor Cyan
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @()
