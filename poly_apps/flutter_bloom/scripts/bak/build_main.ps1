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

# Variables declaration
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$USER_CACHE_DIR = Join-Path $env:USERPROFILE ".core_node\.flutter_build\.cache\copy_flag_dir"
$WIN_COMMON_DIR = Join-Path (Split-Path -Parent $SCRIPT_DIR) "win_common"
$FLUTTER_GLOBAL_VAR_SCRIPT = Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1"
$COMMON_UTILITIES_SCRIPT = Join-Path $WIN_COMMON_DIR "CommonUtilities.ps1"

# Import FlutterGlobalVar functions
. $FLUTTER_GLOBAL_VAR_SCRIPT

# Use constant for temp build dir file name
$TEMP_DIR_FILE = Join-Path $USER_CACHE_DIR $Global:TEMP_BUILD_DIR_FILE

# Import CommonUtilities functions
. $COMMON_UTILITIES_SCRIPT

# Pre-flight check: Ensure Python environment is ready
function Initialize-BuildEnvironment {
    <#
    .SYNOPSIS
    Initialize build environment by checking Python packages and other prerequisites

    .RETURNS
    Boolean indicating whether environment is ready for build
    #>

    Write-Host "[BUILD-PREFLIGHT] Initializing build environment..." -ForegroundColor Magenta

    # Check and setup Python environment
    $pythonReady = Assert-PythonEnvironment -AutoFix

    if (-not $pythonReady) {
        Write-Host "[BUILD-ERROR] Python environment setup failed" -ForegroundColor Red
        Write-Host "[BUILD-ERROR] Please resolve Python package issues before continuing" -ForegroundColor Red
        return $false
    }

    Write-Host "[BUILD-PREFLIGHT] Environment initialization completed successfully" -ForegroundColor Green
    return $true
}

# Initialize build environment before proceeding
if (-not (Initialize-BuildEnvironment)) {
    Write-Host "[BUILD-FAILED] Build environment initialization failed, aborting build process" -ForegroundColor Red
    exit 1
}

Write-Host "[BUILD-MAIN] Flutter Bloom Build System" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "[BUILD-DEBUG] PowerShell script path: $($MyInvocation.MyCommand.Path)" -ForegroundColor Cyan
Write-Host "[BUILD-DEBUG] PowerShell working directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host "[BUILD-DEBUG] Flutter temp directory: $($Global:FTEMP_FLUTTER_DIR)" -ForegroundColor Cyan

# Check if we're already in a temporary/compile directory
$currentDir = Get-Location
$isInCompileDirectory = $currentDir.Path.Contains(".build_dir") -and $currentDir.Path.Contains("compile_factory")

if ($isInCompileDirectory) {
    Write-Host "[BUILD-INFO] Already in compile directory, skipping phase 1..." -ForegroundColor Yellow
    Write-Host "[BUILD-INFO] Current directory: $($currentDir.Path)" -ForegroundColor White
    Write-Host ""

    # Show compilation menu using CommonUtilities function
    $selectedOption = Show-CompilationMenu

    if ($null -eq $selectedOption) {
        Write-Host "[BUILD-CANCELLED] Build cancelled by user" -ForegroundColor Red
        exit 0
    }

    # Store selected option in file variables for Python to access
    Set-FileVariable -Name $Global:KEY_SELECTED_COMPILATION_OPTION -Value $selectedOption.Value
    Set-FileVariable -Name $Global:KEY_BUILD_PHASE -Value "compilation"

    Write-Host ""
    Write-Host "[BUILD-INFO] Selected: $($selectedOption.Name)" -ForegroundColor Green
    Write-Host "[BUILD-INFO] Starting compilation process..." -ForegroundColor Cyan

    # Execute Python main.py for asset scanning and compilation
    $mainPyScript = Join-Path $currentDir.Path "scripts\build_scripts\main.py"
    if (Test-Path $mainPyScript) {
        Write-Host "[BUILD-INFO] Executing Python asset scanner from temp directory..." -ForegroundColor Cyan
        & python $mainPyScript

        if ($LASTEXITCODE -ne 0) {
            Write-Host "[BUILD-ERROR] Python asset scanner failed with exit code: $LASTEXITCODE" -ForegroundColor Red
            exit $LASTEXITCODE
        }
    } else {
        Write-Host "[BUILD-WARNING] main.py not found in temp directory: $mainPyScript" -ForegroundColor Yellow
    }

    Write-Host "[BUILD-SUCCESS] Build system completed from compile directory" -ForegroundColor Green
    exit 0
}

# Phase 1: Normal directory - execute project copy
Write-Host "[BUILD-PHASE] Phase 1 - Project Copy" -ForegroundColor Green
$mainPyScript = Join-Path $SCRIPT_DIR "main.py"
if (-not (Test-Path $mainPyScript)) {
    Write-Host "[BUILD-ERROR] main.py not found: $mainPyScript" -ForegroundColor Red
    exit 1
}

# Debug: List all file variables before calling Python
Write-Host "[BUILD-DEBUG] Listing all file variables from: $($Global:FTEMP_FLUTTER_DIR)" -ForegroundColor Cyan
if (Test-Path $Global:FTEMP_FLUTTER_DIR) {
    Get-ChildItem -Path $Global:FTEMP_FLUTTER_DIR -File | ForEach-Object {
        $content = Get-Content -Path $_.FullName -Raw
        $content = $content.Trim()
        Write-Host "[BUILD-DEBUG]   $($_.Name): '$content'" -ForegroundColor Cyan
    }
} else {
    Write-Host "[BUILD-DEBUG] Temp directory does not exist: $($Global:FTEMP_FLUTTER_DIR)" -ForegroundColor Yellow
}

Write-Host "[BUILD-INFO] Executing Python build system for project copy..." -ForegroundColor Cyan
& python $mainPyScript

if ($LASTEXITCODE -ne 0) {
    Write-Host "[BUILD-ERROR] Python build system failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Check if temp directory info was created (indicates project was copied)
if (Test-Path $TEMP_DIR_FILE) {
    $TEMP_BUILD_DIR = Get-Content $TEMP_DIR_FILE -Raw
    $TEMP_BUILD_DIR = $TEMP_BUILD_DIR.Trim()

    Write-Host "[BUILD-INFO] Project copied to temporary directory: $TEMP_BUILD_DIR" -ForegroundColor Yellow

    # Prompt for compilation confirmation
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "COMPILATION CONFIRMATION" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Temporary directory: $TEMP_BUILD_DIR" -ForegroundColor White
    Write-Host ""
    Write-Host "Press ENTER or any key to continue, N to cancel" -ForegroundColor Yellow -NoNewline
    $confirmation = Read-Host " "

    if ($confirmation -eq "N" -or $confirmation -eq "n") {
        Write-Host "[BUILD-CANCELLED] Compilation cancelled by user" -ForegroundColor Red
        Remove-Item $TEMP_DIR_FILE -Force -ErrorAction SilentlyContinue
        exit 0
    }

    Write-Host "[BUILD-INFO] Proceeding with compilation..." -ForegroundColor Green
    Write-Host "[BUILD-INFO] Switching to temporary directory for continued build..." -ForegroundColor Cyan

    # Change to temporary directory
    Set-Location $TEMP_BUILD_DIR
    Write-Host "[BUILD-INFO] Working directory changed to: $(Get-Location)" -ForegroundColor Green

    # Clean up temp file
    Remove-Item $TEMP_DIR_FILE -Force -ErrorAction SilentlyContinue

    # Execute build_main.ps1 from temporary directory (this will trigger phase 2)
    $tempBuildMainScript = Join-Path $TEMP_BUILD_DIR "scripts\build_scripts\build_main.ps1"
    if (Test-Path $tempBuildMainScript) {
        Write-Host "[BUILD-INFO] Re-executing build_main.ps1 from temporary directory..." -ForegroundColor Cyan
        & powershell -ExecutionPolicy Bypass -File $tempBuildMainScript

        if ($LASTEXITCODE -ne 0) {
            Write-Host "[BUILD-ERROR] Second phase build failed with exit code: $LASTEXITCODE" -ForegroundColor Red
            exit $LASTEXITCODE
        }
    } else {
        Write-Host "[BUILD-WARNING] build_main.ps1 not found in temp directory, using fallback..." -ForegroundColor Yellow

        # Fallback to original approach
        $tempMainPyScript = Join-Path $TEMP_BUILD_DIR "scripts\build_scripts\main.py"
        if (Test-Path $tempMainPyScript) {
            & python $tempMainPyScript
        } else {
            Write-Host "[BUILD-WARNING] main.py not found in temp directory, using original..." -ForegroundColor Yellow
            & python (Join-Path $SCRIPT_DIR "main.py")
        }
    }

    Write-Host "[BUILD-SUCCESS] Build system completed from temporary directory" -ForegroundColor Green
} else {
    Write-Host "[BUILD-INFO] Build system completed (no directory switching required)" -ForegroundColor Green
}
