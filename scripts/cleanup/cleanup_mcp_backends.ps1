# MCP Backend Process Cleanup Script
# Kills all running MCP backend processes

Write-Host "=== MCP Backend Process Cleanup ===" -ForegroundColor Cyan

# Find all Python processes running MCP backend
$processes = Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "mcp_backend|pymain.*app=mcp"
}

if ($processes) {
    Write-Host "`nFound $($processes.Count) MCP backend processes:" -ForegroundColor Yellow

    foreach ($proc in $processes) {
        Write-Host "  - PID $($proc.Id): $($proc.ProcessName)" -ForegroundColor Gray
    }

    Write-Host "`nKilling processes..." -ForegroundColor Yellow

    foreach ($proc in $processes) {
        try {
            Stop-Process -Id $proc.Id -Force
            Write-Host "  �?Killed PID $($proc.Id)" -ForegroundColor Green
        } catch {
            Write-Host "  �?Failed to kill PID $($proc.Id): $_" -ForegroundColor Red
        }
    }

    Write-Host "`nCleanup complete!" -ForegroundColor Cyan
} else {
    Write-Host "`nNo MCP backend processes found." -ForegroundColor Green
}

# Check port 58100 status
Write-Host "`n=== Port 58100 Status ===" -ForegroundColor Cyan

$port58100 = Get-NetTCPConnection -LocalPort 58100 -ErrorAction SilentlyContinue

if ($port58100) {
    Write-Host "Port 58100 still in use by PID: $($port58100.OwningProcess)" -ForegroundColor Yellow
    Write-Host "Waiting 3 seconds for cleanup..." -ForegroundColor Gray
    Start-Sleep -Seconds 3

    $port58100_recheck = Get-NetTCPConnection -LocalPort 58100 -ErrorAction SilentlyContinue
    if ($port58100_recheck) {
        Write-Host "Port still occupied. Manual cleanup required." -ForegroundColor Red
        Write-Host "Run: Stop-Process -Id $($port58100_recheck.OwningProcess) -Force" -ForegroundColor Yellow
    } else {
        Write-Host "Port 58100 is now free!" -ForegroundColor Green
    }
} else {
    Write-Host "Port 58100 is free!" -ForegroundColor Green
}

Write-Host "`n=== Ready to Test ===" -ForegroundColor Cyan
Write-Host "Run: python .\pymain.py app=mcp" -ForegroundColor White
