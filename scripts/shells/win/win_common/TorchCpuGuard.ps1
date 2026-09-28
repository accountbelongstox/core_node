# Idempotent PyTorch CPU/GPU build guard (Windows). Mirrors linux/common/torch_cpu_guard.sh.

$cudaIndexPath = Join-Path $PSScriptRoot 'CudaIndex.ps1'
$pythonRuntimePath = Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1'
$nvidiaAlignPath = Join-Path $PSScriptRoot 'NvidiaCuStackAlign.ps1'
. $pythonRuntimePath
. $cudaIndexPath
. $nvidiaAlignPath

$script:TorchCpuIndexUrl = Get-AiRuntimePolicyValue -Name 'AI_TORCH_CPU_INDEX' -Default 'https://download.pytorch.org/whl/cpu'
$script:TorchPackages = Get-CanonicalTorchPackageSpecs
$script:TorchHealthPackages = Get-AiRuntimePolicyList -Name 'AI_TORCH_HEALTH_PACKAGES'
$script:PyserviceRuntimeRunKey = 'PYCORE_RUNTIME_STATE_RUN_ID'
$script:PyserviceRuntimeProcessKey = 'PYCORE_RUNTIME_STATE_PROCESS_ID'
$script:PyserviceTorchRunKey = 'PYCORE_TORCH_VALIDATION_RUN_ID'
$script:PyserviceTorchPythonKey = 'PYCORE_TORCH_VALIDATION_PYTHON'
$script:PyserviceTorchStateKey = 'PYCORE_TORCH_VALIDATION_CUDA_STATE'
$script:PyserviceTorchUsableKey = 'PYCORE_TORCH_VALIDATION_CUDA_USABLE'
$script:PyserviceTorchPolicyKey = 'PYCORE_TORCH_VALIDATION_POLICY_TAG'
$script:PyserviceTorchCacheHit = $false
$script:PyserviceTorchCachedState = ''
$script:PyserviceTorchCachedUsable = ''
$script:PyserviceTorchCachedPolicy = ''
$script:LastTorchCudaState = ''
$script:LastTorchCudaUsable = $false
$script:LastTorchCudaUsableKnown = $false
$script:TorchMutationPerformed = $false

function Sync-PyserviceTorchRuntimeState {
    param([string]$PythonCmd)
    $getter = Get-Command -Name 'Get-GlobalVar' -CommandType Function -ErrorAction SilentlyContinue
    $runtimeRunId = ''
    $validationRunId = ''
    $runtimeProcessId = ''
    $script:PyserviceTorchCacheHit = $false
    $script:PyserviceTorchCachedState = ''
    $script:PyserviceTorchCachedUsable = ''
    $script:PyserviceTorchCachedPolicy = ''
    if (-not $getter) { return }
    $runtimeRunId = [string](Get-GlobalVar -key $script:PyserviceRuntimeRunKey -defaultValue '')
    $runtimeProcessId = [string](Get-GlobalVar -key $script:PyserviceRuntimeProcessKey -defaultValue '')
    $validationRunId = [string](Get-GlobalVar -key $script:PyserviceTorchRunKey -defaultValue '')
    if ($runtimeRunId -and $runtimeRunId -eq $validationRunId -and $runtimeProcessId -eq ([string]$PID)) {
        $script:PyserviceTorchCacheHit = $true
        $script:PyserviceTorchCachedState = [string](Get-GlobalVar -key $script:PyserviceTorchStateKey -defaultValue '')
        $script:PyserviceTorchCachedUsable = [string](Get-GlobalVar -key $script:PyserviceTorchUsableKey -defaultValue 'false')
        $script:PyserviceTorchCachedPolicy = [string](Get-GlobalVar -key $script:PyserviceTorchPolicyKey -defaultValue '')
    }
}

function Save-PyserviceTorchRuntimeState {
    param(
        [string]$PythonCmd,
        [string]$CudaState,
        [bool]$CudaUsable,
        [string]$PolicyTag
    )
    $getter = Get-Command -Name 'Get-GlobalVar' -CommandType Function -ErrorAction SilentlyContinue
    $setter = Get-Command -Name 'Set-GlobalVar' -CommandType Function -ErrorAction SilentlyContinue
    $runtimeRunId = ''
    if (-not $getter -or -not $setter) { return }
    $runtimeRunId = [string](Get-GlobalVar -key $script:PyserviceRuntimeRunKey -defaultValue '')
    if (-not $runtimeRunId) { return }
    Set-GlobalVar -key $script:PyserviceTorchRunKey -value $runtimeRunId
    Set-GlobalVar -key $script:PyserviceTorchPythonKey -value $PythonCmd
    Set-GlobalVar -key $script:PyserviceTorchStateKey -value $(if ($CudaState) { $CudaState } else { 'absent' })
    Set-GlobalVar -key $script:PyserviceTorchUsableKey -value $CudaUsable.ToString().ToLowerInvariant()
    Set-GlobalVar -key $script:PyserviceTorchPolicyKey -value $(if ($PolicyTag) { $PolicyTag } else { 'cpu' })
}

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
    $pipExe = Get-PipExeForPythonExe -PythonExe $PythonCmd
    if (-not $pipExe -or -not (Test-PipPackageInstalled -PipExe $pipExe -PackageName 'torch')) {
        return ''
    }

    $out = & $PythonCmd -c "import torch; print(str(torch.version.cuda))" 2>&1
    $text = ("$out").Trim()
    if ($text -match 'Error|Traceback|No module') {
        $script:LastTorchCudaState = 'Broken'
        return 'Broken'
    }

    $script:LastTorchCudaState = $text
    return $text
}

function Convert-TorchCudaStateToTag {
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

function Invoke-TorchCudaUsableProbe {
    param([string]$PythonCmd)
    $out = & $PythonCmd -c "import torch; print('__CUDA_OK__' if torch.cuda.is_available() else '__CUDA_FAIL__')" 2>&1
    $script:LastTorchCudaUsable = ("$out" -match '__CUDA_OK__')
    $script:LastTorchCudaUsableKnown = $true
    return $script:LastTorchCudaUsable
}

function Test-TorchCudaUsable {
    param([string]$PythonCmd)
    Sync-PyserviceTorchRuntimeState -PythonCmd $PythonCmd
    if ($script:PyserviceTorchCacheHit) {
        return $script:PyserviceTorchCachedUsable -eq 'true'
    }
    return Invoke-TorchCudaUsableProbe -PythonCmd $PythonCmd
}

function Test-TorchPackagesInstalled {
    param(
        [string]$PipExe
    )
    foreach ($package in $script:TorchHealthPackages) {
        if (-not (Test-PipPackageInstalled -PipExe $PipExe -PackageName $package)) {
            return $false
        }
    }
    return $true
}

function Remove-OrphanNvidiaWheels {
    param(
        [string]$PythonCmd,
        [string]$PipExe
    )

    $line = ''
    $listOutput = @()
    $lower = ''
    $name = ''
    $pkgNames = @()
    $separatorIndex = -1
    if (-not $PipExe) {
        return
    }

    $listOutput = & $PipExe list --format=freeze 2>&1
    foreach ($line in ("$listOutput" -split "`n")) {
        $line = $line.Trim()
        $separatorIndex = $line.IndexOf('==', [System.StringComparison]::Ordinal)
        if ($separatorIndex -gt 0) {
            $name = $line.Substring(0, $separatorIndex)
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
        [string]$PipExe,
        [switch]$Force
    )
    $installArgs = @()
    $script:TorchMutationPerformed = $true
    if ($Force) {
        & $PipExe uninstall -y @script:TorchPackages
    }
    $installArgs = @('install', '--index-url', $script:TorchCpuIndexUrl)
    & $PipExe @installArgs @script:TorchPackages
}

function Install-GpuTorch {
    param(
        [string]$PythonCmd,
        [string]$PipExe,
        [PSCustomObject]$Policy,
        [switch]$Force
    )
    $installArgs = @()
    $script:TorchMutationPerformed = $true
    if ($Force) {
        & $PipExe uninstall -y @script:TorchPackages
    }
    $installArgs = @('install', '--index-url', $Policy.TorchIndexUrl)
    & $PipExe @installArgs @script:TorchPackages
    Sync-NvidiaCuStack -PythonCmd $PythonCmd -PipExe $PipExe -TargetMajor $Policy.Major
}

function Invoke-TorchBuildEnsureFull {
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
    if ($state -eq 'Broken') {
        Write-Host '[torch-guard] torch metadata is present, but its binary cannot load; preserving it to prevent a reinstall loop.' -ForegroundColor DarkYellow
        return
    }

    if ($policy.Enabled -and $state -ne 'Broken') {
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
            Install-GpuTorch -PythonCmd $PythonCmd -PipExe $PipExe -Policy $policy -Force
            return
        }
        $installedTag = Convert-TorchCudaStateToTag -State $state
        if ($installedTag -ne $policy.Tag) {
            Write-Host "[torch-guard] torch state '$state' does not match $($policy.Tag) -> repairing once."
            Install-GpuTorch -PythonCmd $PythonCmd -PipExe $PipExe -Policy $policy -Force
            return
        }
        if (-not (Test-TorchPackagesInstalled -PipExe $PipExe)) {
            Write-Host "[torch-guard] $installedTag torch group is incomplete -> repairing from the canonical release group."
            Install-GpuTorch -PythonCmd $PythonCmd -PipExe $PipExe -Policy $policy
            return
        }
        Sync-NvidiaCuStack -PythonCmd $PythonCmd -PipExe $PipExe -TargetMajor $policy.Major
        if (Test-TorchCudaUsable -PythonCmd $PythonCmd) {
            Write-Host "[torch-guard] GPU present, installed $installedTag torch group is usable; preserving installed versions."
        } else {
            Write-Host "[torch-guard] installed $installedTag torch cannot initialize CUDA; leaving it unchanged to avoid a reinstall loop. Repair the NVIDIA driver/runtime." -ForegroundColor DarkYellow
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
            if (Test-TorchPackagesInstalled -PipExe $PipExe) {
                Write-Host '[torch-guard] No GPU, installed CPU torch group is usable; preserving installed versions.'
            } else {
                Write-Host '[torch-guard] No GPU, CPU torch group is incomplete -> repairing.'
                Install-CpuTorch -PipExe $PipExe
            }
        }
        default {
            Write-Host "[torch-guard] No GPU but CUDA torch (cuda=$state) -> switching to CPU build + purging nvidia-*."
            Install-CpuTorch -PipExe $PipExe -Force
            Remove-OrphanNvidiaWheels -PythonCmd $PythonCmd -PipExe $PipExe
        }
    }
}

function Ensure-TorchBuild {
    param(
        [string]$PythonCmd,
        [string]$PipExe,
        [switch]$RepairOnly
    )
    $state = ''
    $usable = $false
    $policy = $null
    Sync-PyserviceTorchRuntimeState -PythonCmd $PythonCmd
    if ($script:PyserviceTorchCacheHit) {
        Write-Host "[torch-guard] Reusing pyservice runtime validation (policy=$($script:PyserviceTorchCachedPolicy), cuda=$($script:PyserviceTorchCachedState), usable=$($script:PyserviceTorchCachedUsable))."
        return
    }

    $script:LastTorchCudaState = ''
    $script:LastTorchCudaUsable = $false
    $script:LastTorchCudaUsableKnown = $false
    $script:TorchMutationPerformed = $false
    Invoke-TorchBuildEnsureFull -PythonCmd $PythonCmd -PipExe $PipExe -RepairOnly:$RepairOnly

    $state = $script:LastTorchCudaState
    if ($script:TorchMutationPerformed -or -not $state) {
        $state = Get-TorchCudaState -PythonCmd $PythonCmd
    }
    $policy = Get-CudaRuntimePolicy
    if ($policy.Enabled) {
        if ($script:TorchMutationPerformed -or -not $script:LastTorchCudaUsableKnown) {
            $usable = Invoke-TorchCudaUsableProbe -PythonCmd $PythonCmd
        } else {
            $usable = $script:LastTorchCudaUsable
        }
    }
    Save-PyserviceTorchRuntimeState -PythonCmd $PythonCmd -CudaState $state -CudaUsable $usable -PolicyTag $policy.Tag
}
