<#
.SYNOPSIS
    Dedicated prerequisite installer for OpenAI Whisper (speech-to-text).

.DESCRIPTION
    Run by prepare.ps1 before the Pycore service launches. Installs the
    `openai-whisper` package (the import name is `whisper`, mapped in
    pycore\pyfoundations\third_party.py as "whisper": "openai-whisper") and,
    optionally, pre-downloads a model so the first transcription does not stall
    on a download.

    Why a shell script instead of third_party.py? Whisper pulls in torch and a
    model file (tens of MB to ~3 GB), and benefits from being installed/verified
    explicitly and idempotently from the shell. third_party.py keeps fast-detecting
    the lighter packages; this covers the heavy one.

    This script is IDEMPOTENT: if `whisper` already imports it skips the pip step,
    and model download is skipped when the model is already cached.

    NOTE: whisper needs the `ffmpeg` executable on PATH at run time (it shells out
    to ffmpeg to decode audio). This script only checks for it and warns; it does
    not install ffmpeg (use winget/scoop/choco: e.g. `winget install Gyan.FFmpeg`).

.PARAMETER Python
    Path to the python.exe to install into. Default: 'python' on PATH.

.PARAMETER Model
    If set, also pre-download this whisper model (tiny/base/small/medium/large-v3
    /turbo, plus the .en variants). Skipped if already cached.

.PARAMETER Force
    Reinstall openai-whisper even if it already imports, AND bypass the
    system-capacity guard (install even on an undersized machine).
#>
[CmdletBinding()]
param(
    [string]$Python = 'python',
    [string]$Model  = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

# Minimum system capacity to bother installing whisper on. -Force overrides.
$MinRamGB      = 1        # skip if total physical RAM is below this
$MinFreeDiskGB = 100      # skip if total FREE space across all fixed drives is below this

function Test-PyModule {
    param([string]$Py, [string]$Module)
    & $Py -c "import importlib.util,sys; sys.exit(0 if importlib.util.find_spec('$Module') else 1)" 2>$null
    return ($LASTEXITCODE -eq 0)
}

Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ' Installing openai-whisper (speech-to-text)' -ForegroundColor Cyan
Write-Host '============================================================' -ForegroundColor Cyan
Write-Host ("  python : {0}" -f $Python) -ForegroundColor DarkGray

# --- 0) system-capacity guard ------------------------------------------- #
# whisper (with torch + model files) is not worth installing on a tiny machine.
# Skip if total RAM < $MinRamGB GB OR total FREE disk across all fixed drives
# < $MinFreeDiskGB GB. Metrics that cannot be read are treated as "unknown" and
# do NOT trigger a skip. -Force bypasses the whole guard.
try {
    $ramGB = [math]::Round((Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop).TotalPhysicalMemory / 1GB, 2)
} catch { $ramGB = $null }
try {
    $freeGB = [math]::Round((Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3' -ErrorAction Stop |
                             Measure-Object -Property FreeSpace -Sum).Sum / 1GB, 2)
} catch { $freeGB = $null }

Write-Host ("  ram    : {0} GB"                       -f $(if ($null -ne $ramGB)  { $ramGB }  else { '?' })) -ForegroundColor DarkGray
Write-Host ("  disk   : {0} GB free (all fixed drives)" -f $(if ($null -ne $freeGB) { $freeGB } else { '?' })) -ForegroundColor DarkGray

if (-not $Force) {
    $reasons = @()
    if ($null -ne $ramGB  -and $ramGB  -lt $MinRamGB)      { $reasons += ("RAM {0} GB < {1} GB" -f $ramGB, $MinRamGB) }
    if ($null -ne $freeGB -and $freeGB -lt $MinFreeDiskGB) { $reasons += ("free disk {0} GB < {1} GB" -f $freeGB, $MinFreeDiskGB) }
    if ($reasons.Count -gt 0) {
        Write-Host ("[skip] System too small for whisper ({0}); skipping install. Use -Force to override." -f ($reasons -join '; ')) -ForegroundColor DarkYellow
        exit 0
    }
}

# --- 1) openai-whisper --------------------------------------------------- #
if ((Test-PyModule -Py $Python -Module 'whisper') -and -not $Force) {
    $ver = & $Python -c "import whisper; print(getattr(whisper,'__version__','?'))" 2>$null
    Write-Host ("[OK] whisper already installed (version {0}); skipping pip." -f $ver) -ForegroundColor Green
} else {
    Write-Host '[..] pip install --upgrade openai-whisper ...' -ForegroundColor Yellow
    & $Python -m pip install --upgrade openai-whisper
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[X] openai-whisper install failed.' -ForegroundColor Red
        exit 1
    }
    if (-not (Test-PyModule -Py $Python -Module 'whisper')) {
        Write-Host '[X] whisper still not importable after install.' -ForegroundColor Red
        exit 1
    }
    $ver = & $Python -c "import whisper; print(getattr(whisper,'__version__','?'))" 2>$null
    Write-Host ("[OK] openai-whisper installed (version {0})." -f $ver) -ForegroundColor Green
}

# --- 2) ffmpeg presence check (runtime dependency, not installed here) ---- #
if (Get-Command ffmpeg -ErrorAction SilentlyContinue) {
    Write-Host '[OK] ffmpeg found on PATH.' -ForegroundColor Green
} else {
    Write-Host '[!] ffmpeg NOT on PATH - whisper needs it to decode audio at run time.' -ForegroundColor DarkYellow
    Write-Host '    Install it later, e.g.: winget install Gyan.FFmpeg  /  scoop install ffmpeg' -ForegroundColor DarkYellow
}

# --- 3) optional model pre-download -------------------------------------- #
# Done via a dedicated helper so we avoid PowerShell's native-arg quoting issues
# with inline `python -c`. The helper prints status and is a no-op if cached.
if ($Model) {
    $dlHelper = Join-Path $PSScriptRoot 'download_whisper_model.py'
    Write-Host ("[..] Ensuring whisper model '{0}' is downloaded ..." -f $Model) -ForegroundColor Yellow
    & $Python -u $dlHelper $Model
    if ($LASTEXITCODE -eq 0) {
        Write-Host ("[OK] model '{0}' is ready." -f $Model) -ForegroundColor Green
    } else {
        Write-Host ("[!] model download did not complete (exit {0}); whisper will fetch it on first use." -f $LASTEXITCODE) -ForegroundColor DarkYellow
    }
}

exit 0
