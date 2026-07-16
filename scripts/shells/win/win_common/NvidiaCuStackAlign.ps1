# Idempotent NVIDIA CUDA-stack aligner (Windows).
#
# One Python env must host a SINGLE CUDA major. paddlepaddle-gpu 3.3.0 (cu13,
# bare nvidia-cublas / nvidia-cudnn-cu13) and any cu12 nvidia packages
# (nvidia-cublas-cu12 / nvidia-cudnn-cu12, e.g. left by an older faster-whisper
# install) both write into the SAME nvidia\<lib>\ dirs and clobber each other's
# DLLs -> import paddle/torch hits WinError 127.
#
# Strategy: the system Python is cu13-only. faster-whisper/CTranslate2 run
# in-process in the system Python with NO cu12 nvidia libs installed (so they
# cannot clobber cu13); ctranslate2 is cu12-built and falls back to CPU (int8).
# Sync-NvidiaCuStack idempotently force-reinstalls on-major (cu13) packages
# when sentinel DLLs are missing (using the versions pinned by paddlepaddle-gpu /
# torch METADATA). Never uninstalls nvidia packages.
#
# Pure business logic. Sources CudaIndex.ps1 (Get-CudaDriverCv) +
# PythonRuntimeCommon.ps1 (Resolve-InstallerPipExe, Get-PipPackageVersion,
# Get-PythonSitePackagesDir). No linux twin yet.

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')

# cu13 paddle/torch use the BARE namespace (nvidia-cublas, nvidia-cuda-runtime,
# nvidia-cudnn-cu13, ...). cu12/cu11 use the -cuNN suffix. Both write into the
# same nvidia\<lib>\ dir -> the collision.
$script:NvidiaCu13BareBases = @(
    'nvidia-cublas', 'nvidia-cuda-runtime', 'nvidia-cuda-nvrtc',
    'nvidia-cufft', 'nvidia-curand', 'nvidia-cusolver', 'nvidia-cusparse',
    'nvidia-nvjitlink', 'nvidia-cudnn', 'nvidia-cufile', 'nvidia-cuxfilt'
)
# nvidia-* packages that are NOT CUDA runtime DLLs -> never touch.
$script:NvidiaIgnore = @(
    'nvidia-ml-py', 'nvidia-cusparselt', 'nvidia-nvshmem', 'nvidia-nvtx',
    'nvidia-cuda-cccl', 'nvidia-cuda-nvdisasm', 'nvidia-cuda-profiler-api'
)
$script:NvidiaAlignPrefix = '[nvidia-cu-align]'

function Get-NvidiaCuTargetMajor {
    param([string]$PythonCmd)
    # 1) torch.version.cuda is authoritative when torch imports cleanly.
    if ($PythonCmd -and (Test-Path -LiteralPath $PythonCmd)) {
        $probeCode = @'
try:
    import torch
    print((torch.version.cuda or ""))
except Exception:
    print("")
'@
        $prevEap = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $torchCuda = & $PythonCmd -c $probeCode 2>$null
        $ErrorActionPreference = $prevEap
        $text = ("$torchCuda" -split "`n" | Select-Object -First 1).Trim()
        if ($text -match '^(\d+)\.') { return [int]$Matches[1] }
    }
    # 2) driver CUDA version from nvidia-smi.
    $cv = Get-CudaDriverCv
    if ($null -ne $cv -and $cv -gt 0) { return [int]([math]::Floor($cv / 100)) }
    # 3) default: cu13 (paddle 3.3 / torch cu130 baseline on a CUDA-13 driver).
    return 13
}

function Get-NvidiaPackageCuMajor {
    param([Parameter(Mandatory = $true)][string]$Name)
    $lower = $Name.ToLower()
    if ($lower -match '-cu(\d+)$') { return [int]$Matches[1] }
    if ($script:NvidiaCu13BareBases -contains $lower) { return 13 }
    # Unknown bare nvidia-* -> assume cu13 (the newer bare namespace).
    return 13
}

function Get-NvidiaPkgBase {
    param([Parameter(Mandatory = $true)][string]$Name)
    $lower = $Name.ToLower()
    if ($lower -match '^(nvidia-.+)-cu\d+$') { return $Matches[1] }
    return $lower
}

function Get-Cu13NvidiaPins {
    # Exact cu13 nvidia pins (pkg==version) from paddlepaddle-gpu / torch
    # METADATA. Used to RESTORE a cu13 package whose dist-info was deleted (e.g.
    # an interrupted force-reinstall) - Get-InstalledNvidiaPackages can't see it,
    # so we reinstall it fresh from the pin the cu13 wheel declared.
    param([Parameter(Mandatory = $true)][string]$PythonCmd)
    $pins = @{}
    $site = Get-PythonSitePackagesDir -PythonExe $PythonCmd
    if (-not $site -or -not (Test-Path -LiteralPath $site)) { return $pins }
    # Prefer paddlepaddle-gpu pins (exact ==), then torch.
    $distPrefixes = @('paddlepaddle_gpu', 'torch')
    foreach ($prefix in $distPrefixes) {
        $metaDirs = Get-ChildItem -LiteralPath $site -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "$prefix-*.dist-info" }
        foreach ($metaDir in $metaDirs) {
            $metaFile = Join-Path $metaDir.FullName 'METADATA'
            if (-not (Test-Path -LiteralPath $metaFile)) { continue }
            foreach ($line in (Get-Content -LiteralPath $metaFile -ErrorAction SilentlyContinue)) {
                if ($line -match '^Requires-Dist:\s*(nvidia-[A-Za-z0-9._-]+)(==[A-Za-z0-9._*+]+)') {
                    $pkg = $Matches[1]
                    $ver = $Matches[2]
                    $base = Get-NvidiaPkgBase -Name $pkg
                    if (-not $pins.ContainsKey($base)) {
                        $pins[$base] = "$pkg$ver"
                    }
                }
            }
        }
    }
    return $pins
}

function Get-InstalledNvidiaPackages {
    param([Parameter(Mandatory = $true)][string]$PipExe)
    $pkgs = @()
    if (-not (Test-Path -LiteralPath $PipExe)) { return $pkgs }
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $list = & $PipExe list --format=freeze 2>&1
    $ErrorActionPreference = $prevEap
    foreach ($line in ("$list" -split "`n")) {
        $line = $line.Trim()
        if ($line -match '^([^=]+)==(.+)$') {
            $name = $Matches[1]
            $ver = $Matches[2]
            $lower = $name.ToLower()
            if (-not $lower.StartsWith('nvidia-')) { continue }
            if ($script:NvidiaIgnore -contains $lower) { continue }
            $pkgs += [pscustomobject]@{ Name = $name; Version = $ver }
        }
    }
    return $pkgs
}

function Test-Cu13SentinelDllMissing {
    param([Parameter(Mandatory = $true)][string]$PythonCmd)
    # The DLL the WinError 127 traceback names. If absent, the on-major cu13
    # package's files were clobbered/deleted and must be force-reinstalled.
    $site = Get-PythonSitePackagesDir -PythonExe $PythonCmd
    if (-not $site) { return $false }
    $cudnnDll = Join-Path $site 'nvidia\cudnn\bin\cudnn_cnn64_9.dll'
    if (-not (Test-Path -LiteralPath $cudnnDll)) { return $true }
    $cublasDir = Join-Path $site 'nvidia\cublas\bin'
    if (-not (Test-Path -LiteralPath $cublasDir)) { return $true }
    $cublasDlls = Get-ChildItem -LiteralPath $cublasDir -Filter 'cublas*.dll' -ErrorAction SilentlyContinue
    if (-not $cublasDlls -or $cublasDlls.Count -eq 0) { return $true }
    return $false
}

function Sync-NvidiaCuStack {
    param(
        [Parameter(Mandatory = $true)][string]$PythonCmd,
        [string]$PipExe,
        [int]$TargetMajor = 0
    )
    if (-not $PythonCmd -or -not (Test-Path -LiteralPath $PythonCmd)) {
        Write-Host "$script:NvidiaAlignPrefix no python; skipping." -ForegroundColor Yellow
        return
    }
    if (-not $PipExe) { $PipExe = $Global:PIP_EXE_PATH }
    if (-not $PipExe -or -not (Test-Path -LiteralPath $PipExe)) {
        Write-Host "$script:NvidiaAlignPrefix pip not found for $PythonCmd; skipping." -ForegroundColor Yellow
        return
    }
    if ($TargetMajor -le 0) { $TargetMajor = Get-NvidiaCuTargetMajor -PythonCmd $PythonCmd }

    $installed = Get-InstalledNvidiaPackages -PipExe $PipExe
    $offMajor = @($installed | Where-Object { (Get-NvidiaPackageCuMajor -Name $_.Name) -ne $TargetMajor })

    if ($offMajor.Count -gt 0) {
        $offNames = @($offMajor | ForEach-Object { $_.Name })
        Write-Host "$script:NvidiaAlignPrefix note: off-major nvidia packages present ($($offNames -join ', ')); install-only mode (no uninstall)." -ForegroundColor DarkYellow
    }

    if ($TargetMajor -ne 13) {
        Write-Host "$script:NvidiaAlignPrefix target=cu$TargetMajor; cu13-only restore not applicable." -ForegroundColor DarkGray
        return
    }

    if (-not (Test-Cu13SentinelDllMissing -PythonCmd $PythonCmd)) {
        Write-Host "$script:NvidiaAlignPrefix target=cu$TargetMajor; nvidia stack already consistent." -ForegroundColor Green
        return
    }

    Write-Host "$script:NvidiaAlignPrefix cu13 cuDNN/cuBLAS DLL missing on disk; idempotent restore." -ForegroundColor Yellow

    $pins = Get-Cu13NvidiaPins -PythonCmd $PythonCmd
    $installSpecs = New-Object System.Collections.Generic.List[string]
    foreach ($base in @('nvidia-cudnn', 'nvidia-cublas', 'nvidia-cuda-runtime')) {
        if ($pins.ContainsKey($base)) {
            $installSpecs.Add($pins[$base]) | Out-Null
        } else {
            Write-Host "$script:NvidiaAlignPrefix no pin for '$base'; skipping." -ForegroundColor DarkYellow
        }
    }
    if ($installSpecs.Count -eq 0) { return }

    $specList = @($installSpecs)
    Write-Host "$script:NvidiaAlignPrefix installing cu${TargetMajor}: $($specList -join ', ')" -ForegroundColor Yellow
    & $PipExe install --force-reinstall --no-deps @specList 2>&1 | Out-Host
    Write-Host "$script:NvidiaAlignPrefix done (cu$TargetMajor aligned)." -ForegroundColor Green
}
