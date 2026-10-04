<#
.SYNOPSIS
    Shared helpers for the video tools: ffmpeg/ffprobe resolution and NVIDIA GPU detection.
#>

$script:VIDEO_TOOLS_FFMPEG_EXE = 'ffmpeg.exe'
$script:VIDEO_TOOLS_FFPROBE_EXE = 'ffprobe.exe'
$script:VIDEO_TOOLS_FFMPEG_APP_DIR = 'FFmpeg'
$script:VIDEO_TOOLS_GLOBAL_VARS_PS1 = Join-Path (Join-Path (Join-Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'shells') 'win') 'win_common') 'GlobalVars.ps1'
$script:VIDEO_TOOLS_FFMPEG_FALLBACKS = @(
    (Join-Path (Join-Path $env:ProgramFiles 'ffmpeg') 'bin'),
    (Join-Path (Join-Path $env:USERPROFILE 'scoop') 'shims')
)

function Import-VideoToolsGlobalVars {
    if (-not ((Test-Path Variable:Global:APP_INSTALL_DIR) -and $Global:APP_INSTALL_DIR)) {
        . $script:VIDEO_TOOLS_GLOBAL_VARS_PS1
    }
}

function Get-FfmpegInstallRoots {
    Import-VideoToolsGlobalVars
    $appRoots = @(
        $Global:APP_INSTALL_DIR
        if (Test-Path Variable:Global:CN_LEGACY_APP_ROOT) { $Global:CN_LEGACY_APP_ROOT }
    )
    foreach ($appRoot in ($appRoots | Select-Object -Unique)) {
        $ffmpegRoot = Join-Path $appRoot $script:VIDEO_TOOLS_FFMPEG_APP_DIR
        if (Test-Path -LiteralPath $ffmpegRoot) {
            Get-ChildItem -LiteralPath $ffmpegRoot -Recurse -Depth 3 -Filter $script:VIDEO_TOOLS_FFMPEG_EXE -File -ErrorAction SilentlyContinue |
                Sort-Object LastWriteTime -Descending |
                ForEach-Object { $_.DirectoryName }
        }
    }
    $script:VIDEO_TOOLS_FFMPEG_FALLBACKS
}

function Resolve-FfmpegTool {
    $binDirs = @(
        Get-Command ffmpeg -All -ErrorAction SilentlyContinue | ForEach-Object { Split-Path -Parent $_.Source }
        Get-FfmpegInstallRoots
    )
    foreach ($binDir in $binDirs) {
        $ffmpegPath = Join-Path $binDir $script:VIDEO_TOOLS_FFMPEG_EXE
        if (-not (Test-Path -LiteralPath $ffmpegPath)) {
            continue
        }
        $ffprobePath = Join-Path $binDir $script:VIDEO_TOOLS_FFPROBE_EXE
        $versionLine = (& $ffmpegPath -hide_banner -version 2>&1 | Select-Object -First 1)
        return [PSCustomObject]@{
            Path      = $ffmpegPath
            ProbePath = $(if (Test-Path -LiteralPath $ffprobePath) { $ffprobePath } else { $null })
            Version   = ("$versionLine").Trim()
        }
    }
    return $null
}

function Test-NvidiaGpu {
    $nvidiaSmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    if (-not $nvidiaSmi) {
        return $false
    }
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $gpuList = & $nvidiaSmi.Source -L 2>$null
        return [bool]("$gpuList" -match '(?m)^GPU\s+\d+:')
    } catch {
        return $false
    } finally {
        $ErrorActionPreference = $previousPreference
    }
}
