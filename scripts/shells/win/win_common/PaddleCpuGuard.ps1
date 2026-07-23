# Idempotent PaddlePaddle CPU/GPU build guard (Windows). Mirrors linux/common/paddle_cpu_guard.sh.

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')
. (Join-Path $PSScriptRoot 'NvidiaCuStackAlign.ps1')

$script:PaddleCpuIndexUrl = Get-AiRuntimePolicyValue -Name 'AI_PADDLE_CPU_INDEX' -Default 'https://www.paddlepaddle.org.cn/packages/stable/cpu/'
$script:PaddleDefaultVersion = (Get-AiCudaTiers | Select-Object -First 1).PaddleVersion

function Get-PcgPython {
    param([string]$Override)
    if ($Override) { return $Override }
    if ($env:PCG_PYTHON) { return $env:PCG_PYTHON }
    return $null
}

function Test-PcgGpuPresent {
    return [bool](Get-CudaRuntimePolicy).Enabled
}

function Get-PaddleExpectedVersion {
    param([PSCustomObject]$Policy)
    if ($env:PCG_PADDLE_VERSION) { return $env:PCG_PADDLE_VERSION }
    if ($Policy -and $Policy.PaddleVersion) { return $Policy.PaddleVersion }
    return $script:PaddleDefaultVersion
}

function Get-PaddleBuildState {
    param([string]$PythonCmd)
    $out = $null
    $text = ''
    if (-not (Test-PaddleDistInfoPresent -PythonExe $PythonCmd)) {
        return ''
    }

    $out = & $PythonCmd -c "import paddle; print('__PADDLE_GPU__' if paddle.device.is_compiled_with_cuda() else '__PADDLE_CPU__')" 2>&1
    $text = ("$out").Trim()
    if ($LASTEXITCODE -ne 0) { return '' }
    if ($text -match '__PADDLE_GPU__') { return 'gpu' }
    if ($text -match '__PADDLE_CPU__') { return 'cpu' }
    return ''
}

function Test-PaddleRequirementsSatisfied {
    param([string]$PythonCmd)
    $probeCode = @'
import importlib.metadata as metadata
try:
    from packaging.markers import default_environment
    from packaging.requirements import Requirement
except ImportError:
    from pip._vendor.packaging.markers import default_environment
    from pip._vendor.packaging.requirements import Requirement

try:
    dist = metadata.distribution("paddlepaddle-gpu")
except metadata.PackageNotFoundError:
    try:
        dist = metadata.distribution("paddlepaddle")
    except metadata.PackageNotFoundError:
        raise SystemExit(1)

environment = default_environment()
for raw in dist.requires or ():
    requirement = Requirement(raw)
    if requirement.marker and not requirement.marker.evaluate(environment):
        continue
    try:
        installed = metadata.version(requirement.name)
    except metadata.PackageNotFoundError:
        raise SystemExit(1)
    if requirement.specifier and not requirement.specifier.contains(installed, prereleases=True):
        raise SystemExit(1)
raise SystemExit(0)
'@
    & $PythonCmd -c $probeCode 2>$null
    return ($LASTEXITCODE -eq 0)
}

function Test-PaddleCudaUsable {
    param([string]$PythonCmd)
    $out = & $PythonCmd -c "import paddle; ok=paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count()>0; print('__CUDA_OK__' if ok else '__CUDA_FAIL__')" 2>&1
    return ("$out" -match '__CUDA_OK__')
}

function Get-PaddleCudaState {
    param([string]$PythonCmd)
    $out = $null
    $text = ''
    $out = & $PythonCmd -c "import paddle; print('__PADDLE_CUDA__' + str(paddle.version.cuda() or ''))" 2>&1
    $text = ("$out").Trim()
    if ($LASTEXITCODE -ne 0) { return '' }
    if ($text -match '__PADDLE_CUDA__([0-9.]+)') { return [string]$Matches[1] }
    return ''
}

function Convert-PaddleCudaStateToTag {
    param([string]$State)
    if ($State -match '^(\d+)\.(\d+)') {
        return ('cu{0}{1}' -f $Matches[1], $Matches[2])
    }
    return ''
}

function Test-PaddleVersionMatches {
    param(
        [string]$PipExe,
        [string]$ExpectedVersion
    )
    $installed = Get-PipPackageVersion -PipExe $PipExe -PackageName 'paddlepaddle-gpu'
    if (-not $installed) {
        $installed = Get-PipPackageVersion -PipExe $PipExe -PackageName 'paddlepaddle'
    }
    return $installed -eq $ExpectedVersion
}

function Remove-PaddlePackages {
    param([string]$PipExe)
    & $PipExe uninstall -y paddlepaddle paddlepaddle-gpu
}

function Install-CpuPaddle {
    param(
        [string]$PipExe,
        [string]$Version
    )
    & $PipExe install --index-url $script:PaddleCpuIndexUrl "paddlepaddle==$Version"
    if ($LASTEXITCODE -ne 0) {
        throw "Paddle CPU wheel installation failed with exit code $LASTEXITCODE."
    }
}

function Install-GpuPaddle {
    param(
        [string]$PythonCmd,
        [string]$PipExe
    )
    $policy = Get-CudaRuntimePolicy
    $version = Get-PaddleExpectedVersion -Policy $policy
    Write-Host '[paddle-guard] Installing the official self-contained Python CUDA runtime dependencies once; this does not replace the NVIDIA driver or system CUDA Toolkit.' -ForegroundColor Cyan
    & $PipExe install --index-url $policy.PaddleIndexUrl "paddlepaddle-gpu==$version"
    if ($LASTEXITCODE -ne 0) {
        throw "Paddle GPU wheel installation failed with exit code $LASTEXITCODE. Re-run to resume the idempotent repair."
    }
    if ($PythonCmd) {
        Sync-NvidiaCuStack -PythonCmd $PythonCmd -PipExe $PipExe -TargetMajor $policy.Major
    }
}

function Ensure-PaddleBuild {
    param(
        [string]$PythonCmd,
        [string]$PipExe,
        [switch]$RepairOnly
    )
    if (-not $PythonCmd) {
        Write-Host '[paddle-guard] No python interpreter found; skipping.' -ForegroundColor Yellow
        return
    }

    if (-not $PipExe) {
        $PipExe = $Global:PIP_EXE_PATH
    }

    if (-not $PipExe) {
        Write-Host '[paddle-guard] pip.exe not found; skipping.' -ForegroundColor Yellow
        return
    }

    $state = Get-PaddleBuildState -PythonCmd $PythonCmd
    $policy = Get-CudaRuntimePolicy
    $expectedVersion = Get-PaddleExpectedVersion -Policy $policy
    $distPresent = Test-PaddleDistInfoPresent -PythonExe $PythonCmd

    if ($policy.Enabled) {
        if (-not $state) {
            if ($RepairOnly) {
                Write-Host '[paddle-guard] GPU present, no usable Paddle import (repair-only) -> no package mutation.'
            } elseif (-not $distPresent) {
                Write-Host '[paddle-guard] GPU present, Paddle is absent -> installing the driver-compatible GPU wheel and its Python runtime libraries.'
                Install-GpuPaddle -PythonCmd $PythonCmd -PipExe $PipExe
            } elseif (-not (Test-PaddleVersionMatches -PipExe $PipExe -ExpectedVersion $expectedVersion)) {
                Write-Host "[paddle-guard] Paddle metadata exists but its version differs from $expectedVersion -> repairing."
                Remove-PaddlePackages -PipExe $PipExe
                Install-GpuPaddle -PythonCmd $PythonCmd -PipExe $PipExe
            } elseif (-not (Test-PaddleRequirementsSatisfied -PythonCmd $PythonCmd)) {
                Write-Host '[paddle-guard] Paddle installation was interrupted or has missing declared dependencies -> resuming dependency repair.' -ForegroundColor Yellow
                Install-GpuPaddle -PythonCmd $PythonCmd -PipExe $PipExe
            } else {
                Write-Host '[paddle-guard] Paddle package and declared dependencies are present, but import still fails; leaving them unchanged to prevent a reinstall loop.' -ForegroundColor DarkYellow
            }
            return
        }
        if ($state -eq 'cpu') {
            Write-Host "[paddle-guard] GPU present but paddle is CPU build -> switching to $($policy.Tag)."
            Remove-PaddlePackages -PipExe $PipExe
            Install-GpuPaddle -PythonCmd $PythonCmd -PipExe $PipExe
            return
        }
        $cudaState = Get-PaddleCudaState -PythonCmd $PythonCmd
        $installedTag = Convert-PaddleCudaStateToTag -State $cudaState
        if ($installedTag -ne $policy.Tag -or -not (Test-PaddleVersionMatches -PipExe $PipExe -ExpectedVersion $expectedVersion)) {
            Write-Host "[paddle-guard] paddle cuda='$cudaState' or package version differs from $($policy.Tag)/$expectedVersion -> repairing."
            Remove-PaddlePackages -PipExe $PipExe
            Install-GpuPaddle -PythonCmd $PythonCmd -PipExe $PipExe
            return
        }
        Sync-NvidiaCuStack -PythonCmd $PythonCmd -PipExe $PipExe -TargetMajor $policy.Major
        if (Test-PaddleCudaUsable -PythonCmd $PythonCmd) {
            Write-Host "[paddle-guard] GPU present, canonical $installedTag paddle is usable; no change."
        } else {
            Write-Host "[paddle-guard] canonical $installedTag paddle is installed but CUDA cannot initialize; leaving it unchanged to avoid a reinstall loop." -ForegroundColor DarkYellow
        }
        return
    }

    switch ($state) {
        '' {
            if ($RepairOnly) {
                Write-Host '[paddle-guard] No GPU, no usable Paddle import (repair-only) -> no package mutation.'
            } elseif (-not $distPresent) {
                Write-Host '[paddle-guard] No GPU, Paddle is absent -> installing CPU build.'
                Install-CpuPaddle -PipExe $PipExe -Version $expectedVersion
            } elseif (-not (Test-PaddleVersionMatches -PipExe $PipExe -ExpectedVersion $expectedVersion)) {
                Write-Host "[paddle-guard] Paddle metadata exists but the CPU version differs from $expectedVersion -> repairing."
                Remove-PaddlePackages -PipExe $PipExe
                Install-CpuPaddle -PipExe $PipExe -Version $expectedVersion
            } elseif (-not (Test-PaddleRequirementsSatisfied -PythonCmd $PythonCmd)) {
                Write-Host '[paddle-guard] Paddle CPU installation has missing declared dependencies -> resuming dependency repair.' -ForegroundColor Yellow
                Install-CpuPaddle -PipExe $PipExe -Version $expectedVersion
            } else {
                Write-Host '[paddle-guard] Paddle CPU package and declared dependencies are present, but import still fails; leaving them unchanged to prevent a reinstall loop.' -ForegroundColor DarkYellow
            }
        }
        'cpu' {
            if (Test-PaddleVersionMatches -PipExe $PipExe -ExpectedVersion $expectedVersion) {
                Write-Host '[paddle-guard] No GPU, paddle already CPU build; ok.'
            } else {
                Write-Host "[paddle-guard] No GPU, paddle CPU version drift -> aligning to $expectedVersion."
                Remove-PaddlePackages -PipExe $PipExe
                Install-CpuPaddle -PipExe $PipExe -Version $expectedVersion
            }
        }
        'gpu' {
            Write-Host '[paddle-guard] No GPU but paddle GPU build -> switching to CPU build.'
            Remove-PaddlePackages -PipExe $PipExe
            Install-CpuPaddle -PipExe $PipExe -Version $expectedVersion
        }
    }
}
