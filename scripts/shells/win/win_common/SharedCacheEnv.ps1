#
# SharedCacheEnv.ps1 - wire the ONE shared user-cache root on Windows.
#
# Replaces C:\Users\{username}\.cache with D:\www\cache (subpaths unchanged).
# Mirrors linux/common/shared_cache_env.sh: idempotent, respects caller overrides,
# sets HF_HOME / HF_HUB_CACHE / TORCH_HOME / PIP_CACHE_DIR / XDG_CACHE_HOME env vars.
# Does NOT set deprecated TRANSFORMERS_CACHE (transformers v5 uses HF_HOME only).
#
# Declares the Windows 3-drive constants (system/data/program), read from
# config/service_contract.json paths.drive_layout. Detection/computation only
# at load time -- never creates directories or writes anything on the program
# drive here; first-adoption (writing the E: marker) is a separate
# installer-only helper below.

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

# Resolves a paths.drive_layout template (e.g. "<program_drive>\.dev_<sys>")
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

# Language-independent E: qualification (docs_fix/REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md
# section 3.1): ready + Fixed + NTFS/ReFS, and, when the tree-subdir marker
# already exists, its content must match the drive's current partition GUID.
# A qualifying drive with no marker yet is the first-adoption case (still
# qualifies here; Register-CnProgramDriveAdoption below writes the marker
# later, from an installer, never from this load-time check).
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
        [string]$DriveLetter,
        [Parameter(Mandatory = $true)]
        [string]$TreeSubdir
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

    $cnMarkerPath = Join-Path (Join-Path $DriveRoot $TreeSubdir) $Global:CN_PROGRAM_DRIVE_MARKER_FILE_NAME
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

# Installer-only: writes the first-adoption marker (drive partition GUID) under
# <DriveRoot>\<TreeSubdir>\.cn_volume. Never called at load time; the caller is
# always an installer/ensure step, once it has decided to adopt this drive.
function Register-CnProgramDriveAdoption {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DriveRoot,
        [Parameter(Mandatory = $true)]
        [string]$DriveLetter,
        [Parameter(Mandatory = $true)]
        [string]$TreeSubdir
    )

    $cnPartitionGuid = Get-CnProgramDrivePartitionGuid -DriveLetter $DriveLetter
    if (-not $cnPartitionGuid) {
        throw "Cannot resolve a GPT partition GUID for drive letter ${DriveLetter}: adopting it as the program drive requires a GPT-partitioned NTFS or ReFS volume (an MBR disk reports no partition GUID), and reading it also requires an elevated process."
    }

    $cnTreeSubdirPath = Join-Path $DriveRoot $TreeSubdir
    if (-not (Test-Path -LiteralPath $cnTreeSubdirPath)) {
        New-Item -ItemType Directory -Path $cnTreeSubdirPath -Force | Out-Null
    }

    $cnMarkerPath = Join-Path $cnTreeSubdirPath $Global:CN_PROGRAM_DRIVE_MARKER_FILE_NAME
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

# Re-run safe: this file can be dot-sourced more than once per process (several
# win_common scripts dot-source it directly, not only through GlobalVars.ps1's
# once-guard), so only seed the flag the first time it is missing.
if (-not (Test-Path Variable:Global:CN_PROGRAM_DRIVE_FALLBACK_WARNED)) {
    $Global:CN_PROGRAM_DRIVE_FALLBACK_WARNED = $false
}

# Called by installers/ensure functions, never at load time. Prints once per
# process when the program drive fell back (E: absent or disqualified).
function Write-ProgramDriveFallbackWarning {
    if (-not $Global:WINDOWS_PROGRAM_DRIVE_IS_FALLBACK) {
        return
    }
    if ($Global:CN_PROGRAM_DRIVE_FALLBACK_WARNED) {
        return
    }

    Write-Warning ("Program drive {0} not available; using the original location {1}" -f $Global:CN_PROGRAM_DRIVE_PRIMARY_LABEL, $Global:WINDOWS_PROGRAM_DRIVE_ROOT)
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

$__sccContractDataDriveRoot = [string](Get-ServiceContractValue -ContractPath 'paths.windows_data_drive_root')
$__sccProgramDrivePrimary = [string](Get-ServiceContractValue -ContractPath 'paths.drive_layout.program_drive_primary')
$__sccProgramDriveFallback = [string](Get-ServiceContractValue -ContractPath 'paths.drive_layout.program_drive_fallback')
$__sccTreeSubdir = [string](Get-ServiceContractValue -ContractPath 'paths.drive_layout.tree_subdir')
$__sccTreeRootTemplate = [string](Get-ServiceContractValue -ContractPath 'paths.drive_layout.tree_root.windows')
$__sccTreeCacheRootTemplate = [string](Get-ServiceContractValue -ContractPath 'paths.drive_layout.tree_cache_root')
$__sccToolRootTemplate = [string](Get-ServiceContractValue -ContractPath 'paths.drive_layout.tool_root.windows')
$__sccToolchainEnvTemplate = [string](Get-ServiceContractValue -ContractPath 'paths.drive_layout.toolchain_env_file.windows')
$Global:CN_PROGRAM_DRIVE_PRIMARY_LABEL = $__sccProgramDrivePrimary

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
$__sccProgramDriveQualifies = Test-CnProgramDriveQualifies -DriveRoot $__sccProgramDrivePrimaryRoot -DriveLetter $__sccProgramDrivePrimary[0] -TreeSubdir $__sccTreeSubdir

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

$__sccSystemName = Get-CnWindowsSystemName

$Global:CN_TREE_ROOT = Resolve-CnDriveLayoutPath -Template $__sccTreeRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter }
$Global:CN_TREE_CACHE_ROOT = Resolve-CnDriveLayoutPath -Template $__sccTreeCacheRootTemplate -Replacements @{ '<tree_root>' = $Global:CN_TREE_ROOT }
$Global:CN_TOOL_ROOT = Resolve-CnDriveLayoutPath -Template $__sccToolRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter; '<sys>' = $__sccSystemName }
$Global:CN_TOOLCHAIN_ENV_FILE = Resolve-CnDriveLayoutPath -Template $__sccToolchainEnvTemplate -Replacements @{ '<tool_root>' = $Global:CN_TOOL_ROOT }

$Global:WINDOWS_PROGRAMING_DIR = Join-Path $Global:WINDOWS_DATA_DRIVE_ROOT 'programing'
$Global:WINDOWS_PROGRAMING_USERS_DIR = Join-Path $Global:WINDOWS_PROGRAMING_DIR 'Users'
$Global:WWW_BASE_DIR = Join-Path $Global:WINDOWS_DATA_DRIVE_ROOT 'www'
$Global:WWW_CACHE_DIR = Join-Path $Global:WWW_BASE_DIR 'cache'
$Global:CORE_NODE_DATA_DIR = Join-Path $Global:WWW_BASE_DIR 'core_node'
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
if (-not $env:PIP_CACHE_DIR) {
    $env:PIP_CACHE_DIR = Join-Path $Global:WWW_CACHE_DIR 'pip'
}
if (-not $env:WHISPER_CACHE_DIR) {
    $env:WHISPER_CACHE_DIR = Join-Path $Global:WWW_CACHE_DIR 'whisper'
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
        $CacheDir = Join-Path $Global:WWW_CACHE_DIR 'pip'
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
    __sccServiceContractPath, __sccServiceContractModule, __sccContractDataDriveRoot, __sccProgramDrivePrimary, `
    __sccProgramDriveFallback, __sccTreeSubdir, __sccTreeRootTemplate, __sccTreeCacheRootTemplate, `
    __sccToolRootTemplate, __sccToolchainEnvTemplate, __sccSystemDriveSpec, `
    __sccProgramDrivePrimaryRoot, __sccProgramDriveFallbackRoot, __sccProgramDriveQualifies, `
    __sccEffectiveProgramDriveLetter, __sccSystemName -ErrorAction SilentlyContinue
