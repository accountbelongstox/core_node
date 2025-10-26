# Quick Test - Test Claude Extension Capture
# This script tests if the input capture is working

Write-Host "========================================"
Write-Host "  Testing Claude Extension" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""

$extDir = Join-Path $PSScriptRoot ".."
$inputLogsDir = Join-Path $extDir "claude-ext\input-logs"

Write-Host "Extension directory: $extDir" -ForegroundColor Gray
Write-Host "Logs directory: $inputLogsDir" -ForegroundColor Gray
Write-Host ""

# Check if logs directory exists
if (Test-Path $inputLogsDir) {
    Write-Host "[OK] Logs directory exists" -ForegroundColor Green

    # List existing log files
    $logFiles = Get-ChildItem -Path $inputLogsDir -Filter "input-*.log" -ErrorAction SilentlyContinue

    if ($logFiles.Count -gt 0) {
        Write-Host "[OK] Found $($logFiles.Count) log file(s)" -ForegroundColor Green
        Write-Host ""
        Write-Host "Recent logs:" -ForegroundColor Cyan

        $logFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | ForEach-Object {
            $size = [math]::Round($_.Length / 1KB, 2)
            Write-Host "  - $($_.Name) (${size} KB, modified: $($_.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')))" -ForegroundColor Yellow
        }

        Write-Host ""
        Write-Host "To view the latest log:" -ForegroundColor Cyan
        $latestLog = $logFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        Write-Host "  cat `"$($latestLog.FullName)`"" -ForegroundColor Yellow
    } else {
        Write-Host "[INFO] No log files found yet" -ForegroundColor Yellow
        Write-Host "  Run 'claudeMore' to start capturing input" -ForegroundColor Gray
    }
} else {
    Write-Host "[INFO] Logs directory will be created on first run" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================"
Write-Host "  Test Instructions" -ForegroundColor Cyan
Write-Host "========================================"
Write-Host ""
Write-Host "1. Run:" -ForegroundColor Cyan
Write-Host "   claudeMore" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Type something in the Claude prompt" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Press Enter to submit" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Check the log file in:" -ForegroundColor Cyan
Write-Host "   $inputLogsDir" -ForegroundColor Yellow
Write-Host ""
Write-Host "You should see:" -ForegroundColor Cyan
Write-Host "  - CHANGE events (as you type)" -ForegroundColor Gray
Write-Host "  - SUBMIT events (when you press Enter)" -ForegroundColor Gray
Write-Host ""
