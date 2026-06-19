<#
.SYNOPSIS
    MeloTTS offline TTS prerequisite (free, zh/en mixed), auto-run by prepare.ps1
    (pyservice). CPU-fallback principle: CPU torch + the core models on a CPU host,
    the CUDA torch build + the full multi-language model set when CUDA is present.

.DESCRIPTION
    MeloTTS is a FREE git-installed package (myshell-ai/MeloTTS) whose per-language
    models auto-download from HuggingFace on first use. It pins transformers==4.27.4,
    which can DOWNGRADE the shared env (google-genai etc.) and break other AI paths —
    so, like GPT-SoVITS, the heavy install is OPT-IN and never ambushes a boot:
      * default              -> STATUS only: report whether `melo` is importable.
      * -Full or env
        MELOTTS_INSTALL=1    -> install torch (CUDA build if a GPU is present, else
                                CPU) + MeloTTS + unidic-lite, then PRE-DOWNLOAD the
                                models (CUDA: EN,ZH,JP,KR,ES,FR — the full set;
                                CPU: EN,ZH) so first synth is instant and offline.
    Idempotent + best-effort: never fails the boot (always exit 0). The pycore
    melotts engine selects cuda:0 automatically when torch sees a GPU.

.PARAMETER Python
    python.exe to install into. Default: 'python' on PATH.
.PARAMETER Full
    Perform the heavy install (otherwise status-only).
.PARAMETER Force
    Reinstall / re-warm even if `melo` is already present.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Full,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Variable declarations (all at top)
$SCRIPT_INDEX   = '[install_melotts]'
$resolvedPython = $null
$doFull         = ($Full -or $env:MELOTTS_INSTALL -eq '1')
$hasCuda        = $false
$device         = 'cpu'
$langs          = $null
$warmScript     = $null
$melodPresent   = $false

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

function Test-PyModule {
    param([string]$Py, [string]$ModuleName)
    & $Py -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$ModuleName') else 1)" 2>$null
    return ($LASTEXITCODE -eq 0)
}

# GPU detection comes from the ONE shared helper (canonical: CUDADetector).
. (Join-Path $PSScriptRoot 'lib_gpu.ps1')   # provides Test-CudaPresent

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host " $SCRIPT_INDEX MeloTTS (free offline zh/en TTS)" -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan

$resolvedPython = Resolve-PythonInterpreter -Preferred $Python
if (-not $resolvedPython) {
    Write-Host "$SCRIPT_INDEX [!] Python 3 not found. Run Step9_InstallPython first, or pass -Python <path>." -ForegroundColor DarkYellow
    exit 0
}
if ($env:MELOTTS_SKIP -eq '1') {
    Write-Host "$SCRIPT_INDEX [i] MELOTTS_SKIP=1 -> skipping." -ForegroundColor DarkGray
    exit 0
}
$melodPresent = Test-PyModule -Py $resolvedPython -ModuleName 'melo'
$hasCuda = Test-CudaPresent
$device = if ($hasCuda) { 'cuda:0' } else { 'cpu' }
$langs  = if ($hasCuda) { 'EN,ZH,JP,KR,ES,FR' } else { 'EN,ZH' }

Write-Host ("$SCRIPT_INDEX  python  : {0}" -f $resolvedPython) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  melo    : {0}" -f $(if ($melodPresent) { 'installed' } else { 'absent' })) -ForegroundColor DarkGray
Write-Host ("$SCRIPT_INDEX  compute : {0}" -f $(if ($hasCuda) { 'CUDA GPU -> GPU build + full model set' } else { 'CPU only -> CPU build + EN/ZH' })) -ForegroundColor DarkGray
# Installs by default (idempotent: skipped when `melo` is already importable).
# transformers==4.27.4 pin warning is printed before the pip step below. Skip the
# whole engine with MELOTTS_SKIP=1 if it conflicts with your shared AI env.
if (-not $melodPresent) {
    Write-Host "$SCRIPT_INDEX [!] NOTE: MeloTTS pins transformers==4.27.4 - may downgrade the shared AI env. Set MELOTTS_SKIP=1 to opt out." -ForegroundColor DarkYellow
}

# --- Heavy install (opt-in) --------------------------------------------- #
if (-not $melodPresent -or $Force) {
    if ($hasCuda) {
        Write-Host "$SCRIPT_INDEX [..] installing torch (CUDA build) ..." -ForegroundColor Yellow
        try { & $resolvedPython -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu124 } catch { }
    } else {
        Write-Host "$SCRIPT_INDEX [..] installing torch (CPU build) ..." -ForegroundColor Yellow
        try { & $resolvedPython -m pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu } catch { }
    }
    Write-Host "$SCRIPT_INDEX [..] pip install unidic-lite + MeloTTS (git) ..." -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX [!] MeloTTS pins transformers==4.27.4 which may downgrade the shared env." -ForegroundColor DarkYellow
    try { & $resolvedPython -m pip install unidic-lite } catch { }
    try { & $resolvedPython -m pip install 'git+https://github.com/myshell-ai/MeloTTS.git' } catch { }
    $melodPresent = Test-PyModule -Py $resolvedPython -ModuleName 'melo'
    if ($melodPresent) { Write-Host "$SCRIPT_INDEX [OK] MeloTTS installed." -ForegroundColor Green }
    else { Write-Host "$SCRIPT_INDEX [!] MeloTTS not importable after install." -ForegroundColor DarkYellow; exit 0 }
}

# --- Pre-download the language models (CUDA: full set; CPU: EN/ZH) ------- #
Write-Host ("$SCRIPT_INDEX [..] pre-downloading models [{0}] on {1} (first-use cache) ..." -f $langs, $device) -ForegroundColor Yellow
$warmScript = Join-Path $env:TEMP 'melotts_warm.py'
@'
import sys
from melo.api import TTS
langs = sys.argv[1].split(",")
device = sys.argv[2]
for lang in langs:
    try:
        TTS(language=lang, device=device)
        print("  [warmed]", lang)
    except Exception as e:
        print("  [skip]", lang, "-", e)
'@ | Set-Content -Path $warmScript -Encoding utf8
try { & $resolvedPython $warmScript $langs $device } catch {
    Write-Host "$SCRIPT_INDEX [!] model pre-download incomplete (models still download lazily on first synth)." -ForegroundColor DarkYellow
}
Remove-Item -Path $warmScript -ErrorAction SilentlyContinue

Write-Host "$SCRIPT_INDEX [OK] MeloTTS ready (free, offline). pycore selects cuda:0 automatically when a GPU is present." -ForegroundColor Green
exit 0
