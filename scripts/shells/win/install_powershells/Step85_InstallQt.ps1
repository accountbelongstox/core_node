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
    [string]$Region = "Global",

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
$CommonFuncPath = Join-Path $winCommonPath "CommonFunc.ps1"
$windowsPathFuncPath = Join-Path $winCommonPath "WindowsPathFunction.ps1"

# Import required modules
. $globalVarsPath
. $CommonFuncPath
. $windowsPathFuncPath

# All variable declarations
$proceedChoice = ""
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
$installType = ""
$mirrorBaseUrl = ""
$toolsList = @()
$missingTools = @()

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Qt Framework Installation and Build" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Ask user if they want to proceed with installation
Write-Host "  [$SCRIPT_INDEX] Do you want to proceed with Qt installation? (y/N)" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX] Default: N (Skip)" -ForegroundColor Gray
$proceedChoice = Read-Host "  [$SCRIPT_INDEX]"

if ($proceedChoice -ne "Y" -and $proceedChoice -ne "y") {
    Write-Host "  [$SCRIPT_INDEX] Qt installation skipped by user" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

Write-Host "  [$SCRIPT_INDEX] Proceeding with Qt installation..." -ForegroundColor Green
Write-Host ""

# Get installation type from global variables
$installType = Get-GlobalVar -key "INSTALL_TYPE" -defaultValue "full"

# Get Qt installation method (installer or source)
$qtInstallMethod = Get-GlobalVar -key "QT_INSTALL_METHOD" -defaultValue "installer"

Write-Host "  [$SCRIPT_INDEX] Configuration:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]   - Region: $Region" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Install Type: $installType" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Qt Version: $QtVersion" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Qt Install Method: $qtInstallMethod" -ForegroundColor Gray
Write-Host ""

# Prompt user for installation method if not set or if interactive
if (-not $qtInstallMethod -or $qtInstallMethod -eq "") {
    Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] Qt Installation Method Selection" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Please select your preferred Qt installation method:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] [1] Official Installer (RECOMMENDED - Default)" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX]     - Easy to use with GUI" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Pre-compiled binaries (ready to use immediately)" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Includes Qt Creator IDE" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Supports multiple Qt versions side-by-side" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Easy to update via MaintenanceTool" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Download size: ~30MB (installer), Components: ~2-4GB" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Installation time: 10-30 minutes" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] [2] Source Code Build (ADVANCED)" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX]     - Full control over build configuration" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Can customize which modules to include" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Requires Visual Studio 2022 with C++ components" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Requires CMake, Ninja, Python" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Download size: ~600MB (source archive)" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Build time: 2-8 hours depending on CPU" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]     - Disk space: ~30GB during build, ~10GB after" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Cyan
    Write-Host ""

    $userChoice = Read-Host "  [$SCRIPT_INDEX] Enter your choice (1 or 2) [Default: 1]"

    if ([string]::IsNullOrWhiteSpace($userChoice) -or $userChoice -eq "1") {
        $qtInstallMethod = "installer"
        Write-Host "  [$SCRIPT_INDEX] Selected: Official Installer" -ForegroundColor Green
    }
    elseif ($userChoice -eq "2") {
        $qtInstallMethod = "source"
        Write-Host "  [$SCRIPT_INDEX] Selected: Source Code Build" -ForegroundColor Yellow
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Invalid choice. Using default: Official Installer" -ForegroundColor Yellow
        $qtInstallMethod = "installer"
    }

    # Save user choice for future runs
    Set-GlobalVar -key "QT_INSTALL_METHOD" -value $qtInstallMethod
    Write-Host ""
}
else {
    Write-Host "  [$SCRIPT_INDEX] Using saved installation method: $qtInstallMethod" -ForegroundColor Cyan
    Write-Host ""
}

# Configure mirror URLs based on region
if ($Region -eq "China") {
    # China mirror - use https://mirrors.tuna.tsinghua.edu.cn/qt/
    $mirrorBaseUrl = "https://mirrors.tuna.tsinghua.edu.cn/qt/archive/qt"
    Write-Host "  [$SCRIPT_INDEX] Using China mirror for Qt downloads" -ForegroundColor Green
}
else {
    # Global - use official Qt mirror
    $mirrorBaseUrl = "https://ftp.jaist.ac.jp/pub/qtproject/archive/qt"
    Write-Host "  [$SCRIPT_INDEX] Using global mirror for Qt downloads" -ForegroundColor Green
}

# Validate Qt version format
if ($QtVersion -eq "Global" -or $QtVersion -eq "China" -or -not ($QtVersion -match '^\d+\.\d+\.\d+$')) {
    Write-Host "  [$SCRIPT_INDEX] ERROR: Invalid Qt version format: '$QtVersion'" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX] Expected format: X.Y.Z (e.g., 6.10.0)" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] Using default version: 6.10.0" -ForegroundColor Cyan
    $QtVersion = "6.10.0"
}

# Construct Qt variables
$versionParts = $QtVersion -split '\.'
if ($versionParts.Count -lt 2) {
    Write-Host "  [$SCRIPT_INDEX] ERROR: Qt version must have at least major.minor format" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX] Using default version: 6.10.0" -ForegroundColor Cyan
    $QtVersion = "6.10.0"
    $versionParts = $QtVersion -split '\.'
}

$qtVersionMajorMinor = $versionParts[0] + "." + $versionParts[1]
$qtSrcFileName = "qt-everywhere-src-$QtVersion.zip"
$qtSrcFileUrl = "$mirrorBaseUrl/$qtVersionMajorMinor/$QtVersion/single/$qtSrcFileName"
$qtSrcDownloadPath = Join-Path $Global:DOWNLOADS_DIR $qtSrcFileName
$qtSrcExtractDir = Join-Path $Global:TEMP_DIR "qt_extract"
$qtSrcDir = Join-Path $qtSrcExtractDir "qt-everywhere-src-$QtVersion"
$qtBuildDir = Join-Path $Global:TEMP_DIR "qt_build"
$qtInstallDir = Join-Path $Global:LANG_COMPILER_DIR "Qt\$QtVersion"
$qtBinPath = Join-Path $qtInstallDir "bin"
$qtExePath = Join-Path $qtBinPath "qmake.exe"
$vs2022BatPath = "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvarsall.bat"
$vs2022DefaultPath = "C:\Program Files\Microsoft Visual Studio\2022"
$qtInstalledFlag = Join-Path $Global:USER_CACHE_DIR "Qt_${QtVersion}_Installed.flag"
$qtOfflinePackagePath = Join-Path $Global:DOWNLOADS_DIR "qt_${QtVersion}_offline_package.zip"
$maintenanceToolPath = Join-Path $Global:LANG_COMPILER_DIR "Qt\MaintenanceTool.exe"

Write-Host "  [$SCRIPT_INDEX] Qt Installation Paths:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]   - Source URL: $qtSrcFileUrl" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Download Path: $qtSrcDownloadPath" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Install Directory: $qtInstallDir" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Maintenance Tool: $maintenanceToolPath" -ForegroundColor Gray
Write-Host ""

# Check if MaintenanceTool exists (Qt already installed via official installer)
if (Test-Path $maintenanceToolPath) {
    Write-Host "  [$SCRIPT_INDEX] Qt MaintenanceTool found!" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] This means Qt was installed using the official installer." -ForegroundColor Cyan
    Write-Host ""

    # Check if the specific version already exists
    if (Test-Path $qtExePath) {
        Write-Host "  [$SCRIPT_INDEX] Qt $QtVersion is already installed at: $qtInstallDir" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX] qmake.exe found at: $qtExePath" -ForegroundColor Green
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Qt $QtVersion is NOT installed yet." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] To install Qt $QtVersion with all required components:" -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX]   1. Run: $maintenanceToolPath" -ForegroundColor White
        Write-Host "  [$SCRIPT_INDEX]   2. Select 'Add or remove components'" -ForegroundColor White
        Write-Host "  [$SCRIPT_INDEX]   3. Navigate to Qt -> Qt $qtVersionMajorMinor -> Qt $QtVersion" -ForegroundColor White
        Write-Host "  [$SCRIPT_INDEX]   4. Check the following components:" -ForegroundColor White
        Write-Host "  [$SCRIPT_INDEX]      - MSVC 2019 64-bit (or MSVC 2022 64-bit)" -ForegroundColor White
        Write-Host "  [$SCRIPT_INDEX]      - MinGW 64-bit (if needed)" -ForegroundColor White
        Write-Host "  [$SCRIPT_INDEX]      - Qt 5 Compatibility Module (REQUIRED for QtScrcpy)" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX]      - Additional Libraries -> Qt Multimedia" -ForegroundColor White
        Write-Host "  [$SCRIPT_INDEX]      - Additional Libraries -> Qt Network" -ForegroundColor White
        Write-Host "  [$SCRIPT_INDEX]   5. Click 'Update' to install" -ForegroundColor White
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] Alternatively, you can use the command line:" -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX]   & '$maintenanceToolPath' --help" -ForegroundColor White
        Write-Host ""
    }

    # Update environment variables using WindowsPathFunction.ps1
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Updating environment variables..." -ForegroundColor Cyan

    # Ensure Qt bin is in PATH
    if (Test-Path $qtBinPath) {
        Write-Host "  [$SCRIPT_INDEX] Adding Qt bin to system PATH..." -ForegroundColor Cyan
        & $windowsPathFuncPath "add" $qtBinPath
    }

    # Set QTDIR environment variable
    if (Test-Path $qtInstallDir) {
        Write-Host "  [$SCRIPT_INDEX] Setting QTDIR environment variable..." -ForegroundColor Cyan
        & $windowsPathFuncPath "setvar" "QTDIR" $qtInstallDir
        Write-Host "  [$SCRIPT_INDEX]   - QTDIR = $qtInstallDir" -ForegroundColor Green
    }

    # Detect Qt CMake config directory
    $qtCMakeDir = Join-Path $qtInstallDir "lib\cmake\Qt6"
    if (-not (Test-Path $qtCMakeDir)) {
        $qtCMakeDir = Join-Path $qtInstallDir "lib\cmake\Qt5"
    }

    if (Test-Path $qtCMakeDir) {
        # Update CMAKE_PREFIX_PATH
        $currentCMakePath = [Environment]::GetEnvironmentVariable("CMAKE_PREFIX_PATH", "Machine")
        if ($currentCMakePath -and -not $currentCMakePath.Contains($qtInstallDir)) {
            $newCMakePath = "$qtInstallDir;$currentCMakePath"
        }
        elseif (-not $currentCMakePath) {
            $newCMakePath = $qtInstallDir
        }
        else {
            $newCMakePath = $currentCMakePath
        }

        & $windowsPathFuncPath "setvar" "CMAKE_PREFIX_PATH" $newCMakePath
        Write-Host "  [$SCRIPT_INDEX]   - CMAKE_PREFIX_PATH includes: $qtInstallDir" -ForegroundColor Green

        # Set Qt6_DIR or Qt5_DIR
        $qtVer = if ($qtCMakeDir -match "Qt6") { "Qt6" } else { "Qt5" }
        & $windowsPathFuncPath "setvar" "${qtVer}_DIR" $qtCMakeDir
        Write-Host "  [$SCRIPT_INDEX]   - ${qtVersion}_DIR = $qtCMakeDir" -ForegroundColor Green
    }
    else {
        Write-Host "  [$SCRIPT_INDEX]   - WARNING: Qt CMake directory not found" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Environment variables updated" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] Please restart your terminal or IDE to use the updated environment" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# Check if Qt is already installed (built from source)
if (Test-Path $qtExePath) {
    Write-Host "  [$SCRIPT_INDEX] Qt $QtVersion is already installed at: $qtInstallDir" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] qmake.exe found at: $qtExePath" -ForegroundColor Green

    # Update environment variables using WindowsPathFunction.ps1
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Updating environment variables..." -ForegroundColor Cyan

    # Ensure Qt bin is in PATH
    if (Test-Path $qtBinPath) {
        Write-Host "  [$SCRIPT_INDEX] Adding Qt bin to system PATH..." -ForegroundColor Cyan
        & $windowsPathFuncPath "add" $qtBinPath
    }

    # Set QTDIR environment variable
    if (Test-Path $qtInstallDir) {
        Write-Host "  [$SCRIPT_INDEX] Setting QTDIR environment variable..." -ForegroundColor Cyan
        & $windowsPathFuncPath "setvar" "QTDIR" $qtInstallDir
        Write-Host "  [$SCRIPT_INDEX]   - QTDIR = $qtInstallDir" -ForegroundColor Green
    }

    # Detect Qt CMake config directory
    $qtCMakeDir = Join-Path $qtInstallDir "lib\cmake\Qt6"
    if (-not (Test-Path $qtCMakeDir)) {
        $qtCMakeDir = Join-Path $qtInstallDir "lib\cmake\Qt5"
    }

    if (Test-Path $qtCMakeDir) {
        # Update CMAKE_PREFIX_PATH
        $currentCMakePath = [Environment]::GetEnvironmentVariable("CMAKE_PREFIX_PATH", "Machine")
        if ($currentCMakePath -and -not $currentCMakePath.Contains($qtInstallDir)) {
            $newCMakePath = "$qtInstallDir;$currentCMakePath"
        }
        elseif (-not $currentCMakePath) {
            $newCMakePath = $qtInstallDir
        }
        else {
            $newCMakePath = $currentCMakePath
        }

        & $windowsPathFuncPath "setvar" "CMAKE_PREFIX_PATH" $newCMakePath
        Write-Host "  [$SCRIPT_INDEX]   - CMAKE_PREFIX_PATH includes: $qtInstallDir" -ForegroundColor Green

        # Set Qt6_DIR or Qt5_DIR
        $qtVer = if ($qtCMakeDir -match "Qt6") { "Qt6" } else { "Qt5" }
        & $windowsPathFuncPath "setvar" "${qtVer}_DIR" $qtCMakeDir
        Write-Host "  [$SCRIPT_INDEX]   - ${qtVersion}_DIR = $qtCMakeDir" -ForegroundColor Green
    }
    else {
        Write-Host "  [$SCRIPT_INDEX]   - WARNING: Qt CMake directory not found" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Qt installation verified and environment variables updated" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] Please restart your terminal or IDE to use the updated environment" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

Write-Host "  [$SCRIPT_INDEX] Qt not found, proceeding with installation..." -ForegroundColor Yellow
Write-Host ""

# Branch based on installation method
if ($qtInstallMethod -eq "installer") {
    Write-Host "  [$SCRIPT_INDEX] ===========================================" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] Qt Installation via Official Installer" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] ===========================================" -ForegroundColor Cyan
    Write-Host ""

    # Function to install Qt using official installer
    function Install-QtWithOfficialInstaller {
        param(
            [string]$Region,
            [string]$QtVersion,
            [string]$LogPrefix
        )

        # Determine installer URL based on region
        $installerUrl = if ($Region -eq "China") {
            $Global:QT_INSTALLER_URL_CHINA
        } else {
            $Global:QT_INSTALLER_URL_GLOBAL
        }

        $installerPath = $Global:QT_INSTALLER_DOWNLOAD_PATH
        $qtBaseDir = $Global:QT_INSTALL_BASE_DIR

        Write-Host "$LogPrefix Qt Official Installer Installation" -ForegroundColor Cyan
        Write-Host "$LogPrefix Installer URL: $installerUrl" -ForegroundColor Gray
        Write-Host "$LogPrefix Download Path: $installerPath" -ForegroundColor Gray
        Write-Host "$LogPrefix Install Directory: $qtBaseDir" -ForegroundColor Gray
        Write-Host ""

        # Download Qt installer using common download function
        Write-Host "$LogPrefix Downloading Qt installer..." -ForegroundColor Yellow
        Write-Host "$LogPrefix URL: $installerUrl" -ForegroundColor Gray
        Write-Host ""

        try {
            # Ensure downloads directory exists
            $downloadsDir = Split-Path $installerPath -Parent
            if (-not (Test-Path $downloadsDir)) {
                New-Item -ItemType Directory -Path $downloadsDir -Force | Out-Null
            }

            # Use common download function with size check and progress
            Get-FileWithSizeCheck -localPath $installerPath -remoteUrl $installerUrl -description "Qt Online Installer"

            # Verify download
            if (Test-Path $installerPath) {
                $fileSize = (Get-Item $installerPath).Length
                $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
                Write-Host "$LogPrefix Installer downloaded successfully" -ForegroundColor Green
                Write-Host "$LogPrefix File size: $fileSizeMB MB" -ForegroundColor Cyan
            }
            else {
                Write-Host "$LogPrefix ERROR: Downloaded file not found" -ForegroundColor Red
                return $false
            }
        }
        catch {
            Write-Host "$LogPrefix ERROR: Failed to download Qt installer" -ForegroundColor Red
            Write-Host "$LogPrefix Exception: $($_.Exception.Message)" -ForegroundColor Red
            Write-Host ""
            Write-Host "$LogPrefix You can manually download the installer from:" -ForegroundColor Yellow
            Write-Host "$LogPrefix $installerUrl" -ForegroundColor White
            Write-Host "$LogPrefix Save it to: $installerPath" -ForegroundColor White
            return $false
        }

        Write-Host ""
        Write-Host "$LogPrefix ===========================================" -ForegroundColor Magenta
        Write-Host "$LogPrefix MANUAL INSTALLATION REQUIRED" -ForegroundColor Magenta
        Write-Host "$LogPrefix ===========================================" -ForegroundColor Magenta
        Write-Host ""
        Write-Host "$LogPrefix The Qt installer has been downloaded." -ForegroundColor Cyan
        Write-Host "$LogPrefix Please follow these steps to complete the installation:" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "$LogPrefix 1. Run the installer:" -ForegroundColor Yellow
        Write-Host "$LogPrefix    $installerPath" -ForegroundColor White
        Write-Host ""
        Write-Host "$LogPrefix 2. Create a Qt account or log in (required)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "$LogPrefix 3. When prompted, select the installation directory:" -ForegroundColor Yellow
        Write-Host "$LogPrefix    RECOMMENDED: $qtBaseDir" -ForegroundColor White
        Write-Host ""
        Write-Host "$LogPrefix 4. Select components to install:" -ForegroundColor Yellow
        Write-Host "$LogPrefix    REQUIRED components for Qt ${QtVersion}:" -ForegroundColor White
        Write-Host "$LogPrefix      [X] Qt -> Qt $qtVersionMajorMinor -> Qt $QtVersion" -ForegroundColor Green
        Write-Host "$LogPrefix      [X] MSVC 2022 64-bit (for Visual Studio)" -ForegroundColor Green
        Write-Host "$LogPrefix      [X] MinGW 64-bit (optional, for GCC)" -ForegroundColor Gray
        Write-Host "$LogPrefix      [X] Qt 5 Compatibility Module" -ForegroundColor Green
        Write-Host "$LogPrefix      [X] Additional Libraries -> Qt Multimedia" -ForegroundColor Green
        Write-Host "$LogPrefix      [X] Additional Libraries -> Qt Network" -ForegroundColor Green
        Write-Host "$LogPrefix      [X] Additional Libraries -> Qt WebEngine" -ForegroundColor Gray
        Write-Host "$LogPrefix      [X] Developer and Designer Tools -> Qt Creator" -ForegroundColor Green
        Write-Host "$LogPrefix      [X] Developer and Designer Tools -> CMake" -ForegroundColor Green
        Write-Host "$LogPrefix      [X] Developer and Designer Tools -> Ninja" -ForegroundColor Green
        Write-Host ""
        Write-Host "$LogPrefix 5. Click 'Install' and wait for completion (10-30 minutes)" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "$LogPrefix 6. After installation completes, run this script again to:" -ForegroundColor Yellow
        Write-Host "$LogPrefix    - Verify Qt installation" -ForegroundColor Gray
        Write-Host "$LogPrefix    - Configure environment variables" -ForegroundColor Gray
        Write-Host ""
        Write-Host "$LogPrefix ===========================================" -ForegroundColor Magenta
        Write-Host ""

        # Launch installer if user confirms
        Write-Host "$LogPrefix Do you want to launch the installer now? (Y/N)" -ForegroundColor Cyan
        $launchChoice = Read-Host "$LogPrefix"

        if ($launchChoice -eq "Y" -or $launchChoice -eq "y") {
            Write-Host "$LogPrefix Launching Qt installer..." -ForegroundColor Green
            Write-Host ""
            Start-Process -FilePath $installerPath -Wait
            Write-Host ""
            Write-Host "$LogPrefix Installer has been closed" -ForegroundColor Cyan
            Write-Host "$LogPrefix Please run this script again to verify installation" -ForegroundColor Yellow
        }
        else {
            Write-Host "$LogPrefix Installer launch skipped" -ForegroundColor Yellow
            Write-Host "$LogPrefix You can manually run: $installerPath" -ForegroundColor White
        }

        return $true
    }

    # Call official installer function
    $installerResult = Install-QtWithOfficialInstaller -Region $Region -QtVersion $QtVersion -LogPrefix "  [$SCRIPT_INDEX]"

    if ($installerResult) {
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] ===========================================" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX] Qt Installer Setup Complete" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX] ===========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] Next steps:" -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX]   1. Complete the installation using the Qt installer" -ForegroundColor White
        Write-Host "  [$SCRIPT_INDEX]   2. Run this script again to configure environment variables" -ForegroundColor White
        Write-Host ""
    }

    exit 0
}
elseif ($qtInstallMethod -eq "source") {
    Write-Host "  [$SCRIPT_INDEX] ===========================================" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] Qt Installation from Source Code" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] ===========================================" -ForegroundColor Cyan
    Write-Host ""
    # Continue with source build (existing code below)
}
else {
    Write-Host "  [$SCRIPT_INDEX] ERROR: Invalid installation method: $qtInstallMethod" -ForegroundColor Red
    exit 1
}

# Source build continues below...

# Function to find tool in dev directory
function Find-ToolInDevDirectory {
    param(
        [string]$ToolName,
        [string]$DevDir
    )

    if (-not (Test-Path $DevDir)) {
        return $null
    }

    $toolExe = "${ToolName}.exe"
    $foundTool = Get-ChildItem -Path $DevDir -Recurse -Filter $toolExe -ErrorAction SilentlyContinue | Select-Object -First 1

    if ($foundTool) {
        return $foundTool.DirectoryName
    }

    return $null
}

# Check prerequisites
Write-Host "  [$SCRIPT_INDEX] Checking required prerequisites..." -ForegroundColor Cyan
$toolsList = @("cmake", "ninja", "python")
$missingTools = @()
$toolPaths = @{}

foreach ($tool in $toolsList) {
    # First check if tool is in PATH
    $toolExists = Get-Command $tool -ErrorAction SilentlyContinue
    if ($toolExists) {
        Write-Host "  [$SCRIPT_INDEX]   [OK] Found $tool in PATH: $($toolExists.Source)" -ForegroundColor Green
        $toolPaths[$tool] = Split-Path $toolExists.Source -Parent
    }
    else {
        # Search in dev directory
        $toolPath = Find-ToolInDevDirectory -ToolName $tool -DevDir $Global:LANG_COMPILER_DIR
        if ($toolPath) {
            Write-Host "  [$SCRIPT_INDEX]   [OK] Found $tool in dev directory: $toolPath" -ForegroundColor Green
            $toolPaths[$tool] = $toolPath
            # Add to PATH for this session
            $env:Path = "$toolPath;$env:Path"
        }
        else {
            $missingTools += $tool
            Write-Host "  [$SCRIPT_INDEX]   [X] Missing: $tool" -ForegroundColor Red
        }
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
            Write-Host "  [$SCRIPT_INDEX] WARNING: vcvarsall.bat not found in Visual Studio directory" -ForegroundColor Yellow
            Write-Host "  [$SCRIPT_INDEX] Please ensure Visual Studio 2022 with C++ Desktop Development workload is installed" -ForegroundColor Yellow
            Write-Host "  [$SCRIPT_INDEX] Continuing with installation despite missing Visual Studio..." -ForegroundColor Cyan
            $vs2022BatPath = $null
        }
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] WARNING: Visual Studio 2022 not found" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] Please install Visual Studio 2022 Community with C++ Desktop Development workload" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] You can run: winget install Microsoft.VisualStudio.2022.Community" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] Continuing with installation despite missing Visual Studio..." -ForegroundColor Cyan
        $vs2022BatPath = $null
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
    Write-Host ""

    Get-FileWithSizeCheck -localPath $qtSrcDownloadPath -remoteUrl $qtSrcFileUrl -description "Qt $QtVersion Source Code"
    
    if (-not (Test-Path $qtSrcDownloadPath)) {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Failed to download Qt source code" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] Please check your internet connection and try again" -ForegroundColor Yellow
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

    # Check if downloaded file exists and has reasonable size
    if (-not (Test-Path $qtSrcDownloadPath)) {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Downloaded file not found: $qtSrcDownloadPath" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] Please re-run the script to download again" -ForegroundColor Yellow
        exit 1
    }

    $fileSize = (Get-Item $qtSrcDownloadPath).Length
    $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
    Write-Host "  [$SCRIPT_INDEX] Downloaded file size: $fileSizeMB MB" -ForegroundColor Cyan

    # Check if file size is reasonable (should be around 1.8GB for Qt 6.10.0)
    if ($fileSize -lt 100MB) {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Downloaded file is too small ($fileSizeMB MB)" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] Expected size should be around 1800+ MB" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] The download may have failed or been interrupted" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] Removing corrupted file and exiting..." -ForegroundColor Yellow
        Remove-Item $qtSrcDownloadPath -Force
        exit 1
    }

    try {
        # Try to extract using PowerShell's Expand-Archive
        Write-Host "  [$SCRIPT_INDEX] Attempting extraction with Expand-Archive..." -ForegroundColor Cyan
        Expand-Archive -Path $qtSrcDownloadPath -DestinationPath $qtSrcExtractDir -Force
        Write-Host "  [$SCRIPT_INDEX] Extraction completed successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Failed to extract Qt source code with Expand-Archive" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] Error: $($_.Exception.Message)" -ForegroundColor Red
        
        # Try alternative extraction method using 7-Zip if available
        Write-Host "  [$SCRIPT_INDEX] Trying alternative extraction method..." -ForegroundColor Yellow
        
        $sevenZipPath = $null
        $possiblePaths = @(
            $Global:SEVENZIP_EXE_PATH,
            "C:\Program Files\7-Zip\7z.exe",
            "C:\Program Files (x86)\7-Zip\7z.exe"
        )
        
        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                $sevenZipPath = $path
                break
            }
        }
        
        if ($sevenZipPath) {
            Write-Host "  [$SCRIPT_INDEX] Found 7-Zip at: $sevenZipPath" -ForegroundColor Green
            try {
                $extractArgs = @("x", "`"$qtSrcDownloadPath`"", "-o`"$qtSrcExtractDir`"", "-y")
                $extractProcess = Start-Process -FilePath $sevenZipPath -ArgumentList $extractArgs -Wait -NoNewWindow -PassThru
                
                if ($extractProcess.ExitCode -eq 0) {
                    Write-Host "  [$SCRIPT_INDEX] Extraction completed successfully with 7-Zip" -ForegroundColor Green
                }
                else {
                    Write-Host "  [$SCRIPT_INDEX] ERROR: 7-Zip extraction failed with exit code: $($extractProcess.ExitCode)" -ForegroundColor Red
                    throw "7-Zip extraction failed"
                }
            }
            catch {
                Write-Host "  [$SCRIPT_INDEX] ERROR: Failed to extract with 7-Zip: $($_.Exception.Message)" -ForegroundColor Red
                throw "All extraction methods failed"
            }
        }
        else {
            Write-Host "  [$SCRIPT_INDEX] ERROR: 7-Zip not found, cannot use alternative extraction method" -ForegroundColor Red
            Write-Host "  [$SCRIPT_INDEX] The ZIP file may be corrupted. Please try downloading again." -ForegroundColor Yellow
            Write-Host "  [$SCRIPT_INDEX] You can also try manually extracting: $qtSrcDownloadPath" -ForegroundColor Cyan
            throw "No alternative extraction method available"
        }
    }

    # Verify extraction was successful
    if (-not (Test-Path $qtSrcDir)) {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Extraction verification failed - Qt source directory not found" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] Expected directory: $qtSrcDir" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] Please check the downloaded file and try again" -ForegroundColor Yellow
        exit 1
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Extraction verification successful" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX] Qt source directory: $qtSrcDir" -ForegroundColor Cyan
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
Write-Host "  [$SCRIPT_INDEX]   - 4-8 hours on modern multi-core systems (with all components)" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]   - Significant disk space (30-50 GB with all components)" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]   - High CPU and memory usage" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX] " -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX] This script will install ALL Qt components including:" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX]   - Qt Core, GUI, Widgets, Network, SQL, Multimedia" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX]   - Qt WebEngine (full web browser engine)" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX]   - Qt Tests and Examples" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX]   - All Qt Tools and Documentation" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] " -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX] This will create a COMPLETE relocatable offline Qt package" -ForegroundColor Cyan
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
    # Setup MSVC environment (if Visual Studio is available)
    if ($vs2022BatPath) {
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
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] WARNING: Visual Studio environment not available" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] Attempting to build without MSVC environment setup..." -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX] This may fail if MSVC tools are required" -ForegroundColor Yellow
    }
    Write-Host ""

    # Run configure
    Write-Host "  [$SCRIPT_INDEX] Running Qt configure..." -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] This may take 10-20 minutes..." -ForegroundColor Yellow

    $configureBat = Join-Path $qtSrcDir "configure.bat"
    
    # Choose platform based on Visual Studio availability
    if ($vs2022BatPath) {
        $platform = "win32-msvc"
        Write-Host "  [$SCRIPT_INDEX] Using MSVC platform for Qt build" -ForegroundColor Green
    }
    else {
        $platform = "win32-g++"
        Write-Host "  [$SCRIPT_INDEX] Using MinGW platform for Qt build (Visual Studio not available)" -ForegroundColor Yellow
    }

    # Check for ATL (Active Template Library) support
    Write-Host "  [$SCRIPT_INDEX] Checking for ATL (Active Template Library) support..." -ForegroundColor Cyan
    $atlHeaderPath = "C:\Program Files (x86)\Windows Kits\10\Include"
    $atlSupported = $false

    if (Test-Path $atlHeaderPath) {
        $atlbasePath = Get-ChildItem -Path $atlHeaderPath -Recurse -Filter "atlbase.h" -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($atlbasePath) {
            $atlSupported = $true
            Write-Host "  [$SCRIPT_INDEX]   [OK] ATL library found: $($atlbasePath.FullName)" -ForegroundColor Green
        }
    }

    if (-not $atlSupported) {
        Write-Host "  [$SCRIPT_INDEX]   [WARNING] ATL library not found" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX]   ATL is required for QtSpeech SAPI plugin and QtWebView" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX]   Modules requiring ATL will be skipped" -ForegroundColor Yellow
        Write-Host "" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX]   To install ATL:" -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX]   1. Open Visual Studio Installer" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   2. Click 'Modify' on VS 2022" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   3. Go to 'Individual components' tab" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   4. Search for 'ATL' and check:" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]      - C++ ATL for latest build tools" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]      - C++ MFC for latest build tools (optional)" -ForegroundColor Gray
        Write-Host "" -ForegroundColor Yellow
    }

    # Build configure arguments
    $configureArgs = @(
        "-prefix", "`"$qtInstallDir`"",
        "-opensource",
        "-confirm-license",
        "-release",
        "-platform", $platform
    )

    # Skip modules that require ATL if not available
    if (-not $atlSupported) {
        Write-Host "  [$SCRIPT_INDEX] Configuring Qt WITHOUT ATL-dependent modules:" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX]   - Skipping QtSpeech (requires ATL for SAPI plugin)" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   - Skipping QtWebView (requires ATL for WebView2 plugin)" -ForegroundColor Gray
        $configureArgs += @("-skip", "qtspeech")
        $configureArgs += @("-skip", "qtwebview")
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Configuring Qt WITH all modules (ATL available)" -ForegroundColor Green
    }

    $configureProcess = Start-Process -FilePath $configureBat -ArgumentList $configureArgs -Wait -NoNewWindow -PassThru

    if ($configureProcess.ExitCode -ne 0) {
        Write-Host "  [$SCRIPT_INDEX] WARNING: Qt configure failed with exit code: $($configureProcess.ExitCode)" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] This may be due to missing Visual Studio or other prerequisites" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] Attempting to continue with build process..." -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX] Note: Build may fail if configure step was critical" -ForegroundColor Yellow
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Qt configure completed successfully" -ForegroundColor Green
    }
    Write-Host ""

    # Build Qt
    Write-Host "  [$SCRIPT_INDEX] Building Qt (this will take several hours)..." -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] You can monitor progress in the console output" -ForegroundColor Yellow
    Write-Host ""

    $buildProcess = Start-Process -FilePath "cmake" -ArgumentList "--build", ".", "--parallel" -Wait -NoNewWindow -PassThru

    if ($buildProcess.ExitCode -ne 0) {
        Write-Host "" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] ============================================" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] ERROR: Qt build failed (exit code: $($buildProcess.ExitCode))" -ForegroundColor Red
        Write-Host "  [$SCRIPT_INDEX] ============================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] Common causes:" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX]   1. Missing ATL library (see error above)" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   2. Incomplete Visual Studio installation" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   3. Missing Windows SDK components" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   4. Insufficient disk space" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] To retry build after fixing issues:" -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX]   1. Fix the issue (e.g., install ATL)" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   2. Delete build directory: $qtBuildDir" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]   3. Run this script again" -ForegroundColor Gray
        Write-Host ""

        throw "Qt build failed - see error messages above for details"
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Qt build completed successfully" -ForegroundColor Green
    }
    Write-Host ""

    # Install Qt
    Write-Host "  [$SCRIPT_INDEX] Installing Qt to: $qtInstallDir" -ForegroundColor Cyan

    $installProcess = Start-Process -FilePath "cmake" -ArgumentList "--install", "." -Wait -NoNewWindow -PassThru

    if ($installProcess.ExitCode -ne 0) {
        Write-Host "  [$SCRIPT_INDEX] WARNING: Qt installation failed with exit code: $($installProcess.ExitCode)" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] This may be due to missing Visual Studio or other prerequisites" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX] Attempting to continue with environment setup..." -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX] Note: Qt may not be fully functional if installation failed" -ForegroundColor Yellow
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Qt installation completed successfully" -ForegroundColor Green
    }
    Write-Host ""
}
catch {
    Write-Host "  [$SCRIPT_INDEX] WARNING: An exception occurred during Qt build process" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] Continuing with environment setup..." -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] Note: Qt may not be fully functional due to build errors" -ForegroundColor Yellow
}
finally {
    Pop-Location
}

# Add Qt bin to PATH (if Qt was successfully installed)
Write-Host "  [$SCRIPT_INDEX] Setting up Qt environment variables..." -ForegroundColor Cyan
if (Test-Path $qtBinPath) {
    Write-Host "  [$SCRIPT_INDEX] Adding Qt bin directory to system PATH..." -ForegroundColor Cyan
    Add-ToPath -PathToAdd $qtBinPath -Scope "Machine"
    Write-Host "  [$SCRIPT_INDEX] Qt bin added to PATH: $qtBinPath" -ForegroundColor Green
}
else {
    Write-Host "  [$SCRIPT_INDEX] WARNING: Qt bin directory not found at: $qtBinPath" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] Skipping PATH update for Qt bin" -ForegroundColor Yellow
}
Write-Host ""

# Set Qt environment variables for CMake
Write-Host "  [$SCRIPT_INDEX] Configuring Qt environment variables..." -ForegroundColor Cyan

# Set QTDIR to the Qt installation root (if Qt was successfully installed)
if (Test-Path $qtInstallDir) {
    Set-EnvVar -varName "QTDIR" -varValue $qtInstallDir
    Write-Host "  [$SCRIPT_INDEX]   - QTDIR set to: $qtInstallDir" -ForegroundColor Green
}
else {
    Write-Host "  [$SCRIPT_INDEX]   - WARNING: Qt installation directory not found at: $qtInstallDir" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX]   - Skipping QTDIR environment variable setup" -ForegroundColor Yellow
}

# Detect Qt CMake config directory
$qtCMakeDir = Join-Path $qtInstallDir "lib\cmake\Qt6"
if (-not (Test-Path $qtCMakeDir)) {
    $qtCMakeDir = Join-Path $qtInstallDir "lib\cmake\Qt5"
}

if (Test-Path $qtCMakeDir) {
    # Update CMAKE_PREFIX_PATH
    $currentCMakePath = [Environment]::GetEnvironmentVariable("CMAKE_PREFIX_PATH", "Machine")
    if ($currentCMakePath -and -not $currentCMakePath.Contains($qtInstallDir)) {
        $newCMakePath = "$qtInstallDir;$currentCMakePath"
    }
    elseif (-not $currentCMakePath) {
        $newCMakePath = $qtInstallDir
    }
    else {
        $newCMakePath = $currentCMakePath
    }

    Set-EnvVar -varName "CMAKE_PREFIX_PATH" -varValue $newCMakePath
    Write-Host "  [$SCRIPT_INDEX]   - CMAKE_PREFIX_PATH includes: $qtInstallDir" -ForegroundColor Green

    # Also set Qt6_DIR or Qt5_DIR for explicit CMake detection
    $qtVersion = if ($qtCMakeDir -match "Qt6") { "Qt6" } else { "Qt5" }
    Set-EnvVar -varName "${qtVersion}_DIR" -varValue $qtCMakeDir
    Write-Host "  [$SCRIPT_INDEX]   - ${qtVersion}_DIR set to: $qtCMakeDir" -ForegroundColor Green
}
else {
    Write-Host "  [$SCRIPT_INDEX]   - WARNING: Qt CMake directory not found at: $qtCMakeDir" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX]   - This may indicate Qt installation was incomplete" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX]   - Skipping CMake environment variable setup" -ForegroundColor Yellow
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
if (Test-Path $qtExePath) {
    Write-Host "  [$SCRIPT_INDEX] Qt $QtVersion Installation Completed Successfully" -ForegroundColor Green
    Write-Host "================================================================================" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] Installation Directory: $qtInstallDir" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] qmake Path: $qtExePath" -ForegroundColor Cyan
    if (Test-Path $qtBinPath) {
        Write-Host "  [$SCRIPT_INDEX] Qt bin added to PATH: $qtBinPath" -ForegroundColor Cyan
    }
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] To use Qt in new terminal sessions:" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX]   - Close and reopen your terminal/IDE" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]   - Or run: refreshenv (if using Chocolatey)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Quick test command:" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX]   qmake --version" -ForegroundColor Gray
}
else {
    Write-Host "  [$SCRIPT_INDEX] Qt $QtVersion Installation Completed with Warnings" -ForegroundColor Yellow
    Write-Host "================================================================================" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] Qt may not be fully functional due to missing prerequisites" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] Expected Installation Directory: $qtInstallDir" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX] Expected qmake Path: $qtExePath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Please check the warnings above and install missing prerequisites:" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX]   - Visual Studio 2022 with C++ Desktop Development workload" -ForegroundColor Gray
    Write-Host "  [$SCRIPT_INDEX]   - CMake, Ninja, Python (if not already installed)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] You can run this script again after installing prerequisites" -ForegroundColor Cyan
}
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""
