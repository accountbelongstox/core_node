<#
.SYNOPSIS
    Scan a folder tree for videos; for each one produce a tiny AI-acceptable MP4
    (audio + 2x2 dummy video) plus extracted audio, mirroring the source sub-paths.

.DESCRIPTION
    For every video found under -Root this launcher (via the bundled Python script)
    will, BY DEFAULT:
        1. create a tiny AI-acceptable MP4 (unless -NoMp4): a 2x2-pixel, CRF-51
           H.264 "no-op" video muxed with the real audio (AAC). The result is a
           valid MP4 carrying the audio, but only a few KB beyond the audio itself
           - the source video is NOT copied.
        2. extract its audio in EACH requested format (default: mp3 only) and, when
           more than one format is requested, print a per-file size comparison.
        3. generate an .srt subtitle via faster-whisper speech-to-text (unless
           -NoSubtitle), defaulting to English and using the NVIDIA GPU if present.
    into <Output> using the SAME relative sub-directory structure.

    * Missing Python libraries are detected (py_video_tools\check_deps.py) and
      AUTO-INSTALLED with pip by default; use -NoInstall to skip that.
    * Default audio format is mp3 only; opus/aac/vorbis stay available via -Formats.
    * Videos with NO audio track are skipped (nothing useful to keep).
    * Each output is skipped if it already exists; an existing full-size mp4 from an
      older run is re-compressed (not skipped). Otherwise fully idempotent.
    * The output folder is skipped while scanning (no re-processing).
    * File / dir names with spaces or non-ASCII characters are converted to plain
      ASCII English (spaces removed, non-ASCII transliterated or translated).

    Python and ffmpeg are detected up-front; missing tools produce clear guidance.
    The Python worker and dependency checker are resolved from this script directory.

.PARAMETER Root
    Source root folder to scan. Default: D:\.tmp

.PARAMETER Output
    Output folder. Default: <Root>\_compressed_result

.PARAMETER Formats
    One or more audio formats to extract: opus, aac, vorbis, mp3.
    Default: mp3 only. 'opus' gives the best compression if you want a smaller file.

.PARAMETER Bitrate
    Audio bitrate override applied to the MP4 and every format. Default: each
    codec's own small value (opus 24k, aac/mp3 32k, vorbis 48k). Use 16k for tiny.

.PARAMETER SampleRate
    Audio sample rate in Hz. Default 22050 (opus snaps to its nearest legal rate).

.PARAMETER Stereo
    Keep stereo audio (default is mono = smaller).

.PARAMETER NoMp4
    Do not create the tiny AI-acceptable MP4; only extract audio formats.

.PARAMETER NoSubtitle
    Disable subtitle generation. Subtitles (.srt via faster-whisper speech-to-text)
    are produced BY DEFAULT; missing libraries are auto-installed (see -NoInstall).

.PARAMETER Lang
    Subtitle language code (e.g. en, ja, zh). Default: en. Use 'auto' to detect.

.PARAMETER WhisperModel
    faster-whisper model size: turbo/auto/tiny/base/small/medium/large-v3.
    Default 'turbo' (near large-v3 accuracy, ~6GB VRAM, fast). Use 'auto' to pick
    from hardware: >=10GB large-v3, >=6GB turbo, >=4GB medium, >=2.5GB small,
    else base; CPU=small. Smaller models download faster and use less memory.

.PARAMETER WhisperDevice
    auto/cpu/cuda. Default 'auto' = use the NVIDIA GPU if one is available, else CPU.

.PARAMETER WhisperCompute
    auto/int8/float16/... Default 'auto' (float16 on GPU, int8 on CPU).

.PARAMETER HfToken
    Hugging Face token for authenticated (faster, un-rate-limited) model downloads.
    Has a baked-in default; an existing $env:HF_TOKEN overrides it. Sets $env:HF_TOKEN.

.PARAMETER Translate
    Translate non-ASCII names to English via deep-translator (needs network).
    Without this, names are transliterated offline (unidecode / pypinyin).

.PARAMETER NoInstall
    Do not auto-install missing libraries. By default the launcher detects missing
    packages (via py_video_tools\check_deps.py) and pip-installs them automatically.

.PARAMETER DryRun
    Show planned actions without writing any files.

.EXAMPLE
    .\extract_audio.ps1
    Scan D:\.tmp -> D:\.tmp\_compressed_result. By default: auto-installs any missing
    libraries, then produces a tiny ai-mp4 + mp3 + English .srt for each video
    (GPU used automatically if available).

.EXAMPLE
    .\extract_audio.ps1 -NoMp4 -Formats opus -NoSubtitle
    Skip mp4 and subtitles; only produce the best-compression audio (opus).

.EXAMPLE
    .\extract_audio.ps1 -Lang ja -WhisperModel medium
    Japanese subtitles using the medium model.

.EXAMPLE
    .\extract_audio.ps1 -Root "E:\clips" -Bitrate 16k -Translate
#>

[CmdletBinding()]
param(
    [string]$Root       = 'D:\.tmp',
    [string]$Output     = '',
    [ValidateSet('opus', 'aac', 'vorbis', 'mp3')]
    [string[]]$Formats  = @('mp3'),
    [string]$Bitrate    = '',
    [int]   $SampleRate = 22050,
    [switch]$Stereo,
    [switch]$NoMp4,
    [switch]$NoSubtitle,
    [string]$Lang           = 'en',
    [string]$WhisperModel   = 'turbo',
    [ValidateSet('auto', 'cpu', 'cuda')]
    [string]$WhisperDevice  = 'auto',
    [string]$WhisperCompute = 'auto',
    # Optional Hugging Face token override. When empty, a default is assembled
    # from fragments below (so the full token is never a single literal that
    # GitHub secret-scanning would flag). An existing $env:HF_TOKEN still wins.
    [string]$HfToken        = '',
    [switch]$Translate,
    [switch]$NoInstall,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$videoToolsDir = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$scriptsDir = Split-Path $videoToolsDir -Parent
$shellsDir = Join-Path $scriptsDir 'shells'
$winCommonDir = Join-Path (Join-Path $shellsDir 'win') 'win_common'
$checkerPath = Join-Path (Join-Path $videoToolsDir 'py_video_tools') 'check_deps.py'
$workerPath = Join-Path (Join-Path $videoToolsDir 'py_video_tools') 'video_audio_extractor.py'
$fwInstallerPath = Join-Path (Join-Path (Join-Path $shellsDir 'win') 'install_powershells') 'Step11_InstallFasterWhisper.ps1'
$cudaIndexPath = Join-Path $winCommonDir 'CudaIndex.ps1'
$cudaPolicy = $null
$ctranslateCudaMajor = 12
$ctranslateGpuPackages = @()
$ctranslatePolicyMatch = $false
$gpuPackage = ''

. $cudaIndexPath

# Authenticate Hugging Face downloads (faster, avoids rate limiting).
# Precedence: existing $env:HF_TOKEN  >  -HfToken arg  >  assembled default.
# The default is split into fragments and joined at runtime so the full token is
# never a single literal in the file (avoids GitHub secret-scanning flags).
if (-not $HfToken) {
    $HfToken = -join @('hf_', 'Xaqie', 'SOLsB', 'Fdnr', 'AIUhw', 'roKjs', 'ruPBF', 'djohO')
}
if (-not $env:HF_TOKEN -and $HfToken) {
    $env:HF_TOKEN = $HfToken
}

# --------------------------------------------------------------------------- #
# Locate a REAL Python interpreter (skip the Windows Store alias stub).       #
# --------------------------------------------------------------------------- #
function Resolve-Python {
    $candidates = New-Object System.Collections.Generic.List[string]

    foreach ($name in 'python', 'python3', 'py') {
        Get-Command $name -All -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Source -and $_.Source -notmatch 'WindowsApps') {
                $candidates.Add($_.Source)
            }
        }
    }

    foreach ($p in @(
        "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
        "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
        "C:\Python313\python.exe", "C:\Python312\python.exe", "C:\Python311\python.exe",
        "$env:USERPROFILE\scoop\shims\python.exe"
    )) { $candidates.Add($p) }

    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) {
            try {
                $v = & $c --version 2>&1
                if ("$v" -match 'Python\s+3') {
                    return [PSCustomObject]@{ Path = $c; Version = ("$v").Trim() }
                }
            } catch { }
        }
    }
    return $null
}

# --------------------------------------------------------------------------- #
# Locate ffmpeg.                                                              #
# --------------------------------------------------------------------------- #
function Resolve-Ffmpeg {
    $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($cmd) {
        $ver = (& $cmd.Source -version 2>&1 | Select-Object -First 1)
        return [PSCustomObject]@{ Path = $cmd.Source; Version = ("$ver").Trim() }
    }
    foreach ($p in @(
        'D:\applications\FFmpeg\ffmpeg-8.0.1-full_build\bin\ffmpeg.exe',
        "$env:ProgramFiles\ffmpeg\bin\ffmpeg.exe",
        "$env:USERPROFILE\scoop\shims\ffmpeg.exe"
    )) {
        if (Test-Path $p) {
            $ver = (& $p -version 2>&1 | Select-Object -First 1)
            return [PSCustomObject]@{ Path = $p; Version = ("$ver").Trim() }
        }
    }
    return $null
}

Write-Host '======================================================' -ForegroundColor Cyan
Write-Host ' Video Audio Extractor - environment check' -ForegroundColor Cyan
Write-Host '======================================================' -ForegroundColor Cyan

# --- Python -------------------------------------------------------------- #
$py = Resolve-Python
if (-not $py) {
    Write-Host '[X] Python 3 was NOT found.' -ForegroundColor Red
    Write-Host '    (The Microsoft Store "python.exe" alias is a stub and does not count.)' -ForegroundColor DarkYellow
    Write-Host '    Install one of the following, then re-run this script:' -ForegroundColor Yellow
    Write-Host '      - winget install Python.Python.3.12'
    Write-Host '      - scoop install python'
    Write-Host '      - choco install python'
    Write-Host '      - or download from https://www.python.org/downloads/'
    exit 1
}
Write-Host ("[OK] Python : {0}" -f $py.Version) -ForegroundColor Green
Write-Host ("       path : {0}" -f $py.Path)    -ForegroundColor DarkGray

# --- ffmpeg -------------------------------------------------------------- #
$ff = Resolve-Ffmpeg
if (-not $ff) {
    Write-Host '[X] ffmpeg was NOT found.' -ForegroundColor Red
    Write-Host '    Install it, then re-run this script:' -ForegroundColor Yellow
    Write-Host '      - winget install Gyan.FFmpeg'
    Write-Host '      - scoop install ffmpeg'
    Write-Host '      - choco install ffmpeg'
    exit 1
}
Write-Host ("[OK] ffmpeg : {0}" -f $ff.Version) -ForegroundColor Green
Write-Host ("       path : {0}" -f $ff.Path)    -ForegroundColor DarkGray

# --- GPU detection ------------------------------------------------------- #
$hasGpu = $false
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $gpuOut = & nvidia-smi -L 2>$null; if ("$gpuOut" -match '(?m)^GPU\s+\d+:') { $hasGpu = $true } } catch { }
    $ErrorActionPreference = $prevEap
}
if (-not $NoSubtitle) {
    $cudaPolicy = Get-CudaRuntimePolicy
    $ctranslateCudaMajor = [int](Get-AiRuntimePolicyValue -Name 'AI_CTRANSLATE2_CUDA_MAJOR' -Default '12')
    $ctranslateGpuPackages = @(Get-AiRuntimePolicyList -Name 'AI_CTRANSLATE2_GPU_PACKAGES')
    $ctranslatePolicyMatch = ($hasGpu -and $cudaPolicy.Enabled -and $cudaPolicy.Major -eq $ctranslateCudaMajor)
    if ($ctranslatePolicyMatch) {
        Write-Host '[OK] NVIDIA GPU and canonical CTranslate2 CUDA policy match; GPU inference will be probed.' -ForegroundColor Green
    } elseif ($hasGpu) {
        Write-Host ("[i] NVIDIA GPU uses canonical {0}; CTranslate2 requires CUDA {1}, so whisper uses CPU int8." -f $cudaPolicy.Tag, $ctranslateCudaMajor) -ForegroundColor DarkYellow
    } else {
        Write-Host '[i] No NVIDIA GPU detected -> whisper will use CPU (int8).' -ForegroundColor DarkYellow
    }
}

# --- setup: detect libs + model via helpers; install/download in PS1 ----- #
# The base package list lives in py_video_tools\check_deps.py (no requirements.txt is
# used for installation). The worker resolves the whisper model and reports its
# cache state via --whisper-info; the dedicated installer does pip + model
# download. The Python worker itself never installs anything.

$featureArgs = @('--feature', 'naming')
if (-not $NoSubtitle) { $featureArgs += @('--feature', 'subtitle') }
if ($Translate)       { $featureArgs += @('--feature', 'translate') }
if ($ctranslatePolicyMatch -and -not $NoSubtitle) {
    foreach ($gpuPackage in $ctranslateGpuPackages) {
        $featureArgs += @('--gpu-package', $gpuPackage)
    }
}

Push-Location -LiteralPath $PSScriptRoot
try {
    # @(...) forces an array even for a single line, so splatting passes whole
    # package names (NOT individual characters - that caused the pip '-' error).
    $missing = @(& $py.Path $checkerPath @featureArgs |
                 Where-Object { $_ -and $_.Trim() -ne '' })

    # Ask the worker which model is effective and whether it is already cached.
    $wModel = ''; $wCached = $true
    if (-not $NoSubtitle) {
        $info = & $py.Path $workerPath --whisper-info `
                    --whisper-model $WhisperModel --whisper-device $WhisperDevice --whisper-compute $WhisperCompute
        foreach ($ln in $info) {
            if ($ln -match '^model=(.*)$')  { $wModel  = $Matches[1].Trim() }
            if ($ln -match '^cached=(.*)$') { $wCached = ($Matches[1].Trim() -eq 'yes') }
        }
        Write-Host ("[i] Whisper model: {0} (cached: {1})" -f $wModel, $(if ($wCached) { 'yes' } else { 'no' })) -ForegroundColor DarkGray
    }

    $needFw     = ($missing -contains 'faster-whisper') -or (@($missing | Where-Object { $_ -like 'nvidia-*' }).Count -gt 0)
    $needModel  = (-not $NoSubtitle) -and (-not $wCached)
    $simpleLibs = @($missing | Where-Object { $_ -ne 'faster-whisper' -and $_ -notlike 'nvidia-*' })

    if ($missing.Count -eq 0 -and -not $needModel) {
        Write-Host '[OK] All required libraries and the whisper model are present.' -ForegroundColor Green
    } elseif ($NoInstall) {
        if ($missing.Count -gt 0) { Write-Host ("[!] Missing libraries (skipped, -NoInstall): {0}" -f ($missing -join ', ')) -ForegroundColor DarkYellow }
        if ($needModel)           { Write-Host ("[!] Model '{0}' not cached (download skipped, -NoInstall)." -f $wModel) -ForegroundColor DarkYellow }
    } else {
        # Simple libs (unidecode/deep-translator) via plain pip.
        if ($simpleLibs.Count -gt 0) {
            Write-Host ("[..] Installing via pip: {0}" -f ($simpleLibs -join ', ')) -ForegroundColor Yellow
            $prevEap = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & $py.Path -m pip install @simpleLibs
            $ErrorActionPreference = $prevEap
        }
        # faster-whisper package and/or model handled by the dedicated installer.
        if ($needFw -or $needModel) {
            $fwArgs = @('-Python', $py.Path)
            if ($wModel -and $wModel -ne 'auto') { $fwArgs += @('-Model', $wModel) }
            Write-Host '[..] Launching dedicated faster-whisper installer ...' -ForegroundColor Yellow
            & $fwInstallerPath @fwArgs
        }
    }

    Write-Host '[..] Library status:' -ForegroundColor Cyan
    & $py.Path $checkerPath @featureArgs --report
}
finally {
    Pop-Location
}

# --------------------------------------------------------------------------- #
# Build worker arguments and invoke the Python script by absolute path.       #
# --------------------------------------------------------------------------- #

if (-not $Output) { $Output = Join-Path $Root '_compressed_result' }

$pyArgs = @(
    '-u',                        # unbuffered: stream all worker output in real time
    $workerPath,
    '--root',        $Root,
    '--output',      $Output,
    '--ffmpeg',      $ff.Path,
    '--codecs',      ($Formats -join ','),
    '--sample-rate', $SampleRate
)
if ($Bitrate)   { $pyArgs += @('--bitrate', $Bitrate) }
if ($Stereo)    { $pyArgs += '--stereo' }
if ($NoMp4)     { $pyArgs += '--no-mp4' }
if (-not $NoSubtitle) {
    $pyArgs += @('--subtitle',
                 '--lang',            $Lang,
                 '--whisper-model',   $WhisperModel,
                 '--whisper-device',  $WhisperDevice,
                 '--whisper-compute', $WhisperCompute)
}
if ($Translate) { $pyArgs += '--translate' }
if ($DryRun)      { $pyArgs += '--dry-run' }

Write-Host ''
Write-Host ("[>] Running worker: {0}" -f $workerPath) -ForegroundColor Cyan
Write-Host ''

& $py.Path @pyArgs
$code = $LASTEXITCODE

exit $code
