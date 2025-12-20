# ============================================
# 星灿传媒 测试版 - Binary Files Manager
# ============================================
# This script manages binary files backup and restoration

param(
    [string]$Action = "restore"  # "backup" or "restore"
)

$projectRoot = Split-Path -Parent $PSScriptRoot

# Binary file extensions to process
$binaryExtensions = @('.exe', '.dll', '.bat', '.vbs')

# Get all subdirectories under extra
function Get-BinaryDirs {
    $extraPath = Join-Path $projectRoot 'electron\resources\extra'
    if (-not (Test-Path $extraPath)) {
        return @()
    }

    # Get all subdirectories recursively (win/*, mac-*/*, linux-*/*)
    $dirs = Get-ChildItem -Path $extraPath -Directory -Recurse | ForEach-Object {
        $_.FullName.Replace("$projectRoot\", '').Replace('\', '\')
    }

    return $dirs
}

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

function Backup-Binaries {
    Write-Info "Creating .py copies of binary files for git..."
    $count = 0

    $binaryDirs = Get-BinaryDirs

    foreach ($dir in $binaryDirs) {
        $fullPath = Join-Path $projectRoot $dir
        if (-not (Test-Path $fullPath)) {
            continue
        }

        foreach ($ext in $binaryExtensions) {
            $files = Get-ChildItem -Path $fullPath -Filter "*$ext" -ErrorAction SilentlyContinue

            foreach ($file in $files) {
                $sourcePath = $file.FullName
                $destPath = "$sourcePath.py"

                if (Test-Path $sourcePath) {
                    Copy-Item -Path $sourcePath -Destination $destPath -Force
                    Write-Success "Backed up: $($file.Name) -> $($file.Name).py"
                    $count++
                }
            }
        }

        # Also handle files without extensions (Linux/Mac binaries)
        if ($dir -like '*mac*' -or $dir -like '*linux*') {
            $files = Get-ChildItem -Path $fullPath -File | Where-Object { $_.Extension -eq '' }
            foreach ($file in $files) {
                $sourcePath = $file.FullName
                $destPath = "$sourcePath.py"

                if (Test-Path $sourcePath) {
                    Copy-Item -Path $sourcePath -Destination $destPath -Force
                    Write-Success "Backed up: $($file.Name) -> $($file.Name).py"
                    $count++
                }
            }
        }
    }

    Write-Success "Total $count binary files backed up with .py extension"
}

function Test-BinariesExist {
    Write-Info "Checking if binaries exist..."

    # Check for Windows binaries
    $winAdb = Join-Path $projectRoot "electron\resources\extra\win\scrcpy\adb.exe.py"
    $winScrcpy = Join-Path $projectRoot "electron\resources\extra\win\scrcpy\scrcpy.exe.py"

    if (Test-Path $winAdb) {
        Write-Success "Found backup binaries"
        return $true
    }

    Write-Warning "Backup binaries not found"
    return $false
}

function Download-Binaries {
    Write-Info "Binaries not found, downloading..."
    Write-Host ""

    $downloadScript = Join-Path $PSScriptRoot "download-binaries.ps1"
    if (Test-Path $downloadScript) {
        & $downloadScript
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Download completed successfully"
            return $true
        }
    }
    else {
        Write-Warning "Download script not found: $downloadScript"
        Write-Info "Please download binaries manually or run download-binaries.ps1"
    }

    return $false
}

function Restore-Binaries {
    Write-Info "Restoring binary files from .py copies..."
    $count = 0

    $binaryDirs = Get-BinaryDirs

    foreach ($dir in $binaryDirs) {
        $fullPath = Join-Path $projectRoot $dir
        if (-not (Test-Path $fullPath)) {
            continue
        }

        # Restore .exe.py -> .exe
        foreach ($ext in $binaryExtensions) {
            $files = Get-ChildItem -Path $fullPath -Filter "*$ext.py" -ErrorAction SilentlyContinue

            foreach ($file in $files) {
                $sourcePath = $file.FullName
                $destPath = $sourcePath -replace '\.py$', ''

                if (Test-Path $sourcePath) {
                    Copy-Item -Path $sourcePath -Destination $destPath -Force
                    Write-Success "Restored: $($file.Name) -> $(Split-Path -Leaf $destPath)"
                    $count++
                }
            }
        }

        # Restore Linux/Mac binaries (files ending with .py but no extension before)
        if ($dir -like '*mac*' -or $dir -like '*linux*') {
            $files = Get-ChildItem -Path $fullPath -Filter "*.py" -File
            foreach ($file in $files) {
                $fileName = $file.Name
                # Skip if it's like .exe.py or .dll.py
                $skip = $false
                foreach ($ext in $binaryExtensions) {
                    if ($fileName -like "*$ext.py") {
                        $skip = $true
                        break
                    }
                }

                if (-not $skip) {
                    $sourcePath = $file.FullName
                    $destPath = $sourcePath -replace '\.py$', ''

                    if (Test-Path $sourcePath) {
                        Copy-Item -Path $sourcePath -Destination $destPath -Force
                        Write-Success "Restored: $($file.Name) -> $(Split-Path -Leaf $destPath)"
                        $count++
                    }
                }
            }
        }
    }

    if ($count -eq 0) {
        Write-Warning "No .py backup files found to restore"
        Write-Info "This is normal if binaries are already in place"
    } else {
        Write-Success "Total $count binary files restored"
    }
}

# Main execution
switch ($Action.ToLower()) {
    "backup" {
        Backup-Binaries
    }
    "restore" {
        # Check if binaries exist, if not, download them
        if (-not (Test-BinariesExist)) {
            Write-Warning "No backup binaries found"
            $download = Read-Host "Download binaries now? (Y/n)"
            if ($download -ne 'n' -and $download -ne 'N') {
                if (Download-Binaries) {
                    # After download, create .py backups
                    Write-Host ""
                    Write-Info "Creating .py backups after download..."
                    Backup-Binaries
                }
            }
            else {
                Write-Warning "Skipped download. Please ensure binaries are available."
            }
        }

        Restore-Binaries
    }
    default {
        Write-Host "Usage: .\prepare-binaries.ps1 [-Action backup|restore]"
        Write-Host ""
        Write-Host "  backup  - Copy binary files to .py extension for git"
        Write-Host "  restore - Copy .py files back to original extensions"
    }
}
