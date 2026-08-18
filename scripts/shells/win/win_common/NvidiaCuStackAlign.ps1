# NVIDIA CUDA dependency ownership guard (Windows).
# Torch and Paddle select the shared CUDA ABI; pip owns their nvidia-* dependencies.

$cudaIndexPath = Join-Path $PSScriptRoot 'CudaIndex.ps1'
$cudaIndexLoaded = Get-Variable -Name 'PycoreCudaIndexLoaded' -Scope Script -ErrorAction SilentlyContinue
if ($null -eq $cudaIndexLoaded -or -not [bool]$cudaIndexLoaded.Value) {
    . $cudaIndexPath
    Set-Variable -Name 'PycoreCudaIndexLoaded' -Scope Script -Value $true
}

$script:NvidiaAlignPrefix = '[nvidia-cu-align]'
$script:NvidiaCuAlignmentStateVariable = 'PycoreNvidiaCuAlignLastTarget'

function Sync-NvidiaCuStack {
    param(
        [Parameter(Mandatory = $true)][string]$PythonCmd,
        [string]$PipExe,
        [int]$TargetMajor = 0
    )

    $policy = Get-CudaRuntimePolicy
    if ($TargetMajor -le 0 -and $policy.Enabled) {
        $TargetMajor = $policy.Major
    }
    if ($TargetMajor -le 0) {
        Write-Host "$script:NvidiaAlignPrefix no active CUDA ABI; pip keeps the installed dependency set." -ForegroundColor DarkGray
        return
    }
    $alignState = Get-Variable -Name $script:NvidiaCuAlignmentStateVariable -Scope Script -ErrorAction SilentlyContinue
    if ($alignState -and $alignState.Value -eq $TargetMajor) {
        return
    }
    Set-Variable -Name $script:NvidiaCuAlignmentStateVariable -Scope Script -Value $TargetMajor
    Write-Host "$script:NvidiaAlignPrefix target=cu$TargetMajor; Torch/Paddle wheel metadata owns the NVIDIA dependency set." -ForegroundColor Green
}
