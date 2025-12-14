# ============================================
# Entry Point Script (Windows)
# Minimal entry script that delegates to Python controller
# and Windows command executor
# ============================================

param(
    [string]$ScriptDir = $PSScriptRoot,
    [string]$Action = $null
)

$ErrorActionPreference = "Stop"

# ============================================
# VARIABLE DECLARATIONS
# ============================================

$ProjectRoot = Split-Path -Parent $ScriptDir
$BuildScriptsPath = Join-Path $ScriptDir "build_scripts"
$MainController = Join-Path $BuildScriptsPath "main_controller.py"
$WindowsExecutor = Join-Path $BuildScriptsPath "execute_commands_windows.ps1"

# ============================================
# UTILITY FUNCTIONS
# ============================================

function Write-ColorText {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host $Title -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================
# MAIN EXECUTION
# ============================================

Write-Header "Build System Entry Point (Windows)"

# Verify Python controller exists
if (-not (Test-Path $MainController)) {
    Write-ColorText "[ERROR] Python controller not found: $MainController" "Red"
    exit 1
}

# Verify Windows executor exists
if (-not (Test-Path $WindowsExecutor)) {
    Write-ColorText "[ERROR] Windows executor not found: $WindowsExecutor" "Red"
    exit 1
}

Write-ColorText "[Entry] Project Root: $ProjectRoot" "Cyan"
Write-ColorText "[Entry] Scripts Path: $BuildScriptsPath" "Cyan"
Write-Host ""

# Step 1: Run Python controller
Write-ColorText "[Step 1/2] Running Python controller..." "Yellow"
Write-Host ""

if ($Action) {
    & python "$MainController" "$ProjectRoot" "$Action"
} else {
    & python "$MainController" "$ProjectRoot"
}

$pythonExitCode = $LASTEXITCODE

if ($pythonExitCode -ne 0) {
    Write-Host ""
    Write-ColorText "[ERROR] Python controller failed with exit code: $pythonExitCode" "Red"
    exit $pythonExitCode
}

Write-Host ""
Write-ColorText "[Entry] Python controller completed successfully" "Green"
Write-Host ""

# Step 2: Run Windows command executor
Write-ColorText "[Step 2/2] Running Windows command executor..." "Yellow"
Write-Host ""

& powershell -ExecutionPolicy Bypass -File "$WindowsExecutor" -ProjectRoot "$ProjectRoot"

$shellExitCode = $LASTEXITCODE

if ($shellExitCode -ne 0) {
    Write-Host ""
    Write-ColorText "[ERROR] Command executor failed with exit code: $shellExitCode" "Red"
    exit $shellExitCode
}

Write-Host ""
Write-Header "Build System Complete"
Write-ColorText "[Success] All operations completed successfully" "Green"
