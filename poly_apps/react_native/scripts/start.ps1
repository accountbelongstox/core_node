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

$script:ResolvedAdbPath = $null
function Get-AdbExecutable {
    if ($script:ResolvedAdbPath) {
        return $script:ResolvedAdbPath
    }

    $candidates = @()

    $storedEmulatorPath = Get-GlobalFileVar -Key "EMULATOR_PATH"
    if ($storedEmulatorPath) {
        $emulatorDir = Split-Path $storedEmulatorPath -Parent
        if ($emulatorDir) {
            $sdkDir = Split-Path $emulatorDir -Parent
            if ($sdkDir) {
                $candidates += (Join-Path $sdkDir "platform-tools\adb.exe")
            }
        }
    }

    foreach ($envVar in @("ANDROID_SDK_ROOT", "ANDROID_HOME")) {
        $envValue = [System.Environment]::GetEnvironmentVariable($envVar)
        if ($envValue) {
            $candidates += (Join-Path $envValue "platform-tools\adb.exe")
        }
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            $script:ResolvedAdbPath = $candidate
            return $script:ResolvedAdbPath
        }
    }

    $script:ResolvedAdbPath = "adb"
    return $script:ResolvedAdbPath
}

function Ensure-NodeModulesJunction {
    $junctionRequired = Get-GlobalFileVar -Key "JUNCTION_REQUIRED"
    if ($junctionRequired -ne "true") {
        return
    }

    $junctionSource = Get-GlobalFileVar -Key "JUNCTION_SOURCE"
    $junctionTarget = Get-GlobalFileVar -Key "JUNCTION_TARGET"

    if (-not $junctionSource -or -not $junctionTarget) {
        Write-Host "[Junction] Missing junction source/target info" -ForegroundColor Yellow
        return
    }

    if (-not (Test-Path $junctionSource)) {
        Write-Host "[Junction] Source not found: $junctionSource" -ForegroundColor Yellow
        return
    }

    $isExistingJunction = $false
    if (Test-Path $junctionTarget) {
        try {
            $targetItem = Get-Item $junctionTarget -ErrorAction Stop
            if ($targetItem.Attributes -band [IO.FileAttributes]::ReparsePoint) {
                $isExistingJunction = $true
            }
        } catch {
            Write-Host "[Junction] Failed to inspect target: $_" -ForegroundColor Yellow
        }
    }

    if ($isExistingJunction) {
        Write-Host "[Junction] Existing junction detected at $junctionTarget" -ForegroundColor Green
        return
    }

    if (Test-Path $junctionTarget) {
        Write-Host "[Junction] Target exists but is not a junction, skipping creation: $junctionTarget" -ForegroundColor Yellow
        return
    }

    try {
        $parentDir = Split-Path $junctionTarget -Parent
        if ($parentDir -and -not (Test-Path $parentDir)) {
            New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
        }

        New-Item -ItemType Junction -Path $junctionTarget -Value $junctionSource | Out-Null
        Write-Host "[Junction] Created junction: $junctionTarget -> $junctionSource" -ForegroundColor Green
        Set-FileVar -Key "JUNCTION_REQUIRED" -Value "false" | Out-Null
    } catch {
        Write-Host "[Junction] Failed to create junction: $_" -ForegroundColor Red
    }
}

function Ensure-AdbServer {
    param(
        [string]$AdbPath
    )

    if (-not $AdbPath) {
        $AdbPath = Get-AdbExecutable
    }

    try {
        $output = & $AdbPath start-server 2>&1
        if ($output) {
            Write-Host "[Android] adb start-server: $output" -ForegroundColor DarkGray
        } else {
            Write-Host "[Android] adb server ready" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "[Android] Failed to start adb server: $_" -ForegroundColor Yellow
    }
}

function Wait-ForAndroidDeviceReady {
    param(
        [string]$AdbPath,
        [int]$TimeoutSeconds = 180
    )

    $startTime = Get-Date
    while ((((Get-Date) - $startTime).TotalSeconds) -lt $TimeoutSeconds) {
        $elapsed = [int]((Get-Date) - $startTime).TotalSeconds

        try {
            $deviceList = & $AdbPath devices 2>$null
        } catch {
            Write-Host "[Android] adb devices failed, retrying..." -ForegroundColor Yellow
            Start-Sleep -Seconds 5
            continue
        }

        $onlineDevice = $null
        foreach ($line in @($deviceList)) {
            if (-not $line) { continue }
            if ($line -match "List of devices attached") { continue }
            if ($line -match "^(?<id>\S+)\s+device$") {
                $onlineDevice = $Matches['id']
                break
            }
        }

        if ($onlineDevice) {
            try {
                $boot = (& $AdbPath -s $onlineDevice shell getprop sys.boot_completed 2>$null).Trim()
            } catch {
                $boot = ""
            }

            if ($boot -eq "1") {
                Write-Host "[Android] Device ready: $onlineDevice" -ForegroundColor Green
                return $true
            } else {
                Write-Host "[Android] Device detected ($onlineDevice), waiting for boot... ($elapsed/$TimeoutSeconds)" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[Android] Waiting for emulator to appear... ($elapsed/$TimeoutSeconds)" -ForegroundColor Gray
        }

        Start-Sleep -Seconds 5
    }

    Write-Host "[Android] Device readiness timeout after $TimeoutSeconds seconds" -ForegroundColor Red
    return $false
}

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

Ensure-NodeModulesJunction

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
            $firstAvd = @($avdList)[0]  # Ensure full name even if PowerShell returns a single string
            Set-FileVar -Key "EMULATOR_AVD" -Value $firstAvd | Out-Null
            Set-FileVar -Key "EMULATOR_AVAILABLE" -Value "true" | Out-Null

            Write-Host "[Emulator] Selected AVD: $firstAvd" -ForegroundColor Green
        } else {
            Write-Host "[Emulator] No AVDs found" -ForegroundColor Yellow
            Set-FileVar -Key "EMULATOR_AVAILABLE" -Value "false" | Out-Null
        }
    } catch {
        Write-Host "[Emulator] Failed to scan AVDs: $_" -ForegroundColor Red
        Set-FileVar -Key "EMULATOR_AVAILABLE" -Value "false" | Out-Null
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
    Write-Host "[Android] Emulator launch command sent; continuing without readiness check" -ForegroundColor Yellow
}

function Debug-AndroidApp {
    Write-Host "[Android] Launching Android app..." -ForegroundColor Yellow

    $AdbPath = Get-AdbExecutable
    if ($AdbPath -ne "adb") {
        Write-Host "[Android] Using adb: $AdbPath" -ForegroundColor Gray
    }

    Ensure-AdbServer -AdbPath $AdbPath

    # Check device
    $devices = & $AdbPath devices 2>$null | Select-String "device$"
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
        try {
            Start-AndroidEmulator -EmulatorPath $EmulatorPath -AvdName $EmulatorAvd
        } catch {
            Write-Host "[Android] Failed to start emulator: $_" -ForegroundColor Red
            return
        }

        Write-Host "[Android] Waiting for emulator boot completion..." -ForegroundColor Yellow
        $deviceReady = Wait-ForAndroidDeviceReady -AdbPath $AdbPath -TimeoutSeconds 240
        if (-not $deviceReady) {
            Write-Host "[Android] Emulator not ready after waiting, continuing anyway" -ForegroundColor Yellow
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
