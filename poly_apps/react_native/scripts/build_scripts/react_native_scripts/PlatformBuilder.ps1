# PlatformBuilder.ps1
# Handles platform-specific build operations for React Native

function Start-MetroServer {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    Write-Host "[INFO] Starting Metro bundler on port $Port..." -ForegroundColor Cyan

    $env:RCT_METRO_PORT = $Port

    Set-Location $AppDirectory

    Write-Host "[COMMAND] npx react-native start --port $Port" -ForegroundColor Yellow

    Start-Process -FilePath "npx" -ArgumentList "react-native", "start", "--port", $Port -NoNewWindow -PassThru
}

function Start-AndroidDebug {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    Write-Host "[INFO] Starting Android debug build..." -ForegroundColor Cyan

    $env:RCT_METRO_PORT = $Port

    Set-Location $AppDirectory

    Write-Host "[COMMAND] npx react-native run-android --port $Port" -ForegroundColor Yellow

    npx react-native run-android --port $Port
}

function Start-IosDebug {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $true)]
        [int]$Port
    )

    Write-Host "[INFO] Starting iOS debug build..." -ForegroundColor Cyan

    $env:RCT_METRO_PORT = $Port

    Set-Location $AppDirectory

    Write-Host "[COMMAND] npx react-native run-ios --port $Port" -ForegroundColor Yellow

    npx react-native run-ios --port $Port
}

function Build-AndroidRelease {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory
    )

    Write-Host "[INFO] Building Android release..." -ForegroundColor Cyan

    Set-Location $AppDirectory

    $androidDir = Join-Path $AppDirectory "android"

    if (-not (Test-Path $androidDir)) {
        Write-Host "[ERROR] Android directory not found" -ForegroundColor Red
        return $false
    }

    Set-Location $androidDir

    if ($IsWindows) {
        Write-Host "[COMMAND] .\gradlew assembleRelease" -ForegroundColor Yellow
        .\gradlew assembleRelease
    } else {
        Write-Host "[COMMAND] ./gradlew assembleRelease" -ForegroundColor Yellow
        ./gradlew assembleRelease
    }

    $apkPath = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"

    if (Test-Path $apkPath) {
        Write-Host "[OK] Android APK built successfully: $apkPath" -ForegroundColor Green
        return $true
    } else {
        Write-Host "[ERROR] APK file not found at expected location" -ForegroundColor Red
        return $false
    }
}

function Build-IosRelease {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory
    )

    Write-Host "[INFO] Building iOS release..." -ForegroundColor Cyan

    if (-not ($IsMacOS)) {
        Write-Host "[ERROR] iOS builds are only supported on macOS" -ForegroundColor Red
        return $false
    }

    Set-Location $AppDirectory

    $iosDir = Join-Path $AppDirectory "ios"

    if (-not (Test-Path $iosDir)) {
        Write-Host "[ERROR] iOS directory not found" -ForegroundColor Red
        return $false
    }

    Set-Location $iosDir

    Write-Host "[INFO] Installing CocoaPods dependencies..." -ForegroundColor Cyan
    pod install

    Write-Host "[COMMAND] xcodebuild -workspace YourApp.xcworkspace -scheme YourApp -configuration Release archive" -ForegroundColor Yellow

    xcodebuild -workspace YourApp.xcworkspace -scheme YourApp -configuration Release archive -archivePath "./build/YourApp.xcarchive"

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] iOS archive built successfully" -ForegroundColor Green
        return $true
    } else {
        Write-Host "[ERROR] iOS build failed" -ForegroundColor Red
        return $false
    }
}

function Start-TestRunner {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory,
        [Parameter(Mandatory = $false)]
        [string]$Namespace = ""
    )

    Write-Host "[INFO] Running tests..." -ForegroundColor Cyan

    Set-Location $AppDirectory

    if ([string]::IsNullOrEmpty($Namespace)) {
        Write-Host "[COMMAND] npm test" -ForegroundColor Yellow
        npm test
    } else {
        Write-Host "[COMMAND] npm test -- --testPathPattern=app_$Namespace" -ForegroundColor Yellow
        npm test -- --testPathPattern="app_$Namespace"
    }
}
