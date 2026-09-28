# VideoCompression NCore App Stop Script
# Complexity: Complex - Advanced process management and cleanup
# Hardcoded stop script for VideoCompression application
# Entry Point: stop.bat (Windows) / stop.sh (Linux)

Write-Host "[INFO] Stopping NCore application: VideoCompression" -ForegroundColor Yellow

try {
    # Stop processes matching the VideoCompression app
    $processes = Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.CommandLine -like "*app=VideoCompression*" }

    if ($processes) {
        foreach ($process in $processes) {
            Write-Host "[INFO] Stopping process PID: $($process.Id)" -ForegroundColor Cyan
            Stop-Process -Id $process.Id -Force
        }
        Write-Host "[SUCCESS] VideoCompression stopped successfully" -ForegroundColor Green
    } else {
        Write-Host "[INFO] No running processes found for VideoCompression" -ForegroundColor Gray
    }
}
catch {
    Write-Host "[ERROR] Failed to stop VideoCompression: $_" -ForegroundColor Red
    exit 1
}

exit 0

