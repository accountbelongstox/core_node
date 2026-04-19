param()

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$SCRIPT_DIR = $null
$SCRIPTS_ROOT = $null
$PROJECT_ROOT = $null
$WIN_COMMON_DIR = $null
$selectedApp = $null
$entryFile = $null
$appIndex = $null
$debugPort = $null
$hostName = $null
$flutterArgs = $null
$flutterCommandDisplay = $null
$projectRootFromVar = $null

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$SCRIPTS_ROOT = Split-Path -Parent $SCRIPT_DIR
$PROJECT_ROOT = Split-Path -Parent $SCRIPTS_ROOT
$WIN_COMMON_DIR = Join-Path $SCRIPTS_ROOT "win_common"

. (Join-Path $WIN_COMMON_DIR "FlutterGlobalVar.ps1")
. (Join-Path $WIN_COMMON_DIR "CommonUtilities.ps1")

$projectRootFromVar = Get-FileVariable -Name "KEY_PROJECT_ROOT" -DefaultValue ""
if ($projectRootFromVar) {
    $PROJECT_ROOT = $projectRootFromVar
}

try {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Flutter Bloom Web Debug Launcher" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    Write-Host "[DEBUG] Script directory: '$SCRIPT_DIR'" -ForegroundColor Magenta
    Write-Host "[DEBUG] Scripts root: '$SCRIPTS_ROOT'" -ForegroundColor Magenta
    Write-Host "[DEBUG] Project root: '$PROJECT_ROOT'" -ForegroundColor Magenta

    Assert-FlutterProject -ProjectPath $PROJECT_ROOT
    Assert-FlutterEnvironment

    Set-Location $PROJECT_ROOT
    Write-Host "[DEBUG] Switched to project root: $(Get-Location)" -ForegroundColor Magenta

    $selectedApp = Get-FileVariable -Name $Global:KEY_SELECTED_APP -DefaultValue "app_main"
    if (-not $selectedApp) {
        $selectedApp = "app_main"
    }

    $entryFile = Get-FileVariable -Name $Global:KEY_SELECTED_ENTRY_FILE -DefaultValue ("lib/apps/$selectedApp/main_$selectedApp.dart")
    $appIndex = Get-FileVariable -Name $Global:KEY_APP_INDEX -DefaultValue "0"
    $debugPort = Get-FileVariable -Name $Global:KEY_DEBUG_PORT -DefaultValue "10000"

    if (-not $debugPort -or $debugPort -eq "0") {
        $debugPort = Get-AppPortWithFallback -AppName $selectedApp
    }

    $hostName = "0.0.0.0"

    Write-Host "[INFO] Web Debug Configuration:" -ForegroundColor Green
    Write-Host "  App: $selectedApp" -ForegroundColor Yellow
    Write-Host "  Entry File: $entryFile" -ForegroundColor Yellow
    Write-Host "  App Index: $appIndex" -ForegroundColor Yellow
    Write-Host "  Debug Port: $debugPort" -ForegroundColor Yellow
    Write-Host "  Platform: Web" -ForegroundColor Yellow

    $flutterArgs = @(
        "run",
        "-d", "web-server",
        "--web-port", $debugPort,
        "--web-hostname", $hostName,
        "-t", $entryFile
    )

    $flutterCommandDisplay = "flutter " + ($flutterArgs -join " ")

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "[INFO] Executing: $flutterCommandDisplay" -ForegroundColor Green
    Write-Host "[INFO] Web server will be available at: http://localhost:$debugPort" -ForegroundColor Green
    Show-NetworkURLs -Port ([int]$debugPort) -Title "[INFO] Network URLs for web debug" -ShowCopyHint $true
    Write-Host "[INFO] Press Ctrl+C to stop the debug server" -ForegroundColor Yellow

    try {
        flutter @flutterArgs
        Write-Host "[INFO] Flutter command completed successfully" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Flutter command failed: $_" -ForegroundColor Red
    }
} catch {
    Write-Host "[ERROR] Web debug launcher failed: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    Write-Host "[INFO] Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}
