# Quick "who is touching the dGPU right now?" - lists processes that have:
#  (a) compute/graphics apps reported by nvidia-smi
#  (b) NVENC sessions
#  (c) NVIDIA DLLs loaded into their memory (would pin RTD3)
# Read-only. Safe to run anytime.

Write-Host "=== nvidia-smi process list (compute+graphics) ===" -ForegroundColor Cyan
nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv
""
Write-Host "=== NVENC sessions ===" -ForegroundColor Cyan
nvidia-smi --query-gpu=encoder.stats.sessionCount,encoder.stats.averageFps --format=csv

""
Write-Host "=== processes with NVIDIA DLLs loaded ===" -ForegroundColor Cyan
$nvDlls = 'nvcuda','nvapi64','nvml','cudart64','cublas64','cudnn','nvenc','nvdec','nvEncMFT'
Get-Process | ForEach-Object {
    try {
        $mods = $_.Modules | Where-Object {
            foreach ($d in $nvDlls) { if ($_.ModuleName -match $d) { return $true } }
            $false
        }
        if ($mods) {
            [pscustomobject]@{
                Pid = $_.Id
                Name = $_.ProcessName
                WS_MB = [int]($_.WS/1MB)
                Modules = ($mods.ModuleName | Select-Object -Unique) -join ','
            }
        }
    } catch {}
} | Sort-Object Name | Format-Table -AutoSize -Wrap

Write-Host "=== dGPU live snapshot ===" -ForegroundColor Cyan
nvidia-smi --query-gpu=pstate,temperature.gpu,utilization.gpu,memory.used,clocks.current.graphics,clocks.current.memory --format=csv
