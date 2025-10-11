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

param(
    [Parameter(Mandatory = $false)]
    [string]$QtVersion = "6.10.0",

    [Parameter(Mandatory = $false)]
    [switch]$SkipBuild = $false
)

# Script Index for logging
$SCRIPT_INDEX = "Step85"

# Resolve absolute paths for script dependencies
$scriptRoot = $PSScriptRoot
$parentPath = Split-Path -Parent $scriptRoot
$winCommonPath = Join-Path $parentPath "win_common"
$globalVarsPath = Join-Path $winCommonPath "GlobalVars.ps1"
$commanFuncPath = Join-Path $winCommonPath "CommanFunc.ps1"
$windowsPathFuncPath = Join-Path $winCommonPath "WindowsPathFunction.ps1"

# Import required modules
. $globalVarsPath
. $commanFuncPath
. $windowsPathFuncPath

# All variable declarations
$qtVersionMajorMinor = ""
$qtSrcFileName = ""
$qtSrcFileUrl = ""
$qtSrcDownloadPath = ""
$qtSrcExtractDir = ""
$qtSrcDir = ""
$qtBuildDir = ""
$qtInstallDir = ""
$qtBinPath = ""
$qtExePath = ""
$vs2022BatPath = ""
$vs2022DefaultPath = ""
$qtInstalledFlag = ""
$qtOfflinePackagePath = ""
$selectedRegion = ""
$installType = ""
$mirrorBaseUrl = ""
$toolsList = @()
$missingTools = @()

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Qt Framework Installation and Build" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Get region and installation type from global variables
$selectedRegion = Get-GlobalVar -key "SELECTED_REGION" -defaultValue "Global"
$installType = Get-GlobalVar -key "INSTALL_TYPE" -defaultValue "full"

Write-Host "  [$SCRIPT_INDEX] Configuration:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]   - Region: $selectedRegion" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Install Type: $installType" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Qt Version: $QtVersion" -ForegroundColor Gray
Write-Host ""

# Configure mirror URLs based on region
if ($selectedRegion -eq "China") {
    # China mirror - use https://mirrors.tuna.tsinghua.edu.cn/qt/
    $mirrorBaseUrl = "https://mirrors.tuna.tsinghua.edu.cn/qt/archive/qt"
    Write-Host "  [$SCRIPT_INDEX] Using China mirror for Qt downloads" -ForegroundColor Green
}
else {
    # Global - use official Qt mirror
    $mirrorBaseUrl = "https://ftp.jaist.ac.jp/pub/qtproject/archive/qt"
    Write-Host "  [$SCRIPT_INDEX] Using global mirror for Qt downloads" -ForegroundColor Green
}

# Construct Qt variables
$qtVersionMajorMinor = ($QtVersion -split '\.')[0] + "." + ($QtVersion -split '\.')[1]
$qtSrcFileName = "qt-everywhere-src-$QtVersion.zip"
$qtSrcFileUrl = "$mirrorBaseUrl/$qtVersionMajorMinor/$QtVersion/single/$qtSrcFileName"
$qtSrcDownloadPath = Join-Path $Global:DOWNLOADS_DIR $qtSrcFileName
$qtSrcExtractDir = Join-Path $Global:TEMP_DIR "qt_extract"
$qtSrcDir = Join-Path $qtSrcExtractDir "qt-everywhere-src-$QtVersion"
$qtBuildDir = Join-Path $Global:TEMP_DIR "qt_build"
$qtInstallDir = Join-Path $Global:LANG_COMPILER_DIR "qt\$QtVersion"
$qtBinPath = Join-Path $qtInstallDir "bin"
$qtExePath = Join-Path $qtBinPath "qmake.exe"
$vs2022BatPath = "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"
$vs2022DefaultPath = "C:\Program Files\Microsoft Visual Studio\2022"
$qtInstalledFlag = Join-Path $Global:USER_CACHE_DIR "Qt_${QtVersion}_Installed.flag"
$qtOfflinePackagePath = Join-Path $Global:DOWNLOADS_DIR "qt_${QtVersion}_offline_package.zip"

Write-Host "  [$SCRIPT_INDEX] Qt Installation Paths:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]   - Source URL: $qtSrcFileUrl" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Download Path: $qtSrcDownloadPath" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Install Directory: $qtInstallDir" -ForegroundColor Gray
Write-Host ""

# Check if Qt is already installed
if (Test-Path $qtExePath) {
    Write-Host "  [$SCRIPT_INDEX] Qt $QtVersion is already installed at: $qtInstallDir" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] qmake.exe found at: $qtExePath" -ForegroundColor Green

    # Ensure Qt is in PATH
    Write-Host "  [$SCRIPT_INDEX] Verifying Qt bin directory in PATH..." -ForegroundColor Cyan
    Add-ToPath -PathToAdd $qtBinPath -Scope "Machine"

    Write-Host "  [$SCRIPT_INDEX] Qt installation verified and PATH updated" -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host "  [$SCRIPT_INDEX] Qt not found, proceeding with installation..." -ForegroundColor Yellow
Write-Host ""

# Check prerequisites
Write-Host "  [$SCRIPT_INDEX] Checking required prerequisites..." -ForegroundColor Cyan
$toolsList = @("cmake", "ninja", "python")
$missingTools = @()

foreach ($tool in $toolsList) {
    $toolExists = Get-Command $tool -ErrorAction SilentlyContinue
    if (-not $toolExists) {
        $missingTools += $tool
        Write-Host "  [$SCRIPT_INDEX]   [X] Missing: $tool" -ForegroundColor Red
    }
    else {
        Write-Host "  [$SCRIPT_INDEX]   [OK] Found: $tool" -ForegroundColor Green
    }
}

if ($missingTools.Count -gt 0) {
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] ERROR: Missing required tools: $($missingTools -join ', ')" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX] Please install these tools before running this script:" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX]   - CMake: winget install Kitware.CMake" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX]   - Ninja: winget install Ninja-build.Ninja" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX]   - Python: winget install Python.Python.3" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "  [$SCRIPT_INDEX] All required tools are available" -ForegroundColor Green
Write-Host ""

# Check for Visual Studio
Write-Host "  [$SCRIPT_INDEX] Checking for Visual Studio 2022..." -ForegroundColor Cyan
if (-not (Test-Path $vs2022BatPath)) {
    if (Test-Path $vs2022DefaultPath) {
        Write-Host "  [$SCRIPT_INDEX] Visual Studio 2022 directory found but vcvarsall.bat not at expected location" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] Searching for vcvarsall.bat..." -ForegroundColor Cyan
        $foundVcVars = Get-ChildItem -Path $vs2022DefaultPath -Recurse -Filter "vcvarsall.bat" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($foundVcVars) {
            $vs2022BatPath = $foundVcVars.FullName
            Write-Host "  [$SCRIPT_INDEX] Found vcvarsall.bat at: $vs2022BatPath" -ForegroundColor Green
        }
        else {
            Write-Host "  [$SCRIPT_INDEX] ERROR: vcvarsall.bat not found in Visual Studio directory" -ForegroundColor Red
            Write-Host "  [$SCRIPT_INDEX] Please ensure Visual Studio 2022 with C++ Desktop Development workload is installed" -ForegroundColor Red
            Write-Host ""
            exit 1
        }
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Visual Studio 2022 not found" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] Please install Visual Studio 2022 Community with C++ Desktop Development workload" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] You can run: winget install Microsoft.VisualStudio.2022.Community" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
}
else {
    Write-Host "  [$SCRIPT_INDEX] Visual Studio 2022 found at: $vs2022BatPath" -ForegroundColor Green
}
Write-Host ""

# Create necessary directories
Write-Host "  [$SCRIPT_INDEX] Creating necessary directories..." -ForegroundColor Cyan
$dirsToCreate = @($Global:DOWNLOADS_DIR, $qtSrcExtractDir, $qtBuildDir, $qtInstallDir)
foreach ($dir in $dirsToCreate) {
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "  [$SCRIPT_INDEX]   - Created: $dir" -ForegroundColor Green
    }
}
Write-Host ""

# Download Qt source if not exists
if (Test-Path $qtSrcDownloadPath) {
    Write-Host "  [$SCRIPT_INDEX] Qt source file already downloaded: $qtSrcDownloadPath" -ForegroundColor Green
}
else {
    Write-Host "  [$SCRIPT_INDEX] Downloading Qt $QtVersion source code..." -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] This is a large file and may take considerable time" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] URL: $qtSrcFileUrl" -ForegroundColor Gray

    try {
        Invoke-WebRequest -Uri $qtSrcFileUrl -OutFile $qtSrcDownloadPath -UseBasicParsing
        Write-Host "  [$SCRIPT_INDEX] Download completed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Failed to download Qt source code" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
}
Write-Host ""

# Extract Qt source if not already extracted
if (Test-Path $qtSrcDir) {
    Write-Host "  [$SCRIPT_INDEX] Qt source already extracted: $qtSrcDir" -ForegroundColor Green
}
else {
    Write-Host "  [$SCRIPT_INDEX] Extracting Qt source code..." -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] This may take several minutes..." -ForegroundColor Yellow

    try {
        Expand-Archive -Path $qtSrcDownloadPath -DestinationPath $qtSrcExtractDir -Force
        Write-Host "  [$SCRIPT_INDEX] Extraction completed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Failed to extract Qt source code" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        exit 1
    }
}
Write-Host ""

# Exit if SkipBuild is specified
if ($SkipBuild) {
    Write-Host "  [$SCRIPT_INDEX] SkipBuild flag is set, stopping before build process" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] Qt source is ready at: $qtSrcDir" -ForegroundColor Cyan
    Write-Host ""
    exit 0
}

Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Magenta
Write-Host "  [$SCRIPT_INDEX] IMPORTANT BUILD INFORMATION" -ForegroundColor Magenta
Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Magenta
Write-Host "  [$SCRIPT_INDEX] Qt compilation is a VERY long process that may take:" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]   - 2-6 hours on modern multi-core systems" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]   - Significant disk space (20-30 GB)" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]   - High CPU and memory usage" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX] " -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX] This script will create a RELOCATABLE offline Qt package" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] that can be distributed and used on other Windows systems" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Magenta
Write-Host ""

$userConfirm = Read-Host "  [$SCRIPT_INDEX] Do you want to continue with Qt compilation? (Y/N)"
if ($userConfirm -ne "Y" -and $userConfirm -ne "y") {
    Write-Host "  [$SCRIPT_INDEX] Build cancelled by user" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}
Write-Host ""

# Configure Qt
Write-Host "  [$SCRIPT_INDEX] Configuring Qt build..." -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Build directory: $qtBuildDir" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX] Install directory: $qtInstallDir" -ForegroundColor Gray

# Change to build directory
Push-Location $qtBuildDir

try {
    # Setup MSVC environment
    Write-Host "  [$SCRIPT_INDEX] Setting up Visual Studio environment..." -ForegroundColor Cyan
    $vcvarsCmd = "`"$vs2022BatPath`" amd64 && set"
    $envVars = cmd /c $vcvarsCmd 2>&1

    foreach ($line in $envVars) {
        if ($line -match "^(.*?)=(.*)$") {
            $varName = $matches[1]
            $varValue = $matches[2]
            Set-Item -Force -Path "Env:\$varName" -Value "$varValue" -ErrorAction SilentlyContinue
        }
    }
    Write-Host "  [$SCRIPT_INDEX] MSVC environment initialized" -ForegroundColor Green
    Write-Host ""

    # Run configure
    Write-Host "  [$SCRIPT_INDEX] Running Qt configure..." -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] This may take 10-20 minutes..." -ForegroundColor Yellow

    $configureBat = Join-Path $qtSrcDir "configure.bat"
    $configureArgs = @(
        "-prefix", "`"$qtInstallDir`"",
        "-opensource",
        "-confirm-license",
        "-release",
        "-nomake", "tests",
        "-nomake", "examples",
        "-skip", "qtwebengine",
        "-platform", "win32-msvc",
        "-feature-separate-debug-info",
        "-feature-relocatable"
    )

    $configureProcess = Start-Process -FilePath $configureBat -ArgumentList $configureArgs -Wait -NoNewWindow -PassThru

    if ($configureProcess.ExitCode -ne 0) {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Qt configure failed with exit code: $($configureProcess.ExitCode)" -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Write-Host "  [$SCRIPT_INDEX] Qt configure completed successfully" -ForegroundColor Green
    Write-Host ""

    # Build Qt
    Write-Host "  [$SCRIPT_INDEX] Building Qt (this will take several hours)..." -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] You can monitor progress in the console output" -ForegroundColor Yellow

    $buildProcess = Start-Process -FilePath "cmake" -ArgumentList "--build", ".", "--parallel" -Wait -NoNewWindow -PassThru

    if ($buildProcess.ExitCode -ne 0) {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Qt build failed with exit code: $($buildProcess.ExitCode)" -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Write-Host "  [$SCRIPT_INDEX] Qt build completed successfully" -ForegroundColor Green
    Write-Host ""

    # Install Qt
    Write-Host "  [$SCRIPT_INDEX] Installing Qt to: $qtInstallDir" -ForegroundColor Cyan

    $installProcess = Start-Process -FilePath "cmake" -ArgumentList "--install", "." -Wait -NoNewWindow -PassThru

    if ($installProcess.ExitCode -ne 0) {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Qt installation failed with exit code: $($installProcess.ExitCode)" -ForegroundColor Red
        Pop-Location
        exit 1
    }

    Write-Host "  [$SCRIPT_INDEX] Qt installation completed successfully" -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Host "  [$SCRIPT_INDEX] ERROR: An exception occurred during Qt build process" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX] Error: $($_.Exception.Message)" -ForegroundColor Red
    Pop-Location
    exit 1
}
finally {
    Pop-Location
}

# Add Qt bin to PATH
Write-Host "  [$SCRIPT_INDEX] Adding Qt bin directory to system PATH..." -ForegroundColor Cyan
Add-ToPath -PathToAdd $qtBinPath -Scope "Machine"
Write-Host "  [$SCRIPT_INDEX] Qt bin added to PATH: $qtBinPath" -ForegroundColor Green
Write-Host ""

# Set Qt environment variables for CMake
Write-Host "  [$SCRIPT_INDEX] Configuring Qt environment variables..." -ForegroundColor Cyan

# Set QTDIR to the Qt installation root
Set-EnvVar -varName "QTDIR" -varValue $qtInstallDir
Write-Host "  [$SCRIPT_INDEX]   - QTDIR set to: $qtInstallDir" -ForegroundColor Green

# Detect Qt CMake config directory
$qtCMakeDir = Join-Path $qtInstallDir "lib\cmake\Qt6"
if (-not (Test-Path $qtCMakeDir)) {
    $qtCMakeDir = Join-Path $qtInstallDir "lib\cmake\Qt5"
}

if (Test-Path $qtCMakeDir) {
    # Get Qt install directory to set as CMAKE_PREFIX_PATH
    $currentCMakePath = [Environment]::GetEnvironmentVariable("CMAKE_PREFIX_PATH", "Machine")
    if ($currentCMakePath -and -not $currentCMakePath.Contains($qtInstallDir)) {
        $newCMakePath = "$qtInstallDir;$currentCMakePath"
    } elseif (-not $currentCMakePath) {
        $newCMakePath = $qtInstallDir
    } else {
        $newCMakePath = $currentCMakePath
    }

    Set-EnvVar -varName "CMAKE_PREFIX_PATH" -varValue $newCMakePath
    Write-Host "  [$SCRIPT_INDEX]   - CMAKE_PREFIX_PATH includes: $qtInstallDir" -ForegroundColor Green

    # Also set Qt6_DIR or Qt5_DIR for explicit CMake detection
    $qtVersion = if ($qtCMakeDir -match "Qt6") { "Qt6" } else { "Qt5" }
    Set-EnvVar -varName "${qtVersion}_DIR" -varValue $qtCMakeDir
    Write-Host "  [$SCRIPT_INDEX]   - ${qtVersion}_DIR set to: $qtCMakeDir" -ForegroundColor Green
} else {
    Write-Host "  [$SCRIPT_INDEX]   - WARNING: Qt CMake directory not found at: $qtCMakeDir" -ForegroundColor Yellow
}

Write-Host "  [$SCRIPT_INDEX] Qt environment variables configured" -ForegroundColor Green
Write-Host ""

# Create installation flag
Write-Host "  [$SCRIPT_INDEX] Creating installation flag..." -ForegroundColor Cyan
Set-Content -Path $qtInstalledFlag -Value (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
Write-Host "  [$SCRIPT_INDEX] Installation flag created" -ForegroundColor Green
Write-Host ""

# Create offline package
Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Magenta
Write-Host "  [$SCRIPT_INDEX] OFFLINE PACKAGE CREATION" -ForegroundColor Magenta
Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Magenta
Write-Host "  [$SCRIPT_INDEX] Creating relocatable offline Qt package..." -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Package location: $qtOfflinePackagePath" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX] This may take 10-20 minutes..." -ForegroundColor Yellow
Write-Host ""

$createPackage = Read-Host "  [$SCRIPT_INDEX] Do you want to create an offline package? (Y/N)"
if ($createPackage -eq "Y" -or $createPackage -eq "y") {
    try {
        Compress-Archive -Path $qtInstallDir -DestinationPath $qtOfflinePackagePath -Force
        Write-Host "  [$SCRIPT_INDEX] Offline package created successfully" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX] Package location: $qtOfflinePackagePath" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] To use this package on another system:" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX]   1. Extract the zip file to desired location" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   2. Add <extract_path>\bin to system PATH" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   3. Qt is ready to use (no installation needed)" -ForegroundColor Gray
    }
    catch {
        Write-Host "  [$SCRIPT_INDEX] WARNING: Failed to create offline package" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] Error: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] You can manually zip the directory: $qtInstallDir" -ForegroundColor Cyan
    }
}
else {
    Write-Host "  [$SCRIPT_INDEX] Offline package creation skipped" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] You can manually create it later by zipping: $qtInstallDir" -ForegroundColor Cyan
}
Write-Host ""

Write-Host "================================================================================" -ForegroundColor Green
Write-Host "  [$SCRIPT_INDEX] Qt $QtVersion Installation Completed Successfully" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "  [$SCRIPT_INDEX] Installation Directory: $qtInstallDir" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] qmake Path: $qtExePath" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Qt bin added to PATH: $qtBinPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] To use Qt in new terminal sessions:" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]   - Close and reopen your terminal/IDE" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Or run: refreshenv (if using Chocolatey)" -ForegroundColor Gray
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] Quick test command:" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]   qmake --version" -ForegroundColor Gray
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""
