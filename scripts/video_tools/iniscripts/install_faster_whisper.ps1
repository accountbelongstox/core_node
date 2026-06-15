<#
.SYNOPSIS
    Dedicated installer for faster-whisper (+ optional NVIDIA GPU runtime libs).

.DESCRIPTION
    Called by ..\extract_audio.ps1 when faster-whisper is missing. Follows the
    official instructions (https://github.com/SYSTRAN/faster-whisper):

        pip install faster-whisper
        (GPU) pip install nvidia-cublas-cu12 nvidia-cudnn-cu12==9.*

    Python 3.9+ is required. ffmpeg is NOT needed (PyAV handles decoding).
    The import is verified afterwards and the GPU DLL directories are reported
    (on Windows ctranslate2 must find cuBLAS/cuDNN on the DLL search path).

.PARAMETER Python
    Path to the python.exe to install into. Default: 'python' on PATH.

.PARAMETER Gpu
    Also install the CUDA 12 / cuDNN 9 runtime libs for GPU inference.

.PARAMETER Master
    Install the latest master build instead of the PyPI release.

.PARAMETER Model
    If set (and not 'auto'), also pre-download this whisper model from Hugging Face
    so the Python worker can use it directly (no first-run download). Progress is
    polled and printed by this script. Skipped if already fully cached.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Gpu,
    [switch]$Master,
    [string]$Model = ''          # if set, also pre-download this whisper model
)

$ErrorActionPreference = 'Stop'

function Test-PyModule {
    param([string]$Py, [string]$Module)
    & $Py -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$Module') else 1)" 2>$null
    return ($LASTEXITCODE -eq 0)
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' Installing faster-whisper (speech-to-text)' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ("  python : {0}" -f $Python)                        -ForegroundColor DarkGray
Write-Host ("  gpu    : {0}" -f $(if ($Gpu) { 'yes' } else { 'no' })) -ForegroundColor DarkGray

# --- 1) faster-whisper --------------------------------------------------- #
if ($Master) {
    $src = 'faster-whisper @ https://github.com/SYSTRAN/faster-whisper/archive/refs/heads/master.tar.gz'
    Write-Host '[..] pip install (master) faster-whisper ...' -ForegroundColor Yellow
    & $Python -m pip install --upgrade --force-reinstall $src
} else {
    Write-Host '[..] pip install faster-whisper ...' -ForegroundColor Yellow
    & $Python -m pip install --upgrade faster-whisper
}
if ($LASTEXITCODE -ne 0) {
    Write-Host '[X] faster-whisper install failed.' -ForegroundColor Red
    exit 1
}

# --- 2) GPU runtime libs (CUDA 12 + cuDNN 9) ----------------------------- #
# NOTE: no --upgrade here on purpose. cuDNN/cuBLAS wheels are ~700 MB; if a
# compatible version is already installed, pip reports "already satisfied" and
# downloads nothing. --upgrade would force a huge, pointless re-download.
if ($Gpu) {
    Write-Host '[..] pip install nvidia-cublas-cu12 nvidia-cudnn-cu12==9.* (skipped if already present) ...' -ForegroundColor Yellow
    & $Python -m pip install 'nvidia-cublas-cu12' 'nvidia-cudnn-cu12==9.*'
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[!] GPU lib install failed; whisper will fall back to CPU (int8).' -ForegroundColor DarkYellow
    } else {
        # The worker adds nvidia\cublas\bin + nvidia\cudnn\bin to the DLL search
        # path automatically at runtime (os.add_dll_directory), so nothing else
        # is needed here on Windows.
        Write-Host '[OK] GPU runtime libs present.' -ForegroundColor Green
    }
}

# --- 3) verify package --------------------------------------------------- #
if (-not (Test-PyModule -Py $Python -Module 'faster_whisper')) {
    Write-Host '[X] faster-whisper still not importable after install.' -ForegroundColor Red
    exit 1
}
$ver = & $Python -c "import faster_whisper as f; print(getattr(f, '__version__', '?'))"
Write-Host ("[OK] faster-whisper installed (version {0})." -f $ver) -ForegroundColor Green

# --- 4) pre-download the model (so the Python worker just uses it) -------- #
# Done via a dedicated helper invoked with simple args (avoids PowerShell's
# native-arg quoting issues with inline `python -c`). The helper prints live
# MB progress itself.
if ($Model -and $Model -ne 'auto') {
    $dlHelper = Join-Path $PSScriptRoot '..\py_video_tools\download_model.py'
    Write-Host ("[..] Ensuring whisper model '{0}' is downloaded ..." -f $Model) -ForegroundColor Yellow
    & $Python -u $dlHelper $Model
    if ($LASTEXITCODE -eq 0) {
        Write-Host ("[OK] model '{0}' is ready." -f $Model) -ForegroundColor Green
    } else {
        Write-Host ("[!] model download did not complete (exit {0}); the worker will retry at run time." -f $LASTEXITCODE) -ForegroundColor DarkYellow
    }
}

exit 0
