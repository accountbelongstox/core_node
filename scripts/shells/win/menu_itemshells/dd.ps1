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

<#
.SYNOPSIS
    Set Special Software Environment Variables (Python Implementation)

.DESCRIPTION
    Launcher for the Python-based Special Software Environment Manager.
    This replaces the original PowerShell-only SpecialSoftwareEnvManager.ps1
    with a cross-platform Python implementation.

.NOTES
    - Calls: scripts/pytools/special_software_env_manager
    - Platform: Windows (PowerShell)
    - Target: Python implementation
#>

#region Variable Declarations
$script:CURRENT_DIR = $PSScriptRoot
$script:SHELLS_DIR = Split-Path $script:CURRENT_DIR -Parent
$script:SCRIPTS_DIR = Split-Path $script:SHELLS_DIR -Parent
$script:PROJECT_ROOT = Split-Path $script:SCRIPTS_DIR -Parent
$script:PYTOOLS_DIR = Join-Path $script:SCRIPTS_DIR "pytools"
$script:MANAGER_DIR = Join-Path $script:PYTOOLS_DIR "special_software_env_manager"
$script:MAIN_SCRIPT = Join-Path $script:MANAGER_DIR "main.py"
#endregion

#region Main Execution
Write-Host "Special Software Environment Variables Manager" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting Python implementation..." -ForegroundColor Green
Write-Host "Location: $script:MANAGER_DIR" -ForegroundColor Gray
Write-Host ""

# Check if Python is available
$pythonCommand = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCommand = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCommand = "python3"
} else {
    Write-Host "ERROR: Python not found" -ForegroundColor Red
    Write-Host "Please install Python 3.6 or higher" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check if the script exists
if (-not (Test-Path $script:MAIN_SCRIPT)) {
    Write-Host "ERROR: Python script not found" -ForegroundColor Red
    Write-Host "Expected location: $script:MAIN_SCRIPT" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Run the Python script
try {
    Set-Location $script:PROJECT_ROOT
    & $pythonCommand $script:MAIN_SCRIPT
} catch {
    Write-Host "ERROR: Failed to run Python script" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}
#endregion
