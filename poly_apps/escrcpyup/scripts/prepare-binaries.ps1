# ============================================
# Binary Files Preparation Script
# ============================================
# This script copies binary files with .py suffix for git compatibility
# and restores them before running the application

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
        Restore-Binaries
    }
    default {
        Write-Host "Usage: .\prepare-binaries.ps1 [-Action backup|restore]"
        Write-Host ""
        Write-Host "  backup  - Copy binary files to .py extension for git"
        Write-Host "  restore - Copy .py files back to original extensions"
    }
}
