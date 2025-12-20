# ========================================
# Auto-Download Dependencies for QtScrcpy
# Downloads ADB and scrcpy-server if not present
# ========================================

param(
    [string]$TargetDir = ".",
    [switch]$Force
)

# ADB Download URLs
$ADB_VERSION = "34.0.5"
$ADB_URL = "https://dl.google.com/android/repository/platform-tools-latest-windows.zip"
$ADB_TARGET = Join-Path $TargetDir "third_party\adb\win"

# SCRCPY Server Download URLs
$SCRCPY_VERSION = "3.3.3"
$SCRCPY_URL = "https://github.com/Genymobile/scrcpy/releases/download/v$SCRCPY_VERSION/scrcpy-server-v$SCRCPY_VERSION"
$SCRCPY_TARGET = Join-Path $TargetDir "third_party\scrcpy-server"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Auto-Download Dependencies" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to download file
function Download-File {
    param(
        [string]$Url,
        [string]$OutputPath
    )

    try {
        Write-Host "[DOWNLOAD] $Url" -ForegroundColor Yellow
        Write-Host "[TARGET]   $OutputPath" -ForegroundColor Yellow

        # Use WebClient for better progress
        $webClient = New-Object System.Net.WebClient
        $webClient.DownloadFile($Url, $OutputPath)

        Write-Host "[OK] Download completed" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "[ERROR] Download failed: $_" -ForegroundColor Red
        return $false
    }
}

# Function to extract ZIP
function Extract-ZipFile {
    param(
        [string]$ZipPath,
        [string]$DestinationPath
    )

    try {
        Write-Host "[EXTRACT] Extracting $ZipPath..." -ForegroundColor Yellow

        if (Test-Path $DestinationPath) {
            Remove-Item -Path $DestinationPath -Recurse -Force
        }

        Expand-Archive -Path $ZipPath -DestinationPath $DestinationPath -Force

        Write-Host "[OK] Extraction completed" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "[ERROR] Extraction failed: $_" -ForegroundColor Red
        return $false
    }
}

# ========================================
# Download ADB
# ========================================
Write-Host ""
Write-Host "Checking ADB..." -ForegroundColor Cyan

$adbExe = Join-Path $ADB_TARGET "adb.exe"
if ((Test-Path $adbExe) -and !$Force) {
    Write-Host "[SKIP] ADB already exists: $adbExe" -ForegroundColor Green
} else {
    Write-Host "[DOWNLOAD] ADB Platform Tools..." -ForegroundColor Yellow

    $tempZip = Join-Path $env:TEMP "platform-tools.zip"

    if (Download-File -Url $ADB_URL -OutputPath $tempZip) {
        # Extract
        $tempExtract = Join-Path $env:TEMP "platform-tools-extract"

        if (Extract-ZipFile -ZipPath $tempZip -DestinationPath $tempExtract) {
            # Copy files to target
            $platformToolsDir = Join-Path $tempExtract "platform-tools"

            if (!(Test-Path $ADB_TARGET)) {
                New-Item -ItemType Directory -Path $ADB_TARGET -Force | Out-Null
            }

            Copy-Item -Path (Join-Path $platformToolsDir "adb.exe") -Destination $ADB_TARGET -Force
            Copy-Item -Path (Join-Path $platformToolsDir "AdbWinApi.dll") -Destination $ADB_TARGET -Force
            Copy-Item -Path (Join-Path $platformToolsDir "AdbWinUsbApi.dll") -Destination $ADB_TARGET -Force

            Write-Host "[OK] ADB installed to: $ADB_TARGET" -ForegroundColor Green

            # Cleanup
            Remove-Item -Path $tempZip -Force -ErrorAction SilentlyContinue
            Remove-Item -Path $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

# ========================================
# Download SCRCPY Server
# ========================================
Write-Host ""
Write-Host "Checking scrcpy-server..." -ForegroundColor Cyan

$scrcpyServer = Join-Path $SCRCPY_TARGET "scrcpy-server-v$SCRCPY_VERSION"
if ((Test-Path $scrcpyServer) -and !$Force) {
    Write-Host "[SKIP] scrcpy-server already exists: $scrcpyServer" -ForegroundColor Green
} else {
    Write-Host "[DOWNLOAD] scrcpy-server v$SCRCPY_VERSION..." -ForegroundColor Yellow

    if (!(Test-Path $SCRCPY_TARGET)) {
        New-Item -ItemType Directory -Path $SCRCPY_TARGET -Force | Out-Null
    }

    if (Download-File -Url $SCRCPY_URL -OutputPath $scrcpyServer) {
        Write-Host "[OK] scrcpy-server installed to: $scrcpyServer" -ForegroundColor Green

        # Create version.json
        $versionJson = @{
            version = $SCRCPY_VERSION
            download_date = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            url = $SCRCPY_URL
        } | ConvertTo-Json

        $versionJson | Out-File -FilePath (Join-Path $SCRCPY_TARGET "version.json") -Encoding utf8
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Dependencies Check Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
