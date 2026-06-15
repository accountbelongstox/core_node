# Show every "unclean shutdown" (Kernel-Power 41) and 5 minutes of system-log
# context around each, so you can tell whether it correlates with thermal,
# driver, or hardware events. Read-only.

param([int]$ContextMinutes = 5)

$events = Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-Kernel-Power'; Id=41} -ErrorAction SilentlyContinue
if (-not $events) {
  Write-Host "No Kernel-Power 41 (unclean shutdown) events found. System has been stable." -ForegroundColor Green
  return
}

Write-Host "Found $($events.Count) unclean shutdowns:" -ForegroundColor Yellow
$events | Select-Object TimeCreated, Id | Format-Table -AutoSize

foreach ($e in $events) {
  $start = $e.TimeCreated.AddMinutes(-$ContextMinutes)
  $end   = $e.TimeCreated.AddSeconds(60)
  Write-Host ""
  Write-Host "--- context for crash at $($e.TimeCreated) ---" -ForegroundColor Cyan
  Get-WinEvent -FilterHashtable @{LogName='System'; StartTime=$start; EndTime=$end; Level=1,2,3} -ErrorAction SilentlyContinue |
    Select-Object TimeCreated, Id, LevelDisplayName, ProviderName,
      @{n='msg';e={ $_.Message.Substring(0,[math]::Min(100,$_.Message.Length)) }} |
    Format-Table -AutoSize -Wrap
}

Write-Host ""
Write-Host "Heuristics:" -ForegroundColor Gray
Write-Host " - ACPI / thermal entries near crash time -> heat-related shutdown"
Write-Host " - nvlddmkm / amdkmdag / display errors -> GPU driver crash"
Write-Host " - WHEA-Logger errors -> hardware (CPU/PCIe/RAM) fault"
Write-Host " - clean context -> likely manual power-off or true power loss"
