# ### AI SPECIAL ATTENTION RULES START ###
# When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
# 1. Write all code in English only.
# 2. Never execute, create, or modify test code.
# 3. Never create or update documentation (*.md).
# 4. Never write summaries during development or thinking process.
# 5. Declare all variables at the beginning of the file.
# 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
# 7. Do not modify these rules.
# VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
# ### AI SPECIAL ATTENTION RULES END ###

# Diagnose Auto-Discovery System - Find Why IT Tools Missing

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$NUXT_DIR = Join-Path $SCRIPT_DIR "poly_apps\nuxt_main"
$SCRIPTS_DIR = Join-Path $NUXT_DIR "scripts"
$FUNCTIONS_DIR = Join-Path $SCRIPTS_DIR "functions"
$APPS_DIR = Join-Path $NUXT_DIR "apps"

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "DIAGNOSIS: Why is IT Tools Not in Menu?" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "Loading AppScanner..." -ForegroundColor Yellow
. (Join-Path $FUNCTIONS_DIR "AppScanner.ps1")

Write-Host ""
Write-Host "═ STEP 1: Scan Applications ═" -ForegroundColor Cyan
$discoveredApps = Scan-Applications -AppsDirectory $APPS_DIR
Write-Host "Discovered: $($discoveredApps.Count) apps"
foreach ($app in $discoveredApps) {
    Write-Host "  ✓ $app" -ForegroundColor Green
}

Write-Host ""
Write-Host "═ STEP 2: Check Each App's Structure ═" -ForegroundColor Cyan
foreach ($app in $discoveredApps) {
    $appPath = Join-Path $APPS_DIR "app_$app"
    $configDir = Join-Path $appPath "config_app_$app"
    $pagesDir = Join-Path $appPath "pages_app_$app"

    $configExists = Test-Path $configDir -PathType Container
    $pagesExists = Test-Path $pagesDir -PathType Container

    $isValid = Validate-AppStructure -AppName $app -AppsDirectory $APPS_DIR

    $status = if ($isValid) { "✓ VALID" } else { "✗ INVALID" }
    Write-Host ""
    Write-Host "App: $app → $status" -ForegroundColor $(if ($isValid) { "Green" } else { "Red" })
    Write-Host "  config_app_$app exists: $configExists" -ForegroundColor Gray
    Write-Host "  pages_app_$app exists: $pagesExists" -ForegroundColor Gray

    if (-not $isValid) {
        Write-Host "  ⚠️  WARNING: This app will NOT appear in menu!" -ForegroundColor Red
        if (-not $configExists) {
            Write-Host "    → Missing: config_app_$app" -ForegroundColor Red
        }
        if (-not $pagesExists) {
            Write-Host "    → Missing: pages_app_$app" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "═ STEP 3: Build Configs from Valid Apps ═" -ForegroundColor Cyan
$configs = Build-ApplicationConfigs -AppsDirectory $APPS_DIR -BasePort 3000
Write-Host "Valid configs generated: $($configs.Count)"
foreach ($name in $configs.Keys | Sort-Object) {
    $cfg = $configs[$name]
    Write-Host "  ✓ $($cfg.DisplayName) (port: $($cfg.Port))" -ForegroundColor Green
}

Write-Host ""
Write-Host "═ ANALYSIS RESULT ═" -ForegroundColor Cyan
if ($configs.ContainsKey("ittools")) {
    Write-Host "✅ IT Tools IS in configs!" -ForegroundColor Green
    Write-Host "   Status: Should appear in menu" -ForegroundColor Green
    Write-Host "   Next step: Check MenuConfig and Initialize-AppConfigs" -ForegroundColor Green
} else {
    Write-Host "❌ IT Tools NOT in configs!" -ForegroundColor Red
    Write-Host "   Reason: Failed validation - missing required directories" -ForegroundColor Red

    Write-Host ""
    Write-Host "═ DETAILS ═" -ForegroundColor Yellow
    $ittoolsPath = Join-Path $APPS_DIR "app_ittools"
    if (Test-Path $ittoolsPath) {
        Write-Host "Directory exists: $ittoolsPath" -ForegroundColor Green

        $requiredDirs = @("config_app_ittools", "pages_app_ittools")
        foreach ($dir in $requiredDirs) {
            $dirPath = Join-Path $ittoolsPath $dir
            if (Test-Path $dirPath -PathType Container) {
                Write-Host "  ✓ $dir exists" -ForegroundColor Green
            } else {
                Write-Host "  ✗ $dir MISSING" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "Directory missing: $ittoolsPath" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
