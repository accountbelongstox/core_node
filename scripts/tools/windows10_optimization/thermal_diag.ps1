# Thermal / cooling-system diagnostic.
# Captures: ACPI thermal zones, CPU clocks and throttling, NVIDIA dGPU temp
# trend, AMD iGPU presence, fan availability, throttle history.
# Read-only. Use whenever you suspect cooling is misbehaving.

param(
  [int]$SampleSeconds = 30,
  [int]$IntervalSeconds = 3
)

$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$out = Join-Path $env:TEMP "thermal_diag_$ts.txt"
$lines = @()
function W($s) { $script:lines += $s; Write-Host $s }

W "=========================================================="
W " THERMAL DIAGNOSTIC  -  $(Get-Date)"
W " host: $env:COMPUTERNAME"
W " duration: ${SampleSeconds}s   interval: ${IntervalSeconds}s"
W "=========================================================="

W ""; W "## 1. CHASSIS / POWER"
$cs = Get-CimInstance Win32_ComputerSystem
W ("manufacturer: {0}    model: {1}    family: {2}" -f $cs.Manufacturer,$cs.Model,$cs.SystemFamily)
$bat = Get-CimInstance -Namespace root\WMI -ClassName BatteryStatus -ErrorAction SilentlyContinue
if ($bat) { W ("AC: {0}    charging: {1}    discharging: {2}" -f $bat.PowerOnline,$bat.Charging,$bat.Discharging) }
else      { W "no battery sensor (always-AC)" }

W ""; W "## 2. CPU"
$cpu = Get-CimInstance Win32_Processor
W ("name: {0}" -f $cpu.Name)
W ("cores/threads: {0}c/{1}t   base: {2} MHz   current: {3} MHz   load: {4}%" -f `
  $cpu.NumberOfCores,$cpu.NumberOfLogicalProcessors,$cpu.MaxClockSpeed,$cpu.CurrentClockSpeed,$cpu.LoadPercentage)

W ""; W "## 3. COOLING DEVICES (Win32_Fan + ACPI zone)"
$fan = Get-CimInstance Win32_Fan -ErrorAction SilentlyContinue
if ($fan) {
  $fan | ForEach-Object { W ("fan: {0}    Status:{1}    ActiveCooling:{2}    Desired:{3}" -f $_.Name,$_.Status,$_.ActiveCooling,$_.DesiredSpeed) }
} else { W "no Win32_Fan reported" }
$zones = Get-CimInstance -Namespace root\WMI -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue
if ($zones) {
  $zones | ForEach-Object {
    W ("zone {0}    cur:{1:N1} C    critical:{2:N1} C" -f $_.InstanceName, (($_.CurrentTemperature - 2732)/10.0), (($_.CriticalTripPoint - 2732)/10.0))
  }
} else { W "no ACPI thermal zones exposed" }

W ""; W "## 4. dGPU HEALTH"
$health = nvidia-smi --query-gpu=name,driver_version,vbios_version,pcie.link.gen.current,pcie.link.gen.max,pcie.link.width.current,pcie.link.width.max --format=csv 2>&1
W ($health | Out-String).Trim()

W ""; W "## 5. THROTTLE / EVENT REASONS (now)"
$reasons = nvidia-smi --query-gpu=clocks_event_reasons.active,clocks_event_reasons.gpu_idle,clocks_event_reasons.hw_thermal_slowdown,clocks_event_reasons.sw_thermal_slowdown,clocks_event_reasons.hw_power_brake_slowdown --format=csv 2>&1
W ($reasons | Out-String).Trim()

W ""; W "## 6. SAMPLED TEMPS over ${SampleSeconds}s"
W ("time      pstate  gpu_C  cpu_zone_C  power_W  coreMHz  memMHz")
W ("--------  ------  -----  ----------  -------  -------  ------")
$steps = [math]::Max(1, [math]::Floor($SampleSeconds / $IntervalSeconds))
$cpu_temps = @()
$gpu_temps = @()
for ($i = 0; $i -lt $steps; $i++) {
  $g = (nvidia-smi --query-gpu=pstate,temperature.gpu,power.draw,clocks.current.graphics,clocks.current.memory --format=csv,noheader,nounits 2>$null)
  $gParts = $g -split '\s*,\s*'
  $z = Get-CimInstance -Namespace root\WMI -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -First 1
  $zC = if ($z) { [math]::Round((($z.CurrentTemperature - 2732)/10.0),1) } else { 'na' }
  $line = "{0}  {1,-6}  {2,-5}  {3,-10}  {4,-7}  {5,-7}  {6}" -f (Get-Date -Format HH:mm:ss),$gParts[0],$gParts[1],$zC,$gParts[2],$gParts[3],$gParts[4]
  W $line
  if ($gParts[1] -as [double]) { $gpu_temps += [double]$gParts[1] }
  if ($zC -ne 'na')             { $cpu_temps += [double]$zC }
  Start-Sleep -Seconds $IntervalSeconds
}

W ""; W "## 7. TEMP STATS (over the sample window)"
if ($gpu_temps.Count) {
  $g = $gpu_temps | Measure-Object -Maximum -Minimum -Average
  W ("dGPU      min:{0,5:N1} C   avg:{1,5:N1} C   max:{2,5:N1} C   range:{3,5:N1} C" -f $g.Minimum,$g.Average,$g.Maximum,($g.Maximum-$g.Minimum))
}
if ($cpu_temps.Count) {
  $c = $cpu_temps | Measure-Object -Maximum -Minimum -Average
  W ("CPU zone  min:{0,5:N1} C   avg:{1,5:N1} C   max:{2,5:N1} C   range:{3,5:N1} C" -f $c.Minimum,$c.Average,$c.Maximum,($c.Maximum-$c.Minimum))
}

W ""; W "## 8. THERMAL / CRITICAL EVENTS (last 30d)"
$since = (Get-Date).AddDays(-30)
$err = Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=$since; Level=1,2} -ErrorAction SilentlyContinue |
  Where-Object { $_.ProviderName -match 'Thermal|Kernel-Power|ACPI' -or $_.Message -match 'thermal|overheat' } |
  Select-Object TimeCreated, Id, LevelDisplayName, ProviderName
if ($err) {
  $err | Group-Object ProviderName, Id | ForEach-Object {
    W ("  {0}    count={1}    last={2}" -f $_.Name,$_.Count,($_.Group[0].TimeCreated))
  }
} else { W "  none -> cooling has not flagged any critical condition" }

W ""; W "## 9. ASSESSMENT"
$gpuMax = if ($gpu_temps.Count) { ($gpu_temps | Measure-Object -Maximum).Maximum } else { 0 }
$gpuRange = if ($gpu_temps.Count) { ($gpu_temps | Measure-Object -Maximum -Minimum); }
if ($gpuMax -gt 85) {
  W "  ! dGPU peaked >85 C while supposedly idle - cooling may be impaired (check paste/dust/heatpipes)"
} elseif ($gpuMax -gt 70) {
  W "  ~ dGPU idle peak >70 C - elevated but not unsafe; usually a sign dGPU is locked in P0"
} elseif ($gpuMax -gt 55) {
  W "  ~ dGPU idle 55-70 C - typical when dGPU is stuck at P0 boost-ready; cooling is OK"
} else {
  W "  + dGPU idle <55 C - healthy idle profile"
}

W ""; W "=========================================================="
W " end of report  ->  $out"
W "=========================================================="

$lines -join "`n" | Out-File -FilePath $out -Encoding utf8
Write-Host ""
Write-Host "saved: $out" -ForegroundColor Cyan
