# Toggle dGPU state (enabled <-> disabled). Convenient one-shot.

#Requires -RunAsAdministrator

$dgpu = Get-PnpDevice -Class Display | Where-Object FriendlyName -Match 'NVIDIA'
if (-not $dgpu) { Write-Host "No NVIDIA dGPU found."; exit 1 }

if ($dgpu.Status -eq 'OK') {
    Write-Host "dGPU is currently ENABLED -> disabling..." -ForegroundColor Cyan
    Disable-PnpDevice -InstanceId $dgpu.InstanceId -Confirm:$false
    Start-Sleep 4
    Write-Host "now disabled." -ForegroundColor Green
} else {
    Write-Host "dGPU is currently DISABLED -> enabling..." -ForegroundColor Cyan
    Enable-PnpDevice -InstanceId $dgpu.InstanceId -Confirm:$false
    Start-Sleep 6
    nvidia-smi --query-gpu=name,pstate,temperature.gpu,clocks.current.memory --format=csv
}
