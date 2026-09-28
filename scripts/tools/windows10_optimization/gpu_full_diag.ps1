# Comprehensive dGPU "why won't it sleep" diagnostic.
# Captures everything in one pass and writes a timestamped report to
# %TEMP%\gpu_diag_<timestamp>.txt. Read-only, safe to run anytime.

$report = @()
function W($s) { $script:report += $s; Write-Host $s }

$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$out = Join-Path $env:TEMP "gpu_diag_$ts.txt"

W "=========================================================="
W " GPU FULL DIAGNOSTIC  -  $(Get-Date)"
W " host: $env:COMPUTERNAME    user: $env:USERNAME"
W "=========================================================="

W ""; W "## 1. HARDWARE INVENTORY"
Get-CimInstance Win32_VideoController |
  Select-Object Name, DriverVersion, DriverDate, AdapterCompatibility, CurrentRefreshRate, VideoModeDescription |
  Format-List | Out-String | ForEach-Object { W $_ }

W "## 2. CHASSIS / POWER"
Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer, Model, SystemFamily |
  Format-List | Out-String | ForEach-Object { W $_ }
$bat = Get-CimInstance -Namespace root\WMI -ClassName BatteryStatus -ErrorAction SilentlyContinue
if ($bat) {
    W "AC: $($bat.PowerOnline)  Charging: $($bat.Charging)  Discharging: $($bat.Discharging)"
} else {
    W "no battery sensor"
}
W "active power scheme: $(powercfg /getactivescheme)"

W ""; W "## 3. NVIDIA dGPU LIVE STATE (5 samples)"
1..5 | ForEach-Object {
    $r = nvidia-smi --query-gpu=pstate,temperature.gpu,utilization.gpu,memory.used,clocks.current.graphics,clocks.current.memory,encoder.stats.sessionCount --format=csv,noheader,nounits 2>&1
    W ("  [{0}] {1}" -f (Get-Date -Format HH:mm:ss), $r)
    Start-Sleep 2
}

W ""; W "## 4. PROCESSES ON dGPU (nvidia-smi)"
$smi = nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv 2>&1
W ($smi | Out-String)
W "pmon snapshot:"
$pmon = nvidia-smi pmon -c 1 2>&1
W ($pmon | Out-String)

W ""; W "## 5. PROCESSES WITH NVIDIA DLLs LOADED"
$nvDlls = 'nvcuda','nvapi64','nvml','cudart64','cublas64','cudnn','nvenc','nvdec','nvEncMFT'
$hits = Get-Process | ForEach-Object {
    try {
        $mods = $_.Modules | Where-Object {
            foreach ($d in $nvDlls) { if ($_.ModuleName -match $d) { return $true } }
            $false
        }
        if ($mods) {
            [pscustomobject]@{
                Pid = $_.Id
                Name = $_.ProcessName
                Modules = ($mods.ModuleName | Select-Object -Unique) -join ','
            }
        }
    } catch {}
}
W ($hits | Sort-Object Name | Format-Table -AutoSize -Wrap | Out-String)

W ""; W "## 6. NVIDIA SERVICES"
Get-Service -ErrorAction SilentlyContinue NvContainerLocalSystem, NVDisplay.ContainerLocalSystem |
  Format-Table Name, Status, StartType -AutoSize | Out-String | ForEach-Object { W $_ }

W ""; W "## 7. XID / nvlddmkm ERROR HISTORY (last 14d)"
$since = (Get-Date).AddDays(-14)
$nv = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='nvlddmkm'; StartTime=$since} -ErrorAction SilentlyContinue
if ($nv) {
    W "TOTAL nvlddmkm events: $($nv.Count)"
    $nv | Group-Object Id | ForEach-Object {
        W "  EventId $($_.Name)  count=$($_.Count)  lastTime=$($_.Group[0].TimeCreated)"
    }
} else {
    W "no nvlddmkm events in last 14 days -> hardware is healthy"
}

W ""; W "## 8. WSL2 / Hyper-V"
$features = Get-WindowsOptionalFeature -Online -ErrorAction SilentlyContinue |
  Where-Object { $_.FeatureName -match 'Hyper-V|VirtualMachinePlatform|Microsoft-Windows-Subsystem-Linux|WSL' }
$features | Select-Object FeatureName, State | Format-Table -AutoSize | Out-String | ForEach-Object { W $_ }
W "running WSL distros:"
W ((wsl --list --running 2>&1) -join "`n")

W ""; W "## 9. PER-APP GPU PREFERENCES"
$key = 'HKCU:\Software\Microsoft\DirectX\UserGpuPreferences'
if (Test-Path $key) {
    $val = (Get-ItemProperty $key).PSObject.Properties | Where-Object { $_.Name -notmatch '^PS' }
    if ($val) { $val | ForEach-Object { W "  $($_.Name)  =  $($_.Value)" } }
    else { W "  no per-app preferences set" }
} else {
    W "  registry key not present"
}

W ""; W "## 10. HAGS (Hardware-Accelerated GPU Scheduling)"
$h = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\GraphicsDrivers' -Name HwSchMode -ErrorAction SilentlyContinue).HwSchMode
W "  HwSchMode = $h   (2=on, 1=off, blank=Windows-default)"

W ""; W "=========================================================="
W " end of report"
W "=========================================================="

$report -join "`n" | Out-File -FilePath $out -Encoding utf8
Write-Host ""
Write-Host "report saved to: $out" -ForegroundColor Cyan
