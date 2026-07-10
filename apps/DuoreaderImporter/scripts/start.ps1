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

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent (Split-Path -Parent $APP_DIR)

Write-Host "[INFO] Starting NCore application: DuoreaderImporter" -ForegroundColor Green

$START_OK = $false
try {
    Set-Location $PROJECT_ROOT
    if (-not (Test-Path "main.js")) {
        Write-Host "[FAIL] main.js not found in project root" -ForegroundColor Red
    } else {
        Write-Host "[INFO] Executing: node ./main.js app=DuoreaderImporter" -ForegroundColor Cyan
        node ./main.js app=DuoreaderImporter
        $START_OK = $true
    }
} catch {
    Write-Host "[FAIL] Failed to start DuoreaderImporter: $_" -ForegroundColor Red
}

if (-not $START_OK) {
    exit 1
}
