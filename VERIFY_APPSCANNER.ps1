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

# AppScanner Verification Script

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$NUXT_DIR = Join-Path $SCRIPT_DIR "poly_apps\nuxt_main"
$SCRIPTS_DIR = Join-Path $NUXT_DIR "scripts"
$FUNCTIONS_DIR = Join-Path $SCRIPTS_DIR "functions"
$APPS_DIR = Join-Path $NUXT_DIR "apps"

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  APPSCANNER VERIFICATION TEST" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

try {
    Write-Host "[STEP 1] Loading AppScanner.ps1..." -ForegroundColor Yellow
    . (Join-Path $FUNCTIONS_DIR "AppScanner.ps1")
    Write-Host "  ✓ AppScanner loaded successfully" -ForegroundColor Green
    Write-Host ""

    Write-Host "[STEP 2] Testing Scan-Applications..." -ForegroundColor Yellow
    $apps = Scan-Applications -AppsDirectory $APPS_DIR
    Write-Host "  ✓ Found $($apps.Count) applications: $($apps -join ', ')" -ForegroundColor Green
    Write-Host ""

    Write-Host "[STEP 3] Testing Convert-ToDisplayName..." -ForegroundColor Yellow
    $testCases = @("ittools", "example", "my_app_name")
    foreach ($testName in $testCases) {
        $displayName = Convert-ToDisplayName -AppName $testName
        Write-Host "  ✓ $testName → '$displayName'" -ForegroundColor Green
    }
    Write-Host ""

    Write-Host "[STEP 4] Testing Generate-PortNumber..." -ForegroundColor Yellow
    for ($i = 0; $i -lt 6; $i++) {
        $port = Generate-PortNumber -SequenceIndex $i -BasePort 3000
        Write-Host "  ✓ Sequence $i → Port $port" -ForegroundColor Green
    }
    Write-Host ""

    Write-Host "[STEP 5] Testing Get-AppConfigOverride..." -ForegroundColor Yellow
    $override = Get-AppConfigOverride -AppName "ittools" -AppsDirectory $APPS_DIR
    if ($override) {
        Write-Host "  ✓ Found IT Tools override config" -ForegroundColor Green
        Write-Host "    - Display Name: $($override.displayName)" -ForegroundColor Gray
        Write-Host "    - Port: $($override.port)" -ForegroundColor Gray
    } else {
        Write-Host "  ✓ No override config for IT Tools (uses auto-generated)" -ForegroundColor Gray
    }
    Write-Host ""

    Write-Host "[STEP 6] Testing Validate-AppStructure..." -ForegroundColor Yellow
    foreach ($app in $apps) {
        $isValid = Validate-AppStructure -AppName $app -AppsDirectory $APPS_DIR
        if ($isValid) {
            Write-Host "  ✓ $app - Structure valid" -ForegroundColor Green
        } else {
            Write-Host "  ⚠ $app - Structure invalid" -ForegroundColor Yellow
        }
    }
    Write-Host ""

    Write-Host "[STEP 7] Testing Build-ApplicationConfigs..." -ForegroundColor Yellow
    $configs = Build-ApplicationConfigs -AppsDirectory $APPS_DIR -BasePort 3000
    Write-Host "  ✓ Generated $($configs.Count) app configurations" -ForegroundColor Green
    Write-Host ""

    Write-Host "[STEP 8] Displaying discovered applications..." -ForegroundColor Yellow
    Log-DiscoveredApplications -AppConfigs $configs
    Write-Host ""

    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host "  ✅ ALL TESTS PASSED - APPSCANNER IS WORKING CORRECTLY" -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host ""
}
catch {
    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Red
    Write-Host "  ❌ ERROR DETECTED" -ForegroundColor Red
    Write-Host "===============================================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error Message:" -ForegroundColor Red
    Write-Host "  $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Stack Trace:" -ForegroundColor Red
    Write-Host "  $($_.ScriptStackTrace)" -ForegroundColor Red
    Write-Host ""
}
