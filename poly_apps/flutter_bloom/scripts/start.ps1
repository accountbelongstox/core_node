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

# CRITICAL: Locate script directory and Flutter Bloom root directory first
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$FLUTTER_BLOOM_ROOT = Split-Path -Parent $SCRIPT_DIR

# Variables declaration
$BUILD_SCRIPTS_DIR = Join-Path $SCRIPT_DIR "build_scripts"
$WIN_COMMON_DIR = Join-Path $SCRIPT_DIR "win_common"
$MAIN_PY = Join-Path $BUILD_SCRIPTS_DIR "main.py"
$DESIGN_TOOL_DIR = Join-Path $SCRIPT_DIR "flutter_dev_tools"
$DESIGN_TOOL_PY = Join-Path $DESIGN_TOOL_DIR "design_doc_tool.py"
$TEMP_BAT_DIR = Join-Path $env:TEMP "flutter_bloom_launcher"

# Save current directory and switch to Flutter Bloom root
$ORIGINAL_DIR = Get-Location
Set-Location $FLUTTER_BLOOM_ROOT

Write-Host "[DEBUG] Script directory: $SCRIPT_DIR" -ForegroundColor Magenta
Write-Host "[DEBUG] Flutter Bloom root: $FLUTTER_BLOOM_ROOT" -ForegroundColor Magenta
Write-Host "[DEBUG] Current working directory: $(Get-Location)" -ForegroundColor Magenta

# Import only necessary common functions (using absolute paths)
$globalVarPath = Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1"
$commonUtilPath = Join-Path $WIN_COMMON_DIR "CommonUtilities.ps1"
$logManagerPath = Join-Path $WIN_COMMON_DIR "FlutterLogManager.ps1"
$bcommonPath = Join-Path $WIN_COMMON_DIR "BCommon.ps1"

if (-not (Test-Path $globalVarPath)) { Write-Host "[ERROR] Missing: $globalVarPath" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $commonUtilPath)) { Write-Host "[ERROR] Missing: $commonUtilPath" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $logManagerPath)) { Write-Host "[ERROR] Missing: $logManagerPath" -ForegroundColor Red; exit 1 }
if (-not (Test-Path $bcommonPath)) { Write-Host "[ERROR] Missing: $bcommonPath" -ForegroundColor Red; exit 1 }

. $globalVarPath
. $commonUtilPath
. $logManagerPath
. $bcommonPath  # For other common functions

# Function: Launch Design Documentation Tool
function Invoke-DesignTool {
    Write-Host ""
    Write-Host "[INFO] Launching Design Documentation Tool..." -ForegroundColor Green

    # Get design tool state
    $designToolState = Get-FileVariable -Name "DESIGN_TOOL_STATE_ACTION" -DefaultValue "Launch"
    Write-Host "[INFO] Action: $designToolState" -ForegroundColor Cyan

    # Validate design tool exists
    if (-not (Test-Path $DESIGN_TOOL_PY)) {
        Write-Host "[ERROR] Design tool not found: $DESIGN_TOOL_PY" -ForegroundColor Red
        return
    }

    # Ensure temp directory exists
    if (-not (Test-Path $TEMP_BAT_DIR)) {
        New-Item -Path $TEMP_BAT_DIR -ItemType Directory -Force | Out-Null
    }

    # Use fixed bat file name (overwrites previous)
    $batFile = Join-Path $TEMP_BAT_DIR "design_tool.bat"

    # Create bat file content
    $batContent = @"
@echo off
title Flutter Design Documentation Tool [$designToolState]
echo ========================================
echo Flutter Design Documentation Tool
echo Action: $designToolState
echo ========================================
echo.
echo Starting web server on http://127.0.0.1:5757
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d "$DESIGN_TOOL_DIR"
python "$DESIGN_TOOL_PY"

pause
"@

    # Write bat file
    $batContent | Out-File -FilePath $batFile -Encoding ASCII -Force

    Write-Host "[INFO] Generated launcher: $batFile" -ForegroundColor Yellow
    Write-Host "[INFO] Opening design tool..." -ForegroundColor Yellow

    # Launch bat file in new window
    Start-Process -FilePath $batFile

    # Wait a moment then open browser
    Start-Sleep -Seconds 2
    Start-Process "http://127.0.0.1:5757"

    Write-Host "[SUCCESS] Design tool launched successfully" -ForegroundColor Green
    Write-Host "[INFO] Server URL: http://127.0.0.1:5757" -ForegroundColor Cyan
    Write-Host "[INFO] The design tool is running in a separate window" -ForegroundColor Cyan
    Write-Host ""
}

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

    Write-Host "[DEBUG] Python script exit code: $LASTEXITCODE" -ForegroundColor Magenta

    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "[ERROR] App selection failed"
        exit 1
    }

    Write-Host "[DEBUG] Python script completed successfully, continuing to PowerShell execution..." -ForegroundColor Magenta

    # Handle mode selection and execution
    $initialWorkingDir = Get-Location
    try {
        # Read action to determine mode
        $selectedAction = Get-FileVariable -Name $Global:KEY_SELECTED_ACTION -DefaultValue ""

        Write-Host "[DEBUG] Selected action from Python: '$selectedAction'" -ForegroundColor Magenta

        if (-not $selectedAction) {
            Write-ErrorMsg "[ERROR] No action selected from Python"
            exit 1
        }

        # Route based on action
        Write-Host "[DEBUG] Routing to appropriate mode..." -ForegroundColor Magenta
        if ($selectedAction.ToLower() -eq "debug") {
            Write-Host "[DEBUG] Calling Invoke-DebugMode" -ForegroundColor Magenta
            Invoke-DebugMode
        }
        elseif ($selectedAction.ToLower() -eq "build" -or $selectedAction.ToLower() -eq "release") {
            Write-Host "[DEBUG] Calling Invoke-BuildMode" -ForegroundColor Magenta
            Invoke-BuildMode
        }
        elseif ($selectedAction.ToLower() -eq "design_tool") {
            Write-Host "[DEBUG] Calling Invoke-DesignTool" -ForegroundColor Magenta
            Invoke-DesignTool
        }
        else {
            Write-ErrorMsg "[ERROR] Unknown action: $selectedAction"
            exit 1
        }

        Write-Success "[SUCCESS] Flutter Bloom completed"
    }
    finally {
        Set-Location $initialWorkingDir
        Write-Host "[DEBUG] Restored to initial working directory: $(Get-Location)" -ForegroundColor Magenta
    }

} catch {
    Write-Host "[ERROR] Flutter Bloom startup failed: $_" -ForegroundColor Red
    Set-Location $ORIGINAL_DIR
    exit 1
} finally {
    # Ensure we always restore original directory
    if ($ORIGINAL_DIR) {
        Set-Location $ORIGINAL_DIR
        Write-Host "[DEBUG] Final directory restore: $(Get-Location)" -ForegroundColor Magenta
    }
}