# Idempotent PaddlePaddle CPU/GPU build guard (Windows). Mirrors linux/common/paddle_cpu_guard.sh.

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')

$script:PaddleCpuIndexUrl = 'https://www.paddlepaddle.org.cn/packages/stable/cpu/'
# Official PaddlePaddle 3.3 Windows/Linux stable wheels use 3.3.0 (cu118/cu126/cu129/cu130).
$script:PaddleVersion = if ($env:PCG_PADDLE_VERSION) { $env:PCG_PADDLE_VERSION } else { '3.3.0' }

function Get-PcgPython {
    param([string]$Override)
    if ($Override) { return $Override }
    if ($env:PCG_PYTHON) { return $env:PCG_PYTHON }
    return $null
}

function Test-PcgGpuPresent {
    if ($env:PADDLE_FORCE_CUDA -eq '1') { return $true }
    $nvidiaSmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    if (-not $nvidiaSmi) { return $false }
    & nvidia-smi -L 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Get-PaddleBuildState {
    param([string[]]$PyRun)
    $code = @'
import sys
try:
    import paddle
    sys.stdout.write("gpu" if paddle.device.is_compiled_with_cuda() else "cpu")
except Exception:
    sys.stdout.write("")
'@
    return (& $PyRun -c $code 2>$null | Out-String).Trim()
}

function Test-PaddleCudaUsable {
    param([string[]]$PyRun)
    $code = @'
import sys
try:
    import paddle
    ok = paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count() > 0
    sys.exit(0 if ok else 1)
except Exception:
    sys.exit(1)
'@
    & $PyRun -c $code 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Remove-PaddlePackages {
    param([string[]]$PyRun)
    & $PyRun -m pip uninstall -y paddlepaddle paddlepaddle-gpu 2>$null | Out-Null
}

function Install-CpuPaddle {
    param([string[]]$PyRun)
    & $PyRun -m pip install --index-url $script:PaddleCpuIndexUrl "paddlepaddle==$($script:PaddleVersion)" 2>$null | Out-Null
}

function Install-GpuPaddle {
    param([string[]]$PyRun)
    $idx = Get-PaddleCudaIndexUrl
    & $PyRun -m pip install --index-url $idx "paddlepaddle-gpu==$($script:PaddleVersion)" 2>$null | Out-Null
}

function Ensure-PaddleBuild {
    param(
        [string]$PythonCmd,
        [string[]]$PyRun,
        [switch]$RepairOnly
    )
    if (-not $PythonCmd) {
        Write-Host '[paddle-guard] No python interpreter found; skipping.' -ForegroundColor Yellow
        return
    }

    $state = Get-PaddleBuildState -PyRun $PyRun

    if (Test-PcgGpuPresent) {
        if (-not $state) {
            if ($RepairOnly) {
                Write-Host '[paddle-guard] GPU present, paddle missing (repair-only) -> nothing to repair.'
            } else {
                Write-Host '[paddle-guard] GPU present, paddle missing -> installing driver-matched GPU build.'
                Install-GpuPaddle -PyRun $PyRun
            }
            return
        }
        if ($state -eq 'cpu') {
            Write-Host '[paddle-guard] GPU present but paddle is CPU build -> switching to GPU build.'
            Remove-PaddlePackages -PyRun $PyRun
            Install-GpuPaddle -PyRun $PyRun
            return
        }
        if (Test-PaddleCudaUsable -PyRun $PyRun) {
            Write-Host '[paddle-guard] GPU present, paddle GPU build usable on this driver; no change.'
        } else {
            Write-Host "[paddle-guard] GPU present but paddle GPU build cannot init -> reinstalling ($(Get-PaddleCudaIndexUrl))."
            Remove-PaddlePackages -PyRun $PyRun
            Install-GpuPaddle -PyRun $PyRun
        }
        return
    }

    switch ($state) {
        '' {
            if ($RepairOnly) {
                Write-Host '[paddle-guard] No GPU, paddle not installed -> nothing to repair.'
            } else {
                Write-Host '[paddle-guard] No GPU, paddle missing -> installing CPU build.'
                Install-CpuPaddle -PyRun $PyRun
            }
        }
        'cpu' {
            Write-Host '[paddle-guard] No GPU, paddle already CPU build; ok.'
        }
        'gpu' {
            Write-Host '[paddle-guard] No GPU but paddle GPU build -> switching to CPU build.'
            Remove-PaddlePackages -PyRun $PyRun
            Install-CpuPaddle -PyRun $PyRun
        }
    }
}
