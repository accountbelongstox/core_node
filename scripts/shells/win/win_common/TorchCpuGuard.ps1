# Idempotent PyTorch CPU/GPU build guard (Windows). Mirrors linux/common/torch_cpu_guard.sh.

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')

$script:TorchCpuIndexUrl = 'https://download.pytorch.org/whl/cpu'

function Get-TcgPython {
    param([string]$Override)
    if ($Override) { return $Override }
    if ($env:TCG_PYTHON) { return $env:TCG_PYTHON }
    return $null
}

function Test-TcgGpuPresent {
    if ($env:TORCH_FORCE_CUDA -eq '1') { return $true }
    $nvidiaSmi = Get-Command nvidia-smi -ErrorAction SilentlyContinue
    if (-not $nvidiaSmi) { return $false }
    & nvidia-smi -L 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Get-TorchCudaState {
    param([string]$PythonCmd, [string[]]$PyRun)
    $code = @'
import sys
try:
    import torch
    sys.stdout.write(str(torch.version.cuda))
except Exception:
    sys.stdout.write("")
'@
    return (& $PyRun -c $code 2>$null | Out-String).Trim()
}

function Test-TorchCudaUsable {
    param([string[]]$PyRun)
    $code = @'
import sys
try:
    import torch
    sys.exit(0 if torch.cuda.is_available() else 1)
except Exception:
    sys.exit(1)
'@
    & $PyRun -c $code 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

function Remove-OrphanNvidiaWheels {
    param([string[]]$PyRun)
    $listCode = @'
import subprocess, sys
try:
    out = subprocess.check_output([sys.executable, "-m", "pip", "list", "--format=freeze"], text=True)
except Exception:
    sys.exit(0)
for line in out.splitlines():
    name = line.split("==", 1)[0]
    lower = name.lower()
    if lower.startswith("nvidia-") or lower == "triton":
        print(name)
'@
    $pkgs = @(& $PyRun -c $listCode 2>$null)
    if ($pkgs.Count -gt 0) {
        Write-Host "[torch-guard] Removing orphaned CUDA wheels: $($pkgs -join ' ')"
        & $PyRun -m pip uninstall -y @pkgs 2>$null | Out-Null
    }
}

function Install-CpuTorch {
    param([string[]]$PyRun)
    & $PyRun -m pip install --ignore-installed --force-reinstall `
        --index-url $script:TorchCpuIndexUrl torch torchvision torchaudio 2>$null | Out-Null
}

function Ensure-TorchBuild {
    param(
        [string]$PythonCmd,
        [string[]]$PyRun,
        [switch]$RepairOnly
    )
    if (-not $PythonCmd) {
        Write-Host '[torch-guard] No python interpreter found; skipping.' -ForegroundColor Yellow
        return
    }

    $state = Get-TorchCudaState -PythonCmd $PythonCmd -PyRun $PyRun

    if (Test-TcgGpuPresent) {
        if (-not $state) {
            if ($RepairOnly) {
                Write-Host '[torch-guard] GPU present, torch missing (repair-only) -> nothing to repair.'
            } else {
                $idx = Get-TorchCudaIndexUrl
                Write-Host "[torch-guard] GPU present, torch missing -> installing driver-matched CUDA build ($idx)."
                & $PyRun -m pip install --ignore-installed --index-url $idx torch torchvision torchaudio 2>$null | Out-Null
            }
            return
        }
        if ($state -eq 'None') {
            Write-Host '[torch-guard] GPU present, torch is CPU build; no change (CPU build runs on GPU hosts too).'
            return
        }
        if (Test-TorchCudaUsable -PyRun $PyRun) {
            Write-Host "[torch-guard] GPU present, torch cuda=$state usable on this driver; no change."
        } else {
            $idx = Get-TorchCudaIndexUrl
            Write-Host "[torch-guard] GPU present but torch cuda=$state cannot init on this driver -> reinstalling ($idx)."
            & $PyRun -m pip uninstall -y torch torchvision torchaudio 2>$null | Out-Null
            & $PyRun -m pip install --ignore-installed --force-reinstall --index-url $idx torch torchvision torchaudio 2>$null | Out-Null
        }
        return
    }

    switch ($state) {
        '' {
            if ($RepairOnly) {
                Write-Host '[torch-guard] No GPU, torch not installed -> nothing to repair.'
            } else {
                Write-Host '[torch-guard] No GPU, torch missing -> installing CPU build (avoids large nvidia-* wheels).'
                Install-CpuTorch -PyRun $PyRun
            }
        }
        'None' {
            Write-Host '[torch-guard] No GPU, torch already CPU build; ok.'
        }
        default {
            Write-Host "[torch-guard] No GPU but CUDA torch (cuda=$state) -> switching to CPU build + purging nvidia-*."
            Install-CpuTorch -PyRun $PyRun
            Remove-OrphanNvidiaWheels -PyRun $PyRun
        }
    }
}
