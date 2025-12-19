# Find Qt Installation Script
Write-Host "Searching for Qt installations..." -ForegroundColor Cyan
Write-Host ""

$found = @()

# Detect Windows version
$osVersion = [System.Environment]::OSVersion.Version
if ($osVersion.Major -eq 10 -and $osVersion.Build -ge 22000) {
    $winVer = "win11"
    Write-Host "[DETECT] Windows 11 detected" -ForegroundColor Yellow
} elseif ($osVersion.Major -eq 10) {
    $winVer = "win10"
    Write-Host "[DETECT] Windows 10 detected" -ForegroundColor Yellow
} else {
    $winVer = "win10"
    Write-Host "[DETECT] Windows version: $($osVersion.Major).$($osVersion.Minor), defaulting to win10" -ForegroundColor Yellow
}
Write-Host ""

# Search common locations (prioritize version-specific paths)
$searchPaths = @(
    "D:\.dev_$winVer\Qt",
    "D:\.dev_win10\Qt",
    "D:\.dev_win11\Qt",
    "C:\Qt",
    "D:\Qt",
    "E:\Qt",
    "C:\Program Files\Qt",
    "D:\Program Files\Qt"
)

foreach ($basePath in $searchPaths) {
    if (Test-Path $basePath) {
        Write-Host "Scanning: $basePath" -ForegroundColor Yellow

        # Look for Qt directories
        $qtDirs = Get-ChildItem -Path $basePath -Directory -ErrorAction SilentlyContinue | Where-Object {
            $_.Name -match '^6\.\d+' -or $_.Name -match '^Qt' -or $_.Name -eq 'Qt'
        }

        foreach ($dir in $qtDirs) {
            # Look for MSVC compilers
            $compilers = Get-ChildItem -Path $dir.FullName -Directory -ErrorAction SilentlyContinue | Where-Object {
                $_.Name -match 'msvc\d{4}_64'
            }

            foreach ($compiler in $compilers) {
                $qmakePath = Join-Path $compiler.FullName "bin\qmake.exe"
                if (Test-Path $qmakePath) {
                    $info = @{
                        Path = $compiler.FullName
                        QMake = $qmakePath
                        Version = $dir.Name
                        Compiler = $compiler.Name
                    }
                    $found += $info
                    Write-Host "  [FOUND] $($dir.Name) - $($compiler.Name)" -ForegroundColor Green
                    Write-Host "    Path: $($compiler.FullName)" -ForegroundColor Gray
                }
            }
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan

if ($found.Count -eq 0) {
    Write-Host "No Qt installations found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Qt 6.8+ from: https://www.qt.io/download-qt-installer" -ForegroundColor Yellow
    Write-Host "Recommended: Qt 6.10.0 with MSVC 2019 64-bit or MSVC 2022 64-bit" -ForegroundColor Yellow
}
else {
    Write-Host "Found $($found.Count) Qt installation(s)" -ForegroundColor Green
    Write-Host ""
    Write-Host "To use one of these installations, run:" -ForegroundColor Yellow
    Write-Host ""
    foreach ($qt in $found) {
        Write-Host "  For $($qt.Version) - $($qt.Compiler):" -ForegroundColor Cyan
        Write-Host "    `$env:PATH = `"$(Join-Path $qt.Path 'bin');`$env:PATH`"" -ForegroundColor White
        Write-Host ""
    }
    Write-Host "Then run: .\start.ps1" -ForegroundColor Yellow
}

Write-Host "========================================" -ForegroundColor Cyan
