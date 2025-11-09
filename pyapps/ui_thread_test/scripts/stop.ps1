#!/usr/bin/env pwsh
# Stop UI Thread Test Application

Write-Host "================================================" -ForegroundColor Cyan
Write-Host " Stopping UI Thread Test Application" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Find and stop Python processes running this application
$processName = "python"
$appModule = "pyapps.ui_thread_test.main"

Write-Host "Searching for running application processes..." -ForegroundColor Yellow

$processes = Get-Process -Name $processName -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*$appModule*" }

if ($processes) {
    Write-Host "Found $($processes.Count) running process(es)" -ForegroundColor Yellow

    foreach ($process in $processes) {
        Write-Host "Stopping process ID: $($process.Id)" -ForegroundColor Yellow
        try {
            Stop-Process -Id $process.Id -Force
            Write-Host "Process $($process.Id) stopped" -ForegroundColor Green
        } catch {
            Write-Host "Failed to stop process $($process.Id)" -ForegroundColor Red
        }
    }

    Write-Host ""
    Write-Host "Application stopped" -ForegroundColor Green
} else {
    Write-Host "No running application processes found" -ForegroundColor Yellow
}

Write-Host ""
