# React Native Multi-App Build Script
# Handles building apps for different platforms with resource management
#
# Usage:
#   .\build-multi-app.ps1 <app> <platform> [configuration]
#
# Examples:
#   .\build-multi-app.ps1 myapp android release
#   .\build-multi-app.ps1 myapp ios debug

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$AppName,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$Platform,

    [Parameter(Mandatory = $false, Position = 2)]
    [string]$Configuration = "release"
)

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$FUNCTIONS_DIR = Join-Path $SCRIPT_DIR "functions"
$APP_DIR = Split-Path -Parent $SCRIPT_DIR

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  REACT NATIVE MULTI-APP BUILD SCRIPT" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

. (Join-Path $FUNCTIONS_DIR "AppScanner.ps1")
. (Join-Path $FUNCTIONS_DIR "Prerequisites.ps1")
. (Join-Path $FUNCTIONS_DIR "ResourceManager.ps1")
. (Join-Path $FUNCTIONS_DIR "PlatformBuilder.ps1")
. (Join-Path $FUNCTIONS_DIR "ErrorHandler.ps1")

Set-Location $APP_DIR

Write-Host "[INFO] Initializing app configurations..." -ForegroundColor Yellow
Initialize-AppConfigs -AppDirectory $APP_DIR
$appConfigs = Get-AppConfigs

if (-not (Test-AppExists -Namespace $AppName)) {
    Write-Host ""
    Write-Host "[ERROR] App '$AppName' not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available apps:" -ForegroundColor Yellow
    foreach ($key in $appConfigs.Keys | Sort-Object) {
        Write-Host "  - $key" -ForegroundColor Cyan
    }
    Write-Host ""
    exit 1
}

$appConfig = Get-AppConfig -Namespace $AppName

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  BUILD CONFIGURATION" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "  App          : $($appConfig.DisplayName)" -ForegroundColor Cyan
Write-Host "  Namespace    : $AppName" -ForegroundColor Cyan
Write-Host "  Platform     : $Platform" -ForegroundColor Cyan
Write-Host "  Configuration: $Configuration" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""

$env:APP_ENTRY = $AppName
$env:APP_DISPLAY_NAME = $appConfig.DisplayName

Write-Host "[STEP 1/4] Updating app.json..." -ForegroundColor Magenta
Update-AppJson -AppDirectory $APP_DIR -AppName $AppName -DisplayName $appConfig.DisplayName

Write-Host ""
Write-Host "[STEP 2/4] Backing up platform resources..." -ForegroundColor Magenta
$backupPath = Backup-PlatformResources -AppDirectory $APP_DIR -Platform $Platform

Write-Host ""
Write-Host "[STEP 3/4] Copying app-specific resources..." -ForegroundColor Magenta
Copy-AppResources -AppDirectory $APP_DIR -Namespace $AppName -Platform $Platform

Write-Host ""
Write-Host "[STEP 4/4] Building application..." -ForegroundColor Magenta
Write-Host ""

$buildSuccess = $false

if ($Platform -eq "android") {
    $buildSuccess = Invoke-CommandWithErrorHandling -Command {
        Build-AndroidRelease -AppDirectory $APP_DIR
    } -CommandDescription "Build Android $Configuration for $($appConfig.DisplayName)" -PauseOnError $false
} elseif ($Platform -eq "ios") {
    $buildSuccess = Invoke-CommandWithErrorHandling -Command {
        Build-IosRelease -AppDirectory $APP_DIR
    } -CommandDescription "Build iOS $Configuration for $($appConfig.DisplayName)" -PauseOnError $false
} else {
    Write-Host "[ERROR] Invalid platform: $Platform" -ForegroundColor Red
    Write-Host "[INFO] Valid platforms: android, ios" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[CLEANUP] Restoring original resources..." -ForegroundColor Magenta
if ($backupPath) {
    Restore-PlatformResources -AppDirectory $APP_DIR -BackupPath $backupPath
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
if ($buildSuccess) {
    Write-Host "  BUILD COMPLETED SUCCESSFULLY" -ForegroundColor Green
} else {
    Write-Host "  BUILD FAILED" -ForegroundColor Red
}
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

if ($buildSuccess) {
    exit 0
} else {
    exit 1
}
