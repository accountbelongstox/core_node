# MCP Server Stop Script
# Stop running mcpserver processes

Write-Host "Stopping MCP Server..." -ForegroundColor Yellow

# Find and stop Python processes running mcpserver
$processes = Get-Process -Name python -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*mcpserver*" }

if ($processes) {
    Write-Host "Found $($processes.Count) mcpserver process(es)" -ForegroundColor Cyan

    foreach ($process in $processes) {
        Write-Host "Stopping process $($process.Id)..." -ForegroundColor Yellow
        Stop-Process -Id $process.Id -Force
    }

    Write-Host "MCP Server stopped successfully" -ForegroundColor Green
} else {
    Write-Host "No running mcpserver processes found" -ForegroundColor Yellow
}

# Also check for processes on specific ports (19997, 8767)
$ports = @(19997, 8767)

foreach ($port in $ports) {
    Write-Host "Checking port $port..." -ForegroundColor Cyan

    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

    if ($connections) {
        foreach ($conn in $connections) {
            $processId = $conn.OwningProcess
            $processName = (Get-Process -Id $processId -ErrorAction SilentlyContinue).ProcessName

            Write-Host "Stopping process $processName (PID: $processId) on port $port" -ForegroundColor Yellow
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host "Cleanup completed" -ForegroundColor Green
