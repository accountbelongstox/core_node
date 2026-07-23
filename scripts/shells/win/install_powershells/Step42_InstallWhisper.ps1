<#
.SYNOPSIS
    Dedicated prerequisite installer for OpenAI Whisper (speech-to-text).

.DESCRIPTION
    Run by PreparePycorePrerequisites.ps1 before the Pycore service launches. Installs the
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

$winCommonDir = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')
. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'PythonRuntimeCommon.ps1')

$SCRIPT_INDEX = '[Step42-Whisper]'
$Python = $Global:PYTHON_EXE_PATH

# Minimum system capacity to bother installing whisper on. -Force overrides.
$MinRamGB      = 1        # skip if total physical RAM is below this
$MinFreeDiskGB = 100      # skip if total FREE space across all fixed drives is below this

function Test-PyModule {
    param([string]$Py, [string]$Module)
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $out = (& $Py -c "import importlib.util; print('__FOUND__' if importlib.util.find_spec('$Module') else '__MISSING__')" 2>$null) -join ''
    $ErrorActionPreference = $prevEap
    return ($out -match '__FOUND__')
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
        Complete-PrereqStep -PythonExe $Python -Prefix $SCRIPT_INDEX -ImportModules @('whisper') -AbsentOk -AbsentNote 'resource policy'
    }
}

# --- 1) openai-whisper --------------------------------------------------- #
if ((Test-PyModule -Py $Python -Module 'whisper') -and -not $Force) {
    $ver = & $Python -c "import whisper; print(getattr(whisper,'__version__','?'))" 2>$null
    Write-TtsIdempotentSkip -PythonExe $Python -Reason "whisper already installed (version $ver)" -InstallScriptRoot $PSScriptRoot
} else {
    Write-Host '[..] pip install --upgrade openai-whisper ...' -ForegroundColor Yellow
    & $Global:PIP_EXE_PATH install --upgrade openai-whisper
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

# --- 3) model pre-download (GPU large-v3 / CPU medium when -Model omitted) - #
$hasCuda = Test-CudaPresent
Write-TtsOfficialEnv -PythonExe $Python -Engine whisper -InstallScriptRoot $PSScriptRoot
if (-not $Model) {
    $Model = Resolve-TtsModelTier -PythonExe $Python -Key whisper_model -InstallScriptRoot $PSScriptRoot -Gpu:($hasCuda)
    if ($Model) {
        Write-Host ("[..] auto model tier ({0}): '{1}'" -f $(if ($hasCuda) { 'GPU' } else { 'CPU' }), $Model) -ForegroundColor Cyan
    }
}
if ($Model) {
    $cacheDir = if ($env:WHISPER_CACHE_DIR) { $env:WHISPER_CACHE_DIR } else { Join-Path $Global:CORE_NODE_CACHE_DIR 'whisper' }
    Write-Host ("[..] Ensuring whisper model '{0}' is downloaded ..." -f $Model) -ForegroundColor Yellow
    $dlOk = Install-WhisperModelWeights -Model $Model -CacheDir $cacheDir -Prefix $SCRIPT_INDEX
    if ($dlOk) {
        Write-Host ("[OK] model '{0}' is ready." -f $Model) -ForegroundColor Green
        Save-SttModelTier -PythonExe $Python -InstallScriptRoot $PSScriptRoot -WhisperModel $Model
    } else {
        Write-Host ("[!] model download did not complete; whisper will fetch it on first use." -f $Model) -ForegroundColor DarkYellow
    }
}

Complete-PrereqStep -PythonExe $Python -Prefix $SCRIPT_INDEX -ImportModules @('whisper')
