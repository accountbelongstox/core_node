# Disable the NVIDIA dGPU so it enters D3cold (zero power, fan stops).
# Run as Administrator. Re-enable with dgpu_enable.ps1 before gaming or CUDA.

#Requires -RunAsAdministrator

$dgpu = Get-PnpDevice -Class Display -PresentOnly |
    Where-Object FriendlyName -Match 'NVIDIA'

if (-not $dgpu) {
    Write-Host "No NVIDIA dGPU found." -ForegroundColor Yellow
    exit 1
}

if ($dgpu.Status -eq 'Error') {
    Write-Host "Already disabled: $($dgpu.FriendlyName)" -ForegroundColor Yellow
    exit 0
}

Write-Host "Disabling: $($dgpu.FriendlyName)" -ForegroundColor Cyan
Disable-PnpDevice -InstanceId $dgpu.InstanceId -Confirm:$false -ErrorAction Stop
Start-Sleep -Seconds 4
$now = Get-PnpDevice -InstanceId $dgpu.InstanceId
Write-Host "Status: $($now.Status)   Problem: $($now.Problem)" -ForegroundColor Green
Write-Host "dGPU is in D3cold. Fan should stop within ~30 seconds." -ForegroundColor Green
