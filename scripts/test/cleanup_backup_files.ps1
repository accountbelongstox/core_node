#!/usr/bin/env pwsh
# Script to scan and delete backup files with pattern .backup_YYYYMMDD_HHMMSS

param(
    [string]$ScanPath = "D:\programing\core_node",
    [switch]$Force = $false
)

# Backup file pattern: .backup_数字_数字
# Example: .backup_20251129_112520
$backupPattern = '\.backup_\d{8}_\d{6}$'

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Backup Files Cleanup Script" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[INFO] Scanning directory: $ScanPath" -ForegroundColor Yellow
Write-Host "[INFO] Pattern: *.backup_YYYYMMDD_HHMMSS" -ForegroundColor Yellow
Write-Host ""

# Find all files matching the backup pattern
try {
    $backupFiles = Get-ChildItem -Path $ScanPath -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
        $_.Name -match $backupPattern
    }
} catch {
    Write-Host "[ERROR] Failed to scan directory: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if ($backupFiles.Count -eq 0) {
    Write-Host "[INFO] No backup files found matching the pattern." -ForegroundColor Green
    Write-Host ""
    exit 0
}

Write-Host "[INFO] Found $($backupFiles.Count) backup file(s):" -ForegroundColor Cyan
Write-Host ""

# Display all found files
$fileList = @()
$index = 1
foreach ($file in $backupFiles) {
    $relativePath = $file.FullName.Replace($ScanPath, ".").Replace("\", "/")
    $fileSize = [math]::Round($file.Length / 1KB, 2)
    Write-Host "  [$index] $relativePath ($fileSize KB)" -ForegroundColor Gray
    $fileList += $file
    $index++
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# Ask for confirmation
if (-not $Force) {
    $confirm = Read-Host "Delete all $($backupFiles.Count) backup file(s)? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "[INFO] Operation cancelled." -ForegroundColor Yellow
        Write-Host ""
        exit 0
    }
}

Write-Host ""
Write-Host "[INFO] Deleting all backup files..." -ForegroundColor Yellow
Write-Host ""

# Delete all files at once
$deletedCount = 0
$skippedCount = 0

foreach ($file in $fileList) {
    $relativePath = $file.FullName.Replace($ScanPath, ".").Replace("\", "/")
    
    try {
        Remove-Item -Path $file.FullName -Force -ErrorAction Stop
        Write-Host "  [DELETED] $relativePath" -ForegroundColor Green
        $deletedCount++
    } catch {
        Write-Host "  [ERROR] Failed to delete: $relativePath" -ForegroundColor Red
        Write-Host "          Error: $($_.Exception.Message)" -ForegroundColor Red
        $skippedCount++
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  Deleted: $deletedCount" -ForegroundColor Green
Write-Host "  Skipped: $skippedCount" -ForegroundColor Yellow
Write-Host "  Total:   $($backupFiles.Count)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

