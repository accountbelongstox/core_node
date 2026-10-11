#
# SharedCacheEnv.ps1 - wire the ONE shared user-cache root on Windows.
#
# Replaces C:\Users\{username}\.cache with D:\www\cache (subpaths unchanged).
# Mirrors linux/common/shared_cache_env.sh: idempotent, respects caller overrides,
# sets HF_HOME / HF_HUB_CACHE / TORCH_HOME / PIP_CACHE_DIR / XDG_CACHE_HOME env vars.
# Does NOT set deprecated TRANSFORMERS_CACHE (transformers v5 uses HF_HOME only).
#
# Declares the Windows 3-drive constants (system/data/program) and the
# per-drive namespace roots (config/service_contract.json paths.drive_layout,
# amended by D28/D30: namespaces, tool_root, cache_root, trees_root,
# toolchain_env_file). Detection/computation only at load time -- never
# creates directories or writes anything on the program drive here;
# first-adoption (writing the E: marker) and namespace-directory creation are
# separate installer-only helpers below.

$__sccServiceContractPath = Join-Path $PSScriptRoot 'ServiceContract.ps1'

# Referenced by functions below that installers may call long after this
# file's own load-time temp variables (the "__scc*" ones) are removed, so it
# is a Global constant rather than one of those temp variables.
$Global:CN_PROGRAM_DRIVE_MARKER_FILE_NAME = '.cn_volume'

# Mirrors the system-name branches GlobalVars.ps1 computes inline for
# $Global:LANG_COMPILER_DIR ("win11"/"win10"/"win_8"/"win_7"/"win" from
# Win32_OperatingSystem). Duplicated here (same CIM source, same thresholds)
# because this file is loaded before GlobalVars.ps1 computes its own value,
# so CN_TOOL_ROOT cannot read it back from there.
function Get-CnWindowsSystemName {
    $cnSystemName = 'win'
    try {
        $cnOsInfo = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop
        $cnWinVersion = [string]$cnOsInfo.Version
        $cnWinBuildNumber = [int]$cnOsInfo.BuildNumber
        if ($cnWinBuildNumber -ge 22000) {
            $cnSystemName = 'win11'
        }
        elseif ($cnWinVersion.StartsWith('10.0')) {
            $cnSystemName = 'win10'
        }
        elseif ($cnWinVersion.StartsWith('6.3')) {
            $cnSystemName = 'win_8'
        }
        elseif ($cnWinVersion.StartsWith('6.2')) {
            $cnSystemName = 'win_8'
        }
        elseif ($cnWinVersion.StartsWith('6.1')) {
            $cnSystemName = 'win_7'
        }
        else {
            $cnSystemName = 'win'
        }
    }
    catch {
        $cnSystemName = 'win'
    }

    return $cnSystemName
}

# Resolves a paths.drive_layout template (e.g. "<program_drive>\_<sys>_dev")
# against a set of literal replacements, then normalizes it. Every replacement
# value is already fully qualified (a drive root or a previously resolved
# path), so GetFullPath only normalizes -- it never touches the filesystem.
function Resolve-CnDriveLayoutPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Template,
        [Parameter(Mandatory = $true)]
        [hashtable]$Replacements
    )

    $cnResolvedPath = $Template
    foreach ($cnPlaceholder in $Replacements.Keys) {
        $cnResolvedPath = $cnResolvedPath.Replace($cnPlaceholder, [string]$Replacements[$cnPlaceholder])
    }

    return [System.IO.Path]::GetFullPath($cnResolvedPath)
}

# .NET's Path.GetFullPath honors a hidden per-drive "current directory" for a
# bare drive letter (e.g. "D:" resolves against wherever the process last cd'd
# on D:, not the drive root). DriveInfo.RootDirectory is unaffected by that and
# always returns the true root, whether or not the drive is even present.
function Get-CnDriveRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DriveSpec
    )

    return [System.IO.DriveInfo]::new($DriveSpec).RootDirectory.FullName
}

function Get-CnProgramDrivePartitionGuid {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DriveLetter
    )

    # Normalized (lowercase, no braces) so it matches both the Linux
    # PARTUUID form and whatever this same function returns on a later call;
    # the marker file and the live value it is compared against therefore
    # always share one format. MSFT_Partition.Guid is NULL for a non-GPT
    # (MBR) disk and this returns '' in that case, same as on any other
    # failure (including a non-elevated caller, which the Storage CIM
    # provider always refuses).
    $cnPartitionGuid = ''
    try {
        $cnPartition = Get-Partition -DriveLetter $DriveLetter -ErrorAction Stop
        $cnRawPartitionGuid = [string]$cnPartition.Guid
        if ($cnRawPartitionGuid) {
            $cnPartitionGuid = $cnRawPartitionGuid.Trim('{', '}').ToLowerInvariant()
        }
    }
    catch {
        $cnPartitionGuid = ''
    }

    return $cnPartitionGuid
}

# Language-independent E: qualification (docs_fix/DESIGN_SHELL_HOSTS.md
# section 4.1, amended by user D27: no separate tree root/subdir on any OS,
# so the marker lives directly at the drive root instead of under a tree
# subdir): ready + Fixed + NTFS/ReFS, and, when the marker already exists,
# its content must match the drive's current partition GUID. A qualifying
# drive with no marker yet is the first-adoption case (still qualifies here;
# Register-CnProgramDriveAdoption below writes the marker later, from an
# installer, never from this load-time check).
#
# Get-Partition needs an elevated token: the Storage CIM provider denies a
# standard one and Get-CnProgramDrivePartitionGuid then returns ''. When the
# marker already exists, that empty result is treated as "cannot verify", not
# "disqualified" -- an admin and a non-admin process must agree on the
# program root once E: has already been adopted. Only an elevated caller can
# still catch a swapped disk this way; a bare drive with no marker yet still
# needs a real GUID to be treated as adoptable.
function Test-CnProgramDriveQualifies {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DriveRoot,
        [Parameter(Mandatory = $true)]
        [string]$DriveLetter
    )

    $cnStructurallyReady = $false
    try {
        $cnDriveInfo = [System.IO.DriveInfo]::new($DriveRoot)
        if ($cnDriveInfo.IsReady -and $cnDriveInfo.DriveType -eq [System.IO.DriveType]::Fixed -and
            ($cnDriveInfo.DriveFormat -eq 'NTFS' -or $cnDriveInfo.DriveFormat -eq 'ReFS')) {
            $cnStructurallyReady = $true
        }
    }
    catch {
        $cnStructurallyReady = $false
    }

    if (-not $cnStructurallyReady) {
        return $false
    }

    $cnMarkerPath = Join-Path $DriveRoot $Global:CN_PROGRAM_DRIVE_MARKER_FILE_NAME
    $cnMarkerExists = Test-Path -LiteralPath $cnMarkerPath -PathType Leaf
    $cnPartitionGuid = Get-CnProgramDrivePartitionGuid -DriveLetter $DriveLetter

    if (-not $cnMarkerExists) {
        return [bool]$cnPartitionGuid
    }

    if (-not $cnPartitionGuid) {
        return $true
    }

    $cnMarkerContent = ''
    try {
        $cnMarkerContent = (Get-Content -LiteralPath $cnMarkerPath -Raw -ErrorAction Stop).Trim()
    }
    catch {
        return $false
    }

    return $cnMarkerContent -eq $cnPartitionGuid
}

# Installer-only: writes the first-adoption marker (drive partition GUID) at
# <DriveRoot>\.cn_volume. Never called at load time; the caller is always an
# installer/ensure step, once it has decided to adopt this drive. No
# directory is created here (user D27: no tree subdir on any OS) -- the
# marker sits directly at the drive root, which already exists for any drive
# that reached this point (Test-CnProgramDriveQualifies confirmed it ready).
function Register-CnProgramDriveAdoption {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DriveRoot,
        [Parameter(Mandatory = $true)]
        [string]$DriveLetter
    )

    $cnPartitionGuid = Get-CnProgramDrivePartitionGuid -DriveLetter $DriveLetter
    if (-not $cnPartitionGuid) {
        throw "Cannot resolve a GPT partition GUID for drive letter ${DriveLetter}: adopting it as the program drive requires a GPT-partitioned NTFS or ReFS volume (an MBR disk reports no partition GUID), and reading it also requires an elevated process."
    }

    $cnMarkerPath = Join-Path $DriveRoot $Global:CN_PROGRAM_DRIVE_MARKER_FILE_NAME
    $cnExistingMarkerContent = ''
    if (Test-Path -LiteralPath $cnMarkerPath -PathType Leaf) {
        try {
            $cnExistingMarkerContent = (Get-Content -LiteralPath $cnMarkerPath -Raw -ErrorAction Stop).Trim()
        }
        catch {
            $cnExistingMarkerContent = ''
        }
    }
    if ($cnExistingMarkerContent -ne $cnPartitionGuid) {
        Set-Content -LiteralPath $cnMarkerPath -Value $cnPartitionGuid -Encoding ascii -NoNewline
    }

    return $cnPartitionGuid
}

# Installer-only: the single helper that creates a directory rooted under a
# drive namespace (DIRECTORY_NAMESPACE_RULES.md #2: "Create the namespace root
# itself idempotently, with one helper per OS"). Idempotent -- repairs only a
# missing directory, never resets an existing one -- and safe to call with a
# deep path: New-Item -Force creates every missing intermediate segment
# (including the namespace root itself, e.g. E:\_win10_dev) in one
# call. Never called at load time; today's only caller is
# ProjectTreeCommon.ps1's trees target under $Global:CN_TREES_ROOT, which this
# file never populates on the D: fallback, so this helper is never asked to
# create anything there.
function New-CnNamespaceDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

function Test-CnReparsePoint {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.FileSystemInfo]$Item
    )

    return [bool]($Item.Attributes -band [System.IO.FileAttributes]::ReparsePoint)
}

# Old D: path -> E: target pairs (contract paths.drive_layout.legacy_program_dirs).
# Empty on the D: fallback: there is nothing to map while E: does not qualify.
function Get-CnProgramDirectoryMappings {
    $cnMappings = @()
    if ($Global:WINDOWS_PROGRAM_DRIVE_IS_FALLBACK) {
        return $cnMappings
    }
    $cnMappings += [pscustomobject]@{ Name = 'LANG_COMPILER_DIR'; Legacy = $Global:CN_LEGACY_TOOL_ROOT; Target = $Global:CN_TOOL_ROOT; Superseded = $Global:CN_SUPERSEDED_TOOL_ROOTS }
    $cnMappings += [pscustomobject]@{ Name = 'APP_INSTALL_DIR'; Legacy = $Global:CN_LEGACY_APP_ROOT; Target = $Global:CN_APP_ROOT; Superseded = @() }
    $cnMappings += [pscustomobject]@{ Name = 'DOWNLOADS_DIR'; Legacy = $Global:CN_LEGACY_DOWNLOADS_ROOT; Target = $Global:CN_DOWNLOADS_ROOT; Superseded = @() }
    $cnMappings += [pscustomobject]@{ Name = 'DOWNLOADS_CACHE'; Legacy = $Global:CN_LEGACY_DOWNLOADS_CACHE; Target = $Global:CN_DOWNLOADS_ROOT; Superseded = @() }
    foreach ($cnSupersededDownloads in @($Global:CN_SUPERSEDED_DOWNLOADS_ROOTS)) {
        $cnMappings += [pscustomobject]@{ Name = 'DOWNLOADS_DIR'; Legacy = $cnSupersededDownloads; Target = $Global:CN_DOWNLOADS_ROOT; Superseded = @() }
    }
    $cnMappings += [pscustomobject]@{ Name = 'PIP_CACHE'; Legacy = $Global:CN_LEGACY_PIP_CACHE; Target = (Join-Path $Global:CN_CACHE_ROOT 'pip'); Superseded = @() }
    $cnMappings += [pscustomobject]@{ Name = 'PNPM_STORE'; Legacy = $Global:CN_LEGACY_PNPM_STORE; Target = (Join-Path $Global:CN_CACHE_ROOT $Global:CN_PNPM_STORE_SUBDIR); Superseded = @() }
    return $cnMappings
}

# Top-level entries of an old D: program dir that are data (models, drafts...;
# contract legacy_program_dirs.keep_patterns): never moved, never deleted.
function Test-CnLegacyKeepItem {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    foreach ($cnPattern in @($Global:CN_LEGACY_KEEP_PATTERNS)) {
        if ($Name -like $cnPattern) {
            return $true
        }
    }
    return $false
}

# Entry names already copied completely to the E: target (manifest_name file there).
function Get-CnMigratedNames {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    $cnManifestPath = Join-Path $TargetPath $Global:CN_LEGACY_MANIFEST_NAME
    if (-not (Test-Path -LiteralPath $cnManifestPath -PathType Leaf)) {
        return @()
    }
    return @(Get-Content -LiteralPath $cnManifestPath -ErrorAction SilentlyContinue | Where-Object { $_ })
}

function Add-CnMigratedName {
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetPath,
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (@(Get-CnMigratedNames -TargetPath $TargetPath) -notcontains $Name) {
        Add-Content -LiteralPath (Join-Path $TargetPath $Global:CN_LEGACY_MANIFEST_NAME) -Value $Name -Encoding utf8
    }
}

# Real (non-link) entries of the old D: dir: program entries still to handle,
# kept data excluded.
function Get-CnLegacyRealItems {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LegacyPath
    )

    return @(Get-ChildItem -LiteralPath $LegacyPath -Force -ErrorAction SilentlyContinue | Where-Object {
            -not (Test-CnReparsePoint -Item $_) -and -not (Test-CnLegacyKeepItem -Name $_.Name)
        })
}

# Program entries not yet copied completely to the E: target.
function Get-CnLegacyPendingItems {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LegacyPath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    $cnMigrated = @(Get-CnMigratedNames -TargetPath $TargetPath)
    return @(Get-CnLegacyRealItems -LegacyPath $LegacyPath | Where-Object { $cnMigrated -notcontains $_.Name })
}

# The program dir callers should use right now: the E: target once every
# program entry of the old D: dir is copied there completely, otherwise the old
# D: path (nothing on D: is deleted before that point).
function Resolve-CnMappedProgramDir {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LegacyPath,
        [string]$TargetPath = ''
    )

    if ($Global:WINDOWS_PROGRAM_DRIVE_IS_FALLBACK -or -not $TargetPath) {
        return $LegacyPath
    }
    $cnLegacyItem = Get-Item -LiteralPath $LegacyPath -Force -ErrorAction SilentlyContinue
    if ($cnLegacyItem -and -not (Test-CnReparsePoint -Item $cnLegacyItem) -and @(Get-CnLegacyPendingItems -LegacyPath $LegacyPath -TargetPath $TargetPath).Count -gt 0) {
        return $LegacyPath
    }
    return $TargetPath
}

function Get-CnProgramDriveStatus {
    $cnPending = @()
    if ($Global:WINDOWS_PROGRAM_DRIVE_IS_FALLBACK) {
        return [pscustomobject]@{
            Text  = ('Program drive: {0} not available; programs and builds stay on {1} ({2}, {3})' -f $Global:CN_PROGRAM_DRIVE_PRIMARY_LABEL, $Global:WINDOWS_PROGRAM_DRIVE_ROOT, $Global:CN_LEGACY_TOOL_ROOT, $Global:CN_LEGACY_APP_ROOT)
            Color = 'Yellow'
        }
    }
    foreach ($cnMapping in @(Get-CnProgramDirectoryMappings)) {
        if ((Resolve-CnMappedProgramDir -LegacyPath $cnMapping.Legacy -TargetPath $cnMapping.Target) -ne $cnMapping.Target) {
            $cnPending += ('{0} -> {1}' -f $cnMapping.Legacy, $cnMapping.Target)
        }
    }
    if ($cnPending.Count -gt 0) {
        return [pscustomobject]@{
            Text  = ('Program drive: Step 1 moves {0}, re-roots PATH and deletes the old D: dirs' -f ($cnPending -join ', '))
            Color = 'Yellow'
        }
    }
    return [pscustomobject]@{
        Text  = ('Program drive: {0}, {1}' -f $Global:CN_TOOL_ROOT, $Global:CN_APP_ROOT)
        Color = 'DarkGray'
    }
}

# Link to a path: a junction for a directory, a symlink for a file.
function New-CnLink {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LinkPath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    $cnLinkType = 'SymbolicLink'
    if (Test-Path -LiteralPath $TargetPath -PathType Container) {
        $cnLinkType = 'Junction'
    }
    New-Item -ItemType $cnLinkType -Path $LinkPath -Target $TargetPath -ErrorAction Stop | Out-Null
}

# Copies one tree with Copy-Item, file by file (in-use files that allow reading
# still copy). Links are never followed: each one is queued in $Links and made
# by New-CnCopiedLinks once the whole entry is copied. Files already copied
# (same size and time) are skipped, so a rerun resumes. Returns the number of
# failed files.
function Copy-CnTree {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination,
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.List[object]]$Links
    )

    $cnFailed = 0
    $cnSourceItem = Get-Item -LiteralPath $Source -Force

    if (Test-CnReparsePoint -Item $cnSourceItem) {
        $Links.Add([pscustomobject]@{ Source = $cnSourceItem; Destination = $Destination })
        return 0
    }

    if ($cnSourceItem -is [System.IO.FileInfo]) {
        $cnExisting = Get-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
        if ($cnExisting -and $cnExisting.Length -eq $cnSourceItem.Length -and $cnExisting.LastWriteTimeUtc -eq $cnSourceItem.LastWriteTimeUtc) {
            return 0
        }
        try {
            Copy-Item -LiteralPath $Source -Destination $Destination -Force -ErrorAction Stop
        }
        catch {
            Write-Warning ('[PROGRAM-DRIVE] Copy failed: {0} ({1})' -f $Source, $_.Exception.Message)
            $cnFailed++
        }
        return $cnFailed
    }

    New-CnNamespaceDirectory -Path $Destination
    foreach ($cnChild in @(Get-ChildItem -LiteralPath $Source -Force -ErrorAction Stop)) {
        $cnFailed += Copy-CnTree -Source $cnChild.FullName -Destination (Join-Path $Destination $cnChild.Name) -Links $Links
    }
    return $cnFailed
}

# Recreates queued links (scoop "current", persist links...) at their copied
# location, after every entry is copied; a target under the old root is
# re-rooted to the new root (the old root is deleted afterwards). Returns the
# number of links that could not be made.
function New-CnCopiedLinks {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.Collections.Generic.List[object]]$Links,
        [Parameter(Mandatory = $true)]
        [string]$OldRoot,
        [Parameter(Mandatory = $true)]
        [string]$NewRoot
    )

    $cnFailed = 0
    $cnOldPrefix = $OldRoot.TrimEnd('\') + '\'
    foreach ($cnLink in $Links) {
        $cnLinkTarget = [string](@($cnLink.Source.Target) | Select-Object -First 1)
        if (-not $cnLinkTarget -or (Test-Path -LiteralPath $cnLink.Destination)) {
            continue
        }
        if (-not [System.IO.Path]::IsPathRooted($cnLinkTarget)) {
            $cnLinkTarget = [System.IO.Path]::GetFullPath((Join-Path (Split-Path $cnLink.Destination -Parent) $cnLinkTarget))
        }
        if ($cnLinkTarget.StartsWith($cnOldPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            $cnLinkTarget = Join-Path $NewRoot $cnLinkTarget.Substring($cnOldPrefix.Length)
        }
        # A link whose target is gone carries nothing to keep: dropped, so the
        # installer steps reinstall what it pointed to.
        if (-not (Test-Path -LiteralPath $cnLinkTarget)) {
            Write-Warning ('[PROGRAM-DRIVE] Link {0} -> {1} is broken; dropped' -f $cnLink.Source.FullName, $cnLinkTarget)
            continue
        }
        try {
            New-CnLink -LinkPath $cnLink.Destination -TargetPath $cnLinkTarget
        }
        catch {
            Write-Warning ('[PROGRAM-DRIVE] Link {0} not recreated: {1}' -f $cnLink.Source.FullName, $_.Exception.Message)
            $cnFailed++
        }
    }
    return $cnFailed
}

# Bytes still to copy: source files missing on the target or differing in size.
function Get-CnPendingCopyBytes {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$Entries,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    $cnBytes = [long]0
    $cnSourcePrefix = ''
    $cnDestination = ''
    $cnExisting = $null

    foreach ($cnEntry in $Entries) {
        $cnSourcePrefix = (Split-Path $cnEntry.FullName -Parent).TrimEnd('\') + '\'
        $cnFiles = @($cnEntry)
        if ($cnEntry -is [System.IO.DirectoryInfo]) {
            $cnFiles = @(Get-ChildItem -LiteralPath $cnEntry.FullName -Recurse -Force -File -Attributes !ReparsePoint -ErrorAction SilentlyContinue)
        }
        foreach ($cnFile in $cnFiles) {
            $cnDestination = Join-Path $TargetPath $cnFile.FullName.Substring($cnSourcePrefix.Length)
            $cnExisting = Get-Item -LiteralPath $cnDestination -Force -ErrorAction SilentlyContinue
            if (-not $cnExisting -or $cnExisting.Length -ne $cnFile.Length) {
                $cnBytes += $cnFile.Length
            }
        }
    }
    return $cnBytes
}

# True when every regular file under $Source exists under $Destination with
# the same size (links are not compared). The gate before any D: deletion.
function Test-CnCopyComplete {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    $cnSourceItem = Get-Item -LiteralPath $Source -Force -ErrorAction SilentlyContinue
    $cnTargetItem = Get-Item -LiteralPath $Destination -Force -ErrorAction SilentlyContinue
    # Links carry no data (recreated or, when broken, dropped by New-CnCopiedLinks).
    if ($cnSourceItem -and (Test-CnReparsePoint -Item $cnSourceItem)) {
        return $true
    }
    if (-not $cnSourceItem -or -not $cnTargetItem) {
        return $false
    }
    if ($cnSourceItem -is [System.IO.FileInfo]) {
        return ($cnTargetItem -is [System.IO.FileInfo]) -and $cnTargetItem.Length -eq $cnSourceItem.Length
    }
    foreach ($cnChild in @(Get-ChildItem -LiteralPath $Source -Force -ErrorAction Stop)) {
        if (-not (Test-CnCopyComplete -Source $cnChild.FullName -Destination (Join-Path $Destination $cnChild.Name))) {
            return $false
        }
    }
    return $true
}

# Python for the migration helper scripts: the E: copy of the project Python
# once it exists (the D: one is being deleted), else the D: one, else PATH.
function Get-CnMigrationPython {
    $cnMigratedPython = ''

    if ($Global:PYTHON_EXE_PATH -and $Global:CN_LEGACY_TOOL_ROOT) {
        $cnMigratedPython = $Global:PYTHON_EXE_PATH -ireplace [regex]::Escape($Global:CN_LEGACY_TOOL_ROOT.TrimEnd('\')), $Global:CN_TOOL_ROOT.TrimEnd('\')
    }
    foreach ($cnCandidate in @($cnMigratedPython, $Global:PYTHON_EXE_PATH)) {
        if ($cnCandidate -and (Test-Path -LiteralPath $cnCandidate -PathType Leaf)) {
            return $cnCandidate
        }
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return (Get-Command python).Source
    }
    return ''
}

# Starts the work-dir pruner (contract paths.drive_layout.work_root.prune) in
# the background at most once per interval; never on the shared legacy work_root.
function Start-CnWorkDirPrune {
    param(
        [Parameter(Mandatory = $true)]
        [string]$WorkDir
    )

    $cnStampItem = $null
    $cnPythonExe = ''

    if ($WorkDir.TrimEnd('\') -ieq $Global:CN_LEGACY_WORK_ROOT.TrimEnd('\')) {
        return
    }
    $cnStampItem = Get-Item -LiteralPath (Join-Path $WorkDir $Global:CN_WORK_PRUNE_STAMP_NAME) -Force -ErrorAction SilentlyContinue
    if ($cnStampItem -and $cnStampItem.LastWriteTime -gt (Get-Date).AddMinutes(-$Global:CN_WORK_PRUNE_INTERVAL_MINUTES)) {
        return
    }
    $cnPythonExe = Get-CnMigrationPython
    if (-not $cnPythonExe) {
        return
    }
    Start-Process -FilePath $cnPythonExe -ArgumentList @(('"{0}"' -f $Global:CN_WORK_PRUNE_SCRIPT), ('"{0}"' -f $WorkDir)) -WindowStyle Hidden | Out-Null
}

# Deletes an old D: entry file by file through the Python remover: locked
# files stay (retried on the next run), everything else is removed. Returns
# $true when the entry is fully gone.
function Remove-CnLegacyEntry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $cnPythonExe = Get-CnMigrationPython
    $cnSummary = ''

    if (-not $cnPythonExe) {
        Write-Warning ('[PROGRAM-DRIVE] No Python found to delete {0}; it stays on D: until the next run' -f $Path)
        return $false
    }

    $cnSummary = (& $cnPythonExe $Global:CN_LEGACY_REMOVE_SCRIPT $Path --on-reboot | Select-Object -Last 1)
    if (Test-Path -LiteralPath $Path) {
        Write-Warning ('[PROGRAM-DRIVE] {0} partly deleted ({1}); in-use files (e.g. Explorer shell extensions) are removed at the next Windows restart' -f $Path, $cnSummary)
        return $false
    }
    return $true
}

# Text files of a copied program tree that may carry the old absolute root
# (scoop shims, pyvenv.cfg, .pth, launch scripts); binaries are never touched.
$Global:CN_TEXT_REFERENCE_EXTENSIONS = @('.shim', '.cmd', '.bat', '.ps1', '.cfg', '.pth', '.ini', '.json', '.config', '.txt')
$Global:CN_TEXT_REFERENCE_MAX_BYTES = 1MB

# Rewrites the old root (as D:\x, D:/x and the JSON-escaped D:\\x) to the new
# root in the text files of a copied tree; links are not followed. Idempotent.
function Update-CnTextReferences {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root,
        [Parameter(Mandatory = $true)]
        [string]$OldRoot,
        [Parameter(Mandatory = $true)]
        [string]$NewRoot
    )

    $cnPending = New-Object System.Collections.Generic.Stack[string]
    $cnPending.Push($Root)

    while ($cnPending.Count -gt 0) {
        foreach ($cnChild in @(Get-ChildItem -LiteralPath $cnPending.Pop() -Force -ErrorAction SilentlyContinue)) {
            if (Test-CnReparsePoint -Item $cnChild) {
                continue
            }
            if ($cnChild -is [System.IO.DirectoryInfo]) {
                $cnPending.Push($cnChild.FullName)
                continue
            }
            if ($Global:CN_TEXT_REFERENCE_EXTENSIONS -notcontains $cnChild.Extension.ToLowerInvariant() -or $cnChild.Length -gt $Global:CN_TEXT_REFERENCE_MAX_BYTES) {
                continue
            }
            Update-CnTextFile -Path $cnChild.FullName -OldRoot $OldRoot -NewRoot $NewRoot
        }
    }
}

# One text file: the old root (as D:\x, D:/x and the JSON-escaped D:\\x)
# re-rooted to the new root, encoding and BOM kept; binary files are skipped.
function Update-CnTextFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$OldRoot,
        [Parameter(Mandatory = $true)]
        [string]$NewRoot
    )

    $cnOld = $OldRoot.TrimEnd('\')
    $cnNew = $NewRoot.TrimEnd('\')
    $cnForms = @(
        , @($cnOld.Replace('\', '\\'), $cnNew.Replace('\', '\\'))
        , @($cnOld, $cnNew)
        , @($cnOld.Replace('\', '/'), $cnNew.Replace('\', '/'))
    )

    try {
        $cnBytes = [System.IO.File]::ReadAllBytes($Path)
        if ([Array]::IndexOf($cnBytes, [byte]0) -ge 0) {
            return
        }
        $cnBomLength = 0
        if ($cnBytes.Length -ge 3 -and $cnBytes[0] -eq 0xEF -and $cnBytes[1] -eq 0xBB -and $cnBytes[2] -eq 0xBF) {
            $cnBomLength = 3
        }
        $cnText = [System.Text.Encoding]::UTF8.GetString($cnBytes, $cnBomLength, $cnBytes.Length - $cnBomLength)
        $cnUpdated = $cnText
        foreach ($cnForm in $cnForms) {
            $cnUpdated = [regex]::Replace($cnUpdated, [regex]::Escape($cnForm[0]), $cnForm[1].Replace('$', '$$'), [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
        }
        if ($cnUpdated -cne $cnText) {
            [System.IO.File]::WriteAllText($Path, $cnUpdated, (New-Object System.Text.UTF8Encoding($cnBomLength -gt 0)))
        }
    }
    catch {
        Write-Warning ('[PROGRAM-DRIVE] References in {0} not updated: {1}' -f $Path, $_.Exception.Message)
    }
}

# Repairs during a migration (never on a fresh install), for each old root:
# the python path embedded in pip/uv launcher .exe files, shortcuts, scheduled
# tasks and registry references (SystemReferenceRelocation.ps1) and scoop's own
# config; then scoop reset * once from the new location (shims, current links).
function Invoke-CnPostSwitchRepairs {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$OldRoots,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    # Local: every failure below is handled and reported; the installers'
    # global Stop must not abort the migration halfway.
    $ErrorActionPreference = 'Continue'
    $cnPythonExe = Get-CnMigrationPython
    $cnScoopExe = Join-Path $TargetPath $Global:CN_SCOOP_SHIM_SUBPATH
    $cnScoopConfigRoot = $env:XDG_CONFIG_HOME
    $cnScoopConfig = ''
    $cnOldRoot = ''

    . (Join-Path (Split-Path $Global:CN_WINDOWS_PATH_FUNCTION -Parent) 'SystemReferenceRelocation.ps1')
    if (-not $cnScoopConfigRoot) {
        $cnScoopConfigRoot = Join-Path $env:USERPROFILE '.config'
    }
    $cnScoopConfig = Join-Path (Join-Path $cnScoopConfigRoot 'scoop') 'config.json'

    foreach ($cnOldRoot in $OldRoots) {
        if ($cnPythonExe) {
            Write-Host ('[PROGRAM-DRIVE] Re-rooting launcher .exe files under {0}: {1} -> {0}' -f $TargetPath, $cnOldRoot) -ForegroundColor Cyan
            try {
                & $cnPythonExe $Global:CN_LEGACY_RELOCATE_SCRIPT $TargetPath $cnOldRoot $TargetPath | Out-Host
            }
            catch {
                Write-Warning ('[PROGRAM-DRIVE] Launcher re-root failed: {0}' -f $_.Exception.Message)
            }
        }
        else {
            Write-Warning ('[PROGRAM-DRIVE] No Python found; launcher .exe files under {0} still point to {1}' -f $TargetPath, $cnOldRoot)
        }
        Move-SystemReferenceRoot -OldRoot $cnOldRoot -NewRoot $TargetPath
        if (Test-Path -LiteralPath $cnScoopConfig -PathType Leaf) {
            Update-CnTextFile -Path $cnScoopConfig -OldRoot $cnOldRoot -NewRoot $TargetPath
        }
    }

    if (Test-Path -LiteralPath $cnScoopExe -PathType Leaf) {
        Write-Host '[PROGRAM-DRIVE] scoop reset * (shims and current links at the new location)' -ForegroundColor Cyan
        try {
            & $cnScoopExe reset '*' | Out-Host
        }
        catch {
            Write-Warning ('[PROGRAM-DRIVE] scoop reset failed: {0}' -f $_.Exception.Message)
        }
    }
}

# True when a directory holds no file anywhere below it (links are not data).
function Test-CnEmptyTree {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.DirectoryInfo]$Directory
    )

    foreach ($cnChild in @(Get-ChildItem -LiteralPath $Directory.FullName -Force -ErrorAction SilentlyContinue)) {
        if (Test-CnReparsePoint -Item $cnChild) {
            continue
        }
        if ($cnChild -isnot [System.IO.DirectoryInfo] -or -not (Test-CnEmptyTree -Directory $cnChild)) {
            return $false
        }
    }
    return $true
}

# Idempotent, resumable move of one old D: program dir to its E: target; no
# link is left behind. Migration branch only: a fresh install has no old dir
# and no repairs marker, so nothing here runs.
#   1. sort the old dir's entries: real program entries, old links (removed;
#      only a link to a third place that still exists is recreated on E:),
#      empty dirs (removed), kept data (models, drafts...);
#   2. copy every real entry not yet in the manifest with Copy-Item, recreate
#      inner links on E: and verify every file; any failure stops here and
#      nothing is deleted; the verified set is recorded in the manifest (the
#      switch);
#   3. switch: re-root old-root references in E: text files, PATH and every
#      environment variable (WindowsPathFunction.ps1 moveroot), record the live
#      dirs, and leave a repairs marker on E:;
#   4. clean D:: delete the real entries file by file (locked files stay until
#      the next run), old links, empty dirs and obsolete staging copies, move
#      kept data to the D: shared-data area (kept_data_root), and remove the
#      old dir once empty, so D: holds shared data only;
#   5. slow repairs last (launcher .exe files, shortcuts, scheduled tasks,
#      registry, scoop reset *); the marker is removed when they finish, so an
#      interrupted run resumes them next time.
function Move-CnLegacyProgramDir {
    param(
        [Parameter(Mandatory = $true)]
        [string]$LegacyPath,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath,
        [string[]]$SupersededRoots = @()
    )

    # Local: every failure below is handled and reported; the installers'
    # global Stop must not abort the migration halfway.
    $ErrorActionPreference = 'Continue'
    $cnLegacyItem = Get-Item -LiteralPath $LegacyPath -Force -ErrorAction SilentlyContinue
    $cnRepairsMarker = Join-Path $TargetPath $Global:CN_REPAIRS_MARKER_NAME
    $cnOldRoots = @(@($LegacyPath) + @($SupersededRoots) | Where-Object { $_ })
    $cnLinks = [System.Collections.Generic.List[object]]::new()
    $cnOuterLinks = [System.Collections.Generic.List[object]]::new()
    $cnEntries = @()
    $cnOldLinks = @()
    $cnEmpty = @()
    $cnKept = @()
    $cnFailed = 0

    if ($cnLegacyItem -and (Test-CnReparsePoint -Item $cnLegacyItem)) {
        Write-Host ('[PROGRAM-DRIVE] Removing old link {0}' -f $LegacyPath) -ForegroundColor DarkGray
        Remove-CnLegacyEntry -Path $LegacyPath | Out-Null
        $cnLegacyItem = $null
    }

    if ($cnLegacyItem) {
        New-CnNamespaceDirectory -Path $TargetPath
        foreach ($cnChild in @(Get-ChildItem -LiteralPath $LegacyPath -Force -ErrorAction SilentlyContinue)) {
            if (Test-CnReparsePoint -Item $cnChild) {
                $cnOldLinks += $cnChild
                $cnLinkTarget = [string](@($cnChild.Target) | Select-Object -First 1)
                $cnPointsIntoMove = @($cnOldRoots + @($TargetPath) | Where-Object { $cnLinkTarget.StartsWith($_.TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase) }).Count -gt 0
                if ($cnLinkTarget -and -not $cnPointsIntoMove -and (Test-Path -LiteralPath $cnLinkTarget)) {
                    $cnOuterLinks.Add([pscustomobject]@{ Source = $cnChild; Destination = (Join-Path $TargetPath $cnChild.Name) })
                }
            }
            elseif ($cnChild -is [System.IO.DirectoryInfo] -and (Test-CnEmptyTree -Directory $cnChild)) {
                $cnEmpty += $cnChild
            }
            elseif (Test-CnLegacyKeepItem -Name $cnChild.Name) {
                $cnKept += $cnChild
            }
            else {
                $cnEntries += $cnChild
            }
        }
    }

    if ($cnEntries.Count + $cnOldLinks.Count + $cnEmpty.Count + $cnKept.Count -gt 0) {
        # Entries in the manifest were switched to E: already: never copied
        # again over the live E: copy, only their D: leftovers are deleted.
        $cnMigrated = @(Get-CnMigratedNames -TargetPath $TargetPath)
        $cnToCopy = @($cnEntries | Where-Object { $cnMigrated -notcontains $_.Name })
        $cnNeeded = Get-CnPendingCopyBytes -Entries $cnToCopy -TargetPath $TargetPath
        $cnFree = [System.IO.DriveInfo]::new($TargetPath).AvailableFreeSpace
        if ($cnNeeded -gt $cnFree) {
            Write-Warning ('[PROGRAM-DRIVE] {0} needs {1:N1} GB but {2} has {3:N1} GB free; {0} stays live, partial copies removed' -f $LegacyPath, ($cnNeeded / 1GB), [System.IO.Path]::GetPathRoot($TargetPath), ($cnFree / 1GB))
            foreach ($cnEntry in $cnToCopy) {
                $cnPartial = Join-Path $TargetPath $cnEntry.Name
                if (Test-Path -LiteralPath $cnPartial -PathType Container) {
                    & $env:ComSpec /c rd /s /q $cnPartial
                }
                elseif (Test-Path -LiteralPath $cnPartial -PathType Leaf) {
                    Remove-Item -LiteralPath $cnPartial -Force -ErrorAction SilentlyContinue
                }
            }
            return
        }

        foreach ($cnEntry in $cnToCopy) {
            Write-Host ('[PROGRAM-DRIVE] Copying {0} -> {1}' -f $cnEntry.FullName, (Join-Path $TargetPath $cnEntry.Name)) -ForegroundColor Cyan
            try {
                $cnFailed += Copy-CnTree -Source $cnEntry.FullName -Destination (Join-Path $TargetPath $cnEntry.Name) -Links $cnLinks -ErrorAction Stop
            }
            catch {
                Write-Warning ('[PROGRAM-DRIVE] Copy of {0} stopped: {1}' -f $cnEntry.FullName, $_.Exception.Message)
                $cnFailed++
            }
        }
        foreach ($cnOuter in $cnOuterLinks) {
            $cnLinks.Add($cnOuter)
        }
        try {
            $cnFailed += New-CnCopiedLinks -Links $cnLinks -OldRoot $LegacyPath -NewRoot $TargetPath -ErrorAction Stop
        }
        catch {
            Write-Warning ('[PROGRAM-DRIVE] Links of {0} not recreated: {1}' -f $LegacyPath, $_.Exception.Message)
            $cnFailed++
        }
        foreach ($cnEntry in $cnToCopy) {
            if (-not (Test-CnCopyComplete -Source $cnEntry.FullName -Destination (Join-Path $TargetPath $cnEntry.Name))) {
                Write-Warning ('[PROGRAM-DRIVE] {0} is not fully copied to {1}' -f $cnEntry.FullName, $TargetPath)
                $cnFailed++
            }
        }
        if ($cnFailed -gt 0) {
            Write-Warning ('[PROGRAM-DRIVE] {0}: {1} copy problem(s); nothing deleted, {0} stays live, retried on the next run' -f $LegacyPath, $cnFailed)
            return
        }

        foreach ($cnEntry in $cnToCopy) {
            Add-CnMigratedName -TargetPath $TargetPath -Name $cnEntry.Name
        }
        foreach ($cnOldRoot in $cnOldRoots) {
            Update-CnTextReferences -Root $TargetPath -OldRoot $cnOldRoot -NewRoot $TargetPath
            try {
                & $Global:CN_WINDOWS_PATH_FUNCTION moveroot $cnOldRoot $TargetPath -SkipInit
            }
            catch {
                Write-Warning ('[PROGRAM-DRIVE] Environment re-root {0} failed: {1}' -f $cnOldRoot, $_.Exception.Message)
            }
        }
        Save-CnResolvedProgramDirs
        Set-Content -LiteralPath $cnRepairsMarker -Value $cnOldRoots -Encoding utf8
        Write-Host ('[PROGRAM-DRIVE] {0} is now live; cleaning {1}' -f $TargetPath, $LegacyPath) -ForegroundColor Green

        foreach ($cnEntry in $cnEntries) {
            Remove-CnLegacyEntry -Path $cnEntry.FullName | Out-Null
        }
        foreach ($cnEntry in @($cnOldLinks + $cnEmpty)) {
            Write-Host ('[PROGRAM-DRIVE] Removing old {0} {1}' -f $(if (Test-CnReparsePoint -Item $cnEntry) { 'link' } else { 'empty dir' }), $cnEntry.FullName) -ForegroundColor DarkGray
            Remove-CnLegacyEntry -Path $cnEntry.FullName | Out-Null
        }
        foreach ($cnEntry in $cnKept) {
            Move-CnKeptData -Item $cnEntry -TargetPath $TargetPath
        }
        $cnLeft = @(Get-ChildItem -LiteralPath $LegacyPath -Force -ErrorAction SilentlyContinue)
        if ($cnLeft.Count -eq 0) {
            Remove-Item -LiteralPath $LegacyPath -Force -ErrorAction SilentlyContinue
            Write-Host ('[PROGRAM-DRIVE] Removed {0}' -f $LegacyPath) -ForegroundColor Green
        }
        elseif (@($cnLeft | Where-Object { Test-CnLegacyKeepItem -Name $_.Name }).Count -eq 0) {
            # Only locked leftovers remain: the old dir goes with them at the next restart.
            Remove-CnLegacyEntry -Path $LegacyPath | Out-Null
        }
    }

    # Partial copies left by the superseded rename-based migration.
    foreach ($cnStale in @(Get-ChildItem -LiteralPath $TargetPath -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name.EndsWith($Global:CN_OBSOLETE_STAGING_SUFFIX) })) {
        Remove-CnLegacyEntry -Path $cnStale.FullName | Out-Null
    }

    if (Test-Path -LiteralPath $cnRepairsMarker -PathType Leaf) {
        Invoke-CnPostSwitchRepairs -OldRoots @(Get-Content -LiteralPath $cnRepairsMarker | Where-Object { $_ }) -TargetPath $TargetPath
        Remove-Item -LiteralPath $cnRepairsMarker -Force -ErrorAction SilentlyContinue
    }
}

# Kept data (models, drafts...) of an old D: program dir leaves it for the D:
# shared-data area: <kept_data_root>\<target dir name>\<entry>. A rename on
# the same drive, so nothing is copied or deleted; an existing destination is
# never overwritten.
function Move-CnKeptData {
    param(
        [Parameter(Mandatory = $true)]
        [System.IO.FileSystemInfo]$Item,
        [Parameter(Mandatory = $true)]
        [string]$TargetPath
    )

    $cnDestinationDir = Join-Path $Global:CN_KEPT_DATA_ROOT (Split-Path $TargetPath -Leaf)
    $cnDestination = Join-Path $cnDestinationDir $Item.Name

    if (Test-Path -LiteralPath $cnDestination) {
        Write-Warning ('[PROGRAM-DRIVE] {0} already exists; {1} left in place' -f $cnDestination, $Item.FullName)
        return
    }
    New-CnNamespaceDirectory -Path $cnDestinationDir
    try {
        Move-Item -LiteralPath $Item.FullName -Destination $cnDestination -ErrorAction Stop
        Write-Host ('[PROGRAM-DRIVE] Data {0} -> {1}' -f $Item.FullName, $cnDestination) -ForegroundColor Green
    }
    catch {
        Write-Warning ('[PROGRAM-DRIVE] Data {0} not moved: {1}' -f $Item.FullName, $_.Exception.Message)
    }
}

# Installer-only: points every package-manager cache (CN_TOOL_CACHE_VARS) at
# its subdir of the program-drive cache root as a Machine variable, through
# the central library (WindowsPathFunction.ps1 setvar); writes only changes.
function Set-CnToolCacheEnvironment {
    $cnSubdir = ''
    $cnVar = ''
    $cnPath = ''

    foreach ($cnSubdir in $Global:CN_CACHE_SUBDIR_NAMES) {
        if (-not $Global:CN_TOOL_CACHE_VARS.ContainsKey($cnSubdir)) {
            continue
        }
        $cnVar = $Global:CN_TOOL_CACHE_VARS[$cnSubdir]
        $cnPath = Join-Path $Global:CN_CACHE_ROOT $cnSubdir
        New-CnNamespaceDirectory -Path $cnPath
        if ([Environment]::GetEnvironmentVariable($cnVar, 'Machine') -ne $cnPath) {
            & $Global:CN_WINDOWS_PATH_FUNCTION setvar $cnVar $cnPath -SkipInit
        }
        [Environment]::SetEnvironmentVariable($cnVar, $cnPath, 'Process')
    }
    foreach ($cnVar in $Global:CN_RETIRED_TOOL_CACHE_VARS) {
        if ($null -ne [Environment]::GetEnvironmentVariable($cnVar, 'Machine')) {
            & $Global:CN_WINDOWS_PATH_FUNCTION delvar $cnVar -SkipInit
        }
        [Environment]::SetEnvironmentVariable($cnVar, $null, 'Process')
    }
}

# Records the live Windows tool/app dirs (contract windows_resolved_vars) so
# pycore and Laravel read them instead of resolving the layout again.
function Save-CnResolvedProgramDirs {
    $cnToolDir = Resolve-CnMappedProgramDir -LegacyPath $Global:CN_LEGACY_TOOL_ROOT -TargetPath $Global:CN_TOOL_ROOT
    $cnAppDir = Resolve-CnMappedProgramDir -LegacyPath $Global:CN_LEGACY_APP_ROOT -TargetPath $Global:CN_APP_ROOT
    $cnDownloadsDir = Resolve-CnMappedProgramDir -LegacyPath $Global:CN_LEGACY_DOWNLOADS_ROOT -TargetPath $Global:CN_DOWNLOADS_ROOT
    if (-not (Get-Command Set-GlobalVar -ErrorAction SilentlyContinue)) {
        return
    }
    if ((Get-GlobalVar -key $Global:CN_RESOLVED_TOOL_ROOT_VAR) -ne $cnToolDir) {
        Set-GlobalVar -key $Global:CN_RESOLVED_TOOL_ROOT_VAR -value $cnToolDir | Out-Null
    }
    if ((Get-GlobalVar -key $Global:CN_RESOLVED_APP_ROOT_VAR) -ne $cnAppDir) {
        Set-GlobalVar -key $Global:CN_RESOLVED_APP_ROOT_VAR -value $cnAppDir | Out-Null
    }
    if ((Get-GlobalVar -key $Global:CN_RESOLVED_DOWNLOADS_ROOT_VAR) -ne $cnDownloadsDir) {
        Set-GlobalVar -key $Global:CN_RESOLVED_DOWNLOADS_ROOT_VAR -value $cnDownloadsDir | Out-Null
    }
    if ((Get-GlobalVar -key $Global:CN_RESOLVED_WORK_ROOT_VAR) -ne $Global:CN_WORK_ROOT) {
        Set-GlobalVar -key $Global:CN_RESOLVED_WORK_ROOT_VAR -value $Global:CN_WORK_ROOT | Out-Null
    }
}

# Installer-only (Step 1): adopt E: as the program drive and move the old D:
# program dirs onto it, or explain why programs stay on D:.
function Invoke-CnProgramDriveMigration {
    if ($Global:WINDOWS_PROGRAM_DRIVE_IS_FALLBACK) {
        Write-ProgramDriveFallbackWarning
        Save-CnResolvedProgramDirs
        return
    }

    $cnPartitionGuid = ''
    try {
        $cnPartitionGuid = Register-CnProgramDriveAdoption -DriveRoot $Global:WINDOWS_PROGRAM_DRIVE_ROOT -DriveLetter $Global:CN_PROGRAM_DRIVE_PRIMARY_LABEL[0]
    }
    catch {
        Write-Warning ('[PROGRAM-DRIVE] {0}' -f $_.Exception.Message)
        Save-CnResolvedProgramDirs
        return
    }
    # Shared var store (D:\www\core_node\global_var == Linux /www/www/core_node/global_var):
    # Linux reads it to never adopt E: as its /www data disk (get_program_drive_partuuid).
    if ((Get-Command Set-GlobalVar -ErrorAction SilentlyContinue) -and (Get-GlobalVar -key 'CN_PROGRAM_PARTUUID') -ne $cnPartitionGuid) {
        Set-GlobalVar -key 'CN_PROGRAM_PARTUUID' -value $cnPartitionGuid | Out-Null
    }

    # One migration per machine: a second dd run waits here instead of copying
    # onto the same E: files (which fails with "used by another process").
    $cnMutex = [System.Threading.Mutex]::new($false, $Global:CN_PROGRAM_DRIVE_MIGRATION_MUTEX)
    try {
        try {
            if (-not $cnMutex.WaitOne(0)) {
                Write-Host '[PROGRAM-DRIVE] Another installer is migrating the program dirs; waiting for it to finish...' -ForegroundColor Yellow
                $null = $cnMutex.WaitOne()
            }
        }
        catch [System.Threading.AbandonedMutexException] {
        }
        Set-CnToolCacheEnvironment
        foreach ($cnMapping in @(Get-CnProgramDirectoryMappings)) {
            Move-CnLegacyProgramDir -LegacyPath $cnMapping.Legacy -TargetPath $cnMapping.Target -SupersededRoots @($cnMapping.Superseded)
        }
        Save-CnResolvedProgramDirs
    }
    finally {
        $cnMutex.ReleaseMutex()
        $cnMutex.Dispose()
    }
}

# Re-run safe: this file can be dot-sourced more than once per process (several
# win_common scripts dot-source it directly, not only through GlobalVars.ps1's
# once-guard), so only seed the flag the first time it is missing.
if (-not (Test-Path Variable:Global:CN_PROGRAM_DRIVE_FALLBACK_WARNED)) {
    $Global:CN_PROGRAM_DRIVE_FALLBACK_WARNED = $false
}

# Called by installers/ensure functions (e.g. ProjectTreeCommon.ps1), never at
# load time and never printed by this file itself -- only a caller that just
# decided to fall back prints it. Prints once per process when the program
# drive fell back (E: absent or disqualified). Text is explicit per user D7:
# programs, toolchains, build files and project heavy directories (node_modules,
# vendor, .venv) belong under the program-drive namespace, not just the bare
# drive letter, and callers continue with the original location.
function Write-ProgramDriveFallbackWarning {
    if (-not $Global:WINDOWS_PROGRAM_DRIVE_IS_FALLBACK) {
        return
    }
    if ($Global:CN_PROGRAM_DRIVE_FALLBACK_WARNED) {
        return
    }

    Write-Warning ("Programs, toolchains, build files and project heavy directories belong under the program drive namespace {0}, but {1} is not available; continuing with the original location {2}." -f $Global:CN_PROGRAM_DRIVE_NAMESPACE_ROOT, $Global:CN_PROGRAM_DRIVE_PRIMARY_LABEL, $Global:WINDOWS_PROGRAM_DRIVE_ROOT)
    $Global:CN_PROGRAM_DRIVE_FALLBACK_WARNED = $true
}

# ServiceContract.ps1 sets $script:ServiceContractPath (and other script-scope
# state) when dot-sourced. Dot-sourcing merges scope, so this whole call chain
# (e.g. SecretManager.ps1 -> GlobalVars.ps1 -> SharedCacheEnv.ps1 ->
# ServiceContract.ps1) can share one script scope; dot-sourcing it directly
# here would then overwrite a same-named variable further up that chain
# (PowerShell variable names are case-insensitive) with the JSON config path
# instead of the ServiceContract.ps1 script path. Load it inside a private
# dynamic module instead: the module keeps its own script scope, and only its
# functions -- never its internal variables -- are imported into the caller's
# scope.
$__sccServiceContractModule = New-Module -ScriptBlock {
    param($ContractScriptPath)
    . $ContractScriptPath
} -ArgumentList $__sccServiceContractPath
Import-Module $__sccServiceContractModule -Global -Force
# Bind to the module command itself: a caller that already dot-sourced ServiceContract.ps1 leaves a same-named function in an outer scope that would
# shadow the global import and read $script: state from this script scope instead of its own.
$__sccGetContractValue = $__sccServiceContractModule.ExportedCommands['Get-ServiceContractValue']

$__sccContractDataDriveRoot = [string](& $__sccGetContractValue -ContractPath 'paths.windows_data_drive_root')
$__sccProgramDriveNamespace = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.namespaces.windows_program_drive')
$__sccProgramDrivePrimary = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.program_drive_primary')
$__sccProgramDriveFallback = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.program_drive_fallback')
$__sccToolRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.tool_root.windows')
$__sccCacheRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.cache_root.windows')
$__sccCacheRootFallbackTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.cache_root.windows_d_fallback')
$__sccCacheSubdirs = @(& $__sccGetContractValue -ContractPath 'paths.drive_layout.cache_subdirs')
$__sccTreesRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.trees_root.windows')
$__sccToolchainEnvTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.toolchain_env_file.windows')
$__sccAppRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.app_root.windows')
$__sccLegacyToolRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.tool_root')
$__sccLegacyAppRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.app_root')
$__sccDownloadsRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.downloads_root.windows')
$__sccLegacyDownloadsRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.downloads_root')
$__sccLegacyDownloadsCacheTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.downloads_cache')
$__sccLegacyPipCacheTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.pip_cache')
$__sccWorkRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.work_root.windows')
$__sccLegacyWorkRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.work_root')
$__sccLegacyPnpmStoreTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.pnpm_store')
$__sccKeptDataRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.kept_data_root')
# Read once here rather than hard-coded below (DIRECTORY_NAMESPACE_RULES.md:
# "Scripts read them from the contract ... They never write a literal"); both
# resolve to the same strings the D: fallback literals used to spell out, so
# this is a definition-source change only, not a path change.
$__sccDataDriveNamespace = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.namespaces.windows_data_drive')
$__sccCoreNodeDataDirName = [string](& $__sccGetContractValue -ContractPath 'paths.core_node_data_dir_name')
$Global:CN_PROGRAM_DRIVE_PRIMARY_LABEL = $__sccProgramDrivePrimary
$Global:CN_PROGRAM_DRIVE_CREATE_MIN_MB = [long](& $__sccGetContractValue -ContractPath 'paths.drive_layout.program_drive_create.min_mb')
$Global:CN_PROGRAM_DRIVE_CREATE_MAX_MB = [long](& $__sccGetContractValue -ContractPath 'paths.drive_layout.program_drive_create.max_mb')
$Global:CN_PROGRAM_DRIVE_CREATE_SMALL_RATIO = [double](& $__sccGetContractValue -ContractPath 'paths.drive_layout.program_drive_create.small_ratio')
$Global:CN_PROGRAM_DRIVE_MIGRATION_MUTEX = 'Global\core_node_program_drive_migration'
$Global:CN_PROGRAM_DRIVE_CREATE_LABEL =[string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.program_drive_create.label')

# [Environment]::SystemDirectory (e.g. C:\Windows\System32) does not depend on
# any environment variable, unlike $env:SystemDrive, which a caller that
# starts this process with a hand-built environment block may have omitted.
$__sccSystemDriveSpec = $env:SystemDrive
if (-not $__sccSystemDriveSpec) {
    $__sccSystemDriveSpec = [System.IO.Path]::GetPathRoot([Environment]::SystemDirectory)
}
$Global:WINDOWS_SYSTEM_DRIVE_ROOT = Get-CnDriveRoot -DriveSpec $__sccSystemDriveSpec
$Global:WINDOWS_DATA_DRIVE_ROOT = Get-CnDriveRoot -DriveSpec $__sccContractDataDriveRoot

$__sccProgramDrivePrimaryRoot = Get-CnDriveRoot -DriveSpec $__sccProgramDrivePrimary
$__sccProgramDriveFallbackRoot = Get-CnDriveRoot -DriveSpec $__sccProgramDriveFallback
$__sccProgramDriveQualifies = Test-CnProgramDriveQualifies -DriveRoot $__sccProgramDrivePrimaryRoot -DriveLetter $__sccProgramDrivePrimary[0]

# Always the intended E: namespace root (DIRECTORY_NAMESPACE_RULES.md #1),
# regardless of whether E: currently qualifies -- Write-ProgramDriveFallbackWarning
# names it even when falling back to D:. The Join-Path cmdlet resolves through
# the PowerShell FileSystem provider and throws DriveNotFoundException when
# the drive letter has no PSDrive at all (the common fallback case, E: absent
# outright), so this goes through Resolve-CnDriveLayoutPath instead, exactly
# like every other drive_layout template below -- [System.IO.Path]::GetFullPath
# only normalizes the string and never touches the filesystem.
$__sccSystemName = Get-CnWindowsSystemName
$Global:CN_PROGRAM_DRIVE_NAMESPACE_ROOT = Resolve-CnDriveLayoutPath -Template '<program_drive>\<namespace>' -Replacements @{ '<program_drive>' = $__sccProgramDrivePrimary; '<namespace>' = $__sccProgramDriveNamespace.Replace('<sys>', $__sccSystemName) }

if ($__sccProgramDriveQualifies) {
    $Global:WINDOWS_PROGRAM_DRIVE_ROOT = $__sccProgramDrivePrimaryRoot
    $Global:WINDOWS_PROGRAM_DRIVE_IS_FALLBACK = $false
    $__sccEffectiveProgramDriveLetter = $__sccProgramDrivePrimary
}
else {
    $Global:WINDOWS_PROGRAM_DRIVE_ROOT = $__sccProgramDriveFallbackRoot
    $Global:WINDOWS_PROGRAM_DRIVE_IS_FALLBACK = $true
    $__sccEffectiveProgramDriveLetter = $__sccProgramDriveFallback
}


# <program_drive> and <sys> are each resolved exactly once above ($__sccEffectiveProgramDriveLetter,
# $__sccSystemName), then reused for every template that needs them. D28/D30:
# when E: qualifies, tool_root, cache_root and trees_root each resolve their
# own contract template under the E: namespace root (paths.drive_layout.namespaces.windows_program_drive,
# already embedded in the templates themselves); on the D: fallback, tool_root
# stays the legacy D: tool dir (legacy_program_dirs.tool_root), cache_root uses
# its cache_root.windows_d_fallback template, and CN_TREES_ROOT is the empty string
# -- D28: junctions (node_modules/vendor/.venv) are never created on the D:
# fallback, so ProjectTreeCommon.ps1 falls back to plain in-repo directories
# and prints Write-ProgramDriveFallbackWarning. The junction/link state
# machine itself lives entirely in ProjectTreeCommon.ps1, not here.
$Global:CN_LEGACY_TOOL_ROOT = Resolve-CnDriveLayoutPath -Template $__sccLegacyToolRootTemplate -Replacements @{ '<sys>' = $__sccSystemName }
$Global:CN_LEGACY_APP_ROOT = Resolve-CnDriveLayoutPath -Template $__sccLegacyAppRootTemplate -Replacements @{}
$Global:CN_LEGACY_DOWNLOADS_ROOT = Resolve-CnDriveLayoutPath -Template $__sccLegacyDownloadsRootTemplate -Replacements @{}
$Global:CN_LEGACY_DOWNLOADS_CACHE = Resolve-CnDriveLayoutPath -Template $__sccLegacyDownloadsCacheTemplate -Replacements @{}
$Global:CN_LEGACY_PIP_CACHE = Resolve-CnDriveLayoutPath -Template $__sccLegacyPipCacheTemplate -Replacements @{}
$Global:CN_LEGACY_WORK_ROOT = Resolve-CnDriveLayoutPath -Template $__sccLegacyWorkRootTemplate -Replacements @{}
$Global:CN_LEGACY_PNPM_STORE = Resolve-CnDriveLayoutPath -Template $__sccLegacyPnpmStoreTemplate -Replacements @{}
$Global:CN_KEPT_DATA_ROOT = Resolve-CnDriveLayoutPath -Template $__sccKeptDataRootTemplate -Replacements @{}
$Global:CN_SUPERSEDED_TOOL_ROOTS = @(& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.superseded_tool_roots' | ForEach-Object { Resolve-CnDriveLayoutPath -Template ([string]$_) -Replacements @{ '<sys>' = $__sccSystemName } })
$Global:CN_OBSOLETE_STAGING_SUFFIX = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.obsolete_staging_suffix')
$Global:CN_REPAIRS_MARKER_NAME = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.repairs_marker_name')
if ($__sccProgramDriveQualifies) {
    $Global:CN_TOOL_ROOT = Resolve-CnDriveLayoutPath -Template $__sccToolRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter; '<sys>' = $__sccSystemName }
    $Global:CN_CACHE_ROOT = Resolve-CnDriveLayoutPath -Template $__sccCacheRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter; '<sys>' = $__sccSystemName }
    $Global:CN_TREES_ROOT = Resolve-CnDriveLayoutPath -Template $__sccTreesRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter; '<sys>' = $__sccSystemName }
    $Global:CN_APP_ROOT = Resolve-CnDriveLayoutPath -Template $__sccAppRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter }
    $Global:CN_DOWNLOADS_ROOT = Resolve-CnDriveLayoutPath -Template $__sccDownloadsRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter; '<sys>' = $__sccSystemName }
    $Global:CN_WORK_ROOT = Resolve-CnDriveLayoutPath -Template $__sccWorkRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter; '<sys>' = $__sccSystemName }
}
else {
    $Global:CN_TOOL_ROOT = $Global:CN_LEGACY_TOOL_ROOT
    $Global:CN_CACHE_ROOT = Resolve-CnDriveLayoutPath -Template $__sccCacheRootFallbackTemplate -Replacements @{}
    $Global:CN_TREES_ROOT = ''
    $Global:CN_APP_ROOT = ''
    $Global:CN_DOWNLOADS_ROOT = ''
    $Global:CN_WORK_ROOT = $Global:CN_LEGACY_WORK_ROOT
}
$Global:CN_SUPERSEDED_DOWNLOADS_ROOTS = @(& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.superseded_downloads_roots' | ForEach-Object { Resolve-CnDriveLayoutPath -Template ([string]$_) -Replacements @{ '<sys>' = $__sccSystemName } })
$Global:CN_LEGACY_KEEP_PATTERNS = @(& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.keep_patterns' | ForEach-Object { [string]$_ })
$Global:CN_WINDOWS_PATH_FUNCTION = Join-Path $PSScriptRoot 'WindowsPathFunction.ps1'
$Global:CN_LEGACY_MANIFEST_NAME = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.manifest_name')
$Global:CN_LEGACY_REMOVE_SCRIPT = Join-Path (Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent) ([string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.remove_script'))
$Global:CN_WORK_PRUNE_SCRIPT = Join-Path (Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent) ([string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.work_root.prune.script'))
$Global:CN_WORK_PRUNE_STAMP_NAME = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.work_root.prune.stamp_name')
$Global:CN_WORK_PRUNE_INTERVAL_MINUTES = [int](& $__sccGetContractValue -ContractPath 'paths.drive_layout.work_root.prune.interval_minutes')
$Global:CN_LEGACY_RELOCATE_SCRIPT = Join-Path (Split-Path (Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent) -Parent) ([string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.legacy_program_dirs.relocate_script'))
# scoop.cmd below a tool root (GlobalVars.ps1 SCOOP_EXE)
$Global:CN_SCOOP_SHIM_SUBPATH = 'scoop\shims\scoop.cmd'
$Global:CN_RESOLVED_TOOL_ROOT_VAR =[string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.windows_resolved_vars.tool_root')
$Global:CN_RESOLVED_APP_ROOT_VAR = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.windows_resolved_vars.app_root')
$Global:CN_RESOLVED_DOWNLOADS_ROOT_VAR = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.windows_resolved_vars.downloads_root')
$Global:CN_RESOLVED_WORK_ROOT_VAR = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.windows_resolved_vars.work_root')
$Global:CN_CACHE_SUBDIR_NAMES = @($__sccCacheSubdirs | ForEach-Object { [string]$_ })
# Contract cache subdir -> the variable each package manager reads (mirrors
# shared_cache_env.sh __scc_cache_var_for_subdir; Windows also moves the pnpm
# store, which otherwise defaults to <project drive>:\.pnpm-store on D:).
$Global:CN_PNPM_STORE_SUBDIR = 'pnpm-store'
# pnpm reads only pnpm_config_* variables (https://pnpm.io/configuring); npm warns on an
# npm_config_store_dir it does not know, so that former name is retired (removed if present).
$Global:CN_RETIRED_TOOL_CACHE_VARS = @('npm_config_store_dir')
$Global:CN_TOOL_CACHE_VARS = @{
    'pnpm-store' = 'pnpm_config_store_dir'
    'npm'        = 'npm_config_cache'
    'bun'        = 'BUN_INSTALL_CACHE_DIR'
    'uv'         = 'UV_CACHE_DIR'
    'composer'   = 'COMPOSER_CACHE_DIR'
    'corepack'   = 'COREPACK_HOME'
}
$Global:CN_TOOLCHAIN_ENV_FILE = Resolve-CnDriveLayoutPath -Template $__sccToolchainEnvTemplate -Replacements @{ '<tool_root>' = $Global:CN_TOOL_ROOT }

$Global:WINDOWS_PROGRAMING_DIR = Join-Path $Global:WINDOWS_DATA_DRIVE_ROOT 'programing'
$Global:WINDOWS_PROGRAMING_USERS_DIR = Join-Path $Global:WINDOWS_PROGRAMING_DIR 'Users'
# Canonical core_node checkout; mirrors linux gvar_storage_common.sh CORE_NODE_PROJECT_ROOT.
$Global:CORE_NODE_PROJECT_ROOT = Join-Path $Global:WINDOWS_PROGRAMING_DIR 'core_node'
$Global:WWW_BASE_DIR = Join-Path $Global:WINDOWS_DATA_DRIVE_ROOT $__sccDataDriveNamespace
$Global:WWW_CACHE_DIR = Join-Path $Global:WWW_BASE_DIR 'cache'
$Global:CORE_NODE_DATA_DIR = Join-Path $Global:WWW_BASE_DIR $__sccCoreNodeDataDirName
$Global:CORE_NODE_RUNTIME_CACHE_DIR = Join-Path $Global:CORE_NODE_DATA_DIR 'cache'
$Global:CORE_NODE_RUNTIME_DATA_DIR = Join-Path $Global:CORE_NODE_DATA_DIR 'data'
# Canonical cache-root Global consumed by ~20 install_*.ps1 steps and by
# GlobalVars.ps1 $Global:USER_CACHE_DIR. Mirrors $Global:WWW_CACHE_DIR so the
# shared cache path is defined ONCE in this central file.
$Global:CORE_NODE_CACHE_DIR = $Global:WWW_CACHE_DIR
$Global:XDG_CACHE_HOME = $Global:WWW_CACHE_DIR
# pycore local data (models/staging/state) — mirrors get_local_data_dir() in system_paths.py
# Windows: D:\www\cache\pycore  (Linux: /var/_core_node/cache/pycore via shared_cache_env.sh)
$Global:PYCORE_LOCAL_DATA_DIR = Join-Path $Global:WWW_CACHE_DIR 'pycore'
if (-not $env:PYCORE_LOCAL_DATA_DIR) {
    $env:PYCORE_LOCAL_DATA_DIR = $Global:PYCORE_LOCAL_DATA_DIR
}

function Get-PycoreLocalDataSubDir {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SubDir
    )

    return Join-Path $Global:PYCORE_LOCAL_DATA_DIR $SubDir
}
$__sccSubDirs = @(
    'huggingface',
    'huggingface\hub',
    'whisper',
    'torch',
    'pip',
    'xdg',
    'core_node',
    'uv',
    'pycore'
)

if ($env:XDG_CACHE_HOME) {
    $Global:XDG_CACHE_HOME = $env:XDG_CACHE_HOME
}
else {
    $env:XDG_CACHE_HOME = $Global:XDG_CACHE_HOME
}

foreach ($__sccDir in $__sccSubDirs) {
    $__sccPath = Join-Path $Global:WWW_CACHE_DIR $__sccDir
    if (-not (Test-Path $__sccPath)) {
        New-Item -ItemType Directory -Path $__sccPath -Force | Out-Null
    }
}

if (-not $env:CORE_NODE_CACHE_DIR) {
    $env:CORE_NODE_CACHE_DIR = $Global:WWW_CACHE_DIR
}
$Global:CORE_NODE_CACHE_DIR = $env:CORE_NODE_CACHE_DIR
if ($env:CORE_NODE_DATA_DIR) {
    $Global:CORE_NODE_DATA_DIR = $env:CORE_NODE_DATA_DIR
    $Global:CORE_NODE_RUNTIME_CACHE_DIR = Join-Path $Global:CORE_NODE_DATA_DIR 'cache'
    $Global:CORE_NODE_RUNTIME_DATA_DIR = Join-Path $Global:CORE_NODE_DATA_DIR 'data'
}
else {
    $env:CORE_NODE_DATA_DIR = $Global:CORE_NODE_DATA_DIR
}

if (-not $env:HF_HOME) {
    $env:HF_HOME = Join-Path $Global:WWW_CACHE_DIR 'huggingface'
}
if (-not $env:HF_HUB_CACHE) {
    $env:HF_HUB_CACHE = Join-Path $Global:WWW_CACHE_DIR 'huggingface\hub'
}
if (-not $env:HUGGINGFACE_HUB_CACHE) {
    $env:HUGGINGFACE_HUB_CACHE = Join-Path $Global:WWW_CACHE_DIR 'huggingface\hub'
}
$__sccHfHubCache = Join-Path $Global:WWW_CACHE_DIR 'huggingface\hub'
if ($env:TRANSFORMERS_CACHE) {
    $__sccLegacyResolved = ''
    $__sccHubResolved = ''
    try {
        $__sccLegacyResolved = [System.IO.Path]::GetFullPath($env:TRANSFORMERS_CACHE)
        $__sccHubResolved = [System.IO.Path]::GetFullPath($__sccHfHubCache)
    }
    catch {
        $__sccLegacyResolved = $env:TRANSFORMERS_CACHE
        $__sccHubResolved = $__sccHfHubCache
    }
    if ($__sccLegacyResolved -eq $__sccHubResolved) {
        Remove-Item Env:TRANSFORMERS_CACHE -ErrorAction SilentlyContinue
    }
}
if (-not $env:TORCH_HOME) {
    $env:TORCH_HOME = Join-Path $Global:WWW_CACHE_DIR 'torch'
}
# pip's wheel/http cache is a package-manager cache: program drive, never the D: shared data.
if (-not $env:PIP_CACHE_DIR) {
    $env:PIP_CACHE_DIR = Join-Path $Global:CN_CACHE_ROOT 'pip'
}
if (-not $env:WHISPER_CACHE_DIR) {
    $env:WHISPER_CACHE_DIR = Join-Path $Global:WWW_CACHE_DIR 'whisper'
}
# EasyOCR reads EASYOCR_MODULE_PATH first (official docs), else the per-user
# ~\.EasyOCR; one shared model tree (same relative path as shared_cache_env.sh).
if (-not $env:EASYOCR_MODULE_PATH) {
    $env:EASYOCR_MODULE_PATH = Join-Path $Global:WWW_CACHE_DIR 'ocr\easyocr'
}
# scrcpy/adb bundle (Windows binaries) belongs to the program-drive tool root
# (E:\_<sys>_dev, D: fallback), not to the shared weights cache.
# NLTK data (g2p_en / melotts / gptsovits) is model data: one shared tree, found by
# nltk through NLTK_DATA (same relative path as shared_cache_env.sh).
if (-not $env:NLTK_DATA) {
    $env:NLTK_DATA = Join-Path $Global:WWW_CACHE_DIR 'nltk_data'
}
if (-not $env:SCRCPY_HOME) {
    $env:SCRCPY_HOME = Join-Path $Global:CN_TOOL_ROOT ([string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.scrcpy_bundle_dir.dir_name'))
}

# Cross-OS shared cache (Windows <-> Linux dual-boot on the same NTFS disk):
# official HF guidance for a hub cache shared across operating systems is to
# store plain files instead of snapshot symlinks (HF_HUB_DISABLE_SYMLINKS=1,
# huggingface_hub environment_variables docs) -- symlinks created on one OS are
# not always traversable on the other. Applies to new downloads only; existing
# relative symlinks keep working on both sides.
if (-not $env:HF_HUB_DISABLE_SYMLINKS) {
    $env:HF_HUB_DISABLE_SYMLINKS = '1'
}

function Ensure-PipCacheDirConfigured {
    param(
        [string]$PipExe = '',
        [string]$CacheDir = ''
    )

    if (-not $CacheDir) {
        $CacheDir = Join-Path $Global:CN_CACHE_ROOT 'pip'
    }
    if (-not (Test-Path $CacheDir)) {
        New-Item -ItemType Directory -Path $CacheDir -Force | Out-Null
    }

    if (-not $PipExe) {
        if ($Global:PIP_EXE_PATH -and (Test-Path $Global:PIP_EXE_PATH)) {
            $PipExe = $Global:PIP_EXE_PATH
        }
        elseif (Get-Command pip -ErrorAction SilentlyContinue) {
            $PipExe = (Get-Command pip).Source
        }
        else {
            return
        }
    }

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $current = & $PipExe config get global.cache-dir 2>$null
        $current = if ($current) { $current.Trim() } else { '' }
        if ($current -ne $CacheDir) {
            & $PipExe config set global.cache-dir $CacheDir 2>$null | Out-Null
        }
    }
    finally {
        $ErrorActionPreference = $prevEap
    }
}

Remove-Variable -Name __sccSubDirs, __sccDir, __sccPath, __sccHfHubCache, __sccLegacyResolved, __sccHubResolved, `
    __sccServiceContractPath, __sccServiceContractModule, __sccGetContractValue, __sccContractDataDriveRoot, __sccProgramDriveNamespace, `
    __sccProgramDrivePrimary, __sccProgramDriveFallback, __sccToolRootTemplate, `
    __sccCacheRootTemplate, __sccCacheRootFallbackTemplate, __sccCacheSubdirs, __sccTreesRootTemplate, `
    __sccToolchainEnvTemplate, __sccAppRootTemplate, __sccLegacyToolRootTemplate, __sccLegacyAppRootTemplate, __sccDownloadsRootTemplate, __sccLegacyDownloadsRootTemplate, __sccLegacyDownloadsCacheTemplate, __sccLegacyPipCacheTemplate, __sccWorkRootTemplate,__sccLegacyWorkRootTemplate,__sccLegacyPnpmStoreTemplate, __sccKeptDataRootTemplate, __sccDataDriveNamespace, __sccCoreNodeDataDirName, __sccSystemDriveSpec, `
    __sccProgramDrivePrimaryRoot, __sccProgramDriveFallbackRoot, __sccProgramDriveQualifies, `
    __sccEffectiveProgramDriveLetter, __sccSystemName -ErrorAction SilentlyContinue
