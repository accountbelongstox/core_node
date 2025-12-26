$ErrorActionPreference = "Continue"
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Flutter Bloom Web Debug Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
<<<<<<< HEAD
Write-Host "[INFO] App: app_wuy" -ForegroundColor Yellow
Write-Host "[INFO] Entry File: lib/apps/app_wuy/main_app_wuy.dart" -ForegroundColor Yellow
Write-Host "[INFO] Debug Port: 10008" -ForegroundColor Yellow
Write-Host "[INFO] Platform: Web" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Set-Location "D:\programing\core_node\poly_apps\flutter_bloom"
Write-Host "[INFO] Executing: flutter run -d web-server --web-port 10008 --web-hostname 0.0.0.0 -t "lib/apps/app_wuy/main_app_wuy.dart"" -ForegroundColor Green
Write-Host "[INFO] Web server will be available at: http://localhost:10008" -ForegroundColor Green
Write-Host "[INFO] Press Ctrl+C to stop the debug server" -ForegroundColor Yellow
try {
    flutter run -d web-server --web-port 10008 --web-hostname 0.0.0.0 -t "lib/apps/app_wuy/main_app_wuy.dart"
=======
Write-Host "[INFO] App: app_bank" -ForegroundColor Yellow
Write-Host "[INFO] Entry File: lib/apps/app_bank/main_app_bank.dart" -ForegroundColor Yellow
Write-Host "[INFO] Debug Port: 10002" -ForegroundColor Yellow
Write-Host "[INFO] Platform: Web" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Set-Location "D:\programing\core_node\poly_apps\flutter_bloom"
Write-Host "[INFO] Executing: flutter run -d web-server --web-port 10002 --web-hostname 0.0.0.0 -t "lib/apps/app_bank/main_app_bank.dart"" -ForegroundColor Green
Write-Host "[INFO] Web server will be available at: http://localhost:10002" -ForegroundColor Green
Write-Host "[INFO] Press Ctrl+C to stop the debug server" -ForegroundColor Yellow
try {
    flutter run -d web-server --web-port 10002 --web-hostname 0.0.0.0 -t "lib/apps/app_bank/main_app_bank.dart"
>>>>>>> 85fd4acd3319ff914dde3f9897481e0c0a6a4798
    Write-Host "[INFO] Flutter command completed successfully" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Flutter command failed: $_" -ForegroundColor Red
}
Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")