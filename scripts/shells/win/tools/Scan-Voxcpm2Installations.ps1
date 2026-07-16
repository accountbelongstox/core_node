<#
.SYNOPSIS
    Scan C: and D: for legacy or duplicate VoxCPM2 install directories.

.DESCRIPTION
    Walks each drive root up to 5 subdirectory levels, looking for folders named
    "voxcpm2" that match the Step58 install layout (.deps_done, .model_installed,
    weights/). Inaccessible paths are skipped without aborting the scan.

.PARAMETER MaxDepth
    Maximum directory depth below the drive root (default 5).

.PARAMETER Drives
    Drive letters to scan (default C and D).

.EXAMPLE
    .\Scan-Voxcpm2Installations.ps1
#>
[CmdletBinding()]
param(
    [int]$MaxDepth = 5,
    [string[]]$Drives = @('C', 'D')
)

$ErrorActionPreference = 'Continue'

$scriptIndex = '[Scan-Voxcpm2]'
$found = [System.Collections.Generic.List[object]]::new()
$seenPaths = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
$skipCount = 0
$dirCount = 0
$canonicalPath = $null
$knownPaths = [System.Collections.Generic.List[string]]::new()

function Write-ScanLine {
    param(
        [string]$Text,
        [ConsoleColor]$Color = [ConsoleColor]::Gray
    )
    Write-Host $Text -ForegroundColor $Color
}

function Test-PathAccessible {
    param([string]$Path)
    try {
        return Test-Path -LiteralPath $Path -PathType Container
    } catch {
        return $false
    }
}

function Get-DirectorySizeBytes {
    param([string]$Path)
    $total = 0L
    try {
        $items = Get-ChildItem -LiteralPath $Path -Recurse -File -Force -ErrorAction SilentlyContinue
        foreach ($item in $items) {
            $total += $item.Length
        }
    } catch {
        return $null
    }
    return $total
}

function Format-ByteSize {
    param([long]$Bytes)
    if ($null -eq $Bytes) { return 'unknown' }
    if ($Bytes -ge 1GB) {
        return ('{0:N2} GB' -f ($Bytes / 1GB))
    }
    if ($Bytes -ge 1MB) {
        return ('{0:N2} MB' -f ($Bytes / 1MB))
    }
    if ($Bytes -ge 1KB) {
        return ('{0:N2} KB' -f ($Bytes / 1KB))
    }
    return ('{0} B' -f $Bytes)
}

function Read-SentinelText {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try {
        $raw = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop
        if ($raw) {
            return $raw.Trim().Trim([char]0xFEFF)
        }
    } catch {
        return $null
    }
    return $null
}

function Test-Voxcpm2InstallDir {
    param([string]$DirPath)
    $depsDone = Join-Path $DirPath '.deps_done'
    $modelInstalled = Join-Path $DirPath '.model_installed'
    $weightsDir = Join-Path $DirPath 'weights'
    $hasDeps = Test-Path -LiteralPath $depsDone
    $hasModelSentinel = Test-Path -LiteralPath $modelInstalled
    $hasWeights = Test-Path -LiteralPath $weightsDir
    $weightFileCount = 0
    if ($hasWeights) {
        $weightFileCount = @(Get-ChildItem -LiteralPath $weightsDir -Recurse -File -Force -ErrorAction SilentlyContinue |
            Where-Object { $_.Extension -in '.safetensors', '.bin', '.pt' }).Count
    }
    $score = 0
    if ($hasDeps) { $score++ }
    if ($hasModelSentinel) { $score++ }
    if ($hasWeights) { $score++ }
    if ($weightFileCount -gt 0) { $score++ }
    return @{
        Path               = $DirPath
        Score              = $score
        HasDepsDone        = $hasDeps
        HasModelInstalled  = $hasModelSentinel
        HasWeightsDir      = $hasWeights
        WeightFileCount    = $weightFileCount
        ModelId            = Read-SentinelText -Path $modelInstalled
        DepsDoneTimestamp  = Read-SentinelText -Path $depsDone
        TotalBytes         = Get-DirectorySizeBytes -Path $DirPath
        WeightsBytes       = if ($hasWeights) { Get-DirectorySizeBytes -Path $weightsDir } else { 0 }
    }
}

function Register-Voxcpm2Hit {
    param([hashtable]$Hit)
    $resolved = $null
    try {
        $resolved = (Resolve-Path -LiteralPath $Hit.Path -ErrorAction Stop).Path
    } catch {
        $resolved = $Hit.Path
    }
    if ($seenPaths.Contains($resolved)) { return }
    [void]$seenPaths.Add($resolved)
    $found.Add([pscustomobject]$Hit) | Out-Null
}

function Add-KnownPathCandidates {
    param([string[]]$Candidates)
    foreach ($candidate in $Candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        if (-not (Test-PathAccessible -Path $candidate)) { continue }
        $hit = Test-Voxcpm2InstallDir -DirPath $candidate
        if ($hit.Score -ge 1) {
            Register-Voxcpm2Hit -Hit $hit
        }
    }
}

function Get-ChildDirectorySafe {
    param([string]$ParentPath)
    try {
        return @(Get-ChildItem -LiteralPath $ParentPath -Directory -Force -ErrorAction Stop)
    } catch {
        $script:skipCount++
        return @()
    }
}

function Search-DriveForVoxcpm2 {
    param(
        [string]$DriveLetter,
        [int]$DepthLimit
    )
    $driveRoot = ('{0}:\' -f $DriveLetter.ToUpperInvariant())
    if (-not (Test-PathAccessible -Path $driveRoot)) {
        Write-ScanLine ("{0} [!] drive not accessible: {1}" -f $scriptIndex, $driveRoot) ([ConsoleColor]::DarkYellow)
        return
    }

    Write-ScanLine ("{0} [..] scanning {1} (max depth {2}) ..." -f $scriptIndex, $driveRoot, $DepthLimit) ([ConsoleColor]::Cyan)

    $queue = [System.Collections.Generic.Queue[object]]::new()
    $queue.Enqueue(@{ Path = $driveRoot; Depth = 0 })

    while ($queue.Count -gt 0) {
        $node = $queue.Dequeue()
        $currentPath = $node.Path
        $currentDepth = [int]$node.Depth
        $script:dirCount++

        $children = Get-ChildDirectorySafe -ParentPath $currentPath
        foreach ($child in $children) {
            if ($child.Name -ieq 'voxcpm2') {
                $hit = Test-Voxcpm2InstallDir -DirPath $child.FullName
                if ($hit.Score -ge 1) {
                    Register-Voxcpm2Hit -Hit $hit
                }
            }
            if ($currentDepth -lt $DepthLimit) {
                $queue.Enqueue(@{ Path = $child.FullName; Depth = ($currentDepth + 1) })
            }
        }
    }
}

Write-ScanLine '============================================================' ([ConsoleColor]::Cyan)
Write-ScanLine (" {0} VoxCPM2 installation scanner" -f $scriptIndex) ([ConsoleColor]::Cyan)
Write-ScanLine '============================================================' ([ConsoleColor]::Cyan)
Write-ScanLine ("{0}  max depth : {1}" -f $scriptIndex, $MaxDepth) ([ConsoleColor]::DarkGray)
Write-ScanLine ("{0}  drives    : {1}" -f $scriptIndex, ($Drives -join ', ')) ([ConsoleColor]::DarkGray)

$canonicalPath = 'D:\www\cache\pycore\voxcpm2'
$knownPaths.Add($canonicalPath)
$knownPaths.Add('C:\www\cache\pycore\voxcpm2')
if ($env:VOXCPM2_DIR) { $knownPaths.Add($env:VOXCPM2_DIR) }
if ($env:PYCORE_LOCAL_DATA_DIR) { $knownPaths.Add((Join-Path $env:PYCORE_LOCAL_DATA_DIR 'voxcpm2')) }
if ($env:CORE_NODE_CACHE_DIR) { $knownPaths.Add((Join-Path $env:CORE_NODE_CACHE_DIR 'pycore\voxcpm2')) }

$userProfile = $env:USERPROFILE
if ($userProfile) {
    $knownPaths.Add((Join-Path $userProfile '.cache\pycore\voxcpm2'))
    $knownPaths.Add((Join-Path $userProfile '.core_node\cache\pycore\voxcpm2'))
}

Write-ScanLine ("{0} [..] probing known canonical paths ..." -f $scriptIndex) ([ConsoleColor]::DarkGray)
Add-KnownPathCandidates -Candidates $knownPaths.ToArray()

foreach ($drive in $Drives) {
    Search-DriveForVoxcpm2 -DriveLetter $drive -DepthLimit $MaxDepth
}

Write-ScanLine '------------------------------------------------------------' ([ConsoleColor]::Cyan)
Write-ScanLine ("{0}  directories visited : {1}" -f $scriptIndex, $dirCount) ([ConsoleColor]::DarkGray)
Write-ScanLine ("{0}  skipped (no access) : {1}" -f $scriptIndex, $skipCount) ([ConsoleColor]::DarkGray)
Write-ScanLine ("{0}  hits                  : {1}" -f $scriptIndex, $found.Count) ([ConsoleColor]::DarkGray)

if ($found.Count -eq 0) {
    Write-ScanLine ("{0} [i] no VoxCPM2 install directories found." -f $scriptIndex) ([ConsoleColor]::Yellow)
    exit 0
}

$sorted = $found | Sort-Object -Property @{ Expression = { $_.Score }; Descending = $true }, Path
$index = 0
foreach ($hit in $sorted) {
    $index++
    $isCanonical = $false
    if ($canonicalPath) {
        $isCanonical = ($hit.Path -ieq $canonicalPath)
    }
    $tag = if ($isCanonical) { ' [canonical]' } else { '' }
    Write-ScanLine '' ([ConsoleColor]::Gray)
    Write-ScanLine ("{0} [{1}] {2}{3}" -f $scriptIndex, $index, $hit.Path, $tag) ([ConsoleColor]::Green)
    Write-ScanLine ("{0}      score            : {1}/4" -f $scriptIndex, $hit.Score) ([ConsoleColor]::DarkGray)
    Write-ScanLine ("{0}      .deps_done       : {1}" -f $scriptIndex, $(if ($hit.HasDepsDone) { 'yes' } else { 'no' })) ([ConsoleColor]::DarkGray)
    Write-ScanLine ("{0}      .model_installed : {1}" -f $scriptIndex, $(if ($hit.HasModelInstalled) { 'yes' } else { 'no' })) ([ConsoleColor]::DarkGray)
    Write-ScanLine ("{0}      weights/         : {1} ({2} weight files)" -f $scriptIndex, $(if ($hit.HasWeightsDir) { 'yes' } else { 'no' }), $hit.WeightFileCount) ([ConsoleColor]::DarkGray)
    if ($hit.ModelId) {
        Write-ScanLine ("{0}      model id         : {1}" -f $scriptIndex, $hit.ModelId) ([ConsoleColor]::DarkGray)
    }
    if ($hit.DepsDoneTimestamp) {
        Write-ScanLine ("{0}      deps timestamp   : {1}" -f $scriptIndex, $hit.DepsDoneTimestamp) ([ConsoleColor]::DarkGray)
    }
    Write-ScanLine ("{0}      total size       : {1}" -f $scriptIndex, (Format-ByteSize -Bytes $hit.TotalBytes)) ([ConsoleColor]::DarkGray)
    Write-ScanLine ("{0}      weights size     : {1}" -f $scriptIndex, (Format-ByteSize -Bytes $hit.WeightsBytes)) ([ConsoleColor]::DarkGray)
}

Write-ScanLine '' ([ConsoleColor]::Gray)
Write-ScanLine ("{0} [OK] scan complete." -f $scriptIndex) ([ConsoleColor]::Green)
