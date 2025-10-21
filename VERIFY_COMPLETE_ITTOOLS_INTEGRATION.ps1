$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$NUXT_DIR = Join-Path $SCRIPT_DIR "poly_apps\nuxt_main"
$SCRIPTS_DIR = Join-Path $NUXT_DIR "scripts"
$FUNCTIONS_DIR = Join-Path $SCRIPTS_DIR "functions"

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "FINAL VERIFICATION: IT Tools Complete Integration" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "✓ Checking Auto-Discovery System..." -ForegroundColor Yellow
. (Join-Path $FUNCTIONS_DIR "AppScanner.ps1")
. (Join-Path $FUNCTIONS_DIR "MenuConfig.ps1")

$configs = Build-ApplicationConfigs -AppsDirectory (Join-Path $NUXT_DIR "apps") -BasePort 3000
Write-Host "  Apps discovered: $($configs.Count)"
if ($configs.ContainsKey("ittools")) {
    Write-Host "  ✅ IT Tools: FOUND" -ForegroundColor Green
} else {
    Write-Host "  ❌ IT Tools: NOT FOUND" -ForegroundColor Red
}

Write-Host ""
Write-Host "✓ Checking Entry Point File..." -ForegroundColor Yellow
$entryPoint = Join-Path $NUXT_DIR "pages\index.ittools.vue"
if (Test-Path $entryPoint) {
    Write-Host "  ✅ pages/index.ittools.vue: EXISTS" -ForegroundColor Green
} else {
    Write-Host "  ❌ pages/index.ittools.vue: MISSING" -ForegroundColor Red
}

Write-Host ""
Write-Host "✓ Checking App Switcher Configuration..." -ForegroundColor Yellow
$switchScript = Join-Path $NUXT_DIR "scripts\switch-app-entry.js"
if (Test-Path $switchScript) {
    $content = Get-Content $switchScript -Raw
    if ($content -match "ittools") {
        Write-Host "  ✅ switch-app-entry.js: ittools registered" -ForegroundColor Green
    } else {
        Write-Host "  ❌ switch-app-entry.js: ittools NOT registered" -ForegroundColor Red
    }
} else {
    Write-Host "  ❌ switch-app-entry.js: NOT FOUND" -ForegroundColor Red
}

Write-Host ""
Write-Host "✓ Checking App Structure..." -ForegroundColor Yellow
$appPath = Join-Path $NUXT_DIR "apps\app_ittools"
$requiredDirs = @("config_app_ittools", "pages_app_ittools", "services_app_ittools", "stores_app_ittools")
$allExist = $true
foreach ($dir in $requiredDirs) {
    $dirPath = Join-Path $appPath $dir
    if (Test-Path $dirPath -PathType Container) {
        Write-Host "  $dir : exists" -ForegroundColor Green
    } else {
        Write-Host "  $dir : MISSING" -ForegroundColor Red
        $allExist = $false
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($configs.ContainsKey("ittools") -and (Test-Path $entryPoint) -and $allExist) {
    Write-Host "🎉 STATUS: ALL SYSTEMS GO!" -ForegroundColor Green
    Write-Host ""
    Write-Host "IT Tools is fully integrated and ready to launch!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "  1. Run: .\scripts\start.ps1" -ForegroundColor Gray
    Write-Host "  2. Select: IT Tools Suite from menu" -ForegroundColor Gray
    Write-Host "  3. Press: Enter to launch" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "⚠️  STATUS: ISSUES DETECTED" -ForegroundColor Red
}

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
