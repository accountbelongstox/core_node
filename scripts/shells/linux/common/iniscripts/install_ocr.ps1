<#
.SYNOPSIS
    Prerequisite installer for the local OCR engines (Windows).

.DESCRIPTION
    Run by prepare.ps1 before the Pycore service launches. Sets up the LOCAL OCR
    engines used by the voice-subtitle screenshot pipeline, in the project's
    priority order:

        1. windows  - Windows.Media.Ocr (WinRT). Installs the winrt-* packages
                      listed in pycore\pyfoundations\third_party.py
                      (WINDOWS_OCR_WINRT_PACKAGES). Native, offline, no GPU.
        2. easyocr  - torch/GPU OCR (high accuracy; torch is already present).

    CnOCR (the third engine) is installed/loaded lazily by third_party.py
    (get_third_package_cnocr -> cnocr[ort-cpu|ort-gpu]) and ships in this env, so
    it is not handled here.

    Why a shell script and not third_party.py? These are heavier / Windows-only
    packages that are better installed explicitly and idempotently up front, so
    the first screenshot does not stall on a pip install. The orchestrator
    (pycore.pyutils.ocr.ocr_orchestrator) degrades gracefully when an engine is
    absent — this script just makes the higher-priority engines available.

    IDEMPOTENT: each engine is skipped when its package already imports.

.PARAMETER Python
    Path to the python.exe to install into. Default: 'python' on PATH.

.PARAMETER Force
    Reinstall even if the packages already import.
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# WinRT projection packages for Windows.Media.Ocr — keep in sync with
# WINDOWS_OCR_WINRT_PACKAGES in pycore\pyfoundations\third_party.py.
$WinrtOcrPackages = @(
    'winrt-Windows.Foundation',
    'winrt-Windows.Foundation.Collections',
    'winrt-Windows.Media.Ocr',
    'winrt-Windows.Graphics.Imaging',
    'winrt-Windows.Storage.Streams',
    'winrt-Windows.Globalization'
)

function Test-PyModule {
    param([string]$Py, [string]$Module)
    # find_spec() RAISES (not returns None) for a dotted name whose parent is
    # absent, e.g. 'winrt.windows.media.ocr' when winrt is not installed. The
    # traceback on stderr would become a NativeCommandError under -EA Stop, so we
    # swallow it inside Python and signal purely via the exit code.
    $code = "import importlib.util, sys`ntry:`n    ok = importlib.util.find_spec('$Module') is not None`nexcept Exception:`n    ok = False`nsys.exit(0 if ok else 1)"
    & $Py -c $code 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Invoke-Pip {
    # Run a pip install tolerant of native stderr under -EA Stop; return success.
    param([string]$Py, [string[]]$PipArgs)
    try {
        & $Py -m pip install @PipArgs
        return ($LASTEXITCODE -eq 0)
    } catch {
        Write-Host ("[!] pip threw: {0}" -f $_.Exception.Message) -ForegroundColor DarkYellow
        return $false
    }
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' Installing local OCR engines (windows-native, easyocr)' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ("  python : {0}" -f $Python) -ForegroundColor DarkGray

# A "give up after one failed attempt" marker so an OPTIONAL engine that cannot
# install (e.g. easyocr fighting a locked cv2.pyd) does not retry on every boot.
# -Force clears it and retries.
$easyocrSkip = Join-Path $env:USERPROFILE '.core_node\cache\ocr\.easyocr_skip'

# --- 1) Windows native OCR (WinRT projections) --------------------------- #
# NO --upgrade: when the module already imports we skip; on first install pip
# installs the missing projections without touching satisfied packages (so it
# never tries to overwrite an in-use DLL).
if ((Test-PyModule -Py $Python -Module 'winrt.windows.media.ocr') -and -not $Force) {
    Write-Host '[OK] Windows OCR (WinRT) already importable; skipping.' -ForegroundColor Green
} else {
    Write-Host ("[..] pip install {0} ..." -f ($WinrtOcrPackages -join ' ')) -ForegroundColor Yellow
    $ok = Invoke-Pip -Py $Python -PipArgs $WinrtOcrPackages
    if (-not $ok) {
        Write-Host '[!] WinRT OCR package install failed; the orchestrator will fall back to easyocr/cnocr/ai-vision.' -ForegroundColor DarkYellow
    } elseif (Test-PyModule -Py $Python -Module 'winrt.windows.media.ocr') {
        Write-Host '[OK] Windows OCR (WinRT) installed.' -ForegroundColor Green
    } else {
        Write-Host '[!] WinRT OCR still not importable after install; will fall back at run time.' -ForegroundColor DarkYellow
    }
}

# --- 2) EasyOCR (optional; Windows OCR + cnocr already cover OCR) --------- #
# NO --upgrade: --upgrade pulls a fresh opencv and tries to overwrite the locked
# cv2.pyd ("[WinError 5] Access is denied") of the running process. Plain install
# leaves a satisfied opencv untouched. If it still cannot install, drop a skip
# marker so we do not retry+fail on every startup.
if ((Test-PyModule -Py $Python -Module 'easyocr') -and -not $Force) {
    Write-Host '[OK] easyocr already installed; skipping.' -ForegroundColor Green
    if (Test-Path $easyocrSkip) { Remove-Item -Force $easyocrSkip -ErrorAction SilentlyContinue }
} elseif ((Test-Path $easyocrSkip) -and -not $Force) {
    Write-Host '[skip] easyocr was already attempted and failed (cnocr/windows cover OCR). Run with -Force to retry.' -ForegroundColor DarkGray
} else {
    Write-Host '[..] pip install easyocr ...' -ForegroundColor Yellow
    $ok = Invoke-Pip -Py $Python -PipArgs @('easyocr')
    if ($ok -and (Test-PyModule -Py $Python -Module 'easyocr')) {
        Write-Host '[OK] easyocr installed.' -ForegroundColor Green
        if (Test-Path $easyocrSkip) { Remove-Item -Force $easyocrSkip -ErrorAction SilentlyContinue }
    } else {
        New-Item -ItemType Directory -Force -Path (Split-Path $easyocrSkip -Parent) | Out-Null
        Set-Content -Path $easyocrSkip -Value 'easyocr install failed (likely locked cv2.pyd); skipped on subsequent boots. Delete this file or use -Force to retry.' -Encoding utf8
        Write-Host '[!] easyocr install failed (likely a locked cv2.pyd); marked to skip future boots. Windows/cnocr OCR still work.' -ForegroundColor DarkYellow
    }
}

# Non-fatal by design: a degraded OCR set still lets the service run (cnocr +
# ai-vision remain). Always exit 0 so prepare.ps1 continues to launch.
exit 0
