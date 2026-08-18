# Shared PyTorch wheel install using the centralized driver-matched CUDA index.

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')
. (Join-Path $PSScriptRoot 'TorchCpuGuard.ps1')

function Install-PycoreTorchStack {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [string]$Prefix = '',
        [switch]$Quiet
    )
    # Idempotent: Step10 installs torch via Ensure-TorchBuild; TTS steps only verify/repair.
    $pipExe = Get-PipExeForPythonExe -PythonExe $PythonExe
    if (-not $pipExe) {
        if (-not $Quiet) {
            Write-Host ("{0}[!] pip not found for {1}; skipping torch ensure." -f $Prefix, $PythonExe) -ForegroundColor DarkYellow
        }
        return
    }
    if (-not $Quiet) {
        if ((Get-CudaRuntimePolicy).Enabled) {
            $idx = Get-TorchCudaIndexUrl
            $driverLine = Get-NvidiaDriverCudaVersionLine
            $driverNote = if ($driverLine) { " ($driverLine)" } else { '' }
            Write-Host ("{0}[..] ensuring torch (CUDA index: {1}{2}) ..." -f $Prefix, $idx, $driverNote) -ForegroundColor Yellow
        } else {
            Write-Host ("{0}[..] ensuring torch (CPU build) ..." -f $Prefix) -ForegroundColor Yellow
        }
    }
    Ensure-TorchBuild -PythonCmd $PythonExe -PipExe $pipExe
}
