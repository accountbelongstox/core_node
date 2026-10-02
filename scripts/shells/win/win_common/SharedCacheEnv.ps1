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
# (including the namespace root itself, e.g. E:\core_node_compiler) in one
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
$__sccToolRootFallbackTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.tool_root.windows_d_fallback')
$__sccCacheRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.cache_root.windows')
$__sccCacheRootFallbackTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.cache_root.windows_d_fallback')
$__sccCacheSubdirs = @(& $__sccGetContractValue -ContractPath 'paths.drive_layout.cache_subdirs')
$__sccTreesRootTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.trees_root.windows')
$__sccToolchainEnvTemplate = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.toolchain_env_file.windows')
# Read once here rather than hard-coded below (DIRECTORY_NAMESPACE_RULES.md:
# "Scripts read them from the contract ... They never write a literal"); both
# resolve to the same strings the D: fallback literals used to spell out, so
# this is a definition-source change only, not a path change.
$__sccDataDriveNamespace = [string](& $__sccGetContractValue -ContractPath 'paths.drive_layout.namespaces.windows_data_drive')
$__sccCoreNodeDataDirName = [string](& $__sccGetContractValue -ContractPath 'paths.core_node_data_dir_name')
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
$__sccProgramDriveQualifies = Test-CnProgramDriveQualifies -DriveRoot $__sccProgramDrivePrimaryRoot -DriveLetter $__sccProgramDrivePrimary[0]

# Always the intended E: namespace root (DIRECTORY_NAMESPACE_RULES.md #1),
# regardless of whether E: currently qualifies -- Write-ProgramDriveFallbackWarning
# names it even when falling back to D:. The Join-Path cmdlet resolves through
# the PowerShell FileSystem provider and throws DriveNotFoundException when
# the drive letter has no PSDrive at all (the common fallback case, E: absent
# outright), so this goes through Resolve-CnDriveLayoutPath instead, exactly
# like every other drive_layout template below -- [System.IO.Path]::GetFullPath
# only normalizes the string and never touches the filesystem.
$Global:CN_PROGRAM_DRIVE_NAMESPACE_ROOT = Resolve-CnDriveLayoutPath -Template '<program_drive>\<namespace>' -Replacements @{ '<program_drive>' = $__sccProgramDrivePrimary; '<namespace>' = $__sccProgramDriveNamespace }

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

# <program_drive> and <sys> are each resolved exactly once above ($__sccEffectiveProgramDriveLetter,
# $__sccSystemName), then reused for every template that needs them. D28/D30:
# when E: qualifies, tool_root, cache_root and trees_root each resolve their
# own contract template under the E: namespace root (paths.drive_layout.namespaces.windows_program_drive,
# already embedded in the templates themselves); on the D: fallback, tool_root
# and cache_root use their literal *_d_fallback templates instead (no
# <program_drive> token to substitute), and CN_TREES_ROOT is the empty string
# -- D28: junctions (node_modules/vendor/.venv) are never created on the D:
# fallback, so ProjectTreeCommon.ps1 falls back to plain in-repo directories
# and prints Write-ProgramDriveFallbackWarning. The junction/link state
# machine itself lives entirely in ProjectTreeCommon.ps1, not here.
if ($__sccProgramDriveQualifies) {
    $Global:CN_TOOL_ROOT = Resolve-CnDriveLayoutPath -Template $__sccToolRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter; '<sys>' = $__sccSystemName }
    $Global:CN_CACHE_ROOT = Resolve-CnDriveLayoutPath -Template $__sccCacheRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter }
    $Global:CN_TREES_ROOT = Resolve-CnDriveLayoutPath -Template $__sccTreesRootTemplate -Replacements @{ '<program_drive>' = $__sccEffectiveProgramDriveLetter }
}
else {
    $Global:CN_TOOL_ROOT = Resolve-CnDriveLayoutPath -Template $__sccToolRootFallbackTemplate -Replacements @{ '<sys>' = $__sccSystemName }
    $Global:CN_CACHE_ROOT = Resolve-CnDriveLayoutPath -Template $__sccCacheRootFallbackTemplate -Replacements @{}
    $Global:CN_TREES_ROOT = ''
}
$Global:CN_CACHE_SUBDIR_NAMES = @($__sccCacheSubdirs | ForEach-Object { [string]$_ })
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
if (-not $env:PIP_CACHE_DIR) {
    $env:PIP_CACHE_DIR = Join-Path $Global:WWW_CACHE_DIR 'pip'
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
# (E:\core_node_compiler\.dev_<sys>, D: fallback), not to the shared weights cache.
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
    __sccServiceContractPath, __sccServiceContractModule, __sccGetContractValue, __sccContractDataDriveRoot, __sccProgramDriveNamespace, `
    __sccProgramDrivePrimary, __sccProgramDriveFallback, __sccToolRootTemplate, __sccToolRootFallbackTemplate, `
    __sccCacheRootTemplate, __sccCacheRootFallbackTemplate, __sccCacheSubdirs, __sccTreesRootTemplate, `
    __sccToolchainEnvTemplate, __sccDataDriveNamespace, __sccCoreNodeDataDirName, __sccSystemDriveSpec, `
    __sccProgramDrivePrimaryRoot, __sccProgramDriveFallbackRoot, __sccProgramDriveQualifies, `
    __sccEffectiveProgramDriveLetter, __sccSystemName -ErrorAction SilentlyContinue
