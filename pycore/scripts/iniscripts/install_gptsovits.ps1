<#
.SYNOPSIS
    GPT-SoVITS TTS prerequisite (free voice cloning), auto-run by prepare.ps1
    (pyservice). Installs by default into a STAGING area under the code's data root
    and downloads the pretrained models — IDEMPOTENTLY (never re-clones or
    re-downloads what is already present). CPU-fallback: CUDA torch build when a GPU
    is present, else CPU.

.DESCRIPTION
    GPT-SoVITS is a multi-GB repo + HuggingFace models running an api server
    (api_v2.py, default 127.0.0.1:9880). pycore's gptsovits engine is an HTTP CLIENT
    to that server. This installer:
      1. clones RVC-Boss/GPT-SoVITS into <core_node>\.data\pycore\gptsovits  (the
         staging/data root; override with GPTSOVITS_DIR) — skipped if already cloned.
      2. installs torch (CUDA build on a GPU host, else CPU) + the repo requirements.
      3. downloads the pretrained models from HuggingFace lj1995/GPT-SoVITS into
         GPT_SoVITS\pretrained_models via huggingface_hub.snapshot_download
         (resumable, hash-verified, SKIPS files already present) — a
         .snapshot_done sentinel short-circuits a completed download.
    Everything is IDEMPOTENT: a reachable server, an existing repo, or the sentinel
    each skip their step, so re-runs never re-download. Download progress is shown.
    Best-effort: never fails the boot (always exit 0). Skip entirely with
    GPTSOVITS_SKIP=1. Repo: https://github.com/RVC-Boss/GPT-SoVITS

.PARAMETER Python
    python.exe for the deps + model download. Default: 'python' on PATH.
.PARAMETER Force
    Re-run the model snapshot even if the sentinel says it is complete.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Variable declarations (all at top)
$SCRIPT_INDEX   = '[install_gptsovits]'
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
$hasCuda        = $false
$reqFile        = $null
$dlScript       = $null

# Staging area = the code's data root (<core_node>\.data\pycore\gptsovits), matching
# the *_staging convention; falls back to the user cache if the root is unresolved.
try { $coreNodeRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path } catch { $coreNodeRoot = $null }
if ($coreNodeRoot) { $stagingDefault = Join-Path $coreNodeRoot '.data\pycore\gptsovits' }
else { $stagingDefault = Join-Path $env:USERPROFILE '.core_node\cache\tts\gptsovits' }
$targetDir = if ($env:GPTSOVITS_DIR) { $env:GPTSOVITS_DIR } else { $stagingDefault }
$modelsDir = Join-Path $targetDir 'GPT_SoVITS\pretrained_models'
$sentinel  = Join-Path $modelsDir '.snapshot_done'
$depsSentinel = Join-Path $targetDir '.deps_done'

function Resolve-PythonInterpreter {
    param([string]$Preferred = '')
    if ($Preferred -and (Test-Path $Preferred)) {
        try { $v = & $Preferred --version 2>&1; if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') { return $Preferred } } catch { }
    }
    foreach ($name in 'python', 'python3', 'py') {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd -and $cmd.Source -and $cmd.Source -notmatch 'WindowsApps') {
            try { $v = & $cmd.Source --version 2>&1; if ($LASTEXITCODE -eq 0 -and "$v" -match 'Python\s+3') { return $cmd.Source } } catch { }
        }
    }
    return $null
}

# GPU detection comes from the ONE shared helper (canonical: CUDADetector).
. (Join-Path $PSScriptRoot 'lib_gpu.ps1')   # provides Test-CudaPresent

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
    exit 0
}
if (Test-ServerUp -Url $serverUrl) {
    Write-Host "$SCRIPT_INDEX [OK] server reachable at $serverUrl -> nothing to do." -ForegroundColor Green
    Write-Host "$SCRIPT_INDEX      Set GPTSOVITS_REF_AUDIO to a reference clip to enable the engine." -ForegroundColor DarkGray
    exit 0
}
# Fully installed already (repo + models) -> instant idempotent exit, no re-pip.
if ((Test-Path (Join-Path $targetDir 'api_v2.py')) -and (Test-Path $sentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] GPT-SoVITS already installed (repo + models present) -> skipping." -ForegroundColor Green
    Write-Host ("$SCRIPT_INDEX  START:  cd `"{0}`"; python api_v2.py   (serves {1})" -f $targetDir, $serverUrl) -ForegroundColor Cyan
    Write-Host "$SCRIPT_INDEX  Then set GPTSOVITS_REF_AUDIO to a reference clip." -ForegroundColor DarkGray
    exit 0
}

$hasCuda = Test-CudaPresent
Write-Host ("$SCRIPT_INDEX  staging : {0}" -f $targetDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  models  : {0}" -f $modelsDir) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU -> GPU build + models' } else { 'CPU only -> CPU build' })) -ForegroundColor DarkGray

$resolvedPython = Resolve-PythonInterpreter -Preferred $Python
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found; cannot install. Run Step9_InstallPython first." -ForegroundColor DarkYellow
    exit 0
}

# 1) clone (idempotent: skip if the repo is already there) ---------------- #
if (Test-Path (Join-Path $targetDir 'api_v2.py')) {
    Write-Host "$SCRIPT_INDEX [OK] repo already present -> skipping clone." -ForegroundColor Green
} else {
    $git = Get-Command git -ErrorAction SilentlyContinue
    if (-not $git) {
        Write-Host "$SCRIPT_INDEX [!] git not found; cannot clone GPT-SoVITS. Install git, then re-run." -ForegroundColor DarkYellow
        exit 0
    }
    Write-Host ("$SCRIPT_INDEX [..] cloning {0} -> {1} (progress shown)" -f $REPO_URL, $targetDir) -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $targetDir) | Out-Null
    try { & git.exe clone --depth 1 --progress $REPO_URL $targetDir } catch {
        Write-Host ("$SCRIPT_INDEX [!] clone failed: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
        exit 0
    }
}

# 2) torch (CPU/GPU) + requirements -- ONE-TIME via a .deps_done sentinel.
# Re-running pip every boot caused a huggingface_hub upgrade<->downgrade ping-pong
# (the repo requirements pin transformers, which needs huggingface_hub<1.0) and
# repeatedly rebuilt native deps. Do it once; skip forever after.
if ((Test-Path $depsSentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] dependencies already installed (.deps_done) -> skipping pip." -ForegroundColor Green
} else {
    if ($hasCuda) {
        Write-Host "$SCRIPT_INDEX [..] ensuring torch (CUDA build) ..." -ForegroundColor Yellow
        try { & $resolvedPython -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124 } catch { }
    } else {
        Write-Host "$SCRIPT_INDEX [..] ensuring torch (CPU build) ..." -ForegroundColor Yellow
        try { & $resolvedPython -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu } catch { }
    }
    # huggingface_hub: snapshot_download works on the version the repo pins, so only
    # install when it is MISSING -- NEVER --upgrade (that breaks transformers).
    & $resolvedPython -c "import huggingface_hub" 2>$null
    if ($LASTEXITCODE -ne 0) {
        try { & $resolvedPython -m pip install huggingface_hub } catch { }
    }
    $reqFile = Join-Path $targetDir 'requirements.txt'
    if (Test-Path $reqFile) {
        Write-Host "$SCRIPT_INDEX [..] pip install -r requirements.txt (one-time) ..." -ForegroundColor Yellow
        try { & $resolvedPython -m pip install -r $reqFile } catch { Write-Host "$SCRIPT_INDEX [!] some requirements failed." -ForegroundColor DarkYellow }
    }
    Set-Content -Path $depsSentinel -Value (Get-Date -Format o) -Encoding utf8
    Write-Host "$SCRIPT_INDEX [OK] dependencies installed (.deps_done written; won't re-run)." -ForegroundColor Green
}

# 3) pretrained models from HuggingFace (IDEMPOTENT: sentinel + snapshot skip) #
if ((Test-Path $sentinel) -and -not $Force) {
    Write-Host "$SCRIPT_INDEX [OK] pretrained models already downloaded (sentinel present) -> skipping." -ForegroundColor Green
} else {
    # The HF byte CDN is often blocked (direct /resolve/ transfers 0 bytes); the
    # shared downloader lists files via the HF API but streams BYTES from the
    # hf-mirror.com mirror (proven to flow), resumable + idempotent + live progress.
    # Default = the v2 model set (~1.2GB) not all v2+v3+v4 (~5.3GB); override via
    # GPTSOVITS_HF_ALLOW ('*' = everything) and GPTSOVITS_MIRROR.
    # Per CPU/GPU principle: GPU -> the v4 set (largest/newest: s1v3 + gsv-v4-pretrained
    # + base encoders, ~2.4GB); CPU -> the v2 set (gsv-v2final + base, ~1.2GB, runs on
    # CPU). NOT all v2+v3+v4 (~5.3GB). A user-set GPTSOVITS_HF_ALLOW wins ('*' = all).
    if (-not $env:GPTSOVITS_HF_ALLOW) {
        if ($hasCuda) {
            $env:GPTSOVITS_HF_ALLOW = 'chinese-hubert-base/*,chinese-roberta-wwm-ext-large/*,s1v3.ckpt,gsv-v4-pretrained/*'
            Write-Host "$SCRIPT_INDEX  models: GPU -> v4 set (largest: s1v3 + gsv-v4-pretrained + base encoders)" -ForegroundColor Cyan
        } else {
            $env:GPTSOVITS_HF_ALLOW = 'chinese-hubert-base/*,chinese-roberta-wwm-ext-large/*,gsv-v2final-pretrained/*'
            Write-Host "$SCRIPT_INDEX  models: CPU -> v2 set (gsv-v2final-pretrained + base encoders)" -ForegroundColor Cyan
        }
    }
    Write-Host ("$SCRIPT_INDEX [..] downloading models {0} -> {1} (mirror bytes, resumable, live progress)" -f $HF_REPO, $modelsDir) -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $modelsDir | Out-Null
    $dlScript = Join-Path $PSScriptRoot 'gptsovits_dl.py'
    try { & $resolvedPython $dlScript $HF_REPO $modelsDir $sentinel } catch { }
    if (Test-Path $sentinel) {
        Write-Host "$SCRIPT_INDEX [OK] pretrained models downloaded." -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX [!] model download not finished; will RESUME next run (finished files are NOT re-downloaded)." -ForegroundColor DarkYellow
    }
}

Write-Host "$SCRIPT_INDEX [OK] GPT-SoVITS ready ($targetDir)." -ForegroundColor Green
$gpuFlag = if ($hasCuda) { '' } else { ' (CPU: slower)' }
Write-Host ("$SCRIPT_INDEX  START the server{0}:  cd `"{1}`"; python api_v2.py   (serves {2})" -f $gpuFlag, $targetDir, $serverUrl) -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX  Then set GPTSOVITS_REF_AUDIO (+ optional GPTSOVITS_PROMPT_TEXT/LANG) to a reference clip." -ForegroundColor Cyan
exit 0
