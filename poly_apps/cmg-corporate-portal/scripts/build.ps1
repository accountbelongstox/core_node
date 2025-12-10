# ============================================
# React Native Project Build Script
# ============================================
# This script builds the React Native application for Android and iOS
# Usage: .\build.ps1 [-Platform <android|ios|all>] [-Configuration <debug|release>]

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("android", "ios", "all")]
    [string]$Platform = "android",

    [Parameter(Mandatory=$false)]
    [ValidateSet("debug", "release")]
    [string]$Configuration = "release"
)

# Declare all variables at the beginning
$ErrorActionPreference = "Stop"
$ScriptDir = $null
$ProjectRoot = $null
$AndroidPath = $null
$IosPath = $null
$BuildOutputPath = $null
$LogFile = $null

# Initialize paths
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$AndroidPath = Join-Path -Path $ProjectRoot -ChildPath "android"
$IosPath = Join-Path -Path $ProjectRoot -ChildPath "ios"
$BuildOutputPath = Join-Path -Path $ProjectRoot -ChildPath "build"
$LogFile = Join-Path -Path $ProjectRoot -ChildPath "build.log"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "React Native Project Build" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Platform: $Platform" -ForegroundColor White
Write-Host "Configuration: $Configuration" -ForegroundColor White
Write-Host ""

# Check if node_modules exists
$NodeModulesPath = Join-Path -Path $ProjectRoot -ChildPath "node_modules"
if (-Not (Test-Path $NodeModulesPath)) {
    Write-Host "ERROR: node_modules not found. Please run install.ps1 first" -ForegroundColor Red
    exit 1
}

# Function to build Android
function Build-Android {
    param([string]$Config)

    Write-Host "[Android] Starting build process..." -ForegroundColor Yellow

    if (-Not (Test-Path $AndroidPath)) {
        Write-Host "ERROR: Android directory not found at: $AndroidPath" -ForegroundColor Red
        return $false
    }

    Set-Location $AndroidPath

    if ($Config -eq "release") {
        Write-Host "[Android] Building release APK..." -ForegroundColor Yellow
        $GradleCommand = "assembleRelease"
    } else {
        Write-Host "[Android] Building debug APK..." -ForegroundColor Yellow
        $GradleCommand = "assembleDebug"
    }

    try {
        if ($IsWindows -or $env:OS -match "Windows") {
            .\gradlew.bat $GradleCommand 2>&1 | Tee-Object -FilePath $LogFile -Append
        } else {
            ./gradlew $GradleCommand 2>&1 | Tee-Object -FilePath $LogFile -Append
        }

        if ($LASTEXITCODE -ne 0) {
            Write-Host "[Android] Build failed. Check $LogFile for details" -ForegroundColor Red
            return $false
        }

        Write-Host "[Android] Build completed successfully" -ForegroundColor Green

        $ApkPath = Join-Path -Path $AndroidPath -ChildPath "app\build\outputs\apk\$Config"
        if (Test-Path $ApkPath) {
            Write-Host "[Android] APK location: $ApkPath" -ForegroundColor Green
        }

        return $true
    } catch {
        Write-Host "[Android] Build error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    } finally {
        Set-Location $ProjectRoot
    }
}

# Function to build iOS
function Build-iOS {
    param([string]$Config)

    Write-Host "[iOS] Starting build process..." -ForegroundColor Yellow

    if (-Not (Test-Path $IosPath)) {
        Write-Host "ERROR: iOS directory not found at: $IosPath" -ForegroundColor Red
        return $false
    }

    if (-Not ($IsMacOS -or $env:OS -match "Darwin")) {
        Write-Host "WARNING: iOS builds can only be performed on macOS" -ForegroundColor Yellow
        return $false
    }

    Set-Location $IosPath

    Write-Host "[iOS] Installing CocoaPods dependencies..." -ForegroundColor Yellow
    try {
        pod install 2>&1 | Tee-Object -FilePath $LogFile -Append
    } catch {
        Write-Host "[iOS] CocoaPods installation failed" -ForegroundColor Red
        return $false
    }

    $ConfigCapitalized = (Get-Culture).TextInfo.ToTitleCase($Config)
    Write-Host "[iOS] Building $ConfigCapitalized configuration..." -ForegroundColor Yellow

    try {
        xcodebuild -workspace "react_init.xcworkspace" `
                   -scheme "react_init" `
                   -configuration $ConfigCapitalized `
                   -sdk iphoneos `
                   -derivedDataPath "./build" `
                   2>&1 | Tee-Object -FilePath $LogFile -Append

        if ($LASTEXITCODE -ne 0) {
            Write-Host "[iOS] Build failed. Check $LogFile for details" -ForegroundColor Red
            return $false
        }

        Write-Host "[iOS] Build completed successfully" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[iOS] Build error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    } finally {
        Set-Location $ProjectRoot
    }
}

# Main build logic
$BuildSuccess = $true

if ($Platform -eq "android" -or $Platform -eq "all") {
    Write-Host ""
    if (-Not (Build-Android -Config $Configuration)) {
        $BuildSuccess = $false
    }
}

if ($Platform -eq "ios" -or $Platform -eq "all") {
    Write-Host ""
    if (-Not (Build-iOS -Config $Configuration)) {
        $BuildSuccess = $false
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
if ($BuildSuccess) {
    Write-Host "Build process completed successfully!" -ForegroundColor Green
} else {
    Write-Host "Build process completed with errors" -ForegroundColor Red
}
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if (-Not $BuildSuccess) {
    exit 1
}
