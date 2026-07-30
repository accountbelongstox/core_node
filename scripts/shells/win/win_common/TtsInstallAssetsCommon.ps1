# Resolve pycore/tts_install_assets from an install_powershells Step script directory.

$script:LastReportedLocalModelPath = ''

function Get-ShellsLinuxCommonDirFromInstallScript {
    param([string]$InstallScriptRoot)
    $shellsDir = Split-Path (Split-Path (Split-Path $InstallScriptRoot -Parent) -Parent) -Parent
    return (Join-Path $shellsDir 'linux\common')
}

. (Join-Path $PSScriptRoot 'TorchCudaInstallCommon.ps1')
. (Join-Path $PSScriptRoot 'PrerequisiteStepCommon.ps1')

function Get-PycoreRepoRootFromInstallScript {
    param([string]$InstallScriptRoot)
    return (Split-Path (Split-Path (Split-Path (Split-Path $InstallScriptRoot -Parent) -Parent) -Parent) -Parent)
}

function Get-CoreNodeRepoRootFromWinCommon {
    $root = $PSScriptRoot
    foreach ($unused in 1..4) {
        $root = Split-Path $root -Parent
    }
    return $root
}

function Refresh-ProcessPathEnv {
    $machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    if ($machinePath -and $userPath) {
        $env:Path = "$machinePath;$userPath"
    } elseif ($machinePath) {
        $env:Path = $machinePath
    } elseif ($userPath) {
        $env:Path = $userPath
    }
}

function Test-SoxOnPath {
    return [bool](Get-Command sox -ErrorAction SilentlyContinue)
}

function Find-SoxExecutable {
    $cmd = Get-Command sox -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $localAppData = $env:LOCALAPPDATA
    if (-not $localAppData) { return $null }

    $wingetRoot = Join-Path $localAppData 'Microsoft\WinGet\Packages'
    if (-not (Test-Path -LiteralPath $wingetRoot)) { return $null }

    $hits = Get-ChildItem -Path $wingetRoot -Directory -Filter 'ChrisBagwell.SoX*' -ErrorAction SilentlyContinue
    foreach ($pkgDir in $hits) {
        $exe = Get-ChildItem -Path $pkgDir.FullName -Recurse -Filter 'sox.exe' -File -ErrorAction SilentlyContinue |
            Select-Object -First 1
        if ($exe) { return $exe.FullName }
    }
    return $null
}

function Get-SoxPathCacheFile {
    $userDataDir = $env:LOCALAPPDATA
    if (-not $userDataDir) { return $null }
    return (Join-Path $userDataDir 'pycore\cache\sox_path.txt')
}

function Add-SoxProcessPath {
    param([Parameter(Mandatory = $true)][string]$ExecutablePath)

    $parentDir = Split-Path $ExecutablePath -Parent
    if (-not $parentDir) { return }

    $pathEntries = @($env:Path -split ';' | Where-Object { $_ })
    $normalizedParent = (Normalize-WindowsPath $parentDir).TrimEnd('\')
    $hasEntry = @($pathEntries | Where-Object {
        ((Normalize-WindowsPath $_).TrimEnd('\')) -ieq $normalizedParent
    }).Count -gt 0
    if (-not $hasEntry) {
        $env:Path = "$parentDir;$env:Path"
    }
}

function Ensure-SoxOnPath {
    param(
        [string]$Prefix = '',
        [switch]$Force
    )

    $soxPath = $null
    $soxCacheFile = Get-SoxPathCacheFile
    $windowsPathFunctionPath = Join-Path $PSScriptRoot 'WindowsPathFunction.ps1'
    $windowsPathFunctionLoaded = Get-Variable -Name 'PycoreWindowsPathFunctionLoaded' -Scope Script -ErrorAction SilentlyContinue
    if ($null -eq $windowsPathFunctionLoaded -or -not [bool]$windowsPathFunctionLoaded.Value) {
        . $windowsPathFunctionPath
        Set-Variable -Name 'PycoreWindowsPathFunctionLoaded' -Scope Script -Value $true
    }

    if ((Test-SoxOnPath) -and -not $Force) {
        $soxPath = (Get-Command sox -ErrorAction SilentlyContinue).Source
    }

    if (-not $soxPath -and -not $Force -and $soxCacheFile -and (Test-Path -LiteralPath $soxCacheFile -PathType Leaf)) {
        $cachedPath = (Get-Content -LiteralPath $soxCacheFile -Raw -ErrorAction SilentlyContinue)
        if ($cachedPath) { $cachedPath = $cachedPath.Trim() }
        if ($cachedPath -and (Test-Path -LiteralPath $cachedPath -PathType Leaf)) {
            $soxPath = $cachedPath
            Add-SoxProcessPath -ExecutablePath $soxPath
        } elseif ($soxCacheFile) {
            Remove-Item -LiteralPath $soxCacheFile -Force -ErrorAction SilentlyContinue
        }
    }

    if (-not $soxPath) {
        $soxPath = Find-SoxExecutable
    }

    if (-not $soxPath) {
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if ($winget) {
            Write-Host ("{0} [..] winget install ChrisBagwell.SoX (pysox/qwen-tts runtime binary) ..." -f $Prefix) -ForegroundColor Yellow
            $prevEap = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & $winget.Source install --id ChrisBagwell.SoX -e --accept-source-agreements --accept-package-agreements --disable-interactivity
            $ErrorActionPreference = $prevEap
            Refresh-ProcessPathEnv
            if (Test-SoxOnPath) {
                $soxPath = (Get-Command sox -ErrorAction SilentlyContinue).Source
            }
        }
    }

    if (-not $soxPath) {
        $chocoExe = $Global:CHOCO_EXE
        if ($chocoExe -and (Test-Path -LiteralPath $chocoExe)) {
            Write-Host ("{0} [..] choco install sox.portable (pysox/qwen-tts runtime binary) ..." -f $Prefix) -ForegroundColor Yellow
            $prevEap = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & $chocoExe install sox.portable -y --no-progress
            $ErrorActionPreference = $prevEap
            Refresh-ProcessPathEnv
            if (Test-SoxOnPath) {
                $soxPath = (Get-Command sox -ErrorAction SilentlyContinue).Source
            }
        }
    }

    if ($soxPath) {
        Add-SoxProcessPath -ExecutablePath $soxPath
        if ($soxCacheFile) {
            $cacheDir = Split-Path $soxCacheFile -Parent
            New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null
            Set-Content -LiteralPath $soxCacheFile -Value $soxPath -Encoding ASCII
        }
        return $true
    }

    Write-Host ("{0} [!] SoX NOT on PATH — pysox (qwen-tts tokenizer) warns at import. Install: winget install ChrisBagwell.SoX" -f $Prefix) -ForegroundColor DarkYellow
    return $false
}

function Test-PyModule {
    param(
        [Parameter(Mandatory = $true)][string]$Py,
        [Parameter(Mandatory = $true)][string]$ModuleName
    )

    return (Test-PycorePythonModulePresent -PythonExe $Py -ModuleName $ModuleName)
}

function Get-PycoreTtsInstallAssetsDir {
    param([string]$InstallScriptRoot = $PSScriptRoot)
    $repoRoot = Get-PycoreRepoRootFromInstallScript -InstallScriptRoot $InstallScriptRoot
    return (Join-Path $repoRoot 'pycore\tts_install_assets')
}

function Resolve-TtsModelTier {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Key,
        [Parameter(Mandatory = $true)][string]$InstallScriptRoot,
        [switch]$Gpu
    )
    $assetsDir = Get-PycoreTtsInstallAssetsDir -InstallScriptRoot $InstallScriptRoot
    $tierScript = Join-Path $assetsDir 'tts_model_tiers.py'
    $flag = if ($Gpu) { '--gpu' } else { '--cpu' }
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $value = (& $PythonExe $tierScript resolve $Key $flag 2>$null) -join ''
    $ErrorActionPreference = $prevEap
    $value = "$value".Trim()
    if (-not $value) { return $null }
    return $value
}

function Write-TtsOfficialEnv {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Engine,
        [Parameter(Mandatory = $true)][string]$InstallScriptRoot,
        [string]$Prefix = ''
    )
    $assetsDir = Get-PycoreTtsInstallAssetsDir -InstallScriptRoot $InstallScriptRoot
    $tierScript = Join-Path $assetsDir 'tts_model_tiers.py'
    $line = & $PythonExe $tierScript official-env $Engine 2>$null
    if ($line) {
        Write-Host ("{0} official env ({1}): {2}" -f $Prefix, $Engine, $line) -ForegroundColor DarkGray
    }
}

function Write-TtsIdempotentSkip {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$Reason,
        [Parameter(Mandatory = $true)][string]$InstallScriptRoot,
        [string]$Prefix = ''
    )
    $assetsDir = Get-PycoreTtsInstallAssetsDir -InstallScriptRoot $InstallScriptRoot
    $tierScript = Join-Path $assetsDir 'tts_model_tiers.py'
    $msg = & $PythonExe $tierScript idempotent $Reason 2>$null
    if ($msg) {
        Write-Host ("{0} {1}" -f $Prefix, $msg) -ForegroundColor Green
    }
}

function Save-SttModelTier {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$InstallScriptRoot,
        [string]$WhisperModel = '',
        [string]$FasterWhisperModel = ''
    )
    if (-not $WhisperModel -and -not $FasterWhisperModel) { return }
    $repoRoot = Get-PycoreRepoRootFromInstallScript -InstallScriptRoot $InstallScriptRoot
    $args = @()
    if ($WhisperModel) { $args += "whisper='$WhisperModel'" }
    if ($FasterWhisperModel) { $args += "faster_whisper='$FasterWhisperModel'" }
    $call = "persist_stt_models($($args -join ', '))"
    $py = @"
import sys
sys.path.insert(0, r'$repoRoot')
from pycore.pyutils.common.model_tiers import persist_stt_models
$call
"@
    try { & $PythonExe -c $py 2>$null | Out-Null } catch { }
}

function Resolve-HfMirrorBase {
    if ($env:HF_ENDPOINT) { return $env:HF_ENDPOINT.TrimEnd('/') }
    if ($env:GPTSOVITS_MIRROR) { return $env:GPTSOVITS_MIRROR.TrimEnd('/') }
    return 'https://hf-mirror.com'
}

function Test-HfGlobMatch {
    param(
        [Parameter(Mandatory = $true)][string]$FileName,
        [Parameter(Mandatory = $true)][string]$Pattern
    )
    if ($Pattern -eq '*') { return $true }
    $regex = '^' + [regex]::Escape($Pattern).Replace('\*', '.*').Replace('\?', '.') + '$'
    return ($FileName -match $regex)
}

function Get-HfRepoTreeCatalog {
    param(
        [Parameter(Mandatory = $true)][string]$RepoId,
        [string]$SubPath = ''
    )
    $catalog = @{}
    $bases = @('https://huggingface.co', (Resolve-HfMirrorBase))
    foreach ($base in $bases) {
        try {
            $pathPart = if ($SubPath) { "/$SubPath" } else { '' }
            $uri = ('{0}/api/models/{1}/tree/main{2}' -f $base.TrimEnd('/'), $RepoId, $pathPart)
            $entries = Invoke-RestMethod -Uri $uri -TimeoutSec 30 -ErrorAction Stop
            if (-not $entries) { continue }
            foreach ($entry in $entries) {
                $name = [string]$entry.path
                if (-not $name) { continue }
                if ([string]$entry.type -eq 'directory') {
                    $child = Get-HfRepoTreeCatalog -RepoId $RepoId -SubPath $name
                    foreach ($key in $child.Keys) {
                        $catalog[$key] = $child[$key]
                    }
                    continue
                }
                $size = 0L
                if ($null -ne $entry.size) {
                    $size = [long]$entry.size
                } elseif ($entry.lfs -and $null -ne $entry.lfs.size) {
                    $size = [long]$entry.lfs.size
                }
                $catalog[$name] = $size
            }
            if ($catalog.Count -gt 0) { return $catalog }
        } catch { }
    }
    return $catalog
}

function Get-HfRepoFileCatalog {
    param([Parameter(Mandatory = $true)][string]$RepoId)
    $catalog = Get-HfRepoTreeCatalog -RepoId $RepoId
    if ($catalog.Count -gt 0) {
        return $catalog
    }
    $fallback = @{}
    $bases = @('https://huggingface.co', (Resolve-HfMirrorBase))
    foreach ($base in $bases) {
        try {
            $uri = ('{0}/api/models/{1}' -f $base.TrimEnd('/'), $RepoId)
            $resp = Invoke-RestMethod -Uri $uri -TimeoutSec 30 -ErrorAction Stop
            if ($resp.siblings) {
                foreach ($entry in $resp.siblings) {
                    $name = [string]$entry.rfilename
                    if (-not $name) { continue }
                    $size = 0L
                    if ($null -ne $entry.size) {
                        $size = [long]$entry.size
                    } elseif ($entry.lfs -and $null -ne $entry.lfs.size) {
                        $size = [long]$entry.lfs.size
                    }
                    $fallback[$name] = $size
                }
                return $fallback
            }
        } catch { }
    }
    return $fallback
}

function Get-HfRepoFileNames {
    param([Parameter(Mandatory = $true)][string]$RepoId)
    $catalog = Get-HfRepoFileCatalog -RepoId $RepoId
    if ($catalog.Count -gt 0) {
        return @($catalog.Keys)
    }
    return @()
}

function Test-HfFileDownloadComplete {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [long]$ExpectedBytes = 0
    )
    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $len = (Get-Item -LiteralPath $Path).Length
    if ($ExpectedBytes -gt 0) { return ($len -ge $ExpectedBytes) }
    return ($len -gt 0)
}

function Backup-InstallAssetPath {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Prefix = ''
    )
    $parent = $null
    $backupRoot = $null
    $stamp = $null
    $target = $null
    $leaf = $null
    $suffix = 0

    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $parent = Split-Path -Parent $Path
    if (-not $parent) { $parent = (Get-Location).Path }
    $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupRoot = Join-Path $parent ('.backup_{0}' -f $stamp)
    while (Test-Path -LiteralPath $backupRoot) {
        $suffix += 1
        $backupRoot = Join-Path $parent ('.backup_{0}_{1}' -f $stamp, $suffix)
    }
    New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
    $leaf = Split-Path -Leaf $Path
    $target = Join-Path $backupRoot $leaf
    Move-Item -LiteralPath $Path -Destination $target -Force
    Write-Host ("{0} [backup] moved {1} -> {2}" -f $Prefix, $Path, $target) -ForegroundColor Yellow
    return $target
}

function Invoke-HfFileDownloadResumable {
    param(
        [Parameter(Mandatory = $true)][string]$RepoId,
        [Parameter(Mandatory = $true)][string]$FileName,
        [Parameter(Mandatory = $true)][string]$OutPath,
        [string]$MirrorBase = '',
        [string]$Prefix = '',
        [long]$CatalogBytes = 0
    )
    if (-not $MirrorBase) { $MirrorBase = Resolve-HfMirrorBase }
    $parent = Split-Path -Parent $OutPath
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    $expected = [long]$CatalogBytes
    if ((Test-Path -LiteralPath $OutPath) -and $expected -le 0) {
        $have = (Get-Item -LiteralPath $OutPath).Length
        if ($have -gt 0) {
            Write-Host ("{0} [idempotent] local file found: {1} ({2:N0} bytes); remote lookup skipped" -f $Prefix, $OutPath, $have) -ForegroundColor DarkGray
            return $true
        }
    }
    $url = ('{0}/{1}/resolve/main/{2}' -f $MirrorBase.TrimEnd('/'), $RepoId, $FileName)
    if ($expected -le 0) {
        try {
            $head = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 5 -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
            if ($head.Headers['Content-Length']) {
                $expected = [long]$head.Headers['Content-Length']
            }
        } catch { }
    }
    if ((Test-Path -LiteralPath $OutPath) -and $expected -gt 0) {
        $have = (Get-Item -LiteralPath $OutPath).Length
        if ($have -gt 0 -and $have -lt $expected) {
            Write-Host ("{0} [resume] continuing incomplete {1} ({2:N0} / {3:N0} bytes)" -f $Prefix, $FileName, $have, $expected) -ForegroundColor Yellow
        }
    }
    if (Test-HfFileDownloadComplete -Path $OutPath -ExpectedBytes $expected) {
        Write-Host ("{0} [idempotent] skipping: {1}" -f $Prefix, $FileName) -ForegroundColor DarkGray
        return $true
    }
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if (-not $curl) {
        Write-Host ("{0} [!] curl.exe missing; cannot download {1}" -f $Prefix, $FileName) -ForegroundColor DarkYellow
        return $false
    }
    & $curl.Source -L -C - --retry 3 --connect-timeout 30 -o $OutPath $url
    if (-not (Test-HfFileDownloadComplete -Path $OutPath -ExpectedBytes $expected)) {
        return $false
    }
    return $true
}

# Persistent model download contract:
# - DestDir is independent from every Python venv and is never recreated here.
# - Complete files are skipped by size/integrity checks.
# - Partial files are resumed in place.
# - A failed pass removes only the model sentinel so the next run revalidates;
#   already downloaded model files and their directory remain untouched.
function Install-HfRepoFlat {
    param(
        [Parameter(Mandatory = $true)][string]$RepoId,
        [Parameter(Mandatory = $true)][string]$DestDir,
        [Parameter(Mandatory = $true)][string]$SentinelPath,
        [string[]]$AllowPatterns = @('*'),
        [string]$Prefix = '',
        [string]$MirrorBase = '',
        [string]$SentinelValue = ''
    )
    $localWeightFiles = @()
    $localWeightBytes = 0L
    New-Item -ItemType Directory -Force -Path $DestDir | Out-Null
    if (-not $SentinelValue) { $SentinelValue = $RepoId }
    if (Test-NeuralTtsLocalWeightsReady -WeightsDir $DestDir -RepoId $RepoId) {
        $localWeightFiles = @(Get-ChildItem -Path $DestDir -Recurse -Include '*.safetensors', '*.bin', '*.pt' -File -ErrorAction SilentlyContinue)
        $localWeightBytes = [long](($localWeightFiles | Measure-Object -Property Length -Sum).Sum)
        Set-Content -Path $SentinelPath -Value $SentinelValue -Encoding utf8
        Write-Host ("{0} [idempotent] local model found: {1} ({2:N0} bytes); remote lookup skipped" -f $Prefix, $DestDir, $localWeightBytes) -ForegroundColor Green
        return $true
    }
    if (-not $MirrorBase) { $MirrorBase = Resolve-HfMirrorBase }

    $catalog = Get-HfRepoFileCatalog -RepoId $RepoId
    if ($catalog.Count -eq 0) {
        Write-Host ("{0} [!] could not list repo files for {1}" -f $Prefix, $RepoId) -ForegroundColor DarkYellow
        return $false
    }

    $wanted = @()
    foreach ($name in $catalog.Keys) {
        foreach ($pattern in $AllowPatterns) {
            if (Test-HfGlobMatch -FileName $name -Pattern $pattern) {
                $wanted += $name
                break
            }
        }
    }
    Write-Host ("{0} [..] {1} of {2} files match allow-list (mirror {3})" -f $Prefix, $wanted.Count, $catalog.Count, $MirrorBase) -ForegroundColor DarkGray

    $allOk = $true
    foreach ($name in $wanted) {
        $out = Join-Path $DestDir ($name -replace '/', '\')
        $catalogBytes = 0L
        if ($catalog.ContainsKey($name)) {
            $catalogBytes = [long]$catalog[$name]
        }
        if (-not (Invoke-HfFileDownloadResumable -RepoId $RepoId -FileName $name -OutPath $out -MirrorBase $MirrorBase -Prefix $Prefix -CatalogBytes $catalogBytes)) {
            $allOk = $false
        }
    }

    if ($allOk -and $wanted.Count -gt 0) {
        Set-Content -Path $SentinelPath -Value $SentinelValue -Encoding utf8
        return $true
    }
    if (Test-Path -LiteralPath $SentinelPath) {
        Remove-Item -LiteralPath $SentinelPath -Force -ErrorAction SilentlyContinue
    }
    return $false
}

function Test-NeuralTtsLocalWeightsReady {
    param(
        [Parameter(Mandatory = $true)][string]$WeightsDir,
        [string]$RepoId = ''
    )
    if (-not (Test-Path -LiteralPath $WeightsDir)) { return $false }
    $cfg = Get-ChildItem -Path $WeightsDir -Recurse -Filter 'config.json' -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $cfg) { return $false }

    $weightFiles = @(Get-ChildItem -Path $WeightsDir -Recurse -Include '*.safetensors', '*.bin', '*.pt' -File -ErrorAction SilentlyContinue)
    $totalBytes = 0L
    if (-not $weightFiles -or $weightFiles.Count -eq 0) { return $false }

    foreach ($file in $weightFiles) {
        if ($file.Length -le 0) { return $false }
        $totalBytes += $file.Length
    }
    if ($script:LastReportedLocalModelPath -ne $WeightsDir) {
        Write-Host ("[model-cache] local model found: {0} ({1:N0} bytes)" -f $WeightsDir, $totalBytes) -ForegroundColor DarkGray
        $script:LastReportedLocalModelPath = $WeightsDir
    }
    return $true
}

function Get-WhisperModelDownloadUrl {
    param([Parameter(Mandatory = $true)][string]$Model)
    $map = @{
        'tiny'       = 'https://openaipublic.azureedge.net/main/whisper/models/65147644a51805b8a4949454ea3baf911679d133517d4a5ebc44089d984332b/tiny.pt'
        'tiny.en'    = 'https://openaipublic.azureedge.net/main/whisper/models/65147644a51805b8a4949454ea3baf911679d133517d4a5ebc44089d984332b/tiny.en.pt'
        'base'       = 'https://openaipublic.azureedge.net/main/whisper/models/139c1045a4878f4603a1285e1630e4931b2ae6f634be1141045b1f1797c7435/base.pt'
        'base.en'    = 'https://openaipublic.azureedge.net/main/whisper/models/25a8656b74f98eb9848ed2ceccc261d8628bba9ed516e8a86ac9738c6f1765c/base.en.pt'
        'small'      = 'https://openaipublic.azureedge.net/main/whisper/models/9ecf779972d90ba49c06d968637d720dd632c55bbf88496611daf2114e9031bf/small.pt'
        'small.en'   = 'https://openaipublic.azureedge.net/main/whisper/models/9ecf779972d90ba49c06d968637d720dd632c55bbf88496611daf2114e9031bf/small.en.pt'
        'medium'     = 'https://openaipublic.azureedge.net/main/whisper/models/345ae4da62f9b3d59415adc60127b97c714f32e89f0c00d4a6021bbea85ae283/medium.pt'
        'medium.en'  = 'https://openaipublic.azureedge.net/main/whisper/models/d7440d1dc186f76616474e89803ba5a0c5763e2bcf4f8d3a0ea7741dde9c265/medium.en.pt'
        'large-v2'   = 'https://openaipublic.azureedge.net/main/whisper/models/81f7c96c852ee8fc532187b61f875ceec1a1baeda7af2a7ab0e9a6395ad8a89d/large-v2.pt'
        'large-v3'   = 'https://openaipublic.azureedge.net/main/whisper/models/e5b1a8937a99fd112907ae80315fedda765a69cfd366fb9bce46bada3b0d6010/large-v3.pt'
        'large'      = 'https://openaipublic.azureedge.net/main/whisper/models/e5b1a8937a99fd112907ae80315fedda765a69cfd366fb9bce46bada3b0d6010/large-v3.pt'
    }
    return $map[$Model]
}

function Install-WhisperModelWeights {
    param(
        [Parameter(Mandatory = $true)][string]$Model,
        [Parameter(Mandatory = $true)][string]$CacheDir,
        [string]$Prefix = ''
    )
    $url = Get-WhisperModelDownloadUrl -Model $Model
    if (-not $url) {
        Write-Host ("{0} [!] unknown whisper model '{1}'" -f $Prefix, $Model) -ForegroundColor DarkYellow
        return $false
    }
    New-Item -ItemType Directory -Force -Path $CacheDir | Out-Null
    $out = Join-Path $CacheDir ("{0}.pt" -f $Model)
    $expected = 0L
    if (Test-HfFileDownloadComplete -Path $out) {
        $localBytes = (Get-Item -LiteralPath $out).Length
        Write-Host ("{0} [idempotent] local whisper model found: {1} ({2:N0} bytes); remote lookup skipped" -f $Prefix, $out, $localBytes) -ForegroundColor Green
        return $true
    }
    try {
        $head = Invoke-WebRequest -Uri $url -Method Head -MaximumRedirection 5 -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
        if ($head.Headers['Content-Length']) { $expected = [long]$head.Headers['Content-Length'] }
    } catch { }
    if (Test-HfFileDownloadComplete -Path $out -ExpectedBytes $expected) {
        Write-Host ("{0} [idempotent] skipping: whisper {1} already cached" -f $Prefix, $Model) -ForegroundColor Green
        return $true
    }
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if (-not $curl) {
        Write-Host ("{0} [!] curl.exe missing; cannot download whisper {1}" -f $Prefix, $Model) -ForegroundColor DarkYellow
        return $false
    }
    Write-Host ("{0} [..] downloading whisper '{1}' -> {2}" -f $Prefix, $Model, $out) -ForegroundColor Yellow
    & $curl.Source -L -C - --retry 3 --connect-timeout 30 -o $out $url
    return (Test-HfFileDownloadComplete -Path $out -ExpectedBytes $expected)
}

# --------------------------------------------------------------------------- #
# Generic isolated per-engine TTS venv (Bucket B) — GENERALISES Step61's proven #
# qwen3tts approach via pycore.pyutils.common.python_env.isolated_venv.         #
# melotts + gptsovits pin a transformers that must NEVER touch the shared main  #
# interpreter, so they run their api server inside a DEDICATED per-engine venv.  #
# These helpers invoke the SYSTEM Python to build/verify/resolve that venv;      #
# ensure_venv() is self-repairing (repairs a broken venv in place) and idempotent.#
# See development-guides/cross-docs/TTS_STT_ENGINE_LIFECYCLE_AND_CONCURRENCY.md. #
# --------------------------------------------------------------------------- #
function ConvertTo-PyStringLiteral {
    # Emit a Python single-quoted string literal. Backslashes are folded to forward
    # slashes (safe for Windows filesystem paths passed to Python and for package
    # specs / import code, none of which contain backslashes), quotes are escaped.
    param([string]$Value)
    $s = ($Value -replace '\\', '/')
    $s = ($s -replace "'", "\'")
    return ("'" + $s + "'")
}

function ConvertTo-PyListLiteral {
    param([string[]]$Items)
    if (-not $Items -or $Items.Count -eq 0) { return '[]' }
    $parts = @()
    foreach ($item in $Items) { $parts += (ConvertTo-PyStringLiteral -Value $item) }
    return ('[' + ($parts -join ', ') + ']')
}

function Test-IsolatedTtsVenvProvisioned {
    # Quick no-build gate based on the isolated environment layout and stamp.
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$CoreNodeRoot,
        [Parameter(Mandatory = $true)][string]$Engine
    )
    $rootLiteral = ($CoreNodeRoot -replace "'", "''")
    $engineLit = ConvertTo-PyStringLiteral -Value $Engine
    $prevSkip = $env:PYCORE_SKIP_DEP_CHECK
    $prevEap = $ErrorActionPreference
    $out = ''
    $pyCode = @"
import sys
sys.path.insert(0, r'$rootLiteral')
from pycore.pyutils.common.python_env import isolated_venv
sys.stdout.write('__VENV_READY__' if isolated_venv.venv_ready($engineLit) else '__VENV_NOTREADY__')
"@
    # PYCORE_SKIP_DEP_CHECK=1: importing pycore.pyutils.tts must NOT run the import-time
    # check_and_install_dependencies() (it does pip ops and throws under Stop).
    try {
        $env:PYCORE_SKIP_DEP_CHECK = '1'
        $ErrorActionPreference = 'Continue'
        $out = (& $PythonExe -c $pyCode 2>$null) -join ''
    } finally {
        $ErrorActionPreference = $prevEap
        $env:PYCORE_SKIP_DEP_CHECK = $prevSkip
    }
    return ($out -match '__VENV_READY__')
}

function Resolve-IsolatedTtsVenvPython {
    # Return the engine's isolated venv interpreter path (or '' when not provisioned).
    # Used for post-build steps that must run inside the venv. Never builds.
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$CoreNodeRoot,
        [Parameter(Mandatory = $true)][string]$Engine
    )
    $rootLiteral = ($CoreNodeRoot -replace "'", "''")
    $engineLit = ConvertTo-PyStringLiteral -Value $Engine
    $prevSkip = $env:PYCORE_SKIP_DEP_CHECK
    $prevEap = $ErrorActionPreference
    $out = ''
    $pyCode = @"
import sys
sys.path.insert(0, r'$rootLiteral')
from pycore.pyutils.common.python_env import isolated_venv
sys.stdout.write(isolated_venv.resolve_python($engineLit) or '')
"@
    try {
        $env:PYCORE_SKIP_DEP_CHECK = '1'
        $ErrorActionPreference = 'Continue'
        $out = (& $PythonExe -c $pyCode 2>$null) -join ''
    } finally {
        $ErrorActionPreference = $prevEap
        $env:PYCORE_SKIP_DEP_CHECK = $prevSkip
    }
    $out = "$out".Trim()
    if ($out -and (Test-Path -LiteralPath $out)) { return $out }
    return ''
}

function Invoke-IsolatedTtsVenvEnsure {
    # Build/verify an engine's isolated venv via isolated_venv.ensure_venv(). Runs the
    # system Python LIVE (pip output streams to console; first build takes minutes) and
    # probes the resulting venv directly after provisioning.
    # AI remediation plan: if Qwen3TTS repeatedly fails health checks, rebuild only its
    # canonical venv with `python -m venv --clear --system-site-packages`. Do not copy
    # the main interpreter's site-packages or delete the model cache/weights. Reinstall
    # the Qwen requirements into the fresh venv, then report the exact failed probe if
    # health is still false so an AI operator can perform the next repair.
    # ensure_venv() is self-repairing: it re-runs the import-health probe and repairs a
    # broken venv in place. Mirrors Step61's helper, generalised to any engine.
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [Parameter(Mandatory = $true)][string]$CoreNodeRoot,
        [Parameter(Mandatory = $true)][string]$Engine,
        [AllowNull()][string[]]$PipPackages = $null,
        [AllowNull()][string[]]$Pins = $null,
        [string]$HealthImports = '',
        [switch]$Force
    )
    $rootLiteral = ($CoreNodeRoot -replace "'", "''")
    $engineLit = ConvertTo-PyStringLiteral -Value $Engine
    $pkgLit = if ($null -eq $PipPackages) { 'None' } else { ConvertTo-PyListLiteral -Items $PipPackages }
    $pinLit = if ($null -eq $Pins) { 'None' } else { ConvertTo-PyListLiteral -Items $Pins }
    $forceLiteral = if ($Force) { 'True' } else { 'False' }
    $healthArg = if ($HealthImports) { 'health_imports=' + (ConvertTo-PyStringLiteral -Value $HealthImports) + ', ' } else { '' }
    $prevSkip = $env:PYCORE_SKIP_DEP_CHECK
    $prevEap = $ErrorActionPreference
    $venvOk = $false
    $pyCode = @"
import sys
sys.path.insert(0, r'$rootLiteral')
from pycore.pyutils.common.python_env import isolated_venv
isolated_venv.ensure_venv($engineLit, pip_packages=$pkgLit, pins=$pinLit, ${healthArg}force=$forceLiteral)
"@
    # PYCORE_SKIP_DEP_CHECK=1: importing pycore.pyutils.tts must NOT run the import-time
    # check_and_install_dependencies(); ensure_venv() does its own venv provisioning.
    try {
        $env:PYCORE_SKIP_DEP_CHECK = '1'
        $ErrorActionPreference = 'Continue'
        # Run LIVE (attached): ensure_venv streams pip output; first build takes minutes.
        # Out-Host keeps child stdout out of the function's boolean return value.
        & $PythonExe -c $pyCode | Out-Host
        $venvOk = Test-IsolatedTtsVenvProvisioned -PythonExe $PythonExe -CoreNodeRoot $CoreNodeRoot -Engine $Engine
    } finally {
        $ErrorActionPreference = $prevEap
        $env:PYCORE_SKIP_DEP_CHECK = $prevSkip
    }
    return $venvOk
}

. (Join-Path $PSScriptRoot 'TtsCompatibilityCommon.ps1')
