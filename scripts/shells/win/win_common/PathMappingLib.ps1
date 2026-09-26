# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

<#
.SYNOPSIS
    Idempotent Windows directory path mapping via NTFS directory junctions (mklink /J).

.DESCRIPTION
    Maps link path A to target path B:
      1. Detect occupying processes / locked files and abort with a warning.
      2. If A is a real directory, move it to B only when B is absent.
         When B exists, copy only missing content and retain A under a timestamped backup name.
      3. Remove A only when it is an empty location or stale junction.
      4. Create directory junction A -> B with mklink /J.

    Safe to run repeatedly. Uses absolute paths only.
    Reference: mklink /J creates a directory junction (reparse point) on NTFS.
#>

#region Logging
function Write-PathMapLog {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [Parameter()]
        [string]$Type = "Info"
    )

    if (Get-Command Write-ColorMessage -ErrorAction SilentlyContinue) {
        Write-ColorMessage -Message "[PathMap] $Message" -Type $Type
        return
    }

    $color = switch ($Type) {
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error"   { "Red" }
        default   { "Cyan" }
    }
    Write-Host "[PathMap] $Message" -ForegroundColor $color
}
#endregion

#region Path helpers
function New-PathMappingDirectoryIfNotExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
        Write-PathMapLog -Message "Created directory: $Path" -Type "Success"
        return $true
    }
    return $false
}

function Get-NormalizedPathMappingLocation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $trimmed = $Path.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed)) {
        throw "Path is empty."
    }

    return [System.IO.Path]::GetFullPath($trimmed)
}

function Test-PathMappingLocationsEqual {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LeftPath,
        [Parameter(Mandatory = $true)]
        [string]$RightPath
    )

    $left = Get-NormalizedPathMappingLocation -Path $LeftPath
    $right = Get-NormalizedPathMappingLocation -Path $RightPath
    return ($left -eq $right)
}

function Test-PathIsDirectoryJunction {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $false
    }

    try {
        $item = Get-Item -LiteralPath $Path -Force
        if (-not $item.PSIsContainer) {
            return $false
        }
        return [bool]($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
    }
    catch {
        return $false
    }
}

function Get-DirectoryJunctionTarget {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-PathIsDirectoryJunction -Path $Path)) {
        return $null
    }

    try {
        $target = (Get-Item -LiteralPath $Path -Force).Target
        if ($null -eq $target) {
            return $null
        }
        if ($target -is [System.Array]) {
            if ($target.Count -gt 0) {
                return Get-NormalizedPathMappingLocation -Path $target[0]
            }
            return $null
        }
        return Get-NormalizedPathMappingLocation -Path $target
    }
    catch {
        return $null
    }
}
#endregion

#region Occupancy detection
function Get-PathMappingOccupyingProcesses {
    param(
        [Parameter()]
        [string[]]$ProcessNames = @()
    )

    $found = @()
    foreach ($processName in $ProcessNames) {
        if ([string]::IsNullOrWhiteSpace($processName)) {
            continue
        }
        $matches = @(Get-Process -Name $processName -ErrorAction SilentlyContinue)
        if ($matches.Count -gt 0) {
            $found += $matches
        }
    }

    return @($found | Sort-Object -Property Id -Unique)
}

function Test-PathMappingEntryIsReparsePoint {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.FileSystemInfo]$Entry
    )

    return [bool]($Entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
}

function Get-PathMappingExceptionRoot {
    param(
        [Parameter(Mandatory = $true)]
        [System.Exception]$Exception
    )

    $root = $Exception
    while ($null -ne $root.InnerException) {
        $root = $root.InnerException
    }
    return $root
}

function Test-PathMappingFileOpenIndicatesLock {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    try {
        $stream = [System.IO.File]::Open(
            $Path,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            [System.IO.FileShare]::None
        )
        $stream.Close()
        $stream.Dispose()
        return $false
    }
    catch {
        $root = Get-PathMappingExceptionRoot -Exception $_.Exception

        if ($root -is [System.IO.FileNotFoundException] -or
            $root -is [System.IO.DirectoryNotFoundException]) {
            return $false
        }

        if ($root -is [System.IO.IOException]) {
            # ERROR_SHARING_VIOLATION (32 / 0x20)
            if ($root.HResult -eq -2147024864) {
                return $true
            }

            $message = [string]$root.Message
            if ($message -match 'sharing violation|being used by another process|used because it is being used') {
                return $true
            }

            if ($message -match 'Could not find a part of the path') {
                return $false
            }
        }

        return $false
    }
}

function Test-PathMappingDirectoryHasLockedChildren {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        return $false
    }

    $stack = New-Object System.Collections.Stack
    $stack.Push($Path)

    while ($stack.Count -gt 0) {
        $currentDir = [string]$stack.Pop()
        $entries = @(Get-ChildItem -LiteralPath $currentDir -Force -ErrorAction SilentlyContinue)

        foreach ($entry in $entries) {
            if ($entry.PSIsContainer) {
                $stack.Push($entry.FullName)
                continue
            }

            if (Test-PathMappingEntryIsReparsePoint -Entry $entry) {
                continue
            }

            if (-not (Test-Path -LiteralPath $entry.FullName)) {
                continue
            }

            if (Test-PathMappingFileOpenIndicatesLock -Path $entry.FullName) {
                return $true
            }
        }
    }

    return $false
}

function Test-PathMappingDirectoryOccupied {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter()]
        [string[]]$ProcessNames = @()
    )

    $occupyingProcesses = @(Get-PathMappingOccupyingProcesses -ProcessNames $ProcessNames)
    $hasLockedChildren = Test-PathMappingDirectoryHasLockedChildren -Path $Path

    return @{
        IsOccupied = ($occupyingProcesses.Count -gt 0) -or $hasLockedChildren
        Processes = $occupyingProcesses
        HasLockedChildren = $hasLockedChildren
    }
}

function Write-PathMappingOccupancyWarning {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [hashtable]$Occupancy
    )

    Write-PathMapLog -Message "Directory is in use and cannot be moved yet: $Path" -Type "Warning"

    if ($Occupancy.Processes.Count -gt 0) {
        $grouped = $Occupancy.Processes | Group-Object -Property ProcessName
        $processSummary = ($grouped | ForEach-Object {
            if ($_.Count -gt 1) {
                "$($_.Name) ($($_.Count) processes)"
            }
            else {
                $proc = $_.Group[0]
                "$($proc.ProcessName) (PID $($proc.Id))"
            }
        }) -join ", "
        Write-PathMapLog -Message "Close these processes first: $processSummary" -Type "Warning"
    }

    if ($Occupancy.HasLockedChildren) {
        Write-PathMapLog -Message "One or more files under $Path are locked by another process." -Type "Warning"
    }

    Write-PathMapLog -Message "Stop the apps above, then run Path Mapping again." -Type "Warning"
}
#endregion

#region Junction + move
function Replace-TargetDirectoryWithSourceForPathMapping {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    $source = Get-NormalizedPathMappingLocation -Path $SourcePath
    $target = Get-NormalizedPathMappingLocation -Path $TargetPath
    $sourceParent = Split-Path -Path $source -Parent
    $sourceLeaf = Split-Path -Path $source -Leaf
    $backupName = '{0}.migrated_{1}' -f $sourceLeaf, (Get-Date -Format 'yyyyMMddHHmmssfff')
    $backupPath = Join-Path $sourceParent $backupName
    $copyOk = $false

    if (-not (Test-Path -LiteralPath $target -PathType Container)) {
        Write-PathMapLog -Message "Target is not a directory, cannot replace: $target" -Type "Error"
        return $false
    }

    Write-PathMapLog -Message "Both directories exist; copying only missing content: $source -> $target" -Type "Info"
    $copyOk = Copy-MissingPathMappingContent -SourcePath $source -TargetPath $target
    if (-not $copyOk) {
        return $false
    }

    try {
        Rename-Item -LiteralPath $source -NewName $backupName -ErrorAction Stop
        Write-PathMapLog -Message "Legacy source retained for recovery: $backupPath" -Type "Success"
        return $true
    }
    catch {
        Write-PathMapLog -Message "Failed to retain legacy source as $backupPath : $($_.Exception.Message)" -Type "Error"
        return $false
    }
}

function Move-EntireDirectoryForPathMapping {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath,
        [Parameter()]
        [string[]]$OccupyingProcessNames = @(),
        [Parameter()]
        [switch]$SkipIfOccupied
    )

    $source = Get-NormalizedPathMappingLocation -Path $SourcePath
    $target = Get-NormalizedPathMappingLocation -Path $TargetPath

    if (-not (Test-Path -LiteralPath $source -PathType Container)) {
        Write-PathMapLog -Message "Source is not a directory, skip move: $source" -Type "Info"
        return $true
    }

    if (Test-PathIsDirectoryJunction -Path $source) {
        Write-PathMapLog -Message "Source is already a junction, skip move: $source" -Type "Info"
        return $true
    }

    $occupancy = Test-PathMappingDirectoryOccupied -Path $source -ProcessNames $OccupyingProcessNames
    if ($occupancy.IsOccupied) {
        Write-PathMappingOccupancyWarning -Path $source -Occupancy $occupancy
        if ($SkipIfOccupied) {
            Write-PathMapLog -Message "Skipping occupied directory (non-blocking): $source" -Type "Warning"
            return $true
        }
        return $false
    }

    $parentDir = Split-Path -Path $target -Parent
    if ($parentDir) {
        New-PathMappingDirectoryIfNotExists -Path $parentDir
    }

    if (-not (Test-Path -LiteralPath $target)) {
        Write-PathMapLog -Message "Moving entire directory: $source -> $target" -Type "Info"
        try {
            Move-Item -LiteralPath $source -Destination $target -Force -ErrorAction Stop
            Write-PathMapLog -Message "Entire directory moved: $source -> $target" -Type "Success"
            return $true
        }
        catch {
            Write-PathMapLog -Message "Failed to move entire directory $source -> $target : $($_.Exception.Message)" -Type "Error"
            return $false
        }
    }

    Write-PathMapLog -Message "Target already exists; starting non-overwriting merge: $source -> $target" -Type "Warning"
    return (Replace-TargetDirectoryWithSourceForPathMapping -SourcePath $source -TargetPath $target)
}

function Remove-PathMappingLinkLocation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return $true
    }

    try {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
    }
    catch {
        $parentDir = Split-Path -Path $Path -Parent
        $baseName = Split-Path -Path $Path -Leaf
        $relocateName = "${baseName}.migrate_pending_$(Get-Date -Format 'yyyyMMddHHmmss')"
        $relocatePath = Join-Path $parentDir $relocateName

        try {
            Rename-Item -LiteralPath $Path -NewName $relocateName -ErrorAction Stop
            Write-PathMapLog -Message "Could not delete $Path (files in use). Renamed to $relocatePath — delete manually after closing apps (e.g. Cursor)." -Type "Warning"
            return $true
        }
        catch {
            Write-PathMapLog -Message "Failed to remove or relocate $Path : $($_.Exception.Message)" -Type "Error"
            return $false
        }
    }

    if (Test-Path -LiteralPath $Path) {
        $parentDir = Split-Path -Path $Path -Parent
        $baseName = Split-Path -Path $Path -Leaf
        $relocateName = "${baseName}.migrate_pending_$(Get-Date -Format 'yyyyMMddHHmmss')"
        $relocatePath = Join-Path $parentDir $relocateName

        try {
            Rename-Item -LiteralPath $Path -NewName $relocateName -ErrorAction Stop
            Write-PathMapLog -Message "Path still present after remove (files in use). Renamed to $relocatePath — delete manually after closing apps." -Type "Warning"
            return $true
        }
        catch {
            Write-PathMapLog -Message "Path still exists and could not be relocated: $Path" -Type "Error"
            return $false
        }
    }

    return $true
}

function Set-IdempotentDirectoryJunction {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LinkPath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    $link = Get-NormalizedPathMappingLocation -Path $LinkPath
    $target = Get-NormalizedPathMappingLocation -Path $TargetPath

    if (Test-Path -LiteralPath $link) {
        if (Test-PathIsDirectoryJunction -Path $link) {
            $currentTarget = Get-DirectoryJunctionTarget -Path $link
            if ($currentTarget -and (Test-PathMappingLocationsEqual -LeftPath $currentTarget -RightPath $target)) {
                Write-PathMapLog -Message "Junction already valid: $link -> $target" -Type "Success"
                return $true
            }
            Write-PathMapLog -Message "Removing stale junction: $link (target=$currentTarget)" -Type "Warning"
        }
        else {
            Write-PathMapLog -Message "Removing existing non-junction path: $link" -Type "Warning"
        }

        if (-not (Remove-PathMappingLinkLocation -Path $link)) {
            return $false
        }
    }

    $parentDir = Split-Path -Path $link -Parent
    if ($parentDir) {
        New-PathMappingDirectoryIfNotExists -Path $parentDir
    }
    New-PathMappingDirectoryIfNotExists -Path $target

    if (-not (Test-Path -LiteralPath $target -PathType Container)) {
        Write-PathMapLog -Message "Target directory missing: $target" -Type "Error"
        return $false
    }

    Write-PathMapLog -Message "Creating junction: $link -> $target (mklink /J)" -Type "Info"
    cmd /c mklink /J "$link" "$target"
    if (-not (Test-PathIsDirectoryJunction -Path $link)) {
        Write-PathMapLog -Message "mklink /J did not create the expected junction: $link -> $target" -Type "Error"
        return $false
    }

    Write-PathMapLog -Message "Junction created: $link -> $target" -Type "Success"
    return $true
}

function Copy-MissingPathMappingContent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SourcePath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    $source = Get-NormalizedPathMappingLocation -Path $SourcePath
    $target = Get-NormalizedPathMappingLocation -Path $TargetPath
    $robocopyArgs = @()
    $robocopyExitCode = 0

    if (-not (Test-Path -LiteralPath $source -PathType Container)) {
        return $true
    }

    New-PathMappingDirectoryIfNotExists -Path $target | Out-Null
    $robocopyArgs = @(
        $source,
        $target,
        '/E',
        '/XC',
        '/XN',
        '/XO',
        '/R:1',
        '/W:1',
        '/NFL',
        '/NDL',
        '/NJH',
        '/NJS',
        '/NP'
    )
    & robocopy @robocopyArgs | Out-Null
    $robocopyExitCode = $LASTEXITCODE
    if ($robocopyExitCode -ge 8) {
        Write-PathMapLog -Message "Failed to copy missing migration data: $source -> $target (robocopy $robocopyExitCode)" -Type "Error"
        return $false
    }
    return $true
}

function Sync-LegacyCoreNodeRuntimeData {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LegacyRoot,
        [Parameter(Mandatory = $true)]
        [string]$CanonicalRoot,
        [Parameter(Mandatory = $true)]
        [string]$UserName
    )

    $directoryMappings = @()
    $fileMappings = @()
    $migrationStateDir = Join-Path (Join-Path $CanonicalRoot 'data') 'migration_state'
    $markerName = 'windows_profile_{0}_v3.complete' -f $UserName
    $markerPath = Join-Path $migrationStateDir $markerName
    $sourcePath = ''
    $targetPath = ''
    $allOk = $true

    if ((Test-Path -LiteralPath $markerPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $LegacyRoot -PathType Container)) {
        return $true
    }

    $directoryMappings = @(
        @{ Source = 'config'; Target = 'config' },
        @{ Source = '.config'; Target = 'config' },
        @{ Source = 'data'; Target = 'data' },
        @{ Source = 'cache'; Target = 'cache' },
        @{ Source = 'logs'; Target = 'logs' },
        @{ Source = 'ui_state'; Target = 'ui_state' },
        @{ Source = 'pytools'; Target = 'pytools' },
        @{ Source = 'launch_multiple'; Target = 'launch_multiple' },
        @{ Source = '.build_global_vars'; Target = 'build_global_vars' },
        @{ Source = '.app_installed_flag'; Target = 'app_installed_flag' },
        @{ Source = '.git_config'; Target = 'git_config' },
        @{ Source = '.scripts'; Target = 'scripts' }
    )
    $fileMappings = @(
        @{ Source = '.git_set'; Target = 'git_set' },
        @{ Source = 'voc_annotator_config.json'; Target = 'voc_annotator_config.json' }
    )

    foreach ($mapping in $directoryMappings) {
        $sourcePath = Join-Path $LegacyRoot $mapping.Source
        $targetPath = Join-Path $CanonicalRoot $mapping.Target
        if (-not (Copy-MissingPathMappingContent -SourcePath $sourcePath -TargetPath $targetPath)) {
            $allOk = $false
        }
    }

    foreach ($mapping in $fileMappings) {
        $sourcePath = Join-Path $LegacyRoot $mapping.Source
        $targetPath = Join-Path $CanonicalRoot $mapping.Target
        if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf) -or (Test-Path -LiteralPath $targetPath)) {
            continue
        }
        try {
            Copy-Item -LiteralPath $sourcePath -Destination $targetPath -ErrorAction Stop
        }
        catch {
            Write-PathMapLog -Message "Failed to copy legacy file: $sourcePath -> $targetPath : $($_.Exception.Message)" -Type "Error"
            $allOk = $false
        }
    }

    if ($allOk) {
        New-PathMappingDirectoryIfNotExists -Path $migrationStateDir | Out-Null
        Set-Content -LiteralPath $markerPath -Value 'complete' -NoNewline
    }
    return $allOk
}

function Sync-LegacyUserCacheData {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LegacyRoot,
        [Parameter(Mandatory = $true)]
        [string]$CanonicalRoot,
        [Parameter(Mandatory = $true)]
        [string]$RuntimeDataRoot,
        [Parameter(Mandatory = $true)]
        [string]$UserName
    )

    $migrationStateDir = Join-Path (Join-Path $RuntimeDataRoot 'data') 'migration_state'
    $markerName = 'windows_cache_{0}_v3.complete' -f $UserName
    $markerPath = Join-Path $migrationStateDir $markerName
    $copyOk = $true

    if ((Test-Path -LiteralPath $markerPath -PathType Leaf) -or
        -not (Test-Path -LiteralPath $LegacyRoot -PathType Container)) {
        return $true
    }

    $copyOk = Copy-MissingPathMappingContent -SourcePath $LegacyRoot -TargetPath $CanonicalRoot
    if ($copyOk) {
        New-PathMappingDirectoryIfNotExists -Path $migrationStateDir | Out-Null
        Set-Content -LiteralPath $markerPath -Value 'complete' -NoNewline
    }
    return $copyOk
}
#endregion

#region Public API
function Invoke-IdempotentPathMapping {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LinkPath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath,
        [Parameter()]
        [string[]]$OccupyingProcessNames = @(),
        [Parameter()]
        [switch]$SkipIfOccupied
    )

    $link = Get-NormalizedPathMappingLocation -Path $LinkPath
    $target = Get-NormalizedPathMappingLocation -Path $TargetPath

    if (Test-PathMappingLocationsEqual -LeftPath $link -RightPath $target) {
        Write-PathMapLog -Message "Link and target are the same path: $link" -Type "Error"
        return $false
    }

    Write-PathMapLog -Message "Mapping $link -> $target" -Type "Info"

    if (Test-Path -LiteralPath $link) {
        if (Test-PathIsDirectoryJunction -Path $link) {
            $currentTarget = Get-DirectoryJunctionTarget -Path $link
            if ($currentTarget -and (Test-PathMappingLocationsEqual -LeftPath $currentTarget -RightPath $target)) {
                Write-PathMapLog -Message "Already mapped (idempotent): $link -> $target" -Type "Success"
                return $true
            }

            Write-PathMapLog -Message "Removing stale junction: $link (target=$currentTarget)" -Type "Warning"
            if (-not (Remove-PathMappingLinkLocation -Path $link)) {
                if ($SkipIfOccupied) {
                    Write-PathMapLog -Message "Skipping occupied directory (non-blocking): $link" -Type "Warning"
                    return $true
                }
                return $false
            }
        }
        elseif (Test-Path -LiteralPath $link -PathType Container) {
            $occupancy = Test-PathMappingDirectoryOccupied -Path $link -ProcessNames $OccupyingProcessNames
            if ($occupancy.IsOccupied) {
                Write-PathMappingOccupancyWarning -Path $link -Occupancy $occupancy
                if ($SkipIfOccupied) {
                    Write-PathMapLog -Message "Skipping occupied directory (non-blocking): $link" -Type "Warning"
                    return $true
                }
                return $false
            }

            $moveOk = Move-EntireDirectoryForPathMapping -SourcePath $link -TargetPath $target -OccupyingProcessNames $OccupyingProcessNames -SkipIfOccupied:$SkipIfOccupied
            if (-not $moveOk) {
                return $false
            }
            if (-not (Remove-PathMappingLinkLocation -Path $link)) {
                if ($SkipIfOccupied) {
                    Write-PathMapLog -Message "Skipping occupied directory (non-blocking): $link" -Type "Warning"
                    return $true
                }
                return $false
            }
        }
        else {
            Write-PathMapLog -Message "Link path exists but is not a directory: $link" -Type "Error"
            return $false
        }
    }

    if (Test-Path -LiteralPath $link) {
        if ($SkipIfOccupied) {
            Write-PathMapLog -Message "Skipping occupied directory (non-blocking): $link" -Type "Warning"
            return $true
        }
        Write-PathMapLog -Message "Link path still present before junction create: $link" -Type "Error"
        return $false
    }

    return (Set-IdempotentDirectoryJunction -LinkPath $link -TargetPath $target)
}

function Get-UserProfileDotFolderOccupyingProcessNames {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FolderName
    )

    $knownProcessNames = @{
        ".cursor" = @("Cursor")
        ".devin"  = @("Devin")
    }

    if ($knownProcessNames.ContainsKey($FolderName)) {
        return @($knownProcessNames[$FolderName])
    }

    return @()
}

function Get-DefaultUserProfilePathMappings {
    param(
        [Parameter()]
        [string]$UserName = $env:USERNAME
    )

    $profileRoot = Join-Path $env:USERPROFILE ""
    $profileRoot = Get-NormalizedPathMappingLocation -Path $profileRoot
    $programingUserRoot = Join-Path $Global:PROGRAMING_USERS_DIR $UserName
    $canonicalRuntimeRoot = $Global:CORE_NODE_DATA_DIR
    $canonicalCacheRoot = $Global:CORE_NODE_CACHE_DIR
    $legacyRuntimeRoot = Join-Path $programingUserRoot '.core_node'
    $legacyCacheRoot = Join-Path $programingUserRoot '.cache'
    $skipFolderNames = @(".ssh")
    $mappings = @()
    $targetPath = ''
    $dotDirs = @()
    $dir = $null
    $extendedFolderNames = @()
    $folderName = ''
    $linkPath = ''
    $runtimeMigrationOk = $false
    $cacheMigrationOk = $false

    $runtimeMigrationOk = Sync-LegacyCoreNodeRuntimeData -LegacyRoot $legacyRuntimeRoot -CanonicalRoot $canonicalRuntimeRoot -UserName $UserName
    $cacheMigrationOk = Sync-LegacyUserCacheData -LegacyRoot $legacyCacheRoot -CanonicalRoot $canonicalCacheRoot -RuntimeDataRoot $canonicalRuntimeRoot -UserName $UserName

    if ($runtimeMigrationOk) {
        $mappings += @{
            Name = '.core_node'
            LinkPath = Join-Path $profileRoot '.core_node'
            TargetPath = $canonicalRuntimeRoot
            OccupyingProcessNames = @()
        }
    }
    else {
        Write-PathMapLog -Message "Runtime data migration failed; .core_node mapping was skipped." -Type "Error"
    }
    if ($cacheMigrationOk) {
        $mappings += @{
            Name = '.cache'
            LinkPath = Join-Path $profileRoot '.cache'
            TargetPath = $canonicalCacheRoot
            OccupyingProcessNames = @()
        }
    }
    else {
        Write-PathMapLog -Message "Cache migration failed; .cache mapping was skipped." -Type "Error"
    }

    # Dot-prefixed directories (auto-discovered)
    $dotDirs = @(Get-ChildItem -LiteralPath $profileRoot -Directory -Force -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name.StartsWith('.') -and
            ($skipFolderNames -notcontains $_.Name) -and
            $_.Name -ne '.core_node' -and
            $_.Name -ne '.cache'
        } |
        Sort-Object -Property Name)

    foreach ($dir in $dotDirs) {
        $targetPath = Join-Path $programingUserRoot $dir.Name
        $mappings += @{
            Name = $dir.Name
            LinkPath = $dir.FullName
            TargetPath = $targetPath
            OccupyingProcessNames = @(Get-UserProfileDotFolderOccupyingProcessNames -FolderName $dir.Name)
        }
    }

    # Extended directories (non-dot-prefixed, explicitly listed)
    $extendedFolderNames = @(
        "pipx",
        "go",
        "xwechat_files",
        "ZCodeProject"
    )

    foreach ($folderName in $extendedFolderNames) {
        $linkPath = Join-Path $profileRoot $folderName
        if (-not (Test-Path -LiteralPath $linkPath -PathType Container)) {
            continue
        }
        $mappings += @{
            Name = $folderName
            LinkPath = $linkPath
            TargetPath = Join-Path $programingUserRoot $folderName
            OccupyingProcessNames = @()
        }
    }

    return $mappings
}

function Invoke-DefaultUserProfilePathMappings {
    param(
        [Parameter()]
        [string]$UserName = $env:USERNAME
    )

    $mappings = @(Get-DefaultUserProfilePathMappings -UserName $UserName)
    $allOk = $true

    if ($mappings.Count -eq 0) {
        Write-PathMapLog -Message "No dot-prefixed folders found under $env:USERPROFILE (excluding .ssh)." -Type "Info"
        return $true
    }

    foreach ($entry in $mappings) {
        Write-PathMapLog -Message "---- $($entry.Name) ----" -Type "Info"
        $processNames = @()
        if ($entry.ContainsKey("OccupyingProcessNames") -and $entry.OccupyingProcessNames) {
            $processNames = @($entry.OccupyingProcessNames)
        }
        $ok = Invoke-IdempotentPathMapping -LinkPath $entry.LinkPath -TargetPath $entry.TargetPath -OccupyingProcessNames $processNames -SkipIfOccupied
        if (-not $ok) {
            $allOk = $false
        }
    }

    if ($allOk) {
        Write-PathMapLog -Message "All default user profile path mappings are ready." -Type "Success"
    }
    else {
        Write-PathMapLog -Message "One or more path mappings failed." -Type "Error"
    }

    return $allOk
}
#endregion
