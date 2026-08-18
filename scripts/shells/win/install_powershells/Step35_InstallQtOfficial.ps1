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
    [switch]$DownloadOnly = $false
)

# Script Index for logging
$SCRIPT_INDEX = "Step94"

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
$installerUrl = ""
$installerPath = ""
$qtBaseDir = ""
$qtInstallDir = ""
$qtBinPath = ""
$qtExePath = ""
$qtCMakeDir = ""
$maintenanceToolPath = ""
$currentCMakePath = ""
$newCMakePath = ""
$qtVer = ""
$launchChoice = ""
$downloadSuccess = $false
$parsedQtVersion = $null

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Qt Framework Installation - Official Installer" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host ""

# Ask user if they want to proceed with installation
Write-Host "  [$SCRIPT_INDEX] Do you want to proceed with Qt installation? (Y/n)" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX] Default: Y (Install)" -ForegroundColor Gray
$proceedChoice = Read-Host "  [$SCRIPT_INDEX]"

if ($proceedChoice -eq "N" -or $proceedChoice -eq "n") {
    Write-Host "  [$SCRIPT_INDEX] Qt installation skipped by user" -ForegroundColor Yellow
    Write-Host ""
    return
}

Write-Host "  [$SCRIPT_INDEX] Proceeding with Qt installation..." -ForegroundColor Green
Write-Host ""

Write-Host "  [$SCRIPT_INDEX] Configuration:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]   - Region: $Region" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Qt Version: $QtVersion" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Download Only: $DownloadOnly" -ForegroundColor Gray
Write-Host ""

# Validate Qt version format
if ($QtVersion -eq "Global" -or $QtVersion -eq "China" -or -not ([version]::TryParse($QtVersion, [ref]$parsedQtVersion)) -or $QtVersion.Split('.').Count -ne 3) {
    Write-Host "  [$SCRIPT_INDEX] ERROR: Invalid Qt version format: '$QtVersion'" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX] Expected format: X.Y.Z (e.g., 6.10.0)" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] Using default version: 6.10.0" -ForegroundColor Cyan
    $QtVersion = "6.10.0"
}

# Construct Qt variables
$versionParts = $QtVersion.Split('.')
if ($versionParts.Count -lt 2) {
    Write-Host "  [$SCRIPT_INDEX] ERROR: Qt version must have at least major.minor format" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX] Using default version: 6.10.0" -ForegroundColor Cyan
    $QtVersion = "6.10.0"
$versionParts = $QtVersion.Split('.')
}

$qtVersionMajorMinor = $versionParts[0] + "." + $versionParts[1]

# Determine installer URL based on region
if ($Region -eq "China") {
    $installerUrl = $Global:QT_INSTALLER_URL_CHINA
    Write-Host "  [$SCRIPT_INDEX] Using China mirror for Qt installer" -ForegroundColor Green
} else {
    $installerUrl = $Global:QT_INSTALLER_URL_GLOBAL
    Write-Host "  [$SCRIPT_INDEX] Using global mirror for Qt installer" -ForegroundColor Green
}

$installerPath = $Global:QT_INSTALLER_DOWNLOAD_PATH
$qtBaseDir = $Global:QT_INSTALL_BASE_DIR
$qtInstallDir = Join-Path $qtBaseDir $QtVersion
$qtBinPath = Join-Path $qtInstallDir "msvc2019_64\bin"
$qtExePath = Join-Path $qtBinPath "qmake.exe"
$maintenanceToolPath = Join-Path $qtBaseDir "MaintenanceTool.exe"

Write-Host "  [$SCRIPT_INDEX] Qt Installation Paths:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]   - Installer URL: $installerUrl" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Download Path: $installerPath" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Install Base: $qtBaseDir" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Install Directory: $qtInstallDir" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]   - Maintenance Tool: $maintenanceToolPath" -ForegroundColor Gray
Write-Host ""

# Check if MaintenanceTool exists (Qt already installed via official installer)
if (Test-Path $maintenanceToolPath) {
    Write-Host "  [$SCRIPT_INDEX] Qt MaintenanceTool found!" -ForegroundColor Green
    Write-Host "  [$SCRIPT_INDEX] Qt was previously installed using the official installer." -ForegroundColor Cyan
    Write-Host ""

    # Check if the specific version already exists
    if (Test-Path $qtExePath) {
        Write-Host "  [$SCRIPT_INDEX] Qt $QtVersion is already installed!" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX] qmake.exe found at: $qtExePath" -ForegroundColor Green
        Write-Host ""

        # Update environment variables
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
        $qtCMakeDir = Join-Path $qtInstallDir "msvc2019_64\lib\cmake\Qt6"
        if (-not (Test-Path $qtCMakeDir)) {
            $qtCMakeDir = Join-Path $qtInstallDir "msvc2019_64\lib\cmake\Qt5"
        }
        if (-not (Test-Path $qtCMakeDir)) {
            $qtCMakeDir = Join-Path $qtInstallDir "lib\cmake\Qt6"
        }
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
    $qtVer = if ($qtCMakeDir.Contains('Qt6')) { "Qt6" } else { "Qt5" }
            & $windowsPathFuncPath "setvar" "${qtVer}_DIR" $qtCMakeDir
            Write-Host "  [$SCRIPT_INDEX]   - ${qtVer}_DIR = $qtCMakeDir" -ForegroundColor Green
        }
        else {
            Write-Host "  [$SCRIPT_INDEX]   - WARNING: Qt CMake directory not found" -ForegroundColor Yellow
        }

        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] Environment variables updated successfully" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX] Please restart your terminal or IDE to use the updated environment" -ForegroundColor Yellow
        Write-Host ""
        return
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] Qt $QtVersion is NOT installed yet." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX] To install Qt ${QtVersion}" -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] 1. Run the MaintenanceTool:" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX]    $maintenanceToolPath" -ForegroundColor White
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] 2. Select 'Add or remove components'" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] 3. Navigate to: Qt -> Qt $qtVersionMajorMinor -> Qt $QtVersion" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] 4. Check the following components:" -ForegroundColor Yellow
        Write-Host "  [$SCRIPT_INDEX]    [X] MSVC 2019 64-bit (or MSVC 2022 64-bit)" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX]    [X] MinGW 64-bit (optional)" -ForegroundColor Gray
        Write-Host "  [$SCRIPT_INDEX]    [X] Qt 5 Compatibility Module" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX]    [X] Additional Libraries -> Qt Multimedia" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX]    [X] Additional Libraries -> Qt Network" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX]    [X] Additional Libraries -> Qt WebEngine (optional)" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] 5. Click 'Update' to install" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] 6. Run this script again to configure environment variables" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Cyan
        Write-Host ""

        # Launch MaintenanceTool if user confirms
        Write-Host "  [$SCRIPT_INDEX] Do you want to launch the MaintenanceTool now? (Y/n)" -ForegroundColor Cyan
        Write-Host "  [$SCRIPT_INDEX] Default: Y (Launch)" -ForegroundColor Gray
        $launchChoice = Read-Host "  [$SCRIPT_INDEX]"

        if ($launchChoice -ne "N" -and $launchChoice -ne "n") {
            Write-Host "  [$SCRIPT_INDEX] Launching Qt MaintenanceTool..." -ForegroundColor Green
            Write-Host ""
            Start-Process -FilePath "explorer.exe" -ArgumentList $maintenanceToolPath
            Write-Host ""
            Write-Host "  [$SCRIPT_INDEX] MaintenanceTool has been launched" -ForegroundColor Cyan
            Write-Host "  [$SCRIPT_INDEX] Please complete the installation and run this script again" -ForegroundColor Yellow
        }
        else {
            Write-Host "  [$SCRIPT_INDEX] MaintenanceTool launch skipped" -ForegroundColor Yellow
            Write-Host "  [$SCRIPT_INDEX] You can manually run: $maintenanceToolPath" -ForegroundColor White
        }

        Write-Host ""
        return
    }
}

Write-Host "  [$SCRIPT_INDEX] Qt not found, proceeding with installation..." -ForegroundColor Yellow
Write-Host ""

Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Qt Installation via Official Installer" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Cyan
Write-Host ""

# Download Qt installer using common download function
Write-Host "  [$SCRIPT_INDEX] Downloading Qt installer..." -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX] URL: $installerUrl" -ForegroundColor Gray
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
        Write-Host "  [$SCRIPT_INDEX] Installer downloaded successfully" -ForegroundColor Green
        Write-Host "  [$SCRIPT_INDEX] File size: $fileSizeMB MB" -ForegroundColor Cyan
        $downloadSuccess = $true
    }
    else {
        Write-Host "  [$SCRIPT_INDEX] ERROR: Downloaded file not found" -ForegroundColor Red
        $downloadSuccess = $false
    }
}
catch {
    Write-Host "  [$SCRIPT_INDEX] ERROR: Failed to download Qt installer" -ForegroundColor Red
    Write-Host "  [$SCRIPT_INDEX] Exception: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] You can manually download the installer from:" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] $installerUrl" -ForegroundColor White
    Write-Host "  [$SCRIPT_INDEX] Save it to: $installerPath" -ForegroundColor White
    $downloadSuccess = $false
}

if (-not $downloadSuccess) {
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Failed to download Qt installer" -ForegroundColor Red
    return
}

# Exit if DownloadOnly mode
if ($DownloadOnly) {
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Download-only mode enabled, stopping here" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] Installer ready at: $installerPath" -ForegroundColor Cyan
    Write-Host ""
    return
}

Write-Host ""
Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Magenta
Write-Host "  [$SCRIPT_INDEX] MANUAL INSTALLATION REQUIRED" -ForegroundColor Magenta
Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] The Qt installer has been downloaded." -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Please follow these steps to complete the installation:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] 1. Run the installer:" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]    $installerPath" -ForegroundColor White
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] 2. Create a Qt account or log in (required)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] 3. When prompted, select the installation directory:" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]    RECOMMENDED: $qtBaseDir" -ForegroundColor White
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] 4. Select components to install:" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]    REQUIRED components for Qt ${QtVersion}:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]      [X] Qt -> Qt $qtVersionMajorMinor -> Qt $QtVersion" -ForegroundColor Green
Write-Host "  [$SCRIPT_INDEX]      [X] MSVC 2019 64-bit (or MSVC 2022 64-bit)" -ForegroundColor Green
Write-Host "  [$SCRIPT_INDEX]      [X] Qt 5 Compatibility Module (if available)" -ForegroundColor Green
Write-Host "  [$SCRIPT_INDEX]      [X] Additional Libraries -> Qt Multimedia" -ForegroundColor Green
Write-Host "  [$SCRIPT_INDEX]      [X] Additional Libraries -> Qt Network" -ForegroundColor Green
Write-Host ""
Write-Host "  [$SCRIPT_INDEX]    OPTIONAL components:" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]      [ ] MinGW 64-bit (for GCC compiler)" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]      [ ] Additional Libraries -> Qt WebEngine" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]      [ ] Developer and Designer Tools -> Qt Creator" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]      [ ] Developer and Designer Tools -> CMake" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]      [ ] Developer and Designer Tools -> Ninja" -ForegroundColor Gray
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] 5. Click 'Install' and wait for completion (10-30 minutes)" -ForegroundColor Yellow
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] 6. After installation completes, run this script again to" -ForegroundColor Yellow
Write-Host "  [$SCRIPT_INDEX]    - Verify Qt installation" -ForegroundColor Gray
Write-Host "  [$SCRIPT_INDEX]    - Configure environment variables" -ForegroundColor Gray
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] ==========================================" -ForegroundColor Magenta
Write-Host ""

# Launch installer if user confirms
Write-Host "  [$SCRIPT_INDEX] Do you want to launch the installer now? (Y/n)" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX] Default: Y (Launch)" -ForegroundColor Gray
$launchChoice = Read-Host "  [$SCRIPT_INDEX]"

if ($launchChoice -ne "N" -and $launchChoice -ne "n") {
    Write-Host "  [$SCRIPT_INDEX] Launching Qt installer..." -ForegroundColor Green
    Write-Host ""
    Start-Process -FilePath "explorer.exe" -ArgumentList $installerPath
    Write-Host ""
    Write-Host "  [$SCRIPT_INDEX] Qt installer has been launched in background" -ForegroundColor Cyan
    Write-Host "  [$SCRIPT_INDEX] Please complete the installation and run this script again to verify installation" -ForegroundColor Yellow
    Write-Host ""
}
else {
    Write-Host "  [$SCRIPT_INDEX] Installer launch skipped" -ForegroundColor Yellow
    Write-Host "  [$SCRIPT_INDEX] You can manually run: $installerPath" -ForegroundColor White
    Write-Host ""
}

Write-Host ""
Write-Host "================================================================================" -ForegroundColor Green
Write-Host "  [$SCRIPT_INDEX] Qt Installer Setup Complete" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  [$SCRIPT_INDEX] Next steps:" -ForegroundColor Cyan
Write-Host "  [$SCRIPT_INDEX]   1. Complete the installation using the Qt installer" -ForegroundColor White
Write-Host "  [$SCRIPT_INDEX]   2. Run this script again to configure environment variables" -ForegroundColor White
Write-Host ""
Write-Host "================================================================================" -ForegroundColor Green
Write-Host ""
