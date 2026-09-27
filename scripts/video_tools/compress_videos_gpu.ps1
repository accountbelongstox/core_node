<#
.SYNOPSIS
    Compress every video under a folder with the NVIDIA GPU (hevc_nvenc) and replace each original in place after verification.

.DESCRIPTION
    Containers mp4/m4v/mov/mkv are kept; every other video container is converted to an .mp4 with the same base name.
    A file is replaced only when the new file passes every check and is at most 85% (95% when the container changes)
    of the original size; otherwise the original is kept. Re-running skips files that are already HEVC/AV1 or carry
    the compression marker. Each result is appended to <Root>\.video_compress_log.csv.

.PARAMETER Root
    Folder scanned recursively. Default: D:\.tmp\BaiduNetdiskDownload

.PARAMETER Cq
    NVENC constant-quality level (lower = better quality, larger file). 0 = per-container default (30, or 28 for mkv/rmvb).

.PARAMETER Preset
    NVENC preset p1 (fastest) .. p7 (smallest output). Default p5.

.PARAMETER Jobs
    Number of files processed in parallel. Default 2.

.PARAMETER Limit
    Process at most this many files (0 = all).

.PARAMETER DryRun
    Only print the plan for each file.

.EXAMPLE
    .\compress_videos_gpu.ps1 -DryRun -Limit 20

.EXAMPLE
    .\compress_videos_gpu.ps1 -Jobs 2 -Preset p7
#>

[CmdletBinding()]
param(
    [string]$Root = 'D:\.tmp\BaiduNetdiskDownload',
    [ValidateRange(0, 51)] [int]$Cq = 0,
    [ValidateSet('p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7')] [string]$Preset = 'p5',
    [ValidateRange(1, 8)] [int]$Jobs = 2,
    [ValidateRange(0, [int]::MaxValue)] [int]$Limit = 0,
    [switch]$DryRun
)

#region Variable Declarations
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:VIDEO_TOOLS_DIR = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$script:VIDEO_EXTENSIONS = @('.mp4', '.m4v', '.mov', '.mkv', '.flv', '.f4v', '.wmv', '.asf', '.avi', '.rmvb', '.rm', '.mpg', '.mpeg', '.ts', '.m2ts', '.mts', '.3gp', '.webm', '.vob', '.divx', '.ogv')
$script:MUXER_BY_EXTENSION = @{ '.mp4' = 'mp4'; '.m4v' = 'mp4'; '.mov' = 'mov'; '.mkv' = 'matroska' }
$script:CONVERT_TARGET_EXTENSION = '.mp4'
$script:MATROSKA_EXTENSION = '.mkv'
$script:DEFAULT_CQ = 30
$script:HIGH_MOTION_CQ = 28
$script:HIGH_MOTION_EXTENSIONS = @('.mkv', '.rmvb', '.rm')
$script:MAX_RATIO_SAME_CONTAINER = 0.85
$script:MAX_RATIO_NEW_CONTAINER = 0.95
$script:DURATION_TOLERANCE_SECONDS = 1.0
$script:DURATION_TOLERANCE_RATIO = 0.005
$script:SKIP_VIDEO_CODECS = @('hevc', 'av1')
$script:GPU_SAFE_PIXEL_FORMATS = @('yuv420p', 'yuvj420p', 'nv12')
$script:COPY_AUDIO_CODECS = @('aac', 'mp3', 'ac3', 'eac3')
$script:MP3_MIN_SAMPLE_RATE = 16000
$script:AUDIO_MIN_KBPS = 32
$script:AUDIO_MAX_KBPS = 128
$script:AUDIO_DEFAULT_KBPS = 64
$script:AUDIO_BITRATE_FACTOR = 1.5
$script:TEXT_SUBTITLE_CODECS = @('subrip', 'srt', 'ass', 'ssa', 'mov_text', 'webvtt', 'text')
$script:MARKER_PREFIX = 'core_node_nvenc_hevc'
$script:TEMP_TAG = 'nvtmp'
$script:LOG_FILE_NAME = '.video_compress_log.csv'
$script:JOB_LOG_DIR = Join-Path ([System.IO.Path]::GetTempPath()) 'core_node_video_compress'
$script:POLL_MILLISECONDS = 1000
$script:INVARIANT = [System.Globalization.CultureInfo]::InvariantCulture
$script:MIB = 1MB

. (Join-Path $script:VIDEO_TOOLS_DIR 'VideoToolsCommon.ps1')

$script:Ffmpeg = $null
$script:LogPath = Join-Path $Root $script:LOG_FILE_NAME
$script:Stats = [ordered]@{ Compressed = 0; Kept = 0; Skipped = 0; Failed = 0; BytesBefore = [int64]0; BytesAfter = [int64]0 }
#endregion

#region Helpers
function Get-JsonValue {
    param(
        [Parameter()] $Object,
        [Parameter(Mandatory = $true)] [string[]]$Names
    )

    $current = $Object
    foreach ($name in $Names) {
        if ($null -eq $current) {
            return $null
        }
        $property = $current.PSObject.Properties[$name]
        if ($null -eq $property) {
            return $null
        }
        $current = $property.Value
    }
    return $current
}

function ConvertTo-Seconds {
    param([Parameter()] $Value)

    $number = 0.0
    if ($null -ne $Value -and [double]::TryParse([string]$Value, [System.Globalization.NumberStyles]::Float, $script:INVARIANT, [ref]$number)) {
        return $number
    }
    return $null
}

function Join-ProcessArguments {
    param([Parameter(Mandatory = $true)] [string[]]$Arguments)

    $quoted = foreach ($argument in $Arguments) {
        if ($argument -eq '') {
            '""'
        } elseif ($argument -match '[\s"]') {
            $escaped = ($argument -replace '(\\*)"', '$1$1\"') -replace '(\\+)$', '$1$1'
            '"{0}"' -f $escaped
        } else {
            $argument
        }
    }
    return ($quoted -join ' ')
}

function Get-MediaInfo {
    param([Parameter(Mandatory = $true)] [string]$Path)

    $ErrorActionPreference = 'Continue'
    $json = & $script:Ffmpeg.ProbePath -v error -print_format json -show_format -show_streams -i $Path 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $json) {
        return $null
    }
    return (($json -join "`n") | ConvertFrom-Json)
}

function Get-MediaStreams {
    param(
        [Parameter(Mandatory = $true)] $Info,
        [Parameter(Mandatory = $true)] [string]$Type
    )

    @(Get-JsonValue -Object $Info -Names @('streams')) | Where-Object { $_ -and (Get-JsonValue -Object $_ -Names @('codec_type')) -eq $Type }
}

function Get-MediaDuration {
    param([Parameter(Mandatory = $true)] $Info)

    $duration = ConvertTo-Seconds (Get-JsonValue -Object $Info -Names @('format', 'duration'))
    if ($null -ne $duration) {
        return $duration
    }
    $streamDurations = @(@(Get-JsonValue -Object $Info -Names @('streams')) | ForEach-Object { ConvertTo-Seconds (Get-JsonValue -Object $_ -Names @('duration')) } | Where-Object { $null -ne $_ })
    if ($streamDurations.Count -gt 0) {
        return ($streamDurations | Measure-Object -Maximum).Maximum
    }
    return $null
}

function Write-CompressLog {
    param(
        [Parameter(Mandatory = $true)] [string]$Status,
        [Parameter(Mandatory = $true)] [string]$Source,
        [Parameter()] [string]$Target = '',
        [Parameter()] [int64]$OriginalBytes = 0,
        [Parameter()] [int64]$NewBytes = 0,
        [Parameter()] [string]$Detail = ''
    )

    $ratio = if ($OriginalBytes -gt 0 -and $NewBytes -gt 0) { [math]::Round($NewBytes / $OriginalBytes, 3) } else { '' }
    $row = [PSCustomObject]@{
        Time       = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
        Status     = $Status
        Source     = $Source
        Target     = $Target
        OriginalMB = [math]::Round($OriginalBytes / $script:MIB, 2)
        NewMB      = [math]::Round($NewBytes / $script:MIB, 2)
        Ratio      = $ratio
        Detail     = $Detail
    }
    if (-not $DryRun) {
        $row | Export-Csv -LiteralPath $script:LogPath -Append -NoTypeInformation -Encoding UTF8
    }
    $color = switch ($Status) { 'compressed' { 'Green' } 'kept' { 'Yellow' } 'failed' { 'Red' } default { 'DarkGray' } }
    $sizeText = if ($NewBytes -gt 0) { ' {0:N1} MB -> {1:N1} MB' -f ($OriginalBytes / $script:MIB), ($NewBytes / $script:MIB) } else { '' }
    Write-Host ('[{0}] {1}{2} {3}' -f $Status, $Source, $sizeText, $Detail) -ForegroundColor $color
}

function Remove-TempFile {
    param([Parameter(Mandatory = $true)] [string]$Path)

    if ([System.IO.File]::Exists($Path)) {
        [System.IO.File]::Delete($Path)
    }
}
#endregion

#region Planning
function Get-AudioArguments {
    param(
        [Parameter(Mandatory = $true)] [object[]]$AudioStreams,
        [Parameter(Mandatory = $true)] [string]$Muxer
    )

    if ($AudioStreams.Count -eq 0) {
        return @()
    }
    $copyable = $true
    $maxKbps = 0
    foreach ($stream in $AudioStreams) {
        $codec = [string](Get-JsonValue -Object $stream -Names @('codec_name'))
        $sampleRate = [int](ConvertTo-Seconds (Get-JsonValue -Object $stream -Names @('sample_rate')))
        $bitRate = ConvertTo-Seconds (Get-JsonValue -Object $stream -Names @('bit_rate'))
        $streamKbps = if ($null -ne $bitRate) { [math]::Round(($bitRate / 1000) * $script:AUDIO_BITRATE_FACTOR) } else { $script:AUDIO_DEFAULT_KBPS }
        $maxKbps = [math]::Max($maxKbps, $streamKbps)
        $isCopyable = ($script:COPY_AUDIO_CODECS -contains $codec) -and -not ($codec -eq 'mp3' -and $sampleRate -lt $script:MP3_MIN_SAMPLE_RATE)
        if ($Muxer -ne 'matroska' -and -not $isCopyable) {
            $copyable = $false
        }
    }
    if ($copyable) {
        return @('-c:a', 'copy')
    }
    $kbps = [math]::Min($script:AUDIO_MAX_KBPS, [math]::Max($script:AUDIO_MIN_KBPS, $maxKbps))
    return @('-c:a', 'aac', '-b:a', ('{0}k' -f $kbps))
}

function New-CompressPlan {
    param([Parameter(Mandatory = $true)] [System.IO.FileInfo]$File)

    $info = Get-MediaInfo -Path $File.FullName
    if ($null -eq $info) {
        return [PSCustomObject]@{ Skip = 'ffprobe could not read the file' }
    }
    $videoStreams = @(Get-MediaStreams -Info $info -Type 'video' | Where-Object { [int](ConvertTo-Seconds (Get-JsonValue -Object $_ -Names @('disposition', 'attached_pic'))) -ne 1 })
    if ($videoStreams.Count -eq 0) {
        return [PSCustomObject]@{ Skip = 'no video stream' }
    }
    $videoCodec = [string](Get-JsonValue -Object $videoStreams[0] -Names @('codec_name'))
    if ($script:SKIP_VIDEO_CODECS -contains $videoCodec) {
        return [PSCustomObject]@{ Skip = ('already {0}' -f $videoCodec) }
    }
    $comment = [string](Get-JsonValue -Object $info -Names @('format', 'tags', 'comment'))
    if ($comment.StartsWith($script:MARKER_PREFIX)) {
        return [PSCustomObject]@{ Skip = 'already compressed' }
    }

    $sourceExtension = $File.Extension.ToLowerInvariant()
    $audioStreams = @(Get-MediaStreams -Info $info -Type 'audio')
    $subtitleStreams = @(Get-MediaStreams -Info $info -Type 'subtitle')
    $hasBitmapSubtitles = @($subtitleStreams | Where-Object { $script:TEXT_SUBTITLE_CODECS -notcontains [string](Get-JsonValue -Object $_ -Names @('codec_name')) }).Count -gt 0

    $targetExtension = if ($script:MUXER_BY_EXTENSION.ContainsKey($sourceExtension)) { $sourceExtension } elseif ($hasBitmapSubtitles) { $script:MATROSKA_EXTENSION } else { $script:CONVERT_TARGET_EXTENSION }
    if ($targetExtension -ne $script:MATROSKA_EXTENSION -and $hasBitmapSubtitles) {
        $targetExtension = $script:MATROSKA_EXTENSION
    }
    $muxer = $script:MUXER_BY_EXTENSION[$targetExtension]
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($File.Name)
    $targetPath = Join-Path $File.DirectoryName ('{0}{1}' -f $baseName, $targetExtension)
    $tempPath = Join-Path $File.DirectoryName ('{0}.{1}{2}' -f $baseName, $script:TEMP_TAG, $targetExtension)
    $containerChanges = $targetPath -ne $File.FullName
    if ($containerChanges -and [System.IO.File]::Exists($targetPath)) {
        return [PSCustomObject]@{ Skip = ('target name already exists: {0}' -f $targetPath) }
    }

    $cqValue = if ($Cq -gt 0) { $Cq } elseif ($script:HIGH_MOTION_EXTENSIONS -contains $sourceExtension) { $script:HIGH_MOTION_CQ } else { $script:DEFAULT_CQ }
    $pixelFormat = [string](Get-JsonValue -Object $videoStreams[0] -Names @('pix_fmt'))
    $gpuFrames = $script:GPU_SAFE_PIXEL_FORMATS -contains $pixelFormat
    $marker = '{0}_cq{1}_{2}' -f $script:MARKER_PREFIX, $cqValue, $Preset
    $lookahead = if ($Preset -eq 'p7' -or $Preset -eq 'p6') { '32' } else { '20' }

    $inputArgs = @(if ($sourceExtension -eq '.avi') { '-fflags'; '+genpts' })
    $mapArgs = @('-map', '0:V:0', '-map', '0:a?', '-map_metadata', '0', '-map_chapters', '0')
    if ($muxer -eq 'matroska') {
        $mapArgs += @('-map', '0:s?', '-map', '0:t?', '-c:s', 'copy', '-c:t', 'copy')
    } elseif ($subtitleStreams.Count -gt 0) {
        $mapArgs += @('-map', '0:s?', '-c:s', 'mov_text')
    }
    $videoArgs = @('-c:v', 'hevc_nvenc', '-preset', $Preset, '-tune', 'hq', '-rc', 'vbr', '-cq', [string]$cqValue, '-b:v', '0',
        '-multipass', 'qres', '-rc-lookahead', $lookahead, '-spatial-aq', '1', '-temporal-aq', '1', '-aq-strength', '8',
        '-b_ref_mode', 'middle', '-bf', '4', '-profile:v', 'main')
    if (-not $gpuFrames) {
        $videoArgs += @('-pix_fmt', 'yuv420p')
    }
    $tailArgs = @('-metadata', ('comment={0}' -f $marker))
    if ($muxer -ne 'matroska') {
        $tailArgs += @('-tag:v', 'hvc1', '-movflags', '+faststart')
    }
    $tailArgs += @('-f', $muxer)

    return [PSCustomObject]@{
        Skip             = $null
        Source           = $File.FullName
        SourceBytes      = $File.Length
        TargetPath       = $targetPath
        TempPath         = $tempPath
        ContainerChanges = $containerChanges
        Muxer            = $muxer
        Marker           = $marker
        GpuFrames        = $gpuFrames
        AudioCount       = $audioStreams.Count
        Duration         = Get-MediaDuration -Info $info
        InputArgs        = $inputArgs
        MapArgs          = $mapArgs
        VideoArgs        = $videoArgs
        AudioArgs        = @(Get-AudioArguments -AudioStreams $audioStreams -Muxer $muxer)
        TailArgs         = $tailArgs
        Summary          = ('{0} {1} -> {2} cq{3} {4} audio:{5}' -f $videoCodec, $pixelFormat, $targetExtension, $cqValue, $Preset, ((@(Get-AudioArguments -AudioStreams $audioStreams -Muxer $muxer)) -join ' '))
    }
}
#endregion

#region Jobs
function Start-FfmpegProcess {
    param(
        [Parameter(Mandatory = $true)] [string[]]$Arguments,
        [Parameter(Mandatory = $true)] [string]$LogName
    )

    $stdoutLog = Join-Path $script:JOB_LOG_DIR ('{0}.out.log' -f $LogName)
    $stderrLog = Join-Path $script:JOB_LOG_DIR ('{0}.err.log' -f $LogName)
    $process = Start-Process -FilePath $script:Ffmpeg.Path -ArgumentList (Join-ProcessArguments -Arguments $Arguments) -NoNewWindow -PassThru `
        -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
    $null = $process.Handle
    return [PSCustomObject]@{ Process = $process; ErrorLog = $stderrLog; OutputLog = $stdoutLog }
}

function Start-EncodePhase {
    param(
        [Parameter(Mandatory = $true)] $Job
    )

    $plan = $Job.Plan
    Remove-TempFile -Path $plan.TempPath
    $decodeArgs = if ($Job.Attempt -eq 1) {
        if ($plan.GpuFrames) { @('-hwaccel', 'cuda', '-hwaccel_output_format', 'cuda') } else { @('-hwaccel', 'cuda') }
    } else {
        @()
    }
    $arguments = @('-hide_banner', '-nostdin', '-y', '-v', 'error') + $plan.InputArgs + $decodeArgs + @('-i', $plan.Source) +
        $plan.MapArgs + $plan.VideoArgs + $plan.AudioArgs + $plan.TailArgs + @($plan.TempPath)
    $started = Start-FfmpegProcess -Arguments $arguments -LogName ('job{0}_encode{1}' -f $Job.Id, $Job.Attempt)
    $Job.Phase = 'encode'
    $Job.Handle = $started
}

function Start-DecodePhase {
    param([Parameter(Mandatory = $true)] $Job)

    $arguments = @('-hide_banner', '-nostdin', '-v', 'error', '-hwaccel', 'cuda', '-i', $Job.Plan.TempPath, '-f', 'null', '-')
    $Job.Phase = 'decode'
    $Job.Handle = Start-FfmpegProcess -Arguments $arguments -LogName ('job{0}_decode' -f $Job.Id)
}

function Get-VerificationFailure {
    param([Parameter(Mandatory = $true)] $Plan)

    $info = Get-MediaInfo -Path $Plan.TempPath
    if ($null -eq $info) {
        return 'output is not readable'
    }
    $videoStreams = @(Get-MediaStreams -Info $info -Type 'video')
    if ($videoStreams.Count -ne 1 -or [string](Get-JsonValue -Object $videoStreams[0] -Names @('codec_name')) -ne 'hevc') {
        return 'output does not have exactly one hevc video stream'
    }
    if ($Plan.Muxer -ne 'matroska' -and [string](Get-JsonValue -Object $videoStreams[0] -Names @('codec_tag_string')) -ne 'hvc1') {
        return 'output video is not tagged hvc1'
    }
    if (@(Get-MediaStreams -Info $info -Type 'audio').Count -ne $Plan.AudioCount) {
        return 'audio stream count differs'
    }
    if ([string](Get-JsonValue -Object $info -Names @('format', 'tags', 'comment')) -ne $Plan.Marker) {
        return 'marker was not written'
    }
    $outputDuration = Get-MediaDuration -Info $info
    if ($null -ne $Plan.Duration) {
        if ($null -eq $outputDuration) {
            return 'output duration is unknown'
        }
        $tolerance = [math]::Max($script:DURATION_TOLERANCE_SECONDS, $Plan.Duration * $script:DURATION_TOLERANCE_RATIO)
        if ([math]::Abs($outputDuration - $Plan.Duration) -gt $tolerance) {
            return ('duration differs ({0:N1}s vs {1:N1}s)' -f $outputDuration, $Plan.Duration)
        }
    }
    return $null
}

function Complete-Replacement {
    param([Parameter(Mandatory = $true)] $Plan)

    $creationTime = [System.IO.File]::GetCreationTime($Plan.Source)
    $lastWriteTime = [System.IO.File]::GetLastWriteTime($Plan.Source)
    if ($Plan.ContainerChanges) {
        [System.IO.File]::Move($Plan.TempPath, $Plan.TargetPath)
        [System.IO.File]::Delete($Plan.Source)
    } else {
        [System.IO.File]::Replace($Plan.TempPath, $Plan.Source, [NullString]::Value)
    }
    [System.IO.File]::SetCreationTime($Plan.TargetPath, $creationTime)
    [System.IO.File]::SetLastWriteTime($Plan.TargetPath, $lastWriteTime)
}

function Complete-Job {
    param([Parameter(Mandatory = $true)] $Job)

    $plan = $Job.Plan
    $process = $Job.Handle.Process
    $process.WaitForExit()
    $exitCode = $process.ExitCode
    $errorText = ''
    if ([System.IO.File]::Exists($Job.Handle.ErrorLog)) {
        $errorText = ([System.IO.File]::ReadAllText($Job.Handle.ErrorLog)).Trim()
    }

    if ($Job.Phase -eq 'encode') {
        if ($exitCode -ne 0 -or -not [System.IO.File]::Exists($plan.TempPath)) {
            Remove-TempFile -Path $plan.TempPath
            if ($Job.Attempt -eq 1) {
                $Job.Attempt = 2
                Start-EncodePhase -Job $Job
                return $false
            }
            $script:Stats.Failed++
            Write-CompressLog -Status 'failed' -Source $plan.Source -OriginalBytes $plan.SourceBytes -Detail ('encode failed: {0}' -f ($errorText -split "`n" | Select-Object -Last 1))
            return $true
        }
        Start-DecodePhase -Job $Job
        return $false
    }

    $failure = if ($exitCode -ne 0 -or $errorText) { ('decode check failed: {0}' -f ($errorText -split "`n" | Select-Object -First 1)) } else { Get-VerificationFailure -Plan $plan }
    if ($failure) {
        Remove-TempFile -Path $plan.TempPath
        if ($Job.Attempt -eq 1) {
            $Job.Attempt = 2
            Start-EncodePhase -Job $Job
            return $false
        }
        $script:Stats.Failed++
        Write-CompressLog -Status 'failed' -Source $plan.Source -OriginalBytes $plan.SourceBytes -Detail $failure
        return $true
    }

    $newBytes = ([System.IO.FileInfo]$plan.TempPath).Length
    $maxRatio = if ($plan.ContainerChanges) { $script:MAX_RATIO_NEW_CONTAINER } else { $script:MAX_RATIO_SAME_CONTAINER }
    if ($newBytes -gt ($plan.SourceBytes * $maxRatio)) {
        Remove-TempFile -Path $plan.TempPath
        $script:Stats.Kept++
        Write-CompressLog -Status 'kept' -Source $plan.Source -OriginalBytes $plan.SourceBytes -NewBytes $newBytes -Detail 'saving below threshold, original kept'
        return $true
    }

    Complete-Replacement -Plan $plan
    $script:Stats.Compressed++
    $script:Stats.BytesBefore += $plan.SourceBytes
    $script:Stats.BytesAfter += $newBytes
    Write-CompressLog -Status 'compressed' -Source $plan.Source -Target $plan.TargetPath -OriginalBytes $plan.SourceBytes -NewBytes $newBytes
    return $true
}
#endregion

#region Main
function Invoke-VideoCompression {
    $script:Ffmpeg = Resolve-FfmpegTool
    if ($null -eq $script:Ffmpeg -or $null -eq $script:Ffmpeg.ProbePath) {
        throw 'ffmpeg and ffprobe were not found. Install them (winget install Gyan.FFmpeg) and run again.'
    }
    if (-not (Test-NvidiaGpu)) {
        throw 'No NVIDIA GPU was detected (nvidia-smi). This script encodes with hevc_nvenc only.'
    }
    if (-not (Test-Path -LiteralPath $Root)) {
        throw ('Folder not found: {0}' -f $Root)
    }
    New-Item -ItemType Directory -Force -Path $script:JOB_LOG_DIR | Out-Null

    $queue = New-Object System.Collections.Generic.Queue[System.IO.FileInfo]
    $tempMarker = '.{0}.' -f $script:TEMP_TAG
    Get-ChildItem -LiteralPath $Root -Recurse -File -Force |
        Where-Object { ($script:VIDEO_EXTENSIONS -contains $_.Extension.ToLowerInvariant()) -and ($_.Name.IndexOf($tempMarker, [System.StringComparison]::OrdinalIgnoreCase) -lt 0) } |
        Sort-Object FullName |
        Select-Object -First $(if ($Limit -gt 0) { $Limit } else { [int]::MaxValue }) |
        ForEach-Object { $queue.Enqueue($_) }
    $total = $queue.Count
    Write-Host ('{0} video files under {1}; ffmpeg: {2}; preset {3}; jobs {4}' -f $total, $Root, $script:Ffmpeg.Version, $Preset, $Jobs) -ForegroundColor Cyan

    $running = New-Object System.Collections.Generic.List[object]
    $nextId = 0
    $done = 0
    try {
        while ($queue.Count -gt 0 -or $running.Count -gt 0) {
            while ($running.Count -lt $Jobs -and $queue.Count -gt 0) {
                $file = $queue.Dequeue()
                $plan = New-CompressPlan -File $file
                if ($plan.Skip) {
                    $done++
                    $script:Stats.Skipped++
                    Write-CompressLog -Status 'skipped' -Source $file.FullName -OriginalBytes $file.Length -Detail $plan.Skip
                } elseif ($DryRun) {
                    $done++
                    Write-Host ('[plan] {0} :: {1}' -f $file.FullName, $plan.Summary) -ForegroundColor Cyan
                } else {
                    $nextId++
                    $job = [PSCustomObject]@{ Id = $nextId; Plan = $plan; Attempt = 1; Phase = ''; Handle = $null }
                    Start-EncodePhase -Job $job
                    $running.Add($job)
                }
            }
            foreach ($job in $running.ToArray()) {
                if ($job.Handle.Process.HasExited) {
                    if (Complete-Job -Job $job) {
                        $running.Remove($job) | Out-Null
                        $done++
                    }
                }
            }
            if ($total -gt 0) {
                Write-Progress -Activity 'GPU video compression' -Status ('{0}/{1} done, {2} running' -f $done, $total, $running.Count) -PercentComplete ([math]::Min(100, [int](100 * $done / $total)))
            }
            if ($running.Count -gt 0) {
                Start-Sleep -Milliseconds $script:POLL_MILLISECONDS
            }
        }
    } finally {
        foreach ($job in $running.ToArray()) {
            try {
                if ($job.Handle -and -not $job.Handle.Process.HasExited) {
                    $job.Handle.Process.Kill()
                    $job.Handle.Process.WaitForExit()
                }
                Remove-TempFile -Path $job.Plan.TempPath
            } catch {
                Write-Host ('[cleanup] could not remove {0}: {1}' -f $job.Plan.TempPath, $_.Exception.Message) -ForegroundColor Red
            }
        }
        Write-Progress -Activity 'GPU video compression' -Completed
    }

    $saved = $script:Stats.BytesBefore - $script:Stats.BytesAfter
    Write-Host ''
    Write-Host ('compressed {0}, kept {1}, skipped {2}, failed {3}; {4:N2} GB -> {5:N2} GB (saved {6:N2} GB)' -f
        $script:Stats.Compressed, $script:Stats.Kept, $script:Stats.Skipped, $script:Stats.Failed,
        ($script:Stats.BytesBefore / 1GB), ($script:Stats.BytesAfter / 1GB), ($saved / 1GB)) -ForegroundColor Cyan
    if (-not $DryRun) {
        Write-Host ('log: {0}' -f $script:LogPath) -ForegroundColor DarkGray
    }
}

Invoke-VideoCompression
#endregion
