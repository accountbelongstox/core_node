<#
========================================
XingCan Cloud Matrix (星灿传媒云矩阵)
Unified Build Script for Windows
========================================
Auto-detects Qt 6.x + MSVC, downloads dependencies, compiles and builds
Usage: .\start.ps1 [-Config release|debug] [-Deploy] [-SkipDownload]
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("release", "debug")]
    [string]$Config = "release",

    [Parameter(Mandatory=$false)]
    [switch]$Deploy = $false,

    [Parameter(Mandatory=$false)]
    [switch]$SkipDownload = $false
)

# ========================================
# CONFIGURATION
# ========================================
$ErrorActionPreference = "Stop"
$ScriptRoot = $PSScriptRoot
$ProjectRoot = Join-Path $ScriptRoot "TcUi"
$ScrcpyVersion = "3.3.3"
$ScrcpyTargetDir = Join-Path $ProjectRoot "third_party\scrcpy-server"
$ScrcpyFileName = "scrcpy-server-v$ScrcpyVersion"
$ScrcpyUrl = "https://github.com/Genymobile/scrcpy/releases/download/v$ScrcpyVersion/$ScrcpyFileName"

# ========================================
# HELPER FUNCTIONS
# ========================================
function Write-Banner {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Step {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Magenta
}

# ========================================
# STEP 1: DOWNLOAD SCRCPY-SERVER
# ========================================
function Download-ScrcpyServer {
    Write-Banner "Step 1: Download scrcpy-server $ScrcpyVersion"

    $targetFile = Join-Path $ScrcpyTargetDir $ScrcpyFileName

    if (Test-Path $targetFile) {
        Write-Success "scrcpy-server already exists: $targetFile"
        return $true
    }

    Write-Info "scrcpy-server not found, downloading..."
    Write-Info "URL: $ScrcpyUrl"

    # Create directory if not exists
    if (-not (Test-Path $ScrcpyTargetDir)) {
        New-Item -ItemType Directory -Path $ScrcpyTargetDir -Force | Out-Null
        Write-Info "Created directory: $ScrcpyTargetDir"
    }

    try {
        Write-Info "Downloading... (this may take a few minutes)"
        Invoke-WebRequest -Uri $ScrcpyUrl -OutFile $targetFile -UseBasicParsing

        if (Test-Path $targetFile) {
            $fileSize = (Get-Item $targetFile).Length
            Write-Success "Download complete!"
            Write-Success "File: $targetFile"
            Write-Success "Size: $([math]::Round($fileSize / 1MB, 2)) MB"

            # Create version file
            $versionInfo = @{
                version = $ScrcpyVersion
                download_date = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
                source_url = $ScrcpyUrl
            } | ConvertTo-Json

            $versionFile = Join-Path $ScrcpyTargetDir "version.json"
            $versionInfo | Out-File -FilePath $versionFile -Encoding UTF8

            return $true
        } else {
            Write-Error-Custom "Download failed - file not found after download"
            return $false
        }
    }
    catch {
        Write-Error-Custom "Download failed: $($_.Exception.Message)"
        Write-Info "You can manually download from: $ScrcpyUrl"
        return $false
    }
}

# ========================================
# STEP 2: AUTO-DETECT Qt INSTALLATION
# ========================================
function Find-QtInstallation {
    Write-Banner "Step 2: Auto-detect Qt Installation"

    # Method 1: Check if qmake is already in PATH
    Write-Info "Method 1: Checking PATH for qmake..."
    $qmakePath = Get-Command qmake -ErrorAction SilentlyContinue
    if ($qmakePath) {
        $qtBinDir = Split-Path $qmakePath.Source -Parent
        Write-Success "Found qmake in PATH: $qtBinDir"
        return $qtBinDir
    }

    # Method 2: Search common Qt installation directories
    Write-Info "Method 2: Searching common Qt locations..."
    $searchPaths = @("C:\Qt", "D:\Qt", "E:\Qt", "C:\Program Files\Qt", "D:\Program Files\Qt")

    foreach ($basePath in $searchPaths) {
        if (Test-Path $basePath) {
            Write-Info "Scanning: $basePath"

            # Search for Qt 6.x versions
            $qtVersions = Get-ChildItem -Path $basePath -Directory -ErrorAction SilentlyContinue |
                Where-Object { $_.Name -match '^6\.\d+' -or $_.Name -match '^Qt6\.\d+' } |
                Sort-Object Name -Descending

            foreach ($version in $qtVersions) {
                Write-Info "  Checking: $($version.FullName)"

                # Check for MSVC compilers
                $compilers = @("msvc2019_64", "msvc2022_64", "msvc2019", "msvc2022")
                foreach ($compiler in $compilers) {
                    $qmakeExe = Join-Path $version.FullName "$compiler\bin\qmake.exe"
                    if (Test-Path $qmakeExe) {
                        $qtBinDir = Split-Path $qmakeExe -Parent
                        Write-Success "Found Qt installation!"
                        Write-Success "Path: $qtBinDir"
                        return $qtBinDir
                    }
                }
            }
        }
    }

    # Method 3: Check Windows Registry
    Write-Info "Method 3: Checking Windows Registry..."
    try {
        $regPath = "HKCU:\Software\Qt"
        if (Test-Path $regPath) {
            $qtRoot = (Get-ItemProperty -Path $regPath -Name InstallLocation -ErrorAction SilentlyContinue).InstallLocation
            if ($qtRoot -and (Test-Path $qtRoot)) {
                Write-Info "Found Qt root from registry: $qtRoot"

                $qtVersions = Get-ChildItem -Path $qtRoot -Directory -ErrorAction SilentlyContinue |
                    Where-Object { $_.Name -match '^6\.\d+' } |
                    Sort-Object Name -Descending

                foreach ($version in $qtVersions) {
                    $compilers = @("msvc2019_64", "msvc2022_64")
                    foreach ($compiler in $compilers) {
                        $qmakeExe = Join-Path $version.FullName "$compiler\bin\qmake.exe"
                        if (Test-Path $qmakeExe) {
                            $qtBinDir = Split-Path $qmakeExe -Parent
                            Write-Success "Found Qt from registry: $qtBinDir"
                            return $qtBinDir
                        }
                    }
                }
            }
        }
    }
    catch {
        Write-Info "Registry check failed (this is normal on some systems)"
    }

    # Not found
    Write-Error-Custom "Qt 6.x installation not found!"
    Write-Host ""
    Write-Host "Please install Qt 6.8+ (6.10 recommended):" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://www.qt.io/download-qt-installer" -ForegroundColor Yellow
    Write-Host "  2. Install Qt 6.10.0 with MSVC 2019 or 2022 64-bit" -ForegroundColor Yellow
    Write-Host "  3. Typical path: C:\Qt\6.10.0\msvc2019_64" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or manually set Qt path:" -ForegroundColor Yellow
    Write-Host '  $env:PATH = "C:\Qt\6.10.0\msvc2019_64\bin;$env:PATH"' -ForegroundColor Yellow
    Write-Host "  Then run this script again" -ForegroundColor Yellow
    return $null
}

# ========================================
# STEP 3: AUTO-DETECT MSVC COMPILER
# ========================================
function Find-MSVCCompiler {
    Write-Banner "Step 3: Auto-detect MSVC Compiler"

    # Check if cl is already in PATH
    Write-Info "Checking PATH for MSVC compiler..."
    $cl = Get-Command cl -ErrorAction SilentlyContinue
    if ($cl) {
        Write-Success "MSVC compiler already in PATH"
        cl 2>&1 | Select-String "Version" | ForEach-Object { Write-Info $_.Line }
        return $true
    }

    # Search for Visual Studio installations
    Write-Info "Searching for Visual Studio installations..."
    $vsYears = @("2022", "2019")
    $vsEditions = @("Community", "Professional", "Enterprise", "BuildTools")

    foreach ($year in $vsYears) {
        foreach ($edition in $vsEditions) {
            $vsPath = "C:\Program Files\Microsoft Visual Studio\$year\$edition"
            $vcvarsPath = Join-Path $vsPath "VC\Auxiliary\Build\vcvars64.bat"

            if (Test-Path $vcvarsPath) {
                Write-Success "Found Visual Studio $year $edition"
                Write-Info "Loading MSVC environment..."

                # Load MSVC environment variables
                $tempFile = [System.IO.Path]::GetTempFileName()
                cmd /c "`"$vcvarsPath`" && set" > $tempFile

                Get-Content $tempFile | ForEach-Object {
                    if ($_ -match '^([^=]+)=(.*)$') {
                        $name = $matches[1]
                        $value = $matches[2]
                        Set-Item -Path "env:\$name" -Value $value
                    }
                }

                Remove-Item $tempFile

                # Verify cl is now available
                $cl = Get-Command cl -ErrorAction SilentlyContinue
                if ($cl) {
                    Write-Success "MSVC environment loaded successfully"
                    cl 2>&1 | Select-String "Version" | ForEach-Object { Write-Info $_.Line }
                    return $true
                }
            }
        }
    }

    Write-Error-Custom "MSVC compiler not found!"
    Write-Host ""
    Write-Host "Please install Visual Studio 2019 or 2022:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://visualstudio.microsoft.com/" -ForegroundColor Yellow
    Write-Host "  2. Install with 'Desktop development with C++' workload" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or run this script from 'Developer Command Prompt for VS'" -ForegroundColor Yellow
    return $false
}

# ========================================
# STEP 4: COMPILE TRANSLATIONS
# ========================================
function Compile-Translations {
    Write-Banner "Step 4: Compile Translation Files"

    Push-Location $ProjectRoot

    try {
        $tsFiles = Get-ChildItem -Path "translations\*.ts" -ErrorAction SilentlyContinue

        if ($tsFiles) {
            Write-Info "Found translation files, compiling..."
            lrelease 17_TcUi.pro

            if ($LASTEXITCODE -eq 0) {
                Write-Success "Translation files compiled successfully"

                # List generated .qm files
                $qmFiles = Get-ChildItem -Path "translations\*.qm" -ErrorAction SilentlyContinue
                foreach ($qm in $qmFiles) {
                    Write-Info "  Generated: $($qm.Name)"
                }
            } else {
                Write-Info "Translation compilation had warnings (non-fatal)"
            }
        } else {
            Write-Info "No translation files found, skipping"
        }
    }
    finally {
        Pop-Location
    }
}

# ========================================
# STEP 5: BUILD APPLICATION
# ========================================
function Build-Application {
    Write-Banner "Step 5: Build Application"

    Push-Location $ProjectRoot

    try {
        # Clean previous build files
        Write-Info "Cleaning previous build files..."
        Remove-Item -Path "Makefile*" -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "output\win" -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item -Path "*.obj", "*.o" -Force -ErrorAction SilentlyContinue
        Write-Success "Clean completed"

        # Run qmake
        Write-Info "Running qmake..."
        Write-Info "Config: $Config"
        qmake 17_TcUi.pro -spec win32-msvc "CONFIG+=$Config"

        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "qmake failed!"
            Write-Host ""
            Write-Host "Possible issues:" -ForegroundColor Yellow
            Write-Host "  - Qt 6.x not installed properly" -ForegroundColor Yellow
            Write-Host "  - Incompatible compiler version" -ForegroundColor Yellow
            Write-Host "  - Missing dependencies" -ForegroundColor Yellow
            throw "qmake failed"
        }
        Write-Success "qmake completed successfully"

        # Run nmake
        Write-Info "Running nmake... (this may take several minutes)"
        nmake

        if ($LASTEXITCODE -ne 0) {
            Write-Error-Custom "nmake failed!"
            Write-Host ""
            Write-Host "Common issues:" -ForegroundColor Yellow
            Write-Host "  - Missing FFmpeg libraries in third_party/ffmpeg" -ForegroundColor Yellow
            Write-Host "  - Incompatible C++ standard (requires C++17)" -ForegroundColor Yellow
            Write-Host "  - Deprecated API usage (check compiler warnings)" -ForegroundColor Yellow
            throw "nmake failed"
        }
        Write-Success "nmake completed successfully"

        # Verify output
        $outputDir = if ($Config -eq "debug") { "output\win\x64\debug" } else { "output\win\x64\release" }
        $exePath = Join-Path $outputDir "17_TcUi.exe"

        if (-not (Test-Path $exePath)) {
            Write-Error-Custom "Build executable not found at: $exePath"
            throw "Executable not found"
        }

        $exeInfo = Get-Item $exePath
        Write-Success "Build completed successfully!"
        Write-Success "Executable: $exePath"
        Write-Success "Size: $([math]::Round($exeInfo.Length / 1MB, 2)) MB"
        Write-Success "Modified: $($exeInfo.LastWriteTime)"

        return $exePath
    }
    finally {
        Pop-Location
    }
}

# ========================================
# STEP 6: DEPLOY (OPTIONAL)
# ========================================
function Deploy-Application {
    param([string]$ExePath)

    Write-Banner "Step 6: Deploy Application"

    $deployScript = Join-Path $ScriptRoot "scripts\deploy-windows.bat"

    if (Test-Path $deployScript) {
        Write-Info "Running deployment script..."
        & cmd /c "$deployScript"

        if ($LASTEXITCODE -eq 0) {
            Write-Success "Deployment completed successfully"
        } else {
            Write-Info "Deployment script completed with warnings"
        }
    } else {
        Write-Info "Deployment script not found, skipping"
        Write-Info "You can manually run windeployqt:"
        Write-Host "  windeployqt $ExePath" -ForegroundColor Cyan
    }
}

# ========================================
# MAIN EXECUTION
# ========================================
function Main {
    Write-Banner "XingCan Cloud Matrix (星灿传媒云矩阵) - Build Script"
    Write-Host "Build Configuration: $Config" -ForegroundColor Cyan
    Write-Host "Deploy After Build: $Deploy" -ForegroundColor Cyan
    Write-Host "Skip Download: $SkipDownload" -ForegroundColor Cyan
    Write-Host ""

    try {
        # Step 1: Download scrcpy-server
        if (-not $SkipDownload) {
            if (-not (Download-ScrcpyServer)) {
                Write-Host ""
                Write-Host "You can continue without scrcpy-server, but the app may not work properly." -ForegroundColor Yellow
                $continue = Read-Host "Continue anyway? (Y/N)"
                if ($continue -ne "Y" -and $continue -ne "y") {
                    throw "Build cancelled by user"
                }
            }
        } else {
            Write-Info "Skipping scrcpy-server download (as requested)"
        }

        # Step 2: Find Qt
        $qtBinDir = Find-QtInstallation
        if (-not $qtBinDir) {
            throw "Qt installation not found"
        }

        # Add Qt to PATH
        $env:PATH = "$qtBinDir;$env:PATH"

        # Verify qmake
        $qmake = Get-Command qmake -ErrorAction SilentlyContinue
        if (-not $qmake) {
            throw "qmake not accessible after adding Qt to PATH"
        }

        Write-Info "Checking Qt version..."
        qmake -v

        # Step 3: Find MSVC
        if (-not (Find-MSVCCompiler)) {
            throw "MSVC compiler not found"
        }

        # Step 4: Compile translations
        Compile-Translations

        # Step 5: Build application
        $exePath = Build-Application

        # Step 6: Deploy (optional)
        if ($Deploy) {
            Deploy-Application -ExePath $exePath
        }

        # Success summary
        Write-Banner "BUILD COMPLETED SUCCESSFULLY!"
        Write-Host "Executable: " -NoNewline
        Write-Host $exePath -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Run the application: $exePath" -ForegroundColor Yellow
        if (-not $Deploy) {
            Write-Host "  2. Deploy the application: .\start.ps1 -Config $Config -Deploy" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "Features:" -ForegroundColor Cyan
        Write-Host "  - Multi-language support (简体中文 / English)" -ForegroundColor Green
        Write-Host "  - scrcpy 3.3.3 support" -ForegroundColor Green
        Write-Host "  - C++17 Standard Library" -ForegroundColor Green
        Write-Host "  - Enhanced High DPI support" -ForegroundColor Green

        return 0
    }
    catch {
        Write-Host ""
        Write-Banner "BUILD FAILED"
        Write-Error-Custom $_.Exception.Message
        Write-Host ""
        Write-Host "If you need help, check:" -ForegroundColor Yellow
        Write-Host "  - UPGRADE_AND_I18N.md for detailed documentation" -ForegroundColor Yellow
        Write-Host "  - scripts/README.md for build instructions" -ForegroundColor Yellow
        return 1
    }
}

# Run main function
$exitCode = Main
exit $exitCode
