# Flutter Splash Replacer - Quick Run Script
# 快速运行启动图替换脚本
# Author: Claude AI Assistant

param(
    [Parameter(Mandatory=$false)]
    [string]$AppName = "qy",

    [Parameter(Mandatory=$false)]
    [switch]$WithLogo
)

# 获取脚本目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$MainScript = Join-Path $ScriptDir "splash_replacer.ps1"

# 检查主脚本是否存在
if (-not (Test-Path $MainScript)) {
    Write-Error "Main script not found: $MainScript"
    exit 1
}

Write-Host "=== Flutter Splash Replacer - Quick Run ===" -ForegroundColor Cyan
Write-Host "App Name: $AppName" -ForegroundColor Green
Write-Host "Mode: $(if ($WithLogo) { 'Background + Logo' } else { 'Fullscreen Background' })" -ForegroundColor Green
Write-Host ""

# 运行主脚本
try {
    if ($WithLogo) {
        & $MainScript -AppName $AppName -WithLogo
    } else {
        & $MainScript -AppName $AppName -FullscreenMode
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=== SUCCESS! ===" -ForegroundColor Green
        Write-Host "Splash screen has been replaced successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now:" -ForegroundColor Yellow
        Write-Host "1. Test the app: flutter run" -ForegroundColor White
        Write-Host "2. Build APK: flutter build apk" -ForegroundColor White
        Write-Host "3. Build for release: flutter build apk --release" -ForegroundColor White
    } else {
        Write-Warning "Script completed with warnings. Check the output above."
    }
} catch {
    Write-Error "Failed to run splash replacer: $_"
    exit 1
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
