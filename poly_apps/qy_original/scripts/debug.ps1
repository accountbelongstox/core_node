# ============================================
# React Native Project Debug Script
# ============================================
# This script starts the development server and launches the app on a device/emulator
# Usage: .\debug.ps1 [-Platform <android|ios>] [-Device <device-name>]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("android", "ios")]
    [string]$Platform = "android",

    [Parameter(Mandatory=$false)]
    [string]$Device = ""
)

# Declare all variables at the beginning
$ErrorActionPreference = "Continue"
$ScriptDir = $null
$ProjectRoot = $null
$MetroServerJob = $null
$LogFile = $null
$MetroPort = 8081

# Initialize paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogFile = Join-Path -Path $ProjectRoot -ChildPath "debug.log"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "React Native Debug Mode" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Platform: $Platform" -ForegroundColor White
if ($Device) {
    Write-Host "Target Device: $Device" -ForegroundColor White
}
Write-Host ""

# Check if node_modules exists
$NodeModulesPath = Join-Path -Path $ProjectRoot -ChildPath "node_modules"
if (-Not (Test-Path $NodeModulesPath)) {
    Write-Host "ERROR: node_modules not found. Please run install.ps1 first" -ForegroundColor Red
    exit 1
}

# Function to start Metro bundler
function Start-MetroServer {
    Write-Host "[Metro] Starting Metro bundler on port $MetroPort..." -ForegroundColor Yellow

    Set-Location $ProjectRoot

    try {
        $MetroServerJob = Start-Job -ScriptBlock {
            param($RootPath)
            Set-Location $RootPath
            npx react-native start --port 8081
        } -ArgumentList $ProjectRoot

        Write-Host "[Metro] Metro bundler started (Job ID: $($MetroServerJob.Id))" -ForegroundColor Green
        Write-Host "[Metro] Waiting for Metro to initialize..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5

        return $MetroServerJob
    } catch {
        Write-Host "[Metro] Failed to start Metro bundler: $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

# Function to check if Metro is running
function Test-MetroRunning {
    try {
        $Response = Invoke-WebRequest -Uri "http://localhost:$MetroPort/status" -TimeoutSec 2 -ErrorAction SilentlyContinue
        return $true
    } catch {
        return $false
    }
}

# Function to debug on Android
function Debug-Android {
    param([string]$DeviceName)

    Write-Host "[Android] Checking Android environment..." -ForegroundColor Yellow

    # Check if ADB is available
    try {
        $AdbVersion = adb version
        Write-Host "[Android] ADB is available" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: ADB not found. Please install Android SDK Platform Tools" -ForegroundColor Red
        return $false
    }

    # List connected devices
    Write-Host "[Android] Checking connected devices..." -ForegroundColor Yellow
    $Devices = adb devices
    Write-Host $Devices -ForegroundColor Gray

    # Start Metro if not running
    if (-Not (Test-MetroRunning)) {
        $script:MetroServerJob = Start-MetroServer
        if (-Not $MetroServerJob) {
            return $false
        }
    } else {
        Write-Host "[Metro] Metro bundler is already running" -ForegroundColor Green
    }

    # Run the app
    Write-Host "[Android] Launching application..." -ForegroundColor Yellow
    Set-Location $ProjectRoot

    try {
        if ($DeviceName) {
            npx react-native run-android --deviceId=$DeviceName 2>&1 | Tee-Object -FilePath $LogFile
        } else {
            npx react-native run-android 2>&1 | Tee-Object -FilePath $LogFile
        }

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[Android] Application launched successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[Android] Failed to launch application. Check $LogFile" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[Android] Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to debug on iOS
function Debug-iOS {
    param([string]$DeviceName)

    Write-Host "[iOS] Checking iOS environment..." -ForegroundColor Yellow

    if (-Not ($IsMacOS -or $env:OS -match "Darwin")) {
        Write-Host "ERROR: iOS debugging can only be performed on macOS" -ForegroundColor Red
        return $false
    }

    # Check if Xcode is available
    try {
        $XcodePath = xcode-select -p
        Write-Host "[iOS] Xcode found at: $XcodePath" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Xcode not found. Please install Xcode" -ForegroundColor Red
        return $false
    }

    # Start Metro if not running
    if (-Not (Test-MetroRunning)) {
        $script:MetroServerJob = Start-MetroServer
        if (-Not $MetroServerJob) {
            return $false
        }
    } else {
        Write-Host "[Metro] Metro bundler is already running" -ForegroundColor Green
    }

    # Run the app
    Write-Host "[iOS] Launching application..." -ForegroundColor Yellow
    Set-Location $ProjectRoot

    try {
        if ($DeviceName) {
            npx react-native run-ios --device="$DeviceName" 2>&1 | Tee-Object -FilePath $LogFile
        } else {
            npx react-native run-ios 2>&1 | Tee-Object -FilePath $LogFile
        }

        if ($LASTEXITCODE -eq 0) {
            Write-Host "[iOS] Application launched successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[iOS] Failed to launch application. Check $LogFile" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "[iOS] Error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Main debug logic
$DebugSuccess = $false

if ($Platform -eq "android") {
    $DebugSuccess = Debug-Android -DeviceName $Device
} elseif ($Platform -eq "ios") {
    $DebugSuccess = Debug-iOS -DeviceName $Device
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
if ($DebugSuccess) {
    Write-Host "Debug session started successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Metro Bundler Information:" -ForegroundColor Yellow
    Write-Host "  - Running on: http://localhost:$MetroPort" -ForegroundColor White
    Write-Host "  - Press Ctrl+C to stop the server" -ForegroundColor White
    Write-Host ""
    Write-Host "Development Commands:" -ForegroundColor Yellow
    Write-Host "  - Press 'R' twice to reload the app" -ForegroundColor White
    Write-Host "  - Shake device or press Ctrl+M to open developer menu" -ForegroundColor White
} else {
    Write-Host "Debug session failed to start" -ForegroundColor Red
}
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Keep Metro server running
if ($MetroServerJob -and $DebugSuccess) {
    Write-Host "Press Ctrl+C to stop the Metro bundler and exit..." -ForegroundColor Yellow
    try {
        Wait-Job -Job $MetroServerJob
    } catch {
        Write-Host "Metro bundler stopped" -ForegroundColor Yellow
    } finally {
        Stop-Job -Job $MetroServerJob -ErrorAction SilentlyContinue
        Remove-Job -Job $MetroServerJob -ErrorAction SilentlyContinue
    }
}

if (-Not $DebugSuccess) {
    exit 1
}
