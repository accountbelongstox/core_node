# Re-enable the NVIDIA dGPU. Run as Administrator. Use before gaming/CUDA.

#Requires -RunAsAdministrator

$dgpu = Get-PnpDevice -Class Display |
    Where-Object FriendlyName -Match 'NVIDIA'

if (-not $dgpu) {
    Write-Host "No NVIDIA dGPU found." -ForegroundColor Yellow
    exit 1
}

if ($dgpu.Status -eq 'OK') {
    Write-Host "Already enabled: $($dgpu.FriendlyName)" -ForegroundColor Yellow
    nvidia-smi --query-gpu=name,pstate,temperature.gpu,clocks.current.memory --format=csv
    exit 0
}

Write-Host "Enabling: $($dgpu.FriendlyName)" -ForegroundColor Cyan
Enable-PnpDevice -InstanceId $dgpu.InstanceId -Confirm:$false -ErrorAction Stop
Start-Sleep -Seconds 6

Write-Host ""
nvidia-smi --query-gpu=name,pstate,temperature.gpu,clocks.current.memory --format=csv
