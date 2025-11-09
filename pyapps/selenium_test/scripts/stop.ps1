#!/usr/bin/env pwsh
# Selenium Test Application - Stop Script
# Description: Stops running selenium test processes

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Stopping Selenium Test Application" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Find Python processes running selenium_test
$Processes = Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*selenium_test*"
}

if ($Processes) {
    Write-Host "[INFO] Found $($Processes.Count) selenium_test process(es)" -ForegroundColor Yellow

    foreach ($Process in $Processes) {
        Write-Host "[INFO] Stopping process ID: $($Process.Id)" -ForegroundColor Yellow
        try {
            Stop-Process -Id $Process.Id -Force
            Write-Host "[OK] Process $($Process.Id) stopped" -ForegroundColor Green
        } catch {
            Write-Host "[ERROR] Failed to stop process $($Process.Id): $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "[INFO] No selenium_test processes found" -ForegroundColor Yellow
}

# Also stop any orphaned ChromeDriver processes
Write-Host ""
Write-Host "[INFO] Checking for orphaned browser drivers..." -ForegroundColor Yellow

$DriverProcesses = Get-Process -Name chromedriver, geckodriver, msedgedriver -ErrorAction SilentlyContinue

if ($DriverProcesses) {
    Write-Host "[INFO] Found $($DriverProcesses.Count) driver process(es)" -ForegroundColor Yellow

    foreach ($Driver in $DriverProcesses) {
        Write-Host "[INFO] Stopping driver: $($Driver.Name) (PID: $($Driver.Id))" -ForegroundColor Yellow
        try {
            Stop-Process -Id $Driver.Id -Force
            Write-Host "[OK] Driver stopped" -ForegroundColor Green
        } catch {
            Write-Host "[WARNING] Could not stop driver: $_" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "[OK] No orphaned drivers found" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Cleanup Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
