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

# Script Index for logging
$SCRIPT_INDEX = "Step84"

# Resolve absolute paths for script dependencies
$scriptRoot = $PSScriptRoot
$parentPath = Split-Path -Parent $scriptRoot
$winCommonPath = Join-Path $parentPath "win_common"
$globalVarsPath = Join-Path $winCommonPath "GlobalVars.ps1"
$CommonFuncPath = Join-Path $winCommonPath "CommonFunc.ps1"
$windowsPathFuncPath = Join-Path $winCommonPath "WindowsPathFunction.ps1"

# Import required modules
. $globalVarsPath
. $CommonFuncPath
. $windowsPathFuncPath

# All variable declarations
$cmakeWingetId = ""
$ninjaWingetId = ""
$pythonWingetId = ""
$cmakeExePath = ""
$ninjaExePath = ""
$pythonExePath = ""
$selectedRegion = ""
$installType = ""
$cmakeInstalled = $false
$ninjaInstalled = $false
$pythonInstalled = $false
$vs2022BatPath = ""
$vs2022Installed = $false

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Qt Build Tools Installation" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] This script installs essential build tools for Qt compilation:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]   - CMake (Build system generator)" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Ninja (Fast build system)" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Python 3 (Required by Qt build system)" -ForegroundColor Gray
Write-Host ""

# Get region and installation type from global variables
$selectedRegion = Get-GlobalVar -key "SELECTED_REGION" -defaultValue "Global"
$installType = Get-GlobalVar -key "INSTALL_TYPE" -defaultValue "full"

Write-Host "  [$SCRIPT_INDEX] Configuration:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]   - Region: $selectedRegion" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Install Type: $installType" -ForegroundColor Gray
Write-Host ""

# Define winget package IDs
$cmakeWingetId = "Kitware.CMake"
$ninjaWingetId = "Ninja-build.Ninja"

# Python paths from GlobalVars (Anaconda Python)
$pythonExePathGlobal = $Global:PYTHON_EXE_PATH
$condaExePathGlobal = $Global:CONDA_EXE_PATH

# Check Visual Studio 2022 installation
Write-Host "  [$SCRIPT_INDEX] Checking Visual Studio 2022 prerequisites..." -ForegroundColor Cyan
$vs2022BatPath = "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"

if (Test-Path $vs2022BatPath) {
    $vs2022Installed = $true
    Write-Host "  [$SCRIPT_INDEX]   [OK] Visual Studio 2022 found" -ForegroundColor Green
}
else {
    Write-Host "  [$SCRIPT_INDEX]   [!] Visual Studio 2022 not found at expected location" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX]   Searching for Visual Studio installation..." -ForegroundColor Cyan

    $vs2022Path = "C:\Program Files\Microsoft Visual Studio\2022"
    if (Test-Path $vs2022Path) {
        $foundVcVars = Get-ChildItem -Path $vs2022Path -Recurse -Filter "vcvarsall.bat" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($foundVcVars) {
            $vs2022Installed = $true
            Write-Host "  [$SCRIPT_INDEX]   [OK] Visual Studio 2022 found at: $($foundVcVars.DirectoryName)" -ForegroundColor Green
        }
    }

    if (-not $vs2022Installed) {
        Write-Host "  [$SCRIPT_INDEX]   [X] Visual Studio 2022 NOT found" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX]   WARNING: Visual Studio 2022 with C++ Desktop Development is required for Qt compilation" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX]   Please run Step83_InstallVisualStudio.ps1 first" -ForegroundColor Yellow
        Write-Host ""

        $userContinue = Read-Host "  [$SCRIPT_INDEX] Continue anyway? (Y/N)"
        if ($userContinue -ne "Y" -and $userContinue -ne "y") {
            Write-Host "  [$SCRIPT_INDEX] Installation cancelled by user" -ForegroundColor Yellow
            Write-Host ""
            exit 0
        }
    }
}
Write-Host ""

# Check and install CMake
Write-Host "  [$SCRIPT_INDEX] ================================================" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Installing CMake" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] ================================================" -ForegroundColor Cyan

$cmakeExePath = Get-Command cmake -ErrorAction SilentlyContinue
if ($cmakeExePath) {
    $cmakeVersion = & cmake --version 2>&1 | Select-Object -First 1
    Write-Host "  [$SCRIPT_INDEX] CMake is already installed: $cmakeVersion" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] Path: $($cmakeExePath.Source)" -ForegroundColor Gray
    $cmakeInstalled = $true
}
else {
    Write-Host "  [$SCRIPT_INDEX] CMake not found, installing via winget..." -ForegroundColor Yellow

    $cmakeInstallProcess = Start-Process -FilePath "winget" -ArgumentList "install --id $cmakeWingetId --silent --accept-package-agreements --accept-source-agreements" -Wait -NoNewWindow -PassThru

    if ($cmakeInstallProcess.ExitCode -eq 0) {
        Write-Host "  [$SCRIPT_INDEX] CMake installed successfully" -ForegroundColor Green
        $cmakeInstalled = $true

        # Verify installation
        $cmakeExePath = Get-Command cmake -ErrorAction SilentlyContinue
        if ($cmakeExePath) {
            $cmakeVersion = & cmake --version 2>&1 | Select-Object -First 1
            Write-Host "  [$SCRIPT_INDEX] CMake version: $cmakeVersion" -ForegroundColor Green
        }
        else {
            Write-Host "  [$SCRIPT_INDEX] WARNING: CMake installed but not found in PATH" -ForegroundColor Yellow
            Write-Host "  [$SCRIPT_INDEX] You may need to restart your terminal" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Failed to install CMake (Exit Code: $($cmakeInstallProcess.ExitCode))" -ForegroundColor Red
        $cmakeInstalled = $false
    }
}
Write-Host ""

# Check and install Ninja
Write-Host "  [$SCRIPT_INDEX] ================================================" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Installing Ninja Build System" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] ================================================" -ForegroundColor Cyan

$ninjaExePath = Get-Command ninja -ErrorAction SilentlyContinue
if ($ninjaExePath) {
    $ninjaVersion = & ninja --version 2>&1
    Write-Host "  [$SCRIPT_INDEX] Ninja is already installed: v$ninjaVersion" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] Path: $($ninjaExePath.Source)" -ForegroundColor Gray
    $ninjaInstalled = $true
}
else {
    Write-Host "  [$SCRIPT_INDEX] Ninja not found, installing via winget..." -ForegroundColor Yellow

    $ninjaInstallProcess = Start-Process -FilePath "winget" -ArgumentList "install --id $ninjaWingetId --silent --accept-package-agreements --accept-source-agreements" -Wait -NoNewWindow -PassThru

    if ($ninjaInstallProcess.ExitCode -eq 0) {
        Write-Host "  [$SCRIPT_INDEX] Ninja installed successfully" -ForegroundColor Green
        $ninjaInstalled = $true

        # Verify installation
        $ninjaExePath = Get-Command ninja -ErrorAction SilentlyContinue
        if ($ninjaExePath) {
            $ninjaVersion = & ninja --version 2>&1
            Write-Host "  [$SCRIPT_INDEX] Ninja version: v$ninjaVersion" -ForegroundColor Green
        }
        else {
            Write-Host "  [$SCRIPT_INDEX] WARNING: Ninja installed but not found in PATH" -ForegroundColor Yellow
            Write-Host "  [$SCRIPT_INDEX] You may need to restart your terminal" -ForegroundColor Yellow
        }
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Failed to install Ninja (Exit Code: $($ninjaInstallProcess.ExitCode))" -ForegroundColor Red
        $ninjaInstalled = $false
    }
}
Write-Host ""

# Check Python (uses Anaconda Python from GlobalVars)
Write-Host "  [$SCRIPT_INDEX] ================================================" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Checking Python 3 (Anaconda)" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] ================================================" -ForegroundColor Cyan

# Priority 1: Check absolute path from GlobalVars
if ($pythonExePathGlobal -and (Test-Path $pythonExePathGlobal)) {
    $pythonVersion = & $pythonExePathGlobal --version 2>&1
    Write-Host "  [$SCRIPT_INDEX] Python is installed (Anaconda): $pythonVersion" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] Path: $pythonExePathGlobal" -ForegroundColor Gray
    $pythonInstalled = $true
}
else {
    # Priority 2: Check if python is in PATH
    $pythonInPath = Get-Command python -ErrorAction SilentlyContinue
    if ($pythonInPath) {
        $pythonVersion = & python --version 2>&1
        Write-Host "  [$SCRIPT_INDEX] Python is installed: $pythonVersion" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX] Path: $($pythonInPath.Source)" -ForegroundColor Gray
        $pythonInstalled = $true
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Python not found" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] Please run Step9_InstallPython.ps1 to install Anaconda Python" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] Expected path: $pythonExePathGlobal" -ForegroundColor Gray
        $pythonInstalled = $false
    }
}
Write-Host ""

# Installation summary
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Qt Build Tools Installation Summary" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

$allInstalled = $cmakeInstalled -and $ninjaInstalled -and $pythonInstalled

if ($vs2022Installed) {
    Write-Host "  [$SCRIPT_INDEX]   [OK] Visual Studio 2022" -ForegroundColor Green
}
else {
    Write-Host "  [$SCRIPT_INDEX]   [!] Visual Studio 2022 (Not verified)" -ForegroundColor Yellow
}

if ($cmakeInstalled) {
    Write-Host "  [$SCRIPT_INDEX]   [OK] CMake" -ForegroundColor Green
}
else {
    Write-Host "  [$SCRIPT_INDEX]   [X] CMake (Failed)" -ForegroundColor Red
}

if ($ninjaInstalled) {
    Write-Host "  [$SCRIPT_INDEX]   [OK] Ninja" -ForegroundColor Green
}
else {
    Write-Host "  [$SCRIPT_INDEX]   [X] Ninja (Failed)" -ForegroundColor Red
}

if ($pythonInstalled) {
    Write-Host "  [$SCRIPT_INDEX]   [OK] Python 3" -ForegroundColor Green
}
else {
    Write-Host "  [$SCRIPT_INDEX]   [X] Python 3 (Failed)" -ForegroundColor Red
}

Write-Host ""

if ($allInstalled) {
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] All Qt build tools installed successfully!" -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] You are now ready to compile Qt" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] Run Step85_InstallQt.ps1 to compile Qt from source" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] IMPORTANT: If any tools show 'not found in PATH'," -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] please restart your terminal/PowerShell window before proceeding" -ForegroundColor Yellow
}
else {
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX] Some tools failed to install" -ForegroundColor Red
    Write-Host "================================================================================" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX] Please resolve the errors above before proceeding with Qt compilation" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Manual installation commands:" -ForegroundColor Cyan
    if (-not $cmakeInstalled) {
        Write-Host "  [$SCRIPT_INDEX]   CMake:  winget install Kitware.CMake" -ForegroundColor Gray
    }
    if (-not $ninjaInstalled) {
        Write-Host "  [$SCRIPT_INDEX]   Ninja:  winget install Ninja-build.Ninja" -ForegroundColor Gray
    }
    if (-not $pythonInstalled) {
        Write-Host "  [$SCRIPT_INDEX]   Python: Run Step9_InstallPython.ps1 to install Anaconda" -ForegroundColor Gray
    }
}

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""
