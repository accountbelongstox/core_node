# Check Windows reserved ports (Hyper-V, Windows Container, etc.)
Write-Host "Checking Windows reserved port ranges..." -ForegroundColor Yellow

try {
    # Check TCP reserved ports
    $reservedPorts = netsh interface ipv4 show excludedportrange protocol=tcp

    Write-Host "`nTCP Reserved Port Ranges:" -ForegroundColor Green
    Write-Host $reservedPorts

    # Check if port 58000 is in reserved range
    $port = 58000
    $inReserved = $false

    $reservedPorts -split "`n" | ForEach-Object {
        if ($_ -match '^\s*(\d+)\s+(\d+)') {
            $start = [int]$matches[1]
            $end = [int]$matches[2]
            if ($port -ge $start -and $port -le $end) {
                $inReserved = $true
                Write-Host "`nWARNING: Port $port is in reserved range [$start - $end]" -ForegroundColor Red
            }
        }
    }

    if (-not $inReserved) {
        Write-Host "`nPort $port is NOT in any reserved range" -ForegroundColor Green
    }

    Write-Host "`nNote: If port 58000 is reserved, you can try:" -ForegroundColor Yellow
    Write-Host "  1. Stop Hyper-V: dism.exe /Online /Disable-Feature:Microsoft-Hyper-V" -ForegroundColor Cyan
    Write-Host "  2. Or use a different port (e.g., 3000, 8080)" -ForegroundColor Cyan

} catch {
    Write-Host "Error checking reserved ports: $_" -ForegroundColor Red
}
