# Shared PyTorch wheel install — uses Step9/CudaIndex driver-matched index (not hardcoded cu124).
# CTranslate2 cu12 libs for faster-whisper are separate from torch CUDA tags.

function Get-ShellsLinuxCommonDirFromWinCommon {
    # win_common -> win -> shells -> linux\common
    $shellsDir = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
    return (Join-Path $shellsDir 'linux\common')
}

. (Join-Path $PSScriptRoot 'CudaIndex.ps1')
. (Join-Path $PSScriptRoot 'PythonRuntimeCommon.ps1')
. (Join-Path $PSScriptRoot 'TorchCpuGuard.ps1')
$libGpuPath = Join-Path (Get-ShellsLinuxCommonDirFromWinCommon) 'base_libs\lib_gpu.ps1'
if (-not (Test-Path -LiteralPath $libGpuPath)) {
    throw "GPU helper not found: $libGpuPath"
}
. $libGpuPath

function Install-PycoreTorchStack {
    param(
        [Parameter(Mandatory = $true)][string]$PythonExe,
        [string]$Prefix = '',
        [switch]$Quiet
    )
    # Idempotent: Step10 installs torch via Ensure-TorchBuild; TTS steps only verify/repair.
    $pipExe = $Global:PIP_EXE_PATH
    if (-not $pipExe) {
        if (-not $Quiet) {
            Write-Host ("{0}[!] pip not found for {1}; skipping torch ensure." -f $Prefix, $PythonExe) -ForegroundColor DarkYellow
        }
        return
    }
    if (-not $Quiet) {
        if (Test-CudaPresent) {
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

function Install-Ctranslate2Cuda12Libs {
    param(
        [Parameter(Mandatory = $true)][string]$PipExe,
        [string]$Prefix = '',
        [switch]$Force
    )
    # cu12 nvidia libs are not installed: single system Python 3.13 stays cu13-only;
    # faster-whisper uses CPU int8 in-process (see NvidiaCuStackAlign.ps1).
    Write-Host ("{0}[i] cu12 CTranslate2 libs skipped (system Python cu13-only; no venv)." -f $Prefix) -ForegroundColor DarkGray
    return $false
}
