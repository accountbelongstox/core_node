# Idempotent PyTorch CPU/GPU build guard (Windows). Mirrors linux/common/torch_cpu_guard.sh.

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')
. (Join-Path $PSScriptRoot 'NvidiaCuStackAlign.ps1')

$script:TorchCpuIndexUrl = Get-AiRuntimePolicyValue -Name 'AI_TORCH_CPU_INDEX' -Default 'https://download.pytorch.org/whl/cpu'
$script:TorchPackages = Get-AiRuntimePolicyList -Name 'AI_TORCH_PACKAGES'

function Get-TcgPython {
    param([string]$Override)
    if ($Override) { return $Override }
    if ($env:TCG_PYTHON) { return $env:TCG_PYTHON }
    return $null
}

function Test-TcgGpuPresent {
    return [bool](Get-CudaRuntimePolicy).Enabled
}

function Get-TorchCudaState {
    param([string]$PythonCmd)
    if (-not (Test-PythonDistInfoPresent -PythonExe $PythonCmd -DistPrefixes @('torch'))) {
        return ''
    }

    $out = & $PythonCmd -c "import torch; print(str(torch.version.cuda))" 2>&1
    $text = ("$out").Trim()
    if ($text -match 'Error|Traceback|No module') {
        return 'Broken'
    }

    return $text
}

function Convert-TorchCudaStateToTag {
    param([string]$State)
    if ($State -match '^(\d+)\.(\d+)') {
        return ('cu{0}{1}' -f $Matches[1], $Matches[2])
    }
    return ''
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
    & $PipExe install --ignore-installed --force-reinstall --index-url $script:TorchCpuIndexUrl @script:TorchPackages
}

function Install-GpuTorch {
    param(
        [string]$PythonCmd,
        [string]$PipExe,
        [PSCustomObject]$Policy
    )
    & $PipExe install --ignore-installed --force-reinstall --index-url $Policy.TorchIndexUrl @script:TorchPackages
    Sync-NvidiaCuStack -PythonCmd $PythonCmd -PipExe $PipExe -TargetMajor $Policy.Major
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
        $PipExe = $Global:PIP_EXE_PATH
    }

    if (-not $PipExe) {
        Write-Host '[torch-guard] pip.exe not found; skipping.' -ForegroundColor Yellow
        return
    }

    $state = Get-TorchCudaState -PythonCmd $PythonCmd
    $policy = Get-CudaRuntimePolicy

    if ($policy.Enabled) {
        if (-not $state) {
            if ($RepairOnly) {
                Write-Host '[torch-guard] GPU present, torch missing (repair-only) -> nothing to repair.'
            } else {
                Write-Host "[torch-guard] GPU present, torch missing -> installing canonical $($policy.Tag) build."
                Install-GpuTorch -PythonCmd $PythonCmd -PipExe $PipExe -Policy $policy
            }
            return
        }
        if ($state -eq 'None') {
            Write-Host "[torch-guard] GPU present, torch is CPU-only -> switching to canonical $($policy.Tag) build."
            Install-GpuTorch -PythonCmd $PythonCmd -PipExe $PipExe -Policy $policy
            return
        }
        $installedTag = Convert-TorchCudaStateToTag -State $state
        if ($state -eq 'Broken' -or $installedTag -ne $policy.Tag) {
            Write-Host "[torch-guard] torch state '$state' does not match $($policy.Tag) -> repairing once."
            Install-GpuTorch -PythonCmd $PythonCmd -PipExe $PipExe -Policy $policy
            return
        }
        Sync-NvidiaCuStack -PythonCmd $PythonCmd -PipExe $PipExe -TargetMajor $policy.Major
        if (Test-TorchCudaUsable -PythonCmd $PythonCmd) {
            Write-Host "[torch-guard] GPU present, canonical $installedTag torch is usable; no change."
        } else {
            Write-Host "[torch-guard] canonical $installedTag is installed but CUDA cannot initialize; leaving it unchanged to avoid a reinstall loop. Repair the NVIDIA driver/runtime." -ForegroundColor DarkYellow
        }
        return
    }

    switch ($state) {
        { $_ -in @('', 'Broken') } {
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
