# ffmpeg prerequisite (audio/video decode for whisper, TTS assembly, video extraction).
# pycore only checks `ffmpeg` / `ffprobe` on PATH (shutil.which) and never downloads
# it. Install goes through the shared applications catalog entry FFmpeg
# (winget Gyan.FFmpeg, ForceToInstallDir -> tool root, PATH registered by the
# catalog). Idempotent: an ffmpeg + ffprobe already on PATH is kept.
#
# Invocation contracts:
#   - pyservice flow: & BaseTools_Ffmpeg.ps1
[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$SCRIPT_INDEX    = '[BaseTools_Ffmpeg]'
$PACKAGE_KEY     = 'FFmpeg'
$winCommonDir    = Join-Path (Split-Path $PSScriptRoot -Parent) 'win_common'
$applicationsPs1 = Join-Path $PSScriptRoot 'Step21_InstallApplications.ps1'
$ffmpegCommand   = $null
$ffprobeCommand  = $null

. (Join-Path $winCommonDir 'GlobalVars.ps1')
. (Join-Path $winCommonDir 'TtsInstallAssetsCommon.ps1')

function Get-FfmpegTools {
    $script:ffmpegCommand = Get-Command -Name 'ffmpeg' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    $script:ffprobeCommand = Get-Command -Name 'ffprobe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
}

Get-FfmpegTools
if ($ffmpegCommand -and $ffprobeCommand -and -not $Force) {
    Write-Host ("$SCRIPT_INDEX [idempotent] ffmpeg already on PATH: {0}" -f $ffmpegCommand.Source) -ForegroundColor Green
    return
}

Write-Host "$SCRIPT_INDEX [..] installing FFmpeg via the applications catalog (winget Gyan.FFmpeg) ..." -ForegroundColor Yellow
& $applicationsPs1 -ExactPackageName $PACKAGE_KEY
Refresh-ProcessPathEnv
Get-FfmpegTools
if (-not ($ffmpegCommand -and $ffprobeCommand)) {
    Write-Host "$SCRIPT_INDEX [!] ffmpeg/ffprobe are still not on PATH after the install; it will retry next run." -ForegroundColor DarkYellow
    Set-GlobalVar -Key 'PYCORE_PREREQUISITE_STEP_STATE' -Value 'pending' | Out-Null
    return
}
Write-Host ("$SCRIPT_INDEX [OK] ffmpeg ready: {0}" -f $ffmpegCommand.Source) -ForegroundColor Green
