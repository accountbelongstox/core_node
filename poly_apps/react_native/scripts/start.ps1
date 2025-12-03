# ============================================
# React Native Project Unified Start Script
# ============================================
# This script provides automatic installation, compilation, and debugging
# Interactive menu-driven interface
# No parameters required - everything is hardcoded

# Declare all variables at the beginning
$ErrorActionPreference = "Continue"
$ScriptDir = $null
$ProjectRoot = $null
$NodeModulesPath = $null
$PackageJsonPath = $null
$AndroidPath = $null
$IosPath = $null
$MetroServerJob = $null
$MetroPort = 8081
$SelectedCommand = $null
$SelectedPlatform = $null
$SelectedConfiguration = $null
$SelectedDevice = $null

# Initialize paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$NodeModulesPath = Join-Path -Path $ProjectRoot -ChildPath "node_modules"
$PackageJsonPath = Join-Path -Path $ProjectRoot -ChildPath "package.json"
$AndroidPath = Join-Path -Path $ProjectRoot -ChildPath "android"
$IosPath = Join-Path -Path $ProjectRoot -ChildPath "ios"

# ============================================
# MENU FUNCTIONS
# ============================================

function Show-MainMenu {
    Clear-Host
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "React Native Project Manager" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Project: react_init" -ForegroundColor White
    Write-Host "Location: $ProjectRoot" -ForegroundColor Gray

    # Show installation status
    if (Test-Path $NodeModulesPath) {
        Write-Host "Dependencies: " -NoNewline -ForegroundColor Gray
        Write-Host "INSTALLED" -ForegroundColor Green
    } else {
        Write-Host "Dependencies: " -NoNewline -ForegroundColor Gray
        Write-Host "NOT INSTALLED" -ForegroundColor Red
    }

    Write-Host ""
    Write-Host "Main Menu:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [1] Reinstall Dependencies" -ForegroundColor White
    Write-Host "  [2] Build Application" -ForegroundColor White
    Write-Host "  [3] Debug Application" -ForegroundColor White
    Write-Host "  [4] Quick Start (Debug Android)" -ForegroundColor White
    Write-Host "  [5] Check Environment" -ForegroundColor White
    Write-Host "  [0] Exit" -ForegroundColor White
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Show-BuildMenu {
    Clear-Host
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Build Configuration" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Select Platform:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [1] Android" -ForegroundColor White
    Write-Host "  [2] iOS" -ForegroundColor White
    Write-Host "  [3] All Platforms" -ForegroundColor White
    Write-Host "  [0] Back to Main Menu" -ForegroundColor White
    Write-Host ""
    $PlatformChoice = Read-Host "Enter choice"

    if ($PlatformChoice -eq "0") { return $null }

    $Platform = switch ($PlatformChoice) {
        "1" { "android" }
        "2" { "ios" }
        "3" { "all" }
        default { "android" }
    }

    Write-Host ""
    Write-Host "Select Configuration:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [1] Debug" -ForegroundColor White
    Write-Host "  [2] Release" -ForegroundColor White
    Write-Host ""
    $ConfigChoice = Read-Host "Enter choice"

    $Configuration = switch ($ConfigChoice) {
        "1" { "debug" }
        "2" { "release" }
        default { "release" }
    }

    return @{
        Platform = $Platform
        Configuration = $Configuration
    }
}

function Show-DebugMenu {
    Clear-Host
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Debug Configuration" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Select Platform:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  [1] Android" -ForegroundColor White
    Write-Host "  [2] iOS" -ForegroundColor White
    Write-Host "  [0] Back to Main Menu" -ForegroundColor White
    Write-Host ""
    $PlatformChoice = Read-Host "Enter choice"

    if ($PlatformChoice -eq "0") { return $null }

    $Platform = switch ($PlatformChoice) {
        "1" { "android" }
        "2" { "ios" }
        default { "android" }
    }

    Write-Host ""
    $DeviceInput = Read-Host "Enter device ID (press Enter to use default)"

    return @{
        Platform = $Platform
        Device = $DeviceInput
    }
}

function Check-Environment {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Environment Check" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Host "[1/5] Node.js:" -ForegroundColor Yellow
    node --version
    Write-Host ""

    Write-Host "[2/5] pnpm:" -ForegroundColor Yellow
    pnpm --version
    Write-Host ""

    Write-Host "[3/5] Dependencies:" -ForegroundColor Yellow
    if (Test-Path $NodeModulesPath) {
        Write-Host "  node_modules: EXISTS" -ForegroundColor Green
    } else {
        Write-Host "  node_modules: NOT FOUND" -ForegroundColor Red
    }
    Write-Host ""

    Write-Host "[4/5] Android SDK (ADB):" -ForegroundColor Yellow
    adb version
    Write-Host ""
    Write-Host "  Connected devices:" -ForegroundColor Gray
    adb devices
    Write-Host ""

    Write-Host "[5/5] React Native CLI:" -ForegroundColor Yellow
    npx react-native --version
    Write-Host ""

    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Environment check completed" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# ============================================
# INSTALLATION FUNCTIONS
# ============================================

function Invoke-Installation {
    Write-Host "[INSTALL] Starting installation process..." -ForegroundColor Cyan
    Write-Host ""

    # Check if Node.js is installed
    Write-Host "[1/5] Checking Node.js..." -ForegroundColor Yellow
    node --version
    Write-Host ""

    # Check if pnpm is installed
    Write-Host "[2/5] Checking pnpm..." -ForegroundColor Yellow
    pnpm --version
    Write-Host ""

    # Check if package.json exists
    Write-Host "[3/5] Checking package.json..." -ForegroundColor Yellow
    if (Test-Path $PackageJsonPath) {
        Write-Host "package.json found" -ForegroundColor Green
    } else {
        Write-Host "ERROR: package.json not found" -ForegroundColor Red
    }
    Write-Host ""

    # Install dependencies
    Write-Host "[4/5] Installing dependencies with pnpm..." -ForegroundColor Yellow
    Write-Host "This may take several minutes..." -ForegroundColor Gray
    Write-Host ""
    Set-Location $ProjectRoot
    pnpm install
    Write-Host ""

    # Verify React Native CLI
    Write-Host "[5/5] Verifying React Native CLI..." -ForegroundColor Yellow
    npx react-native --version
    Write-Host ""

    Write-Host "Installation process completed" -ForegroundColor Green
    Write-Host ""
}

# ============================================
# BUILD FUNCTIONS
# ============================================

function Build-Android {
    param([string]$Config)

    Write-Host "[Android] Starting build process..." -ForegroundColor Yellow
    Write-Host ""

    if (-Not (Test-Path $AndroidPath)) {
        Write-Host "ERROR: Android directory not found" -ForegroundColor Red
        Write-Host ""
        return
    }

    Set-Location $AndroidPath

    if ($Config -eq "release") {
        Write-Host "[Android] Building release APK..." -ForegroundColor Yellow
        $GradleCommand = "assembleRelease"
    } else {
        Write-Host "[Android] Building debug APK..." -ForegroundColor Yellow
        $GradleCommand = "assembleDebug"
    }
    Write-Host ""

    if ($IsWindows -or $env:OS -match "Windows") {
        .\gradlew.bat $GradleCommand
    } else {
        ./gradlew $GradleCommand
    }

    Write-Host ""
    $ApkPath = Join-Path -Path $AndroidPath -ChildPath "app\build\outputs\apk\$Config"
    if (Test-Path $ApkPath) {
        Write-Host "[Android] APK location: $ApkPath" -ForegroundColor Green
    }
    Write-Host "[Android] Build process completed" -ForegroundColor Green
    Write-Host ""

    Set-Location $ProjectRoot
}

function Build-iOS {
    param([string]$Config)

    Write-Host "[iOS] Starting build process..." -ForegroundColor Yellow
    Write-Host ""

    if (-Not (Test-Path $IosPath)) {
        Write-Host "ERROR: iOS directory not found" -ForegroundColor Red
        Write-Host ""
        return
    }

    if (-Not ($IsMacOS -or $env:OS -match "Darwin")) {
        Write-Host "WARNING: iOS builds can only be performed on macOS" -ForegroundColor Yellow
        Write-Host ""
        return
    }

    Set-Location $IosPath

    Write-Host "[iOS] Installing CocoaPods dependencies..." -ForegroundColor Yellow
    pod install
    Write-Host ""

    $ConfigCapitalized = (Get-Culture).TextInfo.ToTitleCase($Config)
    Write-Host "[iOS] Building $ConfigCapitalized configuration..." -ForegroundColor Yellow
    Write-Host ""

    xcodebuild -workspace "react_init.xcworkspace" `
               -scheme "react_init" `
               -configuration $ConfigCapitalized `
               -sdk iphoneos `
               -derivedDataPath "./build"

    Write-Host ""
    Write-Host "[iOS] Build process completed" -ForegroundColor Green
    Write-Host ""

    Set-Location $ProjectRoot
}


# ============================================
# DEBUG FUNCTIONS
# ============================================

function Check-AndroidDevice {
    Write-Host "[Android] Checking for connected devices..." -ForegroundColor Yellow

    try {
        $DeviceOutput = adb devices 2>&1
        Write-Host "[Android] ADB devices output:" -ForegroundColor Gray
        $DeviceOutput | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        Write-Host ""

        $DeviceList = $DeviceOutput | Select-Object -Skip 1 | Where-Object { $_ -match '\t' }

        if ($DeviceList) {
            Write-Host "[Android] Found connected device(s):" -ForegroundColor Green
            $DeviceList | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
            Write-Host ""
            return $true
        }

        Write-Host "[Android] No connected devices found" -ForegroundColor Yellow
        Write-Host ""
        return $false
    }
    catch {
        Write-Host "[Android] ERROR checking devices: $_" -ForegroundColor Red
        Write-Host ""
        return $false
    }
}

function Get-AvailableEmulators {
    Write-Host "[Android] Checking for available emulators..." -ForegroundColor Yellow

    try {
        $Emulators = emulator -list-avds 2>&1
        Write-Host "[Android] Emulator command output:" -ForegroundColor Gray
        if ($Emulators) {
            $Emulators | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
        } else {
            Write-Host "  (empty)" -ForegroundColor Gray
        }
        Write-Host ""

        if ($Emulators -and ($Emulators.GetType().Name -ne "ErrorRecord")) {
            Write-Host "[Android] Found emulator(s):" -ForegroundColor Green
            $Emulators | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
            Write-Host ""
            return $Emulators
        }

        Write-Host "[Android] No emulators found" -ForegroundColor Red
        Write-Host "[Android] Please create an emulator using Android Studio (AVD Manager)" -ForegroundColor Yellow
        Write-Host ""
        return $null
    }
    catch {
        Write-Host "[Android] ERROR checking emulators: $_" -ForegroundColor Red
        Write-Host ""
        return $null
    }
}

function Check-EmulatorRunning {
    Write-Host "[Android] Checking if emulator is already running..." -ForegroundColor Yellow

    try {
        $DeviceOutput = adb devices 2>&1
        $RunningDevices = $DeviceOutput | Select-Object -Skip 1 | Where-Object { $_ -match 'emulator' }

        if ($RunningDevices) {
            Write-Host "[Android] Emulator is already running!" -ForegroundColor Green
            $RunningDevices | ForEach-Object { Write-Host "  $_" -ForegroundColor White }
            Write-Host ""
            return $true
        }

        Write-Host "[Android] No emulator is currently running" -ForegroundColor Gray
        Write-Host ""
        return $false
    }
    catch {
        Write-Host "[Android] ERROR checking running emulators: $_" -ForegroundColor Red
        Write-Host ""
        return $false
    }
}

function Start-AndroidEmulator {
    param([string]$EmulatorName)

    Write-Host "[Android] Starting emulator: $EmulatorName" -ForegroundColor Yellow
    Write-Host "[Android] This may take 30-60 seconds..." -ForegroundColor Gray
    Write-Host "[Android] Please wait for the emulator to fully boot..." -ForegroundColor Gray
    Write-Host ""

    try {
        # Start emulator in a new window
        Write-Host "[Android] Launching emulator process..." -ForegroundColor Gray
        $EmulatorProcess = Start-Process -FilePath "emulator" -ArgumentList "-avd", $EmulatorName -WindowStyle Normal -PassThru
        Write-Host "[Android] Emulator process started (PID: $($EmulatorProcess.Id))" -ForegroundColor Gray
        Write-Host ""
    }
    catch {
        Write-Host "[Android] ERROR starting emulator: $_" -ForegroundColor Red
        Write-Host ""
        return $false
    }

    # Wait for device to be online
    Write-Host "[Android] Waiting for emulator to start..." -ForegroundColor Yellow
    $MaxWaitTime = 120  # Maximum 120 seconds
    $WaitedTime = 0
    $DeviceOnline = $false

    while ($WaitedTime -lt $MaxWaitTime) {
        Start-Sleep -Seconds 5
        $WaitedTime += 5

        try {
            $DeviceList = adb devices 2>&1 | Select-Object -Skip 1 | Where-Object { $_ -match '\t' }
            if ($DeviceList) {
                Write-Host "[Android] Emulator detected, checking boot status... (${WaitedTime}s)" -ForegroundColor Gray

                # Check if device is fully booted
                $BootComplete = adb shell getprop sys.boot_completed 2>&1
                Write-Host "[Android] Boot status: $BootComplete" -ForegroundColor Gray

                if ($BootComplete -match "1") {
                    $DeviceOnline = $true
                    Write-Host "[Android] Emulator is fully booted and ready!" -ForegroundColor Green
                    Write-Host ""
                    break
                }
            } else {
                Write-Host "[Android] Waiting for emulator to appear... (${WaitedTime}s)" -ForegroundColor Gray
            }
        }
        catch {
            Write-Host "[Android] Error checking emulator status: $_" -ForegroundColor Yellow
        }
    }

    if (-not $DeviceOnline) {
        Write-Host "[Android] WARNING: Emulator may not be fully ready after ${MaxWaitTime}s" -ForegroundColor Yellow
        Write-Host "[Android] Continuing anyway..." -ForegroundColor Yellow
        Write-Host ""
    }

    return $DeviceOnline
}

function Ensure-AndroidDevice {
    Write-Host "[Android] Ensuring Android device is available..." -ForegroundColor Cyan
    Write-Host ""

    # First check if an emulator is already running
    if (Check-EmulatorRunning) {
        Write-Host "[Android] Using existing running emulator" -ForegroundColor Green
        Write-Host ""
        return $true
    }

    # Check if any device is already connected (physical device)
    if (Check-AndroidDevice) {
        return $true
    }

    # No device connected, try to start an emulator
    Write-Host "[Android] No device connected, checking for emulators..." -ForegroundColor Yellow
    $Emulators = Get-AvailableEmulators

    if (-not $Emulators) {
        Write-Host "[Android] ERROR: No emulators available" -ForegroundColor Red
        Write-Host "[Android] Please either:" -ForegroundColor Yellow
        Write-Host "  1. Connect a physical Android device via USB" -ForegroundColor White
        Write-Host "  2. Create an emulator in Android Studio (AVD Manager)" -ForegroundColor White
        Write-Host ""
        return $false
    }

    # Use the first available emulator
    $FirstEmulator = ($Emulators | Select-Object -First 1).Trim()
    Write-Host "[Android] Will start emulator: $FirstEmulator" -ForegroundColor Cyan
    Write-Host ""

    $EmulatorStarted = Start-AndroidEmulator -EmulatorName $FirstEmulator

    if (-not $EmulatorStarted) {
        Write-Host "[Android] WARNING: Emulator may not have started correctly" -ForegroundColor Yellow
        Write-Host ""
    }

    # Final check
    return (Check-AndroidDevice)
}

function Start-MetroServer {
    Write-Host "[Metro] Starting Metro bundler..." -ForegroundColor Yellow
    Write-Host "[Metro] Port: $MetroPort" -ForegroundColor Gray
    Write-Host "[Metro] Metro will run in a separate window" -ForegroundColor Gray
    Write-Host ""

    Set-Location $ProjectRoot

    # Start Metro in a new window using Start-Process
    $MetroProcess = Start-Process -FilePath "powershell" `
                                   -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; Write-Host 'Metro Bundler for react_init' -ForegroundColor Cyan; Write-Host '========================================' -ForegroundColor Cyan; Write-Host ''; npx react-native start --port $MetroPort" `
                                   -PassThru `
                                   -WindowStyle Normal

    Write-Host "[Metro] Metro bundler window opened (PID: $($MetroProcess.Id))" -ForegroundColor Green
    Write-Host "[Metro] Waiting for Metro to initialize..." -ForegroundColor Yellow
    Start-Sleep -Seconds 8
    Write-Host "[Metro] Metro bundler should be ready" -ForegroundColor Green
    Write-Host ""
}


function Debug-Android {
    param([string]$DeviceName)

    Write-Host "[Android] Checking Android environment..." -ForegroundColor Yellow
    Write-Host ""

    # Check if ADB is available
    Write-Host "[Android] Checking ADB..." -ForegroundColor Yellow
    adb version
    Write-Host ""

    # Ensure Android device is available (will auto-start emulator if needed)
    Write-Host "[Android] Preparing Android device..." -ForegroundColor Cyan
    Write-Host ""
    $DeviceReady = Ensure-AndroidDevice

    if (-not $DeviceReady) {
        Write-Host "[Android] ERROR: No Android device available" -ForegroundColor Red
        Write-Host "[Android] Cannot proceed with debugging" -ForegroundColor Red
        Write-Host ""
        return
    }

    Write-Host "[Android] Device is ready!" -ForegroundColor Green
    Write-Host ""

    # Start Metro in separate window
    Write-Host "[Android] Starting Metro bundler..." -ForegroundColor Yellow
    Start-MetroServer

    # Run the app
    Write-Host "[Android] Launching application..." -ForegroundColor Yellow
    Write-Host "[Android] This may take a few minutes on first run..." -ForegroundColor Gray
    Write-Host ""
    Set-Location $ProjectRoot

    if ($DeviceName) {
        Write-Host "[Android] Running on device: $DeviceName" -ForegroundColor Cyan
        npx react-native run-android --device=$DeviceName
    } else {
        Write-Host "[Android] Running on default device" -ForegroundColor Cyan
        npx react-native run-android
    }

    Write-Host ""
    Write-Host "[Android] Build and launch process completed" -ForegroundColor Green
    Write-Host "[Android] Check the Metro bundler window for live updates" -ForegroundColor Cyan
    Write-Host ""
}

function Debug-iOS {
    param([string]$DeviceName)

    Write-Host "[iOS] Checking iOS environment..." -ForegroundColor Yellow
    Write-Host ""

    if (-Not ($IsMacOS -or $env:OS -match "Darwin")) {
        Write-Host "ERROR: iOS debugging can only be performed on macOS" -ForegroundColor Red
        Write-Host ""
        return
    }

    # Check if Xcode is available
    Write-Host "[iOS] Checking Xcode..." -ForegroundColor Yellow
    xcode-select -p
    Write-Host ""

    # Start Metro in separate window
    Write-Host "[iOS] Starting Metro bundler..." -ForegroundColor Yellow
    Start-MetroServer

    # Run the app
    Write-Host "[iOS] Launching application..." -ForegroundColor Yellow
    Write-Host "[iOS] This may take a few minutes on first run..." -ForegroundColor Gray
    Write-Host ""
    Set-Location $ProjectRoot

    if ($DeviceName) {
        npx react-native run-ios --device="$DeviceName"
    } else {
        npx react-native run-ios
    }

    Write-Host ""
    Write-Host "[iOS] Build and launch process completed" -ForegroundColor Green
    Write-Host "[iOS] Check the Metro bundler window for live updates" -ForegroundColor Cyan
    Write-Host ""
}


# ============================================
# AUTO-INSTALL CHECK
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "React Native Project Manager" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Initializing..." -ForegroundColor Yellow
Write-Host ""

# Check if dependencies are installed
if (-Not (Test-Path $NodeModulesPath)) {
    Write-Host "Dependencies not found. Starting automatic installation..." -ForegroundColor Yellow
    Write-Host ""

    Invoke-Installation

    Write-Host "Automatic installation completed" -ForegroundColor Green
    Write-Host ""
    Start-Sleep -Seconds 2
} else {
    Write-Host "Dependencies already installed." -ForegroundColor Green
    Write-Host ""
    Start-Sleep -Seconds 1
}

# ============================================
# MAIN EXECUTION LOGIC
# ============================================

$Running = $true

while ($Running) {
    Show-MainMenu
    $Choice = Read-Host "Enter your choice"

    switch ($Choice) {
        "1" {
            # Reinstall
            Clear-Host
            Write-Host "============================================" -ForegroundColor Cyan
            Write-Host "Reinstalling Dependencies" -ForegroundColor Cyan
            Write-Host "============================================" -ForegroundColor Cyan
            Write-Host ""

            Invoke-Installation

            Write-Host "Reinstallation process completed" -ForegroundColor Cyan
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "2" {
            # Build
            $BuildConfig = Show-BuildMenu
            if ($BuildConfig) {
                Clear-Host
                Write-Host "============================================" -ForegroundColor Cyan
                Write-Host "Building Application" -ForegroundColor Cyan
                Write-Host "============================================" -ForegroundColor Cyan
                Write-Host "Platform: $($BuildConfig.Platform)" -ForegroundColor White
                Write-Host "Configuration: $($BuildConfig.Configuration)" -ForegroundColor White
                Write-Host ""

                if ($BuildConfig.Platform -eq "android" -or $BuildConfig.Platform -eq "all") {
                    Build-Android -Config $BuildConfig.Configuration
                }

                if ($BuildConfig.Platform -eq "ios" -or $BuildConfig.Platform -eq "all") {
                    Build-iOS -Config $BuildConfig.Configuration
                }

                Write-Host "Build operations completed" -ForegroundColor Cyan
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
        }
        "3" {
            # Debug
            $DebugConfig = Show-DebugMenu
            if ($DebugConfig) {
                Clear-Host
                Write-Host "============================================" -ForegroundColor Cyan
                Write-Host "Debug Application" -ForegroundColor Cyan
                Write-Host "============================================" -ForegroundColor Cyan
                Write-Host "Platform: $($DebugConfig.Platform)" -ForegroundColor White
                if ($DebugConfig.Device) {
                    Write-Host "Device: $($DebugConfig.Device)" -ForegroundColor White
                }
                Write-Host ""

                if ($DebugConfig.Platform -eq "android") {
                    Debug-Android -DeviceName $DebugConfig.Device
                } elseif ($DebugConfig.Platform -eq "ios") {
                    Debug-iOS -DeviceName $DebugConfig.Device
                }

                Write-Host "Debug session completed" -ForegroundColor Cyan
                Write-Host "Metro bundler is running in a separate window" -ForegroundColor Yellow
                Write-Host "Close the Metro window manually when done" -ForegroundColor Gray
                Write-Host ""
                Read-Host "Press Enter to continue"
            }
        }
        "4" {
            # Quick Start
            Clear-Host
            Write-Host "============================================" -ForegroundColor Cyan
            Write-Host "Quick Start (Debug Android)" -ForegroundColor Cyan
            Write-Host "============================================" -ForegroundColor Cyan
            Write-Host ""

            Debug-Android -DeviceName ""

            Write-Host "Quick start completed" -ForegroundColor Cyan
            Write-Host "Metro bundler is running in a separate window" -ForegroundColor Yellow
            Write-Host "Close the Metro window manually when done" -ForegroundColor Gray
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "5" {
            # Check Environment
            Clear-Host
            Check-Environment
        }
        "0" {
            # Exit
            Write-Host ""
            Write-Host "Exiting React Native Project Manager..." -ForegroundColor Yellow
            Write-Host "Note: Metro bundler windows will remain open" -ForegroundColor Gray
            Write-Host "Close them manually if needed" -ForegroundColor Gray
            $Running = $false
        }
        default {
            Write-Host ""
            Write-Host "Invalid choice. Please try again." -ForegroundColor Red
            Start-Sleep -Seconds 1
        }
    }
}

Write-Host ""
Write-Host "Thank you for using React Native Project Manager!" -ForegroundColor Cyan
Write-Host ""
