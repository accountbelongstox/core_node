# Temporary PowerShell Script for Building Bank App APK
# This is a temporary script for building the Flutter Bank App to APK
# Author: AI Assistant
# Date: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

# Store the original working directory
$OriginalDirectory = Get-Location

try {
    Write-Host "Starting Bank App APK build process..." -ForegroundColor Green
    
    # Change to Flutter project root directory (parent directory of script location)
    $ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
    $FlutterProjectRoot = Split-Path -Parent $ScriptDirectory
    Set-Location $FlutterProjectRoot
    
    Write-Host "Changed working directory to: $FlutterProjectRoot" -ForegroundColor Yellow
    
    # Clean previous builds
    Write-Host "Cleaning previous builds..." -ForegroundColor Cyan
    flutter clean
    
    # Get Flutter dependencies
    Write-Host "Getting Flutter dependencies..." -ForegroundColor Cyan
    flutter pub get
    
    # Build APK using the bank app main entry point
    Write-Host "Building APK for Bank App..." -ForegroundColor Cyan
    Write-Host "Using entry point: lib/apps/app_bank/main_app_bank.dart" -ForegroundColor Yellow
    
    # Build APK with specific target file
    flutter build apk --target=lib/apps/app_bank/main_app_bank.dart --release
    
    # Check if build was successful
    if ($LASTEXITCODE -eq 0) {
        Write-Host "APK build completed successfully!" -ForegroundColor Green
        
        # Define APK output directory
        $ApkOutputDir = Join-Path $FlutterProjectRoot "build\app\outputs\flutter-apk"
        
        # Check if APK directory exists
        if (Test-Path $ApkOutputDir) {
            Write-Host "APK output directory: $ApkOutputDir" -ForegroundColor Yellow
            
            # List APK files
            $ApkFiles = Get-ChildItem -Path $ApkOutputDir -Filter "*.apk"
            if ($ApkFiles.Count -gt 0) {
                Write-Host "Generated APK files:" -ForegroundColor Green
                foreach ($ApkFile in $ApkFiles) {
                    Write-Host "  - $($ApkFile.Name)" -ForegroundColor White
                    Write-Host "    Size: $([math]::Round($ApkFile.Length / 1MB, 2)) MB" -ForegroundColor Gray
                    Write-Host "    Path: $($ApkFile.FullName)" -ForegroundColor Gray
                }
                
                # Open APK directory in Explorer
                Write-Host "Opening APK directory in Explorer..." -ForegroundColor Cyan
                Start-Process "explorer.exe" -ArgumentList $ApkOutputDir
                
                Write-Host "APK build process completed successfully!" -ForegroundColor Green
            } else {
                Write-Host "No APK files found in output directory." -ForegroundColor Red
            }
        } else {
            Write-Host "APK output directory not found: $ApkOutputDir" -ForegroundColor Red
        }
    } else {
        Write-Host "APK build failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        Write-Host "Please check the error messages above." -ForegroundColor Red
    }
    
} catch {
    Write-Host "An error occurred during the build process:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
} finally {
    # Always return to original directory
    Write-Host "Returning to original directory: $OriginalDirectory" -ForegroundColor Yellow
    Set-Location $OriginalDirectory
    Write-Host "Build script execution completed." -ForegroundColor Green
}

# Script completion message
Write-Host "Temporary build script finished. This script will be removed after use." -ForegroundColor Magenta
