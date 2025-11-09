# Core Node Init - Stop Script
# Stops the Core Node Init MCP Server

$ErrorActionPreference = "Continue"

Write-Host "Stopping Core Node Init MCP Server..." -ForegroundColor Cyan

# Find and kill Python processes running core_node_init
$processes = Get-Process python -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*pyapps.core_node_init*"
}

if ($processes) {
    Write-Host "Found $($processes.Count) running instance(s)" -ForegroundColor Yellow

    foreach ($process in $processes) {
        Write-Host "Stopping process ID: $($process.Id)" -ForegroundColor Gray
        try {
            Stop-Process -Id $process.Id -Force
            Write-Host "Process $($process.Id) stopped" -ForegroundColor Green
        } catch {
            Write-Host "WARNING: Failed to stop process $($process.Id): $_" -ForegroundColor Yellow
        }
    }

    Write-Host "Core Node Init stopped" -ForegroundColor Green
} else {
    Write-Host "No running instances found" -ForegroundColor Yellow
}
