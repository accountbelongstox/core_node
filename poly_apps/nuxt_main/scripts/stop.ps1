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

# Nuxt Main Stop Script
# Stops nuxt_main application processes

Write-Host "[INFO] Stopping Nuxt Main application processes" -ForegroundColor Yellow

try {
    # Stop yarn dev processes
    $processes = Get-Process | Where-Object { $_.ProcessName -eq "node" -and $_.CommandLine -like "*yarn*dev*" }
    
    if ($processes) {
        foreach ($process in $processes) {
            Write-Host "[INFO] Stopping process PID: $($process.Id)" -ForegroundColor Cyan
            Stop-Process -Id $process.Id -Force
        }
        Write-Host "[SUCCESS] Nuxt Main processes stopped successfully" -ForegroundColor Green
    } else {
        Write-Host "[INFO] No running Nuxt Main processes found" -ForegroundColor Gray
    }
}
catch {
    Write-Host "[ERROR] Failed to stop Nuxt Main processes: $_" -ForegroundColor Red
    exit 1
}
