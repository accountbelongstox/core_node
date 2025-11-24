# Kill all node.exe processes
Write-Host "Searching for node.exe processes..."

$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue

if ($nodeProcesses) {
    Write-Host "Found $($nodeProcesses.Count) node.exe process(es):"
    $nodeProcesses | ForEach-Object {
        Write-Host "  PID: $($_.Id), Memory: $([math]::Round($_.WorkingSet64/1MB, 2)) MB"
    }

    $response = Read-Host "Do you want to kill all node.exe processes? (Y/N)"
    if ($response -eq 'Y' -or $response -eq 'y') {
        Stop-Process -Name node -Force
        Write-Host "All node.exe processes killed"
    }
} else {
    Write-Host "No node.exe processes found"
}
