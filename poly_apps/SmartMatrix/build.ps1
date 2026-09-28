<#
.SYNOPSIS
    SmartMatrix Modern UI Build Script

.DESCRIPTION
    Automatically detect environment and build SmartMatrix project with Modern UI
    Support auto-detection of Qt, Visual Studio, CMake from system-specific dev directories

.PARAMETER BuildType
    Build type: Debug, Release, RelWithDebInfo (default), MinSizeRel

.PARAMETER Architecture
    Target architecture: x86, x64 (default)

.PARAMETER QtPath
    Qt installation path, auto-detect if not specified

.PARAMETER Publish
    Package for distribution after build

.PARAMETER Clean
    Clean temporary files before build
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('Debug', 'Release', 'RelWithDebInfo', 'MinSizeRel')]
    [string]$BuildType = 'RelWithDebInfo',

    [Parameter(Mandatory=$false)]
    [ValidateSet('x86', 'x64')]
    [string]$Architecture = 'x64',

    [Parameter(Mandatory=$false)]
    [string]$QtPath = '',

    [Parameter(Mandatory=$false)]
    [switch]$Publish = $false,

    [Parameter(Mandatory=$false)]
    [switch]$Clean = $false
)

# Import GlobalVars using relative path
$scriptRoot = $PSScriptRoot
$globalVarsPath = Join-Path (Split-Path (Split-Path $scriptRoot -Parent) -Parent) "scripts\shells\win\win_common\GlobalVars.ps1"
. $globalVarsPath

# Color output functions
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$ForegroundColor = 'White'
    )
    Write-Host $Message -ForegroundColor $ForegroundColor
}

function Write-Section {
    param([string]$Title)
    Write-Host "`n================================================================" -ForegroundColor Cyan
    Write-Host " $Title" -ForegroundColor Cyan
    Write-Host "================================================================`n" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput "[OK] $Message" 'Green'
}

function Write-Error-Custom {
    param([string]$Message)
    Write-ColorOutput "[ERROR] $Message" 'Red'
}

function Write-Warning-Custom {
    param([string]$Message)
    Write-ColorOutput "[WARN] $Message" 'Yellow'
}

# Get dev directory from GlobalVars or detect manually
function Get-DevDirectory {
    # Use GlobalVars if loaded
    if ($Global:LANG_COMPILER_DIR) {
        Write-Host "  Using system dev directory: $Global:LANG_COMPILER_DIR" -ForegroundColor Cyan
        return $Global:LANG_COMPILER_DIR
    }

    # Fallback: manual detection
    Write-Section "Detecting System Version"

    $osInfo = Get-CimInstance Win32_OperatingSystem
    $winBuild = [int]$osInfo.BuildNumber

    $systemName = "win"
    if ($winBuild -ge 22000) {
        $systemName = "win11"
        Write-Host "  Detected: Windows 11 (Build $winBuild)" -ForegroundColor Green
    }
    elseif ($osInfo.Version.StartsWith("10.0")) {
        $systemName = "win10"
        Write-Host "  Detected: Windows 10 (Build $winBuild)" -ForegroundColor Green
    }
    else {
        Write-Warning-Custom "Unknown Windows version, using default"
    }

    $devDir = "D:\.dev_$systemName"
    Write-Host "  Dev directory: $devDir" -ForegroundColor Cyan
    return $devDir
}

# Test if directory contains Qt installation
function Test-IsQtDirectory {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return $false
    }

    # Check for MSVC/MinGW directories ONLY in the current path
    # Do NOT recurse into version subdirectories here
    $msvcDirs = Get-ChildItem $Path -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -match '^(msvc\d+|mingw)' }

    if ($msvcDirs) {
        foreach ($msvcDir in $msvcDirs) {
            $binPath = Join-Path $msvcDir.FullName "bin"
            if (Test-Path $binPath) {
                $qtFiles = Get-ChildItem $binPath -File -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match '^(qmake\.exe|Qt[58]Core\.dll)$' }
                if ($qtFiles) {
                    return $true
                }
                }
            }
        }

    # Do NOT check for version subdirectories here
    # This function should only validate the CURRENT directory
        return $false
}

# Find Qt in system dev directory
function Find-QtInDevDirectory {
    param([string]$DevDir)

    if (-not (Test-Path $DevDir)) {
        Write-Host "  Dev directory not found: $DevDir" -ForegroundColor Gray
        return $null
    }

    Write-Host "  Scanning: $DevDir" -ForegroundColor Gray

    # Level 1: Direct subdirectories
    $subdirs = Get-ChildItem $DevDir -Directory -ErrorAction SilentlyContinue

    $qtCandidates = @()

    foreach ($dir in $subdirs) {
        # Check if directory name suggests it's Qt-related
        if ($dir.Name -match '(qt|Qt)') {
            Write-Host "  DEBUG: Checking Qt directory: $($dir.FullName)" -ForegroundColor DarkGray

            # First, check version subdirectories
            $versionDirs = Get-ChildItem $dir.FullName -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^\d+\.\d+(\.\d+)?$' }

            Write-Host "  DEBUG: Found $($versionDirs.Count) version directories in $($dir.Name)" -ForegroundColor DarkGray

            $foundVersionDirs = $false
            foreach ($versionDir in $versionDirs) {
                Write-Host "  DEBUG: Testing version dir: $($versionDir.FullName)" -ForegroundColor DarkGray
                if (Test-IsQtDirectory -Path $versionDir.FullName) {
                    Write-Host "  DEBUG: Valid Qt installation found: $($versionDir.FullName)" -ForegroundColor Green
                    $qtCandidates += $versionDir.FullName
                    $foundVersionDirs = $true
                } else {
                    Write-Host "  DEBUG: Not a valid Qt installation: $($versionDir.FullName)" -ForegroundColor DarkGray
                }
            }

            # Only check parent directory if no version subdirectories found
            if (-not $foundVersionDirs) {
                Write-Host "  DEBUG: No version subdirs found, checking parent: $($dir.FullName)" -ForegroundColor DarkGray
                if (Test-IsQtDirectory -Path $dir.FullName) {
                    Write-Host "  DEBUG: Parent is valid Qt installation: $($dir.FullName)" -ForegroundColor Green
                    $qtCandidates += $dir.FullName
    } else {
                    Write-Host "  DEBUG: Parent is not valid Qt installation" -ForegroundColor DarkGray
                }
            } else {
                Write-Host "  DEBUG: Skipping parent directory check (found $($qtCandidates.Count) version dirs)" -ForegroundColor DarkGray
            }
        }
    }

    if ($qtCandidates.Count -gt 0) {
        Write-Host ""
        Write-Host "  Found $($qtCandidates.Count) Qt installation(s):" -ForegroundColor Yellow

        # DEBUG: Print all candidates before sorting
        Write-Host "  DEBUG: Candidates before sorting:" -ForegroundColor DarkGray
        foreach ($cand in $qtCandidates) {
            Write-Host "    - $cand" -ForegroundColor DarkGray
        }

        # Sort by version (prefer higher versions)
        # Note: Sort-Object returns the objects themselves, not the script block values
        # IMPORTANT: Use @() to ensure result is always an array, even with single element
        $sorted = @($qtCandidates | Sort-Object {
            $pathString = $_.ToString()
            if ($pathString -match '(\d+)\.(\d+)(\.(\d+))?') {
                $major = [int]$matches[1]
                $minor = [int]$matches[2]
                $patch = if ($matches[4]) { [int]$matches[4] } else { 0 }
                # Use negative value for descending order
                -($major * 10000 + $minor * 100 + $patch)
            } else {
                0
            }
        })

        # DEBUG: Print sorted results
        Write-Host "  DEBUG: Candidates after sorting:" -ForegroundColor DarkGray
        foreach ($cand in $sorted) {
            Write-Host "    - $cand (Type: $($cand.GetType().Name))" -ForegroundColor DarkGray
        }

        # Display all candidates with version and compiler info
        $index = 1
        foreach ($candidate in $sorted) {
            $versionMatch = $candidate -match '[\\/](\d+\.\d+(?:\.\d+)?)[\\/]?'
            $versionStr = if ($versionMatch) { $matches[1] } else { "unknown" }

            $compilers = Get-ChildItem $candidate -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^(msvc\d+|mingw)' } |
                Select-Object -ExpandProperty Name

            if ($compilers) {
                $compilerList = ($compilers | Sort-Object) -join ', '
                $marker = if ($index -eq 1) { "[SELECTED]" } else { "          " }
                Write-Host "  $marker Qt $versionStr" -ForegroundColor $(if ($index -eq 1) { 'Green' } else { 'Cyan' })
                Write-Host "            Path: $candidate" -ForegroundColor Gray
                Write-Host "            Compilers: $compilerList" -ForegroundColor Gray
                Write-Host ""
            }
            $index++
        }

        $bestQt = $sorted[0]

        # DEBUG: Detailed info about selected Qt
        Write-Host ""
        Write-Host "  DEBUG: Selected Qt details:" -ForegroundColor DarkGray
        Write-Host "    - Value: $bestQt" -ForegroundColor DarkGray
        Write-Host "    - Type: $($bestQt.GetType().FullName)" -ForegroundColor DarkGray
        Write-Host "    - Length: $($bestQt.Length)" -ForegroundColor DarkGray
        Write-Host ""

        Write-Success "Using Qt: $bestQt"

        # Display directory structure of selected Qt
        Write-Host ""
        Write-Host "  Qt Installation Structure:" -ForegroundColor Yellow
        $qtDirs = Get-ChildItem $bestQt -Directory -ErrorAction SilentlyContinue | Sort-Object Name
        foreach ($dir in $qtDirs) {
            if ($dir.Name -match '^(msvc\d+|mingw)') {
                # Check for qmake.exe to verify it's a valid compiler installation
                $qmakePath = Join-Path $dir.FullName "bin\qmake.exe"
                if (Test-Path $qmakePath) {
                    $qtCoreVer = if (Test-Path (Join-Path $dir.FullName "bin\Qt6Core.dll")) { "Qt6" } elseif (Test-Path (Join-Path $dir.FullName "bin\Qt5Core.dll")) { "Qt5" } else { "Qt?" }
                    Write-Host "    [OK] $($dir.Name) ($qtCoreVer)" -ForegroundColor Green
    } else {
                    Write-Host "    [  ] $($dir.Name) (incomplete)" -ForegroundColor DarkGray
                }
            } else {
                Write-Host "         $($dir.Name)" -ForegroundColor DarkGray
            }
        }
        Write-Host ""

        return $bestQt
    }

    return $null
}

# Detect Qt
function Find-Qt {
    param([string]$CustomPath)

    Write-Section "Detecting Qt"

    # 1. Check custom path
    if ($CustomPath -and (Test-Path $CustomPath)) {
        if (Test-IsQtDirectory -Path $CustomPath) {
            Write-Success "Using specified Qt path: $CustomPath"
            return $CustomPath
        }
        Write-Warning-Custom "Specified path does not contain valid Qt: $CustomPath"
    }

    # 2. Check environment variables
    if ($env:QTDIR -and (Test-Path $env:QTDIR)) {
        if (Test-IsQtDirectory -Path $env:QTDIR) {
        Write-Success "Found Qt from QTDIR: $env:QTDIR"
        return $env:QTDIR
        }
    }

    # 3. Check system-specific dev directory
    $devDir = Get-DevDirectory
    $qtPath = Find-QtInDevDirectory -DevDir $devDir

    if ($qtPath) {
        return $qtPath
    }

    # 4. Check standard paths
    $standardPaths = @("C:\Qt", "D:\Qt")
    foreach ($basePath in $standardPaths) {
        if (Test-Path $basePath) {
            $versions = Get-ChildItem $basePath -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
                Sort-Object -Descending

            if ($versions) {
                $qtPath = $versions[0].FullName
                Write-Success "Found Qt: $qtPath"
                return $qtPath
            }
        }
    }

    Write-Error-Custom "Qt not found"
    return $null
}

# Get Qt CMake path
function Get-QtCMakePath {
    param(
        [string]$QtBasePath,
        [string]$Arch
    )

    $archSuffix = if ($Arch -eq 'x64') { '_64' } else { '' }
    $qtVersions = @('Qt6', 'Qt5')

    # Try MSVC versions
    $msvcVersions = @('2022', '2019', '2017', '2015')
    foreach ($version in $msvcVersions) {
        $msvcDir = "msvc$version$archSuffix"
        foreach ($qtVer in $qtVersions) {
            $path = Join-Path $QtBasePath "$msvcDir\lib\cmake\$qtVer"
            if (Test-Path $path) {
                Write-Success "Found Qt CMake config: $path"
                return $path
            }
        }
    }

    # Try MinGW
    $mingwDir = "mingw$archSuffix"
    foreach ($qtVer in $qtVersions) {
        $path = Join-Path $QtBasePath "$mingwDir\lib\cmake\$qtVer"
        if (Test-Path $path) {
            Write-Success "Found Qt CMake config: $path"
            Write-Warning-Custom "Using MinGW. Note: This project requires MSVC for proper compilation."
            return $path
        }
    }

    Write-Warning-Custom "Qt CMake config not found, using fallback"
    $fallbackPath = Join-Path $QtBasePath "msvc2019$archSuffix\lib\cmake\Qt5"
    return $fallbackPath
}

# Detect CMake
function Test-CMake {
    Write-Section "Detecting CMake"

    try {
        $cmakeVersion = cmake --version 2>&1 | Select-Object -First 1
        Write-Success "Found CMake: $cmakeVersion"
            return $true
        }
    catch {
        # Search in dev directory
        $devDir = Get-DevDirectory
        if (Test-Path $devDir) {
            $cmakeExe = Get-ChildItem -Path $devDir -Recurse -Filter "cmake.exe" -ErrorAction SilentlyContinue |
                Select-Object -First 1

            if ($cmakeExe) {
                $cmakeBinDir = $cmakeExe.DirectoryName
                $env:Path = "$cmakeBinDir;$env:Path"

                try {
                    $cmakeVersion = cmake --version 2>&1 | Select-Object -First 1
                    Write-Success "Found CMake: $cmakeVersion"
                    Write-Host "  Location: $cmakeBinDir" -ForegroundColor Gray
                return $true
            }
                catch {}
        }
    }

        Write-Error-Custom "CMake not found"
    return $false
    }
}

# Detect Visual Studio
function Find-VisualStudio {
    Write-Section "Detecting Visual Studio"

    $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"

    if (-not (Test-Path $vsWhere)) {
        Write-Error-Custom "vswhere.exe not found"
        return $null
    }

    $vsPath = & $vsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath

    if ($vsPath) {
        $vsVersion = & $vsWhere -latest -property catalog_productDisplayVersion
        Write-Success "Found Visual Studio: $vsVersion"
        return @{
            Path = $vsPath
            Version = $vsVersion
        }
    }

    Write-Error-Custom "Visual Studio not found"
    return $null
}

# Set Qt environment variables for CMake
function Set-QtEnvironment {
    param(
        [string]$QtBasePath,
        [string]$QtCMakePath
    )

    Write-Section "Configuring Qt Environment"

    # Set QTDIR environment variable
    $env:QTDIR = $QtBasePath
    Write-Host "  QTDIR = $QtBasePath" -ForegroundColor Gray

    # Set CMAKE_PREFIX_PATH to Qt base path
    if ($env:CMAKE_PREFIX_PATH) {
        if (-not $env:CMAKE_PREFIX_PATH.Contains($QtBasePath)) {
            $env:CMAKE_PREFIX_PATH = "$QtBasePath;$env:CMAKE_PREFIX_PATH"
        }
    } else {
        $env:CMAKE_PREFIX_PATH = $QtBasePath
    }
    Write-Host "  CMAKE_PREFIX_PATH = $env:CMAKE_PREFIX_PATH" -ForegroundColor Gray

    # Set Qt6_DIR or Qt5_DIR for explicit CMake detection
    if ($QtCMakePath -match "Qt6") {
        $env:Qt6_DIR = $QtCMakePath
        Write-Host "  Qt6_DIR = $QtCMakePath" -ForegroundColor Gray
    } elseif ($QtCMakePath -match "Qt5") {
        $env:Qt5_DIR = $QtCMakePath
        Write-Host "  Qt5_DIR = $QtCMakePath" -ForegroundColor Gray
    }

    Write-Success "Qt environment variables configured"
}

# Update i18n translations function
function Update-Translations {
    param(
        [string]$QtBasePath
    )
    
    Write-Section "Updating i18n Translations"

    $scriptPath = $PSScriptRoot
    $i18nPath = Join-Path $scriptPath "QtSmartMatrix\res\i18n"
    
    # Check if i18n directory exists
    if (-not (Test-Path $i18nPath)) {
        Write-Warning-Custom "i18n directory not found: $i18nPath"
        return $false
    }
    
    Write-Host "Found i18n directory: $i18nPath" -ForegroundColor Green
    
    # Find lrelease.exe
    $lreleasePath = $null
    $msvcVersions = @('2022', '2019', '2017', '2015')
    $archSuffix = if ($Architecture -eq 'x64') { '_64' } else { '' }
    
    # Try MSVC directories
    foreach ($version in $msvcVersions) {
        $msvcDir = "msvc$version$archSuffix"
        $testPath = Join-Path $QtBasePath "$msvcDir\bin\lrelease.exe"
        if (Test-Path $testPath) {
            $lreleasePath = $testPath
            break
        }
    }
    
    # Try MinGW directory
    if (-not $lreleasePath) {
        $mingwDir = "mingw$archSuffix"
        $testPath = Join-Path $QtBasePath "$mingwDir\bin\lrelease.exe"
        if (Test-Path $testPath) {
            $lreleasePath = $testPath
        }
    }
    
    # Try direct bin path
    if (-not $lreleasePath) {
        $testPath = Join-Path $QtBasePath "bin\lrelease.exe"
        if (Test-Path $testPath) {
            $lreleasePath = $testPath
        }
    }
    
    if (-not $lreleasePath) {
        Write-Warning-Custom "lrelease.exe not found in Qt installation"
        return $false
    }
    
    Write-Host "Found lrelease.exe: $lreleasePath" -ForegroundColor Green
    
    # Find all .ts files in i18n directory
    $tsFiles = Get-ChildItem -Path $i18nPath -Filter "*.ts" -File
    
    if ($tsFiles.Count -eq 0) {
        Write-Warning-Custom "No .ts translation files found in $i18nPath"
        return $false
    }
    
    Write-Host "Found $($tsFiles.Count) translation files:" -ForegroundColor Yellow
    foreach ($file in $tsFiles) {
        Write-Host "  - $($file.Name)" -ForegroundColor Gray
    }
    
    # Update each .ts file to .qm
    $successCount = 0
    foreach ($tsFile in $tsFiles) {
        $tsPath = $tsFile.FullName
        $qmPath = $tsPath -replace '\.ts$', '.qm'
        
        Write-Host "`nProcessing: $($tsFile.Name)" -ForegroundColor Yellow
        
        try {
            # Run lrelease.exe
            $result = & $lreleasePath $tsPath 2>&1
            
            if ($LASTEXITCODE -eq 0) {
                if (Test-Path $qmPath) {
                    Write-Host "  [OK] Generated: $([System.IO.Path]::GetFileName($qmPath))" -ForegroundColor Green
                    $successCount++
                } else {
                    Write-Warning-Custom "  lrelease succeeded but .qm file not found: $qmPath"
                }
            } else {
                Write-Warning-Custom "  lrelease failed for $($tsFile.Name): $result"
            }
        }
        catch {
            Write-Warning-Custom "  Error processing $($tsFile.Name): $_"
        }
    }
    
    if ($successCount -gt 0) {
        Write-Success "Successfully updated $successCount translation files"
        return $true
    } else {
        Write-Warning-Custom "No translation files were successfully updated"
        return $false
    }
}

# Build function
function Start-Build {
    param(
        [string]$BuildType,
        [string]$Arch,
        [string]$QtCMakePath
    )

    Write-Section "Starting Build"

    $scriptPath = $PSScriptRoot
    $outputPath = Join-Path $scriptPath "output"
    $tempPath = Join-Path $scriptPath "ci\build_temp"

    if ($Clean -and (Test-Path $outputPath)) {
            Remove-Item $outputPath -Recurse -Force
            Write-Success "Cleaned output directory"
    }

    if (Test-Path $tempPath) {
        Remove-Item $tempPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $tempPath -Force | Out-Null

    Push-Location $tempPath

    try {
        Write-Host "`nConfiguring CMake..." -ForegroundColor Yellow

        $cmakeArch = if ($Arch -eq 'x64') { 'x64' } else { 'Win32' }
        $cmakeParams = @(
            "-DCMAKE_PREFIX_PATH=$QtCMakePath",
            "-DCMAKE_BUILD_TYPE=$BuildType",
            "-G", "Visual Studio 17 2022",
            "-A", $cmakeArch
        )

        # Modern UI is hardcoded and always enabled
        $cmakeParams += "-DENABLE_MODERN_UI=ON"
        $cmakeParams += "-DENABLE_LEGACY_UI=OFF"
        $cmakeParams += "-DENABLE_HYBRID_UI=OFF"
        $cmakeParams += "-DUI_MODE=modern"

        # Add source directory
        $cmakeParams += "../.."

        & cmake $cmakeParams
        if ($LASTEXITCODE -ne 0) {
            throw "CMake configuration failed"
        }
        Write-Success "CMake configured"

        Write-Host "`nBuilding..." -ForegroundColor Yellow
        & cmake --build . --config $BuildType -j8
        if ($LASTEXITCODE -ne 0) {
            throw "Build failed"
        }

        Write-Success "Build completed!"
        return $true
    }
    catch {
        Write-Error-Custom "Build error: $_"
        return $false
    }
    finally {
        Pop-Location
    }
}

# Publish function
function Start-Publish {
    param(
        [string]$Arch,
        [string]$QtBasePath
    )

    Write-Section "Packaging"

    $scriptPath = $PSScriptRoot
    $buildType = "RelWithDebInfo"
    $publishDir = "publish_$Arch"
    $publishPath = Join-Path $scriptPath $publishDir
    $releasePath = Join-Path $scriptPath "output\$Arch\$buildType"

    # Find Qt bin path
    $msvcVersions = @('2022', '2019', '2017', '2015')
    $archSuffix = if ($Arch -eq 'x64') { '_64' } else { '' }
    $qtBinPath = $null

    # Try MSVC directories
    foreach ($version in $msvcVersions) {
        $msvcDir = "msvc$version$archSuffix"
        $testPath = Join-Path $QtBasePath "$msvcDir\bin"
        if (Test-Path $testPath) {
            $qtBinPath = $testPath
            break
        }
    }

    # Try MinGW directory
    if (-not $qtBinPath) {
        $mingwDir = "mingw$archSuffix"
        $testPath = Join-Path $QtBasePath "$mingwDir\bin"
        if (Test-Path $testPath) {
            $qtBinPath = $testPath
        }
    }

    # Try direct bin path
    if (-not $qtBinPath) {
        $testPath = Join-Path $QtBasePath "bin"
        if (Test-Path $testPath) {
            $qtBinPath = $testPath
        }
    }

    if (-not $qtBinPath) {
        Write-Error-Custom "Qt bin directory not found"
        return $false
    }

    if (Test-Path $publishPath) {
        Remove-Item $publishPath -Recurse -Force
    }
    New-Item -ItemType Directory -Path $publishPath -Force | Out-Null

    Write-Host "Copying files..." -ForegroundColor Yellow
    Copy-Item "$releasePath\*" -Destination $publishPath -Recurse -Force

    # Copy dependencies
    $adbPath = Join-Path $scriptPath "QtSmartMatrix\SmartMatrixCore\src\third_party\adb\win"
    $jarPath = Join-Path $scriptPath "QtSmartMatrix\SmartMatrixCore\src\third_party\scrcpy-server"
    $keymapPath = Join-Path $scriptPath "keymap"
    $configPath = Join-Path $scriptPath "config"

    if (Test-Path $adbPath) {
    Copy-Item "$adbPath\*" -Destination $publishPath -Force
    }
    if (Test-Path $jarPath) {
    Copy-Item $jarPath -Destination $publishPath -Force
    }
    if (Test-Path $keymapPath) {
    Copy-Item $keymapPath -Destination "$publishPath\keymap" -Recurse -Force
    }
    if (Test-Path $configPath) {
    Copy-Item $configPath -Destination "$publishPath\config" -Recurse -Force
    }

    # Copy translation files
    $i18nSourcePath = Join-Path $scriptPath "QtSmartMatrix\res\i18n"
    $i18nDestPath = Join-Path $publishPath "translations"
    if (Test-Path $i18nSourcePath) {
        New-Item -ItemType Directory -Path $i18nDestPath -Force | Out-Null
        $qmFiles = Get-ChildItem -Path $i18nSourcePath -Filter "*.qm" -File
        foreach ($qmFile in $qmFiles) {
            Copy-Item $qmFile.FullName -Destination $i18nDestPath -Force
            Write-Host "  Copied translation: $($qmFile.Name)" -ForegroundColor Gray
        }
        Write-Host "Translation files copied to: $i18nDestPath" -ForegroundColor Green
    }

    # Run windeployqt (with translations support)
    Write-Host "Running windeployqt..." -ForegroundColor Yellow
    $env:Path = "$qtBinPath;$env:Path"
    $exePath = Join-Path $publishPath "SmartMatrix.exe"
    & windeployqt $exePath

    Write-Success "Packaging complete!"
    return $true
}

# ============================================================================
# Main Program
# ============================================================================

Write-Host @"

    ================================================================
                    SmartMatrix Modern UI Build Script
    ================================================================

"@ -ForegroundColor Cyan

Write-Host "Build Configuration:" -ForegroundColor Yellow
Write-Host "  Build Type: $BuildType" -ForegroundColor Gray
Write-Host "  Architecture: $Architecture" -ForegroundColor Gray
Write-Host "  UI: Modern UI (Hardcoded)" -ForegroundColor Gray
Write-Host ""

# Environment detection
$allChecksPass = $true

if (-not (Test-CMake)) {
    $allChecksPass = $false
}

$vsInfo = Find-VisualStudio
if (-not $vsInfo) {
    $allChecksPass = $false
}

$qtBasePath = Find-Qt -CustomPath $QtPath
if (-not $qtBasePath) {
    Write-Host ""
    Write-Error-Custom "Qt not found. Please install Qt 6.9.3 or later"
        Write-Host ""
    Write-Host "Installation suggestions:" -ForegroundColor Yellow
    Write-Host "  1. Download Qt from: https://www.qt.io/download-qt-installer" -ForegroundColor Cyan
    Write-Host "  2. Install to system dev directory (recommended)" -ForegroundColor Cyan
    Write-Host "  3. Or specify path: .\build.ps1 -QtPath `"D:\path\to\qt`"" -ForegroundColor Cyan
        Write-Host ""
        exit 1
}

if (-not $allChecksPass) {
    Write-Error-Custom "Environment check failed"
    exit 1
}

# Get Qt CMake path
$qtCMakePath = Get-QtCMakePath -QtBasePath $qtBasePath -Arch $Architecture

# Configure Qt environment variables
Set-QtEnvironment -QtBasePath $qtBasePath -QtCMakePath $qtCMakePath

# Update i18n translations
$translationSuccess = Update-Translations -QtBasePath $qtBasePath
if ($translationSuccess) {
    Write-Host "`nTranslation files updated successfully" -ForegroundColor Green
} else {
    Write-Host "`nTranslation update completed with warnings" -ForegroundColor Yellow
}

# Start build
$buildSuccess = Start-Build -BuildType $BuildType -Arch $Architecture -QtCMakePath $qtCMakePath

if (-not $buildSuccess) {
    Write-Error-Custom "Build failed"
    exit 1
}

# Deploy Qt dependencies to output directory
Write-Section "Deploying Qt Dependencies"
$scriptPath = $PSScriptRoot

# Find the latest output directory with timestamp
$outputDirs = Get-ChildItem -Path $scriptPath -Directory -Filter "output_*" |
    Sort-Object Name -Descending |
    Select-Object -First 1

if ($outputDirs) {
    $outputPath = Join-Path $outputDirs.FullName "$Architecture\$BuildType"
    $exePath = Join-Path $outputPath "SmartMatrix.exe"
    Write-Host "Using output directory: $($outputDirs.Name)" -ForegroundColor Cyan
} else {
    # Fallback to default output directory
    $outputPath = Join-Path $scriptPath "output\$Architecture\$BuildType"
    $exePath = Join-Path $outputPath "SmartMatrix.exe"
    Write-Warning-Custom "No timestamped output directory found, using default"
}

if (Test-Path $exePath) {
    # Find Qt bin path
    $msvcVersions = @('2022', '2019', '2017', '2015')
    $archSuffix = if ($Architecture -eq 'x64') { '_64' } else { '' }
    $qtBinPath = $null

    # Try MSVC directories
    foreach ($version in $msvcVersions) {
        $msvcDir = "msvc$version$archSuffix"
        $testPath = Join-Path $qtBasePath "$msvcDir\bin"
        if (Test-Path $testPath) {
            $qtBinPath = $testPath
            break
        }
    }

    # Try MinGW directory
    if (-not $qtBinPath) {
        $mingwDir = "mingw$archSuffix"
        $testPath = Join-Path $qtBasePath "$mingwDir\bin"
        if (Test-Path $testPath) {
            $qtBinPath = $testPath
        }
    }

    # Try direct bin path
    if (-not $qtBinPath) {
        $testPath = Join-Path $qtBasePath "bin"
        if (Test-Path $testPath) {
            $qtBinPath = $testPath
        }
    }

    if ($qtBinPath) {
        Write-Host "Running windeployqt to deploy Qt dependencies..." -ForegroundColor Yellow
        $env:Path = "$qtBinPath;$env:Path"

        try {
            # Use verbose mode and ensure all necessary modules are deployed
            & windeployqt --verbose 1 --force $exePath
            if ($LASTEXITCODE -eq 0) {
                Write-Success "Qt dependencies deployed successfully"
            } else {
                Write-Warning-Custom "windeployqt completed with warnings (exit code: $LASTEXITCODE)"
            }
        }
        catch {
            Write-Warning-Custom "windeployqt failed: $_"
        }
    } else {
        Write-Warning-Custom "Qt bin directory not found, skipping windeployqt"
    }
} else {
    Write-Warning-Custom "Executable not found: $exePath"
}

# Copy modern UI resources (always enabled)
Write-Section "Copying Modern UI Resources"

    # Reuse the output path found earlier
    if (-not $outputPath) {
        $outputDirs = Get-ChildItem -Path $scriptPath -Directory -Filter "output_*" |
            Sort-Object Name -Descending |
            Select-Object -First 1
        if ($outputDirs) {
            $outputPath = Join-Path $outputDirs.FullName "$Architecture\$BuildType"
        } else {
            $outputPath = Join-Path $scriptPath "output\$Architecture\$BuildType"
        }
    }

    $modernUIResources = @(
        "QtSmartMatrix\ui\icons",
        "QtSmartMatrix\ui\res",
        "QtSmartMatrix\ui\image"
    )

    foreach ($Resource in $modernUIResources) {
        $SourcePath = Join-Path $scriptPath $Resource
        $DestPath = Join-Path $outputPath $Resource
        
        if (Test-Path $SourcePath) {
            if (-not (Test-Path $DestPath)) {
                New-Item -ItemType Directory -Path $DestPath -Force | Out-Null
            }
            Copy-Item -Path "$SourcePath\*" -Destination $DestPath -Recurse -Force
            Write-Success "Copied: $Resource"
        } else {
            Write-Warning-Custom "Resource not found: $Resource"
        }
    }
    
    # Create modern UI configuration file
    $ConfigPath = Join-Path $outputPath "modern_ui_config.json"
    $ConfigContent = @{
        "ui_mode" = "modern"
        "modern_ui_enabled" = $true
        "hybrid_ui_enabled" = $false
        "legacy_ui_enabled" = $false
        "version" = "2.0.0"
        "build_type" = $BuildType
        "architecture" = $Architecture
        "qt_version" = "6.9.3"
    } | ConvertTo-Json -Depth 3
    
    Set-Content -Path $ConfigPath -Value $ConfigContent -Encoding UTF8
    Write-Success "Created: modern_ui_config.json"

# Publish if requested
if ($Publish) {
    $publishSuccess = Start-Publish -Arch $Architecture -QtBasePath $qtBasePath
    if (-not $publishSuccess) {
        Write-Error-Custom "Packaging failed"
        exit 1
    }
}

Write-Section "All Done!"
Write-Host "Build Type: $BuildType" -ForegroundColor Green
Write-Host "Architecture: $Architecture" -ForegroundColor Green
Write-Host "Modern UI: Enabled (Hardcoded)" -ForegroundColor Green
Write-Host "Legacy UI: Disabled (Hardcoded)" -ForegroundColor Green
Write-Host "Hybrid UI: Disabled (Hardcoded)" -ForegroundColor Green
Write-Host "UI Mode: modern (Hardcoded)" -ForegroundColor Green

if ($Publish) {
    Write-Host "`nExecutable location: publish_$Architecture\" -ForegroundColor Yellow
} else {
    # Show the actual output directory with timestamp
    $actualOutputDir = $outputDirs.Name
    if ($actualOutputDir) {
        Write-Host "`nExecutable location: $actualOutputDir\$Architecture\$BuildType\" -ForegroundColor Yellow
    } else {
        Write-Host "`nExecutable location: output\$Architecture\$BuildType\" -ForegroundColor Yellow
    }
}

# Display modern UI features (always enabled)
Write-Host "`nModern UI Features:" -ForegroundColor Yellow
Write-Host "  - Device group management" -ForegroundColor White
Write-Host "  - Responsive grid layout" -ForegroundColor White
Write-Host "  - Modern device tree widget" -ForegroundColor White
Write-Host "  - Customizable themes" -ForegroundColor White
Write-Host "  - Smooth animations" -ForegroundColor White
Write-Host "  - Drag-and-drop support" -ForegroundColor White

Write-Host "`nUsage:" -ForegroundColor Yellow
if ($actualOutputDir) {
    Write-Host "  .\$actualOutputDir\$Architecture\$BuildType\SmartMatrix.exe    # Start with Modern UI" -ForegroundColor White
} else {
    Write-Host "  .\output\$Architecture\$BuildType\SmartMatrix.exe    # Start with Modern UI" -ForegroundColor White
}

Write-Host ""
exit 0
