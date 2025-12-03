# ============================================
# React Native Multi-App Unified Start Script
# ============================================
# This script provides automatic installation, compilation, and debugging
# Supports both single-app and multi-app configurations
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
$MultiAppMode = $false
$SelectedAppNamespace = $null
$SelectedAppConfig = $null
$RNScriptsPath = $null

# Initialize paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$NodeModulesPath = Join-Path -Path $ProjectRoot -ChildPath "node_modules"
$PackageJsonPath = Join-Path -Path $ProjectRoot -ChildPath "package.json"
$AndroidPath = Join-Path -Path $ProjectRoot -ChildPath "android"
$IosPath = Join-Path -Path $ProjectRoot -ChildPath "ios"
$RNPyScriptsPath = Join-Path -Path $ScriptDir -ChildPath "build_scripts\react_native_py_scripts"
$RNScriptsPath = Join-Path -Path $RNPyScriptsPath -ChildPath "win_adapter"

# ============================================
# MULTI-APP HELPER SCRIPTS LOADING
# ============================================

$FileVarReaderPath = Join-Path -Path $RNScriptsPath -ChildPath "FileVarReader.ps1"
$PrerequisitesPath = Join-Path -Path $RNScriptsPath -ChildPath "Prerequisites.ps1"
$ResourceManagerPath = Join-Path -Path $RNScriptsPath -ChildPath "ResourceManager.ps1"
$PlatformBuilderPath = Join-Path -Path $RNScriptsPath -ChildPath "PlatformBuilder.ps1"
$ErrorHandlerPath = Join-Path -Path $RNScriptsPath -ChildPath "ErrorHandler.ps1"

$PythonLauncherPath = Join-Path -Path $RNPyScriptsPath -ChildPath "main_launcher.py"

$MultiAppScriptsAvailable = $false

if ((Test-Path $FileVarReaderPath) -and (Test-Path $ResourceManagerPath) -and (Test-Path $PythonLauncherPath)) {
    . $FileVarReaderPath
    . $PrerequisitesPath
    . $ResourceManagerPath
    . $PlatformBuilderPath
    . $ErrorHandlerPath

    Initialize-FileVarSystem -Namespace "RN_BUILD"

    $MultiAppScriptsAvailable = $true
    Write-Host "[INIT] Multi-app scripts loaded successfully" -ForegroundColor Green
    Write-Host "[INFO] Using Python-based menu and configuration system" -ForegroundColor Cyan
}

# ============================================
# MULTI-APP DETECTION
# ============================================

function Test-MultiAppConfiguration {
    $AppsPath = Join-Path -Path $ProjectRoot -ChildPath "src\apps"

    if (-not (Test-Path $AppsPath)) {
        return $false
    }

    $AppDirs = Get-ChildItem -Path $AppsPath -Directory -ErrorAction SilentlyContinue

    if ($AppDirs -and $AppDirs.Count -gt 0) {
        return $true
    }

    return $false
}

# Check if multi-app mode is available
if ($MultiAppScriptsAvailable -and (Test-MultiAppConfiguration)) {
    $MultiAppMode = $true
    Write-Host "[INIT] Multi-app mode detected" -ForegroundColor Cyan

    # Call Python launcher to scan apps and show menu
    # IMPORTANT: Direct execution for real-time interactive display
    Write-Host "[INFO] Launching Python menu system..." -ForegroundColor Cyan
    Write-Host ""

    # Execute Python directly - no output capture to allow real-time interaction
    & python "$PythonLauncherPath" "$ProjectRoot"
    $pythonExitCode = $LASTEXITCODE

    Write-Host ""

    # Check for errors via file variable system (not exit code)
    $errorMsg = Get-ErrorMessage
    if ($errorMsg) {
        Write-Host "[ERROR] Python launcher failed: $errorMsg" -ForegroundColor Red
        Clear-ErrorMessage
        $MultiAppMode = $false
    } else {
        Write-Host "[OK] Python launcher completed successfully" -ForegroundColor Green
    }
} else {
    $MultiAppMode = $false
    Write-Host "[INIT] Single-app mode (legacy)" -ForegroundColor Yellow
}

# ============================================
# CACHE CLEANING FUNCTIONS
# ============================================

function Clear-AllCaches {
    param(
        [bool]$Interactive = $true
    )

    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Cache Cleaning" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""

    if ($Interactive) {
        Write-Host "This will clean:" -ForegroundColor Yellow
        Write-Host "  - node_modules" -ForegroundColor White
        Write-Host "  - Metro bundler cache" -ForegroundColor White
        Write-Host "  - Watchman cache" -ForegroundColor White
        Write-Host "  - React Native temp files" -ForegroundColor White
        Write-Host "  - Android build cache" -ForegroundColor White
        Write-Host "  - Android Gradle cache" -ForegroundColor White
        Write-Host ""
        $Confirmation = Read-Host "Are you sure you want to clean all caches? (y/N)"

        if ($Confirmation -ne "y" -and $Confirmation -ne "Y") {
            Write-Host "Cache cleaning cancelled" -ForegroundColor Yellow
            Write-Host ""
            return
        }
    }

    Write-Host ""
    Write-Host "Starting cache cleaning process..." -ForegroundColor Yellow
    Write-Host ""

    # 1. Clean node_modules
    Write-Host "[1/6] Cleaning node_modules..." -ForegroundColor Yellow
    if (Test-Path $NodeModulesPath) {
        Remove-Item -Path $NodeModulesPath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] node_modules removed" -ForegroundColor Green
    } else {
        Write-Host "  [OK] node_modules already clean" -ForegroundColor Gray
    }
    Write-Host ""

    # 2. Clean Metro cache
    Write-Host "[2/6] Cleaning Metro bundler cache..." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    try {
        npx react-native start --reset-cache --dry-run 2>&1 | Out-Null
        Write-Host "  [OK] Metro cache cleared" -ForegroundColor Green
    } catch {
        Write-Host "  [SKIP] Metro cache clear skipped (not critical)" -ForegroundColor Gray
    }
    Write-Host ""

    # 3. Clean Watchman (if available)
    Write-Host "[3/6] Cleaning Watchman cache..." -ForegroundColor Yellow
    try {
        watchman watch-del-all 2>&1 | Out-Null
        Write-Host "  [OK] Watchman cache cleared" -ForegroundColor Green
    } catch {
        Write-Host "  [SKIP] Watchman not available (optional)" -ForegroundColor Gray
    }
    Write-Host ""

    # 4. Clean React Native temp files
    Write-Host "[4/6] Cleaning React Native temp files..." -ForegroundColor Yellow
    $TempPath = Join-Path -Path $env:TEMP -ChildPath "react-*"
    Get-ChildItem -Path $env:TEMP -Filter "react-*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path $env:TEMP -Filter "metro-*" -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  [OK] Temp files cleared" -ForegroundColor Green
    Write-Host ""

    # 5. Clean Android build
    Write-Host "[5/6] Cleaning Android build cache..." -ForegroundColor Yellow
    if (Test-Path $AndroidPath) {
        Set-Location $AndroidPath

        # Clean Gradle build
        if ($IsWindows -or $env:OS -match "Windows") {
            .\gradlew.bat clean 2>&1 | Out-Null
        } else {
            ./gradlew clean 2>&1 | Out-Null
        }

        # Remove build directories
        $AppBuildPath = Join-Path -Path $AndroidPath -ChildPath "app\build"
        if (Test-Path $AppBuildPath) {
            Remove-Item -Path $AppBuildPath -Recurse -Force -ErrorAction SilentlyContinue
        }

        $BuildPath = Join-Path -Path $AndroidPath -ChildPath "build"
        if (Test-Path $BuildPath) {
            Remove-Item -Path $BuildPath -Recurse -Force -ErrorAction SilentlyContinue
        }

        Write-Host "  [OK] Android build cache cleared" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP] Android directory not found (skipped)" -ForegroundColor Gray
    }
    Write-Host ""

    # 6. Clean Gradle cache (global)
    Write-Host "[6/6] Cleaning Gradle global cache..." -ForegroundColor Yellow
    $GradleCachePath = Join-Path -Path $env:USERPROFILE -ChildPath ".gradle\caches"
    if (Test-Path $GradleCachePath) {
        Remove-Item -Path $GradleCachePath -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [OK] Gradle cache cleared" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP] Gradle cache not found (skipped)" -ForegroundColor Gray
    }
    Write-Host ""

    Set-Location $ProjectRoot

    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Cache cleaning completed!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

# ============================================
# MENU FUNCTIONS
# ============================================

function Show-MainMenu {
    Clear-Host
    Write-Host "============================================" -ForegroundColor Cyan
    if ($MultiAppMode) {
        Write-Host "React Native Multi-App Manager" -ForegroundColor Cyan
    } else {
        Write-Host "React Native Project Manager" -ForegroundColor Cyan
    }
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""

    if ($MultiAppMode) {
        Write-Host "Mode: MULTI-APP" -ForegroundColor Green
        if ($SelectedAppNamespace) {
            Write-Host "Selected App: $($SelectedAppConfig.DisplayName) ($SelectedAppNamespace)" -ForegroundColor Cyan
        } else {
            Write-Host "Selected App: None" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Mode: SINGLE-APP (Legacy)" -ForegroundColor Yellow
        Write-Host "Project: react_native" -ForegroundColor White
    }

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

    if ($MultiAppMode) {
        Write-Host "  [S] Select App" -ForegroundColor Cyan
        Write-Host ""
    }

    Write-Host "  [1] Reinstall Dependencies" -ForegroundColor White
    Write-Host "  [2] Build Application" -ForegroundColor White
    Write-Host "  [3] Debug Application" -ForegroundColor White
    Write-Host "  [4] Quick Start (Debug Android)" -ForegroundColor White
    Write-Host "  [5] Check Environment" -ForegroundColor White
    Write-Host "  [6] Clean All Caches" -ForegroundColor Magenta
    Write-Host "  [0] Exit" -ForegroundColor White
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Show-AppSelectionMenu {
    if (-not $MultiAppMode) {
        return $null
    }

    if (-not $MultiAppScriptsAvailable) {
        return $null
    }

    # Call Python launcher to show menu
    # IMPORTANT: Direct execution for real-time interactive display
    Write-Host "[INFO] Launching Python menu system..." -ForegroundColor Cyan
    Write-Host ""

    # Execute Python directly - no output capture to allow real-time interaction
    & python "$PythonLauncherPath" "$ProjectRoot"

    Write-Host ""

    # Check for errors via file variable system
    $errorMsg = Get-ErrorMessage
    if ($errorMsg) {
        Write-Host "[ERROR] Python menu failed: $errorMsg" -ForegroundColor Red
        Clear-ErrorMessage
        return $null
    }

    # Read selection from file variable system
    $menuSelection = Get-MenuSelection

    if (-not $menuSelection) {
        Write-Host "[WARNING] No menu selection found" -ForegroundColor Yellow
        return $null
    }

    # Get app config from file variable system
    $selectedApp = $menuSelection["SelectedApp"]
    $appName = $selectedApp["Name"]
    $appConfig = Get-AppConfig -AppName $appName

    return @{
        Index = $menuSelection["SelectedIndex"]
        Namespace = $appName
        Config = $appConfig
        Mode = $menuSelection["Mode"]
        Platform = $menuSelection["Platform"]
    }
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

    if ($MultiAppMode) {
        Write-Host "[MULTI-APP] Configuration:" -ForegroundColor Yellow
        Write-Host "  Available apps: $($AppConfigs.Count)" -ForegroundColor White
        foreach ($appKey in $AppConfigs.Keys | Sort-Object) {
            $config = $AppConfigs[$appKey]
            Write-Host "    - ${appKey}: $($config.DisplayName)" -ForegroundColor Gray
        }
        Write-Host ""
    }

    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "Environment check completed" -ForegroundColor Cyan
    Write-Host ""
    Read-Host "Press Enter to continue"
}

# ============================================
# INSTALLATION FUNCTIONS
# ============================================

function Invoke-Installation {
    param(
        [bool]$CleanCache = $false
    )

    Write-Host "[INSTALL] Starting installation process..." -ForegroundColor Cyan
    Write-Host ""

    # Clean cache if requested
    if ($CleanCache) {
        Write-Host "Clean cache option enabled" -ForegroundColor Yellow
        Clear-AllCaches -Interactive $false
    }

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
# BUILD FUNCTIONS (Multi-App Aware)
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

    # Multi-app mode: Switch to selected app and configure all files
    if ($MultiAppMode -and $SelectedAppNamespace -and $MultiAppScriptsAvailable) {
        Write-Host "[Multi-App] Switching to app: $SelectedAppNamespace" -ForegroundColor Cyan
        Write-Host ""

        $SwitchSuccess = Invoke-AppSwitcher -AppNamespace $SelectedAppNamespace

        if (-Not $SwitchSuccess) {
            Write-Host "[ERROR] Failed to switch to app: $SelectedAppNamespace" -ForegroundColor Red
            Write-Host "[ERROR] Cannot proceed with build" -ForegroundColor Red
            Write-Host ""
            return
        }
    } else {
        # Single-app mode: Run standard prebuild
        Invoke-AndroidPrebuild
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

    # Multi-app mode: Switch to selected app and configure all files
    if ($MultiAppMode -and $SelectedAppNamespace -and $MultiAppScriptsAvailable) {
        Write-Host "[Multi-App] Switching to app: $SelectedAppNamespace" -ForegroundColor Cyan
        Write-Host ""

        $SwitchSuccess = Invoke-AppSwitcher -AppNamespace $SelectedAppNamespace

        if (-Not $SwitchSuccess) {
            Write-Host "[ERROR] Failed to switch to app: $SelectedAppNamespace" -ForegroundColor Red
            Write-Host "[ERROR] Cannot proceed with build" -ForegroundColor Red
            Write-Host ""
            return
        }
    }

    Set-Location $IosPath

    Write-Host "[iOS] Installing CocoaPods dependencies..." -ForegroundColor Yellow
    pod install
    Write-Host ""

    $ConfigCapitalized = (Get-Culture).TextInfo.ToTitleCase($Config)
    Write-Host "[iOS] Building $ConfigCapitalized configuration..." -ForegroundColor Yellow
    Write-Host ""

    xcodebuild -workspace "react_native.xcworkspace" `
               -scheme "react_native" `
               -configuration $ConfigCapitalized `
               -sdk iphoneos `
               -derivedDataPath "./build"

    Write-Host ""
    Write-Host "[iOS] Build process completed" -ForegroundColor Green
    Write-Host ""

    Set-Location $ProjectRoot
}


# ============================================
# DEBUG FUNCTIONS (preserved from original)
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
        Write-Host "[Android] ERROR checking emulators: $($_.Exception.Message)" -ForegroundColor Red
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
        Write-Host "[Android] ERROR starting emulator: $($_.Exception.Message)" -ForegroundColor Red
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
                Write-Host "[Android] Emulator detected, checking boot status... ($($WaitedTime)s)" -ForegroundColor Gray

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
                Write-Host "[Android] Waiting for emulator to appear... ($($WaitedTime)s)" -ForegroundColor Gray
            }
        }
        catch {
            Write-Host "[Android] Error checking emulator status: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    if (-not $DeviceOnline) {
        Write-Host "[Android] WARNING: Emulator may not be fully ready after $($MaxWaitTime)s" -ForegroundColor Yellow
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

    $AppInfo = if ($MultiAppMode -and $SelectedAppNamespace) {
        "App: $($SelectedAppConfig.DisplayName) ($SelectedAppNamespace)"
    } else {
        "react_native"
    }

    # Start Metro in a new window using Start-Process
    $MetroProcess = Start-Process -FilePath "powershell" `
                                   -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot'; Write-Host 'Metro Bundler for $AppInfo' -ForegroundColor Cyan; Write-Host '========================================' -ForegroundColor Cyan; Write-Host ''; npx react-native start --port $MetroPort" `
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

    # Multi-app mode: Switch to selected app and configure all files
    if ($MultiAppMode -and $SelectedAppNamespace -and $MultiAppScriptsAvailable) {
        Write-Host "[Multi-App] Switching to app: $SelectedAppNamespace" -ForegroundColor Cyan
        Write-Host ""

        $SwitchSuccess = Invoke-AppSwitcher -AppNamespace $SelectedAppNamespace

        if (-Not $SwitchSuccess) {
            Write-Host "[ERROR] Failed to switch to app: $SelectedAppNamespace" -ForegroundColor Red
            Write-Host "[ERROR] Cannot proceed with debugging" -ForegroundColor Red
            Write-Host ""
            return
        }

        # Set environment variables for runtime
        $env:APP_ENTRY = $SelectedAppNamespace
        $env:APP_DISPLAY_NAME = $SelectedAppConfig.DisplayName
    } else {
        # Single-app mode: Run standard prebuild
        Invoke-AndroidPrebuild
    }

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

    # Multi-app mode: Switch to selected app and configure all files
    if ($MultiAppMode -and $SelectedAppNamespace -and $MultiAppScriptsAvailable) {
        Write-Host "[Multi-App] Switching to app: $SelectedAppNamespace" -ForegroundColor Cyan
        Write-Host ""

        $SwitchSuccess = Invoke-AppSwitcher -AppNamespace $SelectedAppNamespace

        if (-Not $SwitchSuccess) {
            Write-Host "[ERROR] Failed to switch to app: $SelectedAppNamespace" -ForegroundColor Red
            Write-Host "[ERROR] Cannot proceed with debugging" -ForegroundColor Red
            Write-Host ""
            return
        }

        # Set environment variables for runtime
        $env:APP_ENTRY = $SelectedAppNamespace
        $env:APP_DISPLAY_NAME = $SelectedAppConfig.DisplayName
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

function Invoke-AppSwitcher {
    param(
        [Parameter(Mandatory = $false)]
        [string]$AppNamespace = ""
    )

    $RNPyScriptsPath = Join-Path -Path $ScriptDir -ChildPath "build_scripts\react_native_py_scripts"
    $AppSwitcherPath = Join-Path -Path $RNPyScriptsPath -ChildPath "app_switcher.py"

    if (-Not (Test-Path $AppSwitcherPath)) {
        Write-Host "[SKIP] App switcher script not found" -ForegroundColor Gray
        Write-Host "       Expected at: $AppSwitcherPath" -ForegroundColor Gray
        Write-Host ""
        return $false
    }

    if (-Not $AppNamespace) {
        Write-Host "[SKIP] No app namespace provided - app switcher skipped" -ForegroundColor Gray
        Write-Host ""
        return $false
    }

    try {
        $PythonCheck = python --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[SKIP] Python not installed - app switcher skipped" -ForegroundColor Gray
            Write-Host "       Install Python from https://www.python.org/" -ForegroundColor Gray
            Write-Host ""
            return $false
        }
    } catch {
        Write-Host "[SKIP] Python not available - app switcher skipped" -ForegroundColor Gray
        Write-Host ""
        return $false
    }

    Write-Host "[App Switcher] Switching to app: $AppNamespace" -ForegroundColor Yellow
    Write-Host ""

    $OriginalLocation = Get-Location
    Set-Location $ProjectRoot
    python $AppSwitcherPath $ProjectRoot $AppNamespace
    $ExitCode = $LASTEXITCODE
    Set-Location $OriginalLocation

    if ($ExitCode -eq 0) {
        Write-Host ""
        Write-Host "[App Switcher] Switch completed successfully" -ForegroundColor Green
        Write-Host ""
        return $true
    } else {
        Write-Host ""
        Write-Host "[App Switcher] Switch failed with exit code: $ExitCode" -ForegroundColor Red
        Write-Host ""
        return $false
    }
}

function Invoke-AndroidPrebuild {
    $BuildScriptsPath = Join-Path -Path $ScriptDir -ChildPath "build_scripts"
    $PrebuildScriptPath = Join-Path -Path $BuildScriptsPath -ChildPath "android_prebuild.py"

    if (-Not (Test-Path $PrebuildScriptPath)) {
        Write-Host "[SKIP] Android prebuild script not found" -ForegroundColor Gray
        Write-Host "       Expected at: $PrebuildScriptPath" -ForegroundColor Gray
        Write-Host ""
        return
    }

    Write-Host "[Android] Running prebuild processor..." -ForegroundColor Yellow

    try {
        $PythonCheck = python --version 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[SKIP] Python not installed - prebuild skipped" -ForegroundColor Gray
            Write-Host "       Install Python from https://www.python.org/" -ForegroundColor Gray
            Write-Host ""
            return
        }
    } catch {
        Write-Host "[SKIP] Python not available - prebuild skipped" -ForegroundColor Gray
        Write-Host ""
        return
    }

    Write-Host ""
    Set-Location $ProjectRoot
    python $PrebuildScriptPath $ProjectRoot
    Write-Host ""
}


# ============================================
# AUTO-INSTALL CHECK
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
if ($MultiAppMode) {
    Write-Host "React Native Multi-App Manager" -ForegroundColor Cyan
} else {
    Write-Host "React Native Project Manager" -ForegroundColor Cyan
}
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

# If multi-app mode, read selection from file variable system and execute
if ($MultiAppMode -and $MultiAppScriptsAvailable) {
    # Read menu selection from file variable system (written by Python)
    $menuSelection = Get-MenuSelection

    if ($menuSelection) {
        $selectedApp = $menuSelection["SelectedApp"]
        $SelectedAppNamespace = $selectedApp["Name"]
        $SelectedMode = $menuSelection["Mode"]
        $SelectedPlatform = $menuSelection["Platform"]

        # Get app config from file variable system
        $SelectedAppConfig = Get-AppConfig -AppName $SelectedAppNamespace

        Write-Host ""
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "Executing Selection" -ForegroundColor Cyan
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "App: $($SelectedAppConfig.displayName) ($SelectedAppNamespace)" -ForegroundColor Green
        Write-Host "Mode: $SelectedMode" -ForegroundColor Cyan
        Write-Host "Platform: $SelectedPlatform" -ForegroundColor Cyan
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host ""

        # Execute based on mode
        # Note: Debug-Android and Build-Android handle resource backup/restore internally
        if ($SelectedMode -eq "test") {
            Invoke-CommandWithErrorHandling -Command {
                Start-TestRunner -AppDirectory $ProjectRoot -Namespace $SelectedAppNamespace
            } -CommandDescription "Run tests for $($SelectedAppConfig.displayName)" -PauseOnError $true
        } elseif ($SelectedMode -eq "debug") {
            # Debug functions handle their own resource management
            if ($SelectedPlatform -eq "android") {
                Debug-Android -DeviceName ""
            } elseif ($SelectedPlatform -eq "ios") {
                Debug-iOS -DeviceName ""
            }
        } elseif ($SelectedMode -eq "build") {
            # Build functions handle their own resource management
            if ($SelectedPlatform -eq "android") {
                Build-Android -Config "release"
            } elseif ($SelectedPlatform -eq "ios") {
                Build-iOS -Config "release"
            }
        }

        Write-Host ""
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "Execution completed" -ForegroundColor Green
        Write-Host "To select another app, run start.ps1 again" -ForegroundColor Yellow
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host "[WARNING] No menu selection found in file variable system" -ForegroundColor Yellow
        Write-Host "[INFO] Python menu may have been cancelled" -ForegroundColor Gray
    }
} else {
    # Legacy single-app mode - show traditional menu
    $Running = $true
    while ($Running) {
        Show-MainMenu
        $Choice = Read-Host "Enter your choice"

        switch ($Choice) {
            "S" {
            # App selection (multi-app mode only)
            if ($MultiAppMode) {
                $SelectedItem = Show-AppSelectionMenu
                if ($SelectedItem) {
                    $SelectedAppNamespace = $SelectedItem.Namespace
                    $SelectedAppConfig = $SelectedItem.Config

                    $modeLabel = switch ($SelectedItem.Mode) {
                        "debug" { "Debug" }
                        "build" { "Build" }
                        "test" { "Test" }
                        default { $SelectedItem.Mode }
                    }
                    $platformLabel = switch ($SelectedItem.Platform) {
                        "android" { "Android" }
                        "ios" { "iOS" }
                        default { $SelectedItem.Platform }
                    }

                    Write-Host ""
                    Write-Host "Selected: $($SelectedAppConfig.DisplayName) ($SelectedAppNamespace)" -ForegroundColor Green
                    Write-Host "Mode: $modeLabel | Platform: $platformLabel" -ForegroundColor Cyan
                    Start-Sleep -Seconds 1
                }
            } else {
                Write-Host ""
                Write-Host "App selection only available in multi-app mode" -ForegroundColor Yellow
                Start-Sleep -Seconds 1
            }
        }
        "s" {
            # Same as "S"
            if ($MultiAppMode) {
                $SelectedItem = Show-AppSelectionMenu
                if ($SelectedItem) {
                    $SelectedAppNamespace = $SelectedItem.Namespace
                    $SelectedAppConfig = $SelectedItem.Config

                    $modeLabel = switch ($SelectedItem.Mode) {
                        "debug" { "Debug" }
                        "build" { "Build" }
                        "test" { "Test" }
                        default { $SelectedItem.Mode }
                    }
                    $platformLabel = switch ($SelectedItem.Platform) {
                        "android" { "Android" }
                        "ios" { "iOS" }
                        default { $SelectedItem.Platform }
                    }

                    Write-Host ""
                    Write-Host "Selected: $($SelectedAppConfig.DisplayName) ($SelectedAppNamespace)" -ForegroundColor Green
                    Write-Host "Mode: $modeLabel | Platform: $platformLabel" -ForegroundColor Cyan
                    Start-Sleep -Seconds 1
                }
            } else {
                Write-Host ""
                Write-Host "App selection only available in multi-app mode" -ForegroundColor Yellow
                Start-Sleep -Seconds 1
            }
        }
        "1" {
            # Reinstall
            Clear-Host
            Write-Host "============================================" -ForegroundColor Cyan
            Write-Host "Reinstalling Dependencies" -ForegroundColor Cyan
            Write-Host "============================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "Clean cache before reinstalling? (y/N): " -NoNewline -ForegroundColor Yellow
            $CleanCache = Read-Host

            $ShouldClean = ($CleanCache -eq "y" -or $CleanCache -eq "Y")

            Invoke-Installation -CleanCache $ShouldClean

            Write-Host "Reinstallation process completed" -ForegroundColor Cyan
            Write-Host ""
            Read-Host "Press Enter to continue"
        }
        "2" {
            # Build
            # Check if app is selected in multi-app mode
            if ($MultiAppMode -and -not $SelectedAppNamespace) {
                Write-Host ""
                Write-Host "Please select an app first (press 'S')" -ForegroundColor Yellow
                Start-Sleep -Seconds 2
                continue
            }

            $BuildConfig = Show-BuildMenu
            if ($BuildConfig) {
                Clear-Host
                Write-Host "============================================" -ForegroundColor Cyan
                Write-Host "Building Application" -ForegroundColor Cyan
                Write-Host "============================================" -ForegroundColor Cyan
                if ($MultiAppMode -and $SelectedAppNamespace) {
                    Write-Host "App: $($SelectedAppConfig.DisplayName) ($SelectedAppNamespace)" -ForegroundColor Cyan
                }
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
            # Check if app is selected in multi-app mode
            if ($MultiAppMode -and -not $SelectedAppNamespace) {
                Write-Host ""
                Write-Host "Please select an app first (press 'S')" -ForegroundColor Yellow
                Start-Sleep -Seconds 2
                continue
            }

            $DebugConfig = Show-DebugMenu
            if ($DebugConfig) {
                Clear-Host
                Write-Host "============================================" -ForegroundColor Cyan
                Write-Host "Debug Application" -ForegroundColor Cyan
                Write-Host "============================================" -ForegroundColor Cyan
                if ($MultiAppMode -and $SelectedAppNamespace) {
                    Write-Host "App: $($SelectedAppConfig.DisplayName) ($SelectedAppNamespace)" -ForegroundColor Cyan
                }
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
            # Check if app is selected in multi-app mode
            if ($MultiAppMode -and -not $SelectedAppNamespace) {
                Write-Host ""
                Write-Host "Please select an app first (press 'S')" -ForegroundColor Yellow
                Start-Sleep -Seconds 2
                continue
            }

            Clear-Host
            Write-Host "============================================" -ForegroundColor Cyan
            Write-Host "Quick Start (Debug Android)" -ForegroundColor Cyan
            Write-Host "============================================" -ForegroundColor Cyan
            if ($MultiAppMode -and $SelectedAppNamespace) {
                Write-Host "App: $($SelectedAppConfig.DisplayName) ($SelectedAppNamespace)" -ForegroundColor Cyan
            }
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
        "6" {
            # Clean All Caches
            Clear-Host
            Clear-AllCaches -Interactive $true
            Read-Host "Press Enter to continue"
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
}

Write-Host ""
Write-Host "Thank you for using React Native Project Manager!" -ForegroundColor Cyan
Write-Host ""
