# Idempotent PaddlePaddle CPU/GPU build guard (Windows). Mirrors linux/common/paddle_cpu_guard.sh.

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')
. (Join-Path $PSScriptRoot 'NvidiaCuStackAlign.ps1')

$script:PaddleCpuIndexUrl = 'https://www.paddlepaddle.org.cn/packages/stable/cpu/'
$script:PaddleVersion = if ($env:PCG_PADDLE_VERSION) { $env:PCG_PADDLE_VERSION } else { '3.3.0' }

function Get-PcgPython {
    param([string]$Override)
    if ($Override) { return $Override }
    if ($env:PCG_PYTHON) { return $env:PCG_PYTHON }
    return $null
}

function Test-PcgGpuPresent {
    return Test-NvidiaGpuPresent
}

function Get-PaddleBuildState {
    param([string]$PythonCmd)
    if (-not (Test-PaddleDistInfoPresent -PythonExe $PythonCmd)) {
        return ''
    }

    $out = & $PythonCmd -c "import paddle; print('gpu' if paddle.device.is_compiled_with_cuda() else 'cpu')" 2>&1
    $text = ("$out").Trim()
    if ($text -match 'Error|Traceback|No module') {
        return ''
    }

    return $text
}

function Test-PaddleCudaUsable {
    param([string]$PythonCmd)
    $out = & $PythonCmd -c "import paddle; ok=paddle.device.is_compiled_with_cuda() and paddle.device.cuda.device_count()>0; print('__CUDA_OK__' if ok else '__CUDA_FAIL__')" 2>&1
    return ("$out" -match '__CUDA_OK__')
}

function Remove-PaddlePackages {
    param([string]$PipExe)
    & $PipExe uninstall -y paddlepaddle paddlepaddle-gpu
}

function Install-CpuPaddle {
    param([string]$PipExe)
    & $PipExe install --index-url $script:PaddleCpuIndexUrl "paddlepaddle==$($script:PaddleVersion)"
}

function Install-GpuPaddle {
    param(
        [string]$PythonCmd,
        [string]$PipExe
    )
    $idx = Get-PaddleCudaIndexUrl
    & $PipExe install --index-url $idx "paddlepaddle-gpu==$($script:PaddleVersion)"
    # GPU paddle pins the cu13 nvidia stack; remove any stray cu12 nvidia libs
    # (e.g. left by faster-whisper/CTranslate2 before it moved to its venv) and
    # restore clobbered cu13 files so import paddle does not hit WinError 127.
    if ($PythonCmd) {
        Sync-NvidiaCuStack -PythonCmd $PythonCmd -PipExe $PipExe -TargetMajor 13
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

    if (Test-PcgGpuPresent) {
        if (-not $state) {
            if ($RepairOnly) {
                Write-Host '[paddle-guard] GPU present, paddle missing (repair-only) -> nothing to repair.'
            } else {
                Write-Host '[paddle-guard] GPU present, paddle missing -> installing driver-matched GPU build.'
                Install-GpuPaddle -PythonCmd $PythonCmd -PipExe $PipExe
            }
            return
        }
        if ($state -eq 'cpu') {
            Write-Host '[paddle-guard] GPU present but paddle is CPU build -> switching to GPU build.'
            Remove-PaddlePackages -PipExe $PipExe
            Install-GpuPaddle -PythonCmd $PythonCmd -PipExe $PipExe
            return
        }
        if (Test-PaddleCudaUsable -PythonCmd $PythonCmd) {
            Write-Host '[paddle-guard] GPU present, paddle GPU build usable on this driver; no change.'
        } else {
            Write-Host "[paddle-guard] GPU present but paddle GPU build cannot init -> reinstalling ($(Get-PaddleCudaIndexUrl))."
            Remove-PaddlePackages -PipExe $PipExe
            Install-GpuPaddle -PythonCmd $PythonCmd -PipExe $PipExe
        }
        return
    }

    switch ($state) {
        '' {
            if ($RepairOnly) {
                Write-Host '[paddle-guard] No GPU, paddle not installed -> nothing to repair.'
            } else {
                Write-Host '[paddle-guard] No GPU, paddle missing -> installing CPU build.'
                Install-CpuPaddle -PipExe $PipExe
            }
        }
        'cpu' {
            Write-Host '[paddle-guard] No GPU, paddle already CPU build; ok.'
        }
        'gpu' {
            Write-Host '[paddle-guard] No GPU but paddle GPU build -> switching to CPU build.'
            Remove-PaddlePackages -PipExe $PipExe
            Install-CpuPaddle -PipExe $PipExe
        }
    }
}
