$ErrorActionPreference = "Continue"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Flutter Bloom Android Debug Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "[INFO] App: app_vipclub" -ForegroundColor Yellow
Write-Host "[INFO] Entry File: lib/apps/app_vipclub/main_app_vipclub.dart" -ForegroundColor Yellow
Write-Host "[INFO] Platform: Android" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Set-Location "D:\programing\core_node\poly_apps\flutter_bloom"

# Check for ADB devices
Write-Host "[INFO] Checking for Android devices..." -ForegroundColor Cyan
$adbDevices = @()
try {
    $adbOutput = & adb devices 2>$null
    $adbDevices = $adbOutput | Where-Object { $_ -match "\t" } | ForEach-Object {
        $parts = $_ -split "\t"
        [PSCustomObject]@{
            ID = $parts[0].Trim()
            Status = $parts[1].Trim()
        }
    }
} catch {
    Write-Host "[WARNING] ADB not available" -ForegroundColor Yellow
}

if ($adbDevices.Count -gt 0) {
    Write-Host "[INFO] Found $($adbDevices.Count) Android device(s)" -ForegroundColor Green
    foreach ($device in $adbDevices) {
        Write-Host "  - $($device.ID) ($($device.Status))" -ForegroundColor White
    }
} else {
    Write-Host "[WARNING] No Android devices detected" -ForegroundColor Yellow
    Write-Host "[INFO] Make sure USB debugging is enabled and device is connected" -ForegroundColor Yellow
}

Write-Host "[INFO] Starting Flutter for Android..." -ForegroundColor Green
Write-Host "[INFO] Executing: flutter run --debug -t "lib/apps/app_vipclub/main_app_vipclub.dart"" -ForegroundColor Cyan
Write-Host "[DEBUG] Hot reload: press 'r'" -ForegroundColor Yellow
Write-Host "[DEBUG] Hot restart: press 'R'" -ForegroundColor Yellow
Write-Host "[DEBUG] Quit: press 'q'" -ForegroundColor Yellow

try {
    flutter run --debug -t "lib/apps/app_vipclub/main_app_vipclub.dart"
    Write-Host "[INFO] Flutter command completed successfully" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Flutter command failed: $_" -ForegroundColor Red
}

Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")