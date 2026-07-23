# Idempotent single-major NVIDIA CUDA-stack aligner (Windows).
# CUDA wheel majors share nvidia\<lib>; off-policy wheels are removed after exact
# on-policy pins are captured, then the active stack is restored once.

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')

$script:NvidiaBareCudaBases = @(
    'nvidia-cublas', 'nvidia-cuda-runtime', 'nvidia-cuda-nvrtc',
    'nvidia-cufft', 'nvidia-curand', 'nvidia-cusolver', 'nvidia-cusparse',
    'nvidia-nvjitlink', 'nvidia-cudnn', 'nvidia-cufile', 'nvidia-cuxfilt'
)
$script:NvidiaIgnore = @(
    'nvidia-ml-py', 'nvidia-cusparselt', 'nvidia-nvshmem', 'nvidia-nvtx',
    'nvidia-cuda-cccl', 'nvidia-cuda-nvdisasm', 'nvidia-cuda-profiler-api'
)
$script:NvidiaAlignPrefix = '[nvidia-cu-align]'

function Get-NvidiaCuTargetMajor {
    param([string]$PythonCmd)
    $policy = Get-CudaRuntimePolicy
    if ($policy.Enabled) { return [int]$policy.Major }
    if ($PythonCmd -and (Test-Path -LiteralPath $PythonCmd)) {
        $probeCode = @'
try:
    import torch
    print((torch.version.cuda or ""))
except Exception:
    print("")
'@
        $previous = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $torchCuda = & $PythonCmd -c $probeCode 2>$null
        $ErrorActionPreference = $previous
        $text = ("$torchCuda" -split "`n" | Select-Object -First 1).Trim()
        if ($text -match '^(\d+)\.') { return [int]$Matches[1] }
    }
    return 0
}

function Get-NvidiaPackageCuMajor {
    param([Parameter(Mandatory = $true)][string]$Name)
    $lower = $Name.ToLowerInvariant()
    if ($lower -match '-cu(\d+)$') { return [int]$Matches[1] }
    if ($script:NvidiaBareCudaBases -contains $lower) { return 13 }
    return 13
}

function Get-NvidiaPkgBase {
    param([Parameter(Mandatory = $true)][string]$Name)
    $lower = $Name.ToLowerInvariant()
    if ($lower -match '^(nvidia-.+)-cu\d+$') { return $Matches[1] }
    return $lower
}

function Get-NvidiaTargetPins {
    param(
        [Parameter(Mandatory = $true)][string]$PythonCmd,
        [Parameter(Mandatory = $true)][int]$TargetMajor
    )
    $pins = @()
    $site = Get-PythonSitePackagesDir -PythonExe $PythonCmd
    if (-not $site -or -not (Test-Path -LiteralPath $site)) { return $pins }
    foreach ($prefix in @('paddlepaddle_gpu', 'torch')) {
        $metadataDirs = Get-ChildItem -LiteralPath $site -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like "$prefix-*.dist-info" }
        foreach ($metadataDir in $metadataDirs) {
            $metadataFile = Join-Path $metadataDir.FullName 'METADATA'
            if (-not (Test-Path -LiteralPath $metadataFile)) { continue }
            foreach ($line in (Get-Content -LiteralPath $metadataFile -ErrorAction SilentlyContinue)) {
                if ($line -notmatch '^Requires-Dist:\s*(nvidia-[A-Za-z0-9._-]+)(==[A-Za-z0-9._*+]+)') { continue }
                $package = $Matches[1]
                $version = $Matches[2]
                if ((Get-NvidiaPackageCuMajor -Name $package) -ne $TargetMajor) { continue }
                $spec = "$package$version"
                if ($pins -notcontains $spec) { $pins += $spec }
            }
        }
    }
    return $pins
}

function Get-InstalledNvidiaPackages {
    param([Parameter(Mandatory = $true)][string]$PipExe)
    $packages = @()
    if (-not (Test-Path -LiteralPath $PipExe)) { return $packages }
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $list = & $PipExe list --format=freeze 2>&1
    $ErrorActionPreference = $previous
    foreach ($line in ("$list" -split "`n")) {
        $text = $line.Trim()
        if ($text -notmatch '^([^=]+)==(.+)$') { continue }
        $name = $Matches[1]
        $version = $Matches[2]
        $lower = $name.ToLowerInvariant()
        if (-not $lower.StartsWith('nvidia-')) { continue }
        if ($script:NvidiaIgnore -contains $lower) { continue }
        $packages += [PSCustomObject]@{ Name = $name; Version = $version }
    }
    return $packages
}

function Test-NvidiaSentinelDllMissing {
    param(
        [Parameter(Mandatory = $true)][string]$PythonCmd,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][object[]]$TargetPackages
    )
    $site = Get-PythonSitePackagesDir -PythonExe $PythonCmd
    if (-not $site) { return $false }
    $bases = @($TargetPackages | ForEach-Object { Get-NvidiaPkgBase -Name $_.Name })
    if ($bases -contains 'nvidia-cudnn') {
        $cudnnDir = Join-Path $site 'nvidia\cudnn\bin'
        $cudnnDlls = Get-ChildItem -LiteralPath $cudnnDir -Filter 'cudnn*.dll' -ErrorAction SilentlyContinue
        if (-not $cudnnDlls) { return $true }
    }
    if ($bases -contains 'nvidia-cublas') {
        $cublasDir = Join-Path $site 'nvidia\cublas\bin'
        $cublasDlls = Get-ChildItem -LiteralPath $cublasDir -Filter 'cublas*.dll' -ErrorAction SilentlyContinue
        if (-not $cublasDlls) { return $true }
    }
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
    if ($TargetMajor -le 0) {
        Write-Host "$script:NvidiaAlignPrefix no active CUDA policy; skipping." -ForegroundColor DarkGray
        return
    }

    $installed = Get-InstalledNvidiaPackages -PipExe $PipExe
    $targetPackages = @($installed | Where-Object { (Get-NvidiaPackageCuMajor -Name $_.Name) -eq $TargetMajor })
    $offMajor = @($installed | Where-Object { (Get-NvidiaPackageCuMajor -Name $_.Name) -ne $TargetMajor })
    $pins = Get-NvidiaTargetPins -PythonCmd $PythonCmd -TargetMajor $TargetMajor
    $needsRestore = Test-NvidiaSentinelDllMissing -PythonCmd $PythonCmd -TargetPackages $targetPackages

    if ($offMajor.Count -gt 0) {
        $offNames = @($offMajor | ForEach-Object { $_.Name })
        Write-Host "$script:NvidiaAlignPrefix removing off-policy packages: $($offNames -join ', ')" -ForegroundColor Yellow
        & $PipExe uninstall -y @offNames 2>&1 | Out-Host
        $needsRestore = $true
    }
    if (-not $needsRestore) {
        Write-Host "$script:NvidiaAlignPrefix target=cu$TargetMajor; nvidia stack already consistent." -ForegroundColor Green
        return
    }
    if ($pins.Count -eq 0) {
        Write-Host "$script:NvidiaAlignPrefix target pins unavailable; torch/paddle owns its bundled runtime." -ForegroundColor DarkGray
        return
    }
    Write-Host "$script:NvidiaAlignPrefix restoring cu${TargetMajor}: $($pins -join ', ')" -ForegroundColor Yellow
    & $PipExe install --force-reinstall --no-deps @pins 2>&1 | Out-Host
    Write-Host "$script:NvidiaAlignPrefix done (cu$TargetMajor aligned)." -ForegroundColor Green
}
