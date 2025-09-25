# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# VoiceClientAndCaddy NCore App Stop Script
# Complexity: Complex - Advanced process management and cleanup
# Hardcoded stop script for VoiceClientAndCaddy application
# Entry Point: stop.bat (Windows) / stop.sh (Linux)

Write-Host "[INFO] Stopping NCore application: VoiceClientAndCaddy" -ForegroundColor Yellow

try {
    # Stop processes matching the VoiceClientAndCaddy app
    $processes = Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.CommandLine -like "*app=VoiceClientAndCaddy*" }

    if ($processes) {
        foreach ($process in $processes) {
            Write-Host "[INFO] Stopping process PID: $($process.Id)" -ForegroundColor Cyan
            Stop-Process -Id $process.Id -Force
        }
        Write-Host "[SUCCESS] VoiceClientAndCaddy stopped successfully" -ForegroundColor Green
    } else {
        Write-Host "[INFO] No running processes found for VoiceClientAndCaddy" -ForegroundColor Gray
    }
}
catch {
    Write-Host "[ERROR] Failed to stop VoiceClientAndCaddy: $_" -ForegroundColor Red
    exit 1
}

exit 0

