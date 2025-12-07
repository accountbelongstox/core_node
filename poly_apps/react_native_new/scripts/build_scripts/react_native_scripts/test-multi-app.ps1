# React Native Multi-App Test Runner
# Runs tests for specific app or all apps
#
# Usage:
#   .\test-multi-app.ps1               # Run all tests
#   .\test-multi-app.ps1 <app>         # Run tests for specific app
#   .\test-multi-app.ps1 <app> --watch # Run tests in watch mode
#
# Examples:
#   .\test-multi-app.ps1
#   .\test-multi-app.ps1 myapp
#   .\test-multi-app.ps1 myapp --watch

param(
    [Parameter(Mandatory = $false, Position = 0)]
    [string]$AppName = "",

    [Parameter(Mandatory = $false)]
    [switch]$Watch,

    [Parameter(Mandatory = $false)]
    [switch]$Coverage
)

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$FUNCTIONS_DIR = Join-Path $SCRIPT_DIR "functions"
$APP_DIR = Split-Path -Parent $SCRIPT_DIR

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  REACT NATIVE MULTI-APP TEST RUNNER" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

. (Join-Path $FUNCTIONS_DIR "AppScanner.ps1")
. (Join-Path $FUNCTIONS_DIR "Prerequisites.ps1")
. (Join-Path $FUNCTIONS_DIR "PlatformBuilder.ps1")
. (Join-Path $FUNCTIONS_DIR "ErrorHandler.ps1")

Set-Location $APP_DIR

Write-Host "[INFO] Initializing app configurations..." -ForegroundColor Yellow
Initialize-AppConfigs -AppDirectory $APP_DIR
$appConfigs = Get-AppConfigs

if ($AppName -and $AppName -ne "") {
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
    Write-Host "  TEST CONFIGURATION" -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host "  App       : $($appConfig.DisplayName)" -ForegroundColor Cyan
    Write-Host "  Namespace : $AppName" -ForegroundColor Cyan
    Write-Host "  Watch Mode: $($Watch.IsPresent)" -ForegroundColor Cyan
    Write-Host "  Coverage  : $($Coverage.IsPresent)" -ForegroundColor Cyan
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host "  RUNNING ALL TESTS" -ForegroundColor Green
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host "  Watch Mode: $($Watch.IsPresent)" -ForegroundColor Cyan
    Write-Host "  Coverage  : $($Coverage.IsPresent)" -ForegroundColor Cyan
    Write-Host "===============================================================================" -ForegroundColor Green
    Write-Host ""
}

$testCommand = "npm test"

if ($AppName) {
    $testCommand += " -- --testPathPattern=app_$AppName"
}

if ($Watch.IsPresent) {
    $testCommand += " --watch"
}

if ($Coverage.IsPresent) {
    $testCommand += " --coverage"
}

Write-Host "[INFO] Running: $testCommand" -ForegroundColor Yellow
Write-Host ""

Invoke-CommandWithErrorHandling -Command {
    Invoke-Expression $testCommand
} -CommandDescription "Run tests" -PauseOnError $false

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "  TEST RUN COMPLETED" -ForegroundColor Cyan
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""
