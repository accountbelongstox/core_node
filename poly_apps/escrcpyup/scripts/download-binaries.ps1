# ============================================
# 星灿传媒 测试版 - Binary Downloader
# Auto Download ADB and SCRCPY Binaries
# ============================================
# This script automatically downloads the latest ADB and SCRCPY binaries

param(
    [string]$Platform = "auto"  # "win", "mac-x64", "mac-arm64", "linux-x64", "linux-arm64", "auto"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

# Color output functions
function Write-Info {
    param([string]$Text)
    Write-Host "[INFO] $Text" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Text)
    Write-Host "[OK] $Text" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Text)
    Write-Host "[WARN] $Text" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Text)
    Write-Host "[ERROR] $Text" -ForegroundColor Red
}

# Detect platform
function Get-TargetPlatform {
    if ($Platform -ne "auto") {
        return $Platform
    }

    $os = $env:OS
    if ($os -match "Windows") {
        return "win"
    }

    # For cross-compilation, return all platforms
    return "auto"
}

# Download URLs
$SCRCPY_RELEASES_URL = "https://api.github.com/repos/Genymobile/scrcpy/releases/latest"
$ADB_WINDOWS_URL = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
$ADB_MAC_URL = "https://dl.google.com/android/repository/platform-tools-latest-darwin.zip"
$ADB_LINUX_URL = "https://dl.google.com/android/repository/platform-tools-latest-linux.zip"

# Ensure temp directory exists
$tempDir = Join-Path $env:TEMP "escrcpy-downloads"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
}

Write-Info "Temporary download directory: $tempDir"

# Download file with progress
function Download-File {
    param(
        [string]$Url,
        [string]$Destination
    )

    Write-Info "Downloading from: $Url"
    Write-Info "Saving to: $Destination"

    try {
        # Use BITS (Background Intelligent Transfer Service) for progress
        $bitsJob = Start-BitsTransfer -Source $Url -Destination $Destination -DisplayName "Downloading binaries" -Description "Downloading from GitHub/Google" -ErrorAction Stop

        Write-Success "Downloaded successfully"
        return $true
    }
    catch {
        Write-Warning "BITS transfer failed, trying WebClient with progress..."

        try {
            # Fallback to WebClient with manual progress tracking
            $webClient = New-Object System.Net.WebClient

            # Progress event handler
            $progressHandler = {
                param($sender, $e)
                $percent = $e.ProgressPercentage
                $received = [math]::Round($e.BytesReceived / 1MB, 2)
                $total = [math]::Round($e.TotalBytesToReceive / 1MB, 2)
                Write-Progress -Activity "Downloading" -Status "$received MB / $total MB" -PercentComplete $percent
            }

            # Attach event handler
            Register-ObjectEvent -InputObject $webClient -EventName DownloadProgressChanged -Action $progressHandler | Out-Null

            # Download file
            $webClient.DownloadFileAsync($Url, $Destination)

            # Wait for download to complete
            while ($webClient.IsBusy) {
                Start-Sleep -Milliseconds 100
            }

            # Clean up
            Write-Progress -Activity "Downloading" -Completed
            Unregister-Event -SourceIdentifier WebClient.DownloadProgressChanged -ErrorAction SilentlyContinue
            $webClient.Dispose()

            Write-Success "Downloaded successfully"
            return $true
        }
        catch {
            Write-Error "Download failed: $_"
            return $false
        }
    }
}

# Extract ZIP file
function Extract-ZipFile {
    param(
        [string]$ZipPath,
        [string]$DestinationPath
    )

    Write-Info "Extracting: $ZipPath"
    Write-Info "To: $DestinationPath"

    try {
        # Ensure destination exists
        if (-not (Test-Path $DestinationPath)) {
            New-Item -ItemType Directory -Path $DestinationPath -Force | Out-Null
        }

        # Extract using .NET
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $DestinationPath)

        Write-Success "Extracted successfully"
        return $true
    }
    catch {
        Write-Error "Extraction failed: $_"
        return $false
    }
}

# Get latest SCRCPY release info
function Get-ScrcpyReleaseInfo {
    Write-Info "Fetching latest SCRCPY release information..."

    try {
        $response = Invoke-RestMethod -Uri $SCRCPY_RELEASES_URL -Method Get
        $version = $response.tag_name

        Write-Success "Latest SCRCPY version: $version"

        # Find download URLs for different platforms
        $assets = @{}
        foreach ($asset in $response.assets) {
            if ($asset.name -match "scrcpy-win64") {
                $assets["win"] = $asset.browser_download_url
            }
            elseif ($asset.name -match "scrcpy-macos") {
                # Determine architecture from asset name
                if ($asset.name -match "arm64") {
                    $assets["mac-arm64"] = $asset.browser_download_url
                }
                else {
                    $assets["mac-x64"] = $asset.browser_download_url
                }
            }
            elseif ($asset.name -match "scrcpy-linux") {
                if ($asset.name -match "aarch64" -or $asset.name -match "arm64") {
                    $assets["linux-arm64"] = $asset.browser_download_url
                }
                else {
                    $assets["linux-x64"] = $asset.browser_download_url
                }
            }
        }

        return @{
            version = $version
            assets = $assets
        }
    }
    catch {
        Write-Error "Failed to fetch SCRCPY release info: $_"
        return $null
    }
}

# Download and extract ADB for Windows
function Install-AdbWindows {
    $destDir = Join-Path $projectRoot "electron\resources\extra\win\scrcpy"
    $zipFile = Join-Path $tempDir "platform-tools-windows.zip"

    Write-Info "Downloading Android Platform Tools for Windows..."

    if (-not (Download-File -Url $ADB_WINDOWS_URL -Destination $zipFile)) {
        return $false
    }

    $extractDir = Join-Path $tempDir "platform-tools-win"
    if (-not (Extract-ZipFile -ZipPath $zipFile -DestinationPath $extractDir)) {
        return $false
    }

    # Copy ADB binaries
    $platformToolsDir = Join-Path $extractDir "platform-tools"
    if (Test-Path $platformToolsDir) {
        # Ensure destination directory exists
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        # Copy ADB files
        Copy-Item -Path (Join-Path $platformToolsDir "adb.exe") -Destination $destDir -Force
        Copy-Item -Path (Join-Path $platformToolsDir "AdbWinApi.dll") -Destination $destDir -Force
        Copy-Item -Path (Join-Path $platformToolsDir "AdbWinUsbApi.dll") -Destination $destDir -Force

        Write-Success "ADB installed for Windows"
        return $true
    }

    Write-Error "Platform tools directory not found"
    return $false
}

# Download and extract SCRCPY for Windows
function Install-ScrcpyWindows {
    param([hashtable]$ReleaseInfo)

    $url = $ReleaseInfo.assets["win"]
    if (-not $url) {
        Write-Warning "Windows SCRCPY download URL not found"
        return $false
    }

    $destDir = Join-Path $projectRoot "electron\resources\extra\win\scrcpy"
    $zipFile = Join-Path $tempDir "scrcpy-windows.zip"

    Write-Info "Downloading SCRCPY for Windows..."

    if (-not (Download-File -Url $url -Destination $zipFile)) {
        return $false
    }

    $extractDir = Join-Path $tempDir "scrcpy-win"
    if (-not (Extract-ZipFile -ZipPath $zipFile -DestinationPath $extractDir)) {
        return $false
    }

    # Find scrcpy directory (usually scrcpy-win64-vX.X)
    $scrcpyDir = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
    if ($scrcpyDir) {
        # Ensure destination directory exists
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        # Copy all files from scrcpy directory
        Copy-Item -Path (Join-Path $scrcpyDir.FullName "*") -Destination $destDir -Recurse -Force

        Write-Success "SCRCPY installed for Windows"
        return $true
    }

    Write-Error "SCRCPY directory not found in extracted files"
    return $false
}

# Download and extract ADB for macOS
function Install-AdbMac {
    param([string]$Arch)

    $destDir = Join-Path $projectRoot "electron\resources\extra\mac-$Arch\scrcpy"
    $zipFile = Join-Path $tempDir "platform-tools-mac.zip"

    Write-Info "Downloading Android Platform Tools for macOS ($Arch)..."

    if (-not (Download-File -Url $ADB_MAC_URL -Destination $zipFile)) {
        return $false
    }

    $extractDir = Join-Path $tempDir "platform-tools-mac-$Arch"
    if (-not (Extract-ZipFile -ZipPath $zipFile -DestinationPath $extractDir)) {
        return $false
    }

    # Copy ADB binary
    $platformToolsDir = Join-Path $extractDir "platform-tools"
    if (Test-Path $platformToolsDir) {
        # Ensure destination directory exists
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        # Copy ADB file
        Copy-Item -Path (Join-Path $platformToolsDir "adb") -Destination $destDir -Force

        Write-Success "ADB installed for macOS ($Arch)"
        return $true
    }

    Write-Error "Platform tools directory not found"
    return $false
}

# Download and extract SCRCPY for macOS
function Install-ScrcpyMac {
    param(
        [hashtable]$ReleaseInfo,
        [string]$Arch
    )

    $url = $ReleaseInfo.assets["mac-$Arch"]
    if (-not $url) {
        Write-Warning "macOS $Arch SCRCPY download URL not found"
        return $false
    }

    $destDir = Join-Path $projectRoot "electron\resources\extra\mac-$Arch\scrcpy"
    $zipFile = Join-Path $tempDir "scrcpy-mac-$Arch.zip"

    Write-Info "Downloading SCRCPY for macOS ($Arch)..."

    if (-not (Download-File -Url $url -Destination $zipFile)) {
        return $false
    }

    $extractDir = Join-Path $tempDir "scrcpy-mac-$Arch"
    if (-not (Extract-ZipFile -ZipPath $zipFile -DestinationPath $extractDir)) {
        return $false
    }

    # Find scrcpy files
    $scrcpyDir = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
    if ($scrcpyDir) {
        # Ensure destination directory exists
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        # Copy scrcpy binary and server
        if (Test-Path (Join-Path $scrcpyDir.FullName "scrcpy")) {
            Copy-Item -Path (Join-Path $scrcpyDir.FullName "*") -Destination $destDir -Recurse -Force
        }

        Write-Success "SCRCPY installed for macOS ($Arch)"
        return $true
    }

    Write-Error "SCRCPY directory not found in extracted files"
    return $false
}

# Download and extract ADB for Linux
function Install-AdbLinux {
    param([string]$Arch)

    $destDir = Join-Path $projectRoot "electron\resources\extra\linux-$Arch\scrcpy"
    $zipFile = Join-Path $tempDir "platform-tools-linux.zip"

    Write-Info "Downloading Android Platform Tools for Linux ($Arch)..."

    if (-not (Download-File -Url $ADB_LINUX_URL -Destination $zipFile)) {
        return $false
    }

    $extractDir = Join-Path $tempDir "platform-tools-linux-$Arch"
    if (-not (Extract-ZipFile -ZipPath $zipFile -DestinationPath $extractDir)) {
        return $false
    }

    # Copy ADB binary
    $platformToolsDir = Join-Path $extractDir "platform-tools"
    if (Test-Path $platformToolsDir) {
        # Ensure destination directory exists
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        # Copy ADB file
        Copy-Item -Path (Join-Path $platformToolsDir "adb") -Destination $destDir -Force

        Write-Success "ADB installed for Linux ($Arch)"
        return $true
    }

    Write-Error "Platform tools directory not found"
    return $false
}

# Download and extract SCRCPY for Linux
function Install-ScrcpyLinux {
    param(
        [hashtable]$ReleaseInfo,
        [string]$Arch
    )

    $url = $ReleaseInfo.assets["linux-$Arch"]
    if (-not $url) {
        Write-Warning "Linux $Arch SCRCPY download URL not found"
        return $false
    }

    $destDir = Join-Path $projectRoot "electron\resources\extra\linux-$Arch\scrcpy"
    $zipFile = Join-Path $tempDir "scrcpy-linux-$Arch.zip"

    Write-Info "Downloading SCRCPY for Linux ($Arch)..."

    if (-not (Download-File -Url $url -Destination $zipFile)) {
        return $false
    }

    $extractDir = Join-Path $tempDir "scrcpy-linux-$Arch"
    if (-not (Extract-ZipFile -ZipPath $zipFile -DestinationPath $extractDir)) {
        return $false
    }

    # Find scrcpy files
    $scrcpyDir = Get-ChildItem -Path $extractDir -Directory | Select-Object -First 1
    if ($scrcpyDir) {
        # Ensure destination directory exists
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        # Copy scrcpy binary and server
        if (Test-Path (Join-Path $scrcpyDir.FullName "scrcpy")) {
            Copy-Item -Path (Join-Path $scrcpyDir.FullName "*") -Destination $destDir -Recurse -Force
        }

        Write-Success "SCRCPY installed for Linux ($Arch)"
        return $true
    }

    Write-Error "SCRCPY directory not found in extracted files"
    return $false
}

# Main execution
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  星灿传媒 测试版 - Binary Downloader" -ForegroundColor Cyan
Write-Host "  Auto Download ADB and SCRCPY Binaries" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Get SCRCPY release info
$scrcpyInfo = Get-ScrcpyReleaseInfo
if (-not $scrcpyInfo) {
    Write-Error "Failed to get SCRCPY release information"
    exit 1
}

$targetPlatform = Get-TargetPlatform
Write-Info "Target platform: $targetPlatform"
Write-Host ""

# Download binaries based on platform
if ($targetPlatform -eq "win" -or $targetPlatform -eq "auto") {
    Write-Host "--- Installing for Windows ---" -ForegroundColor Yellow
    Install-AdbWindows
    Install-ScrcpyWindows -ReleaseInfo $scrcpyInfo
    Write-Host ""
}

if ($targetPlatform -eq "auto") {
    Write-Host "--- Installing for macOS (x64) ---" -ForegroundColor Yellow
    Install-AdbMac -Arch "x64"
    Install-ScrcpyMac -ReleaseInfo $scrcpyInfo -Arch "x64"
    Write-Host ""

    Write-Host "--- Installing for macOS (arm64) ---" -ForegroundColor Yellow
    Install-AdbMac -Arch "arm64"
    Install-ScrcpyMac -ReleaseInfo $scrcpyInfo -Arch "arm64"
    Write-Host ""

    Write-Host "--- Installing for Linux (x64) ---" -ForegroundColor Yellow
    Install-AdbLinux -Arch "x64"
    Install-ScrcpyLinux -ReleaseInfo $scrcpyInfo -Arch "x64"
    Write-Host ""

    Write-Host "--- Installing for Linux (arm64) ---" -ForegroundColor Yellow
    Install-AdbLinux -Arch "arm64"
    Install-ScrcpyLinux -ReleaseInfo $scrcpyInfo -Arch "arm64"
    Write-Host ""
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Success "All binaries downloaded successfully!"
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Info "Next steps:"
Write-Info "1. Run .\scripts\prepare-binaries.ps1 -Action backup to create .py backups"
Write-Info "2. Commit the .py files to git"
Write-Host ""
