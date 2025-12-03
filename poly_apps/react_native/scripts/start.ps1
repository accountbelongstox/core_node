# ============================================
# React Native Multi-App Launcher (PowerShell)
# Minimal wrapper - All logic in Python
# ============================================

param(
    [string]$ScriptDir = $PSScriptRoot
)

$ErrorActionPreference = "Stop"

# ============================================
# PATHS
# ============================================

$ProjectRoot = Split-Path -Parent $ScriptDir
$PythonScriptsPath = Join-Path $ScriptDir "build_scripts\react_native_py_scripts"
$PythonLauncherPath = Join-Path $PythonScriptsPath "main_launcher.py"
$FileVarReaderPath = Join-Path $PythonScriptsPath "win_adapter\FileVarReader.ps1"

$InitialDirectory = Get-Location

# ============================================
# LOAD FILE VAR READER
# ============================================

. $FileVarReaderPath
Initialize-FileVarSystem -Namespace "RN_BUILD"

# ============================================
# CALL PYTHON LAUNCHER
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "React Native Multi-App Manager" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Python auto-detects project root - no parameters needed
& python "$PythonLauncherPath"

Write-Host ""

# ============================================
# READ SELECTION FROM PYTHON
# ============================================

$menuSelection = Get-MenuSelection
if (-not $menuSelection) {
    Write-Host "[INFO] No selection made, exiting" -ForegroundColor Yellow
    Set-Location $InitialDirectory
    exit 0
}

$SelectedApp = $menuSelection["SelectedApp"]
$AppNamespace = $SelectedApp["Name"]
$Mode = $menuSelection["Mode"]
$Platform = $menuSelection["Platform"]

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Executing Selection" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "App: $($SelectedApp['DisplayName']) ($AppNamespace)" -ForegroundColor Green
Write-Host "Mode: $Mode" -ForegroundColor Cyan
Write-Host "Platform: $Platform" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# READ PYTHON VARIABLES
# ============================================

$FactoryEnabled = Get-GlobalFileVar -Key "FACTORY_BUILD_ENABLED"
$BuildDirectory = if ($FactoryEnabled -eq "true") {
    $factoryPath = Get-GlobalFileVar -Key "FACTORY_BUILD_PATH"
    Write-Host "[Factory] Using factory directory: $factoryPath" -ForegroundColor Cyan
    Write-Host ""
    $factoryPath
} else {
    $ProjectRoot
}

$MetroPort = Get-GlobalFileVar -Key "METRO_PORT"
if (-not $MetroPort) { $MetroPort = 8081 }

# ============================================
# POST-PYTHON SETUP (Shell executes commands)
# ============================================

# 1. Install dependencies (pnpm自己判断是否需要安装)
Push-Location $BuildDirectory
try {
    pnpm install
} catch {
    Write-Host "[ERROR] pnpm install failed: $_" -ForegroundColor Red
} finally {
    Pop-Location
}
Write-Host ""

# 2. Scan emulator AVDs (emulator -list-avds)
$EmulatorScanRequired = Get-GlobalFileVar -Key "EMULATOR_SCAN_REQUIRED"
if ($EmulatorScanRequired -eq "true") {
    $EmulatorPath = Get-GlobalFileVar -Key "EMULATOR_PATH"

    Write-Host "[Emulator] Scanning available AVDs..." -ForegroundColor Yellow

    try {
        $avdList = & $EmulatorPath -list-avds 2>$null

        if ($avdList -and $avdList.Count -gt 0) {
            Write-Host "[Emulator] Found AVDs:" -ForegroundColor Green
            $avdList | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }

            # Write first AVD back to file variables
            $firstAvd = $avdList[0]
            Set-FileVar -Key "EMULATOR_AVD" -Value $firstAvd
            Set-FileVar -Key "EMULATOR_AVAILABLE" -Value "true"

            Write-Host "[Emulator] Selected AVD: $firstAvd" -ForegroundColor Green
        } else {
            Write-Host "[Emulator] No AVDs found" -ForegroundColor Yellow
            Set-FileVar -Key "EMULATOR_AVAILABLE" -Value "false"
        }
    } catch {
        Write-Host "[Emulator] Failed to scan AVDs: $_" -ForegroundColor Red
        Set-FileVar -Key "EMULATOR_AVAILABLE" -Value "false"
    }

    Write-Host ""
}

# ============================================
# EXECUTE COMMANDS
# ============================================

function Start-Metro {
    $metroDir = $BuildDirectory
    Write-Host "[Metro] Starting Metro bundler on port $MetroPort..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$metroDir'; npx react-native start --port $MetroPort" -WindowStyle Normal
    Start-Sleep -Seconds 5
    Write-Host "[Metro] Metro bundler started" -ForegroundColor Green
    Write-Host ""
}

function Build-AndroidApp {
    Write-Host "[Android] Building Android app..." -ForegroundColor Yellow
    $androidPath = Join-Path $BuildDirectory "android"
    Push-Location $androidPath
    try {
        .\gradlew.bat assembleRelease
        Write-Host "[Android] Build completed" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

function Start-AndroidEmulator {
    param(
        [string]$EmulatorPath,
        [string]$AvdName
    )

    Write-Host "[Android] Starting emulator $AvdName..." -ForegroundColor Yellow

    # Start emulator in background
    Start-Process -FilePath $EmulatorPath -ArgumentList "-avd", $AvdName -WindowStyle Minimized

    Write-Host "[Android] Waiting for emulator to boot..." -ForegroundColor Yellow

    # Wait for emulator to appear in adb devices (max 120 seconds)
    $timeout = 120
    $elapsed = 0
    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 5
        $elapsed += 5

        $devices = adb devices | Select-String "device$"
        if ($devices) {
            Write-Host "[Android] Emulator ready" -ForegroundColor Green
            return $true
        }

        Write-Host "[Android] Waiting... ($elapsed/$timeout seconds)" -ForegroundColor Gray
    }

    Write-Host "[Android] Emulator startup timeout" -ForegroundColor Red
    return $false
}

function Debug-AndroidApp {
    Write-Host "[Android] Launching Android app..." -ForegroundColor Yellow

    # Check device
    $devices = adb devices | Select-String "device$"
    if (-not $devices) {
        Write-Host "[Android] No device found" -ForegroundColor Yellow
        Write-Host "[Android] Attempting to start emulator..." -ForegroundColor Yellow
        Write-Host ""

        # Read emulator info from Python scan
        $EmulatorAvailable = Get-GlobalFileVar -Key "EMULATOR_AVAILABLE"
        if ($EmulatorAvailable -ne "true") {
            Write-Host "[Android] No emulator available" -ForegroundColor Red
            Write-Host "[Android] Please install Android SDK and create an AVD" -ForegroundColor Red
            return
        }

        $EmulatorPath = Get-GlobalFileVar -Key "EMULATOR_PATH"
        $EmulatorAvd = Get-GlobalFileVar -Key "EMULATOR_AVD"

        Write-Host "[Android] Found emulator: $EmulatorPath" -ForegroundColor Green
        Write-Host "[Android] AVD: $EmulatorAvd" -ForegroundColor Green
        Write-Host ""

        # Start emulator
        $started = Start-AndroidEmulator -EmulatorPath $EmulatorPath -AvdName $EmulatorAvd
        if (-not $started) {
            Write-Host "[Android] Failed to start emulator" -ForegroundColor Red
            return
        }

        Write-Host ""
    } else {
        Write-Host "[Android] Device found" -ForegroundColor Green
        Write-Host ""
    }

    # Start Metro
    Start-Metro

    # Run app
    Push-Location $BuildDirectory
    try {
        npx react-native run-android --port $MetroPort
        Write-Host "[Android] App launched" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

function Build-iOSApp {
    Write-Host "[iOS] Building iOS app..." -ForegroundColor Yellow
    $iosPath = Join-Path $BuildDirectory "ios"
    Push-Location $iosPath
    try {
        pod install
        xcodebuild -workspace *.xcworkspace -scheme * -configuration Release
        Write-Host "[iOS] Build completed" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

function Debug-iOSApp {
    Write-Host "[iOS] Launching iOS app..." -ForegroundColor Yellow

    # Start Metro
    Start-Metro

    # Run app
    Push-Location $BuildDirectory
    try {
        npx react-native run-ios --port $MetroPort
        Write-Host "[iOS] App launched" -ForegroundColor Green
    } finally {
        Pop-Location
    }
}

# ============================================
# DISPATCH
# ============================================

switch ("${Mode}_${Platform}") {
    "build_android" { Build-AndroidApp }
    "debug_android" { Debug-AndroidApp }
    "build_ios" { Build-iOSApp }
    "debug_ios" { Debug-iOSApp }
    default {
        Write-Host "[ERROR] Unknown mode: $Mode $Platform" -ForegroundColor Red
    }
}

# ============================================
# CLEANUP
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Completed" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan

Set-Location $InitialDirectory
