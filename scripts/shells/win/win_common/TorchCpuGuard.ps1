# Idempotent PyTorch CPU/GPU build guard (Windows). Mirrors linux/common/torch_cpu_guard.sh.

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')

$script:TorchCpuIndexUrl = 'https://download.pytorch.org/whl/cpu'

function Get-TcgPython {
    param([string]$Override)
    if ($Override) { return $Override }
    if ($env:TCG_PYTHON) { return $env:TCG_PYTHON }
    return $null
}

function Test-TcgGpuPresent {
    return Test-NvidiaGpuPresent
}

function Get-TorchCudaState {
    param([string]$PythonCmd)
    if (-not (Test-PythonDistInfoPresent -PythonExe $PythonCmd -DistPrefixes @('torch'))) {
        return ''
    }

    $out = & $PythonCmd -c "import torch; print(str(torch.version.cuda))" 2>&1
    $text = ("$out").Trim()
    if ($text -match 'Error|Traceback|No module') {
        return ''
    }

    return $text
}

function Test-TorchCudaUsable {
    param([string]$PythonCmd)
    $out = & $PythonCmd -c "import torch; print('__CUDA_OK__' if torch.cuda.is_available() else '__CUDA_FAIL__')" 2>&1
    return ("$out" -match '__CUDA_OK__')
}

function Remove-OrphanNvidiaWheels {
    param(
        [string]$PythonCmd,
        [string]$PipExe
    )

    if (-not $PipExe) {
        return
    }

    $listOutput = & $PipExe list --format=freeze 2>&1
    $pkgNames = @()
    foreach ($line in ("$listOutput" -split "`n")) {
        $line = $line.Trim()
        if ($line -match '^([^=]+)==') {
            $name = $Matches[1]
            $lower = $name.ToLower()
            if ($lower.StartsWith('nvidia-') -or $lower -eq 'triton') {
                $pkgNames += $name
            }
        }
    }

    if ($pkgNames.Count -gt 0) {
        Write-Host "[torch-guard] Removing orphaned CUDA wheels: $($pkgNames -join ' ')"
        & $PipExe uninstall -y @pkgNames
    }
}

function Install-CpuTorch {
    param(
        [string]$PipExe
    )
    & $PipExe install --ignore-installed --force-reinstall --index-url $script:TorchCpuIndexUrl torch torchvision torchaudio
}

function Ensure-TorchBuild {
    param(
        [string]$PythonCmd,
        [string]$PipExe,
        [switch]$RepairOnly
    )
    if (-not $PythonCmd) {
        Write-Host '[torch-guard] No python interpreter found; skipping.' -ForegroundColor Yellow
        return
    }

    if (-not $PipExe) {
        $PipExe = Resolve-InstallerPipExe -PythonExe $PythonCmd
    }

    if (-not $PipExe) {
        Write-Host '[torch-guard] pip.exe not found; skipping.' -ForegroundColor Yellow
        return
    }

    $state = Get-TorchCudaState -PythonCmd $PythonCmd

    if (Test-TcgGpuPresent) {
        if (-not $state) {
            if ($RepairOnly) {
                Write-Host '[torch-guard] GPU present, torch missing (repair-only) -> nothing to repair.'
            } else {
                $idx = Get-TorchCudaIndexUrl
                Write-Host "[torch-guard] GPU present, torch missing -> installing driver-matched CUDA build ($idx)."
                & $PipExe install --ignore-installed --index-url $idx torch torchvision torchaudio
            }
            return
        }
        if ($state -eq 'None') {
            Write-Host '[torch-guard] GPU present, torch is CPU build; no change (CPU build runs on GPU hosts too).'
            return
        }
        if (Test-TorchCudaUsable -PythonCmd $PythonCmd) {
            Write-Host "[torch-guard] GPU present, torch cuda=$state usable on this driver; no change."
        } else {
            $idx = Get-TorchCudaIndexUrl
            Write-Host "[torch-guard] GPU present but torch cuda=$state cannot init on this driver -> reinstalling ($idx)."
            & $PipExe uninstall -y torch torchvision torchaudio
            & $PipExe install --ignore-installed --force-reinstall --index-url $idx torch torchvision torchaudio
        }
        return
    }

    switch ($state) {
        '' {
            if ($RepairOnly) {
                Write-Host '[torch-guard] No GPU, torch not installed -> nothing to repair.'
            } else {
                Write-Host '[torch-guard] No GPU, torch missing -> installing CPU build (avoids large nvidia-* wheels).'
                Install-CpuTorch -PipExe $PipExe
            }
        }
        'None' {
            Write-Host '[torch-guard] No GPU, torch already CPU build; ok.'
        }
        default {
            Write-Host "[torch-guard] No GPU but CUDA torch (cuda=$state) -> switching to CPU build + purging nvidia-*."
            Install-CpuTorch -PipExe $PipExe
            Remove-OrphanNvidiaWheels -PythonCmd $PythonCmd -PipExe $PipExe
        }
    }
}
