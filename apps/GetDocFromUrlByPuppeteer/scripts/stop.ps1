# GetDocFromUrlByPuppeteer NCore App Stop Script
# Complexity: Complex - Advanced process management and cleanup
# Hardcoded stop script for GetDocFromUrlByPuppeteer application
# Entry Point: stop.bat (Windows) / stop.sh (Linux)

Write-Host "[INFO] Stopping NCore application: GetDocFromUrlByPuppeteer" -ForegroundColor Yellow

try {
    # Stop processes matching the GetDocFromUrlByPuppeteer app
    $processes = Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.CommandLine -like "*app=GetDocFromUrlByPuppeteer*" }

    if ($processes) {
        foreach ($process in $processes) {
            Write-Host "[INFO] Stopping process PID: $($process.Id)" -ForegroundColor Cyan
            Stop-Process -Id $process.Id -Force
        }
        Write-Host "[SUCCESS] GetDocFromUrlByPuppeteer stopped successfully" -ForegroundColor Green
    } else {
        Write-Host "[INFO] No running processes found for GetDocFromUrlByPuppeteer" -ForegroundColor Gray
    }
}
catch {
    Write-Host "[ERROR] Failed to stop GetDocFromUrlByPuppeteer: $_" -ForegroundColor Red
    exit 1
}

exit 0

