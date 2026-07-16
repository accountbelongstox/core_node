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
      2. installs torch (CUDA build on a GPU host, else CPU) + the repo requirements.
      3. downloads the pretrained models from HuggingFace lj1995/GPT-SoVITS into
         GPT_SoVITS\pretrained_models via curl mirror download (resumable,
         hash-verified, SKIPS files already present) — a
         .snapshot_done sentinel short-circuits a completed download.
    Everything is IDEMPOTENT: a reachable server, an existing repo, or the sentinel
    each skip their step, so re-runs never re-download. Download progress is shown.
    Best-effort: never fails the boot (always exit 0). Skip entirely with
    GPTSOVITS_SKIP=1. Repo: https://github.com/RVC-Boss/GPT-SoVITS

.PARAMETER Python
    python.exe for the deps + model download. Default: 'python' on PATH.
.PARAMETER Full
    Perform clone, pip, and model download. Also enabled by GPTSOVITS_INSTALL=1 or NEURAL_TTS_INSTALL=1.
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
$stagingDefault = $null
$targetDir      = $null
$modelsDir      = $null
$sentinel       = $null
$depsSentinel   = $null
$resolvedPython = $null
$hasCuda        = $false
$reqFile        = $null
$doFull         = ($Full -or $env:GPTSOVITS_INSTALL -eq '1' -or $env:NEURAL_TTS_INSTALL -eq '1')

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'GlobalVars.ps1')

# Staging area = PYCORE_LOCAL_DATA_DIR (D:\www\cache\pycore\gptsovits); override with GPTSOVITS_DIR.
$stagingDefault = Get-PycoreLocalDataSubDir -SubDir 'gptsovits'
$targetDir = if ($env:GPTSOVITS_DIR) { $env:GPTSOVITS_DIR } else { $stagingDefault }
$modelsDir = Join-Path $targetDir 'GPT_SoVITS\pretrained_models'
$sentinel  = Join-Path $modelsDir '.snapshot_done'
$depsSentinel = Join-Path $targetDir '.deps_done'

# GPU detection comes from the ONE shared helper (canonical: CUDADetector).
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

function Test-ServerUp {
    param([string]$Url)
    try { $r = Invoke-WebRequest -Uri "$Url/" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop; return ($r.StatusCode -lt 500) }
    catch { if ($_.Exception.Response) { return $true } return $false }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX GPT-SoVITS TTS (free voice-clone server)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

if ($env:GPTSOVITS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] GPTSOVITS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
}
if (Test-ServerUp -Url $serverUrl) {
    Write-Host "$SCRIPT_INDEX [OK] server reachable at $serverUrl -> nothing to do." -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX      Set GPTSOVITS_REF_AUDIO to a reference clip to enable the engine." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
}
# Fully installed already (repo + models) -> instant idempotent exit, no re-pip.
if ((Test-Path (Join-Path $targetDir 'api_v2.py')) -and (Test-Path $sentinel) -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $Python -Reason 'GPT-SoVITS repo + models already present' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
    Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python api_v2.py   (serves {1})" -f $targetDir, $serverUrl) -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX  Then set GPTSOVITS_REF_AUDIO to a reference clip." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
}
# Opt-in: clone + pip pins an old transformers; install only when explicitly requested.
if (-not $doFull -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [i] opt-in only -> NOT installing. Pass -Full, GPTSOVITS_INSTALL=1, or NEURAL_TTS_INSTALL=1." -ForegroundColor DarkGray
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
}

$hasCuda = Test-CudaPresent
Write-TtsOfficialEnv -PythonExe $Python -Engine gptsovits -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  models  : {0}" -f $modelsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU -> GPU build + models' } else { 'CPU only -> CPU build' })) -ForegroundColor DarkGray

$resolvedPython = $Global:PYTHON_EXE_PATH
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found; cannot install. Run Step8_InstallPython first." -ForegroundColor DarkYellow
    Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
}

# 1) clone (idempotent: skip if the repo is already there) ---------------- #
if (Test-Path (Join-Path $targetDir 'api_v2.py')) {
    Write-Host "$SCRIPT_INDEX [OK] repo already present -> skipping clone." -ForegroundColor Green
} else {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) {
        Write-Host "$SCRIPT_INDEX [!] git not found; cannot clone GPT-SoVITS. Install git, then re-run." -ForegroundColor DarkYellow
        Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
    }
    Write-Host ("$SCRIPT_INDEX [..] cloning {0} -> {1} (progress shown)" -f $REPO_URL, $targetDir) -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetDir) | Out-Null
    try { & git.exe clone --depth 1 --progress $REPO_URL $targetDir } catch {
        Write-Host ("$SCRIPT_INDEX [!] clone failed: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
        Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
    }
}

# 2) torch (CPU/GPU) + requirements -- ONE-TIME via a .deps_done sentinel.
# Re-running pip every boot caused a huggingface_hub upgrade<->downgrade ping-pong
# (the repo requirements pin transformers, which needs huggingface_hub<1.0) and
# repeatedly rebuilt native deps. Do it once; skip forever after.
if ((Test-Path $depsSentinel) -and -not $Force) {
    Write-TtsIdempotentSkip -PythonExe $resolvedPython -Reason 'dependencies already installed (.deps_done)' -InstallScriptRoot $PSScriptRoot -Prefix $SCRIPT_INDEX
} else {
    Install-PycoreTorchStack -PythonExe $resolvedPython -Prefix "$SCRIPT_INDEX "
    # huggingface_hub: snapshot_download works on the version the repo pins, so only
    # install when it is MISSING -- NEVER --upgrade (that breaks transformers).
    if (-not (Test-PycorePythonModulePresent -PythonExe $resolvedPython -ModuleName 'huggingface_hub')) {
        try { & $Global:PIP_EXE_PATH install huggingface_hub } catch { }
    }
    $reqFile = Join-Path $targetDir 'requirements.txt'
    if (Test-Path $reqFile) {
        Write-Host "$SCRIPT_INDEX [..] pip install -r requirements.txt (one-time) ..." -ForegroundColor Yellow
        try { & $Global:PIP_EXE_PATH install -r $reqFile } catch { Write-Host "$SCRIPT_INDEX [!] some requirements failed." -ForegroundColor DarkYellow }
    }
    Set-Content -Path $depsSentinel -Value (Get-Date -Format o) -Encoding utf8
    Write-Host "$SCRIPT_INDEX [OK] dependencies installed (.deps_done written; won't re-run)." -ForegroundColor Green
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

Write-Host "$SCRIPT_INDEX [OK] GPT-SoVITS ready ($targetDir)." -ForegroundColor Green
$gpuFlag = if ($hasCuda) { '' } else { ' (CPU: slower)' }
Write-Host ("$SCRIPT_INDEX  START the server{0}:  cd `"{1}`"; python api_v2.py   (serves {2})" -f $gpuFlag, $targetDir, $serverUrl) -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX  Then set GPTSOVITS_REF_AUDIO (+ optional GPTSOVITS_PROMPT_TEXT/LANG) to a reference clip." -ForegroundColor Cyan
Complete-PrereqStep -PythonExe $resolvedPython -Prefix $SCRIPT_INDEX -ImportModules @('torch')
