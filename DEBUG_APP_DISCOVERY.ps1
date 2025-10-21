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

# Debug App Discovery System

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$NUXT_DIR = Join-Path $SCRIPT_DIR "poly_apps\nuxt_main"
$SCRIPTS_DIR = Join-Path $NUXT_DIR "scripts"
$FUNCTIONS_DIR = Join-Path $SCRIPTS_DIR "functions"
$APPS_DIR = Join-Path $NUXT_DIR "apps"

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  DEBUG: APP DISCOVERY SYSTEM" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 1: Load AppScanner functions" -ForegroundColor Yellow
. (Join-Path $FUNCTIONS_DIR "AppScanner.ps1")
Write-Host "✓ AppScanner loaded" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Scan applications" -ForegroundColor Yellow
$apps = Scan-Applications -AppsDirectory $APPS_DIR
Write-Host "Found $($apps.Count) apps: $($apps -join ', ')" -ForegroundColor Green
Write-Host ""

Write-Host "Step 3: Validate each app structure" -ForegroundColor Yellow
foreach ($app in $apps) {
    $isValid = Validate-AppStructure -AppName $app -AppsDirectory $APPS_DIR
    $status = if ($isValid) { "✓ VALID" } else { "✗ INVALID" }
    Write-Host "  $app: $status" -ForegroundColor $(if ($isValid) { "Green" } else { "Red" })
}
Write-Host ""

Write-Host "Step 4: Check app_ittools specifically" -ForegroundColor Yellow
$ittoolsPath = Join-Path $APPS_DIR "app_ittools"
if (Test-Path $ittoolsPath) {
    Write-Host "  ✓ Directory exists: $ittoolsPath" -ForegroundColor Green

    $configDir = Join-Path $ittoolsPath "config_app_ittools"
    $pagesDir = Join-Path $ittoolsPath "pages_app_ittools"

    Write-Host "  - config_app_ittools exists: $(Test-Path $configDir)" -ForegroundColor Gray
    Write-Host "  - pages_app_ittools exists: $(Test-Path $pagesDir)" -ForegroundColor Gray

    if (Test-Path (Join-Path $ittoolsPath "app-config.json")) {
        Write-Host "  ✓ app-config.json found" -ForegroundColor Green
        $config = Get-Content (Join-Path $ittoolsPath "app-config.json") | ConvertFrom-Json
        Write-Host "    - Display Name: $($config.displayName)" -ForegroundColor Gray
        Write-Host "    - Port: $($config.port)" -ForegroundColor Gray
    }
} else {
    Write-Host "  ✗ Directory NOT found: $ittoolsPath" -ForegroundColor Red
}
Write-Host ""

Write-Host "Step 5: Build complete application configs" -ForegroundColor Yellow
$configs = Build-ApplicationConfigs -AppsDirectory $APPS_DIR -BasePort 3000
Write-Host "Generated configs for $($configs.Count) apps:" -ForegroundColor Green
foreach ($name in $configs.Keys | Sort-Object) {
    $cfg = $configs[$name]
    Write-Host "  - $($cfg.DisplayName) (namespace: $($cfg.Name), port: $($cfg.Port))" -ForegroundColor Green
}
Write-Host ""

Write-Host "Step 6: Check if ittools is in configs" -ForegroundColor Yellow
if ($configs.ContainsKey("ittools")) {
    Write-Host "✓ IT Tools found in configs!" -ForegroundColor Green
    $ittoolsConfig = $configs["ittools"]
    Write-Host "  - Name: $($ittoolsConfig.Name)" -ForegroundColor Gray
    Write-Host "  - DisplayName: $($ittoolsConfig.DisplayName)" -ForegroundColor Gray
    Write-Host "  - Port: $($ittoolsConfig.Port)" -ForegroundColor Gray
    Write-Host "  - DevCommand: $($ittoolsConfig.DevCommand)" -ForegroundColor Gray
    Write-Host "  - BuildCommand: $($ittoolsConfig.BuildCommand)" -ForegroundColor Gray
} else {
    Write-Host "✗ IT Tools NOT found in configs!" -ForegroundColor Red
    Write-Host "  Available apps: $($configs.Keys -join ', ')" -ForegroundColor Red
}
Write-Host ""

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  DEBUG COMPLETE" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
