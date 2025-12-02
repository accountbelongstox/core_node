# Cursor Temporary Files Cleanup Script
# Clears all temporary files and cache for Cursor on Windows

Write-Host "=== Cursor Temporary Files Cleanup ===" -ForegroundColor Cyan

$totalSize = 0
$deletedCount = 0
$errorCount = 0

# Function to safely remove directory
function Remove-DirectorySafely {
    param(
        [string]$Path,
        [string]$Description
    )
    
    if (Test-Path $Path) {
        try {
            $size = (Get-ChildItem -Path $Path -Recurse -ErrorAction SilentlyContinue | 
                    Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
            
            if ($size) {
                $sizeMB = [math]::Round($size / 1MB, 2)
                Write-Host "`n$Description" -ForegroundColor Yellow
                Write-Host "  Path: $Path" -ForegroundColor Gray
                Write-Host "  Size: $sizeMB MB" -ForegroundColor Gray
                
                Remove-Item -Path $Path -Recurse -Force -ErrorAction Stop
                Write-Host "  [OK] Deleted successfully" -ForegroundColor Green
                
                $script:totalSize += $size
                $script:deletedCount++
                return $sizeMB
            } else {
                Write-Host "`n$Description" -ForegroundColor Yellow
                Write-Host "  Path: $Path (empty or inaccessible)" -ForegroundColor Gray
                Remove-Item -Path $Path -Recurse -Force -ErrorAction SilentlyContinue
                return 0
            }
        } catch {
            Write-Host "  [ERROR] Failed to delete: $_" -ForegroundColor Red
            $script:errorCount++
            return 0
        }
    } else {
        Write-Host "`n$Description" -ForegroundColor DarkGray
        Write-Host "  Path: $Path (not found)" -ForegroundColor Gray
        return 0
    }
}

# Function to remove files matching pattern
function Remove-FilesByPattern {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Description
    )
    
    if (Test-Path $Path) {
        try {
            $files = Get-ChildItem -Path $Path -Filter $Pattern -Recurse -ErrorAction SilentlyContinue
            if ($files) {
                $size = ($files | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
                if ($size) {
                    $sizeMB = [math]::Round($size / 1MB, 2)
                    Write-Host "`n$Description" -ForegroundColor Yellow
                    Write-Host "  Path: $Path\$Pattern" -ForegroundColor Gray
                    Write-Host "  Files: $($files.Count)" -ForegroundColor Gray
                    Write-Host "  Size: $sizeMB MB" -ForegroundColor Gray
                    
                    $files | Remove-Item -Force -ErrorAction Stop
                    Write-Host "  [OK] Deleted successfully" -ForegroundColor Green
                    
                    $script:totalSize += $size
                    $script:deletedCount += $files.Count
                    return $sizeMB
                }
            }
        } catch {
            Write-Host "`n$Description" -ForegroundColor Yellow
            Write-Host "  [ERROR] Failed to delete: $_" -ForegroundColor Red
            $script:errorCount++
        }
    }
    return 0
}

# Get environment variables
$localAppData = $env:LOCALAPPDATA
$appData = $env:APPDATA
$temp = $env:TEMP

Write-Host "`nScanning Cursor temporary files..." -ForegroundColor Cyan

# 1. Cursor Cache directories in LocalAppData
$cursorLocalPath = Join-Path $localAppData "Cursor"
if (Test-Path $cursorLocalPath) {
    # Cache subdirectories
    $cacheDirs = @(
        "Cache",
        "GPUCache",
        "Code Cache",
        "ShaderCache",
        "logs",
        "CachedData",
        "CachedExtensions",
        "CrashDumps",
        "Crash Reports"
    )
    
    foreach ($dir in $cacheDirs) {
        $fullPath = Join-Path $cursorLocalPath $dir
        Remove-DirectorySafely -Path $fullPath -Description "Cursor $dir"
    }
    
    # Remove temporary files in root
    $tempFiles = Get-ChildItem -Path $cursorLocalPath -File -ErrorAction SilentlyContinue | 
                 Where-Object { $_.Extension -in @('.tmp', '.log', '.cache') }
    if ($tempFiles) {
        $size = ($tempFiles | Measure-Object -Property Length -Sum).Sum
        $sizeMB = [math]::Round($size / 1MB, 2)
        Write-Host "`nCursor temporary files in LocalAppData" -ForegroundColor Yellow
        Write-Host "  Files: $($tempFiles.Count)" -ForegroundColor Gray
        Write-Host "  Size: $sizeMB MB" -ForegroundColor Gray
        $tempFiles | Remove-Item -Force -ErrorAction SilentlyContinue
        $script:totalSize += $size
        $script:deletedCount += $tempFiles.Count
    }
}

# 2. Cursor temporary files in AppData (be careful, only cache/logs)
$cursorAppDataPath = Join-Path $appData "Cursor"
if (Test-Path $cursorAppDataPath) {
    $cacheDirs = @(
        "logs",
        "Cache",
        "CachedData"
    )
    
    foreach ($dir in $cacheDirs) {
        $fullPath = Join-Path $cursorAppDataPath $dir
        Remove-DirectorySafely -Path $fullPath -Description "Cursor $dir (AppData)"
    }
}

# 3. Temporary files in TEMP directory
Write-Host "`n=== Scanning TEMP directory ===" -ForegroundColor Cyan

# Cursor-specific temp files
$cursorTempPatterns = @(
    "Cursor*",
    "cursor*",
    "vscode-*",
    "VSCode-*"
)

foreach ($pattern in $cursorTempPatterns) {
    Remove-FilesByPattern -Path $temp -Pattern $pattern -Description "TEMP: $pattern"
    
    # Also check for directories
    $dirs = Get-ChildItem -Path $temp -Directory -ErrorAction SilentlyContinue | 
            Where-Object { $_.Name -like $pattern }
    
    if ($dirs) {
        foreach ($dir in $dirs) {
            Remove-DirectorySafely -Path $dir.FullName -Description "TEMP directory: $($dir.Name)"
        }
    }
}

# 4. User temp directory (if exists)
$userTemp = Join-Path $env:USERPROFILE "AppData\Local\Temp"
if (Test-Path $userTemp) {
    $cursorDirs = Get-ChildItem -Path $userTemp -Directory -ErrorAction SilentlyContinue | 
                  Where-Object { $_.Name -like "*cursor*" -or $_.Name -like "*Cursor*" -or $_.Name -like "vscode-*" }
    
    if ($cursorDirs) {
        foreach ($dir in $cursorDirs) {
            Remove-DirectorySafely -Path $dir.FullName -Description "User Temp: $($dir.Name)"
        }
    }
}

# 5. Windows Temp directory
$winTemp = $env:WINDIR + "\Temp"
if (Test-Path $winTemp) {
    $cursorFiles = Get-ChildItem -Path $winTemp -ErrorAction SilentlyContinue | 
                   Where-Object { $_.Name -like "*cursor*" -or $_.Name -like "*Cursor*" -or $_.Name -like "vscode-*" }
    
    if ($cursorFiles) {
        $size = ($cursorFiles | Measure-Object -Property Length -Sum -ErrorAction SilentlyContinue).Sum
        if ($size) {
            $sizeMB = [math]::Round($size / 1MB, 2)
            Write-Host "`nWindows Temp: Cursor files" -ForegroundColor Yellow
            Write-Host "  Files: $($cursorFiles.Count)" -ForegroundColor Gray
            Write-Host "  Size: $sizeMB MB" -ForegroundColor Gray
            $cursorFiles | Remove-Item -Force -ErrorAction SilentlyContinue
            $script:totalSize += $size
            $script:deletedCount += $cursorFiles.Count
        }
    }
}

# Summary
Write-Host "`n=== Cleanup Summary ===" -ForegroundColor Cyan
$totalSizeMB = [math]::Round($totalSize / 1MB, 2)
$totalSizeGB = [math]::Round($totalSize / 1GB, 2)

Write-Host "Total files/directories deleted: $deletedCount" -ForegroundColor $(if ($deletedCount -gt 0) { "Green" } else { "Gray" })
Write-Host "Total size freed: $totalSizeMB MB ($totalSizeGB GB)" -ForegroundColor $(if ($totalSize -gt 0) { "Green" } else { "Gray" })
Write-Host "Errors encountered: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })

if ($deletedCount -eq 0 -and $errorCount -eq 0) {
    Write-Host "`nNo Cursor temporary files found to clean." -ForegroundColor Green
} else {
    Write-Host "`nCleanup completed!" -ForegroundColor Cyan
}

