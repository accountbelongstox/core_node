# parallel_debug.ps1 - Parallel Debugging for Android and iOS Platforms
# Usage: .\scripts\parallel_debug.ps1

# Configuration
$ANDROID_AVD = if ($env:ANDROID_AVD) { $env:ANDROID_AVD } else { "Pixel_6_API_34" }
$IOS_SIMULATOR = if ($env:IOS_SIMULATOR) { $env:IOS_SIMULATOR } else { "iPhone 15 Pro" }
$APP_MODULE = ":app"
$APPLICATION_ID = "com.escodro.alkaa"

# Global variables
$script:ANDROID_PID = $null
$script:IOS_UDID = $null
$script:ANDROID_STARTED = $false
$script:IOS_STARTED = $false

# Cleanup function
function Stop-Debugging {
    Write-Host ""
    Write-Info "Cleaning up..."
    
    # Stop Android emulator
    if ($script:ANDROID_PID) {
        Write-Info "Stopping Android emulator (PID: $script:ANDROID_PID)..."
        Stop-Process -Id $script:ANDROID_PID -ErrorAction SilentlyContinue
    }
    
    # Shutdown iOS simulator
    if ($script:IOS_UDID) {
        Write-Info "Shutting down iOS simulator..."
        & xcrun simctl shutdown $script:IOS_UDID 2>$null
    }
    
    Write-Success "Cleanup complete"
}

# Register cleanup on exit
Register-EngineEvent PowerShell.Exiting -Action { Stop-Debugging } | Out-Null

# Functions: Print colored messages
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Header {
    param([string]$Message)
    $line = "========================================"
    Write-Host $line -ForegroundColor Cyan
    Write-Host $Message -ForegroundColor Cyan
    Write-Host $line -ForegroundColor Cyan
}

# Function: Check command
function Test-Command {
    param([string]$CommandName)
    
    $null = Get-Command $CommandName -ErrorAction SilentlyContinue
    return $?
}

# Function: Check if on macOS
function Test-macOS {
    if ($IsMacOS -or (Get-Command "uname" -ErrorAction SilentlyContinue)) {
        $uname = & uname 2>$null
        if ($uname -eq "Darwin") {
            return $true
        }
    }
    return $false
}

# Function: Start Android emulator
function Start-Android {
    Write-Header "Starting Android Platform"
    
    if (-not (Test-Command "adb") -or -not (Test-Command "emulator")) {
        Write-Warning "Android tools not installed, skipping Android debugging"
        return $false
    }
    
    # Check if device is already connected
    $devices = & adb devices
    if ($devices -match "device$") {
        Write-Warning "Android device already connected"
        $response = Read-Host "Use existing device? (y/n)"
        if ($response -eq "y" -or $response -eq "Y") {
            Write-Success "Using existing Android device"
            
            # Install app
            Write-Info "Installing Android app..."
            & .\gradlew.bat "${APP_MODULE}:installDebug" 2>&1 | Out-File -FilePath "$env:TEMP\android_build.log" -Encoding utf8
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Android app installation failed, check logs: $env:TEMP\android_build.log"
            }
            
            # Launch app
            Write-Info "Launching Android app..."
            & adb shell am start -n "${APPLICATION_ID}/com.escodro.alkaa.MainActivity" 2>$null
            if ($LASTEXITCODE -ne 0) {
                Write-Warning "Android app launch failed"
            }
            
            return $true
        }
    }
    
    # Check if emulator exists
    $avds = & emulator -list-avds
    if ($avds -notcontains $ANDROID_AVD) {
        Write-Error "Emulator $ANDROID_AVD does not exist"
        Write-Info "Available emulators:"
        $avds | ForEach-Object { Write-Host "  - $_" }
        $ANDROID_AVD = Read-Host "Enter emulator name to use"
    }
    
    Write-Info "Starting Android emulator: $ANDROID_AVD"
    
    # Start emulator (background, no snapshot load for faster startup)
    $process = Start-Process -FilePath "emulator" -ArgumentList "-avd", $ANDROID_AVD, "-no-snapshot-load", "-no-audio" -NoNewWindow -PassThru -RedirectStandardOutput "$env:TEMP\android_emulator.log" -RedirectStandardError "$env:TEMP\android_emulator.log"
    $script:ANDROID_PID = $process.Id
    
    Write-Info "Waiting for Android emulator to start (PID: $script:ANDROID_PID)..."
    
    # Wait for device connection
    $maxAttempts = 60
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        $devices = & adb devices
        if ($devices -match "device$") {
            break
        }
        Start-Sleep -Seconds 1
        $attempt++
        if ($attempt % 10 -eq 0) {
            Write-Host "." -NoNewline
        }
    }
    Write-Host ""
    
    if ($devices -match "device$") {
        Write-Success "Android emulator started and connected"
        
        # Wait for system to fully boot
        Write-Info "Waiting for system to fully boot..."
        Start-Sleep -Seconds 10
        
        # Install app
        Write-Info "Installing Android app..."
        & .\gradlew.bat "${APP_MODULE}:installDebug" 2>&1 | Out-File -FilePath "$env:TEMP\android_build.log" -Encoding utf8
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Android app installation failed, check logs: $env:TEMP\android_build.log"
        }
        
        # Launch app
        Write-Info "Launching Android app..."
        & adb shell am start -n "${APPLICATION_ID}/com.escodro.alkaa.MainActivity" 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Warning "Android app launch failed"
        }
        
        return $true
    } else {
        Write-Error "Android emulator startup timeout"
        Stop-Process -Id $script:ANDROID_PID -ErrorAction SilentlyContinue
        return $false
    }
}

# Function: Start iOS simulator
function Start-iOS {
    Write-Header "Starting iOS Platform"
    
    # Check if on macOS
    if (-not (Test-macOS)) {
        Write-Warning "iOS debugging requires macOS, skipping iOS debugging"
        return $false
    }
    
    if (-not (Test-Command "xcrun") -or -not (Test-Command "xcodebuild")) {
        Write-Warning "iOS tools not installed, skipping iOS debugging"
        return $false
    }
    
    # Check if simulator exists
    $simulators = & xcrun simctl list devices
    $simulatorExists = $simulators | Select-String -Pattern $IOS_SIMULATOR
    if (-not $simulatorExists) {
        Write-Error "Simulator $IOS_SIMULATOR does not exist"
        Write-Info "Available simulators:"
        & xcrun simctl list devices available | Select-String -Pattern "iPhone|iPad" | Select-Object -First 5 | ForEach-Object {
            Write-Host "  - $($_.Line.Trim())"
        }
        $IOS_SIMULATOR = Read-Host "Enter simulator name to use"
    }
    
    Write-Info "Starting iOS simulator: $IOS_SIMULATOR"
    
    # Get simulator UDID
    $udidMatch = & xcrun simctl list devices | Select-String -Pattern $IOS_SIMULATOR | Select-String -Pattern '([A-F0-9-]{36})'
    if ($udidMatch) {
        $script:IOS_UDID = $udidMatch.Matches[0].Groups[1].Value
    }
    
    if ([string]::IsNullOrEmpty($script:IOS_UDID)) {
        Write-Error "Simulator not found: $IOS_SIMULATOR"
        return $false
    }
    
    # Check if already running
    $isBooted = & xcrun simctl list devices | Select-String -Pattern $IOS_SIMULATOR | Select-String -Pattern "Booted"
    if (-not $isBooted) {
        # Start simulator
        & xcrun simctl boot $script:IOS_UDID 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to start iOS simulator"
            return $false
        }
        Write-Success "iOS simulator started"
    } else {
        Write-Warning "iOS simulator already running"
    }
    
    # Open Simulator app
    & open -a Simulator
    
    # Build shared module
    Write-Info "Building KMP shared module..."
    & .\gradlew :shared:packForXcode 2>&1 | Out-File -FilePath "$env:TEMP\ios_build.log" -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Shared module build failed, check logs: $env:TEMP\ios_build.log"
    }
    
    # Open Xcode
    Write-Info "Opening Xcode project..."
    $workspaceFile = Join-Path "ios-app" "alkaa.xcworkspace"
    $projectFile = Join-Path "ios-app" "alkaa.xcodeproj"
    
    if (Test-Path $workspaceFile) {
        & open $workspaceFile
    } elseif (Test-Path $projectFile) {
        & open $projectFile
    } else {
        Write-Warning "Xcode project file not found"
    }
    
    Write-Info "In Xcode:"
    Write-Host "  1. Select simulator: $IOS_SIMULATOR"
    Write-Host "  2. Select Scheme: alkaa"
    Write-Host "  3. Click Run button (Cmd + R)"
    
    return $true
}

# Function: Show debug info
function Show-DebugInfo {
    Write-Header "Debug Information"
    
    Write-Host ""
    Write-Host "Android Platform:"
    if ($script:ANDROID_PID) {
        Write-Host "  - Emulator: $ANDROID_AVD (PID: $script:ANDROID_PID)"
        Write-Host "  - Logs: adb logcat -s 'Alkaa' 'WordFlow'"
        Write-Host "  - View logs: Get-Content $env:TEMP\android_emulator.log -Wait"
    } else {
        Write-Host "  - Not started"
    }
    
    Write-Host ""
    Write-Host "iOS Platform:"
    if ($script:IOS_UDID) {
        Write-Host "  - Simulator: $IOS_SIMULATOR (UDID: $script:IOS_UDID)"
        Write-Host "  - Logs: Get-Content `$HOME\Library\Logs\CoreSimulator\$script:IOS_UDID\system.log -Wait"
        Write-Host "  - View build logs: Get-Content $env:TEMP\ios_build.log -Wait"
    } else {
        Write-Host "  - Not started"
    }
    
    Write-Host ""
    Write-Host "Common Commands:"
    Write-Host "  - Android logs: adb logcat | Select-String -Pattern '(Alkaa|WordFlow)'"
    Write-Host "  - iOS logs: Get-Content `$HOME\Library\Logs\CoreSimulator\*\system.log -Wait"
    Write-Host "  - Stop debugging: Press Ctrl+C"
    Write-Host ""
}

# Main function
function Main {
    Write-Header "Kotlin Multiplatform Parallel Debugging"
    Write-Host ""
    
    # Start Android
    if (Start-Android) {
        $script:ANDROID_STARTED = $true
    }
    
    Write-Host ""
    
    # Start iOS
    if (Start-iOS) {
        $script:IOS_STARTED = $true
    }
    
    Write-Host ""
    
    # Show debug info
    Show-DebugInfo
    
    if (-not $script:ANDROID_STARTED -and -not $script:IOS_STARTED) {
        Write-Error "Failed to start any platform"
        exit 1
    }
    
    Write-Success "Debugging environment ready!"
    Write-Host ""
    Write-Info "Press Ctrl+C to stop debugging..."
    
    # Keep script running
    try {
        while ($true) {
            Start-Sleep -Seconds 1
        }
    } catch {
        Stop-Debugging
    }
}

Main

