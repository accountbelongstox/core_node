# ResourceManager.ps1
# Manages platform-specific resource replacement for React Native apps

function Backup-PlatformResources {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Platform
    )

    Write-Host "[INFO] Backing up $Platform resources..." -ForegroundColor Cyan

    $backupDir = Join-Path $AppDirectory ".resource-backups"
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $platformBackupDir = Join-Path $backupDir "${Platform}_${timestamp}"

    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    }

    if ($Platform -eq "android") {
        $androidResDir = Join-Path $AppDirectory "android\app\src\main\res"
        if (Test-Path $androidResDir) {
            Copy-Item -Path $androidResDir -Destination (Join-Path $platformBackupDir "res") -Recurse -Force
            Write-Host "[OK] Android resources backed up to: $platformBackupDir" -ForegroundColor Green
        }
    }
    elseif ($Platform -eq "ios") {
        $iosImagesDir = Join-Path $AppDirectory "ios\YourAppName\Images.xcassets"
        if (Test-Path $iosImagesDir) {
            Copy-Item -Path $iosImagesDir -Destination (Join-Path $platformBackupDir "Images.xcassets") -Recurse -Force
            Write-Host "[OK] iOS resources backed up to: $platformBackupDir" -ForegroundColor Green
        }
    }

    return $platformBackupDir
}

function Copy-AppResources {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Namespace,
        [Parameter(Mandatory = $true)]
        [string]$Platform
    )

    Write-Host "[INFO] Copying $Namespace resources for $Platform..." -ForegroundColor Cyan

    $appResourcesDir = Join-Path $AppDirectory "assets\apps\app_$Namespace\$Platform"

    if (-not (Test-Path $appResourcesDir)) {
        Write-Host "[WARNING] App resources not found at: $appResourcesDir" -ForegroundColor Yellow
        return $false
    }

    if ($Platform -eq "android") {
        $targetResDir = Join-Path $AppDirectory "android\app\src\main\res"
        if (Test-Path $appResourcesDir) {
            Copy-Item -Path "$appResourcesDir\*" -Destination $targetResDir -Recurse -Force
            Write-Host "[OK] Android resources copied successfully" -ForegroundColor Green
        }
    }
    elseif ($Platform -eq "ios") {
        $targetImagesDir = Join-Path $AppDirectory "ios\YourAppName\Images.xcassets"
        if (Test-Path $appResourcesDir) {
            Copy-Item -Path "$appResourcesDir\*" -Destination $targetImagesDir -Recurse -Force
            Write-Host "[OK] iOS resources copied successfully" -ForegroundColor Green
        }
    }

    return $true
}

function Restore-PlatformResources {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [string]$BackupPath
    )

    Write-Host "[INFO] Restoring resources from backup..." -ForegroundColor Cyan

    if (-not (Test-Path $BackupPath)) {
        Write-Host "[WARNING] Backup not found at: $BackupPath" -ForegroundColor Yellow
        return $false
    }

    $resBackup = Join-Path $BackupPath "res"
    if (Test-Path $resBackup) {
        $targetResDir = Join-Path $AppDirectory "android\app\src\main\res"
        Copy-Item -Path "$resBackup\*" -Destination $targetResDir -Recurse -Force
        Write-Host "[OK] Android resources restored" -ForegroundColor Green
    }

    $imagesBackup = Join-Path $BackupPath "Images.xcassets"
    if (Test-Path $imagesBackup) {
        $targetImagesDir = Join-Path $AppDirectory "ios\YourAppName\Images.xcassets"
        Copy-Item -Path "$imagesBackup\*" -Destination $targetImagesDir -Recurse -Force
        Write-Host "[OK] iOS resources restored" -ForegroundColor Green
    }

    return $true
}

function Update-AppJson {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [string]$AppName,
        [Parameter(Mandatory = $true)]
        [string]$DisplayName
    )

    Write-Host "[INFO] Updating app.json configuration..." -ForegroundColor Cyan

    $appJsonPath = Join-Path $AppDirectory "app.json"

    if (Test-Path $appJsonPath) {
        $appJsonContent = Get-Content $appJsonPath -Raw | ConvertFrom-Json
        $appJsonContent.name = $AppName
        $appJsonContent.displayName = $DisplayName

        $appJsonContent | ConvertTo-Json -Depth 10 | Set-Content $appJsonPath -Encoding UTF8
        Write-Host "[OK] app.json updated successfully" -ForegroundColor Green
        return $true
    }

    Write-Host "[WARNING] app.json not found at: $appJsonPath" -ForegroundColor Yellow
    return $false
}
