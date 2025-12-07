# android_debug.ps1 - Android Platform Debugging Script
# Usage: .\scripts\android_debug.ps1 [command] [options]

param(
    [Parameter(Position=0)]
    [string]$Command = "",
    
    [Parameter(Position=1)]
    [string]$Option = ""
)

# Configuration
$APP_MODULE = ":app"
$BUILD_TYPE = "Debug"
$APPLICATION_ID = "com.escodro.qyapp"

# Get project root directory (parent of scripts directory)
$SCRIPT_DIR = Split-Path -Parent $PSCommandPath
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR

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

# Function: Check if command exists
function Test-Command {
    param([string]$CommandName)
    
    $null = Get-Command $CommandName -ErrorAction SilentlyContinue
    if (-not $?) {
        Write-Error "$CommandName is not installed, please install it first"
        exit 1
    }
}

# Function: List available Android emulators
function Get-Emulators {
    Write-Info "Available Android emulators:"
    try {
        $avdsRaw = & emulator -list-avds 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Failed to list emulators. Error: $avdsRaw"
            exit 1
        }
        
        # Handle both array and string outputs
        $avds = [System.Collections.ArrayList]@()
        if ($avdsRaw -is [array]) {
            foreach ($line in $avdsRaw) {
                $trimmed = [string]$line
                $trimmed = $trimmed.Trim()
                if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
                    [void]$avds.Add($trimmed)
                }
            }
        } else {
            # Single string output - split by newlines
            $lines = [string]$avdsRaw -split "`r?`n"
            foreach ($line in $lines) {
                $trimmed = [string]$line
                $trimmed = $trimmed.Trim()
                if (-not [string]::IsNullOrWhiteSpace($trimmed)) {
                    [void]$avds.Add($trimmed)
                }
            }
        }
        
        # Convert ArrayList to array of strings
        $avds = $avds.ToArray()
        
        if ($avds.Count -eq 0) {
            Write-Error "No emulators found. Please create an emulator using AVD Manager."
            exit 1
        }
        
        $index = 1
        foreach ($avd in $avds) {
            Write-Host "  $index. $avd"
            $index++
        }
        return $avds
    } catch {
        Write-Error "Failed to list emulators: $_"
        exit 1
    }
}

# Function: Show interactive menu
function Show-Menu {
    Write-Host ""
    Write-Info "Android Debugging Menu"
    Write-Host "======================"
    Write-Host "1. List available emulators"
    Write-Host "2. Start emulator (with menu selection)"
    Write-Host "3. Install app on connected device"
    Write-Host "4. Launch app"
    Write-Host "5. Verify app installation"
    Write-Host "6. View app logs"
    Write-Host "7. Setup wireless debugging"
    Write-Host "8. Stop all emulators"
    Write-Host "0. Exit"
    Write-Host ""
    $choice = Read-Host "Select an option"
    return $choice
}

# Function: Get running emulators
function Get-RunningEmulators {
    $devices = & adb devices
    $running = @()
    foreach ($line in $devices) {
        if ($line -match "emulator-(\d+)\s+device") {
            $running += $matches[1]
        }
    }
    return $running
}

# Function: Stop all emulators
function Stop-AllEmulators {
    Write-Info "Stopping all Android emulators..."
    $running = Get-RunningEmulators
    if ($running.Count -eq 0) {
        Write-Info "No running emulators found"
        return
    }
    
    foreach ($port in $running) {
        Write-Info "Stopping emulator on port $port..."
        & adb -s "emulator-$port" emu kill 2>$null
    }
    
    # Also try to kill emulator processes
    Get-Process -Name "emulator" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    
    Start-Sleep -Seconds 2
    Write-Success "All emulators stopped"
}

# Function: Start emulator with automatic conflict resolution
function Start-Emulator {
    param([string]$AvdName)

    if ([string]::IsNullOrEmpty($AvdName)) {
        Write-Warning "No emulator name specified"
        $avds = Get-Emulators
        Write-Host ""

        # Force $avds to be an array to prevent PowerShell from unwrapping single elements
        $avds = @($avds)

        # Auto-select if only one emulator available
        if ($avds.Count -eq 1) {
            # Ensure we convert to string before calling Trim()
            $AvdName = [string]$avds[0]
            $AvdName = $AvdName.Trim()
            Write-Info "Auto-selected the only available emulator: $AvdName"
        } else {
            # Multiple emulators - ask user to choose
            $selection = Read-Host "Enter emulator number to start"
            # Trim the input to remove any whitespace
            $selection = $selection.Trim()
            if ($selection -match '^\d+$' -and [int]$selection -ge 1 -and [int]$selection -le $avds.Count) {
                $index = [int]$selection - 1
                # Ensure we convert to string before calling Trim()
                $AvdName = [string]$avds[$index]
                $AvdName = $AvdName.Trim()
                Write-Info "Selected emulator: $AvdName"
            } else {
                Write-Error "Invalid selection: '$selection'. Please enter a number between 1 and $($avds.Count)"
                exit 1
            }
        }
    }
    
    # Ensure AVD name is a string and trimmed
    $AvdName = [string]$AvdName
    $AvdName = $AvdName.Trim()
    
    if ([string]::IsNullOrWhiteSpace($AvdName)) {
        Write-Error "Invalid emulator name: emulator name is empty"
        return $false
    }
    
    Write-Info "Starting Android emulator: $AvdName"
    
    # Check if any emulator is running
    $devices = & adb devices
    $isAnyRunning = $devices -match "emulator"
    $runningCount = (Get-RunningEmulators).Count
    
    if ($isAnyRunning) {
        Write-Warning "Found $runningCount running emulator(s)"
        Write-Host ""
        Write-Host "Options:"
        Write-Host "  1. Use existing emulator (if same AVD)"
        Write-Host "  2. Start new instance with -read-only flag"
        Write-Host "  3. Stop all and start fresh"
        Write-Host ""
        $choice = Read-Host "Select option (1-3, default: 2)"
        
        switch ($choice) {
            "1" {
                Write-Info "Using existing emulator..."
                return $true
            }
            "3" {
                Stop-AllEmulators
                Start-Sleep -Seconds 3
                $isAnyRunning = $false
            }
            default {
                # Use -read-only flag
                $isAnyRunning = $true
            }
        }
    }
    
    # Start emulator (background)
    $emulatorArgs = @("-avd", $AvdName, "-netdelay", "none", "-netspeed", "full")
    if ($isAnyRunning) {
        $emulatorArgs += "-read-only"
        Write-Info "Using -read-only flag for multiple instances"
    }
    
    # Try to start emulator
    try {
        $process = Start-Process -FilePath "emulator" -ArgumentList $emulatorArgs -NoNewWindow -PassThru -ErrorAction Stop
        Write-Info "Waiting for emulator to start (PID: $($process.Id))..."
        
        # Wait for device with timeout
        $maxWait = 120  # 2 minutes
        $waited = 0
        while ($waited -lt $maxWait) {
            $devices = & adb devices
            if ($devices -match "device$") {
                break
            }
            Start-Sleep -Seconds 2
            $waited += 2
            if ($waited % 10 -eq 0) {
                Write-Host "." -NoNewline
            }
        }
        Write-Host ""
        
        # Wait for system to fully boot
        Write-Info "Waiting for system to fully boot..."
        Start-Sleep -Seconds 10
        
        # Check if device is online
        $devices = & adb devices
        if ($devices -match "device$") {
            Write-Success "Emulator started and connected"
            return $true
        } else {
            Write-Error "Failed to start emulator or device not ready"
            return $false
        }
    } catch {
        Write-Error "Failed to start emulator: $_"
        Write-Info "Try stopping existing emulators first"
        return $false
    }
}

# Function: Check device connection
function Test-Device {
    $devices = & adb devices
    $deviceCount = ($devices | Select-String "device$").Count
    
    if ($deviceCount -eq 0) {
        Write-Error "No connected device detected"
        Write-Info "Please ensure:"
        Write-Host "  1. USB debugging is enabled"
        Write-Host "  2. Device is connected or emulator is started"
        Write-Host "  3. Computer is authorized for debugging"
        return $false
    } elseif ($deviceCount -gt 1) {
        Write-Warning "Multiple devices detected, using first device"
        & adb devices
    } else {
        Write-Success "Device detected"
        & adb devices
    }
    return $true
}

# Function: Verify app installation
function Test-AppInstalled {
    Write-Info "Verifying app installation..."
    $result = & adb shell pm list packages | Select-String $APPLICATION_ID
    if ($result) {
        Write-Success "App is installed: $APPLICATION_ID"
        
        # Get app version info
        Write-Info "App information:"
        $versionInfo = & adb shell dumpsys package $APPLICATION_ID | Select-String -Pattern "versionName|versionCode"
        if ($versionInfo) {
            foreach ($line in $versionInfo) {
                Write-Host "  $line" -ForegroundColor Gray
            }
        }
        
        # Get app path
        $appPath = & adb shell pm path $APPLICATION_ID
        if ($appPath) {
            Write-Host "  Installed at: $appPath" -ForegroundColor Gray
        }
        
        return $true
    } else {
        Write-Warning "App not found in installed packages"
        return $false
    }
}

# Function: Install app to device
function Install-App {
    param(
        [string]$DeviceId,
        [switch]$AutoStartEmulator
    )

    # Check device connection, auto-start emulator if needed
    if (-not (Test-Device)) {
        if ($AutoStartEmulator) {
            Write-Warning "No device detected, attempting to start emulator..."
            Write-Host ""
            if (-not (Start-Emulator "")) {
                Write-Error "Failed to start emulator"
                return $false
            }
            Write-Host ""
            # Re-check device connection
            if (-not (Test-Device)) {
                Write-Error "Device still not available after starting emulator"
                return $false
            }
        } else {
            return $false
        }
    }

    Write-Info "Building and installing app..."
    Write-Host ""

    # Change to project root directory
    $originalLocation = Get-Location
    Set-Location $PROJECT_ROOT

    try {
        if (-not [string]::IsNullOrEmpty($DeviceId)) {
            & .\gradlew.bat "${APP_MODULE}:installDebug" "-Pandroid.injected.build.devices=$DeviceId"
        } else {
            & .\gradlew.bat "${APP_MODULE}:installDebug"
        }
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Success "App installed successfully"

            # Verify installation
            Write-Host ""
            Test-AppInstalled

            # Show app info
            Write-Host ""
            Write-Info "Installation commands used:"
            if (-not [string]::IsNullOrEmpty($DeviceId)) {
                Write-Host "  .\gradlew.bat ${APP_MODULE}:installDebug -Pandroid.injected.build.devices=$DeviceId" -ForegroundColor Gray
            } else {
                Write-Host "  .\gradlew.bat ${APP_MODULE}:installDebug" -ForegroundColor Gray
            }

            Write-Host ""
            Write-Info "To launch the app, run:"
            Write-Host "  .\scripts\android_debug.ps1 launch" -ForegroundColor Yellow
            Write-Host "  or" -ForegroundColor Gray
            Write-Host "  adb shell am start -n ${APPLICATION_ID}/com.escodro.qyapp.MainActivity" -ForegroundColor Yellow

            return $true
        } else {
            Write-Error "App installation failed"
            return $false
        }
    } catch {
        Write-Error "Build failed: $_"
        return $false
    } finally {
        # Restore original directory
        Set-Location $originalLocation
    }
}

# Function: Launch app
function Start-App {
    if (-not (Test-Device)) {
        return $false
    }
    
    Write-Info "Launching app..."
    try {
        $result = & adb shell am start -n "${APPLICATION_ID}/com.escodro.qyapp.MainActivity" 2>&1
        if ($LASTEXITCODE -eq 0 -and $result -notmatch "Error") {
            Write-Success "App launched"
            return $true
        } else {
            Write-Warning "App may not be installed. Trying to install first..."
            if (Install-App) {
                & adb shell am start -n "${APPLICATION_ID}/com.escodro.qyapp.MainActivity"
                Write-Success "App launched"
                return $true
            } else {
                Write-Error "Failed to launch app"
                return $false
            }
        }
    } catch {
        Write-Error "Failed to launch app: $_"
        return $false
    }
}

# Function: View logs
function Show-Logs {
    if (-not (Test-Device)) {
        return
    }
    
    Write-Info "Viewing app logs (Press Ctrl+C to exit)..."
    & adb logcat -c
    try {
        & adb logcat | Select-String -Pattern "($APPLICATION_ID|Qyapp|WordFlow)"
    } catch {
        # If user presses Ctrl+C, exit gracefully
        Write-Host ""
        Write-Info "Log viewing stopped"
    }
}

# Function: Setup wireless debugging
function Set-WirelessDebug {
    Write-Info "Setting up wireless debugging..."
    Write-Info "On your phone:"
    Write-Host "  1. Open Settings → System → Developer options"
    Write-Host "  2. Enable Wireless debugging"
    Write-Host "  3. Tap Wireless debugging → Pair device with pairing code"
    Write-Host ""
    
    $pairAddress = Read-Host "Enter pairing IP and port (e.g., 192.168.1.100:40407)"
    $pairCode = Read-Host "Enter pairing code"
    
    & adb pair $pairAddress
    $connectAddress = Read-Host "Enter connection IP and port (e.g., 192.168.1.100:40407)"
    & adb connect $connectAddress
    
    Write-Success "Wireless debugging connected"
}

# Main function
function Main {
    Write-Info "Android Debugging Tool"
    Write-Host ""
    
    # Check required commands
    Test-Command "adb"
    Test-Command "emulator"
    
    # If no command provided, show menu
    if ([string]::IsNullOrEmpty($Command)) {
        while ($true) {
            $choice = Show-Menu
            switch ($choice) {
                "1" {
                    Get-Emulators | Out-Null
                    Read-Host "Press Enter to continue"
                }
                "2" {
                    Start-Emulator ""
                    if ($?) {
                        Install-App
                        Start-App
                    }
                    Read-Host "Press Enter to continue"
                }
                "3" {
                    if (Install-App -AutoStartEmulator) {
                        Write-Host ""
                        $launch = Read-Host "Launch app now? (y/n, default: y)"
                        if ($launch -ne "n") {
                            Start-App
                        }
                    }
                    Read-Host "Press Enter to continue"
                }
                "4" {
                    Start-App
                    Read-Host "Press Enter to continue"
                }
                "5" {
                    Test-AppInstalled
                    Read-Host "Press Enter to continue"
                }
                "6" {
                    Show-Logs
                }
                "7" {
                    Set-WirelessDebug
                    Read-Host "Press Enter to continue"
                }
                "8" {
                    Stop-AllEmulators
                    Read-Host "Press Enter to continue"
                }
                "0" {
                    Write-Info "Exiting..."
                    exit 0
                }
                default {
                    Write-Warning "Invalid option"
                    Start-Sleep -Seconds 1
                }
            }
        }
    }
    
    # Parse command
    switch ($Command.ToLower()) {
        "list" {
            Get-Emulators | Out-Null
            exit 0
        }
        "emulator" {
            if (Start-Emulator $Option) {
                Install-App
                Start-App
            }
        }
        "device" {
            if (Test-Device) {
                Install-App
                Start-App
            }
        }
        "install" {
            Install-App $Option
            Write-Host ""
            Write-Info "App installation completed. Use 'launch' command to start the app."
        }
        "verify" {
            Test-AppInstalled
        }
        "launch" {
            Start-App
        }
        "logs" {
            Show-Logs
        }
        "wireless" {
            Set-WirelessDebug
        }
        "stop" {
            Stop-AllEmulators
        }
        "menu" {
            while ($true) {
                $choice = Show-Menu
                switch ($choice) {
                    "1" { Get-Emulators | Out-Null; Read-Host "Press Enter to continue" }
                    "2" { Start-Emulator ""; if ($?) { Install-App; Start-App }; Read-Host "Press Enter to continue" }
                    "3" { Install-App -AutoStartEmulator; Read-Host "Press Enter to continue" }
                    "4" { Start-App; Read-Host "Press Enter to continue" }
                    "5" { Test-AppInstalled; Read-Host "Press Enter to continue" }
                    "6" { Show-Logs }
                    "7" { Set-WirelessDebug; Read-Host "Press Enter to continue" }
                    "8" { Stop-AllEmulators; Read-Host "Press Enter to continue" }
                    "0" { exit 0 }
                    default { Write-Warning "Invalid option"; Start-Sleep -Seconds 1 }
                }
            }
        }
        default {
            Write-Host "Usage: .\scripts\android_debug.ps1 [command] [options]"
            Write-Host ""
            Write-Host "Commands:"
            Write-Host "  (no command)     - Show interactive menu"
            Write-Host "  menu             - Show interactive menu"
            Write-Host "  list             - List available emulators"
            Write-Host "  emulator [name]  - Start emulator and install app"
            Write-Host "  device           - Install app on connected device"
    Write-Host "  install [device] - Install app only"
    Write-Host "  launch           - Launch app only"
    Write-Host "  verify           - Verify app installation"
    Write-Host "  logs             - View app logs"
            Write-Host "  wireless         - Setup wireless debugging"
            Write-Host "  stop             - Stop all emulators"
            Write-Host ""
            Write-Host "Examples:"
            Write-Host "  .\scripts\android_debug.ps1"
            Write-Host "  .\scripts\android_debug.ps1 menu"
            Write-Host "  .\scripts\android_debug.ps1 list"
            Write-Host "  .\scripts\android_debug.ps1 emulator Pixel_6_API_34"
            Write-Host "  .\scripts\android_debug.ps1 device"
            Write-Host "  .\scripts\android_debug.ps1 logs"
            exit 1
        }
    }
}

Main
