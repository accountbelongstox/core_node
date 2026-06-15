# Brief 30-second dGPU workload via PyMuPDF rendering loop.
# Watches temperature rise rate and clock ramp to verify cooling response.
# Requires python with pymupdf installed (already on this system).
# Read-only of system state; only causes ~30s of GPU work.

param([string]$PythonExe = 'D:\.dev_win10\python311\python.exe')

if (-not (Test-Path $PythonExe)) {
  Write-Host "python not found at $PythonExe; pass -PythonExe <path>" -ForegroundColor Yellow
  return
}

$tmp = Join-Path $env:TEMP 'gpu_stress.py'
@'
import pymupdf, time
doc = pymupdf.open()
for _ in range(30):
    for _ in range(8):
        p = doc.new_page(width=2400, height=1500)
        p.draw_rect(p.rect, fill=(0.1,0.2,0.4))
        for x in range(0, 2400, 6):
            p.draw_line(pymupdf.Point(x,0), pymupdf.Point(2400-x,1500), color=(1,0.5,0.2), width=0.4)
    doc.tobytes()
    time.sleep(0.05)
'@ | Out-File -FilePath $tmp -Encoding utf8 -Force

Write-Host "starting 30s load + parallel temperature sampling..." -ForegroundColor Cyan
$job = Start-Job -ScriptBlock { param($exe,$src) & $exe $src } -ArgumentList $PythonExe,$tmp

$lines = @()
Write-Host ("time      pstate  gpu_C  power_W  coreMHz  memMHz")
$end = (Get-Date).AddSeconds(35)
while ((Get-Date) -lt $end) {
  $r = (nvidia-smi --query-gpu=pstate,temperature.gpu,power.draw,clocks.current.graphics,clocks.current.memory --format=csv,noheader,nounits 2>$null)
  $line = "{0}  {1}" -f (Get-Date -Format HH:mm:ss), $r
  Write-Host $line
  $lines += $line
  Start-Sleep 2
}

Stop-Job $job -ErrorAction SilentlyContinue
Remove-Job $job -Force -ErrorAction SilentlyContinue
Remove-Item $tmp -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Cooling response checklist:" -ForegroundColor Gray
Write-Host " - temp rise during load should plateau within ~15s -> cooling adequate"
Write-Host " - temp climb past 85 C without plateau -> dust/paste issue"
Write-Host " - clocks should hit max (around 2250-3105 MHz core) at peak -> no throttling"
Write-Host " - if clocks stay low while temp is high -> thermal throttle, cooling is over-burdened"
