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
#
# SharedCacheEnv.ps1 - wire the ONE shared user-cache root on Windows.
#
# Replaces C:\Users\{username}\.cache with D:\www\cache (subpaths unchanged).
# Mirrors linux/common/shared_cache_env.sh: idempotent, respects caller overrides,
# sets HF_HOME / HF_HUB_CACHE / TORCH_HOME / PIP_CACHE_DIR / XDG_CACHE_HOME env vars.
# Does NOT set deprecated TRANSFORMERS_CACHE (transformers v5 uses HF_HOME only).

$Global:WWW_CACHE_DIR = 'D:\www\cache'
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

Remove-Variable -Name __sccSubDirs, __sccDir, __sccPath, __sccHfHubCache, __sccLegacyResolved, __sccHubResolved -ErrorAction SilentlyContinue
