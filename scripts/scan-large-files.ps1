# ============================================
# Large Files Scanner
# Scan project for large files (Read-Only)
# ============================================

# Set encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Configuration
$PROJECT_ROOT = "D:\programing\core_node"
$SIZE_THRESHOLD_MB = 1  # Files larger than this (MB) will be reported
$TOP_FILES_COUNT = 50   # Show top N largest files

# Color output functions
function Write-ColorText {
    param(
        [string]$Text,
        [string]$Color = "White"
    )
    Write-Host $Text -ForegroundColor $Color
}

function Write-Success {
    param([string]$Text)
    Write-ColorText "[OK] $Text" "Green"
}

function Write-Error {
    param([string]$Text)
    Write-ColorText "[ERROR] $Text" "Red"
}

function Write-Info {
    param([string]$Text)
    Write-ColorText "[INFO] $Text" "Cyan"
}

function Write-Warning {
    param([string]$Text)
    Write-ColorText "[WARN] $Text" "Yellow"
}

function Write-Title {
    param([string]$Text)
    Write-Host ""
    Write-ColorText "========================================" "Cyan"
    Write-ColorText "  $Text" "Yellow"
    Write-ColorText "========================================" "Cyan"
    Write-Host ""
}

# Convert bytes to human readable format
function Format-FileSize {
    param([long]$Bytes)

    if ($Bytes -ge 1GB) {
        return "{0:N2} GB" -f ($Bytes / 1GB)
    } elseif ($Bytes -ge 1MB) {
        return "{0:N2} MB" -f ($Bytes / 1MB)
    } elseif ($Bytes -ge 1KB) {
        return "{0:N2} KB" -f ($Bytes / 1KB)
    } else {
        return "$Bytes Bytes"
    }
}

# Get relative path from project root
function Get-RelativePath {
    param([string]$FullPath)

    $path = $FullPath.Replace($PROJECT_ROOT, "")
    return $path -replace '^[\\/]+', ''
}

# Display banner
function Show-Banner {
    Clear-Host
    Write-ColorText @"
================================================

        Large Files Scanner
        Project Size Analysis Tool

================================================
"@ "Cyan"
    Write-Host ""
}

# Scan project for large files
function Scan-LargeFiles {
    Show-Banner

    Write-Info "Project Root: $PROJECT_ROOT"
    Write-Info "Size Threshold: $SIZE_THRESHOLD_MB MB"
    Write-Host ""

    Write-Info "Scanning files... (This may take a while)"
    Write-Host ""

    # Directories to exclude
    $excludeDirs = @(
        "node_modules",
        ".git",
        "dist",
        "dist-electron",
        "build",
        "out",
        ".next",
        "coverage",
        ".turbo",
        ".cache",
        ".dart_tool"
    )

    # Get all files excluding certain directories
    $startTime = Get-Date
    $allFiles = Get-ChildItem -Path $PROJECT_ROOT -File -Recurse -ErrorAction SilentlyContinue | Where-Object {
        $path = $_.FullName
        $excluded = $false
        foreach ($dir in $excludeDirs) {
            if ($path -like "*\$dir\*" -or $path -like "*/$dir/*") {
                $excluded = $true
                break
            }
        }
        -not $excluded
    }

    $scanDuration = (Get-Date) - $startTime

    Write-Success "Scanned $($allFiles.Count) files in $([math]::Round($scanDuration.TotalSeconds, 2))s"
    Write-Host ""

    # Calculate total size
    $totalSize = ($allFiles | Measure-Object -Property Length -Sum).Sum

    # Filter files larger than threshold
    $thresholdBytes = $SIZE_THRESHOLD_MB * 1MB
    $largeFiles = $allFiles | Where-Object { $_.Length -ge $thresholdBytes } | Sort-Object -Property Length -Descending

    # Group by extension
    $filesByExtension = $allFiles | Group-Object -Property Extension | Sort-Object -Property Count -Descending

    # Group by directory (top level)
    $filesByDir = $allFiles | ForEach-Object {
        $relativePath = Get-RelativePath $_.FullName
        $topDir = ($relativePath -split '[\\/]')[0]
        if ([string]::IsNullOrWhiteSpace($topDir)) {
            $topDir = "(root)"
        }
        [PSCustomObject]@{
            Directory = $topDir
            Size = $_.Length
        }
    } | Group-Object -Property Directory | ForEach-Object {
        [PSCustomObject]@{
            Directory = $_.Name
            TotalSize = ($_.Group | Measure-Object -Property Size -Sum).Sum
            FileCount = $_.Count
        }
    } | Sort-Object -Property TotalSize -Descending

    # Display results
    Write-Title "Project Overview"

    Write-Host "Total Project Size : " -NoNewline
    Write-ColorText (Format-FileSize $totalSize) "Green"

    Write-Host "Total Files        : " -NoNewline
    Write-ColorText $allFiles.Count "Green"

    Write-Host "Large Files (>$SIZE_THRESHOLD_MB MB) : " -NoNewline
    Write-ColorText $largeFiles.Count "Yellow"

    # Top directories by size
    Write-Title "Top Directories by Size"

    $topDirs = $filesByDir | Select-Object -First 10
    foreach ($dir in $topDirs) {
        $sizeStr = (Format-FileSize $dir.TotalSize).PadRight(12)
        $filesStr = "$($dir.FileCount) files".PadRight(15)
        $percentage = ($dir.TotalSize / $totalSize * 100).ToString("0.00").PadLeft(6)

        Write-Host "  $sizeStr " -NoNewline
        Write-Host "$filesStr " -NoNewline
        Write-Host "($percentage%) " -NoNewline -ForegroundColor Cyan
        Write-Host $dir.Directory -ForegroundColor Yellow
    }

    # Top file types by count
    Write-Title "Top File Types by Count"

    $topExtensions = $filesByExtension | Select-Object -First 10
    foreach ($ext in $topExtensions) {
        $totalExtSize = ($ext.Group | Measure-Object -Property Length -Sum).Sum
        $sizeStr = (Format-FileSize $totalExtSize).PadRight(12)
        $countStr = "$($ext.Count) files".PadRight(15)
        $extName = if ([string]::IsNullOrWhiteSpace($ext.Name)) { "(no extension)" } else { $ext.Name }

        Write-Host "  $sizeStr " -NoNewline
        Write-Host "$countStr " -NoNewline
        Write-Host $extName -ForegroundColor Yellow
    }

    # Top largest files
    Write-Title "Top $TOP_FILES_COUNT Largest Files"

    $topLargeFiles = $largeFiles | Select-Object -First $TOP_FILES_COUNT

    if ($topLargeFiles.Count -eq 0) {
        Write-Info "No files larger than $SIZE_THRESHOLD_MB MB found."
    } else {
        $index = 1
        foreach ($file in $topLargeFiles) {
            $sizeStr = (Format-FileSize $file.Length).PadRight(12)
            $relativePath = Get-RelativePath $file.FullName

            Write-Host "  $($index.ToString().PadLeft(2)). " -NoNewline -ForegroundColor Gray
            Write-Host "$sizeStr " -NoNewline -ForegroundColor Green
            Write-Host $relativePath -ForegroundColor White

            $index++
        }
    }

    # Summary statistics
    Write-Title "Summary Statistics"

    if ($largeFiles.Count -gt 0) {
        $largeFilesSize = ($largeFiles | Measure-Object -Property Length -Sum).Sum
        $largeFilesPercentage = ($largeFilesSize / $totalSize * 100).ToString("0.00")

        Write-Host "Large Files Total  : " -NoNewline
        Write-ColorText (Format-FileSize $largeFilesSize) "Yellow"

        Write-Host "Percentage of Total: " -NoNewline
        Write-ColorText "$largeFilesPercentage%" "Yellow"

        Write-Host ""
        Write-Warning "Large files (>$SIZE_THRESHOLD_MB MB) account for $largeFilesPercentage% of total project size"
    }

    # Export option
    Write-Host ""
    Write-Title "Export Options"

    Write-Host "  1. Export large files list to CSV"
    Write-Host "  2. Export all files list to CSV"
    Write-Host "  3. Export directory summary to CSV"
    Write-Host "  0. Skip export"
    Write-Host ""

    $choice = Read-Host "Select export option (0-3)"

    switch ($choice) {
        "1" {
            $exportPath = "$PROJECT_ROOT\large-files-report.csv"
            $largeFiles | Select-Object @{Name="Size";Expression={$_.Length}}, @{Name="Size (MB)";Expression={[math]::Round($_.Length / 1MB, 2)}}, @{Name="Path";Expression={Get-RelativePath $_.FullName}}, Name, Extension, LastWriteTime | Export-Csv -Path $exportPath -NoTypeInformation -Encoding UTF8
            Write-Success "Exported to: $exportPath"
        }
        "2" {
            $exportPath = "$PROJECT_ROOT\all-files-report.csv"
            $allFiles | Select-Object @{Name="Size";Expression={$_.Length}}, @{Name="Size (MB)";Expression={[math]::Round($_.Length / 1MB, 2)}}, @{Name="Path";Expression={Get-RelativePath $_.FullName}}, Name, Extension, LastWriteTime | Export-Csv -Path $exportPath -NoTypeInformation -Encoding UTF8
            Write-Success "Exported to: $exportPath"
        }
        "3" {
            $exportPath = "$PROJECT_ROOT\directory-summary-report.csv"
            $filesByDir | Select-Object Directory, @{Name="Size";Expression={$_.TotalSize}}, @{Name="Size (MB)";Expression={[math]::Round($_.TotalSize / 1MB, 2)}}, FileCount | Export-Csv -Path $exportPath -NoTypeInformation -Encoding UTF8
            Write-Success "Exported to: $exportPath"
        }
        "0" {
            Write-Info "Export skipped"
        }
        default {
            Write-Warning "Invalid selection"
        }
    }

    Write-Host ""
    Write-Host ""
    Read-Host "Press Enter to exit"
}

# Run the scanner
Scan-LargeFiles
