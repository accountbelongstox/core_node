# Continuously sample dGPU state until you press Ctrl+C.
# Useful to see when (or whether) the GPU drops to P8 after a change.
# Optional argument: interval seconds (default 3).

param(
  [int]$IntervalSeconds = 3
)

Write-Host "Sampling dGPU every $IntervalSeconds s. Press Ctrl+C to stop." -ForegroundColor Cyan
Write-Host ("time      pstate  temp  util  vram  coreMHz  memMHz  encSessions")
Write-Host ("--------  ------  ----  ----  ----  -------  ------  -----------")

while ($true) {
    $r = (nvidia-smi --query-gpu=pstate,temperature.gpu,utilization.gpu,memory.used,clocks.current.graphics,clocks.current.memory,encoder.stats.sessionCount --format=csv,noheader,nounits 2>$null)
    "{0}  {1}" -f (Get-Date -Format HH:mm:ss), $r
    Start-Sleep -Seconds $IntervalSeconds
}
