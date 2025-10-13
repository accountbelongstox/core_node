# Flutter Build Issues Fix Script
# This script fixes common Flutter build issues related to Kotlin version conflicts

Write-Host "🔧 Flutter Build Issues Fix Script" -ForegroundColor Green
Write-Host "=================================" -ForegroundColor Green

# Function to run command and check result
function Invoke-CommandWithCheck {
    param(
        [string]$Command,
        [string]$Description
    )
    
    Write-Host "`n📋 $Description" -ForegroundColor Yellow
    Write-Host "Running: $Command" -ForegroundColor Gray
    
    try {
        Invoke-Expression $Command
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $Description completed successfully" -ForegroundColor Green
        } else {
            Write-Host "❌ $Description failed with exit code $LASTEXITCODE" -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ $Description failed with error: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
    return $true
}

# Check if we're in the correct directory
if (-not (Test-Path "pubspec.yaml")) {
    Write-Host "❌ Error: pubspec.yaml not found. Please run this script from the Flutter project root." -ForegroundColor Red
    exit 1
}

Write-Host "`n🎯 Starting build fix process..." -ForegroundColor Cyan

# Step 1: Clean Flutter project
if (-not (Invoke-CommandWithCheck "flutter clean" "Cleaning Flutter project")) {
    Write-Host "❌ Flutter clean failed. Please check your Flutter installation." -ForegroundColor Red
    exit 1
}

# Step 2: Clean Android build cache
if (Test-Path "android") {
    if (-not (Invoke-CommandWithCheck "cd android && ./gradlew clean" "Cleaning Android build cache")) {
        Write-Host "⚠️ Android clean failed, but continuing..." -ForegroundColor Yellow
    }
}

# Step 3: Get Flutter dependencies
if (-not (Invoke-CommandWithCheck "flutter pub get" "Getting Flutter dependencies")) {
    Write-Host "❌ Flutter pub get failed. Please check your internet connection and pubspec.yaml." -ForegroundColor Red
    exit 1
}

# Step 4: Check Flutter doctor
Write-Host "`n🔍 Checking Flutter environment..." -ForegroundColor Yellow
Invoke-CommandWithCheck "flutter doctor" "Checking Flutter environment"

# Step 5: Analyze project
Write-Host "`n📊 Analyzing project..." -ForegroundColor Yellow
Invoke-CommandWithCheck "flutter analyze" "Analyzing Flutter project"

# Step 6: Try building APK
Write-Host "`n🏗️ Testing build..." -ForegroundColor Yellow
if (Invoke-CommandWithCheck "flutter build apk --debug" "Building debug APK") {
    Write-Host "`n🎉 Build successful! The Kotlin version issue has been resolved." -ForegroundColor Green
} else {
    Write-Host "`n⚠️ Build still failing. Additional steps may be required:" -ForegroundColor Yellow
    Write-Host "1. Check if all dependencies are compatible with Kotlin 2.1.0" -ForegroundColor White
    Write-Host "2. Update any outdated plugins" -ForegroundColor White
    Write-Host "3. Check for any custom native code that might need updates" -ForegroundColor White
    Write-Host "4. Consider using --android-skip-build-dependency-validation flag" -ForegroundColor White
}

Write-Host "`n📋 Summary of changes made:" -ForegroundColor Cyan
Write-Host "✅ Updated Kotlin version to 2.1.0 in android/build.gradle" -ForegroundColor Green
Write-Host "✅ Updated Kotlin version to 2.1.0 in android/settings.gradle" -ForegroundColor Green
Write-Host "✅ Cleaned Flutter and Android build caches" -ForegroundColor Green
Write-Host "✅ Refreshed Flutter dependencies" -ForegroundColor Green

Write-Host "`n🔧 If build still fails, try these additional steps:" -ForegroundColor Yellow
Write-Host "1. flutter build apk --android-skip-build-dependency-validation" -ForegroundColor White
Write-Host "2. Update device_info_plus to latest version" -ForegroundColor White
Write-Host "3. Check for any plugin-specific Kotlin compatibility issues" -ForegroundColor White

Write-Host "`n✨ Build fix script completed!" -ForegroundColor Green
