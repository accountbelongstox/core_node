# Idempotent PaddlePaddle CPU/GPU build guard (Windows). Mirrors linux/common/paddle_cpu_guard.sh.

$cudaIndexPath = Join-Path $PSScriptRoot 'CudaIndex.ps1'
$pythonRuntimePath = Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1'
$nvidiaAlignPath = Join-Path $PSScriptRoot 'NvidiaCuStackAlign.ps1'
. $pythonRuntimePath
. $cudaIndexPath
. $nvidiaAlignPath

$script:PaddleCpuIndexUrl = Get-AiRuntimePolicyValue -Name 'AI_PADDLE_CPU_INDEX' -Default 'https://www.paddlepaddle.org.cn/packages/stable/cpu/'
$script:PaddleCpuPackage = Get-AiRuntimePolicyValue -Name 'AI_PADDLE_CPU_PACKAGE' -Default 'paddlepaddle'
$script:PaddleGpuPackage = Get-AiRuntimePolicyValue -Name 'AI_PADDLE_GPU_PACKAGE' -Default 'paddlepaddle-gpu'

function Get-PcgPython {
    param([string]$Override)
    if ($Override) { return $Override }
    if ($env:PCG_PYTHON) { return $env:PCG_PYTHON }
    return $null
}

function Test-PcgGpuPresent {
    return [bool](Get-CudaRuntimePolicy).Enabled
}

function Get-PaddleBuildState {
    param([string]$PythonCmd)
    $out = $null
    $text = ''
    if (-not (Test-PaddlePackageInstalled -PythonExe $PythonCmd)) {
        return ''
    }

    $out = & $PythonCmd -c "import paddle; print('__PADDLE_GPU__' if paddle.device.is_compiled_with_cuda() else '__PADDLE_CPU__')" 2>&1
    $text = ("$out").Trim()
    if ($text -match '__PADDLE_GPU__') { return 'gpu' }
    if ($text -match '__PADDLE_CPU__') { return 'cpu' }
    return ''
}

function Test-PaddleCudaUsable {
    param([string]$PythonCmd)
    $out = & $PythonCmd -c "import paddle; ok=paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count()>0; print('__CUDA_OK__' if ok else '__CUDA_FAIL__')" 2>&1
    return ("$out" -match '__CUDA_OK__')
}

function Get-PaddleCudaState {
    param([string]$PythonCmd)
    $out = $null
    $marker = '__PADDLE_CUDA__'
    $markerIndex = -1
    $lineText = ''
    $out = & $PythonCmd -c "import paddle; print('__PADDLE_CUDA__' + str(paddle.version.cuda() or ''))" 2>&1
    foreach ($line in @($out)) {
        $lineText = ([string]$line).Trim()
        $markerIndex = $lineText.IndexOf($marker, [System.StringComparison]::Ordinal)
        if ($markerIndex -ge 0) {
            return $lineText.Substring($markerIndex + $marker.Length).Trim()
        }
    }
    return ''
}

function Convert-PaddleCudaStateToTag {
    param([string]$State)
    $major = 0
    $minor = 0
    $parts = ([string]$State).Split('.')
    if ($parts.Length -ge 2 -and
        [int]::TryParse($parts[0], [ref]$major) -and
        [int]::TryParse($parts[1], [ref]$minor)) {
        return ('cu{0}{1}' -f $major, $minor)
    }
    return ''
}

function Remove-PaddlePackages {
    param([string]$PipExe)
    & $PipExe uninstall -y $script:PaddleCpuPackage $script:PaddleGpuPackage
}

function Install-CpuPaddle {
    param([string]$PipExe)
    & $PipExe install --index-url $script:PaddleCpuIndexUrl $script:PaddleCpuPackage
    if (-not (Test-PipPackageInstalled -PipExe $PipExe -PackageName $script:PaddleCpuPackage)) {
        Write-Host '[paddle-guard] Paddle CPU distribution is still missing; retrying next run.' -ForegroundColor DarkYellow
    }
}

function Install-GpuPaddle {
    param(
        [string]$PythonCmd,
        [string]$PipExe
    )
    $policy = Get-CudaRuntimePolicy
    Write-Host '[paddle-guard] Installing the official self-contained Python CUDA runtime dependencies once; this does not replace the NVIDIA driver or system CUDA Toolkit.' -ForegroundColor Cyan
    & $PipExe install --index-url $policy.PaddleIndexUrl $script:PaddleGpuPackage
    if (-not (Test-PipPackageInstalled -PipExe $PipExe -PackageName $script:PaddleGpuPackage)) {
        Write-Host '[paddle-guard] Paddle GPU distribution is still missing; retrying next run.' -ForegroundColor DarkYellow
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
    $cudaState = ''
    $distPresent = $false
    $installedTag = ''
    $policy = $null
    $state = ''
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
    $distPresent = Test-PaddlePackageInstalled -PythonExe $PythonCmd

    if ($policy.Enabled) {
        if (-not $state) {
            if ($RepairOnly) {
                Write-Host '[paddle-guard] GPU present, no usable Paddle import (repair-only) -> no package mutation.'
            } elseif (-not $distPresent) {
                Write-Host '[paddle-guard] GPU present, Paddle is absent -> installing the driver-compatible GPU wheel and its Python runtime libraries.'
                Install-GpuPaddle -PythonCmd $PythonCmd -PipExe $PipExe
            } else {
                Write-Host '[paddle-guard] Paddle metadata is present, but import fails; preserving it to prevent a reinstall loop.' -ForegroundColor DarkYellow
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
        if ($installedTag -ne $policy.Tag) {
            Write-Host "[paddle-guard] Paddle CUDA '$cudaState' differs from the $($policy.Tag) ABI policy -> repairing."
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
                Install-CpuPaddle -PipExe $PipExe
            } else {
                Write-Host '[paddle-guard] Paddle CPU metadata is present, but import fails; preserving it to prevent a reinstall loop.' -ForegroundColor DarkYellow
            }
        }
        'cpu' {
            Write-Host '[paddle-guard] No GPU, Paddle is already a CPU build; no change.'
        }
        'gpu' {
            Write-Host '[paddle-guard] No GPU but paddle GPU build -> switching to CPU build.'
            Remove-PaddlePackages -PipExe $PipExe
            Install-CpuPaddle -PipExe $PipExe
        }
    }
}
