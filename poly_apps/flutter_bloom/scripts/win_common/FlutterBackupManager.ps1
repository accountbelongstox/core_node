# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Flutter Backup Manager Helper Functions
# Backup and restore functionality for Flutter development system
# Author: Development Script System
# Version: 1.0

# Import required modules
$WinCommonDir = $PSScriptRoot
. (Join-Path $WinCommonDir "FlutterGlobalVar.ps1")
. (Join-Path $WinCommonDir "FlutterLogManager.ps1")

function Initialize-BackupSystem {
    <#
    .SYNOPSIS
    Initialize backup directory structure

    .RETURNS
    True if successful
    #>

    try {
        $projectRoot = Get-FileVariable -Name $Global:KEY_FLUTTER_PROJECT_DIR_BY_GVAR -DefaultValue ""
        if (-not $projectRoot) {
            Write-Error "Project root not set in file variable system"
            return $false
        }

        $backupDir = Join-Path $projectRoot ".tmp"
        $subdirs = @("pubspec_backups", "file_backups", "image_backups", "config_backups")

        foreach ($subdir in $subdirs) {
            $fullPath = Join-Path $backupDir $subdir
            if (-not (Test-Path $fullPath)) {
                New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
                if ($Global:DEBUG_MODE) {
                    Write-Host "Created backup directory: $fullPath" -ForegroundColor Cyan
                }
            }
        }

        Write-Host "Backup system initialized" -ForegroundColor Green
        return $true

    }
    catch {
        Write-Error "Error initializing backup system: $($_.Exception.Message)"
        return $false
    }
}

function Backup-PubspecYaml {
    <#
    .SYNOPSIS
    Create timestamped backup of pubspec.yaml

    .RETURNS
    Path to backup file or null if failed
    #>

    try {
        $projectRoot = Get-FileVariable -Name $Global:KEY_FLUTTER_PROJECT_DIR_BY_GVAR -DefaultValue ""
        $pubspecPath = Join-Path $projectRoot "pubspec.yaml"

        if (-not (Test-Path $pubspecPath)) {
            Write-Warning "pubspec.yaml not found: $pubspecPath"
            return $null
        }

        $backupDir = Join-Path $projectRoot ".tmp\pubspec_backups"
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = Join-Path $backupDir "pubspec_$timestamp.yaml"

        Copy-Item $pubspecPath $backupPath -Force

        if ($Global:DEBUG_MODE) {
            Write-Host "Backed up pubspec.yaml to: $backupPath" -ForegroundColor Cyan
        }

        # Store backup info in file variables
        Set-FileVariable -Name "KEY_LAST_PUBSPEC_BACKUP_PATH" -Value $backupPath
        Set-FileVariable -Name "KEY_LAST_PUBSPEC_BACKUP_TIME" -Value (Get-Date -Format "yyyy-MM-dd HH:mm:ss")

        return $backupPath

    }
    catch {
        Write-Error "Error backing up pubspec.yaml: $($_.Exception.Message)"
        return $null
    }
}

function Backup-OriginalConfig {
    <#
    .SYNOPSIS
    Create backup of original configuration

    .PARAMETER AppName
    Name of the app being processed

    .RETURNS
    True if successful
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName
    )

    try {
        $devScriptDir = Get-FileVariable -Name "KEY_DEV_SCRIPT_DIR" -DefaultValue ""
        $originalConfigPath = Join-Path $devScriptDir "original_config.ini"

        if (-not (Test-Path $originalConfigPath)) {
            Write-Warning "Original config file not found: $originalConfigPath"
            return $false
        }

        $backupDir = Join-Path (Get-FileVariable -Name $Global:KEY_FLUTTER_PROJECT_DIR_BY_GVAR -DefaultValue "") ".tmp\config_backups"
        $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
        $backupPath = Join-Path $backupDir "original_config_${AppName}_$timestamp.ini"

        Copy-Item $originalConfigPath $backupPath -Force

        if ($Global:DEBUG_MODE) {
            Write-Host "Backed up original config to: $backupPath" -ForegroundColor Cyan
        }

        return $true

    }
    catch {
        Write-Error "Error backing up original config: $($_.Exception.Message)"
        return $false
    }
}

function Get-LatestBackup {
    <#
    .SYNOPSIS
    Get path to latest backup of specified type

    .PARAMETER BackupType
    Type of backup (pubspec, config, etc.)

    .PARAMETER Pattern
    File pattern to search for

    .RETURNS
    Path to latest backup or null if not found
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$BackupType,

        [Parameter(Mandatory=$true)]
        [string]$Pattern
    )

    try {
        $projectRoot = Get-FileVariable -Name $Global:KEY_FLUTTER_PROJECT_DIR_BY_GVAR -DefaultValue ""
        $backupDir = Join-Path $projectRoot ".tmp\${BackupType}_backups"

        if (-not (Test-Path $backupDir)) {
            Write-Warning "Backup directory not found: $backupDir"
            return $null
        }

        $backupFiles = Get-ChildItem -Path $backupDir -Filter $Pattern | Sort-Object LastWriteTime -Descending

        if ($backupFiles.Count -eq 0) {
            Write-Warning "No backup files found matching pattern: $Pattern"
            return $null
        }

        return $backupFiles[0].FullName

    }
    catch {
        Write-Error "Error finding latest backup: $($_.Exception.Message)"
        return $null
    }
}

function Restore-FromBackup {
    <#
    .SYNOPSIS
    Restore file from backup

    .PARAMETER BackupPath
    Path to backup file

    .PARAMETER TargetPath
    Path where to restore the file

    .RETURNS
    True if successful
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$BackupPath,

        [Parameter(Mandatory=$true)]
        [string]$TargetPath
    )

    Write-Host "[INFO] About to restore from backup: $BackupPath to $TargetPath" -ForegroundColor Yellow
    $confirmation = Read-Host "Continue? (y/n)"
    if ($confirmation -ne "y") {
        return $false
    }

    try {
        if (-not (Test-Path $BackupPath)) {
            Write-Error "Backup file not found: $BackupPath"
            return $false
        }

        # Create target directory if needed
        $targetDir = Split-Path $TargetPath -Parent
        if (-not (Test-Path $targetDir)) {
            New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
        }

        # Create backup of current state before restore
        if (Test-Path $TargetPath) {
            $currentBackupDir = Join-Path (Split-Path $BackupPath -Parent) "pre_restore"
            if (-not (Test-Path $currentBackupDir)) {
                New-Item -ItemType Directory -Path $currentBackupDir -Force | Out-Null
            }

            $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
            $currentBackupPath = Join-Path $currentBackupDir "$(Split-Path $TargetPath -Leaf)_before_restore_$timestamp"
            Copy-Item $TargetPath $currentBackupPath -Force

            if ($Global:DEBUG_MODE) {
                Write-Host "Created pre-restore backup: $currentBackupPath" -ForegroundColor Cyan
            }
        }

        # Restore from backup
        Copy-Item $BackupPath $TargetPath -Force

        Write-Host "Restored $TargetPath from backup" -ForegroundColor Green
        return $true

    }
    catch {
        Write-Error "Error restoring from backup: $($_.Exception.Message)"
        return $false
    }
}

function Invoke-CleanupRestore {
    <#
    .SYNOPSIS
    Execute cleanup and restore using Python script

    .PARAMETER AppName
    Name of app to clean up

    .RETURNS
    True if successful
    #>

    param(
        [Parameter(Mandatory=$true)]
        [string]$AppName
    )

    try {
        $devScriptDir = Get-FileVariable -Name "KEY_DEV_SCRIPT_DIR" -DefaultValue ""
        $cleanupScript = Join-Path $devScriptDir "py_helper\cleanup_restore.py"

        if (-not (Test-Path $cleanupScript)) {
            Write-Error "Cleanup script not found: $cleanupScript"
            return $false
        }

        $command = "python `"$cleanupScript`" `"$AppName`""
        $description = "Running cleanup and restore for app: $AppName"

        Write-Host "[INFO] $description" -ForegroundColor Cyan
        Write-Host "[CMD] $command" -ForegroundColor Yellow

        Invoke-Expression $command
        return ($LASTEXITCODE -eq 0)

    }
    catch {
        Write-Error "Error executing cleanup restore: $($_.Exception.Message)"
        return $false
    }
}

function Show-BackupStatus {
    <#
    .SYNOPSIS
    Display current backup status and available backups
    #>

    try {
        $projectRoot = Get-FileVariable -Name $Global:KEY_FLUTTER_PROJECT_DIR_BY_GVAR -DefaultValue ""
        $backupBaseDir = Join-Path $projectRoot ".tmp"

        Write-Host ""
        Write-Host "Backup Status:" -ForegroundColor Yellow
        Write-Host "=" * 40 -ForegroundColor Yellow

        if (-not (Test-Path $backupBaseDir)) {
            Write-Host "No backup directory found" -ForegroundColor Red
            return
        }

        # Check pubspec backups
        $pubspecBackupDir = Join-Path $backupBaseDir "pubspec_backups"
        if (Test-Path $pubspecBackupDir) {
            $pubspecBackups = Get-ChildItem -Path $pubspecBackupDir -Filter "pubspec_*.yaml" | Sort-Object LastWriteTime -Descending
            Write-Host "Pubspec Backups: $($pubspecBackups.Count)" -ForegroundColor Cyan
            if ($pubspecBackups.Count -gt 0) {
                Write-Host "  Latest: $($pubspecBackups[0].Name) ($($pubspecBackups[0].LastWriteTime))" -ForegroundColor White
            }
        }

        # Check file backups
        $fileBackupDir = Join-Path $backupBaseDir "file_backups"
        if (Test-Path $fileBackupDir) {
            $fileBackups = Get-ChildItem -Path $fileBackupDir -Recurse -File | Measure-Object
            Write-Host "File Backups: $($fileBackups.Count)" -ForegroundColor Cyan
        }

        # Check image backups
        $imageBackupDir = Join-Path $backupBaseDir "image_backups"
        if (Test-Path $imageBackupDir) {
            $imageBackups = Get-ChildItem -Path $imageBackupDir -Recurse -File | Measure-Object
            Write-Host "Image Backups: $($imageBackups.Count)" -ForegroundColor Cyan
        }

        # Check config backups
        $configBackupDir = Join-Path $backupBaseDir "config_backups"
        if (Test-Path $configBackupDir) {
            $configBackups = Get-ChildItem -Path $configBackupDir -Filter "*.ini" | Measure-Object
            Write-Host "Config Backups: $($configBackups.Count)" -ForegroundColor Cyan
        }

        Write-Host ""

    }
    catch {
        Write-Error "Error showing backup status: $($_.Exception.Message)"
    }
}

function Clear-OldBackups {
    <#
    .SYNOPSIS
    Clear old backup files (keep last 10 of each type)

    .PARAMETER KeepCount
    Number of backups to keep (default: 10)

    .RETURNS
    True if successful
    #>

    param(
        [Parameter(Mandatory=$false)]
        [int]$KeepCount = 10
    )

    Write-Host "[INFO] About to clear old backup files (keeping $KeepCount latest)" -ForegroundColor Yellow
    $confirmation = Read-Host "Continue? (y/n)"
    if ($confirmation -ne "y") {
        return $false
    }

    try {
        $projectRoot = Get-FileVariable -Name $Global:KEY_FLUTTER_PROJECT_DIR_BY_GVAR -DefaultValue ""
        $backupBaseDir = Join-Path $projectRoot ".tmp"

        if (-not (Test-Path $backupBaseDir)) {
            Write-Host "No backup directory found to clean" -ForegroundColor Yellow
            return $true
        }

        $backupTypes = @("pubspec_backups", "file_backups", "image_backups", "config_backups")
        $totalRemoved = 0

        foreach ($backupType in $backupTypes) {
            $backupDir = Join-Path $backupBaseDir $backupType
            if (Test-Path $backupDir) {
                $backupFiles = Get-ChildItem -Path $backupDir -File | Sort-Object LastWriteTime -Descending

                if ($backupFiles.Count -gt $KeepCount) {
                    $filesToRemove = $backupFiles | Select-Object -Skip $KeepCount

                    foreach ($file in $filesToRemove) {
                        Remove-Item $file.FullName -Force
                        $totalRemoved++

                        if ($Global:DEBUG_MODE) {
                            Write-Host "Removed old backup: $($file.Name)" -ForegroundColor Cyan
                        }
                    }
                }
            }
        }

        Write-Host "Cleaned up $totalRemoved old backup files" -ForegroundColor Green
        return $true

    }
    catch {
        Write-Error "Error clearing old backups: $($_.Exception.Message)"
        return $false
    }
}

# Functions are available for dot-sourcing, no Export-ModuleMember needed