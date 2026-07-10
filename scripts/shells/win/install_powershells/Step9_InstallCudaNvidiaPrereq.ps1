# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# NVIDIA driver + CUDA runtime prerequisite (Windows, idempotent).
# Mirrors linux/debian/install_shells/13_cuda_nvidia_prereq.sh.
# Runs AFTER Step8_InstallPython.ps1 (pip confirmed) and BEFORE
# Step10_InstallPythonPrereqPackages.ps1 so torch/paddle guards pick GPU wheels.

$scriptRoot = $PSScriptRoot
$winCommonDir = Join-Path (Split-Path $scriptRoot -Parent) "win_common"

. (Join-Path $winCommonDir "GlobalVars.ps1")
. (Join-Path $winCommonDir "CommonFunc.ps1")
. (Join-Path $winCommonDir "PythonRuntimeCommon.ps1")
. (Join-Path $winCommonDir "CudaIndex.ps1")

$SCRIPT_INDEX = "[Step 9]"
$nvidiaSmiExe = $null
$gpuPresent = $false
$driverActive = $false
$driverCudaLine = ""
$torchIndex = ""
$paddleIndex = ""

function Test-NvidiaSmiActive {
    param([string]$SmiExe)
    if (-not $SmiExe) { return $false }
    $output = & $SmiExe 2>&1
    return ("$output" -match 'Driver Version:')
}

Write-Host "$SCRIPT_INDEX ============================================================" -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX NVIDIA driver + CUDA runtime prerequisite (Windows)" -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX ============================================================" -ForegroundColor Cyan

$gpuPresent = Test-NvidiaGpuPresent
if (-not $gpuPresent) {
    Write-Host "$SCRIPT_INDEX No NVIDIA GPU detected -> skipping (CPU-only host)." -ForegroundColor Green
    return
}

Write-Host "$SCRIPT_INDEX NVIDIA GPU detected." -ForegroundColor White
$nvidiaSmiExe = Resolve-NvidiaSmiExe
$driverActive = Test-NvidiaSmiActive -SmiExe $nvidiaSmiExe

if ($driverActive) {
    $driverCudaLine = Get-NvidiaDriverCudaVersionLine -SmiPath $nvidiaSmiExe
    $gpuLine = Get-NvidiaSmiFirstGpuLine -SmiPath $nvidiaSmiExe
    if ($gpuLine) {
        Write-Host "$SCRIPT_INDEX Driver active: $gpuLine" -ForegroundColor Green
    } else {
        Write-Host "$SCRIPT_INDEX Driver active (nvidia-smi OK)." -ForegroundColor Green
    }
    if ($driverCudaLine) {
        Write-Host "$SCRIPT_INDEX $driverCudaLine" -ForegroundColor Green
    }
} else {
    Write-Host "$SCRIPT_INDEX [WARN] NVIDIA GPU present but nvidia-smi is not working." -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX        Install/update the NVIDIA driver, reboot if needed, then re-run the installer." -ForegroundColor Yellow
    Write-Host "$SCRIPT_INDEX        Until the driver loads, Step10 will install CPU torch/paddle wheels." -ForegroundColor Yellow
}

$torchIndex = Get-TorchCudaIndexUrl
$paddleIndex = Get-PaddleCudaIndexUrl
Write-Host "$SCRIPT_INDEX Driver-matched wheel indexes for Step10:" -ForegroundColor Cyan
Write-Host "$SCRIPT_INDEX   torch  -> $torchIndex" -ForegroundColor White
Write-Host "$SCRIPT_INDEX   paddle -> $paddleIndex" -ForegroundColor White
Write-Host "$SCRIPT_INDEX   (see https://pytorch.org/get-started/locally/ and PaddlePaddle 3.3 install docs)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "$SCRIPT_INDEX NVIDIA/CUDA prerequisite step completed." -ForegroundColor Green
