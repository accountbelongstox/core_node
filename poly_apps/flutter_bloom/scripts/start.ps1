# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Flutter Bloom Start Script - Entry Point
# Main script that handles the application flow

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$BUILD_SCRIPTS_DIR = Join-Path $SCRIPT_DIR "build_scripts"
$WIN_COMMON_DIR = Join-Path $SCRIPT_DIR "win_common"
$MAIN_PY = Join-Path $BUILD_SCRIPTS_DIR "main.py"

# Import only necessary common functions
. (Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1")
. (Join-Path $WIN_COMMON_DIR "CommonUtilities.ps1")
. (Join-Path $WIN_COMMON_DIR "FlutterLogManager.ps1")
. (Join-Path $WIN_COMMON_DIR "BCommon.ps1")  # For other common functions

try {
    Write-Host "Flutter Bloom Launcher" -ForegroundColor Cyan
    Write-Host "=====================" -ForegroundColor Cyan

    # Validate Python script exists
    if (-not (Test-Path $MAIN_PY)) {
        Write-ErrorMsg "[ERROR] Python main script not found: $MAIN_PY"
        exit 1
    }

    # Execute Python app selection
    Write-Host "[INFO] Starting app selection..." -ForegroundColor Yellow
    Write-Host "[DEBUG] Python script path: $MAIN_PY" -ForegroundColor Magenta
    Write-Host "[DEBUG] Current working directory: $(Get-Location)" -ForegroundColor Magenta

    # Get Python script directory and name (for debug display)
    $pythonScriptDir = Split-Path -Parent $MAIN_PY
    $pythonScriptName = Split-Path -Leaf $MAIN_PY

    Write-Host "[DEBUG] Python script directory: $pythonScriptDir" -ForegroundColor Magenta
    Write-Host "[DEBUG] Python script name: $pythonScriptName" -ForegroundColor Magenta
    Write-Host "[DEBUG] Executing command: python $MAIN_PY" -ForegroundColor Magenta

    & python $MAIN_PY

    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "[ERROR] App selection failed"
        exit 1
    }

    # Handle debug script selection and execution
    $initialWorkingDir = Get-Location
    try {
        Invoke-DebugScriptSelection
        Write-Success "[SUCCESS] Flutter Bloom completed"
    }
    finally {
        Set-Location $initialWorkingDir
        Write-Host "[DEBUG] Restored to initial working directory: $(Get-Location)" -ForegroundColor Magenta
    }

} catch {
    Write-Host "[ERROR] Flutter Bloom startup failed: $_" -ForegroundColor Red
    exit 1
}