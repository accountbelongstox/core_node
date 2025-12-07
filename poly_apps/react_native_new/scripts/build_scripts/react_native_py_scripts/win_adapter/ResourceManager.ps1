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
        $iosImagesDir = Get-IosImagesPath -AppDirectory $AppDirectory
        if ($iosImagesDir -and (Test-Path $iosImagesDir)) {
            $backupImages = Join-Path $platformBackupDir "Images.xcassets"
            Copy-Item -Path $iosImagesDir -Destination $backupImages -Recurse -Force
            Write-Host "[OK] iOS resources backed up to: $backupImages" -ForegroundColor Green
        }
    }

    return $platformBackupDir
}

function Get-IosImagesPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory
    )

    $iosRoot = Join-Path $AppDirectory "ios"
    if (-not (Test-Path $iosRoot)) {
        return $null
    }

    $candidates = Get-ChildItem -Path $iosRoot -Directory -ErrorAction SilentlyContinue
    foreach ($candidate in $candidates) {
        $imagesPath = Join-Path $candidate.FullName "Images.xcassets"
        if (Test-Path $imagesPath) {
            return $imagesPath
        }
    }

    return $null
}

function Get-AppResourceDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Namespace,
        [Parameter(Mandatory = $true)]
        [string]$Platform
    )

    return (Join-Path $AppDirectory "assets\apps\app_$Namespace\$Platform")
}

function Get-AppResourceRoot {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Namespace
    )

    return (Join-Path $AppDirectory "assets\apps\app_$Namespace")
}

function Get-AppResourceFiles {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Namespace,
        [Parameter(Mandatory = $true)]
        [string]$Platform
    )

    $dir = Get-AppResourceDirectory -AppDirectory $AppDirectory -Namespace $Namespace -Platform $Platform
    if (-not (Test-Path $dir)) {
        return @()
    }

    return Get-ChildItem -Path $dir -Recurse -File -ErrorAction SilentlyContinue
}

function Get-TargetBase {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Platform
    )

    if ($Platform -eq "android") {
        return (Join-Path $AppDirectory "android\app\src\main\res")
    }
    elseif ($Platform -eq "ios") {
        return (Get-IosImagesPath -AppDirectory $AppDirectory)
    }

    return $null
}

function Show-AppResourcePlan {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Namespace,
        [Parameter(Mandatory = $true)]
        [string]$Platform
    )

    $dir = Get-AppResourceDirectory -AppDirectory $AppDirectory -Namespace $Namespace -Platform $Platform
    $files = Get-AppResourceFiles -AppDirectory $AppDirectory -Namespace $Namespace -Platform $Platform

    Write-Host "[INFO] Source resource dir ($Platform): $dir" -ForegroundColor Cyan
    if ($files.Count -eq 0) {
        Write-Host "[INFO] No resource files found for $Namespace/$Platform" -ForegroundColor Yellow
        return
    }

    $target = Get-TargetBase -AppDirectory $AppDirectory -Platform $Platform

    Write-Host "[INFO] Target dir ($Platform): $target" -ForegroundColor Cyan
    Write-Host "[INFO] Files to copy:" -ForegroundColor Green
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($dir.Length).TrimStart("\")
        $dest = $null
        if ($target) {
            $dest = Join-Path $target $relativePath
        }
        $destDisplay = if ($dest) { $dest } else { "(no target)" }
        Write-Host (" - " + $file.FullName + " -> " + $destDisplay) -ForegroundColor Gray
    }
}

function Show-AppResourcePlanAll {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [string]$Namespace
    )

    $root = Get-AppResourceRoot -AppDirectory $AppDirectory -Namespace $Namespace
    Write-Host "[INFO] Scanning resources under $root" -ForegroundColor Cyan

    foreach ($platform in @("android", "ios")) {
        $dir = Get-AppResourceDirectory -AppDirectory $AppDirectory -Namespace $Namespace -Platform $platform
        if (-not (Test-Path $dir)) {
            Write-Host "[INFO] No directory for $platform at: $dir" -ForegroundColor Yellow
            continue
        }
        Show-AppResourcePlan -AppDirectory $AppDirectory -Namespace $Namespace -Platform $platform
    }
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

    $appResourcesDir = Get-AppResourceDirectory -AppDirectory $AppDirectory -Namespace $Namespace -Platform $Platform

    if (-not (Test-Path $appResourcesDir)) {
        Write-Host "[WARNING] App resources not found at: $appResourcesDir" -ForegroundColor Yellow
        return $false
    }

    if ($Platform -eq "android") {
        $targetResDir = Get-TargetBase -AppDirectory $AppDirectory -Platform "android"
        if (Test-Path $appResourcesDir) {
            Copy-Item -Path "$appResourcesDir\*" -Destination $targetResDir -Recurse -Force
            Write-Host "[OK] Android resources copied successfully" -ForegroundColor Green
        }
    }
    elseif ($Platform -eq "ios") {
        $targetImagesDir = Get-TargetBase -AppDirectory $AppDirectory -Platform "ios"
        if ($targetImagesDir) {
            Copy-Item -Path "$appResourcesDir\*" -Destination $targetImagesDir -Recurse -Force
            Write-Host "[OK] iOS resources copied successfully" -ForegroundColor Green
        }
        else {
            Write-Host "[WARNING] iOS Images.xcassets path not found under ios/" -ForegroundColor Yellow
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
        $targetImagesDir = Get-IosImagesPath -AppDirectory $AppDirectory
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
