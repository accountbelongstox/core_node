# Prerequisites.ps1
# Checks React Native development environment prerequisites

function Test-NodeInstallation {
    Write-Host "[CHECK] Verifying Node.js installation..." -ForegroundColor Cyan

    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] Node.js is not installed or not in PATH" -ForegroundColor Red
        Write-Host "[INFO] Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
        return $false
    }

    $nodeVersion = node --version
    Write-Host "[OK] Node.js installed: $nodeVersion" -ForegroundColor Green
    return $true
}

function Test-NpmInstallation {
    Write-Host "[CHECK] Verifying npm installation..." -ForegroundColor Cyan

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Host "[ERROR] npm is not installed or not in PATH" -ForegroundColor Red
        return $false
    }

    $npmVersion = npm --version
    Write-Host "[OK] npm installed: $npmVersion" -ForegroundColor Green
    return $true
}

function Test-ReactNativeCli {
    Write-Host "[CHECK] Verifying React Native CLI..." -ForegroundColor Cyan

    if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
        Write-Host "[WARNING] npx not found, React Native CLI may not work" -ForegroundColor Yellow
        return $false
    }

    Write-Host "[OK] React Native CLI available via npx" -ForegroundColor Green
    return $true
}

function Test-JavaInstallation {
    Write-Host "[CHECK] Verifying Java installation (for Android)..." -ForegroundColor Cyan

    if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
        Write-Host "[WARNING] Java is not installed (required for Android builds)" -ForegroundColor Yellow
        return $false
    }

    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "[OK] Java installed: $javaVersion" -ForegroundColor Green
    return $true
}

function Test-AndroidSdk {
    Write-Host "[CHECK] Verifying Android SDK..." -ForegroundColor Cyan

    $androidHome = $env:ANDROID_HOME
    if ([string]::IsNullOrEmpty($androidHome)) {
        $androidHome = $env:ANDROID_SDK_ROOT
    }

    if ([string]::IsNullOrEmpty($androidHome)) {
        Write-Host "[WARNING] ANDROID_HOME or ANDROID_SDK_ROOT not set" -ForegroundColor Yellow
        return $false
    }

    if (-not (Test-Path $androidHome)) {
        Write-Host "[WARNING] Android SDK path does not exist: $androidHome" -ForegroundColor Yellow
        return $false
    }

    Write-Host "[OK] Android SDK found at: $androidHome" -ForegroundColor Green
    return $true
}

function Test-XcodeInstallation {
    Write-Host "[CHECK] Verifying Xcode installation (macOS only)..." -ForegroundColor Cyan

    if (-not ($IsMacOS -or $IsLinux)) {
        Write-Host "[SKIP] Xcode check skipped (not on macOS)" -ForegroundColor Gray
        return $true
    }

    if (-not (Get-Command xcodebuild -ErrorAction SilentlyContinue)) {
        Write-Host "[WARNING] Xcode is not installed (required for iOS builds)" -ForegroundColor Yellow
        return $false
    }

    $xcodeVersion = xcodebuild -version | Select-Object -First 1
    Write-Host "[OK] Xcode installed: $xcodeVersion" -ForegroundColor Green
    return $true
}

function Test-CocoaPodsInstallation {
    Write-Host "[CHECK] Verifying CocoaPods installation (for iOS)..." -ForegroundColor Cyan

    if (-not ($IsMacOS -or $IsLinux)) {
        Write-Host "[SKIP] CocoaPods check skipped (not on macOS)" -ForegroundColor Gray
        return $true
    }

    if (-not (Get-Command pod -ErrorAction SilentlyContinue)) {
        Write-Host "[WARNING] CocoaPods is not installed (required for iOS dependencies)" -ForegroundColor Yellow
        return $false
    }

    $podVersion = pod --version
    Write-Host "[OK] CocoaPods installed: $podVersion" -ForegroundColor Green
    return $true
}

function Test-Prerequisites {
    param(
        [Parameter(Mandatory = $true)]
        [string]$AppDirectory
    )

    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host "  PREREQUISITES CHECK" -ForegroundColor Cyan
    Write-Host "===============================================================================" -ForegroundColor Cyan
    Write-Host ""

    $allOk = $true

    $allOk = (Test-NodeInstallation) -and $allOk
    $allOk = (Test-NpmInstallation) -and $allOk
    $allOk = (Test-ReactNativeCli) -and $allOk

    Test-JavaInstallation | Out-Null
    Test-AndroidSdk | Out-Null
    Test-XcodeInstallation | Out-Null
    Test-CocoaPodsInstallation | Out-Null

    Write-Host ""
    Write-Host "===============================================================================" -ForegroundColor Cyan

    if (-not $allOk) {
        Write-Host "[WARNING] Some prerequisites are missing" -ForegroundColor Yellow
        Write-Host "[INFO] Core prerequisites (Node.js, npm) are required" -ForegroundColor Yellow
        Write-Host "[INFO] Platform-specific tools are optional but recommended" -ForegroundColor Yellow
        Write-Host ""
    }

    return $allOk
}
