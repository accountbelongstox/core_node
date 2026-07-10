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
    Uses GlobalVars PYTHON_EXE_PATH (same as DevInstaller/InstallAllMCPServices) when available; else PATH.

.NOTES
    - Calls: scripts/pytools/special_software_env_manager
    - Python: Prefer $Global:PYTHON_EXE_PATH from win_common/GlobalVars.ps1 (set by Run DevInstaller / Step8_InstallPython.ps1)
#>

#region Variable Declarations
$script:CURRENT_DIR = $PSScriptRoot
$script:WIN_DIR = Split-Path $script:CURRENT_DIR -Parent
$script:SHELLS_DIR = Split-Path $script:WIN_DIR -Parent
$script:SCRIPTS_DIR = Split-Path $script:SHELLS_DIR -Parent
$script:PROJECT_ROOT = Split-Path $script:SCRIPTS_DIR -Parent
$script:WIN_COMMON_DIR = Join-Path $script:WIN_DIR "win_common"
$script:GLOBALVARS_PS1 = Join-Path $script:WIN_COMMON_DIR "GlobalVars.ps1"
$script:PYTOOLS_DIR = Join-Path $script:SCRIPTS_DIR "pytools"
$script:MANAGER_DIR = Join-Path $script:PYTOOLS_DIR "special_software_env_manager"
$script:MAIN_SCRIPT = Join-Path $script:MANAGER_DIR "special_software_env_manager.py"
#endregion

# Load GlobalVars so PYTHON_EXE_PATH is available when script runs standalone (e.g. from shortcut)
if (Test-Path -LiteralPath $script:GLOBALVARS_PS1) {
    . $script:GLOBALVARS_PS1
}

#region Resolve Python executable (same pattern as InstallAllMCPServices / DevInstaller)
function Get-PythonExeForSpecialEnv {
    if ($Global:PYTHON_EXE_PATH -and (Test-Path -LiteralPath $Global:PYTHON_EXE_PATH)) {
        return $Global:PYTHON_EXE_PATH
    }
    if ($Global:PYTHON_DIR -and (Test-Path -LiteralPath $Global:PYTHON_DIR)) {
        $exe = Join-Path $Global:PYTHON_DIR "python.exe"
        if (Test-Path -LiteralPath $exe) { return $exe }
    }
    $cmd = Get-Command python -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $cmd3 = Get-Command python3 -ErrorAction SilentlyContinue
    if ($cmd3) { return $cmd3.Source }
    return $null
}
#endregion

#region Main Execution
Write-Host "Special Software Environment Variables Manager" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting Python implementation..." -ForegroundColor Green
Write-Host "Location: $script:MANAGER_DIR" -ForegroundColor Gray
Write-Host ""

$pythonExe = Get-PythonExeForSpecialEnv
if (-not $pythonExe) {
    Write-Host "ERROR: Python not found." -ForegroundColor Red
    Write-Host "Install via: Installer Menu -> Run DevInstaller (Step8_InstallPython.ps1)." -ForegroundColor Yellow
    Write-Host "Or install Python 3.6+ and add to PATH." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    return
}
Write-Host "Using Python: $pythonExe" -ForegroundColor Gray
Write-Host ""

# Check if the script exists
if (-not (Test-Path $script:MAIN_SCRIPT)) {
    Write-Host "ERROR: Python script not found" -ForegroundColor Red
    Write-Host "Expected location: $script:MAIN_SCRIPT" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    return
}

# Run the Python script
try {
    Set-Location $script:PROJECT_ROOT
    & $pythonExe $script:MAIN_SCRIPT
} catch {
    Write-Host "ERROR: Failed to run Python script" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    return
}
#endregion
